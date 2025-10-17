import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Debug confirm test endpoint is working',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
