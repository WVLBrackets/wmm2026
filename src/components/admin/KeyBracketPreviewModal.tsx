'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import { loadTournamentData } from '@/lib/tournamentLoader';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMapFromApi,
} from '@/lib/teamDisplayName';
import type { TournamentBracket, TournamentData } from '@/types/tournament';
import FullBracketCanvas, { type FullBracketSizeMode } from '@/components/bracket/FullBracketCanvas';
import {
  DEFAULT_FULL_BRACKET_LAYOUT,
  type LayoutSettings,
  type RoundKey,
  applyPickCascade,
  getRoundLabel,
  withUpdatedRoundSetting,
} from '@/lib/fullBracket/fullBracketGeometry';
import {
  KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY,
  readKeyBracketPreviewLayoutFromStorage,
} from '@/lib/fullBracket/keyBracketPreviewLayoutStorage';
import { FULL_BRACKET_VIEWPORT_PADDING_X, fullBracketDebugOutline } from '@/lib/fullBracket/fullBracketViewChrome';

interface KeyBracketPreviewModalProps {
  isOpen: boolean;
  year: string;
  onClose: () => void;
  embedded?: boolean;
  readOnly?: boolean;
}

interface LiveResultsPreviewResponse {
  success: boolean;
  error?: string;
  data?: {
    picks?: Record<string, string>;
    tieBreaker?: number | null;
    bracketId?: string | null;
  };
}

