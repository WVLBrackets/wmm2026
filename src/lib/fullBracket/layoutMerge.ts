import type { FinalsLayoutSettings, LayoutSettings } from '@/lib/fullBracket/fullBracketGeometry';

/**
 * Deep-merge a partial layout (e.g. committed JSON or admin PUT body) onto a full baseline.
 */
export function mergeLayoutSettings(base: LayoutSettings, patch: unknown): LayoutSettings {
  if (!patch || typeof patch !== 'object') return base;
  const p = patch as Partial<LayoutSettings>;
  const rawFinals = p.finals as Partial<FinalsLayoutSettings> | undefined;
  const mergedFinals = { ...base.finals, ...rawFinals };
  if (
    rawFinals &&
    !('finalsClusterOffsetYPx' in rawFinals) &&
    typeof rawFinals.finalistOffsetYPx === 'number'
  ) {
    mergedFinals.finalsClusterOffsetYPx = rawFinals.finalistOffsetYPx;
  }
  return {
    rounds: {
      r64: { ...base.rounds.r64, ...p.rounds?.r64 },
      r32: { ...base.rounds.r32, ...p.rounds?.r32 },
      s16: { ...base.rounds.s16, ...p.rounds?.s16 },
      e8: { ...base.rounds.e8, ...p.rounds?.e8 },
      r5: { ...base.rounds.r5, ...p.rounds?.r5 },
    },
    finals: mergedFinals,
    regionLabels: { ...base.regionLabels, ...p.regionLabels },
    quadGrid: { ...base.quadGrid, ...p.quadGrid },
  };
}
