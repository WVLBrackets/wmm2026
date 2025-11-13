'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function CountdownClock() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isClient, setIsClient] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);

  useEffect(() => {
    setIsClient(true);
    
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

  useEffect(() => {
    if (!siteConfig) return;
    
    const calculateTimeLeft = (): TimeLeft => {
      const tournamentDate = new Date(siteConfig.tournamentStartDate);
      const now = new Date();
      const difference = tournamentDate.getTime() - now.getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }

      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    // Set initial time
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [siteConfig]);

  // Don't render on server to avoid hydration mismatch
  if (!isClient || !siteConfig) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Countdown to 2026</h3>
        <p className="text-2xl font-bold text-blue-600">Loading...</p>
      </div>
    );
  }

  const tournamentDate = new Date(siteConfig.tournamentStartDate);
  const isTournamentStarted = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className="text-center w-full">
      <div className="flex items-center justify-center mb-4">
        <Calendar className="h-5 w-5 text-white mr-2 drop-shadow-sm" />
        <h3 className="text-xl font-bold text-white drop-shadow-sm">
          Countdown to {siteConfig.tournamentYear} Tipoff
        </h3>
      </div>
      
      {isTournamentStarted ? (
        <div className="py-4">
          <p className="text-3xl font-bold text-green-400 mb-3 drop-shadow-md">Tournament Started!</p>
          <p className="text-base text-white">
            {tournamentDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })} at {siteConfig.tournamentStartTime}
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-2 gap-3 mb-4 max-w-xs mx-auto">
            <div className="bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-lg p-4 shadow-lg border-2 border-orange-300/60 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-4xl font-bold text-orange-600 mb-1 tabular-nums drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>{timeLeft.days}</div>
                <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Days</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-lg p-4 shadow-lg border-2 border-orange-300/60 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-4xl font-bold text-orange-600 mb-1 tabular-nums drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Hours</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-lg p-4 shadow-lg border-2 border-orange-300/60 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-4xl font-bold text-orange-600 mb-1 tabular-nums drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Minutes</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-lg p-4 shadow-lg border-2 border-orange-300/60 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-4xl font-bold text-orange-600 mb-1 tabular-nums drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Seconds</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-white font-medium">
            {tournamentDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })} at {siteConfig.tournamentStartTime}
          </p>
        </div>
      )}
    </div>
  );
}
