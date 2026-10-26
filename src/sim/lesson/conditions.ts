// Evaluating and checking lesson conditions. Pure functions of the sim state and lesson facts.
import { VALVE_CLOSED_EPS } from '../constants';
import { ignitionOn } from '../engineControl';
import type { InstrumentKind, SimState, TruckState } from '../types';
import { branchBand, branchKpa, hoseById, resolveValve, truckOf, workingFlowLpm } from './refs';
import type { Condition, GaugeId, Range } from './types';

/** What the lesson knows beyond the sim state: whose truck, what's been acknowledged, done, fired. */
export interface LessonFacts {
  playerTruckId: string;
  acks: readonly string[];
  /** Objectives done. */
  done: readonly string[];
  /** Sim time each fired event fired at, s. */
  firedAtS: Readonly<Record<string, number>>;
}

/** Facts at the start of a lesson: nothing acknowledged, done or fired. */
export function noFacts(playerTruckId: string): LessonFacts {
  return { playerTruckId, acks: [], done: [], firedAtS: {} };
}

function within(x: number, r: Range): boolean {
  return (r.min === undefined || x >= r.min) && (r.max === undefined || x <= r.max);
}

function gauge(truck: TruckState, id: GaugeId): number {
  switch (id) {
    case 'discharge':
      return truck.readings.dischargeKpa;
    case 'compound':
      return truck.readings.compoundKpa;
    case 'rpm':
      return truck.rpm;
  }
}

/** The instrument a person reads a gauge condition on. */
export function gaugeInstrument(id: GaugeId): InstrumentKind {
  return id === 'rpm' ? 'tacho' : id;
}

/** Whether `c` holds now. A condition naming something that isn't there is false. */
export function holds(c: Condition, state: SimState, facts: LessonFacts): boolean {
  const truck = (id?: string) => truckOf(state, facts.playerTruckId, id);
  switch (c.kind) {
    case 'valve': {
      const v = resolveValve(state, facts.playerTruckId, c.valve);
      return v !== undefined && within(v.truck.inputs.valves[v.control] ?? 0, c);
    }
    case 'throttle': {
      const t = truck(c.truck);
      return t !== undefined && within(t.inputs.throttle, c);
    }
    case 'gauge': {
      const t = truck(c.truck);
      return t !== undefined && within(gauge(t, c.gauge), c);
    }
    case 'engine': {
      const t = truck(c.truck);
      return (
        t !== undefined &&
        (c.running === undefined || t.engine.running === c.running) &&
        (c.ignition === undefined || ignitionOn(t) === c.ignition)
      );
    }
    case 'tank': {
      const t = truck(c.truck);
      const capacityL = t?.spec.tank?.capacityL ?? 0;
      return t !== undefined && capacityL > 0 && within(t.tankL / capacityL, c);
    }
    case 'branch': {
      const band = branchBand(state, c.line);
      return (
        band !== undefined &&
        within(branchKpa(state, c.line), { min: band.minKpa, max: band.maxKpa })
      );
    }
    case 'flow': {
      const hose = hoseById(state, c.line);
      const t = hose === undefined ? undefined : truck(hose.truckId);
      const q = t?.readings.deliveryFlowLpm[hose?.deliveryId ?? ''] ?? 0;
      if (hose === undefined) return false;
      if (c.ofWorking !== true) return within(q, c);
      const working = workingFlowLpm(state, c.line);
      return working !== undefined && within(q / working, c);
    }
    case 'primed':
      return truck(c.truck)?.pump.primed === true;
    case 'cavitating':
      return (truck(c.truck)?.readings.cavitation ?? 0) > 0;
    case 'source': {
      const source = state.sources.find((x) => x.id === c.source);
      return source?.kind === 'static' && within(source.volumeL, c);
    }
    case 'burst':
      return state.links.find((l) => l.id === c.link)?.burst !== undefined;
    case 'tally': {
      const t = truck(c.truck);
      return t !== undefined && within(t.tally[c.tally], c);
    }
    case 'time':
      // Sim time is a sum of 0.1 s ticks, so 10 ticks is 0.9999…: allow for it.
      return within(state.timeS, {
        min: (c.min ?? -Infinity) - 1e-9,
        max: (c.max ?? Infinity) + 1e-9,
      });
    case 'ack':
      return facts.acks.includes(c.step);
    case 'objective':
      return facts.done.includes(c.objective);
    case 'since': {
      const at = facts.firedAtS[c.event];
      return at !== undefined && state.timeS - at >= c.s - 1e-9;
    }
    case 'all':
      return c.of.every((x) => holds(x, state, facts));
    case 'any':
      return c.of.some((x) => holds(x, state, facts));
    case 'not':
      return !holds(c.of, state, facts);
  }
}

/** A valve counts as open from `VALVE_CLOSED_EPS`, as everywhere else in the sim. */
export const OPEN: Range = { min: VALVE_CLOSED_EPS };

/** Names a lesson defines, which its conditions may refer to. */
export interface LessonNames {
  objectives: readonly string[];
  events: readonly string[];
  coach: readonly string[];
}

/** Every name in `c` that resolves to nothing on `state` or in the lesson; empty when sound. */
export function validateCondition(
  c: Condition,
  state: SimState,
  playerTruckId: string,
  names: LessonNames,
): string[] {
  const truck = (id?: string) =>
    truckOf(state, playerTruckId, id) === undefined ? [`no truck '${id ?? playerTruckId}'`] : [];
  const line = (id: string) => (hoseById(state, id) === undefined ? [`no line '${id}'`] : []);
  const named = (list: readonly string[], kind: string, id: string) =>
    list.includes(id) ? [] : [`no ${kind} '${id}'`];
  switch (c.kind) {
    case 'valve':
      return resolveValve(state, playerTruckId, c.valve) === undefined
        ? [`no valve ${JSON.stringify(c.valve)}`]
        : [];
    case 'branch':
      if (state.lines.every((l) => l.id !== c.line)) return [`no line '${c.line}'`];
      return branchBand(state, c.line) === undefined
        ? [`line '${c.line}': no Table 1 pressure for its tip`]
        : [];
    case 'flow':
      if (c.ofWorking === true && workingFlowLpm(state, c.line) === undefined)
        return [`line '${c.line}': no working flow (not a lay with a Table 1 tip)`];
      return line(c.line);
    case 'gauge': {
      const t = truckOf(state, playerTruckId, c.truck);
      if (t === undefined) return truck(c.truck);
      const kind = gaugeInstrument(c.gauge);
      return t.spec.instruments.some((i) => i.kind === kind)
        ? []
        : [`no ${kind} gauge on '${t.id}' to read`];
    }
    case 'throttle':
    case 'engine':
    case 'tank':
    case 'primed':
    case 'cavitating':
    case 'tally':
      return truck(c.truck);
    case 'source':
      return state.sources.some((x) => x.id === c.source && x.kind === 'static')
        ? []
        : [`no static source '${c.source}'`];
    case 'burst':
      return state.links.some((l) => l.id === c.link) ? [] : [`no relay '${c.link}'`];
    case 'time':
      return [];
    case 'ack':
      return named(names.coach, 'coach step', c.step);
    case 'objective':
      return named(names.objectives, 'objective', c.objective);
    case 'since':
      return named(names.events, 'event', c.event);
    case 'all':
    case 'any':
      return c.of.flatMap((x) => validateCondition(x, state, playerTruckId, names));
    case 'not':
      return validateCondition(c.of, state, playerTruckId, names);
  }
}
