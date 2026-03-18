'use client';

import { useEffect, useState } from 'react';
import { getSiteConfig } from '@/config/site';
import { Mail } from 'lucide-react';
import { usageLogger } from '@/lib/usageLogger';

interface FooterProps {
  buildStamp?: string;
}

/**
 * Split footer text on the first "|" for mobile-friendly two-line rendering.
 */
function splitFooterText(footerText: string): { line1: string; line2?: string } {
  const parts = footerText.split('|').map((part) => part.trim());
  if (parts.length < 2) {
    return { line1: footerText };
  }
  return { line1: parts[0], line2: parts.slice(1).join(' | ') };
}

export default function Footer({ buildStamp }: FooterProps) {
  const [footerText, setFooterText] = useState<string>('© 2001 Warren\'s March Madness | All rights reserved');
  const [contactEmail, setContactEmail] = useState<string>('warren@example.com');
  const footerLines = splitFooterText(footerText);

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
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          <div>
            {/* Mobile: replace "|" with a line break and center both lines */}
            <p className="md:hidden text-gray-300 text-center">
              <span className="block">{footerLines.line1}</span>
              {footerLines.line2 && <span className="block">{footerLines.line2}</span>}
            </p>
            {/* Desktop: keep original single-line text on the left */}
            <p className="hidden md:block text-gray-300 text-left">
              {footerText}
            </p>
          </div>

          {buildStamp ? (
            <div className="text-center">
              <span className="text-[11px] text-gray-500 tracking-wide">{buildStamp}</span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center justify-center md:justify-end gap-4">
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
