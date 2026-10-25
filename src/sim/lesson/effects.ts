// Scenario events' effects on the fireground: pure SimState → SimState, applied between ticks. Each
// result is re-checked like a scenario's initial site, so an effect that doesn't fit throws.
import { sanitiseInputs } from '../appliances/controls';
import { STANDARD_LENGTH_M } from '../constants';
import { hoseType } from '../hose';
import { takeDelivery } from '../scenarios/lay';
import { validateSite } from '../site';
import type { HoseLine, SimState } from '../types';
import { truckOf } from './refs';
import type { Effect } from './types';

function check(state: SimState): SimState {
  validateSite(state.trucks, state.sources, state.supplies, state.links, state.lines);
  return state;
}

function layLine(state: SimState, playerTruckId: string, e: Extract<Effect, { kind: 'layLine' }>) {
  const { line } = e;
  const truck = truckOf(state, playerTruckId, line.truck);
  if (truck === undefined) throw new Error(`layLine '${line.id}': no truck`);
  if ([...state.lines, ...state.links].some((h) => h.id === line.id))
    throw new Error(`layLine: '${line.id}' is already on the fireground`);
  hoseType(line.hose); // throws on a hose not in the catalogue
  const taken = new Set(
    [...state.lines, ...state.links].filter((h) => h.truckId === truck.id).map((h) => h.deliveryId),
  );
  const free = truck.spec.deliveries.filter((d) => !taken.has(d.id));
  if (free.length === 0) throw new Error(`layLine '${line.id}': no free delivery on '${truck.id}'`);
  const delivery = takeDelivery(free, line.hose);
  const lay: HoseLine = {
    id: line.id,
    truckId: truck.id,
    deliveryId: delivery.id,
    segments: Array.from({ length: line.lengths }, () => ({
      hose: line.hose,
      lengthM: STANDARD_LENGTH_M,
    })),
    elevationM: line.elevationM ?? 0,
    branch: { tipMm: line.tipMm },
  };
  return check({ ...state, lines: [...state.lines, lay] });
}

function moveBranch(state: SimState, e: Extract<Effect, { kind: 'moveBranch' }>): SimState {
  const line = state.lines.find((l) => l.id === e.line);
  const last = line?.segments.at(-1);
  if (line === undefined || last === undefined) throw new Error(`moveBranch: no line '${e.line}'`);
  const extra = Array.from({ length: e.addLengths ?? 0 }, () => ({
    hose: last.hose,
    lengthM: STANDARD_LENGTH_M,
  }));
  const moved: HoseLine = {
    ...line,
    segments: [...line.segments, ...extra],
    elevationM: e.elevationM ?? line.elevationM,
  };
  return { ...state, lines: state.lines.map((l) => (l.id === e.line ? moved : l)) };
}

function connectSupply(
  state: SimState,
  playerTruckId: string,
  e: Extract<Effect, { kind: 'connectSupply' }>,
): SimState {
  const truck = truckOf(state, playerTruckId, e.supply.truck);
  const inlet = truck?.spec.inlets.find((i) => i.kind === 'suction');
  if (truck === undefined || inlet === undefined)
    throw new Error(`connectSupply '${e.supply.id}': no suction inlet`);
  const sources = e.source === undefined ? state.sources : [...state.sources, e.source];
  const supply = {
    id: e.supply.id,
    truckId: truck.id,
    inletId: inlet.id,
    sourceId: e.supply.sourceId,
    segments: e.supply.segments,
  };
  return check({ ...state, sources, supplies: [...state.supplies, supply] });
}

/**
 * The fireground after `effect`. Throws when it doesn't fit: no free delivery, an unknown line,
 * relay or truck, a supply to a missing source or a taken inlet, or the player's own truck asked to
 * hold settings (the player's controls are theirs).
 */
export function applyEffect(state: SimState, playerTruckId: string, effect: Effect): SimState {
  switch (effect.kind) {
    case 'layLine':
      return layLine(state, playerTruckId, effect);
    case 'moveBranch':
      return moveBranch(state, effect);
    case 'connectSupply':
      return connectSupply(state, playerTruckId, effect);
    case 'repairRelay': {
      if (!state.links.some((l) => l.id === effect.link))
        throw new Error(`repairRelay: no relay '${effect.link}'`);
      return {
        ...state,
        links: state.links.map((l) => {
          if (l.id !== effect.link) return l;
          const whole = { ...l };
          delete whole.burst;
          return whole;
        }),
      };
    }
    case 'holdSettings': {
      if (effect.truck === playerTruckId)
        throw new Error(`holdSettings: '${effect.truck}' is the player's truck`);
      const truck = state.trucks.find((t) => t.id === effect.truck);
      if (truck === undefined) throw new Error(`holdSettings: no truck '${effect.truck}'`);
      const inputs = sanitiseInputs(truck.spec, {
        ...truck.inputs,
        throttle: effect.throttle ?? truck.inputs.throttle,
      });
      return {
        ...state,
        trucks: state.trucks.map((t) => (t.id === truck.id ? { ...t, inputs } : t)),
      };
    }
  }
}
