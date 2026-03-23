'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CalendarDays, Radio } from 'lucide-react';
import StandingsTable from '@/components/StandingsTable';
import LiveStandingsPanel from '@/components/LiveStandingsPanel';
import { useCSRF } from '@/hooks/useCSRF';
import { isShowLiveStandingsEnabled } from '@/lib/standingsLiveFeature';
import type { StandingsViewPreference } from '@/lib/types/database';

const DEFAULT_LIVE_BUTTONS = 'Continue to live standings|Back to daily standings';

/**
 * Parse `live_standings_buttons`: left = accept Live, right = stay on daily.
 */
function parseLiveStandingsButtons(raw: string | undefined): [string, string] {
  if (!raw?.trim()) {
    return parseLiveStandingsButtons(DEFAULT_LIVE_BUTTONS);
  }
  const parts = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return [parts[0], parts[1]];
  }
  if (parts.length === 1) {
    return [parts[0], 'Back to daily standings'];
  }
  return parseLiveStandingsButtons(DEFAULT_LIVE_BUTTONS);
}

/** Render site text that uses `||` as line breaks (same convention as other config strings). */
function renderWarningMessage(message: string) {
  const parts = message.split('||');
  if (parts.length === 1) {
    return <>{message}</>;
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part.trim()}
          {index < parts.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Standings area: optional Daily vs Live toggle (when site config + session), server-persisted preference,
 * and Live disclaimer gate until the user accepts (button 1).
 */
export default function StandingsShell() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { fetchWithCSRF } = useCSRF();

  const [showLiveFlag, setShowLiveFlag] = useState<string | undefined>(undefined);
  const [standingsYearNum, setStandingsYearNum] = useState<number>(() => new Date().getFullYear());
  const [configLoaded, setConfigLoaded] = useState(false);
  const [liveStandingsWarningText, setLiveStandingsWarningText] = useState('');
  const [liveStandingsButtonsRaw, setLiveStandingsButtonsRaw] = useState<string | undefined>(undefined);

  const [viewMode, setViewMode] = useState<StandingsViewPreference>('daily');
  const [liveWarningAcknowledged, setLiveWarningAcknowledged] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);

  const isLiveRoute = pathname === '/standings/live';
  const featureOn = isShowLiveStandingsEnabled(showLiveFlag);
  const loggedIn = Boolean(session?.user?.email);
  const showToggle = featureOn && loggedIn && sessionStatus === 'authenticated';

  const displayMode: StandingsViewPreference = useMemo(() => {
    if (!featureOn || !loggedIn) return 'daily';
    return viewMode;
  }, [featureOn, loggedIn, viewMode]);

  const [acceptLabel, declineLabel] = useMemo(
    () => parseLiveStandingsButtons(liveStandingsButtonsRaw),
    [liveStandingsButtonsRaw]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/site-config', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setShowLiveFlag(json.data.showLiveStandings);
          const sy = json.data.standingsYear ?? json.data.tournamentYear;
          if (typeof sy === 'number' && sy >= 2000 && sy <= 2100) {
            setStandingsYearNum(sy);
          } else if (typeof sy === 'string' && /^\d{4}$/.test(sy.trim())) {
            setStandingsYearNum(parseInt(sy.trim(), 10));
          }
          if (typeof json.data.liveStandingsWarning === 'string' && json.data.liveStandingsWarning.trim()) {
            setLiveStandingsWarningText(json.data.liveStandingsWarning.trim());
          } else {
            setLiveStandingsWarningText('');
          }
          setLiveStandingsButtonsRaw(
            typeof json.data.liveStandingsButtons === 'string' ? json.data.liveStandingsButtons : undefined
          );
        }
      } catch {
        if (!cancelled) setShowLiveFlag(undefined);
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistMode = useCallback(
    async (mode: StandingsViewPreference, opts?: { acknowledgeLiveStandingsWarning?: boolean }) => {
      const body: { mode: StandingsViewPreference; acknowledgeLiveStandingsWarning?: boolean } = { mode };
      if (opts?.acknowledgeLiveStandingsWarning) {
        body.acknowledgeLiveStandingsWarning = true;
      }
      const res = await fetchWithCSRF('/api/user/standings-preference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to save preference');
      }
    },
    [fetchWithCSRF]
  );

  /**
   * Load server preference + disclaimer acknowledgment for logged-in users when the Live feature is on.
   */
  useEffect(() => {
    if (!configLoaded || sessionStatus === 'loading') {
      return;
    }

    if (!featureOn || sessionStatus === 'unauthenticated') {
      setPreferenceReady(true);
      return;
    }

    if (sessionStatus !== 'authenticated' || !session?.user?.email) {
      return;
    }

    let cancelled = false;
    setPreferenceReady(false);

    (async () => {
      try {
        const res = await fetch('/api/user/standings-preference', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;

        if (!json.success || !json.data) {
          setViewMode('daily');
          setLiveWarningAcknowledged(false);
          return;
        }

        const mode: StandingsViewPreference = json.data.mode === 'live' ? 'live' : 'daily';
        const ack = Boolean(json.data.liveStandingsWarningAcknowledged);
        setLiveWarningAcknowledged(ack);
        setViewMode(mode);

        if (isLiveRoute && ack && mode !== 'live') {
          try {
            await persistMode('live');
          } catch {
            /* still show live UI for this URL */
          }
          if (!cancelled) setViewMode('live');
        }
      } catch {
        if (!cancelled) {
          setViewMode('daily');
          setLiveWarningAcknowledged(false);
        }
      } finally {
        if (!cancelled) setPreferenceReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configLoaded, featureOn, isLiveRoute, persistMode, session?.user?.email, sessionStatus]);

  const showLiveStandingsGate =
    featureOn &&
    loggedIn &&
    preferenceReady &&
    isLiveRoute &&
    !liveWarningAcknowledged;

  const handleSelectMode = async (mode: StandingsViewPreference) => {
    if (!showToggle) return;
    // Do not persist `live` until the disclaimer is accepted (button 1); only navigate to the live URL.
    if (mode === 'live' && !liveWarningAcknowledged) {
      if (pathname !== '/standings/live') {
        router.replace('/standings/live');
      }
      return;
    }

    setViewMode(mode);
    try {
      await persistMode(mode);
    } catch (e) {
      console.error('[StandingsShell] Failed to persist mode', e);
    }
    if (mode === 'live' && pathname !== '/standings/live') {
      router.replace('/standings/live');
    }
    if (mode === 'daily' && pathname === '/standings/live') {
      router.replace('/standings');
    }
  };

  const handleLiveGateAccept = async () => {
    if (gateSubmitting) return;
    setGateSubmitting(true);
    try {
      await persistMode('live', { acknowledgeLiveStandingsWarning: true });
      setLiveWarningAcknowledged(true);
      setViewMode('live');
    } catch (e) {
      console.error('[StandingsShell] Live gate accept failed', e);
    } finally {
      setGateSubmitting(false);
    }
  };

  const handleLiveGateDecline = async () => {
    if (gateSubmitting) return;
    setGateSubmitting(true);
    try {
      await persistMode('daily');
      setViewMode('daily');
      router.replace('/standings');
    } catch (e) {
      console.error('[StandingsShell] Live gate decline failed', e);
    } finally {
      setGateSubmitting(false);
    }
  };

  const waitingForSession = sessionStatus === 'loading';
  const waitingForPreference = featureOn && sessionStatus === 'authenticated' && !preferenceReady;

  if (!configLoaded || waitingForSession || waitingForPreference) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-gray-600">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm">Loading standings…</p>
      </div>
    );
  }

  const liveToggleActive = pathname === '/standings/live' || viewMode === 'live';

  const viewModeToggle: ReactNode | undefined = showToggle ? (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 shadow-sm"
      role="group"
      aria-label="Standings view mode"
    >
      <button
        type="button"
        onClick={() => void handleSelectMode('daily')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3 ${
          !liveToggleActive ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">
          <span className="sm:hidden">Daily</span>
          <span className="hidden sm:inline">Daily standings</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => void handleSelectMode('live')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3 ${
          liveToggleActive ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Radio className="h-4 w-4 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">
          <span className="sm:hidden">Live</span>
          <span className="hidden sm:inline">Live standings</span>
        </span>
      </button>
    </div>
  ) : undefined;

  const warningCopy =
    liveStandingsWarningText.trim() ||
    'Live standings compare submitted picks to the official KEY bracket. Rankings can change as games complete.||If you continue, your preference will be saved as Live standings.';

  return (
    <>
      {showLiveStandingsGate ? (
        <div className="rounded-lg bg-white shadow-lg">
          <div className="border-b border-gray-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Live standings</h2>
                {viewModeToggle ? <div className="flex shrink-0 items-center">{viewModeToggle}</div> : null}
              </div>
            </div>
          </div>
          <div
            className="border-b border-amber-200 bg-amber-50 p-6"
            role="dialog"
            aria-labelledby="live-standings-warning-title"
            data-testid="live-standings-warning-gate"
          >
            <h3 id="live-standings-warning-title" className="sr-only">
              Live standings notice
            </h3>
            <p className="text-sm leading-relaxed text-gray-800">{renderWarningMessage(warningCopy)}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleLiveGateAccept()}
                disabled={gateSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="live-standings-warning-accept"
              >
                {gateSubmitting ? 'Saving…' : acceptLabel}
              </button>
              <button
                type="button"
                onClick={() => void handleLiveGateDecline()}
                disabled={gateSubmitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="live-standings-warning-decline"
              >
                {declineLabel}
              </button>
            </div>
          </div>
        </div>
      ) : displayMode === 'live' ? (
        <div className="rounded-lg bg-white shadow-lg">
          <div className="border-b border-gray-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Live standings</h2>
                {viewModeToggle ? <div className="flex shrink-0 items-center">{viewModeToggle}</div> : null}
              </div>
            </div>
          </div>
          <LiveStandingsPanel standingsYear={standingsYearNum} />
        </div>
      ) : (
        <StandingsTable viewModeToggle={viewModeToggle} />
      )}
    </>
  );
}