export default function KeyBracketPreviewModal({
  isOpen,
  year,
  onClose,
  embedded = false,
  readOnly = false,
}: KeyBracketPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [updatedBracket, setUpdatedBracket] = useState<TournamentBracket | null>(null);
  const [tieBreaker, setTieBreaker] = useState<string>('');
  const [keyBracketId, setKeyBracketId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [layout, setLayout] = useState<LayoutSettings>(DEFAULT_FULL_BRACKET_LAYOUT);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [bracketSize, setBracketSize] = useState<FullBracketSizeMode>('64');
  const [layoutCopyStatus, setLayoutCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const lastSavedRef = useRef<string>('');
  const layoutCopyResetRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setLayout(readKeyBracketPreviewLayoutFromStorage());
    } catch (storageError) {
      console.warn('Failed to restore KEY bracket preview layout settings:', storageError);
    } finally {
      setLayoutLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!layoutLoaded) return;
    window.localStorage.setItem(KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout, layoutLoaded]);

  useEffect(() => {
    return () => {
      if (layoutCopyResetRef.current) window.clearTimeout(layoutCopyResetRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [previewResponse, rawTournament] = await Promise.all([
          fetch(`/api/admin/live-results?year=${encodeURIComponent(year)}`),
          loadTournamentData(year),
        ]);

        let tournament = rawTournament;
        try {
          const refResponse = await fetch('/api/team-data?activeOnly=false', {
            cache: 'no-store',
          });
          const refJson = await refResponse.json();
          if (refJson.success && Array.isArray(refJson.data) && refJson.data.length > 0) {
            tournament = applyDisplayNamesToTournamentData(
              rawTournament,
              buildTeamIdToDisplayNameMapFromApi(refJson.data)
            );
          }
        } catch (refError) {
          console.warn('[KEY preview] Could not apply team display names:', refError);
        }

        const previewResult = (await previewResponse.json()) as LiveResultsPreviewResponse;
        if (!previewResponse.ok || !previewResult.success) {
          throw new Error(previewResult.error || 'Failed to load KEY preview data.');
        }

        const previewPicks = previewResult.data?.picks ?? {};
        const baseBracket = generate64TeamBracket(tournament);
        const resolvedBracket = updateBracketWithPicks(baseBracket, previewPicks, tournament);

        setPicks(previewPicks);
        setTieBreaker(previewResult.data?.tieBreaker != null ? String(previewResult.data.tieBreaker) : '');
        setTournamentData(tournament);
        setUpdatedBracket(resolvedBracket);
        setKeyBracketId(previewResult.data?.bracketId ?? null);
        setSaveError(null);
        lastSavedRef.current = JSON.stringify({
          picks: previewPicks,
          tieBreaker: previewResult.data?.tieBreaker != null ? String(previewResult.data.tieBreaker) : '',
        });
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
    if (!tournamentData) return;
    const baseBracket = generate64TeamBracket(tournamentData);
    const resolvedBracket = updateBracketWithPicks(baseBracket, picks, tournamentData);
    setUpdatedBracket(resolvedBracket);
  }, [picks, tournamentData]);

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

  const handleTeamPick = (gameId: string, teamId: string) => {
    setPicks((previous) => applyPickCascade(previous, gameId, teamId));
  };

  useEffect(() => {
    if (!isOpen || !tournamentData) return;
    if (readOnly) return;

    const saveSignature = JSON.stringify({ picks, tieBreaker });
    if (saveSignature === lastSavedRef.current) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);

        let activeBracketId = keyBracketId;
        if (!activeBracketId) {
          const openResponse = await fetch('/api/admin/live-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: Number(year) }),
          });
          const openResult = (await openResponse.json()) as { success?: boolean; error?: string; data?: { bracketId?: string } };
          if (!openResponse.ok || !openResult.success || !openResult.data?.bracketId) {
            throw new Error(openResult.error || 'Failed to initialize KEY bracket session');
          }
          activeBracketId = openResult.data.bracketId;
          if (!cancelled) {
            setKeyBracketId(activeBracketId);
          }
        }

        let tieBreakerPayload: number | null = null;
        if (tieBreaker.trim() !== '') {
          const parsed = Number(tieBreaker);
          if (Number.isFinite(parsed)) {
            tieBreakerPayload = parsed;
          }
        }

        const saveResponse = await fetch(`/api/admin/live-results/${activeBracketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ picks, tieBreaker: tieBreakerPayload }),
        });
        const saveResult = (await saveResponse.json()) as { success?: boolean; error?: string };
        if (!saveResponse.ok || !saveResult.success) {
          throw new Error(saveResult.error || 'Failed to save KEY bracket changes');
        }

        if (!cancelled) {
          lastSavedRef.current = saveSignature;
        }
      } catch (persistError) {
        if (!cancelled) {
          setSaveError(persistError instanceof Error ? persistError.message : 'Failed to save KEY changes');
        }
      } finally {
        if (!cancelled) {
          setIsSaving(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, keyBracketId, picks, tieBreaker, tournamentData, year, readOnly]);

  if (!isOpen) return null;

  return (
    <div
      className={
        embedded
          ? 'mt-6 rounded-xl border border-gray-200 bg-white shadow-sm'
          : 'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4'
      }
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={
          embedded
            ? 'w-full overflow-hidden'
            : 'flex max-h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl'
        }
        onClick={embedded ? undefined : (event) => event.stopPropagation()}
      >
        {!embedded && (
          <div
            className={`flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 py-3 ${FULL_BRACKET_VIEWPORT_PADDING_X}`}
          >
            <h2 className="text-lg font-semibold text-gray-900">Edit KEY bracket</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
              data-testid="key-bracket-preview-modal-close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-auto bg-white py-3 ${FULL_BRACKET_VIEWPORT_PADDING_X} ${fullBracketDebugOutline('canvasWrap')}`.trim()}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {!embedded && (
              <>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setBracketSize('64')}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      bracketSize === '64' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    64
                  </button>
                  <button
                    type="button"
                    onClick={() => setBracketSize('32')}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      bracketSize === '32' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    32
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLayoutControls((previous) => !previous)}
                  className="rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {showLayoutControls ? 'Hide Layout Controls' : 'Show Layout Controls'}
                </button>
                {showLayoutControls && (
                  <>
                    <button
                      type="button"
                      onClick={() => setLayout(DEFAULT_FULL_BRACKET_LAYOUT)}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
                          setLayoutCopyStatus('copied');
                        } catch {
                          setLayoutCopyStatus('failed');
                        }
                        if (layoutCopyResetRef.current) window.clearTimeout(layoutCopyResetRef.current);
                        layoutCopyResetRef.current = window.setTimeout(() => setLayoutCopyStatus('idle'), 2500);
                      }}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      title="Copies to the clipboard. Paste into src/lib/fullBracket/committedFullBracketLayout.json and commit."
                      data-testid="key-bracket-copy-layout-json"
                    >
                      {layoutCopyStatus === 'copied'
                        ? 'Copied to clipboard'
                        : layoutCopyStatus === 'failed'
                          ? 'Copy failed (clipboard blocked?)'
                          : 'Copy layout JSON'}
                    </button>
                  </>
                )}
              </>
            )}
            {!showLayoutControls && !readOnly && !embedded && (
              <div className="text-xs text-gray-500">
                {isSaving ? 'Saving KEY changes...' : saveError ? `Save error: ${saveError}` : 'KEY changes auto-save on click/edit'}
              </div>
            )}
          </div>

          {showLayoutControls && !embedded && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-[11px] text-gray-600">
                Staging and other environments use the layout in{' '}
                <code className="rounded bg-gray-100 px-1">committedFullBracketLayout.json</code> (merged onto the
                builtin baseline). Use &quot;Copy layout JSON&quot; after you are happy, replace that file, run{' '}
                <code className="rounded bg-gray-100 px-1">npm run build</code>, then push.
              </p>
              <div className="mb-2 hidden gap-2 px-1 lg:grid lg:grid-cols-[110px_repeat(5,minmax(120px,1fr))]">
                <div className="text-[11px] font-semibold text-gray-600">Round</div>
                <div className="text-[11px] font-semibold text-gray-600">Box Height</div>
                <div className="text-[11px] font-semibold text-gray-600">Matchup Gap</div>
                <div className="text-[11px] font-semibold text-gray-600">Game Gap</div>
                <div className="text-[11px] font-semibold text-gray-600">Column Width</div>
                <div className="text-[11px] font-semibold text-gray-600">Overlap</div>
              </div>

              <div className="space-y-2">
                {(['r64', 'r32', 's16', 'e8', 'r5'] as RoundKey[]).map((roundKey) => {
                  const settings = layout.rounds[roundKey];
                  return (
                    <div key={roundKey} className="grid grid-cols-1 gap-2 lg:grid-cols-[110px_repeat(5,minmax(120px,1fr))]">
                      <div className="self-center text-xs font-semibold text-gray-700">{getRoundLabel(roundKey)}</div>
                      <label className="text-xs text-gray-700">
                        <span className="lg:hidden">Box H</span>
                        <input
                          type="number"
                          min={20}
                          max={52}
                          value={settings.slotHeightPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                slotHeightPx: Number(event.target.value) || current.slotHeightPx,
                              }))
                            )
                          }
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                        />
                      </label>
                      <label className="text-xs text-gray-700">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={settings.matchupGapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                matchupGapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                        />
                      </label>
                      <label className="text-xs text-gray-700">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={settings.gameGapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                gameGapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                        />
                      </label>
                      <label className="text-xs text-gray-700">
                        <input
                          type="number"
                          min={90}
                          max={240}
                          value={settings.columnWidthPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                columnWidthPx: Number(event.target.value) || current.columnWidthPx,
                              }))
                            )
                          }
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                        />
                      </label>
                      <label className="text-xs text-gray-700">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={settings.overlapPx}
                          onChange={(event) =>
                            setLayout((previous) =>
                              withUpdatedRoundSetting(previous, roundKey, (current) => ({
                                ...current,
                                overlapPx: Number(event.target.value) || 0,
                              }))
                            )
                          }
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-gray-700">Quad grid (four regions)</div>
                <p className="mb-2 text-[11px] text-gray-500">
                  <strong>Center gutter</strong> is the horizontal space between the left and right halves of the bracket
                  (between facing Round&nbsp;5 columns). It is separate from per-round overlap. <strong>Row gap</strong>{' '}
                  separates the top and bottom region rows.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs text-gray-700">
                    Center gutter (px)
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={layout.quadGrid.columnGapPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          quadGrid: {
                            ...previous.quadGrid,
                            columnGapPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                      data-testid="key-layout-quad-column-gap"
                    />
                  </label>
                  <label className="text-xs text-gray-700">
                    Row gap (px)
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={layout.quadGrid.rowGapPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          quadGrid: {
                            ...previous.quadGrid,
                            rowGapPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                      data-testid="key-layout-quad-row-gap"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-gray-700">Region Labels</div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  <label className="text-xs text-gray-700">
                    Font (px)
                    <input
                      type="number"
                      min={10}
                      max={36}
                      value={layout.regionLabels.fontSizePx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            fontSizePx: Number(event.target.value) || previous.regionLabels.fontSizePx,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-700">
                    X (px)
                    <input
                      type="number"
                      min={-120}
                      max={120}
                      value={layout.regionLabels.offsetXPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            offsetXPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                    />
                  </label>
                  <label className="text-xs text-gray-700">
                    Y (px)
                    <input
                      type="number"
                      min={-60}
                      max={250}
                      value={layout.regionLabels.offsetYPx}
                      onChange={(event) =>
                        setLayout((previous) => ({
                          ...previous,
                          regionLabels: {
                            ...previous.regionLabels,
                            offsetYPx: Number(event.target.value) || 0,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-gray-700">Finals cluster (semifinals + champ + tie)</div>
                <p className="mb-2 text-[11px] text-gray-500">
                  Moves the whole finals block up or down together (same offset for both rows).
                </p>
                <label className="text-xs text-gray-700">
                  Vertical offset (px)
                  <input
                    type="number"
                    min={-400}
                    max={400}
                    value={layout.finals.finalsClusterOffsetYPx}
                    onChange={(event) =>
                      setLayout((previous) => ({
                        ...previous,
                        finals: {
                          ...previous.finals,
                          finalsClusterOffsetYPx: Number(event.target.value) || 0,
                        },
                      }))
                    }
                    className="mt-1 w-full max-w-[200px] rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
                    data-testid="key-layout-finals-cluster-y"
                  />
                </label>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex h-[420px] items-center justify-center text-gray-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading bracket preview...
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
              bracketSize={bracketSize}
              readOnly={readOnly}
              onTieBreakerChange={readOnly ? undefined : setTieBreaker}
              onSelectTeam={readOnly ? undefined : handleTeamPick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
