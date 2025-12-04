import Link from 'next/link';
import { DollarSign, Trophy, FileSpreadsheet, AlertTriangle, Dog, Calculator, CreditCard, CheckCircle, Gift, Medal, Crown } from 'lucide-react';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { PageLogger } from '@/components/PageLogger';

// ISR: Revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

/**
 * Helper function to format the tournament deadline date
 */
function formatTournamentDeadline(siteConfig: SiteConfigData | null): string {
  if (!siteConfig) return '9:00 AM Pacific time on Thursday, 3/20/26';
  
  try {
    const date = new Date(siteConfig.tournamentStartDate);
    const timeStr = siteConfig.tournamentStartTime || '9:00 AM Pacific';
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    
    return `${timeStr} on ${dayName}, ${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '9:00 AM Pacific time on Thursday, 3/20/26';
  }
}

/**
 * Helper function to format the tracker date
 */
function formatTrackerDate(siteConfig: SiteConfigData | null): string {
  if (!siteConfig) return 'Thursday night, 3/20/26';
  
  try {
    const date = new Date(siteConfig.tournamentStartDate);
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    
    return `${dayName} night, ${month}/${day}/${year}`;
  } catch (error) {
    console.error('Error formatting tracker date:', error);
    return 'Thursday night, 3/20/26';
  }
}

/**
 * Calculate prize amounts based on player count
 */
function calculatePrizes(siteConfig: SiteConfigData | null): { first: number; second: number; third: number; total: number } {
  if (!siteConfig) return { first: 0, second: 0, third: 0, total: 0 };
  
  const totalPrize = siteConfig.numberOfPlayers * 5;
  return {
    first: Math.round(totalPrize * 0.60),
    second: Math.round(totalPrize * 0.30),
    third: Math.round(totalPrize * 0.10),
    total: totalPrize
  };
}

/**
 * Info Page - Server Component with ISR
 * Displays tournament entry, payment, scoring rules, and prize information
 */
export default async function InfoPage() {
  // Fetch site config server-side (cached with ISR)
  let siteConfig: SiteConfigData | null = null;
  
  try {
    siteConfig = await getSiteConfigFromGoogleSheets();
  } catch (error) {
    console.error('Error loading site config:', error);
    siteConfig = FALLBACK_CONFIG;
  }
  
  // Use fallback if config is null
  if (!siteConfig) {
    siteConfig = FALLBACK_CONFIG;
  }

  const prizes = calculatePrizes(siteConfig);
  const isActive = siteConfig?.prizesActiveForecast === 'Active';
  const tournamentDeadline = formatTournamentDeadline(siteConfig);
  const trackerDate = formatTrackerDate(siteConfig);

  return (
    <>
      {/* Client component for usage logging */}
      <PageLogger location="Info" />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-8">
            
            {/* Quick Navigation Links */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 sticky top-4 z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                <h2 className="text-xl font-bold text-gray-900">Quick Navigation</h2>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  <a 
                    href="#entry-payment" 
                    className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Pay</span>
                  </a>
                  <a 
                    href="#scoring-rules" 
                    className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                  >
                    <Trophy className="h-4 w-4" />
                    <span className="font-medium">Scoring</span>
                  </a>
                  <a 
                    href="#prizes" 
                    className="flex items-center space-x-2 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                  >
                    <Gift className="h-4 w-4" />
                    <span className="font-medium">Prizes</span>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Section 1: Entry & Payment */}
            <div id="entry-payment" className="bg-white rounded-lg shadow-lg p-8 scroll-mt-4">
              <div className="flex items-center mb-4">
                <DollarSign className="h-8 w-8 text-green-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Entry & Payment</h2>
              </div>
              
              {/* Entry Fee Highlight */}
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600 mb-2">$5 per entry</p>
                  <p className="text-gray-700">Enter as many times as you like!</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                  <div className="text-gray-700">
                    <p>
                      To Enter, email your picks sheet to <strong>NCAATourney@gmail.com</strong> or fill out a bracket on the{' '}
                      <Link href="/bracket" className="text-blue-600 hover:text-blue-800 underline font-medium">
                        My Picks
                      </Link>
                      {' '}section of this site.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                  <p className="text-gray-700">
                    Entries must be received by <strong>{tournamentDeadline}</strong>, 
                    the first day of the First Round.
                  </p>
                </div>

                <div className="flex items-start mt-6">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-1" />
                  <p className="text-gray-700">
                    If you are paying for multiple entries, please include the list of entries covered with your payment.
                  </p>
                </div>
                
                {/* Payment Methods */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Electronic Payments</h3>
                    </div>
                    <p className="text-gray-700 text-sm">
                      Electronic payments are preferred. Just be sure you are following the Terms & Conditions of the platform you are using.
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Cash</h3>
                    </div>
                    <p className="text-gray-700 text-sm">
                      Cash is welcome if you plan to see me or if you live nearby.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Scoring */}
            <div id="scoring-rules" className="bg-white rounded-lg shadow-lg p-8 scroll-mt-4">
              <div className="flex items-center mb-6">
                <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Scoring</h2>
              </div>
              
              {/* Scoring Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-900">First Round</span>
                  <span className="font-bold text-blue-600">1 point</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-900">Second Round</span>
                  <span className="font-bold text-blue-600">2 points</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-900">Sweet Sixteen</span>
                  <span className="font-bold text-blue-600">4 points</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-900">Elite Eight</span>
                  <span className="font-bold text-blue-600">8 points</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-900">Final Four</span>
                  <span className="font-bold text-blue-600">12 points</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-yellow-50 rounded-lg">
                  <span className="font-medium text-gray-900">Championship Game</span>
                  <span className="font-bold text-yellow-600">16 points</span>
                </div>
              </div>
              
              {/* Alert Section - First Four Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0" />
                  <p className="text-yellow-800 font-medium">
                    The &quot;First Four&quot; play-in games are ignored in our scoring.
                  </p>
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
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
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

              {/* The Tracker Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800">The Tracker</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                    <p className="text-gray-700 text-sm">
                      The Tracker spreadsheet will be available on <strong>{trackerDate}</strong>.
                    </p>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                    <p className="text-gray-700 text-sm">
                      The Tracker provides <strong>detailed visibility</strong> to everyone&apos;s picks.
                    </p>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
                    <p className="text-gray-700 text-sm">
                      You don&apos;t have to use The Tracker - the <strong>website standings will be updated nightly</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Prizes */}
            <div id="prizes" className="bg-white rounded-lg shadow-lg p-8 scroll-mt-4">
              <div className="flex items-center mb-6">
                <Gift className="h-8 w-8 text-orange-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Prizes</h2>
              </div>

              {/* Prize Pool Summary */}
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-8 mb-8">
                <div className="text-center text-white">
                  <Gift className="h-16 w-16 mx-auto mb-4" />
                  <h3 className="text-3xl font-bold mb-2">
                    {isActive ? 'Prize Pool' : `Estimated Prize Pool - ${siteConfig?.tournamentYear || '2026'}`}
                  </h3>
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
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <span className="text-sm">Prize amounts will be finalized based on the actual number of entries</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Prize Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* 1st Place */}
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

                {/* 2nd Place */}
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
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
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
        </div>
      </div>
    </>
  );
}
