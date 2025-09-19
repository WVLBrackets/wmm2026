import Link from 'next/link';
import { ArrowLeft, Calendar, Trophy } from 'lucide-react';

export default function PreviousYearsPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/standings"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Current Standings
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Previous Years</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              <Calendar className="h-4 w-4" />
              Tournament History
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Previous Years Standings
            </h2>
            <p className="text-gray-600 mb-6">
              Historical tournament standings will be available here soon.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                <strong>Coming Soon:</strong> We're working on adding historical data from previous tournaments. 
                This will include past champions, final standings, and tournament statistics.
              </p>
            </div>
          </div>

          {/* Placeholder for future years */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Years</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
                <div
                  key={year}
                  className="p-4 border border-gray-200 rounded-lg text-center hover:bg-gray-50 transition-colors cursor-not-allowed opacity-50"
                >
                  <div className="text-lg font-semibold text-gray-600">{year}</div>
                  <div className="text-xs text-gray-500">Coming Soon</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
