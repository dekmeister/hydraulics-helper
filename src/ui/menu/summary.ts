import type { ApplianceSpec, PrimerSpec } from '../../sim/types';

const PRIMER_WORDS: Readonly<Record<PrimerSpec['kind'], string>> = {
  rotaryVane: 'electric primer',
  diaphragm: 'hand primer',
  selfPriming: 'self-priming',
};

/** A truck's fitout in one line, from its spec: '3 deliveries (65, 38, 38 mm) · 3000 L tank · …'. */
export function applianceSummary(spec: ApplianceSpec): string {
  const n = spec.deliveries.length;
  const sizes = spec.deliveries.map((d) => String(d.sizeMm)).join(', ');
  const parts = [`${String(n)} ${n === 1 ? 'delivery' : 'deliveries'} (${sizes} mm)`];
  if (spec.tank !== undefined) parts.push(`${String(spec.tank.capacityL)} L tank`);
  parts.push(spec.primer === undefined ? 'no primer' : PRIMER_WORDS[spec.primer.kind]);
  parts.push(spec.instruments.some((i) => i.kind === 'tacho') ? 'tacho' : 'no tacho');
  return parts.join(' · ');
}
