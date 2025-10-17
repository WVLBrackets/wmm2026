import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    return NextResponse.json({
      success: true,
      message: 'Token debug information',
      token: token || 'NO TOKEN PROVIDED',
      tokenLength: token ? token.length : 0,
      url: request.url,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
