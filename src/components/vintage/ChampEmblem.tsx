import type { VintageChampEmblem } from "@/lib/vintage/homeCards";

export const CHAMP_EMBLEM_OPTIONS: {
  id: VintageChampEmblem;
  label: string;
  group: string;
}[] = [
  { id: "wreathClassic", label: "Wreath classic", group: "Wreath" },
  { id: "wreathOpen", label: "Wreath open", group: "Wreath" },
  { id: "trophyPedestal", label: "Trophy pedestal", group: "Trophy" },
  { id: "trophyCircle", label: "Trophy circle", group: "Trophy" },
  { id: "sealHex", label: "Hex seal", group: "Other" },
  { id: "sunburst", label: "Sunburst medal", group: "Other" },
];

/**
 * Gold crest for the Reigning Champ card — year sits in the center.
 */
export default function ChampEmblem({
  style,
  year,
}: {
  style: VintageChampEmblem;
  year: string;
}) {
  const label = year.trim() || "—";
  return (
    <div
      className="v-card-champ-emblem"
      data-testid="vintage-champ-emblem"
      data-emblem={style}
      aria-label={`${label} champion emblem`}
    >
      <svg viewBox="0 0 100 100" className="v-card-champ-emblem-svg" aria-hidden="true">
        {style === "wreathClassic" && <WreathClassic />}
        {style === "wreathOpen" && <WreathOpen />}
        {style === "trophyPedestal" && <TrophyPedestal />}
        {style === "trophyCircle" && <TrophyCircle />}
        {style === "sealHex" && <SealHex />}
        {style === "sunburst" && <Sunburst />}
      </svg>
      <span className="v-card-champ-emblem-year">{label}</span>
    </div>
  );
}

function WreathClassic() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M28 78c-14-10-18-28-10-42 7 8 14 18 16 30-4 2-8 6-6 12z" fill="currentColor" fillOpacity=".12" />
      <path d="M72 78c14-10 18-28 10-42-7 8-14 18-16 30 4 2 8 6 6 12z" fill="currentColor" fillOpacity=".12" />
      <path d="M30 76c-12-8-16-24-10-38M26 52c4 6 8 12 10 20M34 42c3 7 6 14 7 22" />
      <path d="M70 76c12-8 16-24 10-38M74 52c-4 6-8 12-10 20M66 42c-3 7-6 14-7 22" />
      <path d="M32 34c-2 5 1 9 4 11M28 44c-1 5 2 9 5 11M36 28c0 4 3 7 6 8" />
      <path d="M68 34c2 5-1 9-4 11M72 44c1 5-2 9-5 11M64 28c0 4-3 7-6 8" />
      <circle cx="50" cy="50" r="22" strokeWidth="1.6" opacity=".55" />
    </g>
  );
}

function WreathOpen() {
  return (
    <g fill="currentColor" stroke="currentColor" strokeWidth="1.4">
      <path d="M22 70c-6-14-2-30 10-40-1 10 2 20 8 28-8 0-14 4-18 12z" fillOpacity=".9" stroke="none" />
      <path d="M78 70c6-14 2-30-10-40 1 10-2 20-8 28 8 0 14 4 18 12z" fillOpacity=".9" stroke="none" />
      <path d="M24 48c3-1 6 1 7 4M22 58c3 0 6 2 7 5M30 38c3-1 5 2 6 5" fill="none" strokeWidth="2" />
      <path d="M76 48c-3-1-6 1-7 4M78 58c-3 0-6 2-7 5M70 38c-3-1-5 2-6 5" fill="none" strokeWidth="2" />
      <path d="M38 78h24" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="50" cy="48" r="20" fill="none" strokeWidth="1.5" opacity=".4" />
    </g>
  );
}

function TrophyPedestal() {
  return (
    <g fill="currentColor">
      <path d="M38 18h24v4l-2 2v16c0 7-4 11-10 13v5h8v4H42v-4h8v-5c-6-2-10-6-10-13V24l-2-2v-4z" />
      <path d="M36 24h-8c0 10 4 16 10 18M64 24h8c0 10-4 16-10 18" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="34" y="66" width="32" height="5" rx="1" />
      <rect x="40" y="71" width="20" height="4" rx="1" />
      <circle cx="50" cy="44" r="16" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".35" />
    </g>
  );
}

function TrophyCircle() {
  return (
    <g fill="currentColor">
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
      <path d="M41 28h18v3l-1.5 1.5v12c0 5-3 8-7.5 9.5v4h6v3H43.5v-3h6v-4C45 52.5 42 49.5 42 44.5v-12L40.5 31V28z" />
      <path d="M40 32h-5c0 7 2.5 11 7 13M60 32h5c0 7-2.5 11-7 13" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="43" y="62" width="14" height="3" rx="0.5" />
    </g>
  );
}

function SealHex() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M50 8l34 20v40L50 88 16 68V28z" />
      <path d="M50 18l24 14v28L50 74 26 60V32z" opacity=".55" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="18" strokeWidth="1.3" opacity=".7" />
    </g>
  );
}

function Sunburst() {
  return (
    <g fill="currentColor" stroke="currentColor">
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        const x1 = 50 + Math.cos(a) * 24;
        const y1 = 50 + Math.sin(a) * 24;
        const x2 = 50 + Math.cos(a) * 40;
        const y2 = 50 + Math.sin(a) * 40;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={i % 2 === 0 ? 2.4 : 1.4}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="50" cy="50" r="22" fill="var(--v-paper)" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="18" fill="none" strokeWidth="1" opacity=".5" />
    </g>
  );
}
