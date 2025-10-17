import { NextRequest, NextResponse } from 'next/server';
import { tokens, users } from '@/lib/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  return NextResponse.json({
    success: true,
    message: 'Token check debug info',
    receivedToken: token,
    tokenLength: token ? token.length : 0,
    totalTokens: tokens.length,
    totalUsers: users.length,
    tokens: tokens.map(t => ({
      token: t.token.substring(0, 8) + '...',
      type: t.type,
      userId: t.userId,
      expires: t.expires.toISOString()
    })),
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      emailConfirmed: u.emailConfirmed,
      hasConfirmationToken: !!u.confirmationToken
    })),
    timestamp: new Date().toISOString(),
  });
}
