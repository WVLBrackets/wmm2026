'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import { getTeamReferenceDisplayName } from '@/lib/teamDisplayName';
import { canonicalTournament, createPlayInTeam, MATCHUP_SEEDS, REGION_POSITIONS, validateTournamentDefinition } from '@/lib/tournamentDefinition';
import TournamentSchoolPicker, { uniqueTournamentSchools } from '@/components/admin/TournamentSchoolPicker';
import type { PlayInSchool, TournamentData, TournamentTeam } from '@/types/tournament';

const emptySchool = (): PlayInSchool => ({ id: '', name: '', logo: '' });
function blankTournament(year: string): TournamentData {
  return { schemaVersion: 2, year, name: "Warren's March Madness",
    regions: REGION_POSITIONS.map(position => ({ name: '', position, teams: MATCHUP_SEEDS.map(seed => ({ ...emptySchool(), seed })) })),
    finalFour: { location: '' },
    metadata: { startDate: `${year}-03-20`, scoring: [
      { round: 'Round of 64', points: 1 }, { round: 'Round of 32', points: 2 },
      { round: 'Sweet 16', points: 4 }, { round: 'Elite 8', points: 8 },
      { round: 'Final Four', points: 12 }, { round: 'Championship', points: 16 },
    ] },
  };
}

