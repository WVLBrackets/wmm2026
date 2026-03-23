import Announcements from '@/components/Announcements';
import HomeCTASection, { CTAItem, CTACard } from '@/components/HomeCTASection';
import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { PageLogger } from '@/components/PageLogger';
import { getAnnouncements } from '@/lib/announcements';

export const revalidate = false;

/**
 * Parse CTA configuration from site config into a typed array.
 * A CTA is inactive only when its title is "NO" (case-insensitive).
 * Blank title with an image = image-only card.
 * Title "Countdown Clock" (case-insensitive) = renders the CountdownClock component.
 * Blank title with no image = skipped (treated as inactive).
 */
function parseCTAItems(config: SiteConfigData): CTAItem[] {
  const items: CTAItem[] = [];
  const slots = [
    { title: config.cta1Title, dest: config.cta1Destination, img: config.cta1Image },
    { title: config.cta2Title, dest: config.cta2Destination, img: config.cta2Image },
    { title: config.cta3Title, dest: config.cta3Destination, img: config.cta3Image },
    { title: config.cta4Title, dest: config.cta4Destination, img: config.cta4Image },
    { title: config.cta5Title, dest: config.cta5Destination, img: config.cta5Image },
    { title: config.cta6Title, dest: config.cta6Destination, img: config.cta6Image },
  ];

  for (const slot of slots) {
    const title = slot.title?.trim() ?? '';

    if (title.toUpperCase() === 'NO') break;

    const rawImage = slot.img?.trim() ?? '';
    const hasImage = rawImage !== '' && rawImage.toUpperCase() !== 'NO';
    const isCountdown = title.toLowerCase() === 'countdown clock';

    // Skip slots with no title and no image (empty slot)
    if (!title && !hasImage && !isCountdown) continue;

    items.push({
      title,
      destination: slot.dest?.trim() || 'NO',
      image: hasImage ? rawImage : undefined,
      isImageOnly: !title || title === 'Image Only',
      isCountdown,
    });
  }
  return items;
}

export default async function Home() {
  const [siteConfigResult, announcements] = await Promise.all([
    getSiteConfigFromGoogleSheets(),
    getAnnouncements(),
  ]);
  const siteConfig = siteConfigResult || FALLBACK_CONFIG;
  const ctaItems = parseCTAItems(siteConfig);

  return (
    <>
      <PageLogger location="Home" />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">

          {/* Desktop grid — column count driven by number of active CTAs */}
          {ctaItems.length > 0 && (
            <div className="hidden lg:block">
              <HomeCTASection items={ctaItems} />
            </div>
          )}

          {/* Mobile — vertical stack */}
          {ctaItems.length > 0 && (
            <div className="lg:hidden grid grid-cols-1 gap-4 mb-8">
              {ctaItems.map((item, index) => (
                <CTACard key={index} item={item} />
              ))}
            </div>
          )}

          {/* Announcements - Full Width */}
          <div className="w-full">
            <Announcements announcements={announcements} />
          </div>
        </main>
      </div>
    </>
  );
}
