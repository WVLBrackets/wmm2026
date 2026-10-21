'use client';

import { useEffect, useState } from 'react';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import type { FirstFourResults as Results } from '@/lib/tournamentDefinition';
import type { TournamentData } from '@/types/tournament';

export default function FirstFourResults({ year, onSaved }: { year: string; onSaved?: () => void }) {
  const [data, setData] = useState<TournamentData | null>(null);
  const [results, setResults] = useState<Results>({});
  const [saved, setSaved] = useState<Results>({});
  const [revision, setRevision] = useState(0);
  const [readOnly, setReadOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setMessage(''); setData(null);
    fetch(`/api/admin/tournament-builder?year=${year}`, { cache: 'no-store' }).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load First Four.');
      if (!cancelled) { setData(j.published); setResults(j.results); setSaved(j.results); setRevision(j.revision); setReadOnly(j.readOnly); }
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, reload]);
  const slots = data?.regions.flatMap(r => r.teams.filter(t => t.playIn).map(t => ({ ...t, region: r.name }))) ?? [];
  if (loading) return <p className="my-4 text-sm text-slate-600">Loading First Four results…</p>;
  if (!error && !slots.length) return null;
  const dirty = JSON.stringify(results) !== JSON.stringify(saved);
  const save = async () => {
    if (Object.keys(saved).some(id => saved[id] !== results[id]) && !window.confirm('Correct previously saved First Four results? Picks stay intact; the displayed survivor will change.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/admin/first-four', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...await getCSRFHeaders() }, body: JSON.stringify({ year: Number(year), revision, results }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Results were not saved.');
      setRevision(j.revision); setSaved(j.results); setMessage('First Four results saved. Reopen picks or refresh standings to see the surviving schools.'); onSaved?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Results were not saved.'); }
    finally { setBusy(false); }
  };
  return <section className="my-6 border border-slate-300 p-4" aria-label="First Four results">
    <h3 className="text-lg font-semibold text-slate-900">First Four results · {year}</h3>
    <p className="mb-4 text-sm text-slate-600">Choose the surviving school. These games award no points and do not change anyone’s picks or deadline.</p>
    <fieldset disabled={busy || readOnly} className="space-y-3">
      {slots.map(t => <label className="grid gap-1 text-sm sm:grid-cols-2 sm:items-center" key={t.id}>
        <span className="text-slate-800">{t.region} · {t.seed} · {t.playIn!.teams.map(s => s.name).join(' / ')}</span>
        <select aria-label={`${t.region} seed ${t.seed} survivor`} value={results[t.id] ?? ''}
          onChange={e => setResults(prev => { const next = { ...prev }; if (e.target.value) next[t.id] = e.target.value; else delete next[t.id]; return next; })}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900">
          <option value="">Unresolved</option>{t.playIn!.teams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>)}
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" disabled={busy} onClick={() => setReload(x => x + 1)} className="underline">Reload</button></p>}
    {message && <p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
    {dirty && <p className="mt-3 text-sm text-amber-800">Unsaved First Four results</p>}
    {readOnly ? <p className="mt-3 text-sm text-slate-600">Historical results are read-only.</p> : <button type="button" onClick={save} disabled={busy || !dirty} className="mt-4 rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save First Four Results'}</button>}
  </section>;
}
