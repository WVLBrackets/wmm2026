import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
    EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('EMAIL') || key.startsWith('NEXTAUTH'))
  });
}

