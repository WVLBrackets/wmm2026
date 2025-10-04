'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getTeamInfo } from '@/lib/teamLogos';

interface TeamLogoWithFallbackProps {
  teamName: string;
  size?: number;
  teamIndex?: number; // Optional index number to display
}

export default function TeamLogoWithFallback({ 
  teamName, 
  size = 40, 
  teamIndex 
}: TeamLogoWithFallbackProps) {
  const [teamInfo, setTeamInfo] = useState<{ id: string; name: string; logoUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadTeamInfo = async () => {
      try {
        console.log(`🏀 Loading team info for: "${teamName}"`);
        const info = await getTeamInfo(teamName);
        console.log(`🏀 Team info result for "${teamName}":`, info);
        setTeamInfo(info);
      } catch (error) {
        console.error(`Failed to load team info for ${teamName}:`, error);
        setTeamInfo({ id: 'placeholder', name: teamName, logoUrl: '/images/basketball icon.png' });
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

  // If we have a team info but no logo URL, or if the image failed to load, show fallback
  const shouldShowFallback = !teamInfo || !teamInfo.logoUrl || imageError || teamInfo.id === 'placeholder';

  if (shouldShowFallback) {
    return (
      <div 
        className="relative flex items-center justify-center rounded"
        style={{ width: size, height: size }}
      >
        {/* Basketball background */}
        <Image
          src="/images/basketball icon.png"
          alt="Basketball fallback"
          width={size}
          height={size}
          className="object-contain rounded"
          quality={85}
          style={{ 
            imageRendering: 'auto',
            backgroundColor: 'transparent',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
        
        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-white font-bold text-center leading-none" style={{ fontSize: '6px' }}>
            {teamName.substring(0, 3).toUpperCase()}
          </div>
          {teamIndex !== undefined ? (
            <div className="text-white font-bold text-center leading-none mt-0.5" style={{ fontSize: '6px' }}>
              {teamIndex}
            </div>
          ) : (
            <div className="text-white font-bold text-center leading-none mt-0.5" style={{ fontSize: '6px' }}>
              ?
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        src={teamInfo.logoUrl || '/images/basketball icon.png'}
        alt={`${teamInfo.name} logo`}
        width={size}
        height={size}
        className="object-contain rounded"
        quality={85}
        priority={size >= 64}
        style={{ 
          imageRendering: 'auto',
          backgroundColor: 'transparent',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
        onError={() => {
          console.warn(`Failed to load logo for ${teamInfo.name}:`, teamInfo.logoUrl);
          setImageError(true);
        }}
      />
    </div>
  );
}
