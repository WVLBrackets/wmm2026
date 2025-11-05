import { Calendar } from 'lucide-react';
import CountdownClock from '@/components/CountdownClock';
import Announcements from '@/components/Announcements';
import { getSiteConfig } from '@/config/site';
import HomePageLogo from '@/components/HomePageLogo';

export default async function Home() {
  const siteConfig = await getSiteConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Top Row: Countdown Clock, Announcements, Logo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Countdown Clock - Narrow */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-3 h-full flex flex-col justify-center">
              <Calendar className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <CountdownClock />
            </div>
          </div>
          
          {/* Announcements - Wider for more space */}
          <div className="lg:col-span-8">
            <div className="h-full">
              <Announcements />
            </div>
          </div>

          {/* Home Page Logo - Narrow */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-2 h-full flex items-center justify-center">
              <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
