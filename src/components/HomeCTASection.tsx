import Link from 'next/link';
import Image from 'next/image';
import CountdownClock from '@/components/CountdownClock';

export interface CTAItem {
  title: string;
  destination: string;
  image?: string;
  isImageOnly: boolean;
  isCountdown?: boolean;
}

/**
 * Determine whether a destination URL is external (opens in new tab)
 * or internal (navigates within the app in the same tab).
 */
function isExternalLink(destination: string): boolean {
  return destination.startsWith('http://') || destination.startsWith('https://');
}

/**
 * Resolve an image filename to a path under /images/.
 */
function resolveImageSrc(filename: string): string {
  if (filename.startsWith('/') || filename.startsWith('http')) {
    return filename;
  }
  return `/images/${filename}`;
}

/**
 * Wraps content in a link or plain div depending on destination.
 * Destination "NO" (case-insensitive) renders a non-clickable container.
 */
function CTALinkWrapper({ destination, children }: { destination: string; children: React.ReactNode }) {
  const isNoLink = !destination || destination.toUpperCase() === 'NO';

  if (isNoLink) {
    return (
      <div className="block h-full" data-testid="cta-card">
        {children}
      </div>
    );
  }

  if (isExternalLink(destination)) {
    return (
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer h-full"
        data-testid="cta-card"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={destination}
      className="block cursor-pointer h-full"
      data-testid="cta-card"
    >
      {children}
    </Link>
  );
}

/**
 * Countdown Clock rendered inside the standard CTA card chrome.
 */
export function CountdownCTACard() {
  return (
    <div
      className="h-full bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400"
      data-testid="cta-countdown"
    >
      <div className="rounded h-full flex flex-col justify-center p-3" style={{ backgroundColor: '#022749' }}>
        <CountdownClock />
      </div>
    </div>
  );
}

/**
 * Single CTA card — renders as text-only button, image+caption, or image-only.
 * Uses the site's blue (#022749) and orange color palette.
 */
export function CTACard({ item }: { item: CTAItem }) {
  if (item.isCountdown) {
    return <CountdownCTACard />;
  }

  const hasImage = !!item.image;
  const hoverClasses = (!item.destination || item.destination.toUpperCase() === 'NO')
    ? ''
    : 'hover:shadow-xl hover:-translate-y-0.5';

  if (hasImage) {
    return (
      <CTALinkWrapper destination={item.destination}>
        <div className={`h-full bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 transition-all duration-200 ${hoverClasses}`}>
          <div className="flex flex-col h-full overflow-hidden rounded">
            <div className="flex-1 flex items-center justify-center">
              <Image
                src={resolveImageSrc(item.image!)}
                alt={item.isImageOnly ? 'Call to action' : item.title}
                width={600}
                height={300}
                className="w-full h-auto object-cover rounded"
                unoptimized
              />
            </div>
            {!item.isImageOnly && (
              <p className="text-center text-sm font-semibold text-gray-800 pt-2">
                {item.title}
              </p>
            )}
          </div>
        </div>
      </CTALinkWrapper>
    );
  }

  return (
    <CTALinkWrapper destination={item.destination}>
      <div className={`h-full bg-white rounded-lg shadow-lg p-3 border-b-4 border-orange-400 transition-all duration-200 ${hoverClasses}`}>
        <div
          className="h-full flex items-center justify-center rounded text-white font-bold text-lg px-6 py-4 text-center"
          style={{ backgroundColor: '#022749' }}
        >
          {item.title}
        </div>
      </div>
    </CTALinkWrapper>
  );
}

/**
 * Dynamic CTA grid section. Determines column count from item count:
 * - 1-2 items: 2-column grid
 * - 3-4 items: 2-column grid (2 rows)
 * - 5-6 items: 3-column grid (2 rows)
 * Returns null when no items are provided.
 */
export default function HomeCTASection({ items }: { items: CTAItem[] }) {
  if (!items || items.length === 0) {
    return null;
  }

  const colClass = items.length >= 5 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <div className={`grid grid-cols-1 ${colClass} gap-6 mb-8`}>
      {items.map((item, index) => (
        <CTACard key={index} item={item} />
      ))}
    </div>
  );
}
