'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { usageLogger } from '@/lib/usageLogger';

interface LoggedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  logLocation: string;
  bracketId?: string | null;
}

/**
 * Button component that automatically logs clicks
 * Usage: <LoggedButton logLocation="Sign In" onClick={handleClick}>Sign In</LoggedButton>
 */
export function LoggedButton({ 
  children, 
  logLocation, 
  bracketId,
  onClick,
  ...props 
}: LoggedButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Don't log or fire onClick if button is disabled
    if (props.disabled) {
      return;
    }
    
    // Log the click
    usageLogger.log('Click', logLocation, bracketId);
    
    // Call the original onClick handler if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button {...props} onClick={handleClick}>
      {children}
    </button>
  );
}

