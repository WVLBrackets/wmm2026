'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X } from 'lucide-react';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

interface Team {
  id: string;
  name: string;
  mascot?: string;
  logo: string;
}

interface RegionTeam {
  id: string;
  name: string;
  seed: number;
  logo: string;
}

interface Region {
  name: string;
  position: string;
  teams: RegionTeam[];
}

export default function TournamentBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [year, setYear] = useState<string>('');
  const [tournamentName, setTournamentName] = useState<string>('Warren\'s March Madness');
  const [regions, setRegions] = useState<Region[]>([
    { name: '', position: 'Top Left', teams: Array(16).fill(null).map((_, i) => ({ id: '', name: '', seed: i + 1, logo: '' })) },
    { name: '', position: 'Bottom Left', teams: Array(16).fill(null).map((_, i) => ({ id: '', name: '', seed: i + 1, logo: '' })) },
    { name: '', position: 'Top Right', teams: Array(16).fill(null).map((_, i) => ({ id: '', name: '', seed: i + 1, logo: '' })) },
    { name: '', position: 'Bottom Right', teams: Array(16).fill(null).map((_, i) => ({ id: '', name: '', seed: i + 1, logo: '' })) },
  ]);
  const [finalFourLocation, setFinalFourLocation] = useState<string>('TBD');
  const [startDate, setStartDate] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const positionOptions = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    // Check if user is admin
    const checkAdmin = async () => {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/check-admin');
          const data = await response.json();
          if (!data.isAdmin) {
            router.push('/');
            return;
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/');
          return;
        }
      }
    };

    checkAdmin();

    // Load teams and set default year
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load teams from team data API
        const teamsResponse = await fetch('/api/admin/team-data');
        const teamsData = await teamsResponse.json();
        if (teamsData.success) {
          setTeams(teamsData.data || {});
        }

        // Load config to get default year
        const config = await getSiteConfigFromGoogleSheets();
        if (config?.tournamentYear) {
          setYear(config.tournamentYear);
        } else {
          setYear(new Date().getFullYear().toString());
        }

        // Set default start date
        const currentYear = config?.tournamentYear || new Date().getFullYear().toString();
        setStartDate(`${currentYear}-03-20`);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [session, status, router]);

  const updateRegionName = (regionIndex: number, name: string) => {
    const updated = [...regions];
    updated[regionIndex].name = name;
    setRegions(updated);
  };

  const updateRegionPosition = (regionIndex: number, position: string) => {
    // Check if position is already used by another region
    const isUsed = regions.some((r, i) => i !== regionIndex && r.position === position);
    if (isUsed) {
      alert(`Position "${position}" is already assigned to another region.`);
      return;
    }
    
    const updated = [...regions];
    updated[regionIndex].position = position;
    setRegions(updated);
  };

  const updateTeam = (regionIndex: number, seedIndex: number, teamKey: string) => {
    if (!teamKey || !teams[teamKey]) return;

    const team = teams[teamKey];
    const updated = [...regions];
    updated[regionIndex].teams[seedIndex] = {
      id: team.id,
      name: team.name,
      seed: seedIndex + 1,
      logo: team.logo || `/logos/teams/${team.id}.png`,
    };
    setRegions(updated);
  };

  const clearTeam = (regionIndex: number, seedIndex: number) => {
    const updated = [...regions];
    updated[regionIndex].teams[seedIndex] = {
      id: '',
      name: '',
      seed: seedIndex + 1,
      logo: '',
    };
    setRegions(updated);
  };

  const validate = (): boolean => {
    const validationErrors: string[] = [];

    if (!year || !/^\d{4}$/.test(year)) {
      validationErrors.push('Year must be a 4-digit number');
    }

    if (!tournamentName.trim()) {
      validationErrors.push('Tournament name is required');
    }

    regions.forEach((region, regionIndex) => {
      if (!region.name.trim()) {
        validationErrors.push(`Region ${regionIndex + 1}: Name is required`);
      }

      // Check for duplicate region names
      const duplicateName = regions.some((r, i) => i !== regionIndex && r.name.trim() === region.name.trim() && r.name.trim() !== '');
      if (duplicateName) {
        validationErrors.push(`Region ${regionIndex + 1}: Duplicate region name "${region.name}"`);
      }

      // Check for duplicate positions
      const duplicatePosition = regions.some((r, i) => i !== regionIndex && r.position === region.position);
      if (duplicatePosition) {
        validationErrors.push(`Region ${regionIndex + 1}: Duplicate position "${region.position}"`);
      }

      // Check all 16 teams are filled
      const emptySlots = region.teams.filter(t => !t.id || !t.name).length;
      if (emptySlots > 0) {
        validationErrors.push(`Region ${regionIndex + 1}: ${emptySlots} team slot(s) are not filled`);
      }

      // Check all seeds 1-16 are present
      const seeds = region.teams.map(t => t.seed).sort((a, b) => a - b);
      for (let i = 1; i <= 16; i++) {
        if (!seeds.includes(i)) {
          validationErrors.push(`Region ${regionIndex + 1}: Missing seed ${i}`);
        }
      }

      // Check for duplicate teams in same region
      const teamIds = region.teams.map(t => t.id).filter(id => id);
      const uniqueTeamIds = new Set(teamIds);
      if (teamIds.length !== uniqueTeamIds.size) {
        validationErrors.push(`Region ${regionIndex + 1}: Duplicate teams in the same region`);
      }
    });

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      const tournamentData = {
        year: year,
        name: tournamentName,
        regions: regions.map(region => ({
          name: region.name,
          position: region.position,
          teams: region.teams.map(team => ({
            id: team.id,
            name: team.name,
            seed: team.seed,
            logo: team.logo,
          })),
        })),
        finalFour: {
          location: finalFourLocation,
        },
        metadata: {
          startDate: startDate,
          scoring: [
            { round: 'Round of 64', points: 1 },
            { round: 'Round of 32', points: 2 },
            { round: 'Sweet 16', points: 4 },
            { round: 'Elite 8', points: 8 },
            { round: 'Final Four', points: 16 },
            { round: 'Championship', points: 32 },
          ],
        },
      };

      const response = await fetch('/api/admin/tournament-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournamentData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // If file was saved successfully, just redirect
        if (data.filePath) {
          alert(`Tournament ${year} saved successfully!`);
          router.push('/admin');
        } else {
          // In Vercel, trigger download of JSON file
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename || `tournament-${year}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          alert(`Tournament ${year} data downloaded. Please commit this file to the repository at public/data/${data.filename}`);
          router.push('/admin');
        }
      } else {
        setErrors([data.error || 'Failed to save tournament']);
      }
    } catch (error) {
      console.error('Error saving tournament:', error);
      setErrors(['Failed to save tournament']);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const teamList = Object.entries(teams).sort((a, b) => {
    const nameA = a[1].name.toLowerCase();
    const nameB = b[1].name.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Admin</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Tournament Bracket Builder</h1>
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Validation Errors:</h3>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tournament Info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Tournament Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year *
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                pattern="\d{4}"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tournament Name *
              </label>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Four Location
              </label>
              <input
                type="text"
                value={finalFourLocation}
                onChange={(e) => setFinalFourLocation(e.target.value)}
                placeholder="TBD"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-6">
          {regions.map((region, regionIndex) => (
            <div key={regionIndex} className="bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4 flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region Name *
                  </label>
                  <input
                    type="text"
                    value={region.name}
                    onChange={(e) => updateRegionName(regionIndex, e.target.value)}
                    placeholder="East, West, South, Midwest, etc."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position *
                  </label>
                  <select
                    value={region.position}
                    onChange={(e) => updateRegionPosition(regionIndex, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {positionOptions.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {region.teams.map((team, seedIndex) => (
                  <div key={seedIndex} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Seed {team.seed}</span>
                      {team.id && (
                        <button
                          onClick={() => clearTeam(regionIndex, seedIndex)}
                          className="text-red-600 hover:text-red-800"
                          title="Clear"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <select
                      value={team.id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateTeam(regionIndex, seedIndex, e.target.value);
                        } else {
                          clearTeam(regionIndex, seedIndex);
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm"
                    >
                      <option value="">Select Team...</option>
                      {teamList.map(([key, teamData]) => (
                        <option key={key} value={key}>
                          {teamData.name}
                        </option>
                      ))}
                    </select>
                    {team.name && (
                      <div className="mt-2 flex items-center space-x-2">
                        {team.logo && (
                          <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain" />
                        )}
                        <span className="text-xs text-gray-600">{team.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Tournament'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

