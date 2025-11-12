'use client';

import { AnchorHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { usageLogger } from '@/lib/usageLogger';

interface LoggedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  href: string;
  logLocation: string;
  bracketId?: string | null;
}

/**
 * Link component that automatically logs clicks
 * Usage: <LoggedLink href="/info" logLocation="Contact Us">Contact Us</LoggedLink>
 */
export function LoggedLink({ 
  children, 
  href,
  logLocation, 
  bracketId,
  onClick,
  ...props 
}: LoggedLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Log the click
    usageLogger.log('Click', logLocation, bracketId);
    
    // Call the original onClick handler if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Link href={href} {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}

