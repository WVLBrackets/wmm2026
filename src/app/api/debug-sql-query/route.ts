import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

export async function GET() {
  try {
    const environment = getCurrentEnvironment();
    
    // Test what the template literal looks like
    const testQuery = `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      environment VARCHAR(50) NOT NULL DEFAULT '${environment}'
    )`;
    
    return NextResponse.json({
      success: true,
      environment,
      testQuery,
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



