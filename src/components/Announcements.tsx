'use client';

import { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import Image from 'next/image';

interface Announcement {
  date: string;
  text: string;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Google Sheet ID for Announcements
        const sheetId = '1_SkkH81ClEFGYyPmo6joN8vV1gdeCtRnzikkMskCB4k';
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
        
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        const announcementData: Announcement[] = [];
        
        // Skip header row and parse data
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const fields = parseCSVLine(line);
          if (fields.length >= 2 && fields[1].trim()) { // Check if announcement text exists
            announcementData.push({
              date: fields[0].trim(),
              text: fields[1].trim()
            });
          }
        }
        
        setAnnouncements(announcementData);
      } catch (error) {
        console.error('Error loading announcements from Google Sheets:', error);
        // Fallback announcements if Google Sheets can't be loaded
        setAnnouncements([
          {
            date: "10/1/2025",
            text: "Tournament Registration Opens January 15th"
          },
          {
            date: "10/1/2025", 
            text: "Prize Pool Increased to $7,500"
          },
          {
            date: "10/1/2025",
            text: "New Bracket Scoring System"
          },
          {
            date: "10/1/2025",
            text: "Live Updates During Tournament"
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // Helper function to parse CSV line with proper handling of quoted fields
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <Megaphone className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
        </div>
        <div className="text-center text-gray-500">Loading announcements...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
      <div className="flex items-center mb-4">
        <Megaphone className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
      </div>
      
      <div className="space-y-4 flex-grow">
        {announcements.map((announcement, index) => (
          <div key={index} className="relative">
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
        ))}
      </div>
    </div>
  );
}
