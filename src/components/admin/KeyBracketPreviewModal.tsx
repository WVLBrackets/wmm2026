'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Loader2, X } from 'lucide-react';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { TournamentBracket, TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';

interface KeyBracketPreviewModalProps {
  isOpen: boolean;
  year: string;
  onClose: () => void;
}

interface LiveResultsPreviewResponse {
  success: boolean;
  error?: string;
  data?: {
    picks?: Record<string, string>;
  };
}

/**
 * Resolve the picked winner for a game from current picks.
 */
function getPickedWinner(game: TournamentGame, picks: Record<string, string>): TournamentTeam | null {
  const pickedTeamId = picks[game.id];
  if (!pickedTeamId) return null;
  if (game.team1?.id === pickedTeamId) return game.team1;
  if (game.team2?.id === pickedTeamId) return game.team2;
  return null;
}

/**
 * Render a compact team row with optional winner highlighting.
 */
function TeamRow({ team, isWinner }: { team?: TournamentTeam; isWinner?: boolean }) {
  if (!team) {
    return (
      <div className="h-7 px-2 rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 flex items-center">
        TBD
      </div>
    );
  }

  return (
    <div
      className={`h-7 px-2 rounded border text-xs flex items-center gap-1.5 ${
        isWinner ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-300 bg-white text-gray-800'
      }`}
    >
      <span className="font-bold">#{team.seed}</span>
      {team.logo && (
        <Image src={team.logo} alt={team.name} width={12} height={12} className="w-3 h-3 object-contain flex-shrink-0" unoptimized />
      )}
      <span className="truncate">{team.name}</span>
    </div>
  );
}

/**
 * Render one region as round columns with currently selected winners.
 */
