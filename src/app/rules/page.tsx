import { DollarSign, Clock, Trophy, FileSpreadsheet } from 'lucide-react';

export default function RulesPage() {
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
                  Entries must be received by <strong>9:00 AM Pacific time</strong> on Thursday, 3/20/26, 
                  the first day of the First Round. (We ignore the &apos;First Four&apos; games)
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded">
                  <span className="font-medium">First Four/Play In Games</span>
                  <span className="text-gray-500">ignored</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">First Round</span>
                  <span className="font-bold text-blue-600">1 point</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">Second Round</span>
                  <span className="font-bold text-blue-600">2 points</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">Sweet Sixteen</span>
                  <span className="font-bold text-blue-600">4 points</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">Elite Eight</span>
                  <span className="font-bold text-blue-600">8 points</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-blue-50 rounded">
                  <span className="font-medium">Final Four</span>
                  <span className="font-bold text-blue-600">12 points</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-yellow-50 rounded">
                  <span className="font-medium">Championship Game</span>
                  <span className="font-bold text-yellow-600">16 points</span>
                </div>
              </div>
            </div>
          </div>

          {/* Underdog Bonus Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <Trophy className="h-8 w-8 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Underdog Bonus</h2>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-6">
              <p className="text-gray-700 mb-4">
                You will receive a <strong>2 point bonus</strong> each time the team you select defeats a higher seeded team. 
                This bonus is active every round.
              </p>
              
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Example:</strong> If you correctly select a 9 seed to beat an 8 seed in the first round, you get 3 pts.</p>
                <p><strong>Example:</strong> If you pick a 2 to win the finals and they beat a 1, you get 18. If they beat a 3, you get 16.</p>
                <p className="font-medium text-purple-700">Get it?</p>
              </div>
            </div>
          </div>

          {/* First Four Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <Clock className="h-8 w-8 text-orange-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">First Four / Play-In Games</h2>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-6">
              <p className="text-gray-700">
                The &quot;First Four&quot; play-in games are <strong>ignored</strong> in our scoring.
              </p>
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
                  The Tracker spreadsheet will be available on <strong>Thursday night, 3/20/26</strong>.
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

          {/* Enjoy Section */}
          <div className="text-center bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Enjoy!</h2>
            <p className="text-lg text-gray-600">
              Good luck with your picks and may the best bracket win!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
