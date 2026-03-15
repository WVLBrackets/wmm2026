import Link from 'next/link';
import Image from 'next/image';

export interface CTAItem {
  title: string;
  destination: string;
  image?: string;
  isImageOnly: boolean;
}

interface HomeCTASectionProps {
  items: CTAItem[];
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
 * Wraps content in the appropriate link element based on destination type.
 */
function CTALinkWrapper({ destination, children }: { destination: string; children: React.ReactNode }) {
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
 * Single CTA card — renders as text-only button, image+caption, or image-only.
 * Uses the site's blue (#022749) and orange color palette.
 */
export function CTACard({ item }: { item: CTAItem }) {
  const hasImage = !!item.image;

  if (hasImage) {
    return (
      <CTALinkWrapper destination={item.destination}>
        <div className="h-full flex flex-col overflow-hidden rounded-lg bg-white shadow-lg border-b-4 border-orange-400 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex-1 flex items-center justify-center p-2">
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
            <p className="text-center text-sm font-semibold text-gray-800 py-2 px-3 bg-gray-50">
              {item.title}
            </p>
          )}
        </div>
      </CTALinkWrapper>
    );
  }

  return (
    <CTALinkWrapper destination={item.destination}>
      <div
        className="h-full flex items-center justify-center rounded-lg shadow-lg text-white font-bold text-lg px-6 py-5 border-b-4 border-orange-400 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 text-center"
        style={{ backgroundColor: '#022749' }}
      >
        {item.title}
      </div>
    </CTALinkWrapper>
  );
}

/**
 * Dynamic CTA section for rows of CTAs below the top banner row.
 * Renders in a responsive 3-column desktop grid / 1-column mobile stack.
 * Returns null when no items are provided.
 */
export default function HomeCTASection({ items }: HomeCTASectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {items.map((item, index) => (
        <CTACard key={index} item={item} />
      ))}
    </div>
  );
}
