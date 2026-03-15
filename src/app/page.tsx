import CountdownClock from '@/components/CountdownClock';
import Announcements from '@/components/Announcements';
import HomeCTASection, { CTAItem, CTACard } from '@/components/HomeCTASection';
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
 * Image values of "NO" are treated as no image.
 */
function parseCTAItems(config: SiteConfigData): CTAItem[] {
  const items: CTAItem[] = [];
  const titles = [config.cta1Title, config.cta2Title, config.cta3Title, config.cta4Title];
  const destinations = [config.cta1Destination, config.cta2Destination, config.cta3Destination, config.cta4Destination];
  const images = [config.cta1Image, config.cta2Image, config.cta3Image, config.cta4Image];

  for (let i = 0; i < 4; i++) {
    const title = titles[i];
    if (!title || title.toUpperCase() === 'NO') break;

    const rawImage = images[i];
    const hasImage = rawImage && rawImage.toUpperCase() !== 'NO';

    items.push({
      title,
      destination: destinations[i] || '/',
      image: hasImage ? rawImage : undefined,
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

  const hasCTAs = ctaItems.length > 0;
  const firstCTA = hasCTAs ? ctaItems[0] : null;
  const remainingCTAs = ctaItems.slice(1);

  return (
    <>
      <PageLogger location="Home" />
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">

        {/* Desktop: 3-column row when CTAs exist, 2-column otherwise */}
        {hasCTAs ? (
          <div className="hidden lg:grid lg:grid-cols-3 gap-6 mb-8">
            {/* Home Page Logo */}
            <div className="bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 h-full">
              <div className="w-full h-full flex items-center justify-center">
                <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 h-full flex flex-col justify-center">
              <div className="rounded h-full flex flex-col justify-center p-3" style={{ backgroundColor: '#022749' }}>
                <CountdownClock />
              </div>
            </div>

            {/* CTA 1 */}
            <CTACard item={firstCTA!} />
          </div>
        ) : (
          <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-8">
            {/* Home Page Logo */}
            <div className="bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 h-full">
              <div className="w-full h-full flex items-center justify-center min-h-[200px]">
                <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
              </div>
            </div>

            {/* Countdown Clock */}
            <div className="bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 h-full flex flex-col justify-center min-h-[200px]">
              <div className="rounded h-full flex flex-col justify-center p-3" style={{ backgroundColor: '#022749' }}>
                <CountdownClock />
              </div>
            </div>
          </div>
        )}

        {/* Desktop: Remaining CTAs (2-4) on second row */}
        <div className="hidden lg:block">
          <HomeCTASection items={remainingCTAs} />
        </div>

        {/* Mobile: Everything stacked vertically */}
        <div className="lg:hidden grid grid-cols-1 gap-4 mb-8">
          {/* Home Page Logo */}
          <div className="bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400">
            <div className="w-full h-full flex items-center justify-center min-h-[150px]">
              <HomePageLogo logoFileName={siteConfig?.homePageLogo} />
            </div>
          </div>

          {/* Countdown Clock — compact padding to match logo height */}
          <div className="bg-white rounded-lg shadow-lg p-2 border-b-4 border-orange-400 flex flex-col justify-center">
            <div className="rounded flex flex-col justify-center p-2" style={{ backgroundColor: '#022749' }}>
              <CountdownClock />
            </div>
          </div>

          {/* Mobile CTAs — equal height cards */}
          {ctaItems.map((item, index) => (
            <CTACard key={index} item={item} />
          ))}
        </div>

        {/* Announcements - Full Width */}
        <div className="w-full">
          <Announcements announcements={announcements} />
        </div>
      </main>

    </div>
    </>
  );
}
