'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ClipboardList, RefreshCw, Save } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import type { ScoreboardGame, ScoreboardSettings } from '@/lib/types/scoreboard';

type GameDraft = {
  score1: string;
  score2: string;
  winnerId: string;
  status: string;
};

type ScoreboardTabProps = {
  brackets: { year?: number }[];
};

/**
 * Admin Scoreboard of Record — edit finals, kill switch, Sync now.
 */
export default function ScoreboardTab({ brackets }: ScoreboardTabProps) {
  const bracketYears = useMemo(() => {
    const years = new Set<number>();
    brackets.forEach((b) => {
      if (typeof b.year === 'number') years.add(b.year);
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [brackets]);

  const [availableYears, setAvailableYears] = useState<number[]>(bracketYears);
  const [year, setYear] = useState<string>(
    bracketYears[0] ? String(bracketYears[0]) : '',
  );
  const [games, setGames] = useState<ScoreboardGame[]>([]);
  const [settings, setSettings] = useState<ScoreboardSettings | null>(null);
  const [bbsKeyConfigured, setBbsKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, GameDraft>>({});

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/scoreboard?year=${y}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load scoreboard');
      }
      const list = (json.data.games || []) as ScoreboardGame[];
      setGames(list);
      setSettings(json.data.settings);
      setBbsKeyConfigured(Boolean(json.data.bbsKeyConfigured));
      if (Array.isArray(json.data.availableYears) && json.data.availableYears.length) {
        setAvailableYears(
          (json.data.availableYears as number[]).slice().sort((a, b) => b - a),
        );
      }
      const nextDrafts: typeof drafts = {};
      for (const g of list) {
        nextDrafts[g.gameKey] = {
          score1: g.score1 != null ? String(g.score1) : '',
          score2: g.score2 != null ? String(g.score2) : '',
          winnerId: g.winnerId || '',
          status: g.status,
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAvailableYears((prev) => {
      const set = new Set([...prev, ...bracketYears]);
      return Array.from(set).sort((a, b) => b - a);
    });
  }, [bracketYears]);

  useEffect(() => {
    if (!year) return;
    void load(Number(year));
  }, [year, load]);

  useEffect(() => {
    if (!year && availableYears[0]) setYear(String(availableYears[0]));
  }, [availableYears, year]);

  /**
   * Save settings (kill switch / interval / season).
   */
  const saveSettings = async () => {
    if (!settings || !year) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/scoreboard', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getCSRFHeaders()),
        },
        body: JSON.stringify({
          year: Number(year),
          settings: {
            autoSyncEnabled: settings.autoSyncEnabled,
            pollIntervalMinutes: settings.pollIntervalMinutes,
            bbsSeason: settings.bbsSeason,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save settings');
      }
      setSettings(json.data.settings);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Mark one game final (or update scores) — updates KEY / FF + standings.
   */
  const saveGame = async (gameKey: string, markFinal: boolean) => {
    const draft = drafts[gameKey];
    if (!draft || !year) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const score1 =
        draft.score1.trim() === '' ? null : Number(draft.score1);
      const score2 =
        draft.score2.trim() === '' ? null : Number(draft.score2);
      if (
        (score1 != null && !Number.isFinite(score1)) ||
        (score2 != null && !Number.isFinite(score2))
      ) {
        throw new Error('Scores must be numbers');
      }
      const patch: Record<string, unknown> = {
        score1,
        score2,
        winnerId: draft.winnerId || null,
        status: markFinal ? 'final' : draft.status,
        adminLocked: true,
      };
      if (markFinal && !draft.winnerId) {
        throw new Error('Select a winner before marking Final');
      }
      const res = await fetch('/api/admin/scoreboard', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getCSRFHeaders()),
        },
        body: JSON.stringify({
          year: Number(year),
          gameKey,
          patch,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save game');
      }
      setGames(json.data.games);
      setSettings(json.data.settings);
      const apply = json.data.apply;
      setMessage(
        apply?.applied
          ? `Saved ${gameKey}. KEY/FF updated; standings ${apply.standingsOk ? 'refreshed' : 'refresh failed'}.`
          : `Saved ${gameKey}.${apply?.reason ? ` (${apply.reason})` : ''}`,
      );
      await load(Number(year));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Manual Big Balls sync.
   */
  const syncNow = async () => {
    if (!year) return;
    setSyncing(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/scoreboard/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getCSRFHeaders()),
        },
        body: JSON.stringify({ year: Number(year) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sync failed');
      }
      const s = json.data.summary;
      setGames(json.data.games);
      setSettings(json.data.settings);
      setMessage(
        `Sync season=${s.season}: seen=${s.seen ?? s.finishedSeen}, final=${s.finishedSeen}, live=${s.liveSeen ?? 0}, upcoming=${s.scheduledSeen ?? 0}, updated=${s.updated}, applied=${s.applied}, unmatched=${s.unmatched}, locked=${s.skippedLocked}` +
          (s.errors?.length ? ` · errors: ${s.errors.join('; ')}` : ''),
      );
      await load(Number(year));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const firstFour = games.filter((g) => g.kind === 'first_four');
  const bracketGames = games.filter((g) => g.kind === 'bracket');

  return (
    <div className="space-y-6" data-testid="admin-scoreboard-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-700" aria-hidden />
          <h2 className="text-lg font-semibold text-gray-900">
            Scoreboard of Record
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="scoreboard-year">
            Year
          </label>
          <select
            id="scoreboard-year"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            data-testid="admin-scoreboard-year"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Official results hub. Marking a game <strong>Final</strong> updates the
        KEY (or First Four results) and refreshes live standings. Auto-sync
        polls Big Balls when enabled; admin-locked rows are never overwritten by
        sync.
      </p>

      {settings ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
          data-testid="admin-scoreboard-settings"
        >
          <h3 className="text-sm font-semibold text-gray-800">Auto-sync</h3>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.autoSyncEnabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoSyncEnabled: e.target.checked,
                })
              }
              data-testid="admin-scoreboard-auto-sync"
            />
            <span>
              <strong>Enable auto-sync</strong> (kill switch). Off by default.
              Cron no-ops when disabled; manual Sync now still works.
            </span>
          </label>
          <div className="flex flex-wrap gap-4 items-end">
            <label className="text-sm text-gray-700">
              Poll interval (minutes)
              <input
                type="number"
                min={1}
                max={120}
                className="mt-1 block w-24 rounded border border-gray-300 px-2 py-1"
                value={settings.pollIntervalMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pollIntervalMinutes: Number(e.target.value) || 5,
                  })
                }
                data-testid="admin-scoreboard-poll-interval"
              />
            </label>
            <label className="text-sm text-gray-700">
              BBS season (blank = year − 1; March 2026 → 2025)
              <input
                type="text"
                className="mt-1 block w-28 rounded border border-gray-300 px-2 py-1"
                value={settings.bbsSeason ?? ''}
                placeholder={year ? String(Number(year) - 1) : ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bbsSeason: e.target.value.trim() || null,
                  })
                }
                data-testid="admin-scoreboard-bbs-season"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
              data-testid="admin-scoreboard-save-settings"
            >
              <Save className="h-4 w-4" aria-hidden />
              Save settings
            </button>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing || !bbsKeyConfigured}
              className="inline-flex items-center gap-1 rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
              title={
                bbsKeyConfigured
                  ? 'Pull finished games from Big Balls'
                  : 'Set API_KEY_BIGBALL on the server'
              }
              data-testid="admin-scoreboard-sync-now"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Sync now
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Last sync:{' '}
            {settings.lastSyncAt
              ? new Date(settings.lastSyncAt).toLocaleString()
              : 'never'}{' '}
            · {settings.lastSyncStatus || '—'}
            {settings.lastSyncError ? ` · ${settings.lastSyncError}` : ''}
            {!bbsKeyConfigured ? ' · API_KEY_BIGBALL not configured' : ''}
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-green-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-gray-600">Loading scoreboard…</p>
      ) : null}

      {!loading && firstFour.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            First Four
          </h3>
          <GameTable
            games={firstFour}
            drafts={drafts}
            setDrafts={setDrafts}
            onSave={saveGame}
            saving={saving}
          />
        </section>
      ) : null}

      {!loading ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Bracket games
          </h3>
          <GameTable
            games={bracketGames}
            drafts={drafts}
            setDrafts={setDrafts}
            onSave={saveGame}
            saving={saving}
          />
        </section>
      ) : null}
    </div>
  );
}

