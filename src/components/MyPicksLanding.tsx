'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
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
import {
  countValidBracketPicks,
  getValidChampionId,
} from '@/lib/bracketPickValidity';
import { LoggedButton } from '@/components/LoggedButton';
import CmsText from '@/components/cms/CmsText';
import { cmsPlainText } from '@/lib/cms/lineBreaks';
import { useServerTime } from '@/hooks/useServerTime';
import {
  getAvailablePaymentMethods,
  isPaymentMasterAllowed,
  normalizePaymentProviderConfig,
} from '@/lib/payments/paymentProviders';
import {
  evaluateVintageActionLock,
  formatVintagePriorYearMessage,
  type VintageActionLockResult,
} from '@/lib/services/vintageActionLock';
import { useIsMdUp } from '@/hooks/useIsMdUp';
import type { VintageBracketEditorContent } from '@/lib/vintage/bracketEditorContent';
import { formatEmailCopy, type VintagePdfDialogCopy } from '@/lib/vintage/emailsContent';
import {
  formatMessageBoxText,
  formatVintagePicksLabel,
  messageBoxCssVars,
  vintagePicksChromeCssVars,
  type VintageMessageBoxStateKey,
  type VintagePicksContent,
  type VintagePicksLabelsCopy,
} from '@/lib/vintage/picksContent';
import { formatCopy } from '@/lib/vintage/copyTree';
import ConfirmDialog from '@/components/vintage/feedback/ConfirmDialog';
import LoadingBasketball from '@/components/vintage/feedback/LoadingBasketball';
import '@/components/vintage/feedback/feedback.css';
import {
  standingsPickResultA11yPhrases,
  standingsResultChromeStyle,
  type VintageStandingsContent,
} from '@/lib/vintage/standingsContent';
import {
  emptyPickResultKeyContext,
  formatStandingsPickAccessibleName,
  resolvePickResultTone,
  type PickResultKeyContext,
} from '@/lib/pickResultChrome';
import PicksEditGear from '@/components/vintage/picks/PicksEditGear';
import PicksConfirmModal from '@/components/vintage/picks/PicksConfirmModal';
import PicksActionTip from '@/components/vintage/picks/PicksActionTip';
import './vintage/picks/picks.css';

const PaymentModal = dynamic(() => import('@/components/bracket/PaymentModal'), {
  ssr: false,
  loading: () => <LoadingBasketball variant="plain" testId="payment-modal-loading" />,
});

/** Row icon actions → My Picks CMS label fields (accessible names and tooltips). */
const PICKS_ACTION_LABEL_FIELDS = {
  view: 'actionView',
  edit: 'actionEdit',
  return: 'actionReturn',
  copy: 'actionCopy',
  email: 'actionEmail',
  submit: 'actionSubmit',
  delete: 'actionDelete',
  restore: 'actionRestore',
  permanentDelete: 'actionPermanentDelete',
} as const satisfies Record<string, keyof VintagePicksLabelsCopy>;

type PicksActionKey = keyof typeof PICKS_ACTION_LABEL_FIELDS;

/** Row action button class; colors come from CMS CSS vars via `data-vp-action`. */
const ROW_ACTION_CLASS = 'v-picks__action-btn flex items-center justify-center';

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
  /** Published My Picks CMS copy (timer, flavors for header/pool/empty). */
  picksCopy: VintagePicksContent;
  /**
   * Published Standings CMS — shared FF/Champ result chrome (colors, sizes, border width).
   */
  standingsChrome: VintageStandingsContent;
  /** Published Bracket Editor Messages (duplicate-name / readiness hints on Submit). */
  bracketEditorCopy: VintageBracketEditorContent;
  /** Published Emails & Account → Email PDF dialog copy. */
  pdfDialogCopy: VintagePdfDialogCopy;
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
  liveTourneyMessage: string;
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
  /** While set, Copy is in flight for that bracket (and other mutations lock). */
  copyingBracketId?: string | null;
  /** While set, Restore is in flight for that bracket (and other mutations lock). */
  restoringBracketId?: string | null;
  /** While true, New Bracket is in flight (and row mutations lock). */
  creatingBracketBusy?: boolean;
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
  /** Payment provider settings (Key Data). */
  siteConfig: SiteConfigData | null;
  /** Year currently displayed (from `?year=` or active year). */
  viewingYear?: number;
  /** Active tournament year from homepage Key Data (only this year accepts mutations). */
  activeYear: number;
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
  fillCell = false,
}: {
  logoPath: string | null;
  /** Team name for the image alt text when known. */
  teamName?: string | null;
  /** Vintage cells size the image from the tile via CSS (`--vs-logo-fill`); legacy keeps the 22px cap. */
  fillCell?: boolean;
}) {
  const [imageError, setImageError] = React.useState(false);

  if (!logoPath || imageError) {
    return <span className="text-gray-400 text-xs">?</span>;
  }

  return (
    <Image
      src={logoPath}
      alt=""
      width={fillCell ? 64 : 24}
      height={fillCell ? 64 : 24}
      className={fillCell ? undefined : 'max-h-[22px] max-w-[22px] object-contain'}
      onError={() => setImageError(true)}
      unoptimized
    />
  );
});

