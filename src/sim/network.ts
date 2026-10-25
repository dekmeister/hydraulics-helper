import { branchK, branchPressureKpa } from './branch';
import {
  CAVITATION_FULL_EXCESS,
  CAVITATION_STIFFNESS,
  COLLAPSE_TOLERANCE_KPA,
  HEAD_KPA_PER_M,
  SOLVER_ITERATIONS,
  VALVE_CLOSED_EPS,
  VALVE_LOSS_REF_KPA_PER_LPM2,
  VALVE_LOSS_REF_MM,
} from './constants';
import { hoseResistance } from './hose';
import {
  inletKpaFor,
  inletPaths,
  pathFlowLpm,
  supplyLpm,
  unlimitedInletKpaFor,
  type ConnectedSupply,
  type RelayFeed,
} from './inlets';
import { pumpRiseKpa } from './pump';
import { tankFillFlows } from './tankFill';
import type {
  ApplianceSpec,
  ControlId,
  DeliverySpec,
  HoseLine,
  PlayerInputs,
  TruckReadings,
} from './types';

/** Loss coefficient of a delivery valve fully open, kPa per (L/min)²: scales as 1/d⁴ (velocity²). */
export function valveLossCoeff(sizeMm: number): number {
  return VALVE_LOSS_REF_KPA_PER_LPM2 * (VALVE_LOSS_REF_MM / sizeMm) ** 4;
}

/**
 * Total resistance of a line from pump to nozzle, so that P_discharge − head = R·Q²:
 * valve (k/open²) + hose friction + branch orifice (1/k_b²).
 */
export function lineResistance(line: HoseLine, delivery: DeliverySpec, open: number): number {
  const kb = branchK(line.branch);
  return (
    valveLossCoeff(delivery.sizeMm) / (open * open) + hoseResistance(line.segments) + 1 / (kb * kb)
  );
}

/** Flow through an outlet at discharge pressure `pKpa`, from P − head = R·Q². */
function outletFlowLpm(pKpa: number, resistance: number, headKpa: number): number {
  return Math.sqrt(Math.max(0, pKpa - headKpa) / resistance);
}

/**
 * A relay hose leaving one of this truck's deliveries. 'fixed': a closed relay, which takes what
 * the receiving pump draws (solved first). 'open': an open relay or a burst hose, flowing to
 * atmosphere through `r` (valve and hose) against `headKpa` of elevation.
 */
export type RelayOutlet =
  | { deliveryId: ControlId; kind: 'fixed'; flowLpm: number }
  | { deliveryId: ControlId; kind: 'open'; r: number; headKpa: number };

/** Relief valve set pressure for the current inputs, or undefined if none fitted. */
function reliefSetKpa(spec: ApplianceSpec, inputs: PlayerInputs): number | undefined {
  const relief = spec.relief;
  if (relief === undefined) return undefined;
  switch (relief.kind) {
    case 'preset':
      return relief.setKpa;
    case 'adjustable':
      return relief.minKpa + (inputs.valves[relief.id] ?? 0) * (relief.maxKpa - relief.minKpa);
  }
}

/** Readings of a pump with no water: nothing flows and the discharge gauge reads zero (Table 6). */
export function dryReadings(
  spec: ApplianceSpec,
  lines: readonly HoseLine[],
  compoundKpa = 0,
): TruckReadings {
  return {
    dischargeKpa: 0,
    compoundKpa,
    pumpFlowLpm: 0,
    reliefFlowLpm: 0,
    pumpToTankLpm: 0,
    deliveryFlowLpm: Object.fromEntries(spec.deliveries.map((d) => [d.id, 0])),
    branchKpa: Object.fromEntries(lines.map((l) => [l.id, 0])),
    inletFlowLpm: Object.fromEntries(spec.inlets.map((i) => [i.id, 0])),
    inletCollapsed: Object.fromEntries(spec.inlets.map((i) => [i.id, false])),
    cavitation: 0,
  };
}

