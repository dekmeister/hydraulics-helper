// What the water is doing in each part of a truck's plumbing, for the realistic bay's pipework.
// Pure functions of sim state; no React. Nothing here adds hydraulics: it reads the sim's flows,
// the casing latch (`PumpState.casingWet`) and what is connected to each inlet.
import { VALVE_CLOSED_EPS } from '../sim/constants';
import { CREW_WATER_MIN_LPM } from '../sim/lesson/progress';
import type { ControlId, SimState, TruckState } from '../sim/types';

/** Flow at or above which a pipe or hose is drawn flowing, L/min: the scene's charged-line threshold. */
export const FLOWING_MIN_LPM = CREW_WATER_MIN_LPM;

export type WaterState = 'flowing' | 'still' | 'empty';

/**
 * A stretch of pipe, named by where it is in the truck's plumbing. Valves split pipes, so each
 * side of a valve is its own stretch.
 * - `tank`: from the tank to the tank inlet's valve.
 * - `inlet`: an inlet's `source` side (coupling or tank, up to its valve) or `pump` side (from the
 *   valve on; for a tankFill inlet, on into the tank).
 * - `casing`: the pump casing, its eye and the discharge side up to the outlet valves. `feeds`
 *   names the outlets (deliveries, pump to tank) drawing through a run of manifold, so it flows
 *   only toward an outlet that is open; omitted, it carries all of the pump's flow.
 * - `delivery`: from a delivery's valve to its coupling.
 * - `pumpToTank`: the return from its valve on into the tank.
 * - `recirc`: the recirculation bleed from the discharge into the tank (`ApplianceSpec.recirc`).
 */
export type WaterRef =
  | { at: 'tank' }
  | { at: 'inlet'; id: ControlId; side: 'source' | 'pump' }
  | { at: 'casing'; feeds?: readonly ControlId[] }
  | { at: 'delivery'; id: ControlId }
  | { at: 'pumpToTank' }
  | { at: 'recirc' };

/** A stable key for a stretch, e.g. 'inlet:suction:source', for tests and the DOM. */
export function waterRefKey(ref: WaterRef): string {
  switch (ref.at) {
    case 'tank':
    case 'pumpToTank':
    case 'recirc':
      return ref.at;
    case 'casing':
      return ref.feeds === undefined ? 'casing' : `casing:${ref.feeds.join('+')}`;
    case 'inlet':
      return `inlet:${ref.id}:${ref.side}`;
    case 'delivery':
      return `delivery:${ref.id}`;
  }
}

const flowing = (lpm: number | undefined) => (lpm ?? 0) >= FLOWING_MIN_LPM;

/** Still water if `full`, otherwise none; flowing wins over both. */
function state(isFlowing: boolean, full: boolean): WaterState {
  if (isFlowing) return 'flowing';
  return full ? 'still' : 'empty';
}

/**
 * Whether water stands at an external inlet's coupling: a hydrant's main, a closed relay with
 * pressure on it, or a draught whose suction hose the primer has filled.
 */
function supplyHolds(sim: SimState, truck: TruckState, inletId: ControlId): boolean {
  const relayed = sim.links.some(
    (l) =>
      l.burst === undefined &&
      l.to.kind === 'inlet' &&
      l.to.truckId === truck.id &&
      l.to.inletId === inletId &&
      (sim.linkReadings[l.id]?.endKpa ?? 0) > 0,
  );
  if (relayed) return true;
  const supply = sim.supplies.find((s) => s.truckId === truck.id && s.inletId === inletId);
  const source = sim.sources.find((x) => x.id === supply?.sourceId);
  if (source === undefined) return false;
  switch (source.kind) {
    case 'hydrant':
      return source.staticKpa > 0;
    case 'static':
      return truck.pump.primed && source.volumeL > 0;
  }
}

/** Flow out through an outlet valve: a delivery, or pump to tank. */
function outletFlowLpm(truck: TruckState, id: ControlId): number {
  if (id === truck.spec.pumpToTank?.id) return truck.readings.pumpToTankLpm;
  return truck.readings.deliveryFlowLpm[id] ?? 0;
}

/** An inlet's stretch on its `source` side (up to the valve) or `pump` side (on from it). */
function inletWater(
  sim: SimState,
  truck: TruckState,
  id: ControlId,
  side: 'source' | 'pump',
): WaterState {
  const inlet = truck.spec.inlets.find((i) => i.id === id);
  if (inlet === undefined) return 'empty';
  const moving = flowing(truck.readings.inletFlowLpm[id]);
  switch (inlet.kind) {
    case 'tank':
      return state(moving, side === 'pump' ? truck.pump.casingWet : truck.tankL > 0);
    case 'suction':
      return state(moving, side === 'pump' ? truck.pump.casingWet : supplyHolds(sim, truck, id));
    // Its pump side runs on into the tank, open to air: water only while it flows.
    case 'tankFill':
      return state(moving, side === 'source' && supplyHolds(sim, truck, id));
  }
}

/** What the water is doing in one stretch of `truck`'s plumbing. */
export function waterIn(sim: SimState, truck: TruckState, ref: WaterRef): WaterState {
  const r = truck.readings;
  const wet = truck.pump.casingWet;
  switch (ref.at) {
    case 'tank': {
      const drawing = truck.spec.inlets.some(
        (i) => i.kind === 'tank' && flowing(r.inletFlowLpm[i.id]),
      );
      return state(drawing, truck.tankL > 0);
    }
    case 'inlet':
      return inletWater(sim, truck, ref.id, ref.side);
    case 'casing': {
      // Pump flow includes the relief bypass, which circulates inside the casing.
      const moving =
        ref.feeds === undefined
          ? flowing(r.pumpFlowLpm)
          : ref.feeds.some((id) => flowing(outletFlowLpm(truck, id)));
      return state(moving, wet);
    }
    case 'delivery':
      // An open valve joins its outlet to the manifold: full whenever the casing is.
      return state(
        flowing(r.deliveryFlowLpm[ref.id]),
        wet && (truck.inputs.valves[ref.id] ?? 0) >= VALVE_CLOSED_EPS,
      );
    // Both run on into the tank, open to air: water only while it flows.
    case 'pumpToTank':
      return state(flowing(r.pumpToTankLpm), false);
    case 'recirc':
      return state(flowing(r.recircLpm), false);
  }
}
