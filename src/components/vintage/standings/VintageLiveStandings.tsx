"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ChevronDown, Search, Settings } from "lucide-react";
import Link from "next/link";
import BracketViewerModal from "@/components/bracket/BracketViewerModal";
import {
  formatPointsGap,
  formatStandingsTieBreakerDisplay,
  type RegionalChampionKeyRow,
  type StandingsData,
  type StandingsEntry,
} from "@/lib/standingsData";
import {
  formatStandingsPickAccessibleName,
  resolvePickResultTone,
  type PickResultA11yPhrases,
  type PickResultTone,
} from "@/lib/pickResultChrome";
import { getLogoUrlSync, getTeamInfo } from "@/lib/teamLogos";
import { getTeamRefData, type TeamRefData } from "@/lib/teamRefData";
import { buildYearScopedPath } from "@/lib/services/tournamentYearHelpers";
import {
  isLegacyStandingsYear,
  isNewspaperStandingsYear,
} from "@/lib/legacyStandings/years";
import {
  formatVintageStandingsLabel,
  isPaper2020SectionHidden,
  isStandingsFlagOn,
  resolveStandingsLogoSizing,
  standingsPickResultA11yPhrases,
  standingsResultChromeStyle,
  type VintageStandingsContent,
} from "@/lib/vintage/standingsContent";
import type { VintageContent } from "@/lib/vintage/content";
import type { VintageBracketEditorContent } from "@/lib/vintage/bracketEditorContent";
import {
  vintagePaymentBadgeCssVars,
  type VintagePicksContent,
} from "@/lib/vintage/picksContent";
import CmsText from "@/components/cms/CmsText";
import VintagePaymentBadge, {
  resolvePaymentBadgeKind,
} from "@/components/vintage/payment/VintagePaymentBadge";
import VintageShell from "../VintageShell";
import Standings2020Newspaper from "./Standings2020Newspaper";
import "./standings.css";
import "./paper-2020.css";

type FilterMode = "all" | "mine";

type PlaceMedal = "first" | "second" | "third";

/** Privacy-safe pre-tipoff roster row from GET /api/live-standings. */
type RosterEntry = {
  entryName: string;
  mine?: boolean;
};

type StandingsViewMode = "standings" | "roster";

/**
 * Map competition rank 1–3 to place-medal tokens (ties share the same place).
 */
function placeMedalForRank(rank: number): PlaceMedal | null {
  if (rank === 1) return "first";
  if (rank === 2) return "second";
  if (rank === 3) return "third";
  return null;
}

/**
 * Accessible place label for a podium medal.
 */
function placeMedalLabel(place: PlaceMedal): string {
  if (place === "first") return "first place";
  if (place === "second") return "second place";
  return "third place";
}

/**
 * Navy rank numeral with a decorative gold/silver/bronze medal for places 1–3.
 * Numerals use ink for contrast; medals are accent-only (not text color).
 */
function StandingsRankCell({ rank }: { rank: number }) {
  const place = placeMedalForRank(rank);
  return (
    <span
      className="v-standings__rank"
      data-testid="standings-rank"
      aria-label={
        place ? `Rank ${rank}, ${placeMedalLabel(place)}` : undefined
      }
    >
      <span className="v-standings__rank-num">{rank}</span>
      {place ? (
        <span
          className={`v-standings__medal v-standings__medal--${place}`}
          aria-hidden
          data-testid={`standings-medal-${place}`}
        />
      ) : null}
    </span>
  );
}

/**
 * Build label → ESPN id map (abbr, official name, display name).
 */
function buildTeamIdLookup(teams: TeamRefData[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) {
    if (t.abbr) map.set(t.abbr.trim().toLowerCase(), t.id);
    if (t.name) map.set(t.name.trim().toLowerCase(), t.id);
    if (t.displayName) map.set(t.displayName.trim().toLowerCase(), t.id);
  }
  return map;
}

/**
 * Compact team logo tile — resolves name/abbr → ESPN id → local logo URL.
 */
