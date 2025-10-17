import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InMemoryUserRepository } from '@/lib/repositories/userRepository';

// Simple admin check - in production, you'd have proper role-based access
function isAdmin(session: any): boolean {
  // For now, check if user email is admin@wmm2026.com
  return session?.user?.email === 'admin@wmm2026.com';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const userRepo = InMemoryUserRepository;
    const users = await userRepo.listUsers();

    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isConfirmed: user.emailConfirmed,
        createdAt: user.id, // Placeholder - would be actual timestamp in DB
      }))
    });

  } catch (error) {
    console.error('Admin users list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const { action, userId, data } = await request.json();

    const userRepo = InMemoryUserRepository;

    switch (action) {
      case 'resetPassword':
        if (!userId || !data?.newPassword) {
          return NextResponse.json(
            { error: 'User ID and new password required' },
            { status: 400 }
          );
        }
        await userRepo.setPassword(userId, data.newPassword);
        return NextResponse.json({ message: 'Password reset successfully' });

      case 'updateName':
        if (!userId || !data?.name) {
          return NextResponse.json(
            { error: 'User ID and name required' },
            { status: 400 }
          );
        }
        await userRepo.updateName(userId, data.name);
        return NextResponse.json({ message: 'Name updated successfully' });

      case 'deleteUser':
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID required' },
            { status: 400 }
          );
        }
        await userRepo.deleteUser(userId);
        return NextResponse.json({ message: 'User deleted successfully' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

