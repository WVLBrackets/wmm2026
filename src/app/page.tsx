import { siteConfig } from '@/config/site';
import { Trophy, Calendar, Users, DollarSign } from 'lucide-react';
import CountdownClock from '@/components/CountdownClock';
import Announcements from '@/components/Announcements';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top Row: Countdown Clock, Announcements, Logo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Countdown Clock - Narrow */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col justify-center">
              <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <CountdownClock />
            </div>
          </div>
          
          {/* Announcements - Wider for more space */}
          <div className="lg:col-span-8">
            <div className="h-full">
              <Announcements />
            </div>
          </div>

          {/* Warren's March Madness Logo - Narrow */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-3 h-full flex items-center justify-center">
              <Image 
                src="/images/warrens-march-madness.png" 
                alt="Warren's March Madness" 
                width={150} 
                height={75} 
                className="max-w-full h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </main>

          {/* Footer */}
          <footer className="bg-gray-800 text-white py-8 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <p className="text-gray-300">
                © 2001 {siteConfig.siteName} | All rights reserved
              </p>
            </div>
      </footer>
    </div>
  );
}