export default function TournamentBuilderPage() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [year, setYear] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [data, setData] = useState<TournamentData | null>(null);
  const [schools, setSchools] = useState<PlayInSchool[]>([]);
  const [regionIndex, setRegionIndex] = useState(0);
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
          fetch('/api/admin/team-data?activeOnly=true'), fetch('/api/site-config'),
        ]);
        const teams = await teamResponse.json(), config = await configResponse.json();
        if (!teamResponse.ok || !teams.success) throw new Error(teams.error || 'Admin access is required to load schools.');
        const choices = Object.values(teams.data as Record<string, { id: string; name: string; displayName?: string; logo: string }>)
          .filter(t => !/^FF[1-4]\b/i.test(t.name))
          .map(t => ({ id: t.id, name: getTeamReferenceDisplayName(t), logo: t.logo || `/logos/teams/${t.id}.png` }));
        if (!cancelled) {
          setSchools(uniqueTournamentSchools(choices));
          const initial = searchParams?.get('year') || String(config.data?.tournamentYear || new Date().getFullYear());
          setYear(initial); setYearInput(initial); setReady(true);
        }
      } catch (e) { if (!cancelled) setErrors([e instanceof Error ? e.message : 'Could not initialize builder.']); }
    })();
    return () => { cancelled = true; };
  }, [status, searchParams]);

  const load = useCallback(async (selectedYear: string) => {
    if (!/^20\d{2}$/.test(selectedYear)) return;
    setBusy(true); setErrors([]); setMessage(''); setData(null);
    try {
      const r = await fetch(`/api/admin/tournament-builder?year=${selectedYear}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load tournament.');
      const definition = j.draft || j.published || j.legacy || blankTournament(selectedYear);
      setData(definition); setRevision(j.revision); setEnvironment(j.environment); setReadOnly(j.readOnly);
      setSavedSignature(JSON.stringify(definition)); setPreview(false); setRegionIndex(0);
      setMessage(j.draft ? 'Loaded saved draft.' : j.published ? 'Loaded published tournament.' : j.legacy ? 'Loaded legacy JSON.' : 'New tournament. Save a draft as you build.');
    } catch (e) { setErrors([e instanceof Error ? e.message : 'Could not load tournament.']); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (ready) void load(year); }, [ready, year, load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (fn: (current: TournamentData) => TournamentData) => {
    setData(current => current && fn(current)); setMessage(''); setErrors([]); setPreview(false);
  };
  const updateSlot = (seed: number, fn: (team: TournamentTeam) => TournamentTeam) => update(d => ({
    ...d, regions: d.regions.map((r, i) => i === regionIndex ? { ...r, teams: r.teams.map(t => t.seed === seed ? fn(t) : t) } : r),
  }));
  const region = data?.regions[regionIndex];
  const filled = useMemo(() => data?.regions.flatMap(r => r.teams).filter(t => t.playIn ? t.playIn.teams.every(s => s.id) : t.id).length ?? 0, [data]);

  const save = async (action: 'draft' | 'publish') => {
    if (!data) return;
    const issues = validateTournamentDefinition(data, action === 'publish');
    if (issues.length) { setErrors(issues); return; }
    if (action === 'publish' && !window.confirm(`Publish tournament ${year} to ${environment}? This makes this field available here. Existing site availability and deadline settings remain in effect.`)) return;
    setBusy(true); setErrors([]); setMessage('');
    try {
      const definition = canonicalTournament(data);
      const r = await fetch('/api/admin/tournament-builder', { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getCSRFHeaders() },
        body: JSON.stringify({ action, definition, revision }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Tournament was not saved.');
      setData(definition); setRevision(j.revision); setSavedSignature(JSON.stringify(definition));
      setMessage(action === 'publish' ? `Tournament ${year} published to ${environment}.` : 'Draft saved. The public field is unchanged.');
    } catch (e) { setErrors([e instanceof Error ? e.message : 'Tournament was not saved.']); }
    finally { setBusy(false); }
  };
  const exportJson = () => {
    if (!data) return;
    const issues = readOnly ? [] : validateTournamentDefinition(data);
    if (issues.length) { setErrors(issues); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(readOnly ? data : canonicalTournament(data), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `tournament-${year}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const slot = (seed: number) => {
    const t = region!.teams.find(s => s.seed === seed)!;
    return <div key={seed} className="flex items-start gap-2 border-t border-slate-200 py-3 first:border-0">
      <span className="w-6 shrink-0 pt-2 text-right text-sm font-bold text-slate-700">{seed}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex justify-end">
          <select aria-label={`${region!.name || region!.position} seed ${seed} slot type`} value={t.playIn ? 'playin' : 'single'}
            disabled={busy || readOnly} onChange={e => updateSlot(seed, current => e.target.value === 'playin'
              ? createPlayInTeam(year, region!.position, seed, [current.id && !current.playIn ? current : emptySchool(), emptySchool()])
              : { ...(current.playIn?.teams[0] || emptySchool()), seed })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
            <option value="single">Single team</option><option value="playin">Play-in winner</option>
          </select>
        </div>
        {t.playIn ? <>
          {t.playIn.teams.map((s, index) => <TournamentSchoolPicker key={index}
            label={`${region!.name || region!.position} seed ${seed}, play-in school ${index + 1}`} value={s} schools={schools} disabled={busy || readOnly}
            onChange={school => updateSlot(seed, current => {
              const pair = [...current.playIn!.teams] as [PlayInSchool, PlayInSchool]; pair[index] = school;
              return createPlayInTeam(year, region!.position, seed, pair);
            })} />)}
          <p className="text-xs text-slate-500">The advancing school fills this slot. No play-in points.</p>
        </> : <TournamentSchoolPicker label={`${region!.name || region!.position} seed ${seed}`} value={t} schools={schools} disabled={busy || readOnly}
          onChange={school => updateSlot(seed, () => ({ ...school, seed }))} />}
      </div>
    </div>;
  };

  if (status === 'loading') return <p className="p-6">Loading…</p>;
  if (status === 'unauthenticated') return <div className="p-6"><Link href="/auth/signin">Sign in to use tournament admin</Link></div>;
  return <main className="mx-auto max-w-5xl px-4 py-6 text-slate-900">
    <Link href="/admin?tab=tourney" onClick={e => { if (dirty && !window.confirm('Leave without saving your draft?')) e.preventDefault(); }} className="text-sm underline">← Back to Tourney</Link>
    <div className="my-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Tournament Builder</h1><p className="text-sm text-slate-600">{environment} · Revision {revision} · {filled}/64 slots ready{dirty ? ' · Unsaved changes' : ''}</p></div>
      <label className="text-sm">Tournament year
        <input type="number" aria-label="Tournament year" value={yearInput} min={2022} max={2099} disabled={busy}
          onChange={e => setYearInput(e.target.value)}
          className="ml-2 w-24 rounded border border-slate-300 p-2" />
        <button type="button" disabled={busy || yearInput === year} onClick={() => {
          if (!/^20\d{2}$/.test(yearInput)) { setErrors(['Enter a four-digit tournament year.']); return; }
          if (dirty && !window.confirm('Discard unsaved changes and change year?')) return;
          setYear(yearInput);
        }} className="ml-2 rounded border border-slate-300 px-3 py-2 disabled:opacity-50">Load Year</button>
      </label>
    </div>
    {errors.length > 0 && <div role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Reload and discard unsaved changes?')) void load(year); }} className="mt-2 underline">Reload workspace</button></div>}
    {message && <p role="status" className="mb-4 text-sm text-green-800">{message}</p>}
    {busy && <p className="mb-3 text-sm">Working…</p>}
    {data && <>
      {readOnly && <p className="mb-4 border border-amber-300 bg-amber-50 p-3 text-sm">Historical tournaments remain unchanged. Select the current or a future year to build a new tournament.</p>}
      <fieldset disabled={busy || readOnly} className="mb-5 grid gap-4 rounded border border-slate-300 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm">Tournament name<input value={data.name} onChange={e => update(d => ({ ...d, name: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
        <label className="text-sm">Round of 64 start date<input type="date" value={data.metadata.startDate} onChange={e => update(d => ({ ...d, metadata: { ...d.metadata, startDate: e.target.value } }))} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
        <label className="text-sm">Final Four location<input value={data.finalFour.location} onChange={e => update(d => ({ ...d, finalFour: { location: e.target.value } }))} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
      </fieldset>
      <div role="group" aria-label="Region" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.regions.map((r, i) => <button key={r.position} type="button" aria-pressed={regionIndex === i} onClick={() => setRegionIndex(i)}
          className={`rounded border p-3 text-sm ${regionIndex === i ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white'}`}>
          {r.name || r.position}<span className="block text-xs">{r.position}</span>
        </button>)}
      </div>
      <label className="mb-4 block text-sm">Region name
        <input value={region!.name} placeholder="East, West, South, Midwest…" disabled={busy || readOnly}
          onChange={e => update(d => ({ ...d, regions: d.regions.map((r, i) => i === regionIndex ? { ...r, name: e.target.value } : r) }))}
          className="ml-2 max-w-full rounded border border-slate-300 p-2" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => <section key={i} aria-label={`Matchup ${i + 1}`} className="rounded border border-slate-300 bg-white px-3">
          {slot(MATCHUP_SEEDS[i * 2])}{slot(MATCHUP_SEEDS[i * 2 + 1])}
        </section>)}
      </div>
      <div className="sticky bottom-0 mt-5 flex flex-wrap gap-2 border-t border-slate-300 bg-white p-3">
        <button type="button" disabled={busy || readOnly} onClick={() => void save('draft')} className="rounded border border-slate-400 px-4 py-2 text-sm disabled:opacity-50">Save Draft</button>
        <button type="button" disabled={busy} onClick={() => { const issues = readOnly ? [] : validateTournamentDefinition(data); setErrors(issues); if (!issues.length) setPreview(x => !x); }} className="rounded border border-slate-400 px-4 py-2 text-sm">Preview Bracket</button>
        <button type="button" disabled={busy || readOnly} onClick={() => void save('publish')} className="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">Publish to {environment}</button>
        <button type="button" disabled={busy} onClick={exportJson} className="rounded border border-slate-400 px-4 py-2 text-sm">Export JSON</button>
      </div>
      {preview && <section aria-label="Tournament preview" className="mt-5 grid gap-4 sm:grid-cols-2">
        {data.regions.map(r => <div key={r.position} className="border border-slate-300 bg-white p-4">
          <h2 className="mb-3 font-bold">{r.name} · {r.position}</h2>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="mb-2 border-b pb-2 text-sm">
            {MATCHUP_SEEDS.slice(i * 2, i * 2 + 2).map(seed => {
              const t = r.teams.find(team => team.seed === seed)!;
              return <div key={seed} className="flex items-center gap-2 py-1"><span>{seed}</span>
                {(t.playIn?.teams || [t]).map(s => s.logo ? <Image key={s.id} src={s.logo} alt="" width={20} height={20} unoptimized className="h-5 w-5 object-contain" /> : null)}
                <span>{t.playIn ? t.playIn.teams.map(s => s.name).join(' / ') : t.name}</span>
              </div>;
            })}
          </div>)}
        </div>)}
      </section>}
    </>}
  </main>;
}

