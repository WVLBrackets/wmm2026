'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig } from '@/config/site';
import { Mail } from 'lucide-react';
import { usageLogger } from '@/lib/usageLogger';

export default function Footer() {
  const [footerText, setFooterText] = useState<string>('© 2001 Warren\'s March Madness | All rights reserved');
  const [contactEmail, setContactEmail] = useState<string>('warren@example.com');

  useEffect(() => {
    const loadSiteConfig = async () => {
      try {
        const config = await getSiteConfig();
        setFooterText(config.footerText);
        setContactEmail(config.contactMe);
      } catch (error) {
        console.error('Error loading site config for footer:', error);
        // Keep the default fallback values
      }
    };
    loadSiteConfig();
  }, []);

  return (
    <footer className="bg-gray-800 text-white py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-300">
            {footerText}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Questions?</span>
            <a 
              href={`mailto:${contactEmail}`} 
              onClick={() => usageLogger.log('Click', 'Contact Us')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
