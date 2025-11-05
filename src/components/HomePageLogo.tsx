'use client';

import { useState } from 'react';
import Image from 'next/image';

interface HomePageLogoProps {
  logoFileName?: string;
}

/**
 * HomePageLogo component that displays a logo from the public/images directory
 * Falls back to default logo if no filename is provided, or shows error if image not found
 */
export default function HomePageLogo({ logoFileName }: HomePageLogoProps) {
  const [imageError, setImageError] = useState(false);

  // Default logo if no filename is provided
  const defaultLogo = '/images/warrens-march-madness.png';
  
  // Use provided logo filename or default
  const logoPath = logoFileName 
    ? `/images/${logoFileName}` 
    : defaultLogo;

  // If image failed to load and we're using a custom logo, show error
  if (imageError && logoFileName) {
    return (
      <div className="flex items-center justify-center h-full text-red-600 text-sm font-medium px-2 text-center">
        Image not Found
      </div>
    );
  }

  // If no custom logo specified, use Next.js Image with default
  if (!logoFileName) {
    return (
      <Image 
        src={defaultLogo}
        alt="Site Logo" 
        width={120} 
        height={60} 
        className="max-w-full h-auto object-contain"
        priority
      />
    );
  }

  // For custom logos, use regular img tag for better error handling
  return (
    <img
      src={logoPath}
      alt="Site Logo"
      className="max-w-full h-auto object-contain"
      style={{ maxWidth: '120px', maxHeight: '60px' }}
      onError={() => setImageError(true)}
    />
  );
}

