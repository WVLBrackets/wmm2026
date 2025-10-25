'use client';

import { useState, useEffect } from 'react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { Gift, Trophy, Medal, Crown, AlertCircle } from 'lucide-react';

export default function PrizesPage() {
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSiteConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error('Error loading site config:', error);
        // Use centralized fallback config
        setSiteConfig(FALLBACK_CONFIG);
      } finally {
        setIsLoading(false);
      }
    };
    loadSiteConfig();
  }, []);

  // Calculate prize amounts based on player count
  const calculatePrizes = () => {
    if (!siteConfig) return { first: 0, second: 0, third: 0, total: 0 };
    
    // Calculate total prize pool: $5 per entry
    const totalPrize = siteConfig.numberOfPlayers * 5;
    return {
      first: Math.round(totalPrize * 0.60),
      second: Math.round(totalPrize * 0.30),
      third: Math.round(totalPrize * 0.10),
      total: totalPrize
    };
  };

  const prizes = calculatePrizes();
  const isActive = siteConfig?.prizesActiveForecast === 'Active';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading prize information...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Prize Pool Summary */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center text-white">
            <Gift className="h-16 w-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">
              {isActive ? 'Prize Pool' : `Estimated Prize Pool - ${siteConfig?.tournamentYear || '2026'}`}
            </h2>
            <p className="text-5xl font-bold mb-4">
              ${prizes.total.toLocaleString()}{!isActive && '*'}
            </p>
            <p className="text-lg opacity-90">
              {isActive 
                ? `Based on ${siteConfig?.numberOfPlayers || 0} confirmed entries`
                : `Projected based on last year's number of entries (${siteConfig?.numberOfPlayers || 0})`
              }
            </p>
            {!isActive && (
              <div className="mt-4 bg-yellow-600 bg-opacity-30 rounded-lg p-3">
                <div className="flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm">Prize amounts will be finalized based on the actual number of entries</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Prize Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 1st Place - Champion */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-yellow-500 transform hover:scale-105 transition-transform">
            <div className="text-center">
              <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">1st Place</h3>
              <p className="text-3xl font-bold text-yellow-600 mb-2">Champion</p>
              <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-yellow-700">${prizes.first.toLocaleString()}{!isActive && '*'}</p>
                <p className="text-sm text-gray-600">
                  {isActive ? '60% of confirmed prize pool' : '60% of projected prize pool'}
                </p>
              </div>
            </div>
          </div>

          {/* 2nd Place - Runner-Up */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-gray-400 transform hover:scale-105 transition-transform">
            <div className="text-center">
              <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">2nd Place</h3>
              <p className="text-3xl font-bold text-gray-600 mb-2">Runner-Up</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-gray-700">${prizes.second.toLocaleString()}{!isActive && '*'}</p>
                <p className="text-sm text-gray-600">
                  {isActive ? '30% of confirmed prize pool' : '30% of projected prize pool'}
                </p>
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-orange-500 transform hover:scale-105 transition-transform">
            <div className="text-center">
              <Medal className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">3rd Place</h3>
              <p className="text-3xl font-bold text-orange-600 mb-2">Third Place</p>
              <div className="bg-orange-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-orange-700">${prizes.third.toLocaleString()}{!isActive && '*'}</p>
                <p className="text-sm text-gray-600">
                  {isActive ? '10% of confirmed prize pool' : '10% of projected prize pool'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast Note */}
        {!isActive && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg mt-8">
            <div className="flex items-center">
              <span className="text-red-600 text-2xl font-bold mr-3">*</span>
              <p className="text-red-800 font-medium">
                Prizes estimated based on {siteConfig?.numberOfPlayers || 0} entries
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}








