import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
      EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
      EMAIL_USER_VALUE: process.env.EMAIL_USER || 'NOT SET',
      EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
      ALL_ENV_KEYS: Object.keys(process.env).filter(key => 
        key.includes('EMAIL') || key.includes('NEXTAUTH')
      ),
    };

    return NextResponse.json({
      success: true,
      message: 'Environment variable check',
      envCheck,
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
