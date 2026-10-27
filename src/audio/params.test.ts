import { describe, expect, it } from 'vitest';
import { CAT1 } from '../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { createInitialState } from '../sim/engine';
import type { ApplianceSpec, TruckState } from '../sim/types';
import { soundParams } from './params';

function truckOf(spec: ApplianceSpec, over: Partial<TruckState> = {}): TruckState {
  const t = createInitialState(spec).trucks[0];
  if (t === undefined) throw new Error('no truck');
  return { ...t, ...over };
}

describe.each([CAT1, TEST_APPLIANCE])('sound on $id', (spec) => {
  const idle = { throttle: 0, valves: {}, switches: {} };

  it('idles quietly and rises in pitch and volume with rpm', () => {
    const low = soundParams(truckOf(spec), idle);
    const high = soundParams(truckOf(spec, { rpm: spec.engine.maxRpm }), idle);
    expect(high.engineHz).toBeGreaterThan(low.engineHz);
    expect(high.engineGain).toBeGreaterThan(low.engineGain);
    expect([low.primerGain, low.rattleGain, low.sprayGain, low.overflowGain]).toEqual([0, 0, 0, 0]);
  });

  it('is silent stopped, turns over quietly on the starter, and idles louder once it runs', () => {
    const stopped = { running: false, crankS: 0 };
    expect(soundParams(truckOf(spec, { rpm: 0, engine: stopped }), idle).engineGain).toBe(0);
    const cranking = soundParams(
      truckOf(spec, { rpm: spec.engine.crankRpm, engine: stopped }),
      idle,
    );
    expect(cranking.engineGain).toBeGreaterThan(0);
    expect(cranking.engineGain).toBeLessThan(soundParams(truckOf(spec), idle).engineGain);
  });

  it('fires each cylinder every other revolution: the note follows the spec’s engine', () => {
    const p = soundParams(truckOf(spec, { rpm: 1200 }), idle);
    expect(p.engineHz).toBeCloseTo((1200 / 60) * (spec.engine.cylinders / 2), 9);
  });

  it('rattles with cavitation and hisses with flow', () => {
    const t = truckOf(spec);
    const p = soundParams(
      { ...t, readings: { ...t.readings, cavitation: 0.5, deliveryFlowLpm: { x: 600 } } },
      idle,
    );
    expect(p.rattleGain).toBeGreaterThan(0);
    expect(p.sprayGain).toBeGreaterThan(0);
  });
});

it('whines while a primer runs, until it catches', () => {
  const id = CAT1.primer?.kind === 'rotaryVane' ? CAT1.primer.id : '';
  const on = { throttle: 0, valves: {}, switches: { [id]: true } };
  expect(soundParams(truckOf(CAT1), on).primerGain).toBeGreaterThan(0);
  const t = truckOf(CAT1);
  expect(soundParams({ ...t, pump: { ...t.pump, primed: true } }, on).primerGain).toBe(0);
});

it('gushes as soon as a full tank overflows, louder with the overflow, silent for a trickle', () => {
  const t = truckOf(CAT1);
  const over = (overflowLpm: number) =>
    soundParams(
      { ...t, readings: { ...t.readings, overflowLpm } },
      { throttle: 0, valves: {}, switches: {} },
    ).overflowGain;
  // A recirculation bleed returning into a full tank (~25 L/min) isn't heard.
  expect(over(25)).toBe(0);
  expect(over(100)).toBeGreaterThan(0);
  expect(over(1000)).toBeGreaterThan(over(300));
  expect(over(10000)).toBe(over(2000));
});
