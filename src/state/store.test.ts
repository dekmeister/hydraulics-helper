import { beforeEach, describe, expect, it } from 'vitest';
import { activeTruck } from './selectors';
import { useStore } from './store';

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
});
