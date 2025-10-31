import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const environment = process.env.NODE_ENV;
    
    // Test direct import
    let sqlTest = null;
    let error = null;
    
    try {
      if (environment === 'development') {
        const { sql } = await import('@/lib/localPostgres');
        sqlTest = typeof sql;
        console.log('Local postgres sql type:', sqlTest);
      } else {
        const { sql } = await import('@vercel/postgres');
        sqlTest = typeof sql;
        console.log('Vercel postgres sql type:', sqlTest);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    return NextResponse.json({
      success: true,
      environment,
      sqlType: sqlTest,
      error,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
