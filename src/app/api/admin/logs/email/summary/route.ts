import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/email/summary - Get email log summary for last 7 days grouped by day and event type (admin only)
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate last 7 days if no date range provided
    let startDateISO: string;
    let endDateISO: string;
    
    if (startDate && endDate) {
      startDateISO = startDate;
      endDateISO = endDate;
    } else {
      // Default to last 7 days
      const end = new Date();
      end.setHours(23, 59, 59, 999); // End of today
      const start = new Date(end);
      start.setDate(start.getDate() - 6); // 7 days ago (including today)
      start.setHours(0, 0, 0, 0); // Start of day
      
      startDateISO = start.toISOString();
      endDateISO = end.toISOString();
    }

    // Query for data grouped by day and event type
    const result = await sql`
      SELECT 
        (timestamp::date)::text as date,
        event_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE email_success = true) as email_success_count,
        COUNT(*) FILTER (WHERE attachment_expected = true) as pdf_count,
        COUNT(*) FILTER (WHERE attachment_expected = true AND attachment_success = true) as pdf_success_count
      FROM email_logs
      WHERE environment = ${environment}
        AND timestamp >= ${startDateISO}
        AND timestamp <= ${endDateISO}
      GROUP BY (timestamp::date), event_type
      ORDER BY (timestamp::date) DESC, event_type ASC
    `;

    interface SummaryRow {
      date: string;
      event_type: string;
      count: number;
      email_success_count: number;
      pdf_count: number;
      pdf_success_count: number;
    }

    const rows = (result.rows || []).map((row: SummaryRow) => ({
      date: row.date,
      eventType: row.event_type,
      count: Number(row.count),
      emailSuccessCount: Number(row.email_success_count),
      pdfCount: Number(row.pdf_count),
      pdfSuccessCount: Number(row.pdf_success_count),
    }));

    // Organize data by day
    const dataByDay: Record<string, {
      events: Record<string, number>;
      totalEmails: number;
      totalPdfs: number;
      totalPdfSuccess: number;
    }> = {};
    const eventTotals: Record<string, number> = {};
    let grandTotalEmails = 0;
    let grandTotalPdfs = 0;
    let grandTotalPdfSuccess = 0;

    rows.forEach((row) => {
      const dateKey = row.date;
      if (!dataByDay[dateKey]) {
        dataByDay[dateKey] = { events: {}, totalEmails: 0, totalPdfs: 0, totalPdfSuccess: 0 };
      }

      dataByDay[dateKey].events[row.eventType] = (dataByDay[dateKey].events[row.eventType] || 0) + row.count;
      dataByDay[dateKey].totalEmails += row.count;
      dataByDay[dateKey].totalPdfs += row.pdfCount;
      dataByDay[dateKey].totalPdfSuccess += row.pdfSuccessCount;

      eventTotals[row.eventType] = (eventTotals[row.eventType] || 0) + row.count;
      grandTotalEmails += row.count;
      grandTotalPdfs += row.pdfCount;
      grandTotalPdfSuccess += row.pdfSuccessCount;
    });

    // Get all unique event types
    const allEventTypes = Array.from(new Set(rows.map(r => r.eventType))).sort();

    // Generate array of last 7 days (or date range)
    const days: string[] = [];
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);
    const current = new Date(start);
    
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      days.push(dateKey);
      current.setDate(current.getDate() + 1);
    }

    // Build grid data
    const gridData = days.map(day => {
      const dayData = dataByDay[day] || { events: {}, totalEmails: 0, totalPdfs: 0, totalPdfSuccess: 0 };
      
      return {
        date: day,
        events: allEventTypes.map(eventType => ({
          eventType,
          count: dayData.events[eventType] || 0,
        })),
        dayTotal: {
          emails: dayData.totalEmails,
          pdfs: dayData.totalPdfs,
          pdfSuccess: dayData.totalPdfSuccess,
        },
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        gridData,
        eventTotals: Object.entries(eventTotals).map(([eventType, count]) => ({
          eventType,
          count,
        })),
        totals: {
          emails: grandTotalEmails,
          pdfs: grandTotalPdfs,
          pdfSuccess: grandTotalPdfSuccess,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching email log summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch email log summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

