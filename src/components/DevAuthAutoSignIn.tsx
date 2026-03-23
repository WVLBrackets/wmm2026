'use client';

import { useEffect, useRef } from 'react';
import { signIn, useSession } from 'next-auth/react';
import {
  DEV_AUTH_BYPASS_PASSWORD,
  getDevAuthBypassEmailClient,
  isDevAuthBypassClientEnabled,
} from '@/lib/devAuth';

/**
 * Automatically signs into a local dev admin session when bypass mode is enabled.
 */
export default function DevAuthAutoSignIn() {
  const { status } = useSession();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!isDevAuthBypassClientEnabled()) {
      return;
    }
    if (status !== 'unauthenticated' || hasAttempted.current) {
      return;
    }

    hasAttempted.current = true;
    void signIn('credentials', {
      redirect: false,
      email: getDevAuthBypassEmailClient(),
      password: DEV_AUTH_BYPASS_PASSWORD,
    });
  }, [status]);

  return null;
}
