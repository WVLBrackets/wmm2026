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
 * Map the number of active CTAs to the appropriate Tailwind grid class on desktop.
 */
function getGridClass(count: number): string {
  switch (count) {
    case 1:
      return 'grid-cols-1 max-w-lg mx-auto';
    case 2:
      return 'md:grid-cols-2';
    case 3:
      return 'md:grid-cols-3';
    case 4:
      return 'md:grid-cols-4';
    default:
      return '';
  }
}

/**
 * Single CTA card — renders as text-only button, image+caption, or image-only
 * depending on the CTAItem configuration.
 */
function CTACard({ item }: { item: CTAItem }) {
  const hasImage = !!item.image;

  const content = hasImage ? (
    <div className="flex flex-col items-center overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
      <Image
        src={resolveImageSrc(item.image!)}
        alt={item.isImageOnly ? 'Call to action' : item.title}
        width={600}
        height={300}
        className="w-full h-auto object-cover"
        unoptimized
      />
      {!item.isImageOnly && (
        <p className="w-full text-center text-sm font-medium text-gray-700 py-2 px-3">
          {item.title}
        </p>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg px-6 py-5 shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 hover:-translate-y-0.5 text-center">
      {item.title}
    </div>
  );

  if (isExternalLink(item.destination)) {
    return (
      <a
        href={item.destination}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer"
        data-testid="cta-card"
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.destination}
      className="block cursor-pointer"
      data-testid="cta-card"
    >
      {content}
    </Link>
  );
}

/**
 * Dynamic CTA section for the Home page.
 * Renders 0-4 call-to-action cards in a responsive grid.
 * Returns null when no CTAs are active so no empty space is shown.
 */
export default function HomeCTASection({ items }: HomeCTASectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 ${getGridClass(items.length)} gap-4 mb-8`}>
      {items.map((item, index) => (
        <CTACard key={index} item={item} />
      ))}
    </div>
  );
}
