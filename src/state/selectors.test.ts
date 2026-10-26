import { describe, expect, it } from 'vitest';
import { chargeLines, warmStart } from '../sim/engine';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { idleInputs } from '../sim/appliances/controls';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { createInitialState } from '../sim/engine';
import { TANK_ATTACK } from '../sim/scenarios/tankAttack';
import type { ApplianceSpec, PlayerInputs, SimState } from '../sim/types';
import { TICK_S } from '../sim/constants';
import { advance } from '../sim/engine';
import {
  activeTruck,
  CHARGED_MIN_LPM,
  deliveryLines,
  instrumentValue,
  lineOnDelivery,
  selectWarnings,
  tankFraction,
} from './selectors';
import { LOW_TANK_FRACTION } from './tankLevel';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

function withTank(sim: SimState, tankL: number): SimState {
  return { ...sim, trucks: sim.trucks.map((t) => ({ ...t, tankL })) };
}

const level = (sim: SimState, inputs: PlayerInputs, id: string) =>
  selectWarnings(sim, inputs).find((w) => w.id === id)?.level;

describe.each(ALL.map((spec) => [spec.id, spec] as const))('selectors: %s', (_id, spec) => {
  const sim = warmStart(TANK_ATTACK.build(spec).state);
  const idle = idleInputs(spec);
  const capacity = spec.tank?.capacityL ?? 0;
  const firstLine = sim.lines[0];
  const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
  if (firstLine === undefined || tankInlet === undefined) throw new Error('scenario not built');

  it('reads each instrument kind from the truck', () => {
    const truck = activeTruck(sim);
    expect(instrumentValue(truck, 'tank')).toBe(capacity);
    expect(instrumentValue(truck, 'tacho')).toBe(spec.engine.idleRpm);
    expect(instrumentValue(truck, 'discharge')).toBe(0);
    expect(instrumentValue(truck, 'compound')).toBe(0);
  });

  it('finds the line laid on a delivery, and none on a free one', () => {
    expect(lineOnDelivery(sim, firstLine.deliveryId)).toBe(firstLine);
    const used = new Set(sim.lines.map((l) => l.deliveryId));
    for (const d of spec.deliveries.filter((x) => !used.has(x.id)))
      expect(lineOnDelivery(sim, d.id)).toBeUndefined();
  });

  it('lights the tank lamp amber at the low mark and red when empty', () => {
    expect(level(sim, idle, 'tank')).toBe('off');
    expect(level(withTank(sim, LOW_TANK_FRACTION * capacity), idle, 'tank')).toBe('caution');
    expect(level(withTank(sim, 0), idle, 'tank')).toBe('alarm');
  });

  it('keeps warning messages steady while the tank drains (the live region re-announces changes)', () => {
    const message = (tankL: number) =>
      selectWarnings(withTank(sim, tankL), idle).find((w) => w.id === 'tank')?.message;
    const low = LOW_TANK_FRACTION * capacity;
    expect(message(low)).toBe(message(low - 37));
    expect(message(low)).not.toBe('');
  });

  it('warns of no supply only when a delivery is open with every inlet shut', () => {
    const deliveryOpen = { ...idle, valves: { ...idle.valves, [firstLine.deliveryId]: 1 } };
    expect(level(sim, idle, 'supply')).toBe('off');
    expect(level(sim, deliveryOpen, 'supply')).toBe('caution');
    const both = { ...deliveryOpen, valves: { ...deliveryOpen.valves, [tankInlet.id]: 1 } };
    expect(level(sim, both, 'supply')).toBe('off');
  });

  it('keeps the temperature, cavitation and hammer lamps unlit at rest', () => {
    expect(level(sim, idle, 'overheat')).toBe('off');
    expect(level(sim, idle, 'cavitation')).toBe('off');
    expect(level(sim, idle, 'hammer')).toBe('off');
  });

  it('has a relief lamp exactly when the spec fits a relief valve', () => {
    const ids = selectWarnings(sim, idle).map((w) => w.id);
    expect(ids.includes('over-pressure')).toBe(spec.relief !== undefined);
  });
});