export interface TruckSolveInput {
  spec: ApplianceSpec;
  rpm: number;
  tankL: number;
  /** Sanitised inputs (every spec control present, 0–1). */
  inputs: PlayerInputs;
  /** Whether a draught path is primed; default false. */
  primed?: boolean;
  /** Supplies connected to this truck's inlets; default none. */
  supplies?: readonly ConnectedSupply[];
  /** Primer vacuum on the casing, kPa: what the compound gauge shows while the pump is dry. */
  vacuumKpa?: number;
  /** Closed relays feeding this truck's suction inlets. */
  relayIn?: readonly RelayFeed[];
  /** Relay hoses leaving this truck's deliveries. */
  relayOut?: readonly RelayOutlet[];
}

/** Root of a decreasing function on [lo, hi] by fixed-count bisection (deterministic). */
function bisectDecreasing(g: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < SOLVER_ITERATIONS; i++) {
    const mid = (a + b) / 2;
    if (g(mid) > 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/**
 * Steady-state solve for one truck: find the discharge pressure where inlet pressure plus pump
 * rise meets the total demand of the open lines plus relief. Demand rises with pressure; the inlet
 * and the pump curve both fall with flow, so bisection on discharge pressure converges. The inlet
 * can't be pulled below the pump's cavitation pressure: there the flow the pump can draw is capped,
 * extra rpm adds nothing, and `cavitation` says how far past that limit the pump is pushed.
 * Relays: feeds join the inlet paths; outlets join the lines (open) or add a fixed flow (closed).
 * `lines` must be this truck's lines, one per delivery.
 */
export function solveTruck(truck: TruckSolveInput, lines: readonly HoseLine[]): TruckReadings {
  const readings = solvePump(truck, lines);
  // Tank-fill inlets run whether or not the pump has water.
  const fill = tankFillFlows(truck.spec, truck.inputs, truck.supplies ?? []);
  return { ...readings, inletFlowLpm: { ...readings.inletFlowLpm, ...fill } };
}

function solvePump(truck: TruckSolveInput, lines: readonly HoseLine[]): TruckReadings {
  const { spec, rpm, tankL, inputs } = truck;
  const paths = inletPaths({
    spec,
    tankL,
    inputs,
    primed: truck.primed ?? false,
    supplies: truck.supplies ?? [],
    relays: truck.relayIn ?? [],
  });
  if (paths.length === 0) return dryReadings(spec, lines, 0 - (truck.vacuumKpa ?? 0));
  const floorKpa = spec.pump.cavitationInletKpa;
  const capLpm = supplyLpm(paths, floorKpa);

  // Lines and open relays: flow rises with discharge pressure. Closed relays take a fixed flow.
  const open = [
    ...lines.flatMap((line) => {
      const delivery = spec.deliveries.find((d) => d.id === line.deliveryId);
      const valve = inputs.valves[line.deliveryId] ?? 0;
      if (delivery === undefined || valve < VALVE_CLOSED_EPS) return [];
      const r = lineResistance(line, delivery, valve);
      return [{ deliveryId: line.deliveryId, line, r, headKpa: HEAD_KPA_PER_M * line.elevationM }];
    }),
    ...(truck.relayOut ?? []).flatMap((o) =>
      o.kind === 'open' ? [{ ...o, line: undefined }] : [],
    ),
  ];
  const fixed = (truck.relayOut ?? []).flatMap((o) => (o.kind === 'fixed' ? [o] : []));
  const fixedLpm = fixed.reduce((q, o) => q + o.flowLpm, 0);
  const setKpa = reliefSetKpa(spec, inputs);
  const relief = spec.relief;
  const ptt = spec.pumpToTank;
  const pttOpen = ptt === undefined ? 0 : (inputs.valves[ptt.id] ?? 0);
  // Pump to tank discharges at atmospheric pressure: P = (k/open²)·Q².
  const pttR =
    ptt === undefined || pttOpen < VALVE_CLOSED_EPS ? 0 : ptt.lossKpaPerLpm2 / pttOpen ** 2;

  const demand = (pKpa: number) => {
    const flows = open.map(({ r, headKpa }) => outletFlowLpm(pKpa, r, headKpa));
    const outLpm = flows.reduce((a, b) => a + b, fixedLpm);
    const reliefLpm =
      relief === undefined || setKpa === undefined
        ? 0
        : relief.slopeLpmPerKpa * Math.max(0, pKpa - setKpa);
    const pttLpm = pttR > 0 ? outletFlowLpm(pKpa, pttR, 0) : 0;
    // Relief dumped to the tank is drawn back in through the inlets; dumped to the inlet it isn't.
    // Pump to tank always goes round through the tank.
    const inletLpm = outLpm + pttLpm + (relief?.dumpTo === 'tank' ? reliefLpm : 0);
    return { flows, outLpm, reliefLpm, pttLpm, inletLpm, pumpLpm: outLpm + pttLpm + reliefLpm };
  };
  const rise = (q: number) => pumpRiseKpa(spec.pump, spec.engine, rpm, q);
  // Past the cap the inlet pressure plunges, which pins the root at the capped flow.
  const inletAt = (q: number) =>
    q <= capLpm ? inletKpaFor(paths, q, floorKpa) : floorKpa - CAVITATION_STIFFNESS * (q - capLpm);

  const maxHead = Math.max(0, ...paths.map((p) => p.headKpa));
  const hi = maxHead + Math.max(0, rise(0));
  let pKpa = bisectDecreasing(
    (p) => {
      const d = demand(p);
      return inletAt(d.inletLpm) + rise(d.pumpLpm) - p;
    },
    0,
    hi,
  );
  let d = demand(pKpa);
  if (d.inletLpm > capLpm) {
    // At the cap: the discharge is whatever the open lines take at the flow the inlet allows.
    pKpa = bisectDecreasing((p) => capLpm - demand(p).inletLpm, 0, pKpa);
    d = demand(pKpa);
  }
  const inletLpm = Math.min(d.inletLpm, capLpm);
  const inletKpa = inletKpaFor(paths, inletLpm, floorKpa);

  let cavitation = 0;
  if (d.inletLpm >= capLpm - 1e-6) {
    // How much the pump would draw if the inlet could be pulled without limit.
    const free = demand(
      bisectDecreasing(
        (p) => {
          const x = demand(p);
          return unlimitedInletKpaFor(paths, x.inletLpm) + rise(x.pumpLpm) - p;
        },
        0,
        hi,
      ),
    ).inletLpm;
    const excess = capLpm > 0 ? (free / capLpm - 1) / CAVITATION_FULL_EXCESS : free > 0 ? 1 : 0;
    cavitation = Math.min(1, Math.max(0, excess));
  }

  const deliveryFlowLpm: Record<string, number> = Object.fromEntries(
    spec.deliveries.map((x) => [x.id, 0]),
  );
  const branchKpa: Record<string, number> = Object.fromEntries(lines.map((l) => [l.id, 0]));
  open.forEach(({ deliveryId, line }, i) => {
    const q = d.flows[i] ?? 0;
    deliveryFlowLpm[deliveryId] = (deliveryFlowLpm[deliveryId] ?? 0) + q;
    if (line !== undefined) branchKpa[line.id] = branchPressureKpa(line.branch, q);
  });
  for (const o of fixed)
    deliveryFlowLpm[o.deliveryId] = (deliveryFlowLpm[o.deliveryId] ?? 0) + o.flowLpm;
  const inletFlowLpm: Record<string, number> = Object.fromEntries(
    spec.inlets.map((i) => [i.id, 0]),
  );
  const inletCollapsed: Record<string, boolean> = Object.fromEntries(
    spec.inlets.map((i) => [i.id, false]),
  );
  for (const path of paths) {
    inletFlowLpm[path.inletId] = (inletFlowLpm[path.inletId] ?? 0) + pathFlowLpm(path, inletKpa);
    // Pulled down to its collapse pressure, a layflat supply has gone soft.
    if (inletKpa <= path.collapseKpa + COLLAPSE_TOLERANCE_KPA) inletCollapsed[path.inletId] = true;
  }
  return {
    dischargeKpa: pKpa,
    compoundKpa: inletKpa,
    pumpFlowLpm: d.pumpLpm,
    reliefFlowLpm: d.reliefLpm,
    pumpToTankLpm: d.pttLpm,
    deliveryFlowLpm,
    branchKpa,
    inletFlowLpm,
    inletCollapsed,
    cavitation,
  };
}
