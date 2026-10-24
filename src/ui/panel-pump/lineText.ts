import { hoseType } from '../../sim/hose';
import type { HoseLine } from '../../sim/types';
import { formatWhole } from '../format';

/**
 * Short description of a hose lay for its delivery row, e.g.
 * "3 × 30 m 38 mm lined · 15 mm branch · 14 m uphill". Runs of the same hose are grouped.
 */
export function describeLine(line: HoseLine): string {
  const runs: { hose: string; lengthM: number; count: number }[] = [];
  for (const s of line.segments) {
    const last = runs.at(-1);
    if (last?.hose === s.hose && last.lengthM === s.lengthM) last.count++;
    else runs.push({ hose: s.hose, lengthM: s.lengthM, count: 1 });
  }
  const hose = runs.map((r) => {
    const t = hoseType(r.hose);
    return `${String(r.count)} × ${formatWhole(r.lengthM)} m ${String(t.sizeMm)} mm ${t.lined ? 'lined' : 'unlined'}`;
  });
  const parts = [hose.join(' + '), `${String(line.branch.tipMm)} mm branch`];
  if (line.elevationM !== 0) {
    parts.push(
      `${formatWhole(Math.abs(line.elevationM))} m ${line.elevationM > 0 ? 'uphill' : 'downhill'}`,
    );
  }
  return parts.join(' · ');
}