function RegionBoard({
  regionName,
  regionGames,
  picks,
  reverse,
}: {
  regionName: string;
  regionGames: TournamentGame[];
  picks: Record<string, string>;
  reverse?: boolean;
}) {
  const round64 = regionGames.filter((game) => game.round === 'Round of 64');
  const round32 = regionGames.filter((game) => game.round === 'Round of 32');
  const sweet16 = regionGames.filter((game) => game.round === 'Sweet 16');
  const elite8 = regionGames.filter((game) => game.round === 'Elite 8');

  const columns = [
    {
      id: 'r64',
      title: 'Round of 64',
      content: round64.map((game) => {
        const pickedTeamId = picks[game.id];
        return (
          <div key={game.id} className="space-y-1">
            <TeamRow team={game.team1} isWinner={game.team1?.id === pickedTeamId} />
            <TeamRow team={game.team2} isWinner={game.team2?.id === pickedTeamId} />
          </div>
        );
      }),
    },
    {
      id: 'r32',
      title: 'Round of 32',
      content: round32.map((game) => <TeamRow key={game.id} team={getPickedWinner(game, picks) ?? undefined} isWinner />),
    },
    {
      id: 's16',
      title: 'Sweet 16',
      content: sweet16.map((game) => <TeamRow key={game.id} team={getPickedWinner(game, picks) ?? undefined} isWinner />),
    },
    {
      id: 'e8',
      title: 'Elite 8',
      content: elite8.map((game) => <TeamRow key={game.id} team={getPickedWinner(game, picks) ?? undefined} isWinner />),
    },
  ];

  const orderedColumns = reverse ? [...columns].reverse() : columns;

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 min-w-0">
      <h4 className={`text-sm font-semibold text-gray-900 mb-3 ${reverse ? 'text-right' : 'text-left'}`}>{regionName}</h4>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {orderedColumns.map((column) => (
          <div key={column.id} className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{column.title}</p>
            <div className="space-y-2">{column.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KeyBracketPreviewModal({ isOpen, year, onClose }: KeyBracketPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [updatedBracket, setUpdatedBracket] = useState<TournamentBracket | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [previewResponse, tournament] = await Promise.all([
          fetch(`/api/admin/live-results?year=${encodeURIComponent(year)}`),
          loadTournamentData(year),
        ]);

        const previewResult = (await previewResponse.json()) as LiveResultsPreviewResponse;
        if (!previewResponse.ok || !previewResult.success) {
          throw new Error(previewResult.error || 'Failed to load KEY preview data.');
        }

        const previewPicks = previewResult.data?.picks ?? {};
        const baseBracket = generate64TeamBracket(tournament);
        const resolvedBracket = updateBracketWithPicks(baseBracket, previewPicks, tournament);

        setPicks(previewPicks);
        setTournamentData(tournament);
        setUpdatedBracket(resolvedBracket);
      } catch (previewError) {
        console.error('Error loading KEY bracket preview:', previewError);
        setError(previewError instanceof Error ? previewError.message : 'Failed to load KEY bracket preview.');
      } finally {
        setLoading(false);
      }
    };

    loadPreviewData();
  }, [isOpen, year]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const regionsByPosition = useMemo(() => {
    if (!tournamentData || !updatedBracket) return null;

    const getRegionByPosition = (position: string) =>
      tournamentData.regions.find((region) => region.position === position);

    const topLeft = getRegionByPosition('Top Left');
    const bottomLeft = getRegionByPosition('Bottom Left');
    const topRight = getRegionByPosition('Top Right');
    const bottomRight = getRegionByPosition('Bottom Right');

    return {
      topLeft,
      bottomLeft,
      topRight,
      bottomRight,
      bracketRegions: updatedBracket.regions,
    };
  }, [tournamentData, updatedBracket]);

  const semifinalWinner1 = updatedBracket ? getPickedWinner(updatedBracket.finalFour[0], picks) : null;
  const semifinalWinner2 = updatedBracket ? getPickedWinner(updatedBracket.finalFour[1], picks) : null;
  const champion = updatedBracket ? getPickedWinner(updatedBracket.championship, picks) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[96vw] max-w-[1500px] max-h-[92vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">KEY Bracket Preview</h3>
            <p className="text-sm text-gray-600">Tournament {year} - full 64-team bracket with current winners</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close bracket preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 overflow-auto max-h-[calc(92vh-72px)] bg-white">
          {loading && (
            <div className="h-[420px] flex items-center justify-center text-gray-600">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading bracket preview...
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && regionsByPosition && (
            <div className="space-y-4 min-w-[1100px]">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.topLeft && (
                  <RegionBoard
                    regionName={regionsByPosition.topLeft.name}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topLeft.position] || []}
                    picks={picks}
                  />
                )}
                {regionsByPosition.topRight && (
                  <RegionBoard
                    regionName={regionsByPosition.topRight.name}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.topRight.position] || []}
                    picks={picks}
                    reverse
                  />
                )}
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Final Four and Championship</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Semifinal 1</p>
                    <TeamRow team={updatedBracket?.finalFour[0]?.team1} isWinner={updatedBracket?.finalFour[0]?.team1?.id === picks['final-four-1']} />
                    <div className="h-1" />
                    <TeamRow team={updatedBracket?.finalFour[0]?.team2} isWinner={updatedBracket?.finalFour[0]?.team2?.id === picks['final-four-1']} />
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[11px] text-gray-500 mb-1">Winner</p>
                      <TeamRow team={semifinalWinner1 ?? undefined} isWinner />
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Semifinal 2</p>
                    <TeamRow team={updatedBracket?.finalFour[1]?.team1} isWinner={updatedBracket?.finalFour[1]?.team1?.id === picks['final-four-2']} />
                    <div className="h-1" />
                    <TeamRow team={updatedBracket?.finalFour[1]?.team2} isWinner={updatedBracket?.finalFour[1]?.team2?.id === picks['final-four-2']} />
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[11px] text-gray-500 mb-1">Winner</p>
                      <TeamRow team={semifinalWinner2 ?? undefined} isWinner />
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Champion</p>
                    <TeamRow team={updatedBracket?.championship?.team1} isWinner={updatedBracket?.championship?.team1?.id === picks.championship} />
                    <div className="h-1" />
                    <TeamRow team={updatedBracket?.championship?.team2} isWinner={updatedBracket?.championship?.team2?.id === picks.championship} />
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[11px] text-gray-500 mb-1">Selected Champion</p>
                      <TeamRow team={champion ?? undefined} isWinner />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {regionsByPosition.bottomLeft && (
                  <RegionBoard
                    regionName={regionsByPosition.bottomLeft.name}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomLeft.position] || []}
                    picks={picks}
                  />
                )}
                {regionsByPosition.bottomRight && (
                  <RegionBoard
                    regionName={regionsByPosition.bottomRight.name}
                    regionGames={regionsByPosition.bracketRegions[regionsByPosition.bottomRight.position] || []}
                    picks={picks}
                    reverse
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
