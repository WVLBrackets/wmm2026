'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import { getTeamReferenceDisplayName } from '@/lib/teamDisplayName';
import { getPlayInDisplayName, PLAY_IN_LABEL_MAX_LENGTH } from '@/lib/playInDisplayName';
import {
  canonicalTournament,
  createPlayInTeam,
  MATCHUP_SEEDS,
  REGION_POSITIONS,
  STANDARD_REGION_NAMES,
  validateTournamentDefinition,
} from '@/lib/tournamentDefinition';
import TournamentSchoolPicker, { uniqueTournamentSchools } from '@/components/admin/TournamentSchoolPicker';
import {
  buildPlayInLogoSvg,
  normalizePlayInLogoStyle,
  PLAY_IN_DIVIDER_MAX,
  PLAY_IN_LOGO_LAYOUTS,
  PLAY_IN_SCALE_MAX,
  PLAY_IN_SCALE_MIN,
  playInLayoutUsesScale,
} from '@/lib/playInLogoStyle';
import type { PlayInLogoLayout, PlayInLogoStyle, PlayInSchool, TournamentData, TournamentTeam } from '@/types/tournament';

/** Admin design-system tokens (warm paper / ink / action). */
const TB = {
  bg: '#f7f5ef',
  ink: '#182e3b',
  panel: '#fffefa',
  action: '#a4322b',
  border: '#182e3b33',
  muted: '#182e3b99',
} as const;

const emptySchool = (): PlayInSchool => ({ id: '', name: '', logo: '' });

/**
 * Blank managed-year tournament shell for the builder.
 */
function blankTournament(year: string): TournamentData {
  return {
    schemaVersion: 2,
    year,
    name: "Warren's March Madness",
    regions: REGION_POSITIONS.map((position) => ({
      name: '',
      position,
      teams: MATCHUP_SEEDS.map((seed) => ({ ...emptySchool(), seed })),
    })),
    finalFour: { location: '' },
    metadata: {
      startDate: `${year}-03-20`,
      scoring: [
        { round: 'Round of 64', points: 1 },
        { round: 'Round of 32', points: 2 },
        { round: 'Sweet 16', points: 4 },
        { round: 'Elite 8', points: 8 },
        { round: 'Final Four', points: 12 },
        { round: 'Championship', points: 16 },
      ],
    },
  };
}

/**
 * Fisher–Yates shuffle (copy).
 *
 * @param items - Source array
 */
function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/**
 * One combined play-in tile rendered inline at a given pixel size (admin preview only).
 *
 * @param logos - School logo paths for team A and B
 * @param style - Current play-in logo style
 * @param size - Tile edge in px
 * @param idPrefix - Unique id prefix so inlined SVG clip/filter ids do not collide
 */
