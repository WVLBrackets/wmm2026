'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import DevAuthAutoSignIn from '@/components/DevAuthAutoSignIn';

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <DevAuthAutoSignIn />
      {children}
    </NextAuthSessionProvider>
  );
}

