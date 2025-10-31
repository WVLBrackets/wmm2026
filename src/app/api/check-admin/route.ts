import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ isAdmin: false });
    }

    // Check if user's email matches the ADMIN_EMAIL environment variable
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const isAdmin = session.user.email.toLowerCase() === adminEmail.toLowerCase();

    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false });
  }
}

