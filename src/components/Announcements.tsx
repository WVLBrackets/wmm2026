import { Megaphone } from 'lucide-react';

export interface Announcement {
  date: string;
  text: string;
}

interface AnnouncementsProps {
  announcements: Announcement[];
}

/**
 * Announcements — server-rendered from props. Uses a plain {@link HTMLImageElement} for the
 * small static icon so SSR markup matches the client (avoids `next/image` hydration mismatches).
 */
export default function Announcements({ announcements }: AnnouncementsProps) {
  if (!announcements || announcements.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <Megaphone className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
        </div>
        <div className="text-center text-gray-500">No announcements at this time.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-5 h-full flex flex-col">
      <div className="flex items-center mb-4">
        <Megaphone className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
      </div>

      <div className="space-y-3 grow">
        {announcements.map((announcement, index) => (
          <div
            key={index}
            className="relative border-b border-gray-100 pb-3 last:border-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              {/* Native img avoids next/image SSR vs client hydration mismatches on this tiny static asset */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/basketball icon.png"
                alt=""
                width={16}
                height={16}
                className="mt-1 h-4 w-4 shrink-0"
                decoding="async"
              />
              <div className="min-w-0 flex-1 md:pr-24">
                <p className="text-gray-700">{announcement.text}</p>
                <div className="mt-2 text-right md:hidden">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {announcement.date}
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 hidden md:block">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {announcement.date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
