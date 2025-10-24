import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test basic functionality
    const { getCurrentEnvironment } = await import('@/lib/databaseConfig');
    const environment = getCurrentEnvironment();
    
    return NextResponse.json({
      success: true,
      message: 'Basic test successful',
      environment,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}



