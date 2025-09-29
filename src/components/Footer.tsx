'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig } from '@/config/site';

export default function Footer() {
  const [footerText, setFooterText] = useState<string>('© 2001 Warren\'s March Madness | All rights reserved');

  useEffect(() => {
    const loadSiteConfig = async () => {
      try {
        const config = await getSiteConfig();
        setFooterText(config.footerText);
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
          {footerText}
        </p>
      </div>
    </footer>
  );
}
