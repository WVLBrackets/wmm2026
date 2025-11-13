import { Calendar } from 'lucide-react';
import CountdownClock from '@/components/CountdownClock';
import Announcements from '@/components/Announcements';
import { getSiteConfig } from '@/config/site';
import HomePageLogo from '@/components/HomePageLogo';
import { PageLogger } from '@/components/PageLogger';

export default async function Home() {
  const siteConfig = await getSiteConfig();

  return (
    <>
      <PageLogger location="Home" />
    <div 
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(/images/WMM Wood Floor Large.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Optional overlay for better text readability if needed */}
      <div className="absolute inset-0 bg-black/5 pointer-events-none"></div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 relative z-10">
        {/* Row 1: Logo and Countdown Clock */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-8">
          {/* Home Page Logo */}
          <div className="bg-white rounded-lg shadow-lg p-4 h-full">
            <div className="w-full h-full flex items-center justify-center min-h-[200px]">
              <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col justify-center min-h-[200px]">
            <CountdownClock />
          </div>
        </div>

        {/* Mobile: Logo and Countdown Clock stacked */}
        <div className="lg:hidden grid grid-cols-1 gap-6 mb-8">
          {/* Home Page Logo */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="w-full h-full flex items-center justify-center min-h-[150px]">
              <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-center">
            <CountdownClock />
          </div>
        </div>

        {/* Row 2: Announcements - Full Width */}
        <div className="w-full">
          <Announcements />
        </div>
      </main>

    </div>
    </>
  );
}
