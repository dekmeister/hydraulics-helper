import { branchK, branchPressureKpa } from './branch';
import {
  HEAD_KPA_PER_M,
  SOLVER_ITERATIONS,
  VALVE_CLOSED_EPS,
  VALVE_LOSS_REF_KPA_PER_LPM2,
  VALVE_LOSS_REF_MM,
} from './constants';
import { hoseResistance } from './hose';
import { pumpRiseKpa } from './pump';
import type {
  ApplianceSpec,
  DeliverySpec,
  HoseLine,
  InletSpec,
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

/** Flow through a line at discharge pressure `pKpa`, from P − head = R·Q². */
function lineFlowLpm(pKpa: number, resistance: number, elevationM: number): number {
  return Math.sqrt(Math.max(0, pKpa - HEAD_KPA_PER_M * elevationM) / resistance);
}

/**
 * Conductance of one inlet path in Q = c·√ΔP, or 0 if it can't supply water now.
 * Only the tank is connected in M1; hydrant, draught and relay sources arrive in M4–M5.
 */
function inletConductance(inlet: InletSpec, open: number, tankL: number): number {
  if (open < VALVE_CLOSED_EPS) return 0;
  switch (inlet.kind) {
    case 'tank':
      return tankL > 0 ? open / Math.sqrt(inlet.lossKpaPerLpm2) : 0;
    case 'hydrant':
    case 'draught':
    case 'relay':
      return 0;
  }
}

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

/** Readings of a pump with no water: everything reads zero (manual Table 6, L3529). */
export function dryReadings(spec: ApplianceSpec, lines: readonly HoseLine[]): TruckReadings {
  return {
    dischargeKpa: 0,
    compoundKpa: 0,
    pumpFlowLpm: 0,
    reliefFlowLpm: 0,
    deliveryFlowLpm: Object.fromEntries(spec.deliveries.map((d) => [d.id, 0])),
    branchKpa: Object.fromEntries(lines.map((l) => [l.id, 0])),
  };
}

export interface TruckSolveInput {
  spec: ApplianceSpec;
  rpm: number;
  tankL: number;
  /** Sanitised inputs (every spec control present, 0–1). */
  inputs: PlayerInputs;
}

/**
 * Steady-state solve for one truck: find the discharge pressure where the pump curve (less inlet
 * loss) meets the total demand of the open lines plus relief. Demand rises with pressure and supply
 * falls with flow, so bisection on discharge pressure converges monotonically. `lines` must be this
 * truck's lines, one per delivery.
 */
export function solveTruck(truck: TruckSolveInput, lines: readonly HoseLine[]): TruckReadings {
  const { spec, rpm, tankL, inputs } = truck;
  const inletC = spec.inlets.reduce(
    (c, inlet) => c + inletConductance(inlet, inputs.valves[inlet.id] ?? 0, tankL),
    0,
  );
  if (inletC === 0) return dryReadings(spec, lines);
  const inletR = 1 / (inletC * inletC);

  const open = lines.flatMap((line) => {
    const delivery = spec.deliveries.find((d) => d.id === line.deliveryId);
    const valve = inputs.valves[line.deliveryId] ?? 0;
    if (delivery === undefined || valve < VALVE_CLOSED_EPS) return [];
    return [{ line, r: lineResistance(line, delivery, valve) }];
  });
  const setKpa = reliefSetKpa(spec, inputs);
  const relief = spec.relief;

  const demand = (pKpa: number) => {
    const flows = open.map(({ line, r }) => lineFlowLpm(pKpa, r, line.elevationM));
    const outLpm = flows.reduce((a, b) => a + b, 0);
    const reliefLpm =
      relief === undefined || setKpa === undefined
        ? 0
        : relief.slopeLpmPerKpa * Math.max(0, pKpa - setKpa);
    // Relief dumped to the tank is drawn back through the tank inlet; dumped to the inlet it isn't.
    const inletLpm = outLpm + (relief?.dumpTo === 'tank' ? reliefLpm : 0);
    return { flows, outLpm, reliefLpm, inletLpm, pumpLpm: outLpm + reliefLpm };
  };
  const supplyKpa = (d: ReturnType<typeof demand>) =>
    -inletR * d.inletLpm * d.inletLpm + pumpRiseKpa(spec.pump, spec.engine, rpm, d.pumpLpm);

  // g(P) = supply(demand(P)) − P is decreasing in P; find its root on [0, shutoff at this rpm].
  let lo = 0;
  let hi = Math.max(0, pumpRiseKpa(spec.pump, spec.engine, rpm, 0));
  for (let i = 0; i < SOLVER_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (supplyKpa(demand(mid)) > mid) lo = mid;
    else hi = mid;
  }
  const pKpa = (lo + hi) / 2;
  const d = demand(pKpa);

  const deliveryFlowLpm: Record<string, number> = Object.fromEntries(
    spec.deliveries.map((x) => [x.id, 0]),
  );
  const branchKpa: Record<string, number> = Object.fromEntries(lines.map((l) => [l.id, 0]));
  open.forEach(({ line }, i) => {
    const q = d.flows[i] ?? 0;
    deliveryFlowLpm[line.deliveryId] = (deliveryFlowLpm[line.deliveryId] ?? 0) + q;
    branchKpa[line.id] = branchPressureKpa(line.branch, q);
  });
  return {
    dischargeKpa: pKpa,
    compoundKpa: -inletR * d.inletLpm * d.inletLpm,
    pumpFlowLpm: d.pumpLpm,
    reliefFlowLpm: d.reliefLpm,
    deliveryFlowLpm,
    branchKpa,
  };
}
