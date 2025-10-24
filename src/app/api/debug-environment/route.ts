import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConfig, getCurrentEnvironment } from '@/lib/databaseConfig';
import { getUserCount, getConfirmedUserCount } from '@/lib/secureDatabase';

export async function GET(request: NextRequest) {
  try {
    const config = getDatabaseConfig();
    const environment = getCurrentEnvironment();
    
    // Get user counts (this will only work if database is initialized)
    let userCount = 0;
    let confirmedUserCount = 0;
    let dbError = null;
    
    try {
      userCount = await getUserCount();
      confirmedUserCount = await getConfirmedUserCount();
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error';
    }
    
    return NextResponse.json({
      success: true,
      environment: {
        current: environment,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA,
        database: config.database,
        hasConnectionString: !!config.connectionString,
        connectionStringPreview: config.connectionString.substring(0, 20) + '...'
      },
      database: {
        userCount,
        confirmedUserCount,
        error: dbError,
        initialized: !dbError
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting environment info:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get environment info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



