import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test if we can access environment variables
    const envTest = {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('EMAIL') || key.includes('NEXTAUTH')
      ),
      nodeEnv: process.env.NODE_ENV,
      allProcessEnvKeys: Object.keys(process.env).length
    };

    return NextResponse.json({
      success: true,
      message: 'Simple test successful',
      envTest
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