function StandingsLogo({
  teamName,
  teamIdLookup,
  isFinalist = false,
  shadeTone = "pending",
  borderTone,
  champ = false,
  title,
  tilePx,
  directLogo,
  a11yPhrases,
}: {
  teamName: string;
  teamIdLookup: Map<string, string>;
  isFinalist?: boolean;
  /** Fill from regional (FF) or championship (Champ) KEY game. */
  shadeTone?: PickResultTone;
  /** Finalist heavy frame / Champ decided border. */
  borderTone?: PickResultTone;
  champ?: boolean;
  title?: string;
  /** Resolved tile size for next/image dimensions. */
  tilePx: number;
  directLogo?: string;
  /** CMS hover / aria phrases (Standings admin). */
  a11yPhrases: PickResultA11yPhrases;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const label =
    title ||
    teamName ||
    (champ ? a11yPhrases.noChampionPick : a11yPhrases.emptySelection);
  const accessibleName = formatStandingsPickAccessibleName({
    teamLabel: label,
    shadeTone,
    isFinalist,
    borderTone: borderTone ?? (isFinalist ? shadeTone : undefined),
    champ,
    phrases: a11yPhrases,
  });

  useEffect(() => {
    let cancelled = false;
    setImageError(false);
    if (directLogo) { setSrc(directLogo); return; }
    const key = teamName.trim();
    if (!key) {
      setSrc(null);
      return;
    }
    const cachedId = teamIdLookup.get(key.toLowerCase());
    if (cachedId) {
      setSrc(getLogoUrlSync(cachedId));
      return;
    }
    (async () => {
      try {
        const info = await getTeamInfo(key, 28);
        if (!cancelled) setSrc(info.logoUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamName, teamIdLookup, directLogo]);

  return (
    <div
      className={`v-standings__logo${champ ? " v-standings__logo--champ" : ""}${
        isFinalist ? " v-standings__logo--finalist" : ""
      }`}
      data-status={shadeTone}
      data-border={borderTone ?? (isFinalist ? shadeTone : undefined)}
      data-finalist={isFinalist ? "true" : undefined}
      title={accessibleName}
      role="img"
      aria-label={accessibleName}
    >
      {src && !imageError ? (
        <Image
          src={src}
          alt=""
          width={tilePx}
          height={tilePx}
          unoptimized
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="v-standings__logo-fallback" aria-hidden>
          ?
        </span>
      )}
    </div>
  );
}

/**
 * Format the standings computedAt / lastUpdated for display.
 */
function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }) + " ET"
    );
  } catch {
    return iso;
  }
}

/**
 * Vintage Live Standings — primary-admin presentation of live snapshot data.
 */
