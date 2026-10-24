import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/engine';
import type { ApplianceSpec } from '../sim/types';
import { activeTruck } from './selectors';
import { useStore, WAKE_HISTORY_S } from './store';

describe('store', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('starts with the tank-attack lines laid and every control shut', () => {
    const { sim, inputs } = useStore.getState();
    expect(sim.lines.length).toBeGreaterThan(0);
    expect(inputs.throttle).toBe(0);
    expect(Object.values(inputs.valves).every((v) => v === 0)).toBe(true);
  });

  it('applies panel inputs to the sim on the next tick', () => {
    const { sim, setValve, setThrottle } = useStore.getState();
    const spec = activeTruck(sim).spec;
    for (const i of spec.inlets) setValve(i.id, 1);
    const line = sim.lines[0];
    if (line === undefined) throw new Error('no line');
    setValve(line.deliveryId, 1);
    setThrottle(0.6);
    useStore.getState().step(50);
    const truck = activeTruck(useStore.getState().sim);
    expect(truck.inputs.throttle).toBe(0.6);
    expect(truck.readings.dischargeKpa).toBeGreaterThan(0);
    expect(truck.readings.deliveryFlowLpm[line.deliveryId]).toBeGreaterThan(0);
  });

  it('clamps inputs to 0–1', () => {
    const { setThrottle, setValve, sim } = useStore.getState();
    setThrottle(1.7);
    const id = activeTruck(sim).spec.deliveries[0]?.id ?? '';
    setValve(id, -3);
    expect(useStore.getState().inputs.throttle).toBe(1);
    expect(useStore.getState().inputs.valves[id]).toBe(0);
  });

  it('rejects control ids the active appliance does not have', () => {
    expect(() => {
      useStore.getState().setValve('d99', 1);
    }).toThrow(/not a valve/);
    expect(() => {
      useStore.getState().setSwitch('d1', true);
    }).toThrow(/not a switch/);
  });

  it('toggles the scene↔panel highlight on a delivery and remembers which side asked', () => {
    const { sim, toggleHighlight } = useStore.getState();
    const [a, b] = activeTruck(sim).spec.deliveries;
    if (a === undefined || b === undefined) throw new Error('need two deliveries');
    expect(useStore.getState().highlight).toBeNull();
    toggleHighlight(a.id, 'scene');
    expect(useStore.getState().highlight).toEqual({ deliveryId: a.id, from: 'scene' });
    toggleHighlight(b.id, 'panel');
    expect(useStore.getState().highlight).toEqual({ deliveryId: b.id, from: 'panel' });
    toggleHighlight(b.id, 'scene');
    expect(useStore.getState().highlight).toBeNull();
  });

  it('rejects a highlight on something that is not a delivery, and clears it on reset', () => {
    const { sim, toggleHighlight } = useStore.getState();
    const spec = activeTruck(sim).spec;
    const inlet = spec.inlets[0]?.id ?? '';
    expect(() => {
      toggleHighlight(inlet, 'panel');
    }).toThrow();
    toggleHighlight(spec.deliveries[0]?.id ?? '', 'panel');
    useStore.getState().reset();
    expect(useStore.getState().highlight).toBeNull();
  });
});

describe('store: scenarios and the Wake', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('starts on tank attack and loads another scenario on the same appliance', () => {
    expect(useStore.getState().scenarioId).toBe('tank-attack');
    const applianceId = activeTruck(useStore.getState().sim).spec.id;
    useStore.getState().loadScenario('draughting');
    const { sim, scenarioId } = useStore.getState();
    expect(scenarioId).toBe('draughting');
    expect(activeTruck(sim).spec.id).toBe(applianceId);
    expect(sim.sources.some((s) => s.kind === 'static')).toBe(true);
  });

  it('refuses a scenario the active appliance can’t play, naming both', () => {
    const spec = activeTruck(useStore.getState().sim).spec;
    const noSuction: ApplianceSpec = {
      ...spec,
      id: 'no-suction',
      inlets: spec.inlets.filter((i) => i.kind !== 'suction'),
    };
    useStore.getState().reset(createInitialState(noSuction));
    expect(() => {
      useStore.getState().loadScenario('draughting');
    }).toThrow(/no-suction can’t play 'draughting'/);
  });

  it('a raw state reset has no scenario', () => {
    useStore.getState().reset(useStore.getState().sim);
    expect(useStore.getState().scenarioId).toBeNull();
  });

  it('keeps about 3 s of readings, one per tick, and clears them on reset', () => {
    useStore.getState().step(100);
    const { wake, sim } = useStore.getState();
    expect(wake.length).toBe(Math.round(WAKE_HISTORY_S / 0.1) + 1);
    expect(wake.at(-1)?.tS).toBeCloseTo(sim.timeS, 9);
    expect(wake[0]?.values.discharge).toBeDefined();
    useStore.getState().reset();
    expect(useStore.getState().wake).toEqual([]);
  });
});
