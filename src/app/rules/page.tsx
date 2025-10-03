'use client';

import { DollarSign, Trophy, FileSpreadsheet, AlertTriangle, Dog, Calculator } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSiteConfig } from '@/config/site';
import { SiteConfigData } from '@/lib/siteConfig';

export default function RulesPage() {
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSiteConfig = async () => {
      try {
        const config = await getSiteConfig();
        setSiteConfig(config);
      } catch (error) {
        console.error('Error loading site config:', error);
        // Use fallback values
        setSiteConfig({
          tournamentStartDate: '2026-03-20',
          tournamentStartTime: '9:00 AM Pacific',
          siteName: 'Warren\'s March Madness',
          siteDescription: 'Annual NCAA Tournament Bracket Challenge'
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadSiteConfig();
  }, []);

  // Helper function to format the date and time for display
  const formatTournamentDeadline = () => {
    if (!siteConfig) return '9:00 AM Pacific time on Thursday, 3/20/26';
    
    try {
      const date = new Date(siteConfig.tournamentStartDate);
      const timeStr = siteConfig.tournamentStartTime || '9:00 AM Pacific';
      
      // Format the date as "Thursday, 3/20/26"
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      
      return `${timeStr} on ${dayName}, ${month}/${day}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '9:00 AM Pacific time on Thursday, 3/20/26';
    }
  };

  // Helper function to format the tracker date
  const formatTrackerDate = () => {
    if (!siteConfig) return 'Thursday night, 3/20/26';
    
    try {
      const date = new Date(siteConfig.tournamentStartDate);
      
      // Format the date as "Thursday night, 3/20/26"
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      
      return `${dayName} night, ${month}/${day}/${year}`;
    } catch (error) {
      console.error('Error formatting tracker date:', error);
      return 'Thursday night, 3/20/26';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading rules...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Rules Content */}
        <div className="space-y-8">
          {/* Entry Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Entry</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                <p className="text-gray-700">
                  Each entry is <strong>$5</strong>. Enter as many times as you like.
                </p>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                <div className="text-gray-700">
                  <p>Email all entries back to: <strong>NCAATourney@gmail.com</strong></p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                <p className="text-gray-700">
                  Entries must be received by <strong>{formatTournamentDeadline()}</strong>, 
                  the first day of the First Round.
                </p>
              </div>
            </div>
          </div>

          {/* Scoring Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Scoring</h2>
            </div>
            
            {/* Alert Section - First Four Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 col-span-2">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0" />
                <p className="text-yellow-800 font-medium">
                  The &quot;First Four&quot; play-in games are ignored in our scoring.
                </p>
              </div>
            </div>
            
            {/* Scoring Grid - 2x3 layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                <span className="font-medium">First Round</span>
                <span className="font-bold text-blue-600">1 point</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                <span className="font-medium">Second Round</span>
                <span className="font-bold text-blue-600">2 points</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                <span className="font-medium">Sweet Sixteen</span>
                <span className="font-bold text-blue-600">4 points</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                <span className="font-medium">Elite Eight</span>
                <span className="font-bold text-blue-600">8 points</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                <span className="font-medium">Final Four</span>
                <span className="font-bold text-blue-600">12 points</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-yellow-50 rounded-lg">
                <span className="font-medium">Championship Game</span>
                <span className="font-bold text-yellow-600">16 points</span>
              </div>
            </div>
            
            {/* Underdog Bonus Note */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Dog className="h-5 w-5 text-purple-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-800 font-medium mb-2">Underdog Bonus</p>
                  <p className="text-purple-700 text-sm">
                    You will receive a <strong>2 point bonus</strong> each time the team you select defeats a higher seeded team. 
                    This bonus is active every round.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Examples Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <Calculator className="h-5 w-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Scoring Examples</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-gray-700 text-sm">
                    <strong>Example 1:</strong> If you correctly select a 9 seed to beat an 8 seed in the first round, you get <strong>3 points</strong> (1 point for the win + 2 point underdog bonus).
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="text-gray-700 text-sm">
                    <strong>Example 2:</strong> If you pick a 2 seed to win the finals and they beat a 1 seed, you get <strong>18 points</strong> (16 points for the championship + 2 point underdog bonus). If they beat a 3 seed, you get <strong>16 points</strong> (no underdog bonus).
                  </p>
                </div>
              </div>
            </div>
          </div>



          {/* The Tracker Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <FileSpreadsheet className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">The Tracker</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                <p className="text-gray-700">
                  The Tracker spreadsheet will be available on <strong>{formatTrackerDate()}</strong>.
                </p>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                <p className="text-gray-700">
                  The Tracker provides <strong>detailed visibility</strong> to everyone&apos;s picks.
                </p>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                <p className="text-gray-700">
                  You don&apos;t have to use The Tracker - the <strong>website standings will be updated nightly</strong>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
