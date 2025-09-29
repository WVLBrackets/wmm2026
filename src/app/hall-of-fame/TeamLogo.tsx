'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getTeamInfo } from '@/lib/teamLogos';

interface TeamLogoProps {
  teamName: string;
  size?: number;
}

export default function TeamLogo({ teamName, size = 40 }: TeamLogoProps) {
  const [teamInfo, setTeamInfo] = useState<{ id: string; name: string; logoUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeamInfo = async () => {
      try {
        console.log(`🏀 Loading team info for: "${teamName}"`);
        const info = await getTeamInfo(teamName);
        console.log(`🏀 Team info result for "${teamName}":`, info);
        setTeamInfo(info);
      } catch (error) {
        console.error(`Failed to load team info for ${teamName}:`, error);
        setTeamInfo({ id: '', name: teamName, logoUrl: null });
      } finally {
        setLoading(false);
      }
    };

    loadTeamInfo();
  }, [teamName]);

  if (loading) {
    return (
      <div 
        className="bg-gray-200 rounded animate-pulse" 
        style={{ width: size, height: size }}
      />
    );
  }

  if (!teamInfo || !teamInfo.logoUrl) {
    return (
      <div 
        className="bg-gray-100 rounded flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-gray-500 font-medium">
          {teamName.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        src={teamInfo.logoUrl}
        alt={`${teamInfo.name} logo`}
        width={size}
        height={size}
        className="object-contain"
        quality={100}
        unoptimized={true}
        priority={size >= 64}
        style={{ 
          imageRendering: 'crisp-edges',
          backgroundColor: 'transparent',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
        onError={(e) => {
          console.warn(`Failed to load logo for ${teamInfo.name}:`, teamInfo.logoUrl);
        }}
      />
    </div>
  );
}
