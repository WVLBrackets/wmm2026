'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import type { PlayInSchool } from '@/types/tournament';

/** One label per selection; reference aliases collapse by school id. */
export function uniqueTournamentSchools(schools: PlayInSchool[]): PlayInSchool[] {
  const byId = new Map<string, PlayInSchool>();
  for (const school of schools) if (!byId.has(school.id)) byId.set(school.id, school);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function TournamentSchoolPicker({ label, value, schools, disabled, onChange }: {
  label: string; value: PlayInSchool; schools: PlayInSchool[]; disabled?: boolean;
  onChange: (school: PlayInSchool) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  /** Prefix match only (typing "b" → Baylor, not Abilene). Empty query lists all. */
  const queryNorm = query.toLowerCase().trim();
  const choices = queryNorm
    ? schools.filter((s) => s.name.toLowerCase().startsWith(queryNorm))
    : schools;
  const choose = (school: PlayInSchool) => { onChange(school); setOpen(false); setQuery(''); };
  return <div className="relative min-w-0 flex-1">
    <div className="flex items-center gap-2">
      {value.logo && <Image src={value.logo} alt="" width={24} height={24} unoptimized className="h-6 w-6 shrink-0 object-contain" />}
      <input id={id} aria-label={label} role="combobox" aria-autocomplete="list"
        aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && choices[active] ? `${id}-option-${active}` : undefined}
        value={open ? query : (value.name ?? '')} disabled={disabled} placeholder="Search school…"
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onBlur={() => setOpen(false)}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, choices.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
          if (e.key === 'Enter' && open) { e.preventDefault(); if (choices[active]) choose(choices[active]); }
        }}
        className="w-full min-w-0 rounded border px-2 py-1 text-sm disabled:opacity-60"
        style={{ borderColor: '#182e3b33', background: '#fffefa', color: '#182e3b' }}
      />
      {!disabled && value.id && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={() => choose({ id: '', name: '', logo: '' })}
          className="p-1"
          style={{ color: '#182e3b99' }}
        >
          ×
        </button>
      )}
    </div>
    {open && (
      <ul
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border shadow-lg"
        style={{ borderColor: '#182e3b33', background: '#fffefa' }}
      >
        {choices.length ? (
          choices.map((s, i) => (
            <li
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              className="cursor-pointer px-3 py-2 text-sm"
              style={{
                color: '#182e3b',
                background: i === active ? '#182e3b14' : undefined,
              }}
            >
              {s.name}
            </li>
          ))
        ) : (
          <li className="px-3 py-2 text-sm" style={{ color: '#182e3b99' }}>
            No matching schools
          </li>
        )}
      </ul>
    )}
  </div>;
}
