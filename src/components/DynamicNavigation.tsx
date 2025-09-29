'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { Home, Trophy, BookOpen, CreditCard, Gift, Star, Menu, X } from 'lucide-react';
import Image from 'next/image';

const navigationItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Standings', href: '/standings', icon: Trophy },
  { name: 'Rules', href: '/rules', icon: BookOpen },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Prizes', href: '/prizes', icon: Gift },
  { name: 'Hall of Fame', href: '/hall-of-fame', icon: Star },
];

export default function DynamicNavigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error('Failed to load site config:', error);
        // Fallback to static config
        setSiteConfig({
          tournamentYear: '2026',
          lastYearWinner: 'Randy Phillips (Randy Line Sports)',
          lastYearChampionship: 2025,
          tournamentStartDate: '2026-03-18T12:00:00-05:00',
          tournamentStartTime: '12:00 PM EST',
          numberOfPlayers: 0,
          totalPrizeAmount: 0,
          siteName: "Warren&apos;s March Madness",
          siteDescription: 'Annual March Madness Bracket Challenge',
          oldSiteUrl: 'https://warrensmadness.webnode.page/',
          standingsTabs: 2,
          footerText: '© 2001 Warren\'s March Madness | All rights reserved',
        });
      }
    };

    loadConfig();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  if (!siteConfig) {
    // Show loading state or fallback
    return (
      <nav className="sticky top-0 z-50 bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <Image 
                  src="/images/bracket-icon.png" 
                  alt="Tournament Bracket" 
                  width={32} 
                  height={32} 
                  className="h-8 w-8"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Warren&apos;s March Madness
                  </h1>
                  <p className="hidden xl:block text-sm text-gray-600">
                    Loading...
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image 
                src="/images/bracket-icon.png" 
                alt="Tournament Bracket" 
                width={32} 
                height={32} 
                className="h-8 w-8"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {siteConfig.siteName}
                </h1>
                <p className="hidden xl:block text-sm text-gray-600">
                  {siteConfig.lastYearChampionship} Champ - {siteConfig.lastYearWinner}
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="text-gray-600 hover:text-blue-600 focus:outline-none focus:text-blue-600"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200">
            <div className="py-2 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
