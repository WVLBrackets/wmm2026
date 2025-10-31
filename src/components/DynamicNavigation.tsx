'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { Home, Trophy, BookOpen, CreditCard, Gift, Star, Menu, X, Target, User, LogOut } from 'lucide-react';
import Image from 'next/image';

const navigationItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Standings', href: '/standings', icon: Trophy },
  { name: 'Rules', href: '/rules', icon: BookOpen },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Prizes', href: '/prizes', icon: Gift },
  { name: 'Hall of Fame', href: '/hall-of-fame', icon: Star },
];

interface DynamicNavigationProps {
  hideInBracketMode?: boolean;
}

export default function DynamicNavigation({ hideInBracketMode = false }: DynamicNavigationProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error('Failed to load site config:', error);
        // Use centralized fallback config
        setSiteConfig(FALLBACK_CONFIG);
      }
    };

    loadConfig();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Determine if My Picks should be shown based on environment and feature flags
  const shouldShowMyPicks = () => {
    if (!siteConfig) return false;
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Detect preview/staging by checking if we're on a Vercel preview URL
    // Vercel preview URLs follow the pattern: project-name-git-branch-owner-projects.vercel.app
    // Production is typically on a custom domain (wmm2026.com) or the main vercel.app domain
    const isPreview = typeof window !== 'undefined' && (
      window.location.hostname.includes('-git-') || 
      (window.location.hostname.includes('vercel.app') && 
       !window.location.hostname.startsWith('wmm2026') &&
       window.location.hostname.includes('.'))
    );
    
    // Use dev flag for both local development and preview/staging deployments
    if (isDevelopment || isPreview) {
      return siteConfig.showPicksDev === 'Yes';
    }
    
    // Use prod flag for production deployments only
    return siteConfig.showPicksProd === 'Yes';
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

  // Hide navigation in bracket mode
  if (hideInBracketMode) {
    return null;
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
                  <span className="hidden md:inline">{siteConfig.siteName}</span>
                  <span className="md:hidden">WMM</span>
                </h1>
                <p className="hidden xl:block text-sm text-gray-600">
                  {siteConfig.lastYearChampionship} Champ - {siteConfig.lastYearWinner}
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
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
            
            {/* My Picks - Far Right (conditional) */}
            {shouldShowMyPicks() && (
              <Link
                href="/bracket"
                className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/bracket'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Target className="h-5 w-5 mr-2" />
                My Picks
              </Link>
            )}
          </div>

          {/* Mobile Navigation Icons */}
          <div className="lg:hidden flex items-center space-x-2">
            {navigationItems.filter(item => item.name !== 'Home').map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`p-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                  title={item.name}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
            
            {/* My Picks for mobile (conditional) */}
            {shouldShowMyPicks() && (
              <Link
                href="/bracket"
                className={`p-2 rounded-md transition-colors ${
                  pathname === '/bracket'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
                title="My Picks"
              >
                <Target className="h-5 w-5" />
              </Link>
            )}
            
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="p-2 text-gray-600 hover:text-blue-600 focus:outline-none focus:text-blue-600"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200">
            <div className="py-4">
              <h3 className="px-3 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Navigation Icons
              </h3>
              <div className="space-y-1">
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
                
                {/* My Picks for mobile menu (conditional) */}
                {shouldShowMyPicks() && (
                  <Link
                    href="/bracket"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      pathname === '/bracket'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Target className="h-5 w-5" />
                    <span>My Picks</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
