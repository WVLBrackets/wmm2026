'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';
import type { TournamentBracket, TournamentData } from '@/types/tournament';
import FullBracketCanvas from '@/components/bracket/FullBracketCanvas';
import {
  DEFAULT_FULL_BRACKET_LAYOUT,
  type LayoutSettings,
  type PickResultContext,
} from '@/lib/fullBracket/fullBracketGeometry';
import { buildEliminatedTeamIdsFromKeyPicks } from '@/lib/fullBracket/keyPickResultStyles';
import { FULL_BRACKET_VIEWPORT_PADDING_X, fullBracketDebugOutline } from '@/lib/fullBracket/fullBracketViewChrome';

export interface BracketViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bracketId: string | null;
  year: number;
  title?: string;
  /**
   * `pool` — public pool read (`?pool=1`), submitted non-KEY only (standings).
   * `owner` — session read for the signed-in user’s bracket (any status, e.g. My Picks deleted).
   */
  bracketFetchMode?: 'pool' | 'owner';
}

/**
 * Read-only full bracket from any submitted pool bracket (pool=1 API).
 */
export default function BracketViewerModal({
  isOpen,
  onClose,
  bracketId,
  year,
  title,
  bracketFetchMode = 'pool',
}: BracketViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [updatedBracket, setUpdatedBracket] = useState<TournamentBracket | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tieBreaker, setTieBreaker] = useState('');
  const [entryLabel, setEntryLabel] = useState('');
  const [keyPicks, setKeyPicks] = useState<Record<string, string>>({});
  const [layout] = useState<LayoutSettings>(DEFAULT_FULL_BRACKET_LAYOUT);

  const load = useCallback(async () => {
    if (!bracketId) return;
    setLoading(true);
    setError(null);
    try {
      const bracketUrl =
        bracketFetchMode === 'owner'
          ? `/api/tournament-bracket/${encodeURIComponent(bracketId)}`
          : `/api/tournament-bracket/${encodeURIComponent(bracketId)}?pool=1`;
      const [bracketRes, rawTournament, keyRes] = await Promise.all([
        fetch(bracketUrl, { cache: 'no-store' }),
        loadTournamentData(String(year)),
        fetch(`/api/key-picks?year=${encodeURIComponent(String(year))}`, { cache: 'no-store' }),
      ]);

      const bracketJson = await bracketRes.json();
      const keyJson = await keyRes.json().catch(() => ({}));
      if (!bracketRes.ok || !bracketJson.success || !bracketJson.data) {
        throw new Error(bracketJson.error || 'Failed to load bracket');
      }

      const kp =
        keyRes.ok && keyJson.success && keyJson.data?.picks && typeof keyJson.data.picks === 'object'
          ? (keyJson.data.picks as Record<string, string>)
          : {};
      setKeyPicks(kp);

      let tournament = rawTournament;
      try {
        const refResponse = await fetch('/api/team-data?activeOnly=false', { cache: 'no-store' });
        const refJson = await refResponse.json();
        if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
          tournament = applyDisplayNamesToTournamentData(
            rawTournament,
            buildTeamIdToDisplayNameMapFromApi(refJson.data)
          );
        }
      } catch {
        // non-fatal
      }

      const poolPicks = (bracketJson.data.picks as Record<string, string>) || {};
      const baseBracket = generate64TeamBracket(tournament);
      const resolved = updateBracketWithPicks(baseBracket, poolPicks, tournament);

      setTournamentData(tournament);
      setPicks(poolPicks);
      setTieBreaker(
        bracketJson.data.tieBreaker != null && bracketJson.data.tieBreaker !== ''
          ? String(bracketJson.data.tieBreaker)
          : ''
      );
      setEntryLabel(String(bracketJson.data.entryName || ''));
      setUpdatedBracket(resolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bracket');
      setTournamentData(null);
      setUpdatedBracket(null);
      setKeyPicks({});
    } finally {
      setLoading(false);
    }
  }, [bracketId, year, bracketFetchMode]);

  useEffect(() => {
    if (!isOpen || !bracketId) return;
    void load();
  }, [isOpen, bracketId, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const pickResultContext = useMemo((): PickResultContext | null => {
    if (!tournamentData || Object.keys(keyPicks).length === 0) return null;
    const baseBracket = generate64TeamBracket(tournamentData);
    return {
      keyPicks,
      eliminatedTeamIds: buildEliminatedTeamIdsFromKeyPicks(keyPicks, tournamentData, baseBracket),
    };
  }, [tournamentData, keyPicks]);

  const canOpenPrintLayout = Boolean(!loading && !error && tournamentData && updatedBracket);

  /**
   * Same flow as My Picks: stash minimal bracket payload in sessionStorage and open `/print-bracket` in a new tab.
   */
  const handleOpenPrintLayoutTab = () => {
    if (typeof window === 'undefined' || !canOpenPrintLayout) return;
    const payload = {
      picks,
      tieBreaker: tieBreaker !== '' ? tieBreaker : undefined,
      entryName: entryLabel || title || '',
    };
    sessionStorage.setItem('printBracketData', JSON.stringify(payload));
    window.open('/print-bracket', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 max-md:items-start max-md:justify-center max-md:px-3 max-md:pb-3 max-md:pt-[calc(env(safe-area-inset-top,0px)+2.75rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bracket-viewer-title"
      onClick={onClose}
      data-testid="bracket-viewer-modal"
    >
      <div
        className={`max-h-[92vh] max-md:max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] w-full max-w-[1500px] overflow-hidden rounded-xl bg-white shadow-2xl ${fullBracketDebugOutline('shell')}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 py-3 ${FULL_BRACKET_VIEWPORT_PADDING_X}`}
        >
          <div className="min-w-0 flex-1 pr-2">
            <h2 id="bracket-viewer-title" className="truncate text-lg font-semibold text-gray-900">
              {entryLabel || title || 'Bracket'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenPrintLayoutTab}
              disabled={!canOpenPrintLayout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Open print layout in a new tab"
              title="Print View"
              data-testid="bracket-viewer-print-button"
            >
              <Printer className="h-4 w-4 shrink-0" aria-hidden />
              Print View
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={`max-h-[calc(92vh-4rem)] max-md:max-h-[calc(100dvh-9.5rem-env(safe-area-inset-top,0px))] overflow-auto py-3 ${FULL_BRACKET_VIEWPORT_PADDING_X} ${fullBracketDebugOutline('canvasWrap')}`.trim()}
        >
          {loading && (
            <div className="flex h-64 items-center justify-center text-gray-600">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Loading bracket…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {!loading && !error && tournamentData && updatedBracket && (
            <FullBracketCanvas
              tournamentData={tournamentData}
              updatedBracket={updatedBracket}
              picks={picks}
              tieBreaker={tieBreaker}
              layout={layout}
              bracketSize="64"
              readOnly
              pickResultContext={pickResultContext}
            />
          )}
        </div>
      </div>
    </div>
  );
}
