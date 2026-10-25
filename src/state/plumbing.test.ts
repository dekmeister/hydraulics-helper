import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { createIdleInputs, createInitialState } from '../sim/engine';
import {
  draughtSite,
  hydrantSite,
  inputsWith,
  lineOnEveryDelivery,
  primedState,
  run,
  tankAttackInputs,
  truckOf,
} from '../sim/testUtils';
import type { ApplianceSpec, SimState } from '../sim/types';
import { waterIn, waterRefKey, type WaterRef } from './plumbing';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];
const at = (s: SimState, ref: WaterRef) => waterIn(s, truckOf(s), ref);

describe('waterRefKey', () => {
  it('names every kind of stretch', () => {
    expect(waterRefKey({ at: 'tank' })).toBe('tank');
    expect(waterRefKey({ at: 'casing' })).toBe('casing');
    expect(waterRefKey({ at: 'casing', feeds: ['d2', 'd3'] })).toBe('casing:d2+d3');
    expect(waterRefKey({ at: 'inlet', id: 'suction', side: 'source' })).toBe(
      'inlet:suction:source',
    );
    expect(waterRefKey({ at: 'delivery', id: 'd1' })).toBe('delivery:d1');
    expect(waterRefKey({ at: 'pumpToTank' })).toBe('pumpToTank');
    expect(waterRefKey({ at: 'recirc' })).toBe('recirc');
  });
});

describe.each(ALL.map((spec) => [spec.id, spec] as const))('waterIn: %s', (_id, spec) => {
  const tankIn = spec.inlets.find((i) => i.kind === 'tank')?.id;
  const suction = spec.inlets.find((i) => i.kind === 'suction')?.id;
  const tankFill = spec.inlets.find((i) => i.kind === 'tankFill')?.id;
  const ptt = spec.pumpToTank?.id;
  const [d1, ...rest] = spec.deliveries.map((d) => d.id);
  if (d1 === undefined) throw new Error(`${spec.id} has no deliveries`);
  const lines = lineOnEveryDelivery(spec);

  it('at rest: the tank side still, the casing and every outlet empty', () => {
    const s = createInitialState(spec, lines);
    expect(at(s, { at: 'tank' })).toBe(tankIn === undefined ? 'empty' : 'still');
    expect(at(s, { at: 'casing' })).toBe('empty');
    expect(at(s, { at: 'delivery', id: d1 })).toBe('empty');
    expect(at(s, { at: 'pumpToTank' })).toBe('empty');
    expect(at(s, { at: 'recirc' })).toBe('empty');
    expect(at(s, { at: 'inlet', id: 'no-such-inlet', side: 'source' })).toBe('empty');
  });

  it.runIf(spec.recirc !== undefined && tankIn !== undefined)(
    'recirculation flows whenever the pump moves water, every delivery shut, and empties after',
    () => {
      let s = run(createInitialState(spec, lines), tankAttackInputs(spec, 0.5, []), 30);
      expect(at(s, { at: 'recirc' })).toBe('flowing');
      s = run(s, inputsWith(0.5, []), 30);
      expect(at(s, { at: 'recirc' })).toBe('empty');
    },
  );

  it.runIf(tankIn !== undefined)(
    'tank attack: the feed, the casing and the open line flow; a shut line stays empty',
    () => {
      const id = tankIn ?? '';
      let s = run(createInitialState(spec, lines), tankAttackInputs(spec, 0.5, [d1]), 30);
      expect(at(s, { at: 'tank' })).toBe('flowing');
      expect(at(s, { at: 'inlet', id, side: 'source' })).toBe('flowing');
      expect(at(s, { at: 'inlet', id, side: 'pump' })).toBe('flowing');
      expect(at(s, { at: 'casing' })).toBe('flowing');
      expect(at(s, { at: 'casing', feeds: [d1] })).toBe('flowing');
      expect(at(s, { at: 'delivery', id: d1 })).toBe('flowing');
      for (const d of rest) {
        expect(at(s, { at: 'casing', feeds: [d] })).toBe('still');
        expect(at(s, { at: 'delivery', id: d })).toBe('empty');
      }
      // Everything shut: the casing keeps its water, still; the tank side is still too.
      s = run(s, createIdleInputs(spec), 10);
      expect(at(s, { at: 'tank' })).toBe('still');
      expect(at(s, { at: 'inlet', id, side: 'pump' })).toBe('still');
      expect(at(s, { at: 'casing' })).toBe('still');
      expect(at(s, { at: 'delivery', id: d1 })).toBe('empty');
    },
  );

  it.runIf(tankIn !== undefined)('an empty tank holds no water', () => {
    const s0 = createInitialState(spec, lines);
    const s = { ...s0, trucks: s0.trucks.map((t) => ({ ...t, tankL: 0 })) };
    expect(at(s, { at: 'tank' })).toBe('empty');
    expect(at(s, { at: 'inlet', id: tankIn ?? '', side: 'source' })).toBe('empty');
  });

  it.runIf(suction !== undefined)('draught: empty until primed, then still, then flowing', () => {
    const id = suction ?? '';
    const s0 = createInitialState(spec, lines, draughtSite(spec, 3));
    expect(at(s0, { at: 'inlet', id, side: 'source' })).toBe('empty');
    const primed = primedState(s0);
    expect(at(primed, { at: 'inlet', id, side: 'source' })).toBe('still');
    const s = run(primed, inputsWith(0.5, [id, d1]), 30);
    expect(at(s, { at: 'inlet', id, side: 'source' })).toBe('flowing');
    expect(at(s, { at: 'inlet', id, side: 'pump' })).toBe('flowing');
    expect(at(s, { at: 'delivery', id: d1 })).toBe('flowing');
  });

  it.runIf(suction !== undefined)(
    'hydrant: the coupling side holds water behind a shut valve',
    () => {
      const id = suction ?? '';
      const s = createInitialState(spec, lines, hydrantSite(spec));
      expect(at(s, { at: 'inlet', id, side: 'source' })).toBe('still');
      expect(at(s, { at: 'inlet', id, side: 'pump' })).toBe('empty');
    },
  );

  it.runIf(tankFill !== undefined)('hydrant to tank: flows into the tank, never stands', () => {
    const id = tankFill ?? '';
    const site = hydrantSite(spec);
    const supplies = (site.supplies ?? []).map((x) => ({ ...x, inletId: id }));
    const s0 = createInitialState(spec, [], { ...site, supplies });
    expect(at(s0, { at: 'inlet', id, side: 'source' })).toBe('still');
    expect(at(s0, { at: 'inlet', id, side: 'pump' })).toBe('empty');
    const s = run(s0, inputsWith(0, [id]), 10);
    expect(at(s, { at: 'inlet', id, side: 'pump' })).toBe('flowing');
    // It bypasses the pump.
    expect(at(s, { at: 'casing' })).toBe('empty');
  });

  it.runIf(ptt !== undefined && tankIn !== undefined)(
    'pump to tank: its stub of manifold flows, and the return runs into the tank',
    () => {
      const id = ptt ?? '';
      const s = run(createInitialState(spec, lines), tankAttackInputs(spec, 0.5, [id]), 30);
      expect(at(s, { at: 'casing', feeds: [id] })).toBe('flowing');
      expect(at(s, { at: 'pumpToTank' })).toBe('flowing');
      expect(at(s, { at: 'delivery', id: d1 })).toBe('empty');
    },
  );
});
