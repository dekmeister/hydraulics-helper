import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { idleInputs } from '../sim/appliances/controls';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { createInitialState } from '../sim/engine';
import { TANK_ATTACK } from '../sim/scenarios/tankAttack';
import type { ApplianceSpec, PlayerInputs, SimState } from '../sim/types';
import { activeTruck, instrumentValue, lineOnDelivery, selectWarnings } from './selectors';
import { LOW_TANK_FRACTION } from './tankLevel';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

function withTank(sim: SimState, tankL: number): SimState {
  return { ...sim, trucks: sim.trucks.map((t) => ({ ...t, tankL })) };
}

const level = (sim: SimState, inputs: PlayerInputs, id: string) =>
  selectWarnings(sim, inputs).find((w) => w.id === id)?.level;

describe.each(ALL.map((spec) => [spec.id, spec] as const))('selectors: %s', (_id, spec) => {
  const sim = TANK_ATTACK.build(spec).state;
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

  it('shows overheat and cavitation as not simulated yet', () => {
    expect(level(sim, idle, 'overheat')).toBe('unavailable');
    expect(level(sim, idle, 'cavitation')).toBe('unavailable');
  });

  it('has a relief lamp exactly when the spec fits a relief valve', () => {
    const ids = selectWarnings(sim, idle).map((w) => w.id);
    expect(ids.includes('over-pressure')).toBe(spec.relief !== undefined);
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
