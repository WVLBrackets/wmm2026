import { Megaphone } from 'lucide-react';
import Image from 'next/image';

export interface Announcement {
  date: string;
  text: string;
}

interface AnnouncementsProps {
  announcements: Announcement[];
}

/**
 * Announcements component - displays pre-fetched announcement data
 * Data is passed as props from the server component (Home page)
 * This ensures announcements are baked into static HTML
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
      
      <div className="space-y-3 flex-grow">
        {announcements.map((announcement, index) => (
          <div key={index}>
            {/* Mobile layout: Full width text with timestamp underneath */}
            <div className="block md:hidden">
              <div className="flex items-start mb-2">
                <div className="flex-shrink-0 mt-1 mr-3">
                  <Image
                    src="/images/basketball icon.png"
                    alt="Basketball"
                    width={16}
                    height={16}
                    className="w-4 h-4"
                  />
                </div>
                <div className="flex-grow">
                  <p className="text-gray-700">{announcement.text}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {announcement.date}
                </span>
              </div>
            </div>
            
            {/* Desktop layout: Original layout with absolute positioning */}
            <div className="hidden md:block relative">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1 mr-3">
                  <Image
                    src="/images/basketball icon.png"
                    alt="Basketball"
                    width={16}
                    height={16}
                    className="w-4 h-4"
                  />
                </div>
                <div className="flex-grow pr-20">
                  <p className="text-gray-700">{announcement.text}</p>
                </div>
              </div>
              {/* Timestamp positioned absolutely in top-right corner */}
              <div className="absolute top-0 right-0">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {announcement.date}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
