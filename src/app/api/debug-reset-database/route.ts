import { NextRequest, NextResponse } from 'next/server';
import { users, tokens } from '@/lib/database';

export async function POST(request: NextRequest) {
  // Clear all users and tokens
  users.length = 0;
  tokens.length = 0;
  
  return NextResponse.json({
    success: true,
    message: 'Database cleared successfully',
    usersCount: users.length,
    tokensCount: tokens.length,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Database status',
    usersCount: users.length,
    tokensCount: tokens.length,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      emailConfirmed: u.emailConfirmed,
      hasConfirmationToken: !!u.confirmationToken
    })),
    tokens: tokens.map(t => ({
      token: t.token.substring(0, 8) + '...',
      type: t.type,
      userId: t.userId,
      expires: t.expires.toISOString()
    })),
    timestamp: new Date().toISOString(),
  });
}
