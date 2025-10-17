import { NextResponse } from 'next/server';
import { testEmailConfiguration } from '@/lib/test-email';

export async function GET() {
  try {
    const success = await testEmailConfiguration();
    
    if (success) {
      return NextResponse.json({
        message: 'Email configuration test successful!',
        status: 'success'
      });
    } else {
      return NextResponse.json({
        message: 'Email configuration test failed. Check your Gmail settings.',
        status: 'error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({
      message: 'Error testing email configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

