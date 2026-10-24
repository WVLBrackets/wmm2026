'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Press_Start_2P } from 'next/font/google';
import { Trophy, Plus, Edit, Clock, CheckCircle, LogOut, Trash2, Copy, Eye, Info, X, Mail, RotateCcw, Undo2, Search, Pencil, Send, DollarSign, ChevronDown } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useCSRF } from '@/hooks/useCSRF';
import { TournamentData, TournamentBracket } from '@/types/tournament';
import { SiteConfigData } from '@/lib/siteConfig';
import {
  computeCanProceedToSubmit,
  getBracketSubmitReadinessHint,
  isSubmitDuplicateEntryName,
} from '@/lib/bracketSubmitReadiness';
import { LoggedButton } from '@/components/LoggedButton';
import { useServerTime } from '@/hooks/useServerTime';
import PaymentModal from '@/components/bracket/PaymentModal';
import {
  evaluatePicksAccess,
  formatPriorYearWarningMessage,
  isBracketsAvailableFlag,
  type PicksAccessResult,
} from '@/lib/services/picksAccessPolicy';
import {
  evaluateVintageActionLock,
  formatVintagePriorYearMessage,
} from '@/lib/services/vintageActionLock';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { useIsMdUp } from '@/hooks/useIsMdUp';
import {
  DEFAULT_VINTAGE_PICKS_CONTENT,
  formatVintagePicksLabel,
  vintagePicksChromeCssVars,
  type VintagePicksContent,
} from '@/lib/vintage/picksContent';
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  standingsResultChromeStyle,
  type VintageStandingsContent,
} from '@/lib/vintage/standingsContent';
import {
  emptyPickResultKeyContext,
  resolvePickResultTone,
  type PickResultKeyContext,
} from '@/lib/pickResultChrome';
import PicksEditGear from '@/components/vintage/picks/PicksEditGear';
import './vintage/picks/picks.css';

const scoreboardFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
});

export interface Bracket {
  id: string;
  playerName: string;
  playerEmail: string;
  entryName?: string;
  tieBreaker?: string;
  /** Last row modification (ISO); present from API for all statuses. */
  updatedAt?: string;
  submittedAt?: string;
  lastSaved?: string;
  picks: { [gameId: string]: string };
  status: 'in_progress' | 'submitted' | 'deleted';
  totalPoints?: number;
  year?: number;
  /** Payment tracking: null/undefined (unpaid), 'pending', or 'paid'. */
  paymentStatus?: string | null;
}

/** Which bracket statuses appear in the My Picks table (user-controlled). */
type BracketStatusVisibility = {
  submitted: boolean;
  in_progress: boolean;
  deleted: boolean;
};

const DEFAULT_STATUS_VISIBILITY: BracketStatusVisibility = {
  submitted: true,
  in_progress: true,
  deleted: true,
};

const BRACKET_STATUS_FILTER_STORAGE_PREFIX = 'wmm2026.myPicks.bracketStatusFilters:';

/** localStorage key for My Picks status chips, scoped per user id. */
function bracketStatusFilterStorageKey(userId: string): string {
  return `${BRACKET_STATUS_FILTER_STORAGE_PREFIX}${userId}`;
}

/**
 * Reads and validates stored bracket status filter toggles for the signed-in user.
 */
function readBracketStatusVisibilityFromStorage(userId: string): BracketStatusVisibility | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(bracketStatusFilterStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.submitted !== 'boolean' ||
      typeof o.in_progress !== 'boolean' ||
      typeof o.deleted !== 'boolean'
    ) {
      return null;
    }
    return {
      submitted: o.submitted,
      in_progress: o.in_progress,
      deleted: o.deleted,
    };
  } catch {
    return null;
  }
}

/**
 * Persists bracket status filters for the given user (best-effort; ignores quota / private mode errors).
 */
function writeBracketStatusVisibilityToStorage(userId: string, value: BracketStatusVisibility): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(bracketStatusFilterStorageKey(userId), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/**
 * Splits an entry label for narrow mobile display: after 10 characters, break at the next space;
 * if 12 characters pass with no space, hard-break at 12. Desktop uses the raw string instead.
 */
function computeMyPicksEntryNameMobileLines(text: string): string[] {
  if (text === '') return [''];
  const lines: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && text[i] === ' ') i++;
    if (i >= n) break;
    const rest = text.slice(i);
    if (rest.length <= 12) {
      lines.push(rest);
      break;
    }
    const first12 = rest.slice(0, 12);
    if (!first12.includes(' ')) {
      lines.push(first12);
      i += 12;
      continue;
    }
    let brk = -1;
    for (let j = 10; j < rest.length; j++) {
      if (rest[j] === ' ') {
        brk = j;
        break;
      }
    }
    if (brk !== -1) {
      lines.push(rest.slice(0, brk));
      i += brk + 1;
      continue;
    }
    lines.push(rest.slice(0, 12));
    i += 12;
  }
  return lines.length > 0 ? lines : [text];
}

/**
 * Whether a bracket matches the entry search (entry name, 6-digit display ID, and optionally raw DB id).
 *
 * For queries that are **digits only** (e.g. `54`, `000547`), we only match entry name and the
 * zero-padded `bracketNumber`. We intentionally do **not** match `bracket.id` in that case: MongoDB
 * ObjectIds are hex strings where substrings like `54` appear often and are unrelated to the
 * human-visible bracket ID.
 */
function bracketMatchesEntrySearch(bracket: Bracket, queryLower: string): boolean {
  if (!queryLower) return true;
  const entry = (bracket.entryName || '').toLowerCase();
  if (entry.includes(queryLower)) return true;
  const data = bracket as unknown as Record<string, unknown>;
  const num = data.bracketNumber as number | undefined;
  const idStr = String(bracket.id).toLowerCase();
  const digits = queryLower.replace(/\D/g, '');
  const digitsOnlyQuery = /^\d+$/.test(queryLower);

  if (digits.length > 0 && num !== undefined && num !== null) {
    const padded = String(num).padStart(6, '0');
    if (padded.includes(digits)) return true;
  }

  if (digitsOnlyQuery) {
    return false;
  }

  if (idStr.includes(queryLower)) return true;
  return false;
}

/**
 * Parses `pool_header_font_size`: two positive integers separated by `|`, e.g. `14|12`.
 * First = font/icon size for header and message on desktop (`md` and up); second = same on mobile.
 */
function parsePoolHeaderFontSizes(raw: string | undefined): { desktopPx: number; mobilePx: number } {
  const defaults = { desktopPx: 14, mobilePx: 12 };
  if (!raw?.trim()) return defaults;

  const parts = raw
    .trim()
    .split('|')
    .map((s) => parseInt(s.trim(), 10));
  const desktopPx = parts[0];
  const mobilePx = parts[1];

  return {
    desktopPx: !Number.isNaN(desktopPx) && desktopPx > 0 ? desktopPx : defaults.desktopPx,
    mobilePx: !Number.isNaN(mobilePx) && mobilePx > 0 ? mobilePx : defaults.mobilePx,
  };
}

/**
 * Expands `in_the_pool_message` placeholders: each `{X}` becomes
 * `"{count} submitted entry"` (when count is 1) or `"{count} submitted entries"` otherwise.
 * If `template` does not contain `{X}`, it is returned unchanged.
 *
 * @param template - Raw message from site config (may include `{X}`).
 * @param submittedCount - Number of submitted brackets for the current user (same scope as the list).
 */
function formatInThePoolMessage(template: string, submittedCount: number): string {
  if (!template.includes('{X}')) {
    return template;
  }
  const phrase = submittedCount === 1 ? 'submitted entry' : 'submitted entries';
  const replacement = `${submittedCount} ${phrase}`;
  return template.split('{X}').join(replacement);
}

interface MyPicksLandingProps {
  /** Visual treatment: `legacy` (default) keeps the blue/white UI; `vintage` uses the cream/navy editorial layout. */
  variant?: 'legacy' | 'vintage';
  /** Published My Picks CMS copy (timer, flavors for header/pool/empty). */
  picksCopy?: VintagePicksContent;
  /**
   * Published Standings CMS — shared FF/Champ result chrome (colors, sizes, border width).
   */
  standingsChrome?: VintageStandingsContent;
  /**
   * Homepage Tourney Tipoff ISO (`tournament.tipoffAt`).
   * Vintage only — no Config Sheet datetime.
   */
  tipoffAt?: string;
  /**
   * Homepage Brackets Ready ISO (`tournament.bracketsReadyAt`, Selection Sunday).
   * Vintage My Picks countdown target before brackets are published.
   */
  bracketsReadyAt?: string;
  /** Homepage live-tourney message — shown on My Picks after tipoff. */
  liveTourneyMessage?: string;
  /** When true, show admin edit gear on the vintage landing. */
  admin?: boolean;
  brackets?: Bracket[];
  onCreateNew: () => void;
  onEditBracket: (bracket: Bracket) => void;
  onDeleteBracket: (bracketId: string) => void;
  onCopyBracket: (bracket: Bracket) => void;
  /** Submit an in-progress bracket from the list (same validation as in-editor Submit). */
  onSubmitBracket: (bracket: Bracket) => void | Promise<void>;
  /** While set, the matching row’s Submit control shows a busy state. */
  submittingBracketId?: string | null;
  onRestoreBracket?: (bracketId: string) => void;
  onPermanentDeleteClick?: (bracketId: string) => void;
  deletingBracketId?: string | null;
  pendingDeleteBracketId?: string | null;
  onConfirmDelete?: (bracketId: string) => void;
  onCancelDelete?: () => void;
  pendingPermanentDeleteBracketId?: string | null;
  onConfirmPermanentDelete?: (bracketId: string) => void;
  onCancelPermanentDelete?: () => void;
  pendingReturnBracketId?: string | null;
  onReturnBracketClick?: (bracketId: string) => void;
  onConfirmReturnBracket?: (bracketId: string) => void;
  onCancelReturnBracket?: () => void;
  returningBracketId?: string | null;
  tournamentData?: TournamentData | null;
  bracket?: TournamentBracket | null;
  siteConfig?: SiteConfigData | null;
  killSwitchEnabled?: boolean;
  killSwitchMessage?: string;
  /** Year currently displayed (from `?year=` or active year). */
  viewingYear?: number;
  /** Active tournament year from site config (only this year accepts mutations). */
  activeYear?: number;
  /** Years available in the switcher (user brackets ∪ active year). */
  availableYears?: number[];
  /** Switch My Picks viewing year (parent updates URL). */
  onViewingYearChange?: (year: number) => void;
  /** Soft year switch in progress — keep landing mounted; dim list + disable year select. */
  isYearSwitching?: boolean;
  /** Eye icon: open full-bracket modal when set; otherwise falls back to print tab. */
  onOpenFullBracketModal?: (bracket: Bracket) => void;
  /** Called after a Venmo payment request is recorded so the parent can refresh the bracket list. */
  onPaymentCreated?: () => void;
}

/**
 * Small team logo for My Picks Final Four / Champ cells.
 * Module-scoped so parent re-renders (e.g. per-second countdown) do not remount {@link Image} and flash on mobile.
 */
const FinalFourLogo = React.memo(function FinalFourLogo({
  logoPath,
  teamName = null,
}: {
  logoPath: string | null;
  /** Team name for the image alt text when known. */
  teamName?: string | null;
}) {
  const [imageError, setImageError] = React.useState(false);

  if (!logoPath || imageError) {
    return <span className="text-gray-400 text-xs">?</span>;
  }

  return (
    <Image
      src={logoPath}
      alt={teamName ? `${teamName} logo` : 'Team logo'}
      width={24}
      height={24}
      className="max-h-[22px] max-w-[22px] object-contain"
      onError={() => setImageError(true)}
      unoptimized
    />
  );
});

