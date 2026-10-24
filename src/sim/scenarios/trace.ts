import type { HoseLine } from '../types';
import type { TraceSample } from './run';

/** Fixed-decimal formatting that never prints '-0.0'. */
function fmt(x: number, dp: number): string {
  const s = x.toFixed(dp);
  return Number(s) === 0 ? (0).toFixed(dp) : s;
}

/**
 * CSV of a scripted run. Columns come from the spec's delivery ids and the line ids, so another
 * appliance gets its own columns with no code change (docs/TESTING.md §2, layer 3).
 */
export function traceCsv(samples: readonly TraceSample[], lines: readonly HoseLine[]): string {
  const first = samples[0];
  if (first === undefined) return '';
  const deliveryIds = first.truck.spec.deliveries.map((d) => d.id);
  const lineIds = lines.filter((l) => l.truckId === first.truck.id).map((l) => l.id);
  const header = [
    'timeS',
    'throttle',
    'rpm',
    'dischargeKpa',
    'compoundKpa',
    'tankL',
    'reliefLpm',
    ...deliveryIds.map((id) => `flowLpm.${id}`),
    ...lineIds.map((id) => `branchKpa.${id}`),
  ];
  const rows = samples.map(({ tS, inputs, truck }) => {
    const r = truck.readings;
    return [
      fmt(tS, 0),
      fmt(inputs.throttle, 2),
      fmt(truck.rpm, 0),
      fmt(r.dischargeKpa, 1),
      fmt(r.compoundKpa, 1),
      fmt(truck.tankL, 1),
      fmt(r.reliefFlowLpm, 1),
      ...deliveryIds.map((id) => fmt(r.deliveryFlowLpm[id] ?? 0, 1)),
      ...lineIds.map((id) => fmt(r.branchKpa[id] ?? 0, 1)),
    ];
  });
  return [header, ...rows].map((row) => row.join(',')).join('\n') + '\n';
}