function PlayInTilePreview({
  logos,
  style,
  size,
  idPrefix,
}: {
  logos: [string | null, string | null];
  style: PlayInLogoStyle;
  size: number;
  idPrefix: string;
}) {
  const svg = useMemo(
    () =>
      buildPlayInLogoSvg(logos, style, idPrefix).replace(
        'width="64" height="64"',
        'width="100%" height="100%"'
      ),
    [logos, style, idPrefix]
  );
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 border"
      style={{ width: size, height: size, borderColor: TB.border, background: '#fff' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const fieldClass = 'mt-0.5 w-full rounded border px-2 py-1 text-sm disabled:opacity-60';
const fieldStyle = { borderColor: TB.border, background: TB.panel, color: TB.ink } as const;
const btnSecondaryClass = 'rounded border px-4 py-2 text-sm disabled:opacity-50';
const btnSecondaryStyle = { borderColor: TB.border, background: TB.panel, color: TB.ink } as const;

export default function TournamentBuilderPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewRef = useRef<HTMLElement | null>(null);
  const [year, setYear] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [data, setData] = useState<TournamentData | null>(null);
  const [schools, setSchools] = useState<PlayInSchool[]>([]);
  const [revision, setRevision] = useState(0);
  const [environment, setEnvironment] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [savedSignature, setSavedSignature] = useState('');
  const dirty = Boolean(data && JSON.stringify(data) !== savedSignature);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const [teamResponse, configResponse] = await Promise.all([
          fetch('/api/admin/team-data?activeOnly=true'),
          fetch('/api/site-config'),
        ]);
        const teams = await teamResponse.json();
        const config = await configResponse.json();
        if (!teamResponse.ok || !teams.success) {
          throw new Error(teams.error || 'Admin access is required to load schools.');
        }
        const choices = Object.values(
          teams.data as Record<string, { id: string; name: string; displayName?: string; logo: string }>
        )
          .filter((t) => !/^FF[1-4]\b/i.test(t.name))
          .map((t) => ({
            id: t.id,
            name: getTeamReferenceDisplayName(t),
            logo: t.logo || `/logos/teams/${t.id}.png`,
          }));
        if (!cancelled) {
          setSchools(uniqueTournamentSchools(choices));
          const initial =
            searchParams?.get('year') || String(config.data?.tournamentYear || new Date().getFullYear());
          setYear(initial);
          setYearInput(initial);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setErrors([e instanceof Error ? e.message : 'Could not initialize builder.']);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, searchParams]);

  const load = useCallback(async (selectedYear: string) => {
    if (!/^20\d{2}$/.test(selectedYear)) return;
    setBusy(true);
    setErrors([]);
    setMessage('');
    setData(null);
    try {
      const r = await fetch(`/api/admin/tournament-builder?year=${selectedYear}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load tournament.');
      const definition = j.draft || j.published || j.legacy || blankTournament(selectedYear);
      setData(definition);
      setRevision(j.revision);
      setEnvironment(j.environment);
      setReadOnly(j.readOnly);
      setSavedSignature(JSON.stringify(definition));
      setPreview(false);
      setMessage(
        j.draft
          ? 'Loaded saved draft.'
          : j.published
            ? 'Loaded published tournament.'
            : j.legacy
              ? 'Loaded legacy JSON.'
              : 'New tournament. Save a draft as you build.'
      );
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not load tournament.']);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load(year);
  }, [ready, year, load]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (fn: (current: TournamentData) => TournamentData) => {
    setData((current) => current && fn(current));
    setMessage('');
    setErrors([]);
    setPreview(false);
  };

  /**
   * Patch one seed slot in a specific region.
   */
  const updateSlot = (
    regionIdx: number,
    seed: number,
    fn: (team: TournamentTeam) => TournamentTeam,
  ) =>
    update((d) => ({
      ...d,
      regions: d.regions.map((r, i) =>
        i === regionIdx ? { ...r, teams: r.teams.map((t) => (t.seed === seed ? fn(t) : t)) } : r
      ),
    }));

  const filled = useMemo(
    () =>
      data?.regions.flatMap((r) => r.teams).filter((t) => (t.playIn ? t.playIn.teams.every((s) => s.id) : t.id))
        .length ?? 0,
    [data]
  );

  const logoStyle = useMemo(() => normalizePlayInLogoStyle(data?.display?.playInLogo), [data]);

  /** Play-in pairs in this field, or a sample pair from the school list when none exist yet. */
  const previewPairs = useMemo(() => {
    const pairs = (data?.regions ?? [])
      .flatMap((r) => r.teams)
      .filter((t) => t.playIn)
      .map((t) => ({
        key: t.id,
        label: getPlayInDisplayName(t.playIn!.teams, t.playIn!.displayName),
        logos: [t.playIn!.teams[0].logo || null, t.playIn!.teams[1].logo || null] as [string | null, string | null],
      }));
    if (pairs.length || schools.length < 2) return { sample: false, pairs };
    return {
      sample: true,
      pairs: [
        {
          key: 'sample',
          label: `${schools[0].name} / ${schools[1].name}`,
          logos: [schools[0].logo, schools[1].logo] as [string | null, string | null],
        },
      ],
    };
  }, [data, schools]);

  /** Patch the presentation-only play-in logo style. */
  const updateLogoStyle = (patch: Partial<PlayInLogoStyle>) =>
    update((d) => ({
      ...d,
      display: {
        ...d.display,
        playInLogo: normalizePlayInLogoStyle({ ...normalizePlayInLogoStyle(d.display?.playInLogo), ...patch }),
      },
    }));

  const save = async (action: 'draft' | 'publish') => {
    if (!data) return;
    const issues = validateTournamentDefinition(data, action === 'publish');
    if (issues.length) {
      setErrors(issues);
      return;
    }
    if (
      action === 'publish' &&
      !window.confirm(
        `Publish tournament ${year} to ${environment}? This makes this field available here. Existing site availability and deadline settings remain in effect.`
      )
    ) {
      return;
    }
    setBusy(true);
    setErrors([]);
    setMessage('');
    try {
      const definition = canonicalTournament(data);
      const r = await fetch('/api/admin/tournament-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ action, definition, revision }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Tournament was not saved.');
      setData(definition);
      setRevision(j.revision);
      setSavedSignature(JSON.stringify(definition));
      if (action === 'publish') {
        // Leave the editor; Tourney tab shows confirmation and refreshes its R1 preview.
        router.push(
          `/admin?tab=tourney&published=${encodeURIComponent(year)}&env=${encodeURIComponent(environment)}`
        );
        return;
      }
      setMessage('Draft saved. The public field is unchanged.');
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Tournament was not saved.']);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Toggle the regional field preview and scroll it into view when opening.
   */
  const togglePreview = () => {
    if (!data) return;
    const issues = readOnly ? [] : validateTournamentDefinition(data);
    setErrors(issues);
    if (issues.length) return;
    setPreview((open) => {
      const next = !open;
      if (next) {
        window.setTimeout(() => {
          previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
      return next;
    });
  };

  const exportJson = () => {
    if (!data) return;
    const issues = readOnly ? [] : validateTournamentDefinition(data);
    if (issues.length) {
      setErrors(issues);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(readOnly ? data : canonicalTournament(data), null, 2)], {
        type: 'application/json',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-${year}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /**
   * Fill all 64 slots with unique single teams and assign shuffled standard region names.
   * Does not save — user can edit, then Save Draft / Publish.
   * Builds the next document outside setState so React Strict Mode double-invoke
   * cannot consume the pick list twice via a shared cursor.
   */
  const fillRandom = () => {
    if (!data || readOnly) return;
    if (schools.length < 64) {
      setErrors([`Need at least 64 schools to randomize (found ${schools.length}).`]);
      return;
    }
    if (
      dirty &&
      !window.confirm('Replace the current field with a random 64-team draw? Unsaved edits will be lost.')
    ) {
      return;
    }
    const picks = shuffled(schools).slice(0, 64);
    const regionNames = shuffled([...STANDARD_REGION_NAMES]);
    const next: TournamentData = {
      ...data,
      regions: data.regions.map((region, ri) => ({
        ...region,
        name: regionNames[ri] ?? region.name,
        teams: MATCHUP_SEEDS.map((seed, si) => {
          const school = picks[ri * 16 + si];
          return {
            id: String(school?.id ?? ''),
            name: String(school?.name ?? ''),
            logo: String(school?.logo ?? ''),
            seed,
          };
        }),
      })),
    };
    update(() => next);
    setMessage('Random field applied — review and edit, then Save Draft or Publish.');
  };

  /**
   * One seed slot: seed · school · Play-in checkbox on one compact row.
   */
  const slot = (regionIdx: number, seed: number) => {
    const region = data!.regions[regionIdx];
    const t = region.teams.find((s) => s.seed === seed)!;
    const labelBase = `${region.name || region.position} seed ${seed}`;

    return (
      <div key={seed} className="border-t py-1 first:border-0" style={{ borderColor: TB.border }}>
        <div className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-right text-xs font-bold" style={{ color: TB.ink }}>
            {seed}
          </span>
          {!t.playIn && (
            <TournamentSchoolPicker
              label={labelBase}
              value={t}
              schools={schools}
              disabled={busy || readOnly}
              onChange={(school) => updateSlot(regionIdx, seed, () => ({ ...school, seed }))}
            />
          )}
          {t.playIn && (
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: TB.muted }}>
              Play-in · pick two schools below
            </span>
          )}
          <label
            className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap"
            style={{ color: TB.ink }}
          >
            <input
              type="checkbox"
              aria-label={`${labelBase} play-in`}
              checked={Boolean(t.playIn)}
              disabled={busy || readOnly}
              data-testid={`tb-playin-${regionIdx}-${seed}`}
              onChange={(e) =>
                updateSlot(regionIdx, seed, (current) =>
                  e.target.checked
                    ? createPlayInTeam(year, region.position, seed, [
                        current.id && !current.playIn ? current : emptySchool(),
                        emptySchool(),
                      ])
                    : { ...(current.playIn?.teams[0] || emptySchool()), seed }
                )
              }
            />
            Play-in
          </label>
        </div>
        {t.playIn && (
          <div className="mt-1 space-y-1 pl-6">
            {t.playIn.teams.map((s, index) => (
              <TournamentSchoolPicker
                key={index}
                label={`${labelBase}, play-in school ${index + 1}`}
                value={s}
                schools={schools}
                disabled={busy || readOnly}
                onChange={(school) =>
                  updateSlot(regionIdx, seed, (current) => {
                    const pair = [...current.playIn!.teams] as [PlayInSchool, PlayInSchool];
                    pair[index] = school;
                    return createPlayInTeam(year, region.position, seed, pair);
                  })
                }
              />
            ))}
            <label className="block text-xs" style={{ color: TB.ink }}>
              Combined display name (optional)
              <input
                aria-label={`${labelBase} combined display name`}
                value={t.playIn.displayName ?? ''}
                placeholder={getPlayInDisplayName(t.playIn.teams)}
                maxLength={PLAY_IN_LABEL_MAX_LENGTH}
                disabled={busy || readOnly}
                onChange={(e) =>
                  updateSlot(regionIdx, seed, (current) => ({
                    ...current,
                    name: getPlayInDisplayName(current.playIn!.teams, e.target.value),
                    playIn: { ...current.playIn!, displayName: e.target.value },
                  }))
                }
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <p className="break-words text-[11px]" style={{ color: TB.muted }}>
              Shown as:{' '}
              <strong style={{ color: TB.ink }}>
                {getPlayInDisplayName(t.playIn.teams, t.playIn.displayName)}
              </strong>
            </p>
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <p className="p-6" style={{ background: TB.bg, color: TB.ink }}>
        Loading…
      </p>
    );
  }
  if (status === 'unauthenticated') {
    return (
      <div className="p-6 min-h-screen" style={{ background: TB.bg, color: TB.ink }}>
        <Link href="/auth/signin" style={{ color: TB.action }}>
          Sign in to use tournament admin
        </Link>
      </div>
    );
  }

  return (
    <main
      className="min-h-screen px-4 py-6"
      style={{ background: TB.bg, color: TB.ink }}
      data-testid="tournament-builder"
    >
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin?tab=tourney"
          onClick={(e) => {
            if (dirty && !window.confirm('Leave without saving your draft?')) e.preventDefault();
          }}
          className="text-sm underline"
          style={{ color: TB.action }}
        >
          ← Back to Tourney
        </Link>

        <div className="my-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: TB.ink }}>
              Tournament Builder
            </h1>
            <p className="text-sm" style={{ color: TB.muted }}>
              {environment} · Revision {revision} · {filled}/64 slots ready
              {dirty ? ' · Unsaved changes' : ''}
            </p>
          </div>
          <label className="text-sm" style={{ color: TB.ink }}>
            Tournament year
            <input
              type="number"
              aria-label="Tournament year"
              value={yearInput}
              min={2022}
              max={2099}
              disabled={busy}
              onChange={(e) => setYearInput(e.target.value)}
              className="ml-2 w-24 rounded border px-2 py-2"
              style={fieldStyle}
            />
            <button
              type="button"
              disabled={busy || yearInput === year}
              onClick={() => {
                if (!/^20\d{2}$/.test(yearInput)) {
                  setErrors(['Enter a four-digit tournament year.']);
                  return;
                }
                if (dirty && !window.confirm('Discard unsaved changes and change year?')) return;
                setYear(yearInput);
              }}
              className="ml-2 rounded border px-3 py-2 disabled:opacity-50"
              style={btnSecondaryStyle}
            >
              Load Year
            </button>
          </label>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="mb-4 border p-3 text-sm"
            style={{ borderColor: TB.action, background: '#fce8e6', color: TB.ink }}
          >
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!dirty || window.confirm('Reload and discard unsaved changes?')) void load(year);
              }}
              className="mt-2 underline"
              style={{ color: TB.action }}
            >
              Reload workspace
            </button>
          </div>
        )}

        {message && (
          <p role="status" className="mb-4 text-sm" style={{ color: '#1a5c3a' }}>
            {message}
          </p>
        )}
        {busy && (
          <p className="mb-3 text-sm" style={{ color: TB.muted }}>
            Working…
          </p>
        )}

        {data && (
          <>
            {readOnly && (
              <p
                className="mb-4 border p-3 text-sm"
                style={{ borderColor: '#c9a227', background: '#fff8e6', color: TB.ink }}
              >
                Historical tournaments remain unchanged. Select the current or a future year to build a
                new tournament.
              </p>
            )}

            <fieldset
              disabled={busy || readOnly}
              className="mb-5 grid gap-4 rounded border p-4 sm:grid-cols-3"
              style={{ borderColor: TB.border, background: TB.panel }}
            >
              <label className="text-sm" style={{ color: TB.ink }}>
                Tournament name
                <input
                  value={data.name}
                  onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label className="text-sm" style={{ color: TB.ink }}>
                Round of 64 start date
                <input
                  type="date"
                  value={data.metadata.startDate}
                  onChange={(e) =>
                    update((d) => ({ ...d, metadata: { ...d.metadata, startDate: e.target.value } }))
                  }
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label className="text-sm" style={{ color: TB.ink }}>
                Final Four location
                <input
                  value={data.finalFour.location}
                  onChange={(e) => update((d) => ({ ...d, finalFour: { location: e.target.value } }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
            </fieldset>

            <fieldset
              disabled={busy || readOnly}
              className="mb-5 rounded border p-4"
              style={{ borderColor: TB.border, background: TB.panel }}
              data-testid="tb-playin-logo-style"
            >
              <legend className="px-1 text-sm font-bold" style={{ color: TB.ink }}>
                Play-in logo style
              </legend>
              <p className="mb-3 text-xs" style={{ color: TB.muted }}>
                How an undecided play-in pair shares one logo square on brackets, Standings, and My Picks.
                Display only: it can change after entries exist. Publish to apply.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm" style={{ color: TB.ink }}>
                  Layout
                  <select
                    value={logoStyle.layout}
                    onChange={(e) => updateLogoStyle({ layout: e.target.value as PlayInLogoLayout })}
                    className={`${fieldClass} min-w-[14rem]`}
                    style={fieldStyle}
                    data-testid="tb-playin-logo-layout"
                  >
                    {PLAY_IN_LOGO_LAYOUTS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="text-sm"
                  style={{ color: TB.ink, opacity: playInLayoutUsesScale(logoStyle.layout) ? 1 : 0.45 }}
                >
                  Logo size: {logoStyle.scalePercent}% of square
                  <input
                    type="range"
                    min={PLAY_IN_SCALE_MIN}
                    max={PLAY_IN_SCALE_MAX}
                    step={1}
                    value={logoStyle.scalePercent}
                    disabled={busy || readOnly || !playInLayoutUsesScale(logoStyle.layout)}
                    onChange={(e) => updateLogoStyle({ scalePercent: Number(e.target.value) })}
                    className="mt-1 block w-48"
                    data-testid="tb-playin-logo-scale"
                  />
                </label>
                <label className="text-sm" style={{ color: TB.ink }}>
                  {logoStyle.layout === 'corner-overlap' ? 'White halo' : 'White divider line'}
                  <select
                    value={logoStyle.dividerWidth}
                    onChange={(e) => updateLogoStyle({ dividerWidth: Number(e.target.value) })}
                    className={fieldClass}
                    style={fieldStyle}
                    data-testid="tb-playin-logo-divider"
                  >
                    {Array.from({ length: PLAY_IN_DIVIDER_MAX + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'None' : n === 1 ? 'Hairline' : n === 2 ? 'Thin' : n <= 4 ? `Medium (${n})` : `Thick (${n})`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 space-y-2" data-testid="tb-playin-logo-preview">
                {previewPairs.sample && (
                  <p className="text-xs" style={{ color: TB.muted }}>
                    No play-in pairs in this field yet. Showing a sample pair.
                  </p>
                )}
                {previewPairs.pairs.length === 0 && (
                  <p className="text-xs" style={{ color: TB.muted }}>
                    Add a play-in pair to preview.
                  </p>
                )}
                {previewPairs.pairs.map((p) => (
                  <div key={p.key} className="flex flex-wrap items-center gap-3">
                    <PlayInTilePreview logos={p.logos} style={logoStyle} size={32} idPrefix={`${p.key}-s`} />
                    <PlayInTilePreview logos={p.logos} style={logoStyle} size={42} idPrefix={`${p.key}-m`} />
                    <PlayInTilePreview logos={p.logos} style={logoStyle} size={96} idPrefix={`${p.key}-l`} />
                    <span className="text-xs" style={{ color: TB.ink }}>
                      {p.label}
                      <span style={{ color: TB.muted }}> · Final Four (32px), Champ (42px), zoom</span>
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>

            <datalist id="tb-standard-region-names">
              {STANDARD_REGION_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* All four regions: one column of eight games each */}
            <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2">
              {data.regions.map((region, regionIdx) => (
                <section
                  key={region.position}
                  aria-label={`${region.position} region`}
                  className="rounded border px-2 py-2"
                  style={{ borderColor: TB.border, background: TB.panel }}
                  data-testid={`tb-region-${regionIdx}`}
                >
                  <div className="mb-1.5 border-b pb-1.5" style={{ borderColor: TB.border }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TB.muted }}>
                      {region.position}
                    </p>
                    <label className="mt-0.5 block text-xs" style={{ color: TB.ink }}>
                      Region name
                      <input
                        list="tb-standard-region-names"
                        value={region.name}
                        placeholder="East, West, South, Midwest…"
                        disabled={busy || readOnly}
                        data-testid={`tb-region-name-${regionIdx}`}
                        onChange={(e) =>
                          update((d) => ({
                            ...d,
                            regions: d.regions.map((r, i) =>
                              i === regionIdx ? { ...r, name: e.target.value } : r
                            ),
                          }))
                        }
                        className={`${fieldClass} font-semibold`}
                        style={fieldStyle}
                      />
                    </label>
                  </div>
                  <div className="space-y-0">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        aria-label={`Matchup ${i + 1}`}
                        className="rounded border px-1.5 mb-1 last:mb-0"
                        style={{ borderColor: TB.border }}
                      >
                        {slot(regionIdx, MATCHUP_SEEDS[i * 2])}
                        {slot(regionIdx, MATCHUP_SEEDS[i * 2 + 1])}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {preview && (
              <section
                ref={previewRef}
                aria-label="Tournament field preview"
                className="mt-5 scroll-mt-4"
                data-testid="tb-field-preview"
              >
                <h2 className="mb-2 text-sm font-bold" style={{ color: TB.ink }}>
                  Field preview · Round of 64 by region
                </h2>
                <p className="mb-3 text-xs" style={{ color: TB.muted }}>
                  Checklist of the current draft (not the interactive bracket). Use Hide Field Preview
                  when done.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {data.regions.map((r) => (
                    <div
                      key={r.position}
                      className="border p-3"
                      style={{ borderColor: TB.border, background: TB.panel }}
                    >
                      <h3 className="mb-2 text-sm font-bold" style={{ color: TB.ink }}>
                        {r.name || '—'} · {r.position}
                      </h3>
                      {Array.from({ length: 8 }, (_, i) => (
                        <div
                          key={i}
                          className="mb-1.5 border-b pb-1.5 text-xs"
                          style={{ borderColor: TB.border }}
                        >
                          {MATCHUP_SEEDS.slice(i * 2, i * 2 + 2).map((seed) => {
                            const t = r.teams.find((team) => team.seed === seed)!;
                            return (
                              <div key={seed} className="flex items-center gap-1.5 py-0.5">
                                <span className="w-4 text-right">{seed}</span>
                                {(t.playIn?.teams || [t]).map((s) =>
                                  s.logo ? (
                                    <Image
                                      key={s.id}
                                      src={s.logo}
                                      alt=""
                                      width={16}
                                      height={16}
                                      unoptimized
                                      className="h-4 w-4 object-contain"
                                    />
                                  ) : null
                                )}
                                <span title={t.playIn?.teams.map((s) => s.name).join(' / ')}>
                                  {t.playIn
                                    ? getPlayInDisplayName(t.playIn.teams, t.playIn.displayName)
                                    : t.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div
              className="sticky bottom-0 z-20 mt-5 flex flex-wrap gap-2 border-t p-3"
              style={{ borderColor: TB.border, background: TB.panel }}
            >
              <button
                type="button"
                disabled={busy || readOnly}
                onClick={fillRandom}
                className={btnSecondaryClass}
                style={btnSecondaryStyle}
                data-testid="tb-random-fill"
                title="Fill 64 unique single teams and standard region names (editable before save)"
              >
                Random
              </button>
              <button
                type="button"
                disabled={busy || readOnly}
                onClick={() => void save('draft')}
                className={btnSecondaryClass}
                style={btnSecondaryStyle}
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={togglePreview}
                className={btnSecondaryClass}
                style={btnSecondaryStyle}
                aria-pressed={preview}
                data-testid="tb-preview-bracket"
                title="Show or hide a four-region Round of 64 field checklist (not the interactive bracket)"
              >
                {preview ? 'Hide Field Preview' : 'Preview Field'}
              </button>
              <button
                type="button"
                disabled={busy || readOnly}
                onClick={() => void save('publish')}
                className="rounded px-4 py-2 text-sm text-white disabled:opacity-50"
                style={{ background: TB.action }}
              >
                Publish to {environment}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={exportJson}
                className={btnSecondaryClass}
                style={btnSecondaryStyle}
              >
                Export JSON
              </button>
              {errors.length > 0 && (
                <p
                  role="alert"
                  className="basis-full text-sm font-semibold"
                  style={{ color: TB.action }}
                  data-testid="tb-save-error"
                >
                  Not saved: {errors[0]}
                  {errors.length > 1 ? ` (+${errors.length - 1} more above)` : ''}
                </p>
              )}
              {!errors.length && message && (
                <p role="status" className="basis-full text-sm" style={{ color: '#1a5c3a' }}>
                  {message}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
