import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  return NextResponse.json({
    success: true,
    message: 'URL parsing test',
    fullUrl: request.url,
    searchParams: searchParams.toString(),
    token: token,
    tokenLength: token ? token.length : 0,
    timestamp: new Date().toISOString(),
  });
}