describe.each(ALL.map((spec) => [spec.id, spec] as const))('delivery lines: %s', (_id, spec) => {
  const sim = warmStart(TANK_ATTACK.build(spec).state);
  const [first, second] = sim.lines;
  const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
  if (first === undefined || second === undefined || tankInlet === undefined)
    throw new Error('scenario not built');

  /** Run 5 s with tank-to-pump and `open` deliveries fully open at half throttle. */
  function run(open: readonly string[], from: SimState = sim): SimState {
    const valves: Record<string, number> = { [tankInlet?.id ?? '']: 1 };
    for (const id of open) valves[id] = 1;
    let s = from;
    for (let i = 0; i < 50; i++) s = advance(s, { throttle: 0.5, valves, switches: {} }, TICK_S);
    return s;
  }

  const byId = (s: SimState) => new Map(deliveryLines(s).map((d) => [d.deliveryId, d]));

  it('lists every spec delivery once, in spec order', () => {
    expect(deliveryLines(sim).map((d) => d.deliveryId)).toEqual(spec.deliveries.map((d) => d.id));
  });

  it('marks laid lines dry at rest and free deliveries as having no line', () => {
    for (const d of deliveryLines(sim)) {
      const laid = sim.lines.some((l) => l.deliveryId === d.deliveryId);
      expect(d.state).toBe(laid ? 'dry' : 'none');
      expect(d.line?.deliveryId ?? d.deliveryId).toBe(d.deliveryId);
      expect(d.flowLpm).toBe(0);
    }
  });

  it('fills a line from the truck: water moving, part full, nothing at the branch yet', () => {
    let s = sim;
    const valves = { [tankInlet.id]: 1, [first.deliveryId]: 1 };
    for (let i = 0; i < 5; i++) s = advance(s, { throttle: 0.5, valves, switches: {} }, TICK_S);
    const a = byId(s).get(first.deliveryId);
    expect(a?.state).toBe('filling');
    expect(a?.moving).toBe(true);
    expect(a?.level).toBeGreaterThan(0);
    expect(a?.level).toBeLessThan(1);
    expect(a?.branchFlowLpm).toBe(0);
    expect(a?.branchKpa).toBe(0);
    expect(byId(s).get(second.deliveryId)?.state).toBe('dry');
  });

  it('charges a full line once water leaves its branch', () => {
    const lines = byId(run([first.deliveryId], chargeLines(sim, [first.id])));
    const a = lines.get(first.deliveryId);
    expect(a?.state).toBe('charged');
    expect(a?.level).toBe(1);
    expect(a?.branchFlowLpm).toBeGreaterThanOrEqual(CHARGED_MIN_LPM);
    expect(a?.branchKpa).toBeGreaterThan(0);
    expect(lines.get(second.deliveryId)?.state).toBe('dry');
  });

  it('turning a delivery off leaves its line holding water and the other charged', () => {
    const both = run([first.deliveryId, second.deliveryId], chargeLines(sim));
    expect(byId(both).get(first.deliveryId)?.state).toBe('charged');
    const oneOff = byId(run([second.deliveryId], both));
    expect(oneOff.get(first.deliveryId)).toMatchObject({
      state: 'holding',
      level: 1,
      moving: false,
      flowLpm: 0,
    });
    expect(oneOff.get(second.deliveryId)?.state).toBe('charged');
  });

  it('no line flows when the tank is empty: the water stands in them', () => {
    const empty = run([first.deliveryId, second.deliveryId], withTank(chargeLines(sim), 0));
    for (const d of deliveryLines(empty)) if (d.line !== undefined) expect(d.state).toBe('holding');
  });

  it('reports the tank fraction, clamped to 0–1, and 0 for an appliance with no tank', () => {
    expect(tankFraction(activeTruck(sim))).toBe(1);
    expect(tankFraction(activeTruck(withTank(sim, 0)))).toBe(0);
    const capacity = spec.tank?.capacityL ?? 0;
    expect(tankFraction(activeTruck(withTank(sim, capacity / 4)))).toBeCloseTo(0.25, 9);
    const tankless: ApplianceSpec = structuredClone(spec);
    delete tankless.tank;
    expect(tankFraction({ ...activeTruck(sim), spec: tankless })).toBe(0);
  });
});

describe('relief lamp', () => {
  it('lights when the relief valve is dumping', () => {
    const spec = APPLIANCES[0];
    if (spec === undefined) throw new Error('empty catalogue');
    const sim = createInitialState(spec);
    const dumping: SimState = {
      ...sim,
      trucks: sim.trucks.map((t) => ({ ...t, readings: { ...t.readings, reliefFlowLpm: 40 } })),
    };
    expect(level(dumping, idleInputs(spec), 'over-pressure')).toBe(
      spec.relief === undefined ? undefined : 'caution',
    );
  });
});
