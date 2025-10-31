import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';

export async function GET() {
  try {
    // Test a simple query without parameters
    const result = await sql`SELECT 1 as test`;
    
    return NextResponse.json({
      success: true,
      message: 'SQL test successful',
      result: result.rows,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('SQL test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'SQL test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