/**
 * Editable scoreboard game table.
 */
function GameTable({
  games,
  drafts,
  setDrafts,
  onSave,
  saving,
}: {
  games: ScoreboardGame[];
  drafts: Record<string, GameDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, GameDraft>>>;
  onSave: (gameKey: string, markFinal: boolean) => void;
  saving: boolean;
}) {
  if (games.length === 0) {
    return <p className="text-sm text-gray-500">No games seeded yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
          <tr>
            <th className="px-2 py-2">Round</th>
            <th className="px-2 py-2">Matchup</th>
            <th className="px-2 py-2">Score</th>
            <th className="px-2 py-2">Winner</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const d = drafts[g.gameKey] || {
              score1: '',
              score2: '',
              winnerId: '',
              status: g.status,
            };
            return (
              <tr
                key={g.gameKey}
                className="border-t border-gray-100"
                data-testid={`admin-scoreboard-row-${g.gameKey}`}
              >
                <td className="px-2 py-2 align-top whitespace-nowrap">
                  {g.roundLabel}
                  {g.region ? (
                    <span className="block text-xs text-gray-500">
                      {g.region}
                    </span>
                  ) : null}
                  {g.adminLocked ? (
                    <span className="mt-0.5 inline-block rounded bg-amber-100 px-1 text-[10px] text-amber-900">
                      admin locked
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2 align-top">
                  <div>
                    {g.seed1 != null ? `#${g.seed1} ` : ''}
                    {g.team1Name || g.team1Id || 'TBD'}
                  </div>
                  <div>
                    {g.seed2 != null ? `#${g.seed2} ` : ''}
                    {g.team2Name || g.team2Id || 'TBD'}
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  <div className="flex items-center gap-1">
                    <input
                      className="w-14 rounded border border-gray-300 px-1 py-0.5"
                      value={d.score1}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [g.gameKey]: { ...d, score1: e.target.value },
                        }))
                      }
                      aria-label={`${g.gameKey} score 1`}
                    />
                    <span>–</span>
                    <input
                      className="w-14 rounded border border-gray-300 px-1 py-0.5"
                      value={d.score2}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [g.gameKey]: { ...d, score2: e.target.value },
                        }))
                      }
                      aria-label={`${g.gameKey} score 2`}
                    />
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  <select
                    className="max-w-[10rem] rounded border border-gray-300 px-1 py-0.5"
                    value={d.winnerId}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [g.gameKey]: { ...d, winnerId: e.target.value },
                      }))
                    }
                    aria-label={`${g.gameKey} winner`}
                  >
                    <option value="">—</option>
                    {g.team1Id ? (
                      <option value={g.team1Id}>
                        {g.team1Name || g.team1Id}
                      </option>
                    ) : null}
                    {g.team2Id ? (
                      <option value={g.team2Id}>
                        {g.team2Name || g.team2Id}
                      </option>
                    ) : null}
                  </select>
                </td>
                <td className="px-2 py-2 align-top capitalize">{g.status}</td>
                <td className="px-2 py-2 align-top whitespace-nowrap">
                  <button
                    type="button"
                    className="mr-1 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => onSave(g.gameKey, false)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => onSave(g.gameKey, true)}
                  >
                    Mark Final
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
