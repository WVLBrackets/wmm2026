'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects to the unified auth page with the Create Account tab active.
 * Keeps /auth/signup URLs working for existing bookmarks and links.
 */
export default function SignUpRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/signin?mode=signup');
  }, [router]);

  return null;
}
