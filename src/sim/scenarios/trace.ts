import type { HoseLine, SimState, TruckState } from '../types';
import type { TraceSample } from './run';

/** Fixed-decimal formatting that never prints '-0.0'. */
function fmt(x: number, dp: number): string {
  const s = x.toFixed(dp);
  return Number(s) === 0 ? (0).toFixed(dp) : s;
}

interface Columns<T> {
  header: string[];
  row: (sample: T) => string[];
}

/** A truck's columns (ids from its spec and its lines), each header prefixed by `prefix`. */
function truckColumns(
  truck: TruckState,
  lines: readonly HoseLine[],
  prefix: string,
): Columns<TruckState> {
  const deliveryIds = truck.spec.deliveries.map((d) => d.id);
  const inletIds = truck.spec.inlets.map((i) => i.id);
  const lineIds = lines.filter((l) => l.truckId === truck.id).map((l) => l.id);
  return {
    header: [
      'rpm',
      'dischargeKpa',
      'compoundKpa',
      'tankL',
      'reliefLpm',
      ...deliveryIds.map((id) => `flowLpm.${id}`),
      ...lineIds.map((id) => `branchKpa.${id}`),
      ...inletIds.map((id) => `inletLpm.${id}`),
      'primed',
      'vacuumKpa',
      'cavitation',
      'pumpTempC',
    ].map((h) => prefix + h),
    row: (t) => {
      const r = t.readings;
      return [
        fmt(t.rpm, 0),
        fmt(r.dischargeKpa, 1),
        fmt(r.compoundKpa, 1),
        fmt(t.tankL, 1),
        fmt(r.reliefFlowLpm, 1),
        ...deliveryIds.map((id) => fmt(r.deliveryFlowLpm[id] ?? 0, 1)),
        ...lineIds.map((id) => fmt(r.branchKpa[id] ?? 0, 1)),
        ...inletIds.map((id) => fmt(r.inletFlowLpm[id] ?? 0, 1)),
        t.pump.primed ? '1' : '0',
        fmt(t.pump.vacuumKpa, 1),
        fmt(r.cavitation, 2),
        fmt(t.pump.tempC, 1),
      ];
    },
  };
}

/** Relay and portable-dam columns of a multi-truck state. */
function siteColumns(first: SimState): Columns<SimState> {
  const linkIds = first.links.map((l) => l.id);
  const damIds = first.sources.flatMap((s) =>
    s.kind === 'static' && s.capacityL !== undefined ? [s.id] : [],
  );
  return {
    header: [
      ...linkIds.flatMap((id) =>
        ['flowLpm', 'startKpa', 'endKpa', 'burst'].map((c) => `relay.${id}.${c}`),
      ),
      ...damIds.map((id) => `source.${id}.volumeL`),
    ],
    row: (s) => [
      ...linkIds.flatMap((id) => {
        const r = s.linkReadings[id];
        const burst = s.links.find((l) => l.id === id)?.burst !== undefined;
        return [
          fmt(r?.flowLpm ?? 0, 1),
          fmt(r?.startKpa ?? 0, 1),
          fmt(r?.endKpa ?? 0, 1),
          burst ? '1' : '0',
        ];
      }),
      ...damIds.map((id) => {
        const source = s.sources.find((x) => x.id === id);
        return fmt(source?.kind === 'static' ? source.volumeL : 0, 1);
      }),
    ],
  };
}

/**
 * CSV of a scripted run. Columns come from the spec's delivery ids and the line ids, so another
 * appliance gets its own columns with no code change (docs/TESTING.md §2, layer 3). A run with
 * several trucks or any relay prefixes each truck's columns with its id and adds relay and
 * portable-dam columns; the throttle column is the scripted (active) truck's.
 */
export function traceCsv(samples: readonly TraceSample[], lines: readonly HoseLine[]): string {
  const first = samples[0];
  if (first === undefined) return '';
  const multi = first.state.trucks.length > 1 || first.state.links.length > 0;
  const trucks = multi ? first.state.trucks : [first.truck];
  const perTruck = trucks.map((t) => ({
    id: t.id,
    cols: truckColumns(t, lines, multi ? `${t.id}.` : ''),
  }));
  const site = multi ? siteColumns(first.state) : { header: [], row: () => [] };
  const header = ['timeS', 'throttle', ...perTruck.flatMap((t) => t.cols.header), ...site.header];
  const rows = samples.map(({ tS, inputs, truck, state }) => [
    fmt(tS, 0),
    fmt(inputs.throttle, 2),
    ...perTruck.flatMap(({ id, cols }) => {
      const t = multi ? state.trucks.find((x) => x.id === id) : truck;
      if (t === undefined) throw new Error(`No truck '${id}' in the trace`);
      return cols.row(t);
    }),
    ...site.row(state),
  ]);
  return [header, ...rows].map((row) => row.join(',')).join('\n') + '\n';
}
