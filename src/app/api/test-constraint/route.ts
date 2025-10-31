import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';

export async function GET() {
  try {
    // Test adding a constraint
    await sql`
      ALTER TABLE test_table ADD CONSTRAINT IF NOT EXISTS chk_test_environment 
      CHECK (environment IN ('development', 'preview', 'production'))
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Test constraint added successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Test constraint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test constraint failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



