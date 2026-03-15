import CountdownClock from '@/components/CountdownClock';
import Announcements from '@/components/Announcements';
import HomeCTASection, { CTAItem } from '@/components/HomeCTASection';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import HomePageLogo from '@/components/HomePageLogo';
import { PageLogger } from '@/components/PageLogger';
import { getAnnouncements } from '@/lib/announcements';

// Static generation with on-demand revalidation
// Page is rebuilt only when admin clicks "Rebuild Home" button
// Note: CountdownClock is a client component and updates dynamically
export const revalidate = false;

/**
 * Parse CTA configuration from site config into a typed array.
 * Stops at the first inactive CTA (title is "NO" or empty).
 */
function parseCTAItems(config: SiteConfigData): CTAItem[] {
  const items: CTAItem[] = [];
  const titles = [config.cta1Title, config.cta2Title, config.cta3Title, config.cta4Title];
  const destinations = [config.cta1Destination, config.cta2Destination, config.cta3Destination, config.cta4Destination];
  const images = [config.cta1Image, config.cta2Image, config.cta3Image, config.cta4Image];

  for (let i = 0; i < 4; i++) {
    const title = titles[i];
    if (!title || title.toUpperCase() === 'NO') break;
    items.push({
      title,
      destination: destinations[i] || '/',
      image: images[i] || undefined,
      isImageOnly: title === 'Image Only',
    });
  }
  return items;
}

export default async function Home() {
  // Fetch all data server-side (baked into static HTML)
  const siteConfig = await getSiteConfigFromGoogleSheets() || FALLBACK_CONFIG;
  const announcements = await getAnnouncements();
  const ctaItems = parseCTAItems(siteConfig);

  return (
    <>
      <PageLogger location="Home" />
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Row 1: Logo and Countdown Clock */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-8">
          {/* Home Page Logo */}
          <div className="bg-white rounded-lg shadow-lg p-4 h-full">
            <div className="w-full h-full flex items-center justify-center min-h-[200px]">
              <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col justify-center min-h-[200px]">
            <div className="rounded h-full flex flex-col justify-center p-4" style={{ backgroundColor: '#022749' }}>
              <CountdownClock />
            </div>
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
          <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col justify-center">
            <div className="rounded h-full flex flex-col justify-center p-4" style={{ backgroundColor: '#022749' }}>
              <CountdownClock />
            </div>
          </div>
        </div>

        {/* CTA Section (between banners and announcements) */}
        <HomeCTASection items={ctaItems} />

        {/* Announcements - Full Width */}
        <div className="w-full">
          <Announcements announcements={announcements} />
        </div>
      </main>

    </div>
    </>
  );
}