export default function MyPicksLanding({
  picksCopy,
  standingsChrome,
  bracketEditorCopy,
  pdfDialogCopy,
  tipoffAt = '',
  bracketsReadyAt = '',
  liveTourneyMessage,
  admin = false,
  brackets = [],
  onCreateNew,
  onEditBracket,
  onDeleteBracket,
  onCopyBracket,
  onSubmitBracket,
  submittingBracketId = null,
  copyingBracketId = null,
  restoringBracketId = null,
  creatingBracketBusy = false,
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
  viewingYear: viewingYearProp,
  activeYear,
  availableYears = [],
  onViewingYearChange,
  isYearSwitching = false,
  onOpenFullBracketModal,
  onPaymentCreated,
}: MyPicksLandingProps) {
  const { data: session, update: updateSession } = useSession();
  const { fetchWithCSRF } = useCSRF();
  /** In-pool / out-of-pool table section: optional detail shown after clicking the info icon. */
  const [poolBannerExpanded, setPoolBannerExpanded] = useState<'in-pool' | 'out-pool' | null>(null);
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
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{
    email: string;
    createdAt: string;
    tournamentsPlayed: number;
    bracketsEntered: number;
  } | null>(null);
  const { getServerNowMs } = useServerTime();
  /** Layout renders only the matching breakpoint so test ids stay unique. */
  const isMdUp = useIsMdUp();
  const viewportSuffix: 'desktop' | 'mobile' = isMdUp ? 'desktop' : 'mobile';
  /** KEY-derived chrome for FF / Champ (shared with Standings). */
  const [resultKeyContext, setResultKeyContext] = useState<PickResultKeyContext>(
    () => emptyPickResultKeyContext(),
  );

  // Viewing year from parent URL / props
  const viewingYear = viewingYearProp ?? activeYear;
  const isHistoricalView = viewingYear !== activeYear;

  /**
   * Load KEY regional / semi / champ winners + eliminated list for result chrome.
   */
  useEffect(() => {
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
  }, [viewingYear]);

  /** Current vs historic editorial flavor for vintage landing copy. */
  const picksFlavor = isHistoricalView
    ? picksCopy.flavors.historic
    : picksCopy.flavors.current;
  const picksTokenVars = { year: viewingYear, activeYear };
  const labels = picksCopy.labels;
  const feedback = picksCopy.feedback;
  const profileCopy = picksCopy.profile;
  /** CMS accessible name / tooltip for a row icon action. */
  const picksActionLabel = (key: PicksActionKey): string => labels[PICKS_ACTION_LABEL_FIELDS[key]];

  /** Shared Standings CMS hover / aria phrases for FF + Champ tiles. */
  const pickResultA11y = useMemo(
    () => standingsPickResultA11yPhrases(standingsChrome),
    [standingsChrome],
  );

  const priorYearBannerMessage = useMemo(
    () => formatVintagePriorYearMessage(picksCopy, viewingYear, activeYear),
    [picksCopy, viewingYear, activeYear],
  );

  /** Changing-action gate (vintage Action Lock master reference). */
  const picksAccess = useMemo(
    (): VintageActionLockResult =>
      evaluateVintageActionLock({
        action: 'changing',
        bracketYear: viewingYear,
        activeYear,
        picksCopy,
        tipoffAt,
        bracketsReadyAt,
        tournamentJsonPresent: Boolean(tournamentData),
        nowMs: getServerNowMs(),
      }),
    [
      picksCopy,
      tipoffAt,
      bracketsReadyAt,
      activeYear,
      viewingYear,
      tournamentData,
      getServerNowMs,
    ],
  );

  const accessBlockMessage =
    picksAccess.message ||
    formatVintagePicksLabel(picksCopy.masterLockMessage, { year: activeYear });

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

  const entryCost = picksCopy.entryCost;

  const paymentConfig = useMemo(
    () =>
      normalizePaymentProviderConfig({
        enablePayCapability: siteConfig?.enablePayCapability,
        enableVenmo: siteConfig?.enableVenmo,
        enableZelle: siteConfig?.enableZelle,
        venmoUser: siteConfig?.venmoUser,
        zelleDisplayName: siteConfig?.zelleDisplayName,
        zelleEmail: siteConfig?.zelleEmail,
        zellePhone: siteConfig?.zellePhone,
        zelleQrEnabled: siteConfig?.zelleQrEnabled,
        zelleQrImageSrc: siteConfig?.zelleQrImageSrc,
      }),
    [siteConfig],
  );

  const availablePaymentMethods = useMemo(
    () => getAvailablePaymentMethods(paymentConfig, isCurrentUserAdmin),
    [paymentConfig, isCurrentUserAdmin],
  );

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/check-admin')
      .then((r) => r.json())
      .then((d) => setIsCurrentUserAdmin(d.isAdmin || false))
      .catch(() => setIsCurrentUserAdmin(false));
  }, [session?.user?.email]);

  /**
   * Why Pay is disabled (hover / title). Null when Pay can open the payment modal.
   * Additional-only payments are allowed even with zero unpaid brackets.
   */
  const payDisabledReason = useMemo(() => {
    if (isHistoricalView) {
      return formatCopy(labels.payPriorYearMessage, { activeYear });
    }
    if (!isPaymentMasterAllowed(paymentConfig, isCurrentUserAdmin)) {
      return labels.payAdminOnlyMessage;
    }
    if (availablePaymentMethods.length === 0) {
      return labels.payNoMethodsMessage;
    }
    return null;
  }, [
    isHistoricalView,
    activeYear,
    paymentConfig,
    isCurrentUserAdmin,
    availablePaymentMethods.length,
    labels,
  ]);
  const payEnabled = payDisabledReason === null;

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

  /** True when every status is included — “All” mode (individuals look unshaded). */
  const allStatusFiltersOn =
    statusVisibility.submitted && statusVisibility.in_progress && statusVisibility.deleted;

  /**
   * Toggle a single status chip.
   * From All mode, the first click enters filter mode with only that status on
   * (so the chip acts as a filter, not an “unfilter”). Further clicks toggle
   * each status independently; turning all three on returns to All mode.
   *
   * @param key - Status flag to toggle
   */
  const toggleStatusFilter = useCallback(
    (key: keyof BracketStatusVisibility) => {
      updateStatusVisibility((prev) => {
        const inAllMode = prev.submitted && prev.in_progress && prev.deleted;
        if (inAllMode) {
          return {
            submitted: key === 'submitted',
            in_progress: key === 'in_progress',
            deleted: key === 'deleted',
          };
        }
        return { ...prev, [key]: !prev[key] };
      });
    },
    [updateStatusVisibility],
  );

  /**
   * Bracket progress: only count picks that are still valid for their live matchup
   * (orphan winners after a changed upstream pick do not count).
   */
  const calculateProgress = (picks: { [gameId: string]: string }) => {
    if (!tournamentData || !emptyBracketTemplate) {
      const totalGames = 63;
      const completedPicks = Object.keys(picks).filter(
        (key) => picks[key] && picks[key] !== '',
      ).length;
      return {
        completed: completedPicks,
        total: totalGames,
        percentage: (completedPicks / totalGames) * 100,
      };
    }
    return countValidBracketPicks(emptyBracketTemplate, picks, tournamentData);
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
    
    // Champion only when still a valid title-game participant (not an orphan pick).
    const championId =
      tournamentData && emptyBracketTemplate
        ? getValidChampionId(emptyBracketTemplate, picks, tournamentData)
        : picks['championship'] || null;

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
      const response = await fetchWithCSRF('/api/bracket/email-pdf', {
        method: 'POST',
        body: JSON.stringify({ bracketId: emailBracket.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailMessage({ type: 'success', text: pdfDialogCopy.successMessage });
        setEmailDialogOpen(false);
        setTimeout(() => setEmailMessage(null), 5000);
      } else {
        setEmailMessage({ type: 'error', text: pdfDialogCopy.failureMessage });
        console.error('Email error details:', data);
      }
    } catch (error) {
      setEmailMessage({ type: 'error', text: pdfDialogCopy.failureMessage });
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

  /** CMS status name for a row. */
  const getStatusText = (status: string) => {
    if (status === 'submitted') return labels.statusSubmitted;
    if (status === 'deleted') return labels.statusDeleted;
    return labels.statusInProgress;
  };

  /** First word of the display name (mobile welcome line). */
  const getFirstName = (fullName: string | null | undefined) => (fullName || '').split(' ')[0];

  // Calculate submitted and in-progress brackets count
  const getBracketsInfo = () => {
    const submittedCount = bracketsForYear.filter((bracket) => bracket.status === 'submitted').length;
    const inProgressCount = bracketsForYear.filter((bracket) => bracket.status === 'in_progress').length;
    const deletedCount = bracketsForYear.filter((bracket) => bracket.status === 'deleted').length;
    const totalCost = submittedCount * entryCost;
    return { submittedCount, inProgressCount, deletedCount, totalCost, entryCost };
  };

  /**
   * Header status copy based on bracket counts (My Picks CMS flavor cost lines).
   * Returns null when New Bracket is disabled and the user has no entries — avoid
   * prompting them to click a disabled control.
   */
  const getDynamicMessage = (): string | null => {
    const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();

    let message = '';
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

    return formatVintagePicksLabel(message, picksTokenVars)
      .replace(/{Submitted}/g, submittedCount.toString())
      .replace(/{In Progress}/g, inProgressCount.toString())
      .replace(/{cost}/g, totalCost.toString());
  };

  const dynamicMessage = getDynamicMessage();

  /** CMS copy with `||` hard line breaks. */
  const renderMessageWithLineBreaks = (message: string) => (
    <CmsText text={message} />
  );

  /**
   * Primary row open from entry name or status chip: read-only full-bracket modal when available
   * (same as the eye icon) for submitted/deleted; in-progress opens the editor while entries are
   * still accepted, otherwise the modal; print layout is only from the modal’s Print View button.
   */
  const openBracketFromLandingRow = (bracket: Bracket) => {
    // Block drill-in while any row mutation / confirm is in flight.
    if (
      creatingBracketBusy ||
      copyingBracketId ||
      restoringBracketId ||
      deletingBracketId ||
      returningBracketId ||
      submittingBracketId ||
      pendingDeleteBracketId ||
      pendingPermanentDeleteBracketId ||
      pendingReturnBracketId
    ) {
      return;
    }
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
   * Target datetime for the My Picks countdown scoreboard:
   * homepage Brackets Ready (pre-publish) or Tourney Tipoff (published).
   */
  const countdownTargetRaw = picksCopy.bracketsPublished
    ? tipoffAt.trim()
    : bracketsReadyAt.trim();

  /** Tipoff has arrived (active tournament) — swap timer for live message. */
  const vintageTourneyLive = useMemo(() => {
    if (!picksCopy.bracketsPublished) return false;
    const tip = Date.parse(tipoffAt);
    if (!Number.isFinite(tip)) return false;
    if (countdownMs !== null && countdownTargetRaw === tipoffAt.trim()) {
      return countdownMs <= 0;
    }
    return getServerNowMs() >= tip;
  }, [
    picksCopy.bracketsPublished,
    tipoffAt,
    countdownMs,
    countdownTargetRaw,
    getServerNowMs,
  ]);

  /**
   * Convert a millisecond duration into HH:MM:SS or MM:SS.
   * Switches to MM:SS once remaining time is under one hour.
   * For long horizons (>100 hours) uses the CMS “N days to go” templates.
   */
  const formatCountdown = (remainingMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 100) {
      const daysAway = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      const template =
        daysAway === 1
          ? picksCopy.countdownDayAwayMessage
          : picksCopy.countdownDaysAwayMessage;
      return template.replace(/\{days\}/g, String(daysAway));
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

  const countdownDisplay = countdownMs !== null ? formatCountdown(countdownMs) : null;
  // Countdown is independent of Application Master Lock (lock is a separate fail-safe).
  const scoreboardTimeDesktop = countdownDisplay || '00:00';
  const scoreboardTimeMobile = scoreboardTimeDesktop;
  const bracketsFieldOpen = picksCopy.bracketsPublished;

  /**
   * Which Message Box CMS state applies for the active side panel.
   */
  const messageBoxStateKey: VintageMessageBoxStateKey = isHistoricalView
    ? 'priorYear'
    : vintageTourneyLive
      ? 'live'
      : bracketsFieldOpen
        ? 'preTipoff'
        : 'preBracket';

  const messageBoxState = picksCopy.messageBox[messageBoxStateKey];

  const messageBoxCountdownToken = isMdUp
    ? scoreboardTimeDesktop
    : scoreboardTimeMobile;

  /** Days remaining when the long-horizon countdown phrase applies (&gt;100 hours). */
  const messageBoxDays =
    countdownMs != null && countdownMs / 3600000 > 100
      ? Math.max(1, Math.ceil(countdownMs / 86400000))
      : undefined;

  const messageBoxTitle = formatMessageBoxText(messageBoxState.title, {
    year: viewingYear,
    activeYear,
    days: messageBoxDays,
    countdown: messageBoxCountdownToken,
  });

  const messageBoxMessage = formatMessageBoxText(messageBoxState.message, {
    year: viewingYear,
    activeYear,
    days: messageBoxDays,
    countdown: messageBoxCountdownToken,
  });

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
   * True while any confirm is open or any mutate request is in flight.
   * Used to block multi-click / overlapping Copy, Restore, Return, Delete, Submit, New.
   */
  const rowMutationInFlight = Boolean(
    creatingBracketBusy ||
      copyingBracketId ||
      restoringBracketId ||
      deletingBracketId ||
      returningBracketId ||
      submittingBracketId ||
      pendingDeleteBracketId ||
      pendingPermanentDeleteBracketId ||
      pendingReturnBracketId,
  );

  /**
   * Hover / title while a mutation is pending for this bracket (or globally).
   */
  const rowMutationBusyTitle = (bracketId: string): string | null => {
    if (copyingBracketId === bracketId) return feedback.copyingMessage;
    if (restoringBracketId === bracketId) return feedback.restoringMessage;
    if (deletingBracketId === bracketId) return feedback.deletingMessage;
    if (returningBracketId === bracketId) return feedback.returningMessage;
    if (submittingBracketId === bracketId) return feedback.submittingMessage;
    if (creatingBracketBusy) return feedback.creatingMessage;
    if (rowMutationInFlight) return labels.pleaseWaitLabel;
    return null;
  };

  /**
   * Disable reason for a mutating control — access lock or in-flight lock.
   */
  const getMutatingActionDisabledReason = (
    action: 'new' | 'copy' | 'edit' | 'delete' | 'return' | 'restore',
    bracketId?: string,
  ): string | null => {
    const accessReason = getActionDisabledReason(action);
    if (accessReason) return accessReason;
    if (bracketId) {
      const busy = rowMutationBusyTitle(bracketId);
      if (busy) return busy;
    } else if (rowMutationInFlight) {
      return creatingBracketBusy ? feedback.creatingMessage : labels.pleaseWaitLabel;
    }
    return null;
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
    if (submittingBracketId === row.id) return feedback.submittingMessage;
    if (rowMutationInFlight) return rowMutationBusyTitle(row.id) || labels.pleaseWaitLabel;
    if (mutationsBlocked) return accessBlockMessage;
    if (!tournamentData || !emptyBracketTemplate) {
      return formatVintagePicksLabel(picksCopy.bracketsMissingErrorMessage, { year: activeYear });
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
      bracketEditorCopy
    );
    if (!canProceed) {
      return getBracketSubmitReadinessHint(
        tournamentData,
        emptyBracketTemplate,
        picks,
        entry,
        tb,
        bracketEditorCopy
      );
    }
    if (isSubmitDuplicateEntryName(entry, submittedEntryNamesForDuplicateCheck)) {
      return bracketEditorCopy.duplicateNameMessage;
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

  const submittedEntryCountForPoolMessage = useMemo(
    () => bracketsForYear.filter((b) => b.status === 'submitted').length,
    [bracketsForYear]
  );

  /** Pool section banners from the CMS picks flavor (blank header hides the band title). */
  const inPoolCopy = {
    header: formatVintagePicksLabel(picksFlavor.inPoolHeader, picksTokenVars),
    detail: formatInThePoolMessage(
      formatVintagePicksLabel(picksFlavor.inPoolDetail, picksTokenVars),
      submittedEntryCountForPoolMessage
    ),
  };
  const outPoolCopy = {
    header: formatVintagePicksLabel(picksFlavor.outPoolHeader, picksTokenVars),
    detail: formatVintagePicksLabel(picksFlavor.outPoolDetail, picksTokenVars),
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
        throw new Error(String(json.error || res.status));
      }
      setProfileDisplayName(json.data.displayName || '');
      setProfileDetails({
        email: json.data.email,
        createdAt: json.data.createdAt,
        tournamentsPlayed: json.data.tournamentsPlayed,
        bracketsEntered: json.data.bracketsEntered,
      });
    } catch (e) {
      console.error('[My Picks] Profile load failed:', e);
      setProfileLoadError(profileCopy.loadFailed);
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
        throw new Error(String(json.error || res.status));
      }
      await updateSession({ name: json.data.displayName });
      closeProfileModal();
    } catch (e) {
      console.error('[My Picks] Profile save failed:', e);
      setProfileSaveError(profileCopy.saveFailed);
    } finally {
      setProfileSaving(false);
    }
  };

  /** Renders a fresh button instance (desktop + mobile headers each include one). */
  const renderProfileEditButton = (variant: 'desktop' | 'mobile') => (
    <button
      type="button"
      onClick={openProfileModal}
      title={profileCopy.editButtonLabel || undefined}
      aria-label={profileCopy.editButtonLabel || undefined}
      className="v-picks__profile-btn"
      data-testid={`edit-profile-button-${variant}`}
    >
      <Pencil className="h-5 w-5" aria-hidden />
    </button>
  );

  /**
   * Tip label: prefer an explicit disabled reason, else the action’s accessible name.
   */
  const actionTipLabel = (actionKey: PicksActionKey, reason: string | null) =>
    reason || picksActionLabel(actionKey);

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
  ) => {
    const copyDisabledReason = getMutatingActionDisabledReason('copy', bracket.id);
    const deleteDisabledReason = getMutatingActionDisabledReason('delete', bracket.id);
    const restoreDisabledReason = getMutatingActionDisabledReason('restore', bracket.id);
    const returnDisabledReason = getMutatingActionDisabledReason('return', bracket.id);
    const navLockedReason = rowMutationInFlight
      ? rowMutationBusyTitle(bracket.id) || labels.pleaseWaitLabel
      : null;
    const editDisabledReason =
      navLockedReason || getInProgressEditButtonDisabledReason();
    const pad = number ? String(number).padStart(6, '0') : null;
    /* Size comes from CSS (matches Final Four tile); class is a Lucide default fallback. */
    const iconClass = 'h-4 w-4';

    /**
     * Wrap a row action with tooltip + accessible name.
     */
    const tip = (key: PicksActionKey, reason: string | null, node: React.ReactNode) => (
      <PicksActionTip label={actionTipLabel(key, reason)}>{node}</PicksActionTip>
    );

    return (
      <>
        {bracket.status === 'in_progress' ? (
          <>
            {accessForcesViewOnly
              ? tip(
                  'view',
                  navLockedReason,
                  <LoggedButton
                    onClick={() => !navLockedReason && handleEyeOpenFullBracketOrPrint(bracket)}
                    logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                    bracketId={pad}
                    disabled={Boolean(navLockedReason)}
                    className={ROW_ACTION_CLASS}
                    data-vp-action="view"
                    aria-label={actionTipLabel('view', navLockedReason)}
                  >
                    <Eye className={iconClass} aria-hidden />
                  </LoggedButton>,
                )
              : tip(
                  'edit',
                  editDisabledReason,
                  <LoggedButton
                    onClick={() => !editDisabledReason && onEditBracket(bracket)}
                    logLocation="Edit"
                    bracketId={pad}
                    disabled={Boolean(editDisabledReason)}
                    className={ROW_ACTION_CLASS}
                    data-vp-action="edit"
                    aria-label={actionTipLabel('edit', editDisabledReason)}
                  >
                    <Edit className={iconClass} aria-hidden />
                  </LoggedButton>,
                )}
            {tip(
              'submit',
              submitDisabledReason,
              <LoggedButton
                onClick={() => {
                  if (!submitDisabledReason) void onSubmitBracket(bracket);
                }}
                logLocation="Submit"
                bracketId={pad}
                disabled={Boolean(submitDisabledReason)}
                aria-busy={submittingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${submittingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="submit-bracket-landing-button"
                data-vp-action="submit"
                aria-label={actionTipLabel('submit', submitDisabledReason)}
              >
                <Send className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'copy',
              copyDisabledReason,
              <LoggedButton
                onClick={() => !copyDisabledReason && onCopyBracket(bracket)}
                logLocation="Copy"
                bracketId={pad}
                disabled={Boolean(copyDisabledReason)}
                aria-busy={copyingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${copyingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="copy-bracket-button"
                data-vp-action="copy"
                aria-label={actionTipLabel('copy', copyDisabledReason)}
              >
                <Copy className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'delete',
              deleteDisabledReason,
              <LoggedButton
                onClick={() => !deleteDisabledReason && onDeleteBracket(bracket.id)}
                logLocation="Delete"
                bracketId={pad}
                disabled={Boolean(deleteDisabledReason)}
                aria-busy={deletingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${deletingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="delete-bracket-button"
                data-vp-action="delete"
                aria-label={actionTipLabel('delete', deleteDisabledReason)}
              >
                <Trash2 className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
          </>
        ) : bracket.status === 'deleted' ? (
          <>
            {tip(
              'view',
              navLockedReason,
              <LoggedButton
                onClick={() => !navLockedReason && handleEyeOpenFullBracketOrPrint(bracket)}
                logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                bracketId={pad}
                disabled={Boolean(navLockedReason)}
                className={ROW_ACTION_CLASS}
                data-testid="print-deleted-bracket-button"
                data-vp-action="view"
                aria-label={actionTipLabel('view', navLockedReason)}
              >
                <Eye className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'copy',
              copyDisabledReason,
              <LoggedButton
                onClick={() => !copyDisabledReason && onCopyBracket(bracket)}
                logLocation="Copy"
                bracketId={pad}
                disabled={Boolean(copyDisabledReason)}
                aria-busy={copyingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${copyingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="copy-deleted-bracket-button"
                data-vp-action="copy"
                aria-label={actionTipLabel('copy', copyDisabledReason)}
              >
                <Copy className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'restore',
              restoreDisabledReason,
              <LoggedButton
                onClick={() => {
                  if (!restoreDisabledReason && onRestoreBracket) {
                    onRestoreBracket(bracket.id);
                  }
                }}
                logLocation="Restore"
                bracketId={pad}
                disabled={Boolean(restoreDisabledReason)}
                aria-busy={restoringBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${restoringBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="restore-bracket-button"
                data-vp-action="restore"
                aria-label={actionTipLabel('restore', restoreDisabledReason)}
              >
                <RotateCcw className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'permanentDelete',
              deleteDisabledReason,
              <LoggedButton
                onClick={() =>
                  !deleteDisabledReason &&
                  onPermanentDeleteClick &&
                  onPermanentDeleteClick(bracket.id)
                }
                logLocation="PermanentDelete"
                bracketId={pad}
                disabled={Boolean(deleteDisabledReason)}
                aria-busy={deletingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${deletingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="permanent-delete-bracket-button"
                data-vp-action="permanentDelete"
                aria-label={actionTipLabel('permanentDelete', deleteDisabledReason)}
              >
                <Trash2 className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
          </>
        ) : (
          <>
            {tip(
              'view',
              navLockedReason,
              <LoggedButton
                onClick={() => !navLockedReason && handleEyeOpenFullBracketOrPrint(bracket)}
                logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                bracketId={pad}
                disabled={Boolean(navLockedReason)}
                className={ROW_ACTION_CLASS}
                data-testid="print-bracket-button"
                data-vp-action="view"
                aria-label={actionTipLabel('view', navLockedReason)}
              >
                <Eye className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'return',
              returnDisabledReason,
              <LoggedButton
                onClick={() =>
                  !returnDisabledReason &&
                  onReturnBracketClick &&
                  onReturnBracketClick(bracket.id)
                }
                logLocation="Return"
                bracketId={pad}
                disabled={Boolean(returnDisabledReason)}
                aria-busy={returningBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${returningBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="return-bracket-button"
                data-vp-action="return"
                aria-label={actionTipLabel('return', returnDisabledReason)}
              >
                <Undo2 className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'copy',
              copyDisabledReason,
              <LoggedButton
                onClick={() => !copyDisabledReason && onCopyBracket(bracket)}
                logLocation="Copy"
                bracketId={pad}
                disabled={Boolean(copyDisabledReason)}
                aria-busy={copyingBracketId === bracket.id || undefined}
                className={`${ROW_ACTION_CLASS}${copyingBracketId === bracket.id ? ' is-busy' : ''}`}
                data-testid="copy-bracket-button"
                data-vp-action="copy"
                aria-label={actionTipLabel('copy', copyDisabledReason)}
              >
                <Copy className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
            {tip(
              'email',
              navLockedReason,
              <LoggedButton
                onClick={() => !navLockedReason && handleEmailBracket(bracket)}
                logLocation="Email"
                bracketId={pad}
                disabled={Boolean(navLockedReason)}
                className={ROW_ACTION_CLASS}
                data-testid="email-bracket-button"
                data-vp-action="email"
                aria-label={actionTipLabel('email', navLockedReason)}
              >
                <Mail className={iconClass} aria-hidden />
              </LoggedButton>,
            )}
          </>
        )}
      </>
    );
  };

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
   * Season-panel year column: visible Year label + cream dropdown (fixed geometry).
   * Native select: calls `onViewingYearChange` directly (no year-picker modal).
   */
  const renderVintageYearSelect = () => {
    const canPickYear =
      Boolean(onViewingYearChange) && !isYearSwitching && !rowMutationInFlight;
    const selectId = `picks-year-select-${viewportSuffix}`;
    return (
      <div className="v-picks__year" data-testid={`picks-year-control-${viewportSuffix}`}>
        {labels.yearLabel ? (
          <label className="v-picks__year-label" htmlFor={selectId}>
            {labels.yearLabel}
          </label>
        ) : null}
        <div className="v-picks__select-wrap">
          <select
            id={selectId}
            className="v-picks__select"
            value={viewingYear}
            disabled={!canPickYear}
            aria-busy={isYearSwitching || undefined}
            onChange={(e) => onViewingYearChange?.(Number(e.target.value))}
            title={
              (rowMutationInFlight
                ? labels.pleaseWaitLabel
                : isYearSwitching
                  ? labels.yearLoadingTooltip
                  : canPickYear
                    ? labels.yearSelectTooltip
                    : '') || undefined
            }
            aria-label={
              formatCopy(labels.yearSelectAriaLabel, { year: viewingYear }) || undefined
            }
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
      <div className="v-picks__ff" role="group" aria-label={labels.finalFourAriaLabel || undefined}>
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
          const accessibleName = formatStandingsPickAccessibleName({
            teamLabel: teamName || pickResultA11y.emptySelection,
            shadeTone,
            isFinalist,
            borderTone,
            phrases: pickResultA11y,
          });
          return (
            <div
              key={slot.sheetIndex}
              className={`v-picks__ff-cell${isFinalist ? ' is-finalist' : ''}`}
              data-status={shadeTone}
              data-border={borderTone}
              title={accessibleName}
              role="img"
              aria-label={accessibleName}
            >
              <FinalFourLogo logoPath={slot.logo} teamName={slot.name} fillCell />
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Champion pick cell — shade vs KEY championship; no finalist black frame.
   * Empty champ uses “?” (same as desktop / FinalFourLogo fallback), never a trophy.
   *
   * @param finalFour - Entry Final Four / champ picks
   * @param showName - When true, show the team name beside the tile (desktop table)
   * @param className - Optional extra class (e.g. mobile card `v-picks__champ--mobile`)
   */
  const renderVintageChampion = (
    finalFour: ReturnType<typeof getFinalFourTeams>,
    showName: boolean,
    className?: string,
  ) => {
    const shadeTone = resolvePickResultTone(
      finalFour.championName ?? '',
      resultKeyContext.finalWinner,
      resultKeyContext.eliminatedTeams,
    );
    const accessibleName = formatStandingsPickAccessibleName({
      teamLabel: finalFour.championName || pickResultA11y.noChampionPick,
      shadeTone: finalFour.champion ? shadeTone : 'pending',
      champ: true,
      phrases: pickResultA11y,
    });
    return (
      <div className={['v-picks__champ', className].filter(Boolean).join(' ')}>
        <div
          className={`v-picks__champ-cell${finalFour.champion ? ' is-set' : ''}`}
          data-status={shadeTone}
          data-border={shadeTone !== 'pending' ? shadeTone : undefined}
          title={accessibleName}
          role="img"
          aria-label={accessibleName}
        >
          <FinalFourLogo logoPath={finalFour.champion} teamName={finalFour.championName} fillCell />
        </div>
        {showName && (
          <span className="v-picks__champ-name">{finalFour.championName || labels.championNotPicked}</span>
        )}
      </div>
    );
  };

  /**
   * Payment badge for submitted rows (Paid / Pending / Unpaid).
   * Desktop: Progress column. Mobile: under the entry name (Status column removed).
   * Non-submitted rows omit the badge (they use under-name status chips instead).
   * Copy/colors from My Picks CMS `payment`.
   *
   * @param bracket - Entry to render payment state for
   */
  const renderVintagePaymentBadge = (bracket: Bracket) => {
    if (bracket.status !== 'submitted') return null;
    const kind =
      bracket.paymentStatus === 'paid'
        ? 'paid'
        : bracket.paymentStatus === 'pending'
          ? 'pending'
          : 'unpaid';
    const badge = picksCopy.payment[kind];
    const showIcon = Boolean(badge.icon.trim());
    return (
      <span
        className={`v-picks__pay-badge v-picks__pay-badge--${kind}`}
        title={badge.caption}
        aria-label={badge.caption}
        data-testid={`picks-pay-badge-${kind}`}
      >
        {showIcon ? (
          <span className="v-picks__pay-badge__icon" aria-hidden>
            {badge.icon}
          </span>
        ) : null}
        <span className="v-picks__pay-badge__caption">{badge.caption}</span>
      </span>
    );
  };

  /**
   * Under-name status chip for mobile non-submitted rows (In Progress / Deleted).
   * Mirrors payment-badge placement under the entry name; submitted rows use payment instead.
   *
   * @param bracket - Entry to render a status chip for
   */
  const renderVintageUnderNameStatusChip = (bracket: Bracket) => {
    if (bracket.status === 'submitted') return null;
    const label = getStatusText(bracket.status);
    return (
      <span
        className={vintageStatusClass(bracket.status)}
        title={label}
        aria-label={label}
        data-testid={`picks-entry-status-chip-${bracket.status}`}
      >
        {renderVintageStatusIcon(bracket.status)}
        <span>{label}</span>
      </span>
    );
  };

  /**
   * Entry name control; optionally stacks under-name meta (mobile only).
   *
   * @param bracket - Row entry
   * @param label - Display entry name
   * @param title - Native tooltip for the name button
   * @param options.showUnderNameMeta - When true, payment under name (submitted) or
   *   In Progress / Deleted chip (non-submitted)
   */
  const renderVintageEntryCell = (
    bracket: Bracket,
    label: string,
    title: string,
    options?: { showUnderNameMeta?: boolean; showPayment?: boolean },
  ) => {
    const locked = rowMutationInFlight;
    const tip = locked ? labels.pleaseWaitLabel : title;
    const showMeta = Boolean(options?.showUnderNameMeta || options?.showPayment);
    return (
      <div className="v-picks__entry">
        <PicksActionTip label={tip}>
          <button
            type="button"
            className="v-picks__entry-name"
            onClick={() => openBracketFromLandingRow(bracket)}
            disabled={locked}
            aria-disabled={locked || undefined}
            aria-label={(locked ? labels.pleaseWaitLabel : title) || label}
          >
            {label}
          </button>
        </PicksActionTip>
        {showMeta
          ? bracket.status === 'submitted'
            ? renderVintagePaymentBadge(bracket)
            : renderVintageUnderNameStatusChip(bracket)
          : null}
      </div>
    );
  };

  /**
   * Entry-row status mark (desktop table): icon only, not clickable.
   * Hover/accessible name carries the status label; Show filters still work separately.
   * Mobile cards omit this column — status chips stack under the entry name instead.
   *
   * @param bracket - Entry to render a status mark for
   */
  const renderVintageStatusMark = (bracket: Bracket) => (
    <span
      className={`${vintageStatusClass(bracket.status)} v-picks__status--square`}
      title={getStatusText(bracket.status)}
      aria-label={getStatusText(bracket.status)}
      role="img"
      data-testid={`picks-status-mark-${bracket.status}`}
    >
      {renderVintageStatusIcon(bracket.status)}
    </span>
  );

  /**
   * Desktop Progress column: payment chip for submitted rows (63/63 is redundant);
   * pick-count bar for in-progress / deleted. Mobile keeps payment under the name.
   *
   * @param bracket - Row entry
   * @param progress - Completed / total pick counts
   */
  const renderVintageProgress = (
    bracket: Bracket,
    progress: ReturnType<typeof calculateProgress>,
  ) => {
    if (bracket.status === 'submitted') {
      return (
        <div className="v-picks__progress v-picks__progress--payment">
          {renderVintagePaymentBadge(bracket)}
        </div>
      );
    }
    return (
      <div className="v-picks__progress">
        <span className="v-picks__progress-text">
          {formatCopy(labels.progressPicksLabel, {
            completed: progress.completed,
            total: progress.total,
          })}
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
      <div className="v-picks__section-inner">
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
              aria-label={
                formatCopy(labels.sectionInfoAriaLabel, { section: copy.header }) ||
                undefined
              }
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
              aria-label={labels.closeSectionMessageAriaLabel || undefined}
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
    const displayName = isMdUp ? session?.user?.name || '' : getFirstName(session?.user?.name);
    const welcome = formatCopy(labels.welcomeLabel, { name: displayName }).trim();
    const vintageHeaderNote = formatVintagePicksLabel(
      picksFlavor.headerNote,
      picksTokenVars
    ).trim();
    const accessIsError =
      picksAccess.reasonCode === 'brackets_missing_json' || picksAccess.reasonCode === 'master_lock';
    return (
      <div className="v-picks__summary">
        <h1 className="v-picks__welcome" data-testid="picks-page-title">
          {welcome ? <span>{welcome}</span> : null}
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

        <ul className="v-picks__pills" aria-label={labels.entryCountsAriaLabel || undefined}>
          <li className="v-picks__pill v-picks__pill--submitted">
            {renderVintageStatusIcon('submitted')}
            {labels.statusSubmitted} {counts.submittedCount}
          </li>
          <li className="v-picks__pill v-picks__pill--progress">
            {renderVintageStatusIcon('in_progress')}
            {labels.statusInProgress} {counts.inProgressCount}
          </li>
          {counts.deletedCount > 0 && (
            <li className="v-picks__pill v-picks__pill--deleted">
              {renderVintageStatusIcon('deleted')}
              {labels.statusDeleted} {counts.deletedCount}
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

  /**
   * Line 1: New Bracket / Pay / Logout (Pay always visible; disabled with reason when inactive).
   * Line 2: Season panel — fixed Year column + message; prior year adds a compact return link.
   */
  const renderVintageActions = () => {
    const isPriorSeason = messageBoxStateKey === 'priorYear';
    const returnLabel = formatCopy(labels.backToActiveYearLabel, { year: activeYear });
    const canReturn =
      Boolean(onViewingYearChange) && !isYearSwitching && !rowMutationInFlight;
    const payTitleRaw =
      (rowMutationInFlight
        ? labels.pleaseWaitLabel
        : payEnabled
          ? labels.payTooltip
          : payDisabledReason) || '';
    const newBracketTipRaw =
      getMutatingActionDisabledReason('new') || labels.newBracketTooltip || '';
    /** Native `title` cannot break on `||`; collapse for fallback / a11y. */
    const payTitlePlain = payTitleRaw ? cmsPlainText(payTitleRaw) : undefined;
    const newBracketTipPlain = newBracketTipRaw
      ? cmsPlainText(newBracketTipRaw)
      : undefined;

    /**
     * Hover tip with CMS line breaks; optional native title as plain fallback.
     */
    const withTip = (tipRaw: string, node: React.ReactNode) =>
      tipRaw ? <PicksActionTip label={tipRaw}>{node}</PicksActionTip> : node;

    return (
      <div className="v-picks__side">
        <div className="v-picks__buttons">
          {withTip(
            newBracketTipRaw,
            <button
              type="button"
              onClick={onCreateNew}
              disabled={Boolean(getMutatingActionDisabledReason('new'))}
              title={newBracketTipPlain}
              aria-busy={creatingBracketBusy || undefined}
              data-testid={`new-bracket-button-${viewportSuffix}`}
              className="v-picks__btn v-picks__btn--primary"
            >
              <Plus className="v-picks__icon" aria-hidden />
              <span>{labels.newBracketLabel}</span>
            </button>,
          )}
          {withTip(
            payTitleRaw,
            <span className="v-picks__pay-wrap" title={payTitlePlain}>
              <button
                type="button"
                onClick={() => {
                  if (payEnabled && !rowMutationInFlight) setPayModalOpen(true);
                }}
                className="v-picks__btn v-picks__btn--secondary"
                data-testid={`pay-button-${viewportSuffix}`}
                aria-label={labels.payLabel || undefined}
                aria-disabled={!payEnabled || rowMutationInFlight}
                disabled={!payEnabled || rowMutationInFlight}
                title={payTitlePlain}
              >
                <DollarSign className="v-picks__icon" aria-hidden />
                <span>{labels.payLabel}</span>
              </button>
            </span>,
          )}
          <LoggedButton
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            logLocation="Logout"
            className="v-picks__btn v-picks__btn--ghost v-picks__btn--icon"
            data-testid={`logout-button-${viewportSuffix}`}
            title={labels.logoutLabel || undefined}
            aria-label={labels.logoutLabel || undefined}
          >
            <LogOut className="v-picks__icon" aria-hidden />
          </LoggedButton>
        </div>
        <div
          className="v-picks__board"
          data-testid="picks-status-box"
          data-message-box-state={messageBoxStateKey}
          style={messageBoxCssVars(messageBoxState) as React.CSSProperties}
        >
          <div className="v-picks__board-year">{renderVintageYearSelect()}</div>
          <div className="v-picks__board-rule" aria-hidden="true" />
          <div
            className="v-picks__board-body"
            data-testid={
              isPriorSeason
                ? 'picks-prior-season'
                : messageBoxStateKey === 'live'
                  ? 'picks-live-tourney'
                  : 'picks-countdown-timer'
            }
            title={messageBoxTitle}
          >
            <CmsText
              as="span"
              className="v-picks__board-title"
              text={messageBoxTitle}
            />
            <CmsText
              as="span"
              className="v-picks__board-message"
              text={messageBoxMessage}
            />
            <div className="v-picks__board-return-slot">
              {isPriorSeason ? (
                <button
                  type="button"
                  className="v-picks__board-return"
                  data-testid="picks-switch-to-active-year"
                  disabled={!canReturn}
                  onClick={() => onViewingYearChange?.(activeYear)}
                  title={returnLabel}
                  aria-label={`Return to current tournament year ${activeYear}`}
                >
                  {returnLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            <CmsText
              as="p"
              className="v-picks__empty-text"
              data-testid="picks-empty-historical-message"
              text={emptyBody}
            />
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
            <CmsText
              as="p"
              className="v-picks__empty-text"
              data-testid="picks-empty-cta-message"
              text={emptyCta}
            />
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
        onClick={() => {
          if (!rowMutationInFlight) onClick();
        }}
        aria-pressed={pressed}
        aria-disabled={rowMutationInFlight || undefined}
        disabled={rowMutationInFlight}
        title={rowMutationInFlight ? labels.pleaseWaitLabel || undefined : undefined}
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
          {labels.filterShowLabel ? (
            <span className="v-picks__filter-label">{labels.filterShowLabel}</span>
          ) : null}
          <div className="v-picks__chips">
            {chip('bracket-filter-all', labels.filterAllLabel, allStatusFiltersOn, 'all', () =>
              updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY }),
            )}
            {chip(
              'bracket-filter-submitted',
              labels.statusSubmitted,
              statusVisibility.submitted && !allStatusFiltersOn,
              'submitted',
              () => toggleStatusFilter('submitted'),
              'submitted',
            )}
            {chip(
              'bracket-filter-in-progress',
              labels.statusInProgress,
              statusVisibility.in_progress && !allStatusFiltersOn,
              'progress',
              () => toggleStatusFilter('in_progress'),
              'in_progress',
            )}
            {chip(
              'bracket-filter-deleted',
              labels.statusDeleted,
              statusVisibility.deleted && !allStatusFiltersOn,
              'deleted',
              () => toggleStatusFilter('deleted'),
              'deleted',
            )}
          </div>
        </div>
        <div className="v-picks__search">
          {labels.searchLabel ? (
            <label htmlFor="bracket-entry-search" className="v-picks__sr-only">
              {labels.searchLabel}
            </label>
          ) : null}
          <Search className="v-picks__search-icon" aria-hidden />
          <input
            id="bracket-entry-search"
            type="search"
            value={entrySearchQuery}
            onChange={(e) => setEntrySearchQuery(e.target.value)}
            placeholder={labels.searchPlaceholder || undefined}
            aria-label={labels.searchLabel || undefined}
            autoComplete="off"
            disabled={rowMutationInFlight}
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
        bracket.status === 'in_progress' && !accessForcesViewOnly && entriesStillAccepted
          ? labels.actionEdit
          : labels.actionView;
      const inPool = bracket.status === 'submitted';
      const prev = sortedBrackets[index - 1];
      const prevInPool = prev ? prev.status === 'submitted' : false;
      return {
        number,
        paddedId: String(number).padStart(6, '0'),
        submitDisabledReason,
        accessForcesViewOnly,
        rowOpenTitle,
        rawEntryName:
          bracket.entryName ||
          formatCopy(labels.untitledEntryLabel, { n: index + 1 }),
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
            {labels.tableCaption ? (
              <caption className="v-picks__sr-only">
                {formatCopy(labels.tableCaption, { year: viewingYear })}
              </caption>
            ) : null}
            <thead>
              <tr>
                <th scope="col" className="v-picks__th v-picks__th--entry">{labels.columnEntry}</th>
                <th scope="col" className="v-picks__th">{labels.columnStatus}</th>
                <th scope="col" className="v-picks__th">{labels.columnProgress}</th>
                <th scope="col" className="v-picks__th">{labels.columnFinalFour}</th>
                <th
                  scope="col"
                  className="v-picks__th v-picks__th--champ"
                  title={labels.columnChampion || undefined}
                >
                  {labels.columnChamp}
                </th>
                <th scope="col" className="v-picks__th v-picks__th--actions">{labels.columnActions}</th>
              </tr>
            </thead>
            <tbody>
              {sortedBrackets.map((bracket, index) => {
                const ctx = rowContext(bracket, index);
                return (
                  <React.Fragment key={bracket.id}>
                    {ctx.showInHeader && (
                      <tr className="v-picks__section-row v-picks__section-row--in" data-testid="brackets-section-in-pool">
                        <td colSpan={6}>{renderVintagePoolSection('in')}</td>
                      </tr>
                    )}
                    {ctx.showOutHeader && (
                      <tr
                        className={`v-picks__section-row v-picks__section-row--out${ctx.followsInPool ? ' is-after-in' : ''}`}
                        data-testid="brackets-section-out-pool"
                      >
                        <td colSpan={6}>{renderVintagePoolSection('out')}</td>
                      </tr>
                    )}
                    <tr className={`v-picks__row v-picks__row--${bracket.status}`}>
                      <td className="v-picks__cell v-picks__cell--entry">
                        {renderVintageEntryCell(bracket, ctx.rawEntryName, ctx.rowOpenTitle)}
                      </td>
                      <td className="v-picks__cell v-picks__cell--status">
                        {renderVintageStatusMark(bracket)}
                      </td>
                      <td className="v-picks__cell v-picks__cell--progress">
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
          <span className="v-picks__card-h v-picks__card-h--entry">{labels.columnEntry}</span>
          <span className="v-picks__card-h v-picks__card-h--ff">{labels.columnFinalFour}</span>
          <span className="v-picks__card-h v-picks__card-h--champ">{labels.columnChamp}</span>
          <span className="v-picks__card-h v-picks__card-h--actions">{labels.columnActions}</span>
        </div>
        {sortedBrackets.map((bracket, index) => {
          const ctx = rowContext(bracket, index);
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
                {/* Name (+ pay / status chip under) | FF 2×2 | Champ square | Actions 2×2 */}
                <div className="v-picks__card-row">
                  {renderVintageEntryCell(
                    bracket,
                    ctx.rawEntryName,
                    [ctx.rowOpenTitle, formatCopy(labels.entryIdLabel, { id: ctx.paddedId })]
                      .filter((part) => part.trim())
                      .join(' · '),
                    { showUnderNameMeta: true },
                  )}
                  {renderVintageFinalFour(ctx.finalFour)}
                  {renderVintageChampion(ctx.finalFour, false, 'v-picks__champ--mobile')}
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
    <LoadingBasketball
      className="v-picks__loading--year"
      message={formatCopy(feedback.switchingYearMessage, { year: viewingYear })}
      testId="picks-year-loading"
    />
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

      <section className="v-picks__panel" aria-label={labels.summaryAriaLabel || undefined}>
        {renderVintageSummary()}
        {renderVintageActions()}
      </section>

      <section className="v-picks__list" aria-label={labels.entriesAriaLabel || undefined}>
        {isYearSwitching ? (
          renderVintageYearLoading()
        ) : bracketsForYear.length === 0 ? (
          renderVintageEmptyState()
        ) : (
          <>
            {renderVintageFilters()}
            {filteredDisplayBrackets.length === 0 ? (
              <div className="v-picks__empty v-picks__empty--filtered">
                {labels.noFilterMatchesTitle ? (
                  <p className="v-picks__empty-title">{labels.noFilterMatchesTitle}</p>
                ) : null}
                {labels.noFilterMatchesBody ? (
                  <p className="v-picks__empty-text">{labels.noFilterMatchesBody}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    updateStatusVisibility({ ...DEFAULT_STATUS_VISIBILITY });
                    setEntrySearchQuery('');
                  }}
                  data-testid="bracket-filters-reset"
                  className="v-picks__btn v-picks__btn--primary"
                >
                  {labels.resetFiltersLabel}
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
      className={`v-picks${isYearSwitching ? ' v-picks--year-switching' : ''}`}
      style={
        {
          ...vintagePicksChromeCssVars(picksCopy),
          ...standingsResultChromeStyle(standingsChrome),
        } as React.CSSProperties
      }
      aria-busy={isYearSwitching ? true : undefined}
      data-testid={isYearSwitching ? 'picks-year-switching' : undefined}
    >
      {renderVintageLanding()}

      <ConfirmDialog
        open={profileModalOpen}
        title={profileCopy.title}
        message=""
        confirmLabel={profileCopy.saveLabel}
        cancelLabel={profileCopy.cancelLabel}
        tone="neutral"
        busy={profileSaving}
        busyMessage={profileCopy.savingLabel}
        errorMessage={profileSaveError || profileLoadError}
        confirmDisabled={profileLoading || !profileDetails || !profileDisplayName.trim()}
        testId="profile-edit-modal"
        onConfirm={() => void saveProfileDisplayName()}
        onCancel={closeProfileModal}
      >
        {profileLoading ? (
          <LoadingBasketball
            variant="plain"
            message={profileCopy.loadingMessage}
            testId="profile-edit-loading"
          />
        ) : profileDetails ? (
          <>
            {profileCopy.displayNameLabel ? (
              <label htmlFor="profile-display-name" className="v-confirm__label">
                {profileCopy.displayNameLabel}
              </label>
            ) : null}
            <input
              id="profile-display-name"
              type="text"
              value={profileDisplayName}
              onChange={(e) => setProfileDisplayName(e.target.value)}
              className="v-confirm__input"
              aria-label={profileCopy.displayNameLabel || undefined}
              data-testid="profile-display-name-input"
              autoComplete="name"
            />
            <dl className="v-confirm__details">
              {profileCopy.accountCreatedLabel ? (
                <div>
                  <dt>{profileCopy.accountCreatedLabel}</dt>
                  <dd>
                    {new Date(profileDetails.createdAt).toLocaleDateString(undefined, {
                      dateStyle: 'long',
                    })}
                  </dd>
                </div>
              ) : null}
              {profileCopy.emailLabel ? (
                <div>
                  <dt>{profileCopy.emailLabel}</dt>
                  <dd>{profileDetails.email}</dd>
                </div>
              ) : null}
              {profileCopy.tournamentsPlayedLabel ? (
                <div>
                  <dt>{profileCopy.tournamentsPlayedLabel}</dt>
                  <dd>{profileDetails.tournamentsPlayed}</dd>
                </div>
              ) : null}
              {profileCopy.bracketsEnteredLabel ? (
                <div>
                  <dt>{profileCopy.bracketsEnteredLabel}</dt>
                  <dd>{profileDetails.bracketsEntered}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={emailDialogOpen && Boolean(emailBracket)}
        title={pdfDialogCopy.title}
        message={formatEmailCopy(pdfDialogCopy.message, {
          entry: emailBracket?.entryName || '',
          email: session?.user?.email || '',
        })}
        confirmLabel={pdfDialogCopy.sendLabel}
        cancelLabel={pdfDialogCopy.cancelLabel}
        tone="neutral"
        busy={isSendingEmail}
        busyMessage={pdfDialogCopy.sendingMessage}
        errorMessage={emailMessage?.type === 'error' ? emailMessage.text : null}
        testId="email-pdf-dialog"
        onConfirm={() => void confirmEmailBracket()}
        onCancel={() => {
          setEmailDialogOpen(false);
          setEmailBracket(null);
          setEmailMessage(null);
        }}
      />

      {/* Payment Slip modal — mount only while open for a fresh form each time */}
      {payEnabled && payModalOpen && (
        <PaymentModal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          unpaidBrackets={unpaidSubmittedBrackets.map((b) => ({
            id: b.id,
            entryName:
              b.entryName ||
              formatCopy(labels.untitledEntryLabel, {
                n: (b as unknown as { bracketNumber?: number }).bracketNumber ?? '',
              }),
            bracketNumber: (b as unknown as { bracketNumber?: number }).bracketNumber,
          }))}
          entryCost={entryCost}
          paymentConfig={paymentConfig}
          availableMethods={availablePaymentMethods}
          onPaymentCreated={() => {
            setPayModalOpen(false);
            onPaymentCreated?.();
          }}
        />
      )}

      {/* Action confirmations (delete / permanent delete / return) — CMS via picksCopy.confirms */}
      {(() => {
        const confirmKind = pendingDeleteBracketId
          ? 'delete'
          : pendingPermanentDeleteBracketId
            ? 'permanentDelete'
            : pendingReturnBracketId
              ? 'return'
              : null;
        if (!confirmKind) return null;
        const pendingId =
          confirmKind === 'delete'
            ? pendingDeleteBracketId
            : confirmKind === 'permanentDelete'
              ? pendingPermanentDeleteBracketId
              : pendingReturnBracketId;
        const entry =
          brackets.find((b) => b.id === pendingId)?.entryName?.trim() || '';
        const copy = picksCopy.confirms[confirmKind];
        const busy =
          confirmKind === 'return'
            ? Boolean(returningBracketId)
            : deletingBracketId === pendingId;
        const testId =
          confirmKind === 'delete'
            ? 'delete-confirmation-dialog'
            : confirmKind === 'permanentDelete'
              ? 'permanent-delete-confirmation'
              : 'return-bracket-confirmation';
        return (
          <PicksConfirmModal
            open
            copy={copy}
            entryName={entry}
            tone={confirmKind === 'return' ? 'warn' : 'danger'}
            busy={busy}
            busyMessage={
              confirmKind === 'return' ? feedback.returningMessage : feedback.deletingMessage
            }
            testId={testId}
            onConfirm={() => {
              if (!pendingId) return;
              if (confirmKind === 'delete') onConfirmDelete?.(pendingId);
              else if (confirmKind === 'permanentDelete') {
                onConfirmPermanentDelete?.(pendingId);
              } else {
                onConfirmReturnBracket?.(pendingId);
              }
            }}
            onCancel={() => {
              if (confirmKind === 'delete') onCancelDelete?.();
              else if (confirmKind === 'permanentDelete') {
                onCancelPermanentDelete?.();
              } else {
                onCancelReturnBracket?.();
              }
            }}
          />
        );
      })()}

      {/* Email Status Message */}
      {emailMessage && !emailDialogOpen && emailMessage.text.trim() ? (
        <div
          className={`v-toast${emailMessage.type === 'error' ? ' v-toast--error' : ''}`}
          role="status"
          data-testid="email-pdf-result"
        >
          {emailMessage.text}
        </div>
      ) : null}

    </div>
  );
}
