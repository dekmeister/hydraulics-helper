// Sim states for the generated panel and scene fixtures (docs/TESTING.md §3.2). Pure sim calls, built per
// appliance from the tank-attack scenario so every appliance gets the same set.
import { TICK_S, VALVE_CLOSED_EPS } from '../../sim/constants';
import { advance, chargeLines, warmStart } from '../../sim/engine';
import { lineFill } from '../../sim/lineFill';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';

/** Discharge the `tank-attack-700` fixture is trimmed to, kPa: the manual's working branch pressure. */
export const TANK_ATTACK_TARGET_KPA = 700;

/** Sim time each fixture state runs for before capture, s: long past the 0.5 s rpm lag. */
const RUN_S = 10;

export type PanelStateId = 'idle' | 'tank-attack-700' | 'tank-low' | 'tank-empty' | EngineStateId;

/** The engine being started or stopped, on the tank-attack fireground with every valve shut. */
export type EngineStateId =
  'engine-cold' | 'ignition-on' | 'cranking' | 'stopping' | 'stop-without-ignition';

/** Engine states an appliance can show: the ignition trap only where STOP needs the ignition. */
export function engineStates(spec: ApplianceSpec): EngineStateId[] {
  return [
    'engine-cold',
    'ignition-on',
    'cranking',
    'stopping',
    ...(spec.engine.controls.stop.needsIgnition ? (['stop-without-ignition'] as const) : []),
  ];
}

/**
 * `state` run for `seconds` on `inputs`. Scenarios start cold, so the engines are started first
 * (`warmStart`) and the player's ignition held on, as on a pump its operator has started.
 */
export function settle(state: SimState, inputs: PlayerInputs, seconds = RUN_S): SimState {
  let s = warmStart(state);
  const spec = s.trucks.find((t) => t.id === s.activeTruckId)?.spec;
  const on =
    spec === undefined
      ? inputs
      : { ...inputs, switches: { ...inputs.switches, [spec.engine.controls.ignition]: true } };
  const ticks = Math.round(seconds / TICK_S);
  for (let i = 0; i < ticks; i++) s = advance(s, on, TICK_S);
  return s;
}

/**
 * `state` with the lays on the deliveries `inputs` opens already charged: fixtures of steady flow
 * start past the fill (the `line-filling` scene fixture shows the fill itself).
 */
export function chargedFor(state: SimState, inputs: PlayerInputs): SimState {
  const open = state.lines.filter((l) => (inputs.valves[l.deliveryId] ?? 0) >= VALVE_CLOSED_EPS);
  return chargeLines(
    state,
    open.map((l) => l.id),
  );
}

/** `state` run for `seconds` with only the named engine switches on: no warm start. */
function holdSwitches(state: SimState, held: readonly ControlId[], seconds: number): SimState {
  const inputs: PlayerInputs = {
    throttle: 0,
    valves: {},
    switches: Object.fromEntries(held.map((id) => [id, true])),
  };
  let s = state;
  for (let i = 0; i < Math.round(seconds / TICK_S); i++) s = advance(s, inputs, TICK_S);
  return s;
}

/** The engine part-way through a start or a stop, from the cold tank-attack state. */
function engineState(spec: ApplianceSpec, cold: SimState, id: EngineStateId): SimState {
  const { ignition, start, stop } = spec.engine.controls;
  switch (id) {
    case 'engine-cold':
      return cold;
    case 'ignition-on':
      return holdSwitches(cold, [ignition], 1);
    case 'cranking':
      // Most of the way through the crank: the starter has it turning, not yet firing.
      return holdSwitches(cold, [ignition, start], spec.engine.crankS * 0.7);
    case 'stopping':
      // One tick of STOP held: the fuel is cut and it's running down, not yet stopped.
      return holdSwitches(warmStart(cold), [ignition, stop.id], TICK_S);
    case 'stop-without-ignition':
      return holdSwitches(warmStart(cold), [stop.id], 2);
  }
}

function withTankL(state: SimState, tankL: number): SimState {
  return { ...state, trucks: state.trucks.map((t) => ({ ...t, tankL })) };
}

const discharge = (s: SimState) => s.trucks[0]?.readings.dischargeKpa ?? 0;

