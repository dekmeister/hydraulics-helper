import { hoseType } from '../../sim/hose';
import type { HoseLine, HoseSegment, RelayLink } from '../../sim/types';
import { formatWhole } from '../format';

/** Hose in runs of the same hose, e.g. "3 × 30 m 38 mm lined + 1 × 30 m 65 mm lined". */
function describeHose(segments: readonly HoseSegment[]): string {
  const runs: { hose: string; lengthM: number; count: number }[] = [];
  for (const s of segments) {
    const last = runs.at(-1);
    if (last?.hose === s.hose && last.lengthM === s.lengthM) last.count++;
    else runs.push({ hose: s.hose, lengthM: s.lengthM, count: 1 });
  }
  return runs
    .map((r) => {
      const t = hoseType(r.hose);
      return `${String(r.count)} × ${formatWhole(r.lengthM)} m ${String(t.sizeMm)} mm ${t.lined ? 'lined' : 'unlined'}`;
    })
    .join(' + ');
}

function describeClimb(elevationM: number): string[] {
  if (elevationM === 0) return [];
  return [`${formatWhole(Math.abs(elevationM))} m ${elevationM > 0 ? 'uphill' : 'downhill'}`];
}

/**
 * Short description of a hose lay for its delivery row, e.g.
 * "3 × 30 m 38 mm lined · 15 mm branch · 14 m uphill" (or "25 mm monitor"). Runs of the same hose are grouped.
 */
export function describeLine(line: HoseLine): string {
  return [
    describeHose(line.segments),
    `${String(line.branch.tipMm)} mm ${line.branch.kind === 'monitor' ? 'monitor' : 'branch'}`,
    ...describeClimb(line.elevationM),
  ].join(' · ');
}

/**
 * Short description of a relay hose for its delivery row, e.g.
 * "Relay · 4 × 30 m 65 mm lined · to Attack pump · 20 m uphill", and which length burst, if one has.
 */
export function describeRelay(link: RelayLink, toLabel: string): string {
  return [
    'Relay',
    describeHose(link.segments),
    `to ${toLabel}`,
    ...(link.burst === undefined
      ? describeClimb(link.elevationM)
      : [`length ${String(link.burst.segment + 1)} burst`]),
  ].join(' · ');
}
