'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig } from '@/config/site';

export default function Footer() {
  const [siteName, setSiteName] = useState<string>('Warren\'s March Madness');

  useEffect(() => {
    const loadSiteConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteName(config.siteName);
      } catch (error) {
        console.error('Error loading site config for footer:', error);
        // Keep the default fallback value
      }
    };
    loadSiteConfig();
  }, []);

  return (
    <footer className="bg-gray-800 text-white py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-gray-300">
          © 2001 {siteName} | All rights reserved
        </p>
      </div>
    </footer>
  );
}
