import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

export async function GET() {
  try {
    const environment = getCurrentEnvironment();
    
    // Test just creating the users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email_confirmed BOOLEAN DEFAULT FALSE,
        environment VARCHAR(50) NOT NULL DEFAULT ${environment},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Simple users table created successfully',
      environment,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Simple init error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Simple init failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



