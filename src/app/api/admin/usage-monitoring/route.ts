import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { emailService } from '@/lib/emailService';

/**
 * GET /api/admin/usage-monitoring - Get usage statistics vs free tier limits (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Admin access required'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || getCurrentEnvironment();

    // Get current date range (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Get today's date range
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Query email usage for current month
    const monthlyEmailResult = await sql`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE email_success = true) as successful_emails,
        COUNT(*) FILTER (WHERE attachment_expected = true) as pdf_generations,
        COUNT(*) FILTER (WHERE attachment_expected = true AND attachment_success = true) as successful_pdfs
      FROM email_logs
      WHERE environment = ${environment}
        AND timestamp >= ${startOfMonth.toISOString()}
        AND timestamp <= ${endOfMonth.toISOString()}
    `;

    // Query email usage for today
    const dailyEmailResult = await sql`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE email_success = true) as successful_emails,
        COUNT(*) FILTER (WHERE attachment_expected = true) as pdf_generations,
        COUNT(*) FILTER (WHERE attachment_expected = true AND attachment_success = true) as successful_pdfs
      FROM email_logs
      WHERE environment = ${environment}
        AND timestamp >= ${startOfToday.toISOString()}
        AND timestamp <= ${endOfToday.toISOString()}
    `;

    const monthlyEmails = Number(monthlyEmailResult.rows[0]?.total_emails || 0);
    const monthlySuccessfulEmails = Number(monthlyEmailResult.rows[0]?.successful_emails || 0);
    const monthlyPdfs = Number(monthlyEmailResult.rows[0]?.pdf_generations || 0);
    const monthlySuccessfulPdfs = Number(monthlyEmailResult.rows[0]?.successful_pdfs || 0);

    const dailyEmails = Number(dailyEmailResult.rows[0]?.total_emails || 0);
    const dailySuccessfulEmails = Number(dailyEmailResult.rows[0]?.successful_emails || 0);
    const dailyPdfs = Number(dailyEmailResult.rows[0]?.pdf_generations || 0);
    const dailySuccessfulPdfs = Number(dailyEmailResult.rows[0]?.successful_pdfs || 0);

    // Detect which email provider is actually being used
    const emailProvider = emailService.getProvider();
    const emailStatus = emailService.getStatus();
    
    // Determine email service limits based on actual provider
    let emailServiceLimits: {
      monthly: number;
      daily: number;
      name: string;
      upgradeCost: {
        tier1: { range: string; cost: number; description: string };
        tier2?: { range: string; cost: number; description: string };
        tier3?: { range: string; cost: number; description: string };
      };
    };

    if (emailProvider === 'gmail') {
      // Gmail SMTP limits: 500 emails per day (no monthly limit, but daily is the constraint)
      // Monthly would be ~15,000 if sending at max daily rate
      emailServiceLimits = {
        monthly: 15000, // Approximate if sending at daily max
        daily: 500,
        name: 'Gmail SMTP',
        upgradeCost: {
          tier1: { range: 'Upgrade to Google Workspace', cost: 6, description: '$6/month per user for Google Workspace (2,000 emails/day)' },
          tier2: { range: 'Use SendGrid', cost: 20, description: '$20/month for SendGrid (up to 50,000 emails)' },
          tier3: { range: 'Use Resend', cost: 20, description: '$20/month for Resend (up to 50,000 emails)' },
        }
      };
    } else if (emailProvider === 'sendgrid') {
      // SendGrid free tier: 100 emails/day
      emailServiceLimits = {
        monthly: 3000,
        daily: 100,
        name: 'SendGrid',
        upgradeCost: {
          tier1: { range: '3,001 - 50,000', cost: 20, description: '$20/month for up to 50,000 emails' },
          tier2: { range: '50,001 - 100,000', cost: 35, description: '$35/month for up to 100,000 emails' },
          tier3: { range: '100,001 - 200,000', cost: 160, description: '$160/month for up to 200,000 emails' },
        }
      };
    } else {
      // Default to Resend limits (though not actually implemented)
      emailServiceLimits = {
        monthly: 3000,
        daily: 100,
        name: 'Email Service',
        upgradeCost: {
          tier1: { range: 'Configure SendGrid or Resend', cost: 20, description: '$20/month for up to 50,000 emails' },
        }
      };
    }

    // Free tier limits
    const limits = {
      email: emailServiceLimits,
      vercel: {
        name: 'Vercel Hosting',
        functionExecution: {
          limit: 10, // seconds per request (Hobby plan)
          description: '10 seconds per function execution'
        },
        bandwidth: {
          limit: 100, // GB per month
          description: '100 GB/month bandwidth'
        },
        upgradeCost: {
          pro: { cost: 20, description: '$20/month Pro plan (includes $20 usage credit, faster builds, team features)' },
          additional: { description: 'Additional usage: $2 per 1M edge requests, $0.15 per GB data transfer' }
        }
      }
    };

    // Calculate percentages and status
    const monthlyEmailPercent = (monthlyEmails / limits.email.monthly) * 100;
    const dailyEmailPercent = (dailyEmails / limits.email.daily) * 100;

    // Determine alert levels
    const getAlertLevel = (percent: number): 'ok' | 'warning' | 'critical' => {
      if (percent >= 90) return 'critical';
      if (percent >= 75) return 'warning';
      return 'ok';
    };

    const monthlyEmailAlert = getAlertLevel(monthlyEmailPercent);
    const dailyEmailAlert = getAlertLevel(dailyEmailPercent);

    // Calculate projected monthly usage based on current day of month
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyEmails = dayOfMonth > 0 && monthlyEmails > 0
      ? Math.round((monthlyEmails / dayOfMonth) * daysInMonth)
      : monthlyEmails;

    // Calculate days remaining in month
    const daysRemaining = daysInMonth - dayOfMonth;

    return NextResponse.json({
      success: true,
      usage: {
        emails: {
          monthly: {
            used: monthlyEmails,
            successful: monthlySuccessfulEmails,
            limit: limits.email.monthly,
            percent: Math.round(monthlyEmailPercent * 100) / 100,
            alertLevel: monthlyEmailAlert,
            projected: projectedMonthlyEmails,
            daysRemaining,
            daysInMonth
          },
          daily: {
            used: dailyEmails,
            successful: dailySuccessfulEmails,
            limit: limits.email.daily,
            percent: Math.round(dailyEmailPercent * 100) / 100,
            alertLevel: dailyEmailAlert
          },
          provider: emailProvider,
          providerName: emailStatus.provider
        },
        pdfs: {
          monthly: {
            generated: monthlyPdfs,
            successful: monthlySuccessfulPdfs
          },
          daily: {
            generated: dailyPdfs,
            successful: dailySuccessfulPdfs
          }
        }
      },
      limits,
      recommendations: {
        emails: monthlyEmailPercent >= 90 
          ? 'CRITICAL: You are at or near your monthly email limit. Consider upgrading immediately.'
          : monthlyEmailPercent >= 75
          ? 'WARNING: You are approaching your monthly email limit. Consider upgrading soon.'
          : dailyEmailPercent >= 90
          ? 'WARNING: You are at or near your daily email limit. Monitor usage closely.'
          : dailyEmailPercent >= 75
          ? 'INFO: Daily email usage is elevated. Monitor to ensure you stay within monthly limits.'
          : 'OK: Email usage is within safe limits.',
        actions: {
          immediate: monthlyEmailPercent >= 90 
            ? [`Upgrade ${emailServiceLimits.name} plan to avoid service interruption`, 'Review email sending patterns to optimize usage']
            : monthlyEmailPercent >= 75
            ? ['Monitor usage daily', `Consider upgrading ${emailServiceLimits.name} plan before reaching limit`, 'Review if all emails are necessary']
            : [],
          optimization: [
            'Cache PDFs to avoid regenerating for same bracket',
            'Review email sending frequency',
            'Consider batching non-critical emails'
          ]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching usage monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch usage monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

