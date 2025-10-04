'use client';

import TeamLogoWithFallback from '@/components/TeamLogoWithFallback';

interface TeamLogoProps {
  teamName: string;
  size?: number;
  teamIndex?: number;
}

export default function TeamLogo({ teamName, size = 40, teamIndex }: TeamLogoProps) {
  return (
    <TeamLogoWithFallback 
      teamName={teamName} 
      size={size} 
      teamIndex={teamIndex}
    />
  );
}
