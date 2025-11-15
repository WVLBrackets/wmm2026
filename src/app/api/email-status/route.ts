import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { emailService } from '@/lib/emailService';

export async function GET() {
  try {
    // Require admin authentication
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
    
    const status = emailService.getStatus();
    
    return NextResponse.json({
      success: true,
      emailService: status,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Require admin authentication
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
    
    const { to, subject, message } = await request.json();
    
    if (!to || !subject || !message) {
      return NextResponse.json({
        success: false,
        error: 'to, subject, and message are required'
      }, { status: 400 });
    }

    const emailSent = await emailService.sendEmail({
      to,
      subject,
      html: `
        <h2>Test Email</h2>
        <p>${message}</p>
        <p>This is a test email sent from Warren's March Madness.</p>
      `,
      text: `Test Email\n\n${message}\n\nThis is a test email sent from Warren's March Madness.`
    });

    return NextResponse.json({
      success: emailSent,
      message: emailSent ? 'Test email sent successfully' : 'Failed to send test email',
      emailService: emailService.getStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
