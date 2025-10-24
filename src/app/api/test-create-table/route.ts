import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

export async function GET() {
  try {
    const environment = getCurrentEnvironment();
    
    // Test creating a simple table
    await sql`
      CREATE TABLE IF NOT EXISTS test_table (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL DEFAULT ${environment}
      )
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Test table created successfully',
      environment,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Test table creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test table creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



