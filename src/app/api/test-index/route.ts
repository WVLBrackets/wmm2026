import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';

export async function GET() {
  try {
    // Test creating an index
    await sql`CREATE INDEX IF NOT EXISTS idx_test ON test_table(id)`;
    
    return NextResponse.json({
      success: true,
      message: 'Test index created successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Test index creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test index creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



