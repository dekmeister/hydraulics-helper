// Pump inlet side (ARCHITECTURE §4.3): every open inlet path is a source head behind a resistance,
// and the paths combine in parallel at the pump inlet.
import {
  HEAD_KPA_PER_M,
  LAYFLAT_COLLAPSE_KPA,
  SOLVER_ITERATIONS,
  STRAINER_LOSS_KPA_PER_LPM2,
  VALVE_CLOSED_EPS,
} from './constants';
import { hoseResistance, isRigid } from './hose';
import type { ApplianceSpec, ControlId, PlayerInputs, SupplyLine, WaterSource } from './types';

/** A supply line with the source at its far end. */
export interface ConnectedSupply {
  supply: SupplyLine;
  source: WaterSource;
}

/**
 * One inlet path able to supply water now: inlet pressure P draws Q = √((head − P)/r). Below
 * `collapseKpa` a soft supply hose flattens, so pulling the inlet lower draws no more from it.
 */
export interface InletPath {
  inletId: ControlId;
  headKpa: number;
  r: number;
  collapseKpa: number;
}

/**
 * What a closed relay offers a receiving suction inlet: the supplying pump as an equivalent source
 * plus the hose, so the inlet sees `headKpa − r·Q²` (the receiving inlet valve is added on top).
 */
export interface RelayFeed {
  inletId: ControlId;
  headKpa: number;
  r: number;
  /** Hard hose holds a vacuum; layflat flattens below `LAYFLAT_COLLAPSE_KPA`. */
  rigid: boolean;
}

export interface InletContext {
  spec: ApplianceSpec;
  tankL: number;
  inputs: PlayerInputs;
  /** Whether a draught path is primed (its suction hose full of water). */
  primed: boolean;
  /** Supplies connected to this truck's inlets. */
  supplies: readonly ConnectedSupply[];
  /** Closed relays feeding this truck's suction inlets. */
  relays?: readonly RelayFeed[];
}

/** The supply on an inlet, if anything is connected. */
export function supplyOn(
  supplies: readonly ConnectedSupply[],
  inletId: ControlId,
): ConnectedSupply | undefined {
  return supplies.find((s) => s.supply.inletId === inletId);
}

/**
 * Open inlet paths that can deliver water now. Tank: head 0 while there's water. Hydrant:
 * static − (main + hose + valve)·Q². Static source: −10·lift − (hose + strainer + valve)·Q², and
 * only once primed with water left. Closed relay: the supplying pump's equivalent head less
 * (pump + hose + valve)·Q². An external inlet with nothing connected is capped.
 */
export function inletPaths(ctx: InletContext): InletPath[] {
  const { spec, tankL, inputs, primed, supplies, relays = [] } = ctx;
  return spec.inlets.flatMap((inlet): InletPath[] => {
    const open = inputs.valves[inlet.id] ?? 0;
    if (open < VALVE_CLOSED_EPS) return [];
    const valveR = inlet.lossKpaPerLpm2 / (open * open);
    if (inlet.kind === 'tank') {
      return tankL > 0
        ? [{ inletId: inlet.id, headKpa: 0, r: valveR, collapseKpa: Number.NEGATIVE_INFINITY }]
        : [];
    }
    const connected = supplyOn(supplies, inlet.id);
    if (connected === undefined) {
      const feed = relays.find((f) => f.inletId === inlet.id);
      if (feed === undefined) return [];
      return [
        {
          inletId: inlet.id,
          headKpa: feed.headKpa,
          r: feed.r + valveR,
          collapseKpa: feed.rigid ? Number.NEGATIVE_INFINITY : LAYFLAT_COLLAPSE_KPA,
        },
      ];
    }
    const { supply, source } = connected;
    const collapseKpa = isRigid(supply.segments) ? Number.NEGATIVE_INFINITY : LAYFLAT_COLLAPSE_KPA;
    const hoseR = hoseResistance(supply.segments);
    switch (source.kind) {
      case 'hydrant':
        return [
          {
            inletId: inlet.id,
            headKpa: source.staticKpa,
            r: source.mainLossKpaPerLpm2 + hoseR + valveR,
            collapseKpa,
          },
        ];
      case 'static':
        if (!primed || source.volumeL <= 0) return [];
        return [
          {
            inletId: inlet.id,
            headKpa: -HEAD_KPA_PER_M * source.liftM,
            r: hoseR + STRAINER_LOSS_KPA_PER_LPM2 + valveR,
            collapseKpa,
          },
        ];
    }
  });
}

/** Flow one path gives at inlet pressure `pKpa`, L/min. */
export function pathFlowLpm(path: InletPath, pKpa: number): number {
  return Math.sqrt(Math.max(0, path.headKpa - Math.max(pKpa, path.collapseKpa)) / path.r);
}

/** Total flow every path gives at inlet pressure `pKpa`; never rises as `pKpa` rises. */
export function supplyLpm(paths: readonly InletPath[], pKpa: number): number {
  return paths.reduce((q, p) => q + pathFlowLpm(p, pKpa), 0);
}

/**
 * Highest inlet pressure at which the paths still give `flowLpm`, searched down to `floorKpa`
 * (bisection: supply falls as inlet pressure rises). Callers keep `flowLpm` within what the paths
 * give at the floor. With no flow it is the highest source head, which is what the gauge shows.
 */
export function inletKpaFor(
  paths: readonly InletPath[],
  flowLpm: number,
  floorKpa: number,
): number {
  let hi = Math.max(...paths.map((p) => p.headKpa));
  let lo = Math.min(hi, floorKpa);
  if (flowLpm <= 0) return hi;
  for (let i = 0; i < SOLVER_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (supplyLpm(paths, mid) >= flowLpm) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The same paths with no floor and no hose collapse: where the inlet would go if water could be
 * pulled without limit. Used to measure how far past the cavitation limit the pump is pushed.
 */
export function unlimited(paths: readonly InletPath[]): InletPath[] {
  return paths.map((p) => ({ ...p, collapseKpa: Number.NEGATIVE_INFINITY }));
}

/** Inlet pressure at which unlimited paths give `flowLpm` (closed form for the lowest bound). */
export function unlimitedInletKpaFor(paths: readonly InletPath[], flowLpm: number): number {
  // Each path alone would give `flowLpm` at head − r·Q²; together they give it no lower than that.
  const floor = Math.min(...paths.map((p) => p.headKpa - p.r * flowLpm * flowLpm));
  return inletKpaFor(unlimited(paths), flowLpm, floor);
}
