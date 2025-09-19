import { siteConfig } from '@/config/site';
import { Gift, Trophy, Medal, Star, Crown, Target, Zap } from 'lucide-react';

export default function PrizesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Prize Pool Summary */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center text-white">
            <Gift className="h-16 w-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Total Prize Pool</h2>
            <p className="text-5xl font-bold mb-4">
              ${siteConfig.totalPrizeAmount.toLocaleString()}
            </p>
            <p className="text-lg opacity-90">
              Compete for your share of the prize pool!
            </p>
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
                <p className="text-2xl font-bold text-yellow-700">60% of Prize Pool</p>
                <p className="text-sm text-gray-600">Based on ${siteConfig.totalPrizeAmount.toLocaleString()} total</p>
              </div>
              <p className="text-gray-600 text-sm">
                The ultimate March Madness champion!
              </p>
            </div>
          </div>

          {/* 2nd Place - Runner-Up */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-gray-400 transform hover:scale-105 transition-transform">
            <div className="text-center">
              <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">2nd Place</h3>
              <p className="text-3xl font-bold text-gray-600 mb-2">Runner-Up</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-gray-700">25% of Prize Pool</p>
                <p className="text-sm text-gray-600">Based on ${siteConfig.totalPrizeAmount.toLocaleString()} total</p>
              </div>
              <p className="text-gray-600 text-sm">
                So close to the championship!
              </p>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-orange-500 transform hover:scale-105 transition-transform">
            <div className="text-center">
              <Medal className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">3rd Place</h3>
              <p className="text-3xl font-bold text-orange-600 mb-2">Third Place</p>
              <div className="bg-orange-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-orange-700">10% of Prize Pool</p>
                <p className="text-sm text-gray-600">Based on ${siteConfig.totalPrizeAmount.toLocaleString()} total</p>
              </div>
              <p className="text-gray-600 text-sm">
                Still a podium finish!
              </p>
            </div>
          </div>
        </div>

        {/* Special Prizes */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Special Prizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Perfect Bracket */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-purple-500">
              <div className="text-center">
                <Star className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Perfect Bracket</h3>
                <p className="text-2xl font-bold text-purple-600 mb-2">$500 Bonus</p>
                <p className="text-gray-600 text-sm">
                  Predict every game correctly and win an extra $500!
                </p>
              </div>
            </div>

            {/* Last Place */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-red-500">
              <div className="text-center">
                <Target className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Last Place</h3>
                <p className="text-2xl font-bold text-red-600 mb-2">$50 Consolation</p>
                <p className="text-gray-600 text-sm">
                  Even the worst bracket gets a consolation prize!
                </p>
              </div>
            </div>

            {/* Most Upsets */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-green-500">
              <div className="text-center">
                <Zap className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Most Upsets</h3>
                <p className="text-2xl font-bold text-green-600 mb-2">$100 Bonus</p>
                <p className="text-gray-600 text-sm">
                  Correctly predict the most underdog victories!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Prize Distribution Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Prize Distribution</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Prizes</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-4 bg-yellow-50 rounded">
                  <span className="font-medium">1st Place (Champion)</span>
                  <span className="font-bold text-yellow-600">60%</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded">
                  <span className="font-medium">2nd Place (Runner-Up)</span>
                  <span className="font-bold text-gray-600">25%</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-orange-50 rounded">
                  <span className="font-medium">3rd Place</span>
                  <span className="font-bold text-orange-600">10%</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">Tournament Operations</span>
                  <span className="font-bold text-blue-600">5%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bonus Prizes</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-4 bg-purple-50 rounded">
                  <span className="font-medium">Perfect Bracket</span>
                  <span className="font-bold text-purple-600">$500</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-green-50 rounded">
                  <span className="font-medium">Most Upsets</span>
                  <span className="font-bold text-green-600">$100</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-red-50 rounded">
                  <span className="font-medium">Last Place</span>
                  <span className="font-bold text-red-600">$50</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Important Notes</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              Prize amounts are based on the total prize pool of ${siteConfig.totalPrizeAmount.toLocaleString()}
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              All prizes will be distributed within 30 days of tournament completion
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              In case of ties, prizes will be split equally among tied participants
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              Perfect bracket bonus is in addition to regular prize winnings
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
