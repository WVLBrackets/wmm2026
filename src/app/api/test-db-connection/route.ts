import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test the environment variables
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_LOCAL: process.env.DATABASE_URL_LOCAL ? 'SET' : 'NOT SET',
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
      DATABASE_URL_LOCAL_VALUE: process.env.DATABASE_URL_LOCAL?.substring(0, 50) + '...' || 'NOT SET'
    };

    // Try to import and test the database config
    const { getDatabaseConfig, getCurrentEnvironment } = await import('@/lib/databaseConfig');
    const { getDatabaseInfo } = await import('@/lib/databaseAdapter');
    
    const config = getDatabaseConfig();
    const environment = getCurrentEnvironment();
    const dbInfo = getDatabaseInfo();

    return NextResponse.json({
      success: true,
      message: 'Database connection test',
      environment,
      databaseInfo: dbInfo,
      config: {
        environment: config.environment,
        database: config.database,
        hasConnectionString: !!config.connectionString,
        connectionStringPreview: config.connectionString?.substring(0, 50) + '...' || 'NOT SET'
      },
      envVars,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Database connection test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test database connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
