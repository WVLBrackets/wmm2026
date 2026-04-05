'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Press_Start_2P } from 'next/font/google';
import { Trophy, Plus, Edit, Clock, CheckCircle, LogOut, Trash2, Copy, Eye, Info, X, Mail, RotateCcw, Undo2, Search, Pencil, Send, DollarSign } from 'lucide-react';
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
  /** Eye icon: open full-bracket modal when set; otherwise falls back to print tab. */
  onOpenFullBracketModal?: (bracket: Bracket) => void;
  /** Called after a Venmo payment request is recorded so the parent can refresh the bracket list. */
  onPaymentCreated?: () => void;
}

/**
 * Small team logo for My Picks Final Four / Champ cells.
 * Module-scoped so parent re-renders (e.g. per-second countdown) do not remount {@link Image} and flash on mobile.
 */
const FinalFourLogo = React.memo(function FinalFourLogo({ logoPath }: { logoPath: string | null }) {
  const [imageError, setImageError] = React.useState(false);

  if (!logoPath || imageError) {
    return <span className="text-gray-400 text-xs">?</span>;
  }

  return (
    <Image
      src={logoPath}
      alt="Team logo"
      width={24}
      height={24}
      className="max-h-[22px] max-w-[22px] object-contain"
      onError={() => setImageError(true)}
      unoptimized
    />
  );
});