export default function MyPicksLanding({
  variant = 'legacy',
  picksCopy = DEFAULT_VINTAGE_PICKS_CONTENT,
  standingsChrome = DEFAULT_VINTAGE_STANDINGS_CONTENT,
  tipoffAt = '',
  bracketsReadyAt = '',
  liveTourneyMessage = 'The tournament is underway!',
  admin = false,
  brackets = [],
  onCreateNew,
  onEditBracket,
  onDeleteBracket,
  onCopyBracket,
  onSubmitBracket,
  submittingBracketId = null,
  onRestoreBracket,
  onPermanentDeleteClick,
  deletingBracketId,
  pendingDeleteBracketId,
  onConfirmDelete,
  onCancelDelete,
  pendingPermanentDeleteBracketId,
  onConfirmPermanentDelete,
  onCancelPermanentDelete,
  pendingReturnBracketId,
  onReturnBracketClick,
  onConfirmReturnBracket,
  onCancelReturnBracket,
  returningBracketId,
  tournamentData,
  bracket: emptyBracketTemplate = null,
  siteConfig,
  killSwitchEnabled = true,
  killSwitchMessage,
  viewingYear: viewingYearProp,
  activeYear: activeYearProp,
  availableYears = [],
  onViewingYearChange,
  isYearSwitching = false,
  onOpenFullBracketModal,
  onPaymentCreated,
}: MyPicksLandingProps) {
  const { data: session, update: updateSession } = useSession();
  const { fetchWithCSRF } = useCSRF();
  const [expandedStatus, setExpandedStatus] = useState<'info' | null>(null);
  /** In-pool / out-of-pool table section: optional detail shown after clicking the info icon. */
  const [poolBannerExpanded, setPoolBannerExpanded] = useState<'in-pool' | 'out-pool' | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailBracket, setEmailBracket] = useState<Bracket | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{
    email: string;
    createdAt: string;
    tournamentsPlayed: number;
    bracketsEntered: number;
  } | null>(null);
  const { getServerNowMs } = useServerTime();
  const isVintage = variant === 'vintage';
  /** Vintage layout renders only the matching breakpoint so test ids stay unique. */
  const isMdUp = useIsMdUp();
  const viewportSuffix: 'desktop' | 'mobile' = isMdUp ? 'desktop' : 'mobile';
  /** KEY-derived chrome for FF / Champ (shared with Standings). */
  const [resultKeyContext, setResultKeyContext] = useState<PickResultKeyContext>(
    () => emptyPickResultKeyContext(),
  );

  // Active year from config; viewing year from parent URL / props
  const activeYear =
    activeYearProp ??
    (siteConfig?.tournamentYear
      ? parseInt(String(siteConfig.tournamentYear), 10)
      : tournamentData?.year
        ? parseInt(String(tournamentData.year), 10)
        : new Date().getFullYear());
  const viewingYear = viewingYearProp ?? activeYear;
  const isHistoricalView = viewingYear !== activeYear;
  const historicalReadOnlyMessage = `Brackets from ${viewingYear} are read-only. Switch to ${activeYear} to create or edit.`;

  /**
   * Load KEY regional / semi / champ winners + eliminated list for result chrome.
   */
  useEffect(() => {
    if (!isVintage) {
      setResultKeyContext(emptyPickResultKeyContext());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/live-standings?year=${encodeURIComponent(String(viewingYear))}`,
          { cache: 'no-store' },
        );
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.available || !json.standingsData) {
          setResultKeyContext(emptyPickResultKeyContext());
          return;
        }
        const data = json.standingsData as {
          regionalChampionKey?: [string, string, string, string];
          semifinalKey?: [string, string];
          finalWinner?: string;
          eliminatedTeams?: string[];
        };
        setResultKeyContext({
          regionalChampionKey: data.regionalChampionKey ?? ['', '', '', ''],
          semifinalKey: data.semifinalKey ?? ['', ''],
          finalWinner: data.finalWinner ?? '',
          eliminatedTeams: data.eliminatedTeams ?? [],
        });
      } catch {
        if (!cancelled) setResultKeyContext(emptyPickResultKeyContext());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVintage, viewingYear]);

  /** Current vs historic editorial flavor for vintage landing copy. */
  const picksFlavor = isHistoricalView
    ? picksCopy.flavors.historic
    : picksCopy.flavors.current;
  const picksTokenVars = { year: viewingYear, activeYear };

  const priorYearBannerMessage = useMemo(
    () =>
      isVintage
        ? formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear)
        : formatPriorYearWarningMessage(
            siteConfig?.priorYearWarningMessage,
            viewingYear,
            activeYear,
          ),
    [
      isVintage,
      picksCopy,
      siteConfig?.priorYearWarningMessage,
      viewingYear,
      activeYear,
    ],
  );

  /**
   * Unified Changing-action gate.
   * Vintage: Action Lock master reference (no Config Sheet stop_submit).
   * Legacy: Config Sheet evaluatePicksAccess.
   */
  const picksAccess = useMemo((): PicksAccessResult => {
    if (isVintage) {
      const lock = evaluateVintageActionLock({
        action: 'changing',
        bracketYear: viewingYear,
        activeYear,
        picksCopy,
        tipoffAt,
        bracketsReadyAt,
        tournamentJsonPresent: Boolean(tournamentData),
        nowMs: getServerNowMs(),
      });
      return {
        blocked: lock.blocked,
        reasonCode: lock.reasonCode,
        message: lock.message,
      };
    }
    if (isHistoricalView) {
      return {
        blocked: true,
        reasonCode: 'prior_year',
        message: historicalReadOnlyMessage,
      };
    }
    return evaluatePicksAccess(siteConfig, {
      tournamentJsonPresent: Boolean(tournamentData),
      masterLockUnlocked: killSwitchEnabled,
    });
  }, [
    isVintage,
    picksCopy,
    tipoffAt,
    bracketsReadyAt,
    activeYear,
    viewingYear,
    isHistoricalView,
    historicalReadOnlyMessage,
    siteConfig,
    tournamentData,
    killSwitchEnabled,
    getServerNowMs,
  ]);

  const accessBlockMessage =
    picksAccess.message ||
    (isVintage
      ? formatVintagePicksLabel(picksCopy.masterLockMessage, { year: activeYear })
      : killSwitchMessage || siteConfig?.masterLockMessage) ||
    FALLBACK_CONFIG.masterLockMessage ||
    'Bracket actions are temporarily locked by the administrator.';

  const accessMessageClassName =
    picksAccess.reasonCode === 'brackets_missing_json' ||
    picksAccess.reasonCode === 'master_lock'
      ? 'text-sm text-red-600 mt-1 font-medium'
      : 'text-sm text-amber-800 mt-1 font-medium';

  /** Changing actions blocked (View / Print / Email remain available). */
  const mutationsBlocked = picksAccess.blocked;

  /** All brackets for the viewing year (parent usually pre-filters; keep a safety filter). */
  const bracketsForYear = useMemo(
    () =>
      brackets.filter(
        (b) => b.year === viewingYear || (!b.year && viewingYear === new Date().getFullYear())
      ),
    [brackets, viewingYear]
  );

  /** Not-available copy belongs in the empty-state panel (active year only). */
  const showNotAvailableInEmptyState =
    !isHistoricalView &&
    picksAccess.reasonCode === 'brackets_not_available' &&
    bracketsForYear.length === 0;

  const showHeaderAccessMessage =
    mutationsBlocked && !showNotAvailableInEmptyState && !isHistoricalView;

  const yearOptions = useMemo(() => {
    const set = new Set<number>(availableYears.length > 0 ? availableYears : [activeYear]);
    set.add(activeYear);
    set.add(viewingYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, activeYear, viewingYear]);

  const unpaidSubmittedBrackets = useMemo(
    () => bracketsForYear.filter((b) => b.status === 'submitted' && !b.paymentStatus),
    [bracketsForYear]
  );

  const entryCost = isVintage ? picksCopy.entryCost : (siteConfig?.entryCost ?? 5);
  const venmoUser = siteConfig?.venmoUser;
  const payCapabilityEnabled = siteConfig?.enablePayCapability?.toUpperCase() === 'YES';

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/check-admin')
      .then((r) => r.json())
      .then((d) => setIsCurrentUserAdmin(d.isAdmin || false))
      .catch(() => setIsCurrentUserAdmin(false));
  }, [session?.user?.email]);

  const showPayButton =
    !isHistoricalView &&
    venmoUser &&
    unpaidSubmittedBrackets.length > 0 &&
    (payCapabilityEnabled || isCurrentUserAdmin);

  const [statusVisibility, setStatusVisibility] = useState<BracketStatusVisibility>(DEFAULT_STATUS_VISIBILITY);
  const [entrySearchQuery, setEntrySearchQuery] = useState('');

  /** Restore filters from localStorage when the session user is known (per-user key). */
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || typeof window === 'undefined') return;
    const stored = readBracketStatusVisibilityFromStorage(uid);
    if (stored) {
      setStatusVisibility(stored);
    }
  }, [session?.user?.id]);

  /**
   * Updates status filters and persists to localStorage for the current user.
   */
  const updateStatusVisibility = useCallback(
    (update: BracketStatusVisibility | ((prev: BracketStatusVisibility) => BracketStatusVisibility)) => {
      setStatusVisibility((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        const uid = session?.user?.id;
        if (uid && typeof window !== 'undefined') {
          writeBracketStatusVisibilityToStorage(uid, next);
        }
        return next;
      });
    },
    [session?.user?.id]
  );

  /** Rows shown in the table after status toggles and search. */
  const filteredDisplayBrackets = useMemo(() => {
    const q = entrySearchQuery.trim().toLowerCase();
    let list = bracketsForYear.filter((b) => {
      if (b.status === 'submitted') return statusVisibility.submitted;
      if (b.status === 'in_progress') return statusVisibility.in_progress;
      return statusVisibility.deleted;
    });
    if (q) {
      list = list.filter((b) => bracketMatchesEntrySearch(b, q));
    }
    return list;
  }, [bracketsForYear, statusVisibility, entrySearchQuery]);

  const allStatusFiltersOn =
    statusVisibility.submitted && statusVisibility.in_progress && statusVisibility.deleted;

  // Calculate bracket progress (number of picks out of 63)
  const calculateProgress = (picks: { [gameId: string]: string }) => {
    const totalGames = 63;
    const completedPicks = Object.keys(picks).filter(key => picks[key] && picks[key] !== '').length;
    return { completed: completedPicks, total: totalGames, percentage: (completedPicks / totalGames) * 100 };
  };

  // Helper function to find team by ID in tournament data and return the logo
  const findTeamLogoById = (teamId: string | null): string | null => {
    if (!teamId || !tournamentData) return null;
    
    // Search through all regions to find the team
    for (const region of tournamentData.regions) {
      const team = region.teams.find(t => t.id === teamId);
      if (team) {
        return team.logo; // Return the logo path directly from team object
      }
    }
    return null;
  };

  /** Looks up a team display name by id (for logo alt text); null when unknown. */
  const findTeamNameById = (teamId: string | null): string | null => {
    if (!teamId || !tournamentData) return null;
    for (const region of tournamentData.regions) {
      const team = region.teams.find((t) => t.id === teamId);
      if (team) return team.name || null;
    }
    return null;
  };

  // Get Final Four teams from picks
  const getFinalFourTeams = (picks: { [gameId: string]: string }) => {
    // The Final Four consists of the 4 Elite Eight winners who compete in final-four-1 and final-four-2
    // We need to find the winners of each region's Elite Eight game
    
    // Get the team IDs from picks
    const topLeftId = picks['Top Left-e8-1'] || null;
    const bottomLeftId = picks['Bottom Left-e8-1'] || null;
    const topRightId = picks['Top Right-e8-1'] || null;
    const bottomRightId = picks['Bottom Right-e8-1'] || null;
    
    // Get the finalists (winners of Final Four games)
    const finalist1Id = picks['final-four-1'] || null;
    const finalist2Id = picks['final-four-2'] || null;
    
    // Get the champion (winner of championship game)
    const championId = picks['championship'] || null;
    
    // Convert team IDs to logo paths
    const finalFour = {
      topLeft: findTeamLogoById(topLeftId),
      bottomLeft: findTeamLogoById(bottomLeftId),
      topRight: findTeamLogoById(topRightId),
      bottomRight: findTeamLogoById(bottomRightId),
      finalist1: findTeamLogoById(finalist1Id),
      finalist2: findTeamLogoById(finalist2Id),
      champion: findTeamLogoById(championId),
      topLeftName: findTeamNameById(topLeftId),
      bottomLeftName: findTeamNameById(bottomLeftId),
      topRightName: findTeamNameById(topRightId),
      bottomRightName: findTeamNameById(bottomRightId),
      championName: findTeamNameById(championId),
      // Store IDs to check which teams are finalists
      finalist1Id,
      finalist2Id,
      championId,
      topLeftId,
      bottomLeftId,
      topRightId,
      bottomRightId
    };

    return finalFour;
  };

  const handlePrintBracket = (bracket: Bracket) => {
    // Store bracket data in session storage for security
    sessionStorage.setItem('printBracketData', JSON.stringify(bracket));
    // Navigate to the print page (no URL parameters)
    window.open('/print-bracket', '_blank');
  };

  const handleEyeOpenFullBracketOrPrint = (bracket: Bracket) => {
    if (onOpenFullBracketModal) {
      onOpenFullBracketModal(bracket);
      return;
    }
    handlePrintBracket(bracket);
  };

  const handleEmailBracket = (bracket: Bracket) => {
    if (bracket.status !== 'submitted') {
      return; // Only allow emailing submitted brackets
    }
    setEmailBracket(bracket);
    setEmailDialogOpen(true);
  };

  const confirmEmailBracket = async () => {
    if (!emailBracket || !session?.user?.email) {
      return;
    }

    setIsSendingEmail(true);
    setEmailMessage(null);

    try {
      const response = await fetch('/api/bracket/email-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bracketId: emailBracket.id,
          siteConfig: siteConfig, // Pass the already-loaded config to avoid re-fetching
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailMessage({ type: 'success', text: 'Email sent successfully! Check your inbox for your bracket PDF.' });
        setEmailDialogOpen(false);
        setTimeout(() => setEmailMessage(null), 5000);
      } else {
        // Show detailed error message if available (staging/development)
        const errorText = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to send email. Please try again.';
        setEmailMessage({ type: 'error', text: errorText });
        console.error('Email error details:', data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setEmailMessage({ type: 'error', text: `An error occurred: ${errorMessage}` });
      console.error('Email error:', error);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'submitted') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (status === 'deleted') {
      return <Trash2 className="h-5 w-5 text-gray-500" />;
    }
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = (status: string) => {
    if (status === 'submitted') return 'Submitted';
    if (status === 'deleted') return 'Deleted';
    return 'In Progress';
  };

  const getStatusColor = (status: string) => {
    if (status === 'submitted') return 'bg-green-100 text-green-800';
    if (status === 'deleted') return 'bg-gray-200 text-gray-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  /**
   * Progress bar fill color aligned with row status (avoids implying “submitted” when still in progress).
   */
  const getProgressBarFillClass = (status: string) => {
    if (status === 'submitted') return 'bg-green-600';
    if (status === 'deleted') return 'bg-gray-500';
    return 'bg-yellow-500';
  };

  // Get first name from full name
  const getFirstName = (fullName: string | null | undefined) => {
    if (!fullName) return 'User';
    return fullName.split(' ')[0];
  };

  // Calculate submitted and in-progress brackets count
  const getBracketsInfo = () => {
    const submittedCount = bracketsForYear.filter((bracket) => bracket.status === 'submitted').length;
    const inProgressCount = bracketsForYear.filter((bracket) => bracket.status === 'in_progress').length;
    const deletedCount = bracketsForYear.filter((bracket) => bracket.status === 'deleted').length;
    const entryCost = isVintage
      ? picksCopy.entryCost
      : siteConfig?.entryCost || 5;
    const totalCost = submittedCount * entryCost;
    return { submittedCount, inProgressCount, deletedCount, totalCost, entryCost };
  };

  /**
   * Header status copy based on bracket counts.
   * Vintage: My Picks CMS flavor cost lines (no Config Sheet welcome_*).
   * Legacy: sheet welcome_* keys.
   * Returns null when New Bracket is disabled and the user has no entries — avoid
   * prompting them to click a disabled control.
   */
  const getDynamicMessage = (): string | null => {
    const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();

    let message = '';

    if (isVintage) {
      if (submittedCount === 0 && inProgressCount === 0) {
        if (mutationsBlocked) return null;
        message = picksFlavor.costNoBrackets;
      } else if (submittedCount > 0 && inProgressCount === 0) {
        message = picksFlavor.costNoInProgress;
      } else if (submittedCount === 0 && inProgressCount > 0) {
        message = picksFlavor.costNoSubmitted;
      } else {
        message = picksFlavor.costBoth;
      }
    } else if (submittedCount === 0 && inProgressCount === 0) {
      if (mutationsBlocked) return null;
      message = siteConfig?.welcomeNoBrackets || 'Click New Bracket to start your first entry';
    } else if (submittedCount > 0 && inProgressCount === 0) {
      message =
        siteConfig?.welcomeNoInProgress ||
        `Your total cost so far is $${totalCost}. You can create a new entry and save it for later without submitting it now.`;
    } else if (submittedCount === 0 && inProgressCount > 0) {
      message =
        siteConfig?.welcomeNoSubmitted ||
        'You have not submitted any brackets yet. Please complete and submit your bracket(s) to be included in the contest.';
    } else {
      message =
        siteConfig?.welcomeYourBrackets ||
        `Your total cost so far is $${totalCost}. In Progress brackets are not included in the contest until submitted.`;
    }

    return formatVintagePicksLabel(message, picksTokenVars)
      .replace(/{Submitted}/g, submittedCount.toString())
      .replace(/{In Progress}/g, inProgressCount.toString())
      .replace(/{cost}/g, totalCost.toString());
  };

  const dynamicMessage = getDynamicMessage();

  // Helper function to render messages with line breaks (using || as delimiter)
  const renderMessageWithLineBreaks = (message: string) => {
    // Split by || delimiter and render each part
    const parts = message.split('||');
    
    if (parts.length === 1) {
      // No line breaks, return as single element
      return <>{message}</>;
    }
    
    // Render with line breaks
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && <br />}
          </React.Fragment>
        ))}
      </>
    );
  };

  /**
   * Primary row open from entry name or status chip: read-only full-bracket modal when available
   * (same as the eye icon) for submitted/deleted; in-progress opens the editor while entries are
   * still accepted, otherwise the modal; print layout is only from the modal’s Print View button.
   */
  const openBracketFromLandingRow = (bracket: Bracket) => {
    if (bracket.status === 'submitted' || bracket.status === 'deleted') {
      if (onOpenFullBracketModal) {
        onOpenFullBracketModal(bracket);
      } else {
        handlePrintBracket(bracket);
      }
      return;
    }
    if (bracket.status === 'in_progress') {
      if (mutationsBlocked) {
        if (onOpenFullBracketModal) {
          onOpenFullBracketModal(bracket);
        } else {
          handlePrintBracket(bracket);
        }
        return;
      }
      onEditBracket(bracket);
    }
  };

  /**
   * Target datetime for the My Picks countdown scoreboard.
   * Vintage: homepage Brackets Ready (pre-publish) or Tourney Tipoff (published).
   * Legacy: Config Sheet brackets_available_date_time / tournament_start_date.
   */
  const countdownTargetRaw = useMemo(() => {
    if (isVintage) {
      if (!picksCopy.bracketsPublished) {
        return bracketsReadyAt.trim();
      }
      return tipoffAt.trim();
    }
    if (!isBracketsAvailableFlag(siteConfig)) {
      return siteConfig?.bracketsAvailableDateTime?.trim() || '';
    }
    return siteConfig?.tournamentStartDate?.trim() || '';
  }, [
    isVintage,
    picksCopy.bracketsPublished,
    bracketsReadyAt,
    tipoffAt,
    siteConfig?.bracketsAvailable,
    siteConfig?.bracketsAvailableDateTime,
    siteConfig?.tournamentStartDate,
  ]);

  /** Vintage: tipoff has arrived (active tournament) — swap timer for live message. */
  const vintageTourneyLive = useMemo(() => {
    if (!isVintage || !picksCopy.bracketsPublished) return false;
    const tip = Date.parse(tipoffAt);
    if (!Number.isFinite(tip)) return false;
    if (countdownMs !== null && countdownTargetRaw === tipoffAt.trim()) {
      return countdownMs <= 0;
    }
    return getServerNowMs() >= tip;
  }, [
    isVintage,
    picksCopy.bracketsPublished,
    tipoffAt,
    countdownMs,
    countdownTargetRaw,
    getServerNowMs,
  ]);

  /**
   * Convert a millisecond duration into HH:MM:SS or MM:SS.
   * Switches to MM:SS once remaining time is under one hour.
   * For long horizons (>100 hours): vintage uses “N days to go”; legacy uses sheet templates.
   *
   * @param useMobileDaysTemplate When true and the “X days away” branch applies, use `countdownTimerMessageMobile` (fallback: desktop message).
   */
  const formatCountdown = (remainingMs: number, useMobileDaysTemplate = false) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 100) {
      const daysAway = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      if (isVintage) {
        return `${daysAway} day${daysAway === 1 ? '' : 's'} to go`;
      }
      const desktopTemplate = siteConfig?.countdownTimerMessage?.trim() || 'X Days Away';
      const mobileTemplate =
        siteConfig?.countdownTimerMessageMobile?.trim() || desktopTemplate;
      const template = useMobileDaysTemplate ? mobileTemplate : desktopTemplate;
      return template.replace(/X/g, String(daysAway));
    }

    if (hours < 1) {
      return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    }

    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  };

  React.useEffect(() => {
    if (!countdownTargetRaw) {
      setCountdownMs(null);
      return;
    }

    const deadline = new Date(countdownTargetRaw);
    if (Number.isNaN(deadline.getTime())) {
      setCountdownMs(null);
      return;
    }

    const updateCountdown = () => {
      setCountdownMs(Math.max(0, deadline.getTime() - getServerNowMs()));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [countdownTargetRaw, getServerNowMs]);

  const countdownDisplayDesktop =
    countdownMs !== null ? formatCountdown(countdownMs, false) : null;
  const countdownDisplayMobile =
    countdownMs !== null ? formatCountdown(countdownMs, true) : null;
  /** Legacy only — vintage always shows Ready/Tipoff/Live status box (no sheet flag). */
  const showCountdownTimer = siteConfig?.showCountdownTimer?.trim().toUpperCase() === 'YES';
  // Countdown is independent of Application Master Lock (lock is a separate fail-safe).
  const scoreboardTimeDesktop = countdownDisplayDesktop || '00:00';
  const scoreboardTimeMobile = countdownDisplayMobile || '00:00';
  const bracketsFieldOpen = isVintage
    ? picksCopy.bracketsPublished
    : isBracketsAvailableFlag(siteConfig);
  const countdownHoverTitle = bracketsFieldOpen
    ? 'Countdown to tipoff'
    : 'Countdown to brackets ready';

  /** Adminable vintage timer label: Ready message pre-publish, tipoff message after. */
  const vintageCountdownLabel = formatVintagePicksLabel(
    bracketsFieldOpen
      ? picksCopy.countdownToTipoffLabel
      : picksCopy.countdownToBracketLabel,
    { year: viewingYear, activeYear },
  );

  const vintageLiveMessage =
    liveTourneyMessage.trim() || 'The tournament is underway!';

  /** Adminable prior-year switch copy that replaces the timer. */
  const vintagePriorYearSwitchLabel = formatVintagePicksLabel(
    picksCopy.viewingPriorYearLabel,
    { year: viewingYear, activeYear },
  );

  /**
   * Get tooltip/disable reason for user actions.
   * `edit` is excluded so in-progress rows can still open the read-only modal via the entry name / status chip.
   */
  const getActionDisabledReason = (
    action: 'new' | 'copy' | 'edit' | 'delete' | 'return' | 'restore',
  ) => {
    if (!mutationsBlocked) return null;
    if (action === 'edit') return null;
    return accessBlockMessage;
  };

  /**
   * Disable reason for the in-progress **Edit** control in Actions only (does not apply to row click “view read-only”).
   */
  const getInProgressEditButtonDisabledReason = (): string | null => {
    if (mutationsBlocked) return accessBlockMessage;
    return null;
  };

  const submittedEntryNamesForDuplicateCheck = useMemo(
    () =>
      bracketsForYear
        .filter((b) => b.status === 'submitted')
        .map((b) => b.entryName || '')
        .filter((name) => name.length > 0),
    [bracketsForYear]
  );

  /**
   * Disable reason for the in-progress row Submit action. Matches in-editor Submit ordering:
   * picks access gates → incomplete picks/entry/tie-breaker → duplicate name.
   */
  const getInProgressSubmitDisabledReason = (row: Bracket): string | null => {
    if (row.status !== 'in_progress') return null;
    if (submittingBracketId === row.id) return 'Submitting…';
    if (mutationsBlocked) return accessBlockMessage;
    if (!tournamentData || !emptyBracketTemplate) {
      return (
        siteConfig?.bracketsMissingErrorMessage ||
        FALLBACK_CONFIG.bracketsMissingErrorMessage ||
        'Tournament data not loaded. Try refreshing.'
      );
    }
    const picks = row.picks || {};
    const entry = row.entryName || '';
    const tb = String(row.tieBreaker ?? '');
    const canProceed = computeCanProceedToSubmit(
      tournamentData,
      emptyBracketTemplate,
      picks,
      entry,
      tb,
      siteConfig
    );
    if (!canProceed) {
      return getBracketSubmitReadinessHint(
        tournamentData,
        emptyBracketTemplate,
        picks,
        entry,
        tb,
        siteConfig
      );
    }
    if (isSubmitDuplicateEntryName(entry, siteConfig, submittedEntryNamesForDuplicateCheck)) {
      return (
        siteConfig?.finalMessageDuplicateName ||
        'An entry with this name already exists for this year. Please choose a different name.'
      );
    }
    return null;
  };

  /**
   * Stable tie-breaker for brackets in the same status group (year, then bracket number).
   */
  const compareBracketNumber = (a: Bracket, b: Bracket) => {
    const aData = a as unknown as Record<string, unknown>;
    const bData = b as unknown as Record<string, unknown>;
    const aYear = (aData.year as number) || 0;
    const bYear = (bData.year as number) || 0;
    const aNumber = (aData.bracketNumber as number) || 0;
    const bNumber = (bData.bracketNumber as number) || 0;
    if (aYear !== bYear) return aYear - bYear;
    return aNumber - bNumber;
  };

  /**
   * Sort My Picks rows: submitted (in pool) first, then in progress, then deleted.
   */
  const sortBracketsForDisplay = (list: Bracket[]): Bracket[] => {
    return [...list].sort((a, b) => {
      const poolTier = (s: string) => (s === 'submitted' ? 0 : 1);
      const outOrder = (s: string) => {
        if (s === 'in_progress') return 0;
        if (s === 'deleted') return 1;
        return 2;
      };

      const tierA = poolTier(a.status);
      const tierB = poolTier(b.status);
      if (tierA !== tierB) return tierA - tierB;

      if (a.status === 'submitted' && b.status === 'submitted') {
        const nameA = (a.entryName || '').toLowerCase();
        const nameB = (b.entryName || '').toLowerCase();
        const byName = nameA.localeCompare(nameB);
        if (byName !== 0) return byName;
        return compareBracketNumber(a, b);
      }

      const oa = outOrder(a.status);
      const ob = outOrder(b.status);
      if (oa !== ob) return oa - ob;

      if (a.status === 'in_progress' && b.status === 'in_progress') {
        const progressA = calculateProgress(a.picks).completed;
        const progressB = calculateProgress(b.picks).completed;
        if (progressA !== progressB) return progressA - progressB;
        return compareBracketNumber(a, b);
      }

      if (a.status === 'deleted' && b.status === 'deleted') {
        const nameA = (a.entryName || '').toLowerCase();
        const nameB = (b.entryName || '').toLowerCase();
        const byName = nameA.localeCompare(nameB);
        if (byName !== 0) return byName;
        return compareBracketNumber(a, b);
      }

      return 0;
    });
  };

  const { desktopPx: poolFontDesktopPx, mobilePx: poolFontMobilePx } = parsePoolHeaderFontSizes(
    siteConfig?.poolHeaderFontSize
  );
  const poolSectionFontStyle = {
    ['--pool-font-mobile' as string]: `${poolFontMobilePx}px`,
    ['--pool-font-desktop' as string]: `${poolFontDesktopPx}px`,
  } as React.CSSProperties;
  /** In-pool / out-of-pool banner: icon + bold + message share one size per breakpoint. */
  const poolBannerIconClass =
    'shrink-0 h-[length:var(--pool-font-mobile)] w-[length:var(--pool-font-mobile)] md:h-[length:var(--pool-font-desktop)] md:w-[length:var(--pool-font-desktop)]';
  const poolBannerHeadingClass =
    'font-bold text-[length:var(--pool-font-mobile)] md:text-[length:var(--pool-font-desktop)]';
  /** Desktop: em dash + subtitle after title (same line when space allows). Mobile: hidden; detail via info panel. */
  const poolBannerDetailClass =
    'font-normal text-gray-600 text-[length:var(--pool-font-mobile)] md:text-[length:var(--pool-font-desktop)]';
  const submittedEntryCountForPoolMessage = useMemo(
    () => bracketsForYear.filter((b) => b.status === 'submitted').length,
    [bracketsForYear]
  );

  /**
   * Pool section banners: vintage uses CMS flavors; legacy keeps sheet keys
   * `in_the_pool_header` / `in_the_pool_message` (and not-in equivalents).
   */
  const inPoolCopy = isVintage
    ? {
        header: formatVintagePicksLabel(picksFlavor.inPoolHeader, picksTokenVars),
        detail: formatInThePoolMessage(
          formatVintagePicksLabel(picksFlavor.inPoolDetail, picksTokenVars),
          submittedEntryCountForPoolMessage
        ),
      }
    : {
        header: siteConfig?.inThePoolHeader?.trim() || 'In the pool',
        detail: formatInThePoolMessage(
          siteConfig?.inThePoolMessage?.trim() ||
            'Submitted entries count toward the contest.',
          submittedEntryCountForPoolMessage
        ),
      };
  const outPoolCopy = isVintage
    ? {
        header: formatVintagePicksLabel(picksFlavor.outPoolHeader, picksTokenVars),
        detail: formatVintagePicksLabel(picksFlavor.outPoolDetail, picksTokenVars),
      }
    : {
        header: siteConfig?.notInThePoolHeader?.trim() || 'Not in the pool',
        detail:
          siteConfig?.notInThePoolMessage?.trim() ||
          'In progress and deleted entries are not included until you submit.',
      };

  /**
   * Open profile modal and load `/api/user/profile` (display name, email, stats).
   */
  const openProfileModal = async () => {
    setProfileModalOpen(true);
    setProfileLoadError(null);
    setProfileSaveError(null);
    setProfileLoading(true);
    setProfileDetails(null);
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: {
          email: string;
          displayName: string;
          createdAt: string;
          tournamentsPlayed: number;
          bracketsEntered: number;
        };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to load profile');
      }
      setProfileDisplayName(json.data.displayName || '');
      setProfileDetails({
        email: json.data.email,
        createdAt: json.data.createdAt,
        tournamentsPlayed: json.data.tournamentsPlayed,
        bracketsEntered: json.data.bracketsEntered,
      });
    } catch (e) {
      setProfileLoadError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setProfileLoadError(null);
    setProfileSaveError(null);
  };

  /**
   * Persist display name and refresh NextAuth session so the welcome line updates.
   */
  const saveProfileDisplayName = async () => {
    setProfileSaveError(null);
    setProfileSaving(true);
    try {
      const res = await fetchWithCSRF('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName: profileDisplayName.trim() }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { displayName: string };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to save profile');
      }
      await updateSession({ name: json.data.displayName });
      closeProfileModal();
    } catch (e) {
      setProfileSaveError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  /** Renders a fresh button instance (desktop + mobile headers each include one). */
  const renderProfileEditButton = (variant: 'desktop' | 'mobile') => (
    <button
      type="button"
      onClick={openProfileModal}
      title="Edit Profile Information"
      aria-label="Edit Profile Information"
      className="inline-flex shrink-0 rounded-md p-1.5 text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      data-testid={`edit-profile-button-${variant}`}
    >
      <Pencil className="h-5 w-5" aria-hidden />
    </button>
  );

  /**
   * Thin orange frame around the WMM logo with a year tab that overlaps the logo
   * blue and shares a thick orange bottom bar — flat across the bottom.
   */
  const renderLogoYearFrame = (variant: 'desktop' | 'mobile') => {
    const isDesktop = variant === 'desktop';
    const canPickYear = Boolean(onViewingYearChange);
    const frameWidth = isDesktop ? 168 : 108;
    const logoHeight = isDesktop ? 118 : 76;
    const tabWidth = isDesktop ? 76 : 60;
    const tabHeight = isDesktop ? 20 : 17;
    /** How far the tab overlaps up into the logo blue (px). */
    const tabOverlap = isDesktop ? 10 : 8;
    /** Thick bottom border height; equals tab height so bottoms align flush. */
    const bottomBarHeight = tabHeight;

    return (
      <div
        className={`relative flex-shrink-0 ${isDesktop ? 'mr-4' : ''}`}
        style={{ width: frameWidth }}
        data-testid={`picks-logo-year-frame-${variant}`}
      >
        {/*
          Outer orange shell: 1px top/sides, thick bottom bar (= tab height)
          so the year tab and frame share one flat bottom edge.
        */}
        <div
          className="rounded-[1px] bg-[#f97316]"
          style={{
            paddingTop: 1,
            paddingLeft: 1,
            paddingRight: 1,
            paddingBottom: bottomBarHeight,
          }}
        >
          <div
            className="overflow-hidden bg-[#0f2744]"
            style={{ height: logoHeight }}
          >
            <div className="flex h-full w-full items-center justify-center">
              {siteConfig?.wmmLogo && !logoError ? (
                <Image
                  src={`/images/${siteConfig.wmmLogo}`}
                  alt="Site Logo"
                  width={isDesktop ? 220 : 140}
                  height={isDesktop ? 118 : 76}
                  className="h-full w-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="px-1 text-center text-[10px] font-semibold text-gray-300">
                  {logoError ? 'Image not Found' : 'WMM'}
                </span>
              )}
            </div>
          </div>
        </div>
        {/*
          Year tab: bumped up into the logo blue, bottom flush with the thick
          orange bottom bar (trapezoid only visible on the top/sides into blue).
        */}
        <button
          type="button"
          onClick={() => canPickYear && setYearPickerOpen(true)}
          disabled={!canPickYear}
          title={canPickYear ? 'Change tournament year' : undefined}
          aria-label={`Viewing year ${viewingYear}. Change tournament year`}
          data-testid={`picks-year-badge-${variant}`}
          className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-0.5 bg-[#f97316] font-bold leading-none text-[#0f2744] transition-colors ${
            isDesktop ? 'text-[11px]' : 'text-[10px]'
          } ${
            canPickYear
              ? 'cursor-pointer hover:brightness-110'
              : 'cursor-default'
          }`}
          style={{
            bottom: 0,
            width: tabWidth,
            height: tabHeight + tabOverlap,
            clipPath: 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)',
          }}
        >
          <span className="translate-y-[1px]">{viewingYear}</span>
          {canPickYear && (
            <ChevronDown
              className={`${isDesktop ? 'h-3 w-3' : 'h-2.5 w-2.5'} translate-y-[1px]`}
              aria-hidden
              strokeWidth={2.75}
            />
          )}
        </button>
      </div>
    );
  };

  /**
   * Class names for a row action button. Vintage colors come from CMS CSS vars
   * via `data-vp-action`; legacy keeps Tailwind fill colors.
   */
  const rowActionClass = (disabled: boolean, legacyEnabled: string) =>
    isVintage
      ? 'v-picks__action-btn flex h-8 w-8 items-center justify-center transition-colors'
      : `w-8 h-8 rounded flex items-center justify-center transition-colors ${
          disabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : legacyEnabled
        }`;

  /**
   * Row action controls (view / edit / submit / copy / delete / restore / return / email, plus inline confirmations).
   * Shared by the legacy table and the vintage table + mobile cards so handlers stay identical.
   *
   * @param bracket - Row bracket.
   * @param number - Display bracket number (0 when unknown); used for usage-log ids.
   * @param submitDisabledReason - Disable reason for in-progress Submit, or null.
   * @param accessForcesViewOnly - True when an in-progress row opens read-only because mutations are blocked.
   */
  const renderRowActionButtons = (
    bracket: Bracket,
    number: number,
    submitDisabledReason: string | null,
    accessForcesViewOnly: boolean,
  ) => (
    <>
                          {bracket.status === 'in_progress' ? (
                            <>
                              {pendingDeleteBracketId === bracket.id ? (
                                <>
                                  {/* Confirmation UI - embedded in the table */}
                                  <div className="col-span-2 flex w-full max-w-xs flex-wrap items-center justify-center gap-2 justify-self-center bg-red-50 border border-red-200 rounded px-2 py-1 md:col-auto md:w-auto" data-testid="delete-confirmation-dialog">
                                    <span className="text-xs text-red-700 font-medium whitespace-nowrap">Delete?</span>
                                    <button
                                      onClick={() => onConfirmDelete && onConfirmDelete(bracket.id)}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => onCancelDelete && onCancelDelete()}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      No
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* In Progress: Edit (or View when kill-switch on), Submit, Copy, Delete */}
                                  {accessForcesViewOnly ? (
                                    <LoggedButton
                                      onClick={() => handleEyeOpenFullBracketOrPrint(bracket)}
                                      logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                                      bracketId={number ? String(number).padStart(6, '0') : null}
                                      className={rowActionClass(false, 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer')}
                                      data-vp-action="view"
                                      title="View"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </LoggedButton>
                                  ) : (
                                    <LoggedButton
                                      onClick={() =>
                                        !getInProgressEditButtonDisabledReason() && onEditBracket(bracket)
                                      }
                                      logLocation="Edit"
                                      bracketId={number ? String(number).padStart(6, '0') : null}
                                      disabled={Boolean(getInProgressEditButtonDisabledReason())}
                                      className={rowActionClass(
                                        Boolean(getInProgressEditButtonDisabledReason()),
                                        'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer',
                                      )}
                                      data-vp-action="edit"
                                      title={getInProgressEditButtonDisabledReason() || 'Edit'}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </LoggedButton>
                                  )}
                                  <LoggedButton
                                    onClick={() => {
                                      if (!submitDisabledReason) void onSubmitBracket(bracket);
                                    }}
                                    logLocation="Submit"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(submitDisabledReason)}
                                    className={rowActionClass(
                                      Boolean(submitDisabledReason),
                                      'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer',
                                    )}
                                    title={submitDisabledReason || 'Submit'}
                                    data-testid="submit-bracket-landing-button"
                                    data-vp-action="submit"
                                  >
                                    <Send className="h-4 w-4" aria-hidden />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('copy')),
                                      'bg-green-600 text-white hover:bg-green-700 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-bracket-button"
                                    data-vp-action="copy"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('delete') && onDeleteBracket(bracket.id)}
                                    logLocation="Delete"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('delete')) || deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id}
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('delete')) || deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id,
                                      'bg-red-600 text-white hover:bg-red-700 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('delete') || (deletingBracketId === bracket.id ? 'Deleting...' : 'Delete')}
                                    data-testid="delete-bracket-button"
                                    data-vp-action="delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </LoggedButton>
                                </>
                              )}
                            </>
                          ) : bracket.status === 'deleted' ? (
                            <>
                              {pendingPermanentDeleteBracketId === bracket.id ? (
                                <div
                                  className="col-span-2 flex w-full max-w-xs flex-col items-stretch gap-2 justify-self-center bg-red-50 border border-red-200 rounded px-2 py-2 mx-auto md:col-auto md:mx-auto"
                                  data-testid="permanent-delete-confirmation"
                                >
                                  <div className="text-xs text-gray-800 text-left">
                                    {renderMessageWithLineBreaks(
                                      siteConfig?.permDeleteMessage ||
                                        'Permanently delete this bracket? This cannot be undone.||Are you sure you want to continue?'
                                    )}
                                  </div>
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onConfirmPermanentDelete && onConfirmPermanentDelete(bracket.id)}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-red-800 text-white text-xs px-2 py-1 rounded hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onCancelPermanentDelete && onCancelPermanentDelete()}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <LoggedButton
                                    onClick={() => handleEyeOpenFullBracketOrPrint(bracket)}
                                    logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className={rowActionClass(false, 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer')}
                                    title={onOpenFullBracketModal ? 'View' : 'View/Print'}
                                    data-testid="print-deleted-bracket-button"
                                    data-vp-action="view"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('copy')),
                                      'bg-green-600 text-white hover:bg-green-700 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-deleted-bracket-button"
                                    data-vp-action="copy"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => {
                                      if (!getActionDisabledReason('restore') && onRestoreBracket) {
                                        onRestoreBracket(bracket.id);
                                      }
                                    }}
                                    logLocation="Restore"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('restore'))}
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('restore')),
                                      'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('restore') || 'Restore to In Progress'}
                                    data-testid="restore-bracket-button"
                                    data-vp-action="restore"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() =>
                                      !getActionDisabledReason('delete') &&
                                      onPermanentDeleteClick &&
                                      onPermanentDeleteClick(bracket.id)
                                    }
                                    logLocation="PermanentDelete"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={
                                      Boolean(getActionDisabledReason('delete')) ||
                                      deletingBracketId === bracket.id ||
                                      Boolean(pendingPermanentDeleteBracketId)
                                    }
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('delete')) ||
                                        deletingBracketId === bracket.id ||
                                        Boolean(pendingPermanentDeleteBracketId),
                                      'bg-red-900 text-white hover:bg-red-950 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('delete') || 'Permanently delete'}
                                    data-testid="permanent-delete-bracket-button"
                                    data-vp-action="permanentDelete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </LoggedButton>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Submitted: View/Print, Return, Copy, Email (open picks via entry name or View/Print) */}
                              {pendingReturnBracketId === bracket.id ? (
                                <div
                                  className="col-span-2 flex w-full max-w-xs flex-col items-stretch gap-2 justify-self-center bg-amber-50 border border-amber-200 rounded px-2 py-2 mx-auto md:col-auto md:mx-auto"
                                  data-testid="return-bracket-confirmation"
                                >
                                  <div className="text-xs text-gray-800 text-left">
                                    {renderMessageWithLineBreaks(
                                      siteConfig?.returnActionConfirmMessage?.trim() ||
                                        siteConfig?.bracketReturnMessage?.trim() ||
                                        'This bracket will leave the contest pool until you submit again.||Are you sure you want to return it to In Progress?'
                                    )}
                                  </div>
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onConfirmReturnBracket && onConfirmReturnBracket(bracket.id)
                                      }
                                      disabled={returningBracketId === bracket.id}
                                      className="bg-amber-700 text-white text-xs px-2 py-1 rounded hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onCancelReturnBracket && onCancelReturnBracket()}
                                      disabled={returningBracketId === bracket.id}
                                      className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <LoggedButton
                                    onClick={() => handleEyeOpenFullBracketOrPrint(bracket)}
                                    logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className={rowActionClass(false, 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer')}
                                    title={onOpenFullBracketModal ? 'View' : 'View/Print'}
                                    data-testid="print-bracket-button"
                                    data-vp-action="view"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() =>
                                      !getActionDisabledReason('return') &&
                                      onReturnBracketClick &&
                                      onReturnBracketClick(bracket.id)
                                    }
                                    logLocation="Return"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={
                                      Boolean(getActionDisabledReason('return')) ||
                                      Boolean(returningBracketId) ||
                                      Boolean(pendingReturnBracketId)
                                    }
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('return')) ||
                                        Boolean(returningBracketId) ||
                                        Boolean(pendingReturnBracketId),
                                      'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer',
                                    )}
                                    title={
                                      getActionDisabledReason('return') ||
                                      siteConfig?.returnActionHoverMessage?.trim() ||
                                      'Return to In Progress (you must submit again to re-enter the pool)'
                                    }
                                    data-testid="return-bracket-button"
                                    data-vp-action="return"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={rowActionClass(
                                      Boolean(getActionDisabledReason('copy')),
                                      'bg-green-600 text-white hover:bg-green-700 cursor-pointer',
                                    )}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-bracket-button"
                                    data-vp-action="copy"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => handleEmailBracket(bracket)}
                                    logLocation="Email"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className={rowActionClass(false, 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer')}
                                    title="Email PDF"
                                    data-testid="email-bracket-button"
                                    data-vp-action="email"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </LoggedButton>
                                </>
                              )}
                            </>
                          )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Vintage presentation (variant === 'vintage'). Reuses the same state, handlers,
  // and row action buttons as legacy; only markup/classes differ.
  // ---------------------------------------------------------------------------

  /** Status label used for vintage badges (matches legacy copy). */
  const vintageStatusClass = (status: string) =>
    status === 'submitted'
      ? 'v-picks__status v-picks__status--submitted'
      : status === 'deleted'
        ? 'v-picks__status v-picks__status--deleted'
        : 'v-picks__status v-picks__status--progress';

  /**
   * Shared vintage status mark (checkmark / clock / trash) for pills, filters, and row badges.
   */
  const renderVintageStatusIcon = (status: 'submitted' | 'in_progress' | 'deleted') => {
    if (status === 'submitted') {
      return <CheckCircle className="v-picks__icon" aria-hidden />;
    }
    if (status === 'deleted') {
      return <Trash2 className="v-picks__icon" aria-hidden />;
    }
    return <Clock className="v-picks__icon" aria-hidden />;
  };

  /**
   * Compact year selector (no visible label) for the New / Year / Logout row.
   * Native select: calls `onViewingYearChange` directly, so the year picker modal is never opened.
   */
  const renderVintageYearSelect = () => {
    const canPickYear = Boolean(onViewingYearChange) && !isYearSwitching;
    return (
      <div className="v-picks__year" data-testid={`picks-year-control-${viewportSuffix}`}>
        <label className="v-picks__sr-only" htmlFor={`picks-year-select-${viewportSuffix}`}>
          Tournament year
        </label>
        <div className="v-picks__select-wrap">
          <select
            id={`picks-year-select-${viewportSuffix}`}
            className="v-picks__select"
            value={viewingYear}
            disabled={!canPickYear}
            aria-busy={isYearSwitching || undefined}
            onChange={(e) => onViewingYearChange?.(Number(e.target.value))}
            title={
              isYearSwitching
                ? 'Loading tournament year…'
                : canPickYear
                  ? 'Change tournament year'
                  : undefined
            }
            aria-label="Tournament year"
            data-testid={`picks-year-badge-${viewportSuffix}`}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y} data-testid={`picks-year-option-${y}`}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown className="v-picks__select-icon" aria-hidden />
        </div>
      </div>
    );
  };

  /** Four Final Four logos (TL, BL, TR, BR) — same KEY chrome as Standings. */
  const renderVintageFinalFour = (finalFour: ReturnType<typeof getFinalFourTeams>) => {
    // Sheet order TL, BL, TR, BR matches regionalChampionKey indices 0–3.
    const slots = [
      {
        id: finalFour.topLeftId,
        logo: finalFour.topLeft,
        name: finalFour.topLeftName,
        sheetIndex: 0,
      },
      {
        id: finalFour.bottomLeftId,
        logo: finalFour.bottomLeft,
        name: finalFour.bottomLeftName,
        sheetIndex: 1,
      },
      {
        id: finalFour.topRightId,
        logo: finalFour.topRight,
        name: finalFour.topRightName,
        sheetIndex: 2,
      },
      {
        id: finalFour.bottomRightId,
        logo: finalFour.bottomRight,
        name: finalFour.bottomRightName,
        sheetIndex: 3,
      },
    ];
    const iKey = resultKeyContext.semifinalKey[0] ?? '';
    const jKey = resultKeyContext.semifinalKey[1] ?? '';

    return (
      <div className="v-picks__ff" role="group" aria-label="Final Four">
        {slots.map((slot) => {
          const teamName = slot.name ?? '';
          const isFinalist =
            Boolean(slot.id) &&
            (slot.id === finalFour.finalist1Id || slot.id === finalFour.finalist2Id);
          const shadeTone = resolvePickResultTone(
            teamName,
            resultKeyContext.regionalChampionKey[slot.sheetIndex] ?? '',
            resultKeyContext.eliminatedTeams,
          );
          const semiKey =
            slot.id === finalFour.finalist1Id
              ? iKey
              : slot.id === finalFour.finalist2Id
                ? jKey
                : '';
          const borderTone = isFinalist
            ? resolvePickResultTone(
                teamName,
                semiKey,
                resultKeyContext.eliminatedTeams,
              )
            : undefined;
          return (
            <div
              key={slot.sheetIndex}
              className={`v-picks__ff-cell${isFinalist ? ' is-finalist' : ''}`}
              data-status={shadeTone}
              data-border={borderTone}
              title={slot.name || undefined}
            >
              <FinalFourLogo logoPath={slot.logo} teamName={slot.name} />
            </div>
          );
        })}
      </div>
    );
  };

  /** Champion pick cell — shade vs KEY championship; no finalist black frame. */
  const renderVintageChampion = (
    finalFour: ReturnType<typeof getFinalFourTeams>,
    showName: boolean,
  ) => {
    const shadeTone = resolvePickResultTone(
      finalFour.championName ?? '',
      resultKeyContext.finalWinner,
      resultKeyContext.eliminatedTeams,
    );
    return (
      <div className="v-picks__champ">
        <div
          className={`v-picks__champ-cell${finalFour.champion ? ' is-set' : ''}`}
          data-status={shadeTone}
          data-border={shadeTone !== 'pending' ? shadeTone : undefined}
          title={finalFour.championName || undefined}
        >
          <FinalFourLogo logoPath={finalFour.champion} teamName={finalFour.championName} />
        </div>
        {showName && (
          <span className="v-picks__champ-name">{finalFour.championName || 'Not picked'}</span>
        )}
      </div>
    );
  };

  /**
   * Submitted rows: Paid shows $; unpaid/pending is blank (no icon).
   * Desktop Progress column uses the blank state; mobile Status uses
   * `renderVintageMobileStatusMark` so unpaid submitted still shows the checkmark.
   * @param iconOnly - Compact chip (no “Paid” word) for desktop Progress col / mobile.
   */
  const renderVintagePayment = (bracket: Bracket, iconOnly = false) => {
    const paid = bracket.paymentStatus === 'paid';
    const pending = bracket.paymentStatus === 'pending';
    const title = paid
      ? 'Payment Confirmed'
      : pending
        ? 'Payment Pending'
        : 'Not Paid';
    if (!paid) {
      return (
        <span
          className={`v-picks__pay v-picks__pay--blank${iconOnly ? ' v-picks__pay--icon' : ''}`}
          title={title}
          aria-label={title}
        />
      );
    }
    return (
      <span
        className={`v-picks__pay v-picks__pay--paid${iconOnly ? ' v-picks__pay--icon' : ''}`}
        title={title}
        aria-label={title}
      >
        <DollarSign className="v-picks__icon" aria-hidden />
        {!iconOnly ? <span>Paid</span> : null}
      </span>
    );
  };

  /**
   * Mobile Status column mark: one of paid / submitted / in progress / deleted.
   * Paid submitted entries show $; all other rows show the status icon (including
   * unpaid submitted, which previously rendered a blank pay chip).
   *
   * @param bracket - Entry to render a mark for
   */
  const renderVintageMobileStatusMark = (bracket: Bracket) => {
    if (bracket.paymentStatus === 'paid') {
      return renderVintagePayment(bracket, true);
    }
    return (
      <button
        type="button"
        className={`${vintageStatusClass(bracket.status)} v-picks__status--button v-picks__status--square`}
        onClick={() => openBracketFromLandingRow(bracket)}
        title={getStatusText(bracket.status)}
        aria-label={getStatusText(bracket.status)}
      >
        {renderVintageStatusIcon(bracket.status)}
      </button>
    );
  };

  /** Progress bar (in progress / deleted) or payment marker (submitted). */
  const renderVintageProgress = (
    bracket: Bracket,
    progress: ReturnType<typeof calculateProgress>,
    opts?: { paymentIconOnly?: boolean },
  ) => {
    if (bracket.status === 'submitted') {
      return (
        <div className="v-picks__progress v-picks__progress--done">
          {renderVintagePayment(bracket, opts?.paymentIconOnly)}
        </div>
      );
    }
    return (
      <div className="v-picks__progress">
        <span className="v-picks__progress-text">
          {progress.completed} / {progress.total} picks
        </span>
        <span className="v-picks__bar" aria-hidden>
          <span
            className={`v-picks__bar-fill v-picks__bar-fill--${bracket.status}`}
            style={{ width: `${progress.percentage}%` }}
          />
        </span>
      </div>
    );
  };

  /** "In the pool" / "Not in the pool" section heading content (shared by table rows and cards). */
  const renderVintagePoolSection = (kind: 'in' | 'out') => {
    const copy = kind === 'in' ? inPoolCopy : outPoolCopy;
    const key = kind === 'in' ? 'in-pool' : 'out-pool';
    const Icon = kind === 'in' ? CheckCircle : Clock;
    return (
      <div className="v-picks__section-inner" style={poolSectionFontStyle}>
        <div className="v-picks__section-line">
          <Icon className={`v-picks__section-icon v-picks__section-icon--${kind}`} aria-hidden />
          <strong className="v-picks__section-title">{copy.header}</strong>
          {copy.detail && isMdUp ? (
            <span className="v-picks__section-detail">— {copy.detail}</span>
          ) : null}
          {copy.detail && !isMdUp ? (
            <button
              type="button"
              onClick={() => setPoolBannerExpanded((prev) => (prev === key ? null : key))}
              className="v-picks__section-info"
              aria-label={`More about ${copy.header}`}
              aria-expanded={poolBannerExpanded === key}
              data-testid={`brackets-section-${key}-info`}
            >
              <Info className="v-picks__icon" aria-hidden />
            </button>
          ) : null}
        </div>
        {!isMdUp && poolBannerExpanded === key && copy.detail ? (
          <div className="v-picks__section-note">
            <button
              type="button"
              onClick={() => setPoolBannerExpanded(null)}
              className="v-picks__section-close"
              aria-label="Close section message"
              data-testid={`brackets-section-${key}-close`}
            >
              <X className="v-picks__icon" aria-hidden />
            </button>
            <div>{renderMessageWithLineBreaks(copy.detail)}</div>
          </div>
        ) : null}
      </div>
    );
  };

  /** Welcome line, header messages, status pills, and cost copy. */
  const renderVintageSummary = () => {
    const counts = getBracketsInfo();
    const displayName = isMdUp ? session?.user?.name || 'User' : getFirstName(session?.user?.name);
    const vintageHeaderNote = formatVintagePicksLabel(
      picksFlavor.headerNote,
      picksTokenVars
    ).trim();
    const accessIsError =
      picksAccess.reasonCode === 'brackets_missing_json' || picksAccess.reasonCode === 'master_lock';
    return (
      <div className="v-picks__summary">
        <h1 className="v-picks__welcome" data-testid="picks-page-title">
          <span>Welcome {displayName}</span>
          {renderProfileEditButton(viewportSuffix)}
        </h1>

        {showHeaderAccessMessage ? (
          <p
            className={`v-picks__notice ${accessIsError ? 'v-picks__notice--error' : 'v-picks__notice--warn'}`}
            data-testid={`picks-access-message-${viewportSuffix}`}
          >
            {renderMessageWithLineBreaks(accessBlockMessage)}
          </p>
        ) : (
          vintageHeaderNote && (
            <p className="v-picks__note" data-testid="picks-header-note">
              {renderMessageWithLineBreaks(vintageHeaderNote)}
            </p>
          )
        )}

        <ul className="v-picks__pills" aria-label="Entry counts">
          <li className="v-picks__pill v-picks__pill--submitted">
            {renderVintageStatusIcon('submitted')}
            Submitted {counts.submittedCount}
          </li>
          <li className="v-picks__pill v-picks__pill--progress">
            {renderVintageStatusIcon('in_progress')}
            In Progress {counts.inProgressCount}
          </li>
          {counts.deletedCount > 0 && (
            <li className="v-picks__pill v-picks__pill--deleted">
              {renderVintageStatusIcon('deleted')}
              Deleted {counts.deletedCount}
            </li>
          )}
        </ul>

        {dynamicMessage && (
          <p className="v-picks__cost" data-testid="picks-cost-message">
            {renderMessageWithLineBreaks(dynamicMessage)}
          </p>
        )}
      </div>
    );
  };

  /** New / Year / Logout row, optional Pay, and the countdown timer (or prior-year switch). */
  const renderVintageActions = () => (
    <div className="v-picks__side">
      <div className="v-picks__buttons">
        <button
          type="button"
          onClick={onCreateNew}
          disabled={Boolean(getActionDisabledReason('new'))}
          title={getActionDisabledReason('new') || 'Create a new bracket'}
          data-testid={`new-bracket-button-${viewportSuffix}`}
          className="v-picks__btn v-picks__btn--primary"
        >
          <Plus className="v-picks__icon" aria-hidden />
          <span>New Bracket</span>
        </button>
        {renderVintageYearSelect()}
        <LoggedButton
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          logLocation="Logout"
          className="v-picks__btn v-picks__btn--ghost v-picks__btn--icon"
          data-testid={`logout-button-${viewportSuffix}`}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="v-picks__icon" aria-hidden />
        </LoggedButton>
        {showPayButton && (
          <button
            type="button"
            onClick={() => setPayModalOpen(true)}
            className="v-picks__btn v-picks__btn--secondary"
            data-testid={`pay-button-${viewportSuffix}`}
            title="Pay for submitted brackets via Venmo"
          >
            <DollarSign className="v-picks__icon" aria-hidden />
            <span>Pay</span>
          </button>
        )}
      </div>
      {isHistoricalView ? (
        <button
          type="button"
          className="v-picks__year-switch"
          data-testid="picks-switch-to-active-year"
          disabled={isYearSwitching}
          onClick={() => onViewingYearChange?.(activeYear)}
        >
          {vintagePriorYearSwitchLabel}
        </button>
      ) : vintageTourneyLive ? (
        <div
          className="v-picks__timer v-picks__timer--live"
          data-testid="picks-live-tourney"
          title={vintageLiveMessage}
        >
          <span className="v-picks__timer-label">Live</span>
          <span className="v-picks__timer-live-text">{vintageLiveMessage}</span>
        </div>
      ) : isVintage || showCountdownTimer ? (
        <div
          className="v-picks__timer"
          title={vintageCountdownLabel}
          data-testid="picks-countdown-timer"
        >
          <span className="v-picks__timer-label">{vintageCountdownLabel}</span>
          <span className="v-picks__timer-value">
            {isMdUp ? scoreboardTimeDesktop : scoreboardTimeMobile}
          </span>
        </div>
      ) : null}
    </div>
  );

  /** Empty-state panel (CMS flavors for editorial; siteConfig for access gates). */
  const renderVintageEmptyState = () => {
    const emptyTitle = formatVintagePicksLabel(picksFlavor.emptyTitle, picksTokenVars);
    const emptyBody = formatVintagePicksLabel(picksFlavor.emptyBody, picksTokenVars);
    const emptyCta = formatVintagePicksLabel(picksCopy.emptyCtaBody, picksTokenVars);
    return (
      <div className="v-picks__empty" data-testid="picks-empty-state">
        <Trophy className="v-picks__empty-icon" aria-hidden />
        {isHistoricalView ? (
          <>
            <h3 className="v-picks__empty-title">{emptyTitle}</h3>
            <p className="v-picks__empty-text" data-testid="picks-empty-historical-message">
              {emptyBody}
            </p>
          </>
        ) : showNotAvailableInEmptyState ? (
          <p className="v-picks__empty-lead" data-testid="picks-empty-not-available-message">
            {renderMessageWithLineBreaks(accessBlockMessage)}
          </p>
        ) : picksAccess.blocked ? (
          <>
            <h3 className="v-picks__empty-title">{emptyTitle}</h3>
            <p className="v-picks__empty-text" data-testid="picks-empty-access-message">
              {renderMessageWithLineBreaks(accessBlockMessage)}
            </p>
          </>
        ) : (
          <>
            <h3 className="v-picks__empty-title">{emptyTitle}</h3>
            <p className="v-picks__empty-text" data-testid="picks-empty-cta-message">
              {emptyCta}
            </p>
          </>
        )}
      </div>
    );
  };

  /** Status chips + search box. */
  const renderVintageFilters = () => {
    const chip = (
      testId: string,
      label: string,
      pressed: boolean,
      tone: 'all' | 'submitted' | 'progress' | 'deleted',
      onClick: () => void,
      statusIcon?: 'submitted' | 'in_progress' | 'deleted',
    ) => (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pressed}
        data-testid={testId}
        className={`v-picks__chip v-picks__chip--${tone}${pressed ? ' is-on' : ''}`}
      >
        {statusIcon ? renderVintageStatusIcon(statusIcon) : null}
        {label}
      </button>
    );
    return (
      <div className="v-picks__filters" data-testid="brackets-list-filters">
        <div className="v-picks__filter-group">
          <span className="v-picks__filter-label">Show:</span>
          <div className="v-picks__chips">
            {chip('bracket-filter-all', 'All', allStatusFiltersOn, 'all', () =>
              updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY }),
            )}
            {chip(
              'bracket-filter-submitted',
              'Submitted',
              statusVisibility.submitted,
              'submitted',
              () => updateStatusVisibility((v) => ({ ...v, submitted: !v.submitted })),
              'submitted',
            )}
            {chip(
              'bracket-filter-in-progress',
              'In progress',
              statusVisibility.in_progress,
              'progress',
              () => updateStatusVisibility((v) => ({ ...v, in_progress: !v.in_progress })),
              'in_progress',
            )}
            {chip(
              'bracket-filter-deleted',
              'Deleted',
              statusVisibility.deleted,
              'deleted',
              () => updateStatusVisibility((v) => ({ ...v, deleted: !v.deleted })),
              'deleted',
            )}
          </div>
        </div>
        <div className="v-picks__search">
          <label htmlFor="bracket-entry-search" className="v-picks__sr-only">
            Search brackets by entry name or ID
          </label>
          <Search className="v-picks__search-icon" aria-hidden />
          <input
            id="bracket-entry-search"
            type="search"
            value={entrySearchQuery}
            onChange={(e) => setEntrySearchQuery(e.target.value)}
            placeholder="Search by entry name or bracket ID…"
            autoComplete="off"
            data-testid="bracket-entry-search"
            className="v-picks__search-input"
          />
        </div>
      </div>
    );
  };

  /** Desktop table + mobile cards for the filtered, sorted entries. */
  const renderVintageEntries = () => {
    const sortedBrackets = sortBracketsForDisplay(filteredDisplayBrackets);

    const rowContext = (bracket: Bracket, index: number) => {
      const bracketData = bracket as unknown as Record<string, unknown>;
      const number = (bracketData.bracketNumber as number) || 0;
      const submitDisabledReason =
        bracket.status === 'in_progress' ? getInProgressSubmitDisabledReason(bracket) : null;
      const accessForcesViewOnly = bracket.status === 'in_progress' && mutationsBlocked;
      const entriesStillAccepted = !mutationsBlocked;
      const rowOpenTitle =
        bracket.status === 'submitted' || bracket.status === 'deleted'
          ? onOpenFullBracketModal
            ? 'View bracket'
            : 'View/Print'
          : accessForcesViewOnly
            ? onOpenFullBracketModal
              ? 'View bracket'
              : 'View/Print'
            : bracket.status === 'in_progress' && entriesStillAccepted
              ? 'Edit bracket'
              : onOpenFullBracketModal
                ? 'View bracket'
                : 'View/Print';
      const inPool = bracket.status === 'submitted';
      const prev = sortedBrackets[index - 1];
      const prevInPool = prev ? prev.status === 'submitted' : false;
      return {
        number,
        paddedId: String(number).padStart(6, '0'),
        submitDisabledReason,
        accessForcesViewOnly,
        rowOpenTitle,
        rawEntryName: bracket.entryName || `Bracket #${index + 1}`,
        progress: calculateProgress(bracket.picks),
        finalFour: getFinalFourTeams(bracket.picks),
        showInHeader: inPool && (index === 0 || !prevInPool),
        showOutHeader: !inPool && (index === 0 || prevInPool),
        followsInPool: index > 0 && prevInPool,
      };
    };

    if (isMdUp) {
      return (
        <div className="v-picks__table-wrap">
          <table className="v-picks__table">
            <caption className="v-picks__sr-only">Your bracket entries for {viewingYear}</caption>
            <thead>
              <tr>
                <th scope="col" className="v-picks__th v-picks__th--entry">Entry</th>
                <th scope="col" className="v-picks__th v-picks__th--id">ID</th>
                <th scope="col" className="v-picks__th">Status</th>
                <th scope="col" className="v-picks__th">Progress</th>
                <th scope="col" className="v-picks__th">Final Four</th>
                <th scope="col" className="v-picks__th v-picks__th--champ" title="Champion">
                  Champ
                </th>
                <th scope="col" className="v-picks__th v-picks__th--actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedBrackets.map((bracket, index) => {
                const ctx = rowContext(bracket, index);
                return (
                  <React.Fragment key={bracket.id}>
                    {ctx.showInHeader && (
                      <tr className="v-picks__section-row v-picks__section-row--in" data-testid="brackets-section-in-pool">
                        <td colSpan={7}>{renderVintagePoolSection('in')}</td>
                      </tr>
                    )}
                    {ctx.showOutHeader && (
                      <tr
                        className={`v-picks__section-row v-picks__section-row--out${ctx.followsInPool ? ' is-after-in' : ''}`}
                        data-testid="brackets-section-out-pool"
                      >
                        <td colSpan={7}>{renderVintagePoolSection('out')}</td>
                      </tr>
                    )}
                    <tr className={`v-picks__row v-picks__row--${bracket.status}`}>
                      <td className="v-picks__cell v-picks__cell--entry">
                        <button
                          type="button"
                          className="v-picks__entry-name"
                          onClick={() => openBracketFromLandingRow(bracket)}
                          title={ctx.rowOpenTitle}
                        >
                          {ctx.rawEntryName}
                        </button>
                      </td>
                      <td className="v-picks__cell v-picks__cell--id">
                        <span data-testid="bracket-row-entry-id" title={`Bracket ID ${ctx.paddedId}`}>
                          {ctx.paddedId}
                        </span>
                      </td>
                      <td className="v-picks__cell">
                        <button
                          type="button"
                          className={`${vintageStatusClass(bracket.status)} v-picks__status--button`}
                          onClick={() => openBracketFromLandingRow(bracket)}
                          title={ctx.rowOpenTitle}
                        >
                          {renderVintageStatusIcon(bracket.status)}
                          {getStatusText(bracket.status)}
                        </button>
                      </td>
                      <td className="v-picks__cell">
                        {renderVintageProgress(bracket, ctx.progress)}
                      </td>
                      <td className="v-picks__cell v-picks__cell--ff">
                        {renderVintageFinalFour(ctx.finalFour)}
                      </td>
                      <td className="v-picks__cell v-picks__cell--champ">
                        {renderVintageChampion(ctx.finalFour, false)}
                      </td>
                      <td className="v-picks__cell v-picks__cell--actions">
                        <div className="v-picks__actions">
                          {renderRowActionButtons(
                            bracket,
                            ctx.number,
                            ctx.submitDisabledReason,
                            ctx.accessForcesViewOnly,
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="v-picks__cards">
        <div className="v-picks__card-headers" aria-hidden>
          <span className="v-picks__card-h v-picks__card-h--entry">Entry</span>
          <span className="v-picks__card-h v-picks__card-h--pay">Status</span>
          <span className="v-picks__card-h v-picks__card-h--ff">Final Four</span>
          <span className="v-picks__card-h v-picks__card-h--champ">Champ</span>
          <span className="v-picks__card-h v-picks__card-h--actions">Actions</span>
        </div>
        {sortedBrackets.map((bracket, index) => {
          const ctx = rowContext(bracket, index);
          const inPool = bracket.status === 'submitted';
          return (
            <React.Fragment key={bracket.id}>
              {ctx.showInHeader && (
                <div className="v-picks__section-row v-picks__section-row--in" data-testid="brackets-section-in-pool">
                  {renderVintagePoolSection('in')}
                </div>
              )}
              {ctx.showOutHeader && (
                <div
                  className={`v-picks__section-row v-picks__section-row--out${ctx.followsInPool ? ' is-after-in' : ''}`}
                  data-testid="brackets-section-out-pool"
                >
                  {renderVintagePoolSection('out')}
                </div>
              )}
              <article
                className={`v-picks__card v-picks__row--${bracket.status}`}
                data-testid="picks-entry-card"
                data-status={bracket.status}
              >
                {/* Name | $ or status | FF 2×2 | Champ | Actions 2×2 */}
                <div className="v-picks__card-row">
                  <button
                    type="button"
                    className="v-picks__entry-name"
                    onClick={() => openBracketFromLandingRow(bracket)}
                    title={`${ctx.rowOpenTitle} · ID ${ctx.paddedId}`}
                  >
                    {ctx.rawEntryName}
                  </button>
                  {renderVintageMobileStatusMark(bracket)}
                  {renderVintageFinalFour(ctx.finalFour)}
                  <div
                    className="v-picks__champ v-picks__champ--mobile"
                    title={ctx.finalFour.championName || 'Champion'}
                  >
                    <div
                      className={`v-picks__champ-cell${ctx.finalFour.champion ? ' is-set' : ''}`}
                    >
                      {ctx.finalFour.champion ? (
                        <FinalFourLogo
                          logoPath={ctx.finalFour.champion}
                          teamName={ctx.finalFour.championName}
                        />
                      ) : (
                        <Trophy className="v-picks__icon" aria-label="Champion not picked" />
                      )}
                    </div>
                  </div>
                  <div className="v-picks__actions v-picks__actions--grid">
                    {renderRowActionButtons(
                      bracket,
                      ctx.number,
                      ctx.submitDisabledReason,
                      ctx.accessForcesViewOnly,
                    )}
                  </div>
                </div>
                <span className="v-picks__sr-only" data-testid="bracket-row-entry-id">
                  {ctx.paddedId}
                </span>
              </article>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /** Vintage in-place loader while a year soft-switch is in flight (hides empty-state flash). */
  const renderVintageYearLoading = () => (
    <div className="v-picks__loading v-picks__loading--year" data-testid="picks-year-loading">
      <div className="v-picks__loading-spinner" aria-hidden />
      <p className="v-picks__loading-text">Loading tournament…</p>
    </div>
  );

  /** Full vintage landing body (rendered inside the `.v-picks` root; modals are shared below). */
  const renderVintageLanding = () => (
    <div className="v-picks__inner">
      {admin ? (
        <div className="v-picks__admin-bar">
          <PicksEditGear
            testId="vintage-picks-gear"
            label="Edit My Picks copy"
          />
        </div>
      ) : null}

      <section className="v-picks__panel" aria-label="Account and entry summary">
        {renderVintageSummary()}
        {renderVintageActions()}
      </section>

      <section className="v-picks__list" aria-label="Your entries">
        {isYearSwitching ? (
          renderVintageYearLoading()
        ) : bracketsForYear.length === 0 ? (
          renderVintageEmptyState()
        ) : (
          <>
            {renderVintageFilters()}
            {filteredDisplayBrackets.length === 0 ? (
              <div className="v-picks__empty v-picks__empty--filtered">
                <p className="v-picks__empty-title">No brackets match your filters</p>
                <p className="v-picks__empty-text">
                  Try turning on more statuses, clearing the search, or click Reset below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY });
                    setEntrySearchQuery('');
                  }}
                  data-testid="bracket-filters-reset"
                  className="v-picks__btn v-picks__btn--primary"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              renderVintageEntries()
            )}
          </>
        )}
      </section>
    </div>
  );

  return (
    <div
      className={
        isVintage
          ? `v-picks${isYearSwitching ? ' v-picks--year-switching' : ''}`
          : 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'
      }
      style={
        isVintage
          ? ({
              ...vintagePicksChromeCssVars(picksCopy),
              ...standingsResultChromeStyle(standingsChrome),
            } as React.CSSProperties)
          : undefined
      }
      aria-busy={isVintage && isYearSwitching ? true : undefined}
      data-testid={isVintage && isYearSwitching ? 'picks-year-switching' : undefined}
    >
      {isVintage ? (
        renderVintageLanding()
      ) : (
      <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
            {/* Welcome Header */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              {isHistoricalView && (
                <div
                  className="mb-4 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800"
                  data-testid="picks-historical-banner"
                >
                  {renderMessageWithLineBreaks(priorYearBannerMessage)}
                </div>
              )}
              {/* Desktop Layout */}
              <div className="hidden md:block">
                <div className="flex items-start justify-between">
                  {renderLogoYearFrame('desktop')}
                  
                  <div className="flex-1">
                    {/* Line 1: Welcome message with full name */}
                    <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                      <span>
                        Welcome {session?.user?.name || 'User'}
                      </span>
                      {renderProfileEditButton('desktop')}
                    </h1>
                    
                    {/* Line 2: Brackets message, or access-block (not-available goes to empty state) */}
                    {showHeaderAccessMessage ? (
                      <p className={accessMessageClassName} data-testid="picks-access-message-desktop">
                        {renderMessageWithLineBreaks(accessBlockMessage)}
                      </p>
                    ) : (
                      !mutationsBlocked &&
                      siteConfig?.bracketsMessage && (
                        <p className="text-sm text-gray-600 mt-1">
                          {renderMessageWithLineBreaks(siteConfig.bracketsMessage)}
                        </p>
                      )
                    )}
                    
                    {/* Line 3: Status bubbles - always shown */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        Submitted {getBracketsInfo().submittedCount}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                        In Progress {getBracketsInfo().inProgressCount}
                      </span>
                      {getBracketsInfo().deletedCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          <Trash2 className="h-4 w-4 text-gray-600 mr-1" />
                          Deleted {getBracketsInfo().deletedCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Line 4: Dynamic message — hidden when it would push a disabled New Bracket */}
                    {dynamicMessage && (
                      <p className="text-sm text-gray-600 mt-2">
                        {renderMessageWithLineBreaks(dynamicMessage)}
                      </p>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0 ml-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={onCreateNew}
                        disabled={Boolean(getActionDisabledReason('new'))}
                        title={getActionDisabledReason('new') || 'Create a new bracket'}
                        data-testid="new-bracket-button-desktop"
                        className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                          getActionDisabledReason('new')
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        <span>New Bracket</span>
                      </button>

                      {showPayButton && (
                        <button
                          onClick={() => setPayModalOpen(true)}
                          className="px-4 py-2 rounded-lg flex items-center space-x-2 bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                          data-testid="pay-button-desktop"
                          title="Pay for submitted brackets via Venmo"
                        >
                          <DollarSign className="h-4 w-4" />
                          <span>Pay</span>
                        </button>
                      )}
                      
                      <LoggedButton
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        logLocation="Logout"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                        data-testid="logout-button-desktop"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </LoggedButton>
                    </div>
                    {showCountdownTimer && (
                      <div
                        className="flex w-full items-center justify-center rounded border border-gray-700 bg-black px-4 py-2.5 shadow-inner text-amber-300"
                        title={countdownHoverTitle}
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 0.7px, transparent 0.7px)',
                          backgroundSize: '4px 4px',
                        }}
                      >
                        <span
                          className={`${scoreboardFont.className} text-[16px] tracking-[0.05em]`}
                          style={{
                            textShadow: '0 0 5px rgba(252,211,77,0.9)',
                          }}
                        >
                          {scoreboardTimeDesktop}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="flex flex-col md:hidden gap-3">
                <div className="flex flex-col">
                  {/* Top row: logo/year frame, welcome, buttons */}
                  <div className="flex items-start justify-between gap-2">
                    {renderLogoYearFrame('mobile')}
                    <div className="min-w-0 flex-1">
                      {/* Line 1: Welcome message with first name only */}
                      <h1 className="text-xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                        <span>Welcome {getFirstName(session?.user?.name)}</span>
                        {renderProfileEditButton('mobile')}
                      </h1>
                      
                      {/* Line 2: Mobile brackets message, or access-block (not-available goes to empty state) */}
                      {showHeaderAccessMessage ? (
                        <p className={accessMessageClassName} data-testid="picks-access-message-mobile">
                          {renderMessageWithLineBreaks(accessBlockMessage)}
                        </p>
                      ) : (
                        !mutationsBlocked &&
                        siteConfig?.mobileBracketsMessage && (
                          <p className="text-sm text-gray-600 mt-1">
                            {renderMessageWithLineBreaks(siteConfig.mobileBracketsMessage)}
                          </p>
                        )
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex flex-col items-end flex-shrink-0 gap-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={onCreateNew}
                          disabled={Boolean(getActionDisabledReason('new'))}
                          title={getActionDisabledReason('new') || 'Create a new bracket'}
                          aria-label="New Bracket"
                          data-testid="new-bracket-button-mobile"
                          className={`px-2 py-2 rounded-lg flex items-center space-x-2 ${
                            getActionDisabledReason('new')
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                          }`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        {showPayButton && (
                          <button
                            onClick={() => setPayModalOpen(true)}
                            className="px-2 py-2 rounded-lg flex items-center bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                            data-testid="pay-button-mobile"
                            aria-label="Pay"
                            title="Pay for submitted brackets via Venmo"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        
                        <LoggedButton
                          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                          logLocation="Logout"
                          className="bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                          data-testid="logout-button-mobile"
                        >
                          <LogOut className="h-4 w-4" />
                        </LoggedButton>
                      </div>
                      {showCountdownTimer && (
                        <div
                          className="inline-flex items-center rounded border border-gray-700 bg-black px-2 py-1 shadow-inner text-amber-300"
                          title={countdownHoverTitle}
                          style={{
                            backgroundImage:
                              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 0.7px, transparent 0.7px)',
                            backgroundSize: '4px 4px',
                          }}
                        >
                          <span
                            className={`${scoreboardFont.className} text-[9px] tracking-[0.05em]`}
                            style={{
                              textShadow: '0 0 5px rgba(252,211,77,0.9)',
                            }}
                          >
                            {scoreboardTimeMobile}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Line 3: Status bubbles with info icon on same line - always shown */}
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        Submitted {getBracketsInfo().submittedCount}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                        In Progress {getBracketsInfo().inProgressCount}
                      </span>
                      {getBracketsInfo().deletedCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          <Trash2 className="h-4 w-4 text-gray-600 mr-1" />
                          Deleted {getBracketsInfo().deletedCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Info icon — only when there is header status copy to reveal */}
                    {dynamicMessage && (
                      <button
                        onClick={() => setExpandedStatus(expandedStatus === 'info' ? null : 'info')}
                        className="text-blue-600 hover:text-blue-700 cursor-pointer flex-shrink-0"
                        style={{ width: '16px', marginLeft: '8px' }}
                        aria-label="Show bracket status details"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Line 4: Dynamic message - full width, hidden by default, shown when info icon is clicked */}
                {expandedStatus === 'info' && dynamicMessage && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded relative w-full">
                    <button
                      onClick={() => setExpandedStatus(null)}
                      className="absolute top-2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      style={{ right: '8px' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="pr-6">
                      <p>{renderMessageWithLineBreaks(dynamicMessage)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


        {/* Brackets List */}
        <div className="bg-white rounded-lg shadow-lg p-6">

          {isYearSwitching ? (
            <div className="text-center py-12" data-testid="picks-year-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600">Loading tournament...</p>
            </div>
          ) : bracketsForYear.length === 0 ? (
            <div className="text-center py-12" data-testid="picks-empty-state">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              {isHistoricalView ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No entries for {viewingYear}
                  </h3>
                  <p className="text-gray-600" data-testid="picks-empty-historical-message">
                    You have no brackets for {viewingYear}. Switch to {activeYear} to create new picks.
                  </p>
                </>
              ) : showNotAvailableInEmptyState ? (
                <p
                  className="mx-auto max-w-2xl text-lg font-bold leading-relaxed text-gray-900 md:text-2xl md:leading-snug"
                  data-testid="picks-empty-not-available-message"
                >
                  {renderMessageWithLineBreaks(accessBlockMessage)}
                </p>
              ) : picksAccess.blocked ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
                  <p className={accessMessageClassName.replace('mt-1', '')} data-testid="picks-empty-access-message">
                    {renderMessageWithLineBreaks(accessBlockMessage)}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
                  <p className="text-gray-600">
                    <span className="hidden md:inline">
                      Use the &quot;New Bracket&quot; button to create your first bracket.
                    </span>
                    <span className="md:hidden">Use the &quot;+&quot; button to create your first bracket.</span>
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div
                className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4"
                data-testid="brackets-list-filters"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="text-sm font-medium text-gray-700 shrink-0">Show:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY })}
                      aria-pressed={allStatusFiltersOn}
                      data-testid="bracket-filter-all"
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        allStatusFiltersOn
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatusVisibility((v) => ({ ...v, submitted: !v.submitted }))
                      }
                      aria-pressed={statusVisibility.submitted}
                      data-testid="bracket-filter-submitted"
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        statusVisibility.submitted
                          ? 'border-green-400 bg-green-100 text-green-900'
                          : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                    >
                      Submitted
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatusVisibility((v) => ({ ...v, in_progress: !v.in_progress }))
                      }
                      aria-pressed={statusVisibility.in_progress}
                      data-testid="bracket-filter-in-progress"
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        statusVisibility.in_progress
                          ? 'border-amber-400 bg-amber-100 text-amber-900'
                          : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatusVisibility((v) => ({ ...v, deleted: !v.deleted }))
                      }
                      aria-pressed={statusVisibility.deleted}
                      data-testid="bracket-filter-deleted"
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        statusVisibility.deleted
                          ? 'border-gray-400 bg-gray-200 text-gray-800'
                          : 'border-gray-200 bg-gray-50 text-gray-400'
                      }`}
                    >
                      Deleted
                    </button>
                  </div>
                </div>
                <div className="relative w-full max-w-md">
                  <label htmlFor="bracket-entry-search" className="sr-only">
                    Search brackets by entry name or ID
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <input
                    id="bracket-entry-search"
                    type="search"
                    value={entrySearchQuery}
                    onChange={(e) => setEntrySearchQuery(e.target.value)}
                    placeholder="Search by entry name or bracket ID…"
                    autoComplete="off"
                    data-testid="bracket-entry-search"
                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {filteredDisplayBrackets.length === 0 ? (
                <div className="py-10 text-center text-gray-600">
                  <p className="text-sm font-medium text-gray-900">No brackets match your filters</p>
                  <p className="mt-1 text-sm">
                    Try turning on more statuses, clearing the search, or click Reset below.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY });
                      setEntrySearchQuery('');
                    }}
                    data-testid="bracket-filters-reset"
                    className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Name
                    </th>
                    <th className="hidden px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider md:table-cell">
                      ID
                    </th>
                    <th className="hidden px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider md:table-cell">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider md:table-cell">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Four
                    </th>
                    <th className="hidden px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider md:table-cell">
                      Champ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const sortedBrackets = sortBracketsForDisplay(filteredDisplayBrackets);
                    return sortedBrackets.map((bracket, index) => {
                    const inPool = bracket.status === 'submitted';
                    const prev = sortedBrackets[index - 1];
                    const prevInPool = prev ? prev.status === 'submitted' : false;
                    const showInHeader = inPool && (index === 0 || !prevInPool);
                    const showOutHeader = !inPool && (index === 0 || prevInPool);

                    const bracketData = bracket as unknown as Record<string, unknown>;
                    const number = (bracketData.bracketNumber as number) || 0;
                    const submitDisabledReason =
                      bracket.status === 'in_progress'
                        ? getInProgressSubmitDisabledReason(bracket)
                        : null;
                    const progress = calculateProgress(bracket.picks);
                    const finalFour = getFinalFourTeams(bracket.picks);
                    
                    const isDeletedRow = bracket.status === 'deleted';
                    /** In-progress brackets open read-only when picks access blocks mutations. */
                    const accessForcesViewOnly =
                      bracket.status === 'in_progress' && mutationsBlocked;
                    const entriesStillAccepted = !mutationsBlocked;
                    const rowOpenTitle =
                      bracket.status === 'submitted' || bracket.status === 'deleted'
                        ? onOpenFullBracketModal
                          ? 'View bracket'
                          : 'View/Print'
                        : accessForcesViewOnly
                          ? onOpenFullBracketModal
                            ? 'View bracket'
                            : 'View/Print'
                          : bracket.status === 'in_progress' && entriesStillAccepted
                            ? 'Edit bracket'
                            : onOpenFullBracketModal
                              ? 'View bracket'
                              : 'View/Print';
                    return (
                    <React.Fragment key={bracket.id}>
                    {showInHeader && (
                      <tr className="bg-white" data-testid="brackets-section-in-pool">
                        <td colSpan={6} className="px-4 pt-2 pb-2 border-b border-gray-100 text-left">
                          <div
                            className="flex flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1 text-gray-900"
                            style={poolSectionFontStyle}
                          >
                            <CheckCircle className={`${poolBannerIconClass} text-green-600`} aria-hidden />
                            <strong className={poolBannerHeadingClass}>{inPoolCopy.header}</strong>
                            {inPoolCopy.detail ? (
                              <span className={`hidden md:inline ${poolBannerDetailClass}`}>
                                — {inPoolCopy.detail}
                              </span>
                            ) : null}
                            {inPoolCopy.detail ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPoolBannerExpanded((prev) =>
                                    prev === 'in-pool' ? null : 'in-pool',
                                  )
                                }
                                className="inline-flex shrink-0 rounded-md p-0.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
                                aria-label={`More about ${inPoolCopy.header}`}
                                aria-expanded={poolBannerExpanded === 'in-pool'}
                                data-testid="brackets-section-in-pool-info"
                              >
                                <Info className="h-4 w-4" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          {poolBannerExpanded === 'in-pool' && inPoolCopy.detail ? (
                            <div className="relative mt-2 rounded bg-blue-50 p-2 pr-8 text-sm text-gray-700 md:hidden">
                              <button
                                type="button"
                                onClick={() => setPoolBannerExpanded(null)}
                                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                                aria-label="Close section message"
                                data-testid="brackets-section-in-pool-close"
                              >
                                <X className="h-4 w-4" aria-hidden />
                              </button>
                              <div>{renderMessageWithLineBreaks(inPoolCopy.detail)}</div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                    {showOutHeader && (
                      <tr className="bg-white" data-testid="brackets-section-out-pool">
                        <td
                          colSpan={6}
                          className={`px-4 pb-2 border-b border-gray-100 text-left ${
                            index > 0 && prevInPool ? 'pt-8 border-t-2 border-gray-300' : 'pt-2'
                          }`}
                        >
                          <div
                            className="flex flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1 text-gray-900"
                            style={poolSectionFontStyle}
                          >
                            <Clock className={`${poolBannerIconClass} text-yellow-500`} aria-hidden />
                            <strong className={poolBannerHeadingClass}>{outPoolCopy.header}</strong>
                            {outPoolCopy.detail ? (
                              <span className={`hidden md:inline ${poolBannerDetailClass}`}>
                                — {outPoolCopy.detail}
                              </span>
                            ) : null}
                            {outPoolCopy.detail ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPoolBannerExpanded((prev) =>
                                    prev === 'out-pool' ? null : 'out-pool',
                                  )
                                }
                                className="inline-flex shrink-0 rounded-md p-0.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
                                aria-label={`More about ${outPoolCopy.header}`}
                                aria-expanded={poolBannerExpanded === 'out-pool'}
                                data-testid="brackets-section-out-pool-info"
                              >
                                <Info className="h-4 w-4" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          {poolBannerExpanded === 'out-pool' && outPoolCopy.detail ? (
                            <div className="relative mt-2 rounded bg-blue-50 p-2 pr-8 text-sm text-gray-700 md:hidden">
                              <button
                                type="button"
                                onClick={() => setPoolBannerExpanded(null)}
                                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                                aria-label="Close section message"
                                data-testid="brackets-section-out-pool-close"
                              >
                                <X className="h-4 w-4" aria-hidden />
                              </button>
                              <div>{renderMessageWithLineBreaks(outPoolCopy.detail)}</div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                    <tr className={`hover:bg-gray-50 ${isDeletedRow ? 'bg-gray-50/80' : ''}`}>
                      <td className="px-4 py-3 text-left align-top max-md:max-w-[7.25rem] max-md:min-w-0 max-md:pr-2">
                        {(() => {
                          const rawEntryName = bracket.entryName || `Bracket #${index + 1}`;
                          const mobileNameLines = computeMyPicksEntryNameMobileLines(rawEntryName);
                          return (
                        <div>
                          <div
                            className={`inline-flex max-w-full cursor-pointer flex-row items-start px-2 py-1 rounded-full text-xs font-medium md:items-center ${getStatusColor(bracket.status)}`}
                            onClick={() => openBracketFromLandingRow(bracket)}
                            title={rowOpenTitle}
                          >
                            <span className="mt-0.5 shrink-0 md:mt-0">{getStatusIcon(bracket.status)}</span>
                            <span
                              className="ml-1 min-w-0 text-left md:max-w-none md:whitespace-normal"
                              title={rawEntryName}
                            >
                              <span className="md:hidden">
                                {mobileNameLines.map((line, li) => (
                                  <React.Fragment key={li}>
                                    {li > 0 ? <br /> : null}
                                    {line}
                                  </React.Fragment>
                                ))}
                              </span>
                              <span className="hidden md:inline">{rawEntryName}</span>
                            </span>
                          </div>
                        </div>
                          );
                        })()}
                      </td>
                      <td className="hidden px-4 py-3 whitespace-nowrap text-center text-xs font-medium tabular-nums text-gray-500 md:table-cell">
                        <span data-testid="bracket-row-entry-id" title={`Bracket ID ${String(number).padStart(6, '0')}`}>
                          {String(number).padStart(6, '0')}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 whitespace-nowrap text-center md:table-cell">
                        <div
                          className={`inline-flex cursor-pointer items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(bracket.status)}`}
                          onClick={() => openBracketFromLandingRow(bracket)}
                          title={rowOpenTitle}
                        >
                          <span>{getStatusText(bracket.status)}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-center align-middle md:table-cell">
                        {bracket.status === 'submitted' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span title="Submitted — complete">
                              <CheckCircle
                                className="h-6 w-6 text-green-600"
                                aria-label="Submitted — bracket complete"
                              />
                            </span>
                            {venmoUser && (
                              <span
                                title={
                                  bracket.paymentStatus === 'paid'
                                    ? 'Payment Confirmed'
                                    : bracket.paymentStatus === 'pending'
                                      ? 'Payment Pending'
                                      : 'Not Paid'
                                }
                              >
                                <DollarSign
                                  className={`h-5 w-5 ${
                                    bracket.paymentStatus === 'paid'
                                      ? 'text-green-600'
                                      : bracket.paymentStatus === 'pending'
                                        ? 'text-yellow-500'
                                        : 'text-gray-400'
                                  }`}
                                  aria-hidden
                                />
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center space-y-1 mx-auto" style={{ width: 'fit-content' }}>
                            <div className="text-xs text-gray-600">
                              {progress.completed} / {progress.total} picks
                            </div>
                            <div className="bg-gray-200 rounded-full h-2" style={{ width: '60px' }}>
                              <div
                                className={`${getProgressBarFillClass(bracket.status)} h-2 rounded-full transition-all duration-300`}
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center max-md:px-2">
                        {/*
                          Desktop: one row TL, BL, TR, BR (unchanged).
                          Mobile (&lt; md): 2×2 grid TL / TR on top, BL / BR below (order utilities only apply below md).
                        */}
                        <div className="mx-auto grid w-max grid-cols-2 place-items-center max-md:gap-1 md:flex md:w-auto md:flex-row md:items-center md:justify-center md:gap-1">
                          {/* Top Left */}
                          <div
                            className={`max-md:order-1 md:order-none flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded md:h-8 md:w-8 ${
                              finalFour.championId &&
                              finalFour.topLeftId === finalFour.championId
                                ? 'bg-gray-100 max-md:bg-amber-100'
                                : 'bg-gray-100'
                            } ${
                            finalFour.topLeftId && (finalFour.topLeftId === finalFour.finalist1Id || finalFour.topLeftId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}
                          >
                            <FinalFourLogo logoPath={finalFour.topLeft} teamName={finalFour.topLeftName} />
                          </div>
                          {/* Bottom Left */}
                          <div
                            className={`max-md:order-3 md:order-none flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded ${
                              finalFour.championId &&
                              finalFour.bottomLeftId === finalFour.championId
                                ? 'bg-gray-100 max-md:bg-amber-100'
                                : 'bg-gray-100'
                            } ${
                            finalFour.bottomLeftId && (finalFour.bottomLeftId === finalFour.finalist1Id || finalFour.bottomLeftId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}
                          >
                            <FinalFourLogo logoPath={finalFour.bottomLeft} teamName={finalFour.bottomLeftName} />
                          </div>
                          {/* Top Right */}
                          <div
                            className={`max-md:order-2 md:order-none flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded ${
                              finalFour.championId &&
                              finalFour.topRightId === finalFour.championId
                                ? 'bg-gray-100 max-md:bg-amber-100'
                                : 'bg-gray-100'
                            } ${
                            finalFour.topRightId && (finalFour.topRightId === finalFour.finalist1Id || finalFour.topRightId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}
                          >
                            <FinalFourLogo logoPath={finalFour.topRight} teamName={finalFour.topRightName} />
                          </div>
                          {/* Bottom Right */}
                          <div
                            className={`max-md:order-4 md:order-none flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded ${
                              finalFour.championId &&
                              finalFour.bottomRightId === finalFour.championId
                                ? 'bg-gray-100 max-md:bg-amber-100'
                                : 'bg-gray-100'
                            } ${
                            finalFour.bottomRightId && (finalFour.bottomRightId === finalFour.finalist1Id || finalFour.bottomRightId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}
                          >
                            <FinalFourLogo logoPath={finalFour.bottomRight} teamName={finalFour.bottomRightName} />
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-center md:table-cell">
                        <div className="flex justify-center">
                          <div className={`w-10 h-10 flex items-center justify-center overflow-hidden rounded border-2 ${
                            finalFour.champion
                              ? 'bg-green-50 border-green-600'
                              : 'bg-gray-100 border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.champion} teamName={finalFour.championName} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium max-md:align-top max-md:px-2">
                        {/*
                          In a table row, all cells share the row height (often set by Entry / Final Four).
                          Grid default align-content: stretch distributes extra height between row tracks,
                          which blows apart a 2×2 button layout — content-start + items-start keeps rows tight.
                        */}
                        <div className="mx-auto grid w-max grid-cols-2 justify-items-center max-md:content-start max-md:items-start max-md:gap-1 md:mx-0 md:flex md:w-auto md:max-w-none md:flex-wrap md:items-center md:justify-center md:gap-2">
                          {/* Action buttons - icon-only squares with tooltips; 2×2 grid on mobile, row on md+ */}
                          {renderRowActionButtons(bracket, number, submitDisabledReason, accessForcesViewOnly)}
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </div>
      </div>
      </>
      )}

      {/* Edit profile (display name) */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          data-testid="profile-edit-modal"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 id="profile-modal-title" className="text-lg font-semibold text-gray-900">
                Edit profile information
              </h2>
              <button
                type="button"
                onClick={closeProfileModal}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {profileLoading ? (
              <p className="text-sm text-gray-600">Loading…</p>
            ) : profileLoadError ? (
              <p className="text-sm text-red-600">{profileLoadError}</p>
            ) : profileDetails ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="profile-display-name" className="block text-sm font-medium text-gray-700">
                    Display name
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={profileDisplayName}
                    onChange={(e) => setProfileDisplayName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    data-testid="profile-display-name-input"
                    autoComplete="name"
                  />
                </div>

                <dl className="space-y-3 border-t border-gray-100 pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Account created</dt>
                    <dd className="text-right text-gray-900">
                      {new Date(profileDetails.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'long',
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Email</dt>
                    <dd className="text-right break-all text-gray-900">{profileDetails.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Tournaments played</dt>
                    <dd className="text-right text-gray-900">{profileDetails.tournamentsPlayed}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Brackets entered</dt>
                    <dd className="text-right text-gray-900">{profileDetails.bracketsEntered}</dd>
                  </div>
                </dl>

                {profileSaveError && (
                  <p className="text-sm text-red-600" data-testid="profile-save-error">
                    {profileSaveError}
                  </p>
                )}

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    disabled={profileSaving}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveProfileDisplayName}
                    disabled={profileSaving || !profileDisplayName.trim()}
                    data-testid="profile-save-button"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Email Confirmation Dialog */}
      {emailDialogOpen && emailBracket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {siteConfig?.emailWindowTitle || 'Email Bracket PDF'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {(siteConfig?.emailWindowMessage || 'Would you like to send yourself an email with a PDF of your bracket?')
                .replace(/\{Entry Name\}/g, emailBracket.entryName || `Bracket ${emailBracket.id}`)
                .replace(/\{email\}/g, session?.user?.email || 'your email address')}
            </p>
            {emailMessage && (
              <div className={`mb-4 p-3 rounded ${
                emailMessage.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <p className="text-sm">{emailMessage.text}</p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setEmailDialogOpen(false);
                  setEmailBracket(null);
                  setEmailMessage(null);
                }}
                disabled={isSendingEmail}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmEmailBracket}
                disabled={isSendingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament year picker (from logo year tile) */}
      {yearPickerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="picks-year-picker-title"
          data-testid="picks-year-picker-modal"
          onClick={() => setYearPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="picks-year-picker-title"
              className="text-lg font-bold text-gray-900"
            >
              Select tournament year
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Prior years are read-only. Only {activeYear} accepts new picks.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {yearOptions.map((y) => {
                const isCurrentContest = y === activeYear;
                const isSelected = y === viewingYear;
                return (
                  <button
                    key={y}
                    type="button"
                    data-testid={`picks-year-option-${y}`}
                    onClick={() => {
                      onViewingYearChange?.(y);
                      setYearPickerOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <span>
                      {y}
                      {isCurrentContest ? ' (current)' : ''}
                    </span>
                    {isSelected && <span className="text-blue-600">Selected</span>}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setYearPickerOpen(false)}
              data-testid="picks-year-picker-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Venmo Payment Modal */}
      {venmoUser && (
        <PaymentModal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          unpaidBrackets={unpaidSubmittedBrackets.map((b) => ({
            id: b.id,
            entryName: b.entryName || `Bracket`,
            bracketNumber: (b as unknown as { bracketNumber?: number }).bracketNumber,
          }))}
          entryCost={entryCost}
          venmoUser={venmoUser}
          onPaymentCreated={() => {
            setPayModalOpen(false);
            onPaymentCreated?.();
          }}
        />
      )}

      {/* Email Status Message */}
      {emailMessage && !emailDialogOpen && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          emailMessage.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p className="text-sm font-medium">{emailMessage.text}</p>
        </div>
      )}

    </div>
  );
}