/** Tank-to-pump open and the `open` deliveries fully open, at `throttle`. */
function attackInputs(
  spec: ApplianceSpec,
  open: readonly ControlId[],
  throttle: number,
): PlayerInputs {
  const valves: Record<ControlId, number> = {};
  for (const id of open) valves[id] = 1;
  for (const i of spec.inlets) if (i.kind === 'tank') valves[i.id] = 1;
  return { throttle, valves, switches: {} };
}

/** Throttle that holds `targetKpa` with `inputsAt(throttle)`: bisection, as discharge rises with throttle. */
export function throttleForKpa(
  initial: SimState,
  inputsAt: (throttle: number) => PlayerInputs,
  targetKpa: number,
): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const inputs = inputsAt(mid);
    if (discharge(settle(chargedFor(initial, inputs), inputs)) < targetKpa) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Throttle that holds `targetKpa` on tank supply with `open` flowing. */
function throttleFor(
  initial: SimState,
  spec: ApplianceSpec,
  open: readonly ControlId[],
  targetKpa: number,
) {
  return throttleForKpa(initial, (t) => attackInputs(spec, open, t), targetKpa);
}

/** Sim state for a generated panel fixture. Throws if the appliance can't play tank attack. */
export function panelState(spec: ApplianceSpec, id: PanelStateId): SimState {
  const initial = TANK_ATTACK.build(spec).state;
  switch (id) {
    case 'idle':
      return warmStart(initial);
    case 'engine-cold':
    case 'ignition-on':
    case 'cranking':
    case 'stopping':
    case 'stop-without-ignition':
      return engineState(spec, initial, id);
  }
  const line = initial.lines[0];
  if (line === undefined) throw new Error(`tank attack laid no line on ${spec.id}`);
  const capacityL = spec.tank?.capacityL ?? 0;
  const throttle = throttleFor(initial, spec, [line.deliveryId], TANK_ATTACK_TARGET_KPA);
  const inputs = attackInputs(spec, [line.deliveryId], throttle);
  switch (id) {
    case 'tank-attack-700':
      return settle(chargedFor(initial, inputs), inputs);
    case 'tank-low':
      // Starts at a fifth of a tank; 10 s at the branch's flow leaves it just under.
      return settle(chargedFor(withTankL(initial, 0.2 * capacityL), inputs), inputs);
    case 'tank-empty':
      return settle(chargedFor(withTankL(initial, 0), inputs), inputs);
  }
}

export type SceneStateId =
  'all-charged' | 'one-line-off' | 'tank-low' | 'tank-empty' | 'line-filling';

/** Most the 'line-filling' fixture runs waiting for the front to pass half way, s. */
const FILLING_MAX_S = 60;

/**
 * Sim state for a generated scene fixture: every tank-attack line open at the throttle that holds
 * the working discharge, then the first line shut ('one-line-off') or the tank run low or empty.
 * 'line-filling': only the first line opened, dry, at that throttle until it is half full.
 */
export function sceneState(spec: ApplianceSpec, id: SceneStateId): SimState {
  const initial = TANK_ATTACK.build(spec).state;
  const all = initial.lines.map((l) => l.deliveryId);
  const capacityL = spec.tank?.capacityL ?? 0;
  const throttle = throttleFor(initial, spec, all, TANK_ATTACK_TARGET_KPA);
  const inputs = attackInputs(spec, all, throttle);
  switch (id) {
    case 'all-charged':
      return settle(chargedFor(initial, inputs), inputs);
    case 'one-line-off': {
      const some = attackInputs(spec, all.slice(1), throttle);
      return settle(chargedFor(initial, some), some);
    }
    case 'tank-low':
      return settle(chargedFor(withTankL(initial, 0.2 * capacityL), inputs), inputs);
    case 'tank-empty':
      return settle(chargedFor(withTankL(initial, 0), inputs), inputs);
    case 'line-filling': {
      const line = initial.lines[0];
      if (line === undefined) throw new Error(`tank attack laid no line on ${spec.id}`);
      const one = attackInputs(spec, [line.deliveryId], throttle);
      let s = settle(initial, one, TICK_S);
      for (let i = 0; i < FILLING_MAX_S / TICK_S; i++) {
        if (lineFill(line, s.lineWaterL[line.id] ?? 0).fraction >= 0.5) return s;
        s = settle(s, one, TICK_S);
      }
      throw new Error(`${spec.id}: the first line never filled half way`);
    }
  }
}