export default function VintageLiveStandings({
  home,
  copy,
  paymentBadges,
  bracketEditorCopy,
  admin = false,
  standingsDefaultYear,
  viewingYear: initialViewingYear,
  availableYears,
  initialSnapshot = null,
}: {
  home: VintageContent;
  copy: VintageStandingsContent;
  /** My Picks CMS payment badge styles (Paid / Pending / Unpaid). */
  paymentBadges: VintagePicksContent["payment"];
  /** Bracket Editor Messages CMS (bracket viewer popup). */
  bracketEditorCopy: VintageBracketEditorContent;
  admin?: boolean;
  /** CMS Standings Year — default for the selector (not Tourney Year). */
  standingsDefaultYear: number;
  viewingYear: number;
  availableYears: number[];
  /** Server-rendered snapshot for the first paint (scored years only). */
  initialSnapshot?: {
    standingsData: StandingsData;
    computedAt: string;
  } | null;
}) {
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(session?.user);

  const [viewingYear, setViewingYear] = useState(initialViewingYear);
  const [standingsMode, setStandingsMode] =
    useState<StandingsViewMode>("standings");
  const [standingsData, setStandingsData] = useState<StandingsData | null>(
    initialSnapshot?.standingsData ?? null,
  );
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>([]);
  const [totalEntryCount, setTotalEntryCount] = useState(0);
  const [computedAt, setComputedAt] = useState<string | null>(
    initialSnapshot?.computedAt ?? null,
  );
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [bracketViewerOpen, setBracketViewerOpen] = useState(false);
  const [bracketViewerId, setBracketViewerId] = useState<string | null>(null);
  const [bracketViewerTitle, setBracketViewerTitle] = useState("");
  const [teamIdLookup, setTeamIdLookup] = useState<Map<string, string>>(
    () => new Map(),
  );
  const stickyBarRef = useRef<HTMLDivElement>(null);
  const skipFetchYearRef = useRef<number | null>(
    initialSnapshot ? initialViewingYear : null,
  );
  /** Pixel height of the sticky controls band (feeds sticky thead `top`). */
  const [stickyControlsHeight, setStickyControlsHeight] = useState(54);
  const isRosterMode = standingsMode === "roster";

  const yearOptions = useMemo(() => {
    const set = new Set<number>(
      availableYears.length > 0 ? availableYears : [standingsDefaultYear],
    );
    set.add(standingsDefaultYear);
    set.add(viewingYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, standingsDefaultYear, viewingYear]);

  const leaderPoints = useMemo(() => {
    if (!standingsData?.entries.length) return 0;
    return Math.max(...standingsData.entries.map((e) => e.points));
  }, [standingsData]);

  const logoSizing = useMemo(
    () => resolveStandingsLogoSizing(copy),
    [copy],
  );
  const a11yPhrases = useMemo(
    () => standingsPickResultA11yPhrases(copy),
    [copy],
  );
  /** Desktop Paid column + mobile stats-line badge (My Picks payment cards). */
  const showPaymentBadges = isStandingsFlagOn(copy.showPaidIndicator);
  /** Static finals (≤2025 archives): no My Entries / no bracket open. */
  const legacyYear = isLegacyStandingsYear(viewingYear);
  /** 2020 (and similar): newspaper edition instead of a table. */
  const newspaperYear = isNewspaperStandingsYear(viewingYear);

  const paymentChromeVars = useMemo(
    () => vintagePaymentBadgeCssVars(paymentBadges),
    [paymentBadges],
  );

  /**
   * Paid / Pending / Unpaid card (same CMS styles as My Picks).
   */
  const renderPaymentBadge = (entry: StandingsEntry) => {
    if (!showPaymentBadges) return null;
    const kind = resolvePaymentBadgeKind(entry.paymentStatus, entry.paid);
    return (
      <VintagePaymentBadge kind={kind} style={paymentBadges[kind]} />
    );
  };

  /**
   * Load live standings or pre-tipoff roster for a year.
   */
  const loadStandings = useCallback(
    async (year: number, isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else {
        setLoading(true);
        setStandingsData(null);
        setRosterEntries([]);
        setTotalEntryCount(0);
        setStandingsMode("standings");
      }
      setError("");
      try {
        try {
          const refs = await getTeamRefData();
          setTeamIdLookup(buildTeamIdLookup(refs));
        } catch {
          /* non-fatal — logos fall back to getTeamInfo */
        }
        const response = await fetch(
          `/api/live-standings?year=${encodeURIComponent(String(year))}`,
          { cache: "no-store" },
        );
        const json = await response.json();
        if (!response.ok || json.success === false) {
          throw new Error(json.error || "Failed to load live standings");
        }
        if (!json.available) {
          setAvailable(false);
          if (!isRefresh) {
            setStandingsData(null);
            setRosterEntries([]);
            setTotalEntryCount(0);
          }
          setComputedAt(null);
          setStandingsMode("standings");
          return;
        }
        setAvailable(true);
        if (json.mode === "roster") {
          setStandingsMode("roster");
          setStandingsData(null);
          setComputedAt(null);
          const rows = Array.isArray(json.entries)
            ? (json.entries as RosterEntry[])
            : [];
          setRosterEntries(
            rows.map((row) => ({
              entryName: String(row.entryName ?? ""),
              ...(typeof row.mine === "boolean" ? { mine: row.mine } : {}),
            })),
          );
          setTotalEntryCount(
            typeof json.totalEntryCount === "number"
              ? json.totalEntryCount
              : rows.length,
          );
          return;
        }
        setStandingsMode("standings");
        setRosterEntries([]);
        setTotalEntryCount(0);
        setStandingsData(json.standingsData as StandingsData);
        setComputedAt(
          (json.computedAt as string) ||
            (json.standingsData as StandingsData)?.lastUpdated ||
            null,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load live standings",
        );
        if (!isRefresh) setAvailable(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isNewspaperStandingsYear(viewingYear)) {
      setLoading(false);
      setRefreshing(false);
      setAvailable(true);
      setStandingsData(null);
      setRosterEntries([]);
      setTotalEntryCount(0);
      setStandingsMode("standings");
      setComputedAt(null);
      setError("");
      return;
    }
    if (skipFetchYearRef.current === viewingYear) {
      skipFetchYearRef.current = null;
      setLoading(false);
      return;
    }
    void loadStandings(viewingYear, false);
  }, [viewingYear, loadStandings]);

  useEffect(() => {
    if ((legacyYear || newspaperYear) && filter !== "all") setFilter("all");
  }, [legacyYear, newspaperYear, filter]);

  useEffect(() => {
    if (!isAuthenticated && filter !== "all") setFilter("all");
  }, [isAuthenticated, filter]);

  /**
   * Keep sticky column headers parked under the measured sticky controls band.
   */
  useEffect(() => {
    const el = stickyBarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      setStickyControlsHeight(Math.ceil(el.getBoundingClientRect().height));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    newspaperYear,
    loading,
    standingsData,
    isRosterMode,
    isAuthenticated,
    legacyYear,
    showPaymentBadges,
  ]);

  /**
   * Soft-switch year via history (picks pattern) without full remount.
   */
  const handleYearChange = (year: number) => {
    if (year === viewingYear) return;
    setViewingYear(year);
    const path = buildYearScopedPath(
      "/standings",
      year,
      standingsDefaultYear,
    );
    window.history.replaceState(null, "", path);
  };

  const isMine = useCallback(
    (entry: StandingsEntry) =>
      Boolean(sessionUserId && entry.userId && entry.userId === sessionUserId),
    [sessionUserId],
  );

  const filteredEntries = useMemo(() => {
    if (!standingsData) return [];
    let rows = standingsData.entries;
    if (filter === "mine" && sessionUserId) {
      rows = rows.filter((e) => e.userId === sessionUserId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) => e.player.toLowerCase().includes(q));
    }
    return rows;
  }, [standingsData, filter, search, sessionUserId]);

  const filteredRosterEntries = useMemo(() => {
    let rows = rosterEntries;
    if (filter === "mine" && isAuthenticated) {
      rows = rows.filter((e) => e.mine === true);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) => e.entryName.toLowerCase().includes(q));
    }
    return rows;
  }, [rosterEntries, filter, search, isAuthenticated]);

  const openBracket = (entry: StandingsEntry) => {
    if (!entry.bracketId) return;
    setBracketViewerId(entry.bracketId);
    setBracketViewerTitle(entry.player);
    setBracketViewerOpen(true);
  };

  /**
   * Final Four tiles: preserve TL/BL/TR/BR order; black-frame entry finals picks.
   */
  const renderFinalFour = (
    entry: StandingsEntry,
    data: StandingsData,
    grid: boolean,
  ) => {
    const keyRow: RegionalChampionKeyRow =
      data.regionalChampionKey ?? ["", "", "", ""];
    const eliminated = data.eliminatedTeams || [];
    const iKey = data.semifinalKey?.[0]?.trim() ?? "";
    const jKey = data.semifinalKey?.[1]?.trim() ?? "";
    const finalsLeft = entry.finals[0]?.trim() ?? "";
    const finalsRight = entry.finals[1]?.trim() ?? "";
    // Display order matches existing standings: TL, TR / BL, BR for grid;
    // horizontal desktop keeps sheet order TL, BL, TR, BR.
    const order = grid ? ([0, 2, 1, 3] as const) : ([0, 1, 2, 3] as const);

    return (
      <div
        className={`v-standings__ff${grid ? " v-standings__ff--grid" : ""}`}
        role="group"
        aria-label="Final Four"
      >
        {order.map((sheetIndex) => {
          const team = entry.finalFour[sheetIndex]?.trim() ?? "";
          const actualRegional = keyRow[sheetIndex] ?? "";
          const shadeTone = resolvePickResultTone(
            team,
            actualRegional,
            eliminated,
          );
          const isFinalist =
            team !== "" && (team === finalsLeft || team === finalsRight);
          const keyCellForFinalist = team === finalsLeft ? iKey : jKey;
          const borderTone = isFinalist
            ? resolvePickResultTone(team, keyCellForFinalist, eliminated)
            : undefined;

          if (!team) {
            return (
              <div
                key={`empty-${sheetIndex}`}
                className="v-standings__logo"
                aria-hidden
              />
            );
          }

          return (
            <StandingsLogo
              key={`${team}-${sheetIndex}`}
              teamName={team}
              directLogo={data.teamLogos?.[team]}
              teamIdLookup={teamIdLookup}
              isFinalist={isFinalist}
              shadeTone={shadeTone}
              borderTone={borderTone}
              tilePx={logoSizing.finalFourDesktopPx}
              a11yPhrases={a11yPhrases}
            />
          );
        })}
      </div>
    );
  };

  const renderChamp = (entry: StandingsEntry, data: StandingsData) => {
    const shadeTone = resolvePickResultTone(
      entry.champion,
      data.finalWinner || "",
      data.eliminatedTeams || [],
    );
    return (
      <StandingsLogo
        teamName={entry.champion}
        directLogo={data.teamLogos?.[entry.champion]}
        teamIdLookup={teamIdLookup}
        champ
        tilePx={logoSizing.champDesktopPx}
        shadeTone={entry.champion ? shadeTone : "pending"}
        borderTone={
          entry.champion && shadeTone !== "pending" ? shadeTone : undefined
        }
        title={entry.champion || a11yPhrases.noChampionPick}
        a11yPhrases={a11yPhrases}
      />
    );
  };

  /**
   * Mobile Option B stats line under the entry name (payment badge beside TB).
   */
  const mobileStatsLine = (entry: StandingsEntry) => {
    const gap = formatPointsGap(entry.points, leaderPoints);
    const tbRaw = standingsData
      ? formatStandingsTieBreakerDisplay(entry, standingsData)
      : `TB: ${entry.tb}`;
    // Strip leading "TB: " for compact mobile line: `145 PTS · TB 138`
    const tbNum = tbRaw.replace(/^TB:\s*/i, "");
    const pts = `${entry.points} PTS`;
    const badge = renderPaymentBadge(entry);
    return (
      <div className="v-standings__m-stats">
        <p className="v-standings__m-stats-text">
          {gap.text ? (
            <>
              <span>{pts}</span>{" "}
              <span aria-label={gap.ariaLabel ?? undefined}>{gap.text}</span>
              {" · "}
              <span>TB {tbNum}</span>
            </>
          ) : (
            <>
              {pts} · TB {tbNum}
            </>
          )}
        </p>
        {badge}
      </div>
    );
  };

  const updatedText = computedAt
    ? `${copy.updatedLabel} ${formatUpdatedAt(computedAt)}`
    : "";

  const keyGamesComplete =
    typeof standingsData?.keyGamesComplete === "number" &&
    Number.isFinite(standingsData.keyGamesComplete)
      ? Math.max(0, Math.floor(standingsData.keyGamesComplete))
      : null;
  const keyGamesTotal =
    typeof standingsData?.keyGamesTotal === "number" &&
    Number.isFinite(standingsData.keyGamesTotal) &&
    standingsData.keyGamesTotal > 0
      ? Math.floor(standingsData.keyGamesTotal)
      : 63;
  const gamesProgressText =
    keyGamesComplete != null
      ? `${keyGamesComplete} of ${keyGamesTotal} Games Complete`
      : null;

  const emptyMessage = (() => {
    if (newspaperYear || loading) return null;
    if (isRosterMode) {
      if (!available) {
        return formatVintageStandingsLabel(copy.notAvailableMessage, {
          year: viewingYear,
        });
      }
      if (
        filter === "mine" &&
        filteredRosterEntries.length === 0 &&
        !search.trim()
      ) {
        return copy.noMyEntriesMessage;
      }
      if (search.trim() && filteredRosterEntries.length === 0) {
        return copy.noSearchResultsMessage;
      }
      return null;
    }
    if (!available || !standingsData) {
      return formatVintageStandingsLabel(copy.notAvailableMessage, {
        year: viewingYear,
      });
    }
    if (filter === "mine" && filteredEntries.length === 0 && !search.trim()) {
      return copy.noMyEntriesMessage;
    }
    if (filteredEntries.length === 0) {
      return copy.noSearchResultsMessage;
    }
    return null;
  })();

  const pageHeading = newspaperYear
    ? copy.paper2020.pageHeading
    : isRosterMode
      ? copy.rosterHeading.trim() || copy.heading
      : copy.heading;

  const rosterCountLabel = formatVintageStandingsLabel(
    copy.rosterCountTemplate,
    { count: totalEntryCount },
  );
  const rosterIntroText = formatVintageStandingsLabel(copy.rosterIntro, {
    year: viewingYear,
  });

  return (
    <VintageShell content={home} testId="vintage-standings-page">
      <div
        className={`v-standings${isRosterMode ? " v-standings--roster" : ""}`}
        data-testid="vintage-live-standings"
        data-mode={isRosterMode ? "roster" : "standings"}
        style={
          {
            ...(standingsResultChromeStyle(copy) as CSSProperties),
            ...(paymentChromeVars as CSSProperties),
            ["--vs-sticky-controls-height" as string]: `${stickyControlsHeight}px`,
          } as CSSProperties
        }
      >
        <header className="v-standings__header">
          <div className="v-standings__title-block">
            <h1 className="v-standings__heading">{pageHeading}</h1>
            {newspaperYear &&
            !isPaper2020SectionHidden(copy.paper2020.hidePageSubhead) ? (
              <p className="v-standings__updated" data-testid="standings-updated">
                {copy.paper2020.pageSubhead}
              </p>
            ) : !newspaperYear && !isRosterMode && updatedText ? (
              <p
                className="v-standings__updated"
                data-testid="standings-updated"
              >
                <span>
                  {updatedText}
                  {refreshing ? " · Refreshing…" : ""}
                </span>
                {gamesProgressText ? (
                  <span
                    className="v-standings__progress"
                    data-testid="standings-games-complete"
                  >
                    <Image
                      src="/images/basketball icon.png"
                      alt=""
                      width={16}
                      height={16}
                      className="v-standings__progress-ball"
                      unoptimized
                    />
                    <span>{gamesProgressText}</span>
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="v-standings__header-right">
            <div className="v-standings__year">
              <label className="v-standings__sr-only" htmlFor="standings-year">
                Standings year
              </label>
              <select
                id="standings-year"
                value={viewingYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                aria-label={formatVintageStandingsLabel(
                  copy.yearSelectAriaLabel,
                  { year: viewingYear },
                )}
                data-testid="standings-year-select"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="v-standings__year-icon" aria-hidden />
            </div>
            {admin ? (
              <Link
                href={
                  newspaperYear
                    ? "/vintage/admin/standings#ve-section-2020-newspaper"
                    : "/vintage/admin/standings"
                }
                className="v-edit-gear v-standings__gear"
                data-testid={
                  newspaperYear
                    ? "vintage-paper-2020-gear"
                    : "vintage-standings-gear"
                }
                aria-label={
                  newspaperYear
                    ? "Edit 2020 newspaper"
                    : "Edit Standings copy"
                }
                title={
                  newspaperYear
                    ? "Edit 2020 newspaper"
                    : "Edit Standings copy"
                }
              >
                <Settings size={13} strokeWidth={2.25} aria-hidden />
              </Link>
            ) : null}
          </div>
        </header>

        {newspaperYear ? (
          <Standings2020Newspaper copy={copy.paper2020} />
        ) : null}

        {!newspaperYear && !loading ? (
        <div
          ref={stickyBarRef}
          className="v-standings__sticky-bar"
          data-testid="standings-sticky-bar"
        >
          <div className="v-standings__controls">
            <div className="v-standings__search">
              <Search
                className="v-standings__search-icon"
                size={16}
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                data-testid="standings-search"
                autoComplete="off"
              />
            </div>
            {isAuthenticated && !legacyYear ? (
              <div
                className="v-standings__filter"
                role="group"
                aria-label="Entry filter"
              >
                <button
                  type="button"
                  aria-pressed={filter === "all"}
                  onClick={() => setFilter("all")}
                  data-testid="standings-filter-all"
                >
                  {copy.filterAllLabel}
                </button>
                <button
                  type="button"
                  aria-pressed={filter === "mine"}
                  onClick={() => setFilter("mine")}
                  data-testid="standings-filter-mine"
                >
                  {copy.filterMineLabel}
                </button>
              </div>
            ) : null}
          </div>

          {!loading && !emptyMessage && standingsData && !isRosterMode ? (
            <div
              className="v-standings__mobile"
              data-testid="standings-mobile-head"
            >
              <div
                className="v-standings__m-head v-standings__m-head--no-paid"
                aria-hidden
              >
                <span>{copy.colRankHeaderMobile}</span>
                <span>{copy.colEntryHeaderMobile}</span>
                <span>{copy.colFinalFourHeaderMobile}</span>
                <span>{copy.colChampHeaderMobile}</span>
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

        {isRosterMode && !loading && available ? (
          <div
            className="v-standings__roster-hero"
            data-testid="standings-roster-hero"
          >
            <p
              className="v-standings__roster-count"
              data-testid="standings-roster-count"
            >
              {rosterCountLabel}
            </p>
            {rosterIntroText.trim() ? (
              <CmsText
                as="p"
                className="v-standings__roster-intro"
                text={rosterIntroText}
              />
            ) : null}
            {!isAuthenticated && copy.rosterSignInHint.trim() ? (
              <CmsText
                as="p"
                className="v-standings__roster-signin"
                data-testid="standings-roster-signin-hint"
                text={copy.rosterSignInHint.trim()}
              />
            ) : null}
          </div>
        ) : null}

        {error && (standingsData || isRosterMode) ? (
          <p className="v-standings__status v-standings__status--error" role="status">
            {error} — showing last successful data.
          </p>
        ) : null}

        {loading ? (
          <div
            className="v-standings__loading"
            role="status"
            data-testid="standings-loading"
          >
            <div className="v-standings__loading-spinner" aria-hidden />
            <p className="v-standings__loading-text">Loading standings…</p>
          </div>
        ) : emptyMessage ? (
          <CmsText
            as="p"
            className="v-standings__status"
            role="status"
            data-testid="standings-empty"
            text={emptyMessage}
          />
        ) : isRosterMode ? (
          <>
            <div
              className="v-standings__roster-list"
              data-testid="standings-roster-list"
            >
              <ul className="v-standings__roster-ul">
                {filteredRosterEntries.map((entry, index) => (
                  <li
                    key={`${entry.entryName}-${index}`}
                    className={
                      entry.mine
                        ? "v-standings__roster-item is-yours"
                        : "v-standings__roster-item"
                    }
                    data-testid={
                      entry.mine
                        ? "standings-roster-row-yours"
                        : "standings-roster-row"
                    }
                  >
                    <span className="v-standings__roster-name">
                      {entry.entryName}
                    </span>
                    {entry.mine ? (
                      <span className="v-standings__yours">
                        {copy.yoursBadgeLabel}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <footer className="v-standings__footer">
              <p data-testid="standings-showing-count">
                {formatVintageStandingsLabel(copy.showingCountTemplate, {
                  shown: filteredRosterEntries.length,
                  total: totalEntryCount,
                })}
              </p>
            </footer>
          </>
        ) : standingsData ? (
          <>
            {/* One semantic table: sticky thead + body (F05). */}
            <div className="v-standings__desktop v-standings__table-wrap">
              <table
                className="v-standings__table"
                data-testid="standings-desktop-table"
              >
                <caption className="v-standings__sr-only">
                  {formatVintageStandingsLabel(copy.heading, {
                    year: viewingYear,
                  })}
                </caption>
                <colgroup>
                  <col className="v-standings__col-rank" />
                  <col className="v-standings__col-entry" />
                  {showPaymentBadges ? (
                    <col className="v-standings__col-paid" />
                  ) : null}
                  <col className="v-standings__col-points" />
                  <col className="v-standings__col-gap" />
                  <col className="v-standings__col-tb" />
                  <col className="v-standings__col-ff" />
                  <col className="v-standings__col-champ" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">{copy.colRankHeader}</th>
                    <th scope="col">{copy.colEntryHeader}</th>
                    {showPaymentBadges ? (
                      <th scope="col">{copy.colPaidHeader}</th>
                    ) : null}
                    <th scope="col">{copy.colPointsHeader}</th>
                    <th scope="col" aria-label={copy.gapColumnAriaLabel}>
                      {copy.colGapHeader}
                    </th>
                    <th scope="col">{copy.colTbHeader}</th>
                    <th scope="col">{copy.colFinalFourHeader}</th>
                    <th scope="col">{copy.colChampHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => {
                    const mine = isMine(entry);
                    const gap = formatPointsGap(entry.points, leaderPoints);
                    return (
                      <tr
                        key={entry.bracketId || `${entry.rank}-${entry.player}`}
                        className={mine ? "is-yours" : undefined}
                        data-testid={
                          mine ? "standings-row-yours" : "standings-row"
                        }
                      >
                        <td>
                          <StandingsRankCell rank={entry.rank} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="v-standings__entry-name"
                            onClick={() => openBracket(entry)}
                            disabled={!entry.bracketId}
                            title={entry.player}
                          >
                            {entry.player}
                          </button>
                          {mine ? (
                            <span className="v-standings__yours">
                              {copy.yoursBadgeLabel}
                            </span>
                          ) : null}
                        </td>
                        {showPaymentBadges ? (
                          <td className="v-standings__paid-cell">
                            {renderPaymentBadge(entry)}
                          </td>
                        ) : null}
                        <td className="v-standings__points">{entry.points}</td>
                        <td
                          className="v-standings__gap"
                          aria-label={
                            gap.ariaLabel ?? "Tied for or sole first place"
                          }
                        >
                          {gap.text ?? "–"}
                        </td>
                        <td className="v-standings__tb">
                          {formatStandingsTieBreakerDisplay(
                            entry,
                            standingsData,
                          ).replace(/^TB:\s*/i, "")}
                        </td>
                        <td>{renderFinalFour(entry, standingsData, false)}</td>
                        <td>{renderChamp(entry, standingsData)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Option B (column head lives in sticky bar) */}
            <div
              className="v-standings__mobile"
              data-testid="standings-mobile"
            >
              {filteredEntries.map((entry) => {
                const mine = isMine(entry);
                return (
                  <div
                    key={entry.bracketId || `${entry.rank}-${entry.player}`}
                    className={`v-standings__m-row v-standings__m-row--no-paid${
                      mine ? " is-yours" : ""
                    }`}
                    data-testid={
                      mine ? "standings-m-row-yours" : "standings-m-row"
                    }
                  >
                    <StandingsRankCell rank={entry.rank} />
                    <div className="v-standings__m-entry">
                      <div className="v-standings__m-name-row">
                        <button
                          type="button"
                          className="v-standings__entry-name"
                          onClick={() => openBracket(entry)}
                          disabled={!entry.bracketId}
                          title={entry.player}
                        >
                          {entry.player}
                        </button>
                      </div>
                      {mobileStatsLine(entry)}
                    </div>
                    <div className="v-standings__m-ff">
                      {renderFinalFour(entry, standingsData, true)}
                    </div>
                    <div className="v-standings__m-champ">
                      {renderChamp(entry, standingsData)}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="v-standings__footer">
              <p data-testid="standings-showing-count">
                {formatVintageStandingsLabel(copy.showingCountTemplate, {
                  shown: filteredEntries.length,
                  total: standingsData.entries.length,
                })}
              </p>
              <p className="v-standings__legend">
                <CmsText text={copy.legendFinalFourChamp} />
                {" · "}
                <CmsText text={copy.legendFinalistFrame} />
                {copy.legendYoursPaid.trim() ? (
                  <>
                    {" · "}
                    <CmsText text={copy.legendYoursPaid.trim()} />
                  </>
                ) : null}
              </p>
            </footer>
          </>
        ) : null}

        <BracketViewerModal
          isOpen={bracketViewerOpen}
          onClose={() => {
            setBracketViewerOpen(false);
            setBracketViewerId(null);
            setBracketViewerTitle("");
          }}
          bracketId={bracketViewerId}
          year={viewingYear}
          title={bracketViewerTitle}
          bracketFetchMode="pool"
          copy={bracketEditorCopy}
        />
      </div>
    </VintageShell>
  );
}