export default function MyPicksLanding({
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
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{
    email: string;
    createdAt: string;
    tournamentsPlayed: number;
    bracketsEntered: number;
  } | null>(null);
  const { getServerNowMs } = useServerTime();
  const killSwitchDisabledReason = killSwitchMessage || siteConfig?.killSwitchOn || 'Bracket actions are temporarily disabled by the administrator.';
  
  // Get tournament year from config or tournament data
  const tournamentYear = siteConfig?.tournamentYear ? parseInt(siteConfig.tournamentYear) : (tournamentData?.year ? parseInt(tournamentData.year) : new Date().getFullYear());
  
  /** All brackets for the current tournament year (counts and filters are based on this). */
  const bracketsForYear = useMemo(
    () =>
      brackets.filter(
        (b) => b.year === tournamentYear || (!b.year && tournamentYear === new Date().getFullYear())
      ),
    [brackets, tournamentYear]
  );

  const unpaidSubmittedBrackets = useMemo(
    () => bracketsForYear.filter((b) => b.status === 'submitted' && !b.paymentStatus),
    [bracketsForYear]
  );

  const entryCost = siteConfig?.entryCost ?? 5;
  const venmoUser = siteConfig?.venmoUser;
  const payCapabilityEnabled = siteConfig?.enablePayCapability?.toUpperCase() === 'YES';

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/check-admin')
      .then((r) => r.json())
      .then((d) => setIsCurrentUserAdmin(d.isAdmin || false))
      .catch(() => setIsCurrentUserAdmin(false));
  }, [session?.user?.email]);

  const showPayButton = venmoUser && unpaidSubmittedBrackets.length > 0 && (payCapabilityEnabled || isCurrentUserAdmin);

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
    const entryCost = siteConfig?.entryCost || 5;
    const totalCost = submittedCount * entryCost;
    return { submittedCount, inProgressCount, deletedCount, totalCost };
  };

  // Get dynamic message based on bracket counts
  const getDynamicMessage = () => {
    const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();
    
    let message = '';
    
    // Determine which message to use based on counts
    if (submittedCount === 0 && inProgressCount === 0) {
      message = siteConfig?.welcomeNoBrackets || 'Click New Bracket to start your first entry';
    } else if (submittedCount > 0 && inProgressCount === 0) {
      message = siteConfig?.welcomeNoInProgress || `Your total cost so far is $${totalCost}. You can create a new entry and save it for later without submitting it now.`;
    } else if (submittedCount === 0 && inProgressCount > 0) {
      message = siteConfig?.welcomeNoSubmitted || 'You have not submitted any brackets yet. Please complete and submit your bracket(s) to be included in the contest.';
    } else {
      message = siteConfig?.welcomeYourBrackets || `Your total cost so far is $${totalCost}. In Progress brackets are not included in the contest until submitted.`;
    }
    
    // Replace template variables
    message = message
      .replace(/{Submitted}/g, submittedCount.toString())
      .replace(/{In Progress}/g, inProgressCount.toString())
      .replace(/{cost}/g, totalCost.toString());
    
    return message;
  };

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

  // Check if bracket creation/copying is disabled due to deadline or toggle
  const isBracketCreationDisabled = () => {
    // Check stop_submit_toggle first
    if (siteConfig?.stopSubmitToggle === 'Yes') {
      return true;
    }
    
    // Check stop_submit_date_time
    if (siteConfig?.stopSubmitDateTime) {
      try {
        const deadline = new Date(siteConfig.stopSubmitDateTime);
        if (getServerNowMs() >= deadline.getTime()) {
          return true;
        }
      } catch {
        // Invalid date format - ignore
      }
    }
    
    return false;
  };

  const isKillSwitchDisabled = () => !killSwitchEnabled;

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
      if (isKillSwitchDisabled()) {
        if (onOpenFullBracketModal) {
          onOpenFullBracketModal(bracket);
        } else {
          handlePrintBracket(bracket);
        }
        return;
      }
      if (!isBracketCreationDisabled()) {
        onEditBracket(bracket);
        return;
      }
      if (onOpenFullBracketModal) {
        onOpenFullBracketModal(bracket);
      } else {
        handlePrintBracket(bracket);
      }
    }
  };

  /**
   * Convert a millisecond duration into HH:MM:SS or MM:SS.
   * Switches to MM:SS once remaining time is under one hour.
   * For long horizons (>100 hours), display "X Days Away" for readability.
   */
  /**
   * @param useMobileDaysTemplate When true and the “X days away” branch applies, use `countdownTimerMessageMobile` (fallback: desktop message).
   */
  const formatCountdown = (remainingMs: number, useMobileDaysTemplate = false) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 100 && siteConfig?.stopSubmitDateTime) {
      const deadline = new Date(siteConfig.stopSubmitDateTime);
      const serverNow = new Date(getServerNowMs());
      if (!Number.isNaN(deadline.getTime()) && !Number.isNaN(serverNow.getTime())) {
        const dayDelta = deadline.getDate() - serverNow.getDate();
        const fallbackDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        const daysAway = dayDelta > 0 ? dayDelta : Math.max(1, fallbackDays);
        const desktopTemplate = siteConfig?.countdownTimerMessage?.trim() || 'X Days Away';
        const mobileTemplate =
          siteConfig?.countdownTimerMessageMobile?.trim() || desktopTemplate;
        const template = useMobileDaysTemplate ? mobileTemplate : desktopTemplate;
        return template.replace(/X/g, String(daysAway));
      }
    }

    if (hours < 1) {
      return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    }

    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  };

  React.useEffect(() => {
    const stopDateTime = siteConfig?.stopSubmitDateTime;
    if (!stopDateTime) {
      setCountdownMs(null);
      return;
    }

    const deadline = new Date(stopDateTime);
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
  }, [siteConfig?.stopSubmitDateTime, getServerNowMs]);

  const countdownDisplayDesktop =
    countdownMs !== null ? formatCountdown(countdownMs, false) : null;
  const countdownDisplayMobile =
    countdownMs !== null ? formatCountdown(countdownMs, true) : null;
  const showCountdownTimer = siteConfig?.showCountdownTimer?.trim().toUpperCase() === 'YES';
  const scoreboardTimeDesktop = killSwitchEnabled ? (countdownDisplayDesktop || '00:00') : '00:00';
  const scoreboardTimeMobile = killSwitchEnabled ? (countdownDisplayMobile || '00:00') : '00:00';

  // Get the reason bracket creation is disabled
  const getBracketCreationDisabledReason = () => {
    // Check stop_submit_toggle first
    if (siteConfig?.stopSubmitToggle === 'Yes') {
      return siteConfig?.finalMessageSubmitOff || 'Bracket submissions are currently disabled.';
    }
    
    // Check stop_submit_date_time
    if (siteConfig?.stopSubmitDateTime) {
      try {
        const deadline = new Date(siteConfig.stopSubmitDateTime);
        if (getServerNowMs() >= deadline.getTime()) {
          return siteConfig?.finalMessageTooLate || 'Bracket submissions are closed. The deadline has passed.';
        }
      } catch {
        // Invalid date format - ignore
      }
    }
    
    return null;
  };

  /**
   * Get tooltip/disable reason for user actions.
   * `edit` is excluded from the kill-switch gate so in-progress rows can still open the read-only modal via the entry name / status chip when the kill switch is on.
   */
  const getActionDisabledReason = (
    action: 'new' | 'copy' | 'edit' | 'delete' | 'return' | 'restore',
  ) => {
    if ((action === 'new' || action === 'copy') && isBracketCreationDisabled()) {
      return getBracketCreationDisabledReason();
    }
    // Opening a bracket is allowed under the kill switch (read-only in-editor). Block other actions.
    if (action !== 'edit' && isKillSwitchDisabled()) {
      return killSwitchDisabledReason;
    }
    return null;
  };

  /**
   * Disable reason for the in-progress **Edit** control in Actions only (does not apply to row click “view read-only”).
   */
  const getInProgressEditButtonDisabledReason = (): string | null => {
    if (isKillSwitchDisabled()) return killSwitchDisabledReason;
    return getActionDisabledReason('edit');
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
   * kill switch → incomplete picks/entry/tie-breaker → duplicate name → submission deadline/toggle.
   */
  const getInProgressSubmitDisabledReason = (row: Bracket): string | null => {
    if (row.status !== 'in_progress') return null;
    if (submittingBracketId === row.id) return 'Submitting…';
    if (isKillSwitchDisabled()) return killSwitchDisabledReason;
    if (!tournamentData || !emptyBracketTemplate) {
      return 'Tournament data not loaded. Try refreshing.';
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
    if (isBracketCreationDisabled()) {
      return getBracketCreationDisabledReason();
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

  /** Bold header + optional detail; sheet keys `in_the_pool_header` / `in_the_pool_message`. */
  const inPoolCopy = {
    header: siteConfig?.inThePoolHeader?.trim() || 'In the pool',
    detail: formatInThePoolMessage(
      siteConfig?.inThePoolMessage?.trim() || 'Submitted entries count toward the contest.',
      submittedEntryCountForPoolMessage
    ),
  };
  /** Sheet keys `not_in_the_pool_header` / `not_in_the_pool_message`. */
  const outPoolCopy = {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
            {/* Welcome Header */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              {/* Desktop Layout */}
              <div className="hidden md:block">
                <div className="flex items-start justify-between">
                  {/* Site Logo - Far Left */}
                  {siteConfig?.wmmLogo && (
                    <div className="flex-shrink-0 mr-4">
                      <div className="h-32 w-auto flex items-center justify-center">
                        {logoError ? (
                          <div className="text-red-600 text-xs text-center">
                            Image not Found
                          </div>
                        ) : (
                          <Image
                            src={`/images/${siteConfig.wmmLogo}`}
                            alt="Site Logo"
                            width={200}
                            height={100}
                            className="h-full w-auto object-contain max-h-full"
                            onError={() => setLogoError(true)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    {/* Line 1: Welcome message with full name */}
                    <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                      <span>
                        Welcome {session?.user?.name || 'User'}
                      </span>
                      {renderProfileEditButton('desktop')}
                    </h1>
                    
                    {/* Line 2: Brackets message (or kill-switch replacement) */}
                    {killSwitchEnabled ? (
                      siteConfig?.bracketsMessage && (
                        <p className="text-sm text-gray-600 mt-1">
                          {renderMessageWithLineBreaks(siteConfig.bracketsMessage)}
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-red-600 mt-1 font-medium">
                        {killSwitchDisabledReason}
                      </p>
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
                    
                    {/* Line 4: Dynamic message - always shown on desktop */}
                    <p className="text-sm text-gray-600 mt-2">
                      {renderMessageWithLineBreaks(getDynamicMessage())}
                    </p>
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
                        className={`flex w-full items-center justify-center rounded border border-gray-700 bg-black px-4 py-2.5 shadow-inner ${
                          killSwitchEnabled ? 'text-amber-300' : 'text-red-500'
                        }`}
                        title={
                          killSwitchEnabled
                            ? 'Countdown to bracket submission deadline'
                            : killSwitchDisabledReason
                        }
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 0.7px, transparent 0.7px)',
                          backgroundSize: '4px 4px',
                        }}
                      >
                        <span
                          className={`${scoreboardFont.className} text-[16px] tracking-[0.05em]`}
                          style={{
                            textShadow: killSwitchEnabled
                              ? '0 0 5px rgba(252,211,77,0.9)'
                              : '0 0 5px rgba(239,68,68,0.9)',
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
                  {/* Top row: Welcome message and buttons */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Line 1: Welcome message with first name only */}
                      <h1 className="text-xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                        <span>Welcome {getFirstName(session?.user?.name)}</span>
                        {renderProfileEditButton('mobile')}
                      </h1>
                      
                      {/* Line 2: Mobile brackets message (or kill-switch replacement) */}
                      {killSwitchEnabled ? (
                        siteConfig?.mobileBracketsMessage && (
                          <p className="text-sm text-gray-600 mt-1">
                            {renderMessageWithLineBreaks(siteConfig.mobileBracketsMessage)}
                          </p>
                        )
                      ) : (
                        <p className="text-sm text-red-600 mt-1 font-medium">
                          {killSwitchDisabledReason}
                        </p>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex flex-col items-end flex-shrink-0 ml-2 gap-2">
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
                          className={`inline-flex items-center rounded border border-gray-700 bg-black px-2 py-1 shadow-inner ${
                            killSwitchEnabled ? 'text-amber-300' : 'text-red-500'
                          }`}
                          title={
                            killSwitchEnabled
                              ? 'Countdown to bracket submission deadline'
                              : killSwitchDisabledReason
                          }
                          style={{
                            backgroundImage:
                              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 0.7px, transparent 0.7px)',
                            backgroundSize: '4px 4px',
                          }}
                        >
                          <span
                            className={`${scoreboardFont.className} text-[9px] tracking-[0.05em]`}
                            style={{
                              textShadow: killSwitchEnabled
                                ? '0 0 5px rgba(252,211,77,0.9)'
                                : '0 0 5px rgba(239,68,68,0.9)',
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
                    
                    {/* Info icon - aligned with logout button */}
                    <button
                      onClick={() => setExpandedStatus(expandedStatus === 'info' ? null : 'info')}
                      className="text-blue-600 hover:text-blue-700 cursor-pointer flex-shrink-0"
                      style={{ width: '16px', marginLeft: '8px' }}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Line 4: Dynamic message - full width, hidden by default, shown when info icon is clicked */}
                {expandedStatus === 'info' && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded relative w-full">
                    <button
                      onClick={() => setExpandedStatus(null)}
                      className="absolute top-2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      style={{ right: '8px' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="pr-6">
                      <p>{renderMessageWithLineBreaks(getDynamicMessage())}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


        {/* Brackets List */}
        <div className="bg-white rounded-lg shadow-lg p-6">

          {bracketsForYear.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
              <p className="text-gray-600">
                <span className="hidden md:inline">Use the &quot;New Bracket&quot; button to create your first bracket.</span>
                <span className="md:hidden">Use the &quot;+&quot; button to create your first bracket.</span>
              </p>
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
                    /** In-progress brackets open read-only when the kill switch blocks saves/submits. */
                    const killSwitchForcesViewOnly =
                      bracket.status === 'in_progress' && isKillSwitchDisabled();
                    const entriesStillAccepted = !isBracketCreationDisabled();
                    const rowOpenTitle =
                      bracket.status === 'submitted' || bracket.status === 'deleted'
                        ? onOpenFullBracketModal
                          ? 'View bracket'
                          : 'View/Print'
                        : killSwitchForcesViewOnly
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
                            <FinalFourLogo logoPath={finalFour.topLeft} />
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
                            <FinalFourLogo logoPath={finalFour.bottomLeft} />
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
                            <FinalFourLogo logoPath={finalFour.topRight} />
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
                            <FinalFourLogo logoPath={finalFour.bottomRight} />
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
                            <FinalFourLogo logoPath={finalFour.champion} />
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
                                  {killSwitchForcesViewOnly ? (
                                    <LoggedButton
                                      onClick={() => handleEyeOpenFullBracketOrPrint(bracket)}
                                      logLocation={onOpenFullBracketModal ? 'FullBracketModal' : 'Print'}
                                      bracketId={number ? String(number).padStart(6, '0') : null}
                                      className="w-8 h-8 rounded flex items-center justify-center transition-colors bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
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
                                      className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                        getInProgressEditButtonDisabledReason()
                                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                          : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                                      }`}
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
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      submitDisabledReason
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                                    }`}
                                    title={submitDisabledReason || 'Submit'}
                                    data-testid="submit-bracket-landing-button"
                                  >
                                    <Send className="h-4 w-4" aria-hidden />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('copy')
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-bracket-button"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('delete') && onDeleteBracket(bracket.id)}
                                    logLocation="Delete"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('delete')) || deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('delete') || deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('delete') || (deletingBracketId === bracket.id ? 'Deleting...' : 'Delete')}
                                    data-testid="delete-bracket-button"
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
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
                                    title={onOpenFullBracketModal ? 'View' : 'View/Print'}
                                    data-testid="print-deleted-bracket-button"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('copy')
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-deleted-bracket-button"
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
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('restore')
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('restore') || 'Restore to In Progress'}
                                    data-testid="restore-bracket-button"
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
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('delete') ||
                                      deletingBracketId === bracket.id ||
                                      pendingPermanentDeleteBracketId
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-900 text-white hover:bg-red-950 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('delete') || 'Permanently delete'}
                                    data-testid="permanent-delete-bracket-button"
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
                                    className="flex w-8 h-8 cursor-pointer items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700"
                                    title={onOpenFullBracketModal ? 'View' : 'View/Print'}
                                    data-testid="print-bracket-button"
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
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('return') ||
                                      returningBracketId ||
                                      pendingReturnBracketId
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer'
                                    }`}
                                    title={
                                      getActionDisabledReason('return') ||
                                      siteConfig?.returnActionHoverMessage?.trim() ||
                                      'Return to In Progress (you must submit again to re-enter the pool)'
                                    }
                                    data-testid="return-bracket-button"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => !getActionDisabledReason('copy') && onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={Boolean(getActionDisabledReason('copy'))}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      getActionDisabledReason('copy')
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                    }`}
                                    title={getActionDisabledReason('copy') || 'Copy'}
                                    data-testid="copy-bracket-button"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => handleEmailBracket(bracket)}
                                    logLocation="Email"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className="bg-indigo-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-indigo-700 cursor-pointer transition-colors"
                                    title="Email PDF"
                                    data-testid="email-bracket-button"
                                  >
                                    <Mail className="h-4 w-4" />
                                  </LoggedButton>
                                </>
                              )}
                            </>
                          )}
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
