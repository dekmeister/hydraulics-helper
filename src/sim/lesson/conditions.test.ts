import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { chargeLines, createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { layLine, run, tankAttackInputs } from '../testUtils';
import type { ApplianceSpec, SimState } from '../types';
import { holds, noFacts, validateCondition, type LessonFacts } from './conditions';
import { branchBand } from './refs';
import type { Condition } from './types';

const P = DEFAULT_TRUCK_ID;

function attack(spec: ApplianceSpec, throttle: number): SimState {
  const [d] = spec.deliveries;
  if (d === undefined) throw new Error('no delivery');
  const state = chargeLines(
    createInitialState(spec, [{ ...layLine(d.id, '38L', 3, 15), id: 'line-38' }]),
  );
  return run(state, tankAttackInputs(spec, throttle, [d.id]), 100);
}

const facts = (over: Partial<LessonFacts> = {}): LessonFacts => ({ ...noFacts(P), ...over });

describe.each([CAT1, TEST_APPLIANCE])('conditions on $id', (spec) => {
  const s = attack(spec, 0.6);
  const t = s.trucks[0];
  if (t === undefined) throw new Error('no truck');

  it('reads valves by line and by inlet kind, not by spec id', () => {
    expect(holds({ kind: 'valve', valve: { line: 'line-38' }, min: 0.9 }, s, facts())).toBe(true);
    expect(holds({ kind: 'valve', valve: { inlet: 'tank' }, min: 0.9 }, s, facts())).toBe(true);
    expect(holds({ kind: 'valve', valve: { inlet: 'suction' }, max: 0.05 }, s, facts())).toBe(true);
  });

  it('reads throttle, gauges and the tank as ranges', () => {
    expect(holds({ kind: 'throttle', min: 0.55, max: 0.65 }, s, facts())).toBe(true);
    const d = t.readings.dischargeKpa;
    expect(holds({ kind: 'gauge', gauge: 'discharge', min: d - 1, max: d + 1 }, s, facts())).toBe(
      true,
    );
    expect(holds({ kind: 'gauge', gauge: 'discharge', min: d + 1 }, s, facts())).toBe(false);
    expect(holds({ kind: 'gauge', gauge: 'rpm', min: t.rpm - 1 }, s, facts())).toBe(true);
    expect(holds({ kind: 'tank', max: 1, min: 0.9 }, s, facts())).toBe(true);
  });

  it('judges the branch against its Table 1 band', () => {
    const band = branchBand(s, 'line-38');
    expect(band?.targetKpa).toBe(350);
    expect(band?.minKpa).toBeCloseTo(315, 9);
    expect(band?.maxKpa).toBeCloseTo(385, 9);
    const kpa = t.readings.branchKpa['line-38'] ?? 0;
    const inBand = kpa >= 315 && kpa <= 385;
    expect(holds({ kind: 'branch', line: 'line-38' }, s, facts())).toBe(inBand);
    expect(holds({ kind: 'branch', line: 'line-38' }, attack(spec, 0), facts())).toBe(false);
  });

  it('reads line flow, priming, cavitation and tallies', () => {
    expect(holds({ kind: 'flow', line: 'line-38', min: 100 }, s, facts())).toBe(true);
    expect(holds({ kind: 'primed' }, s, facts())).toBe(false);
    expect(holds({ kind: 'not', of: { kind: 'cavitating' } }, s, facts())).toBe(true);
    expect(holds({ kind: 'tally', tally: 'waterHammer', max: 0 }, s, facts())).toBe(true);
  });

  it('reads time, acknowledgements, objectives and events from the facts', () => {
    expect(holds({ kind: 'time', min: 9.9 }, s, facts())).toBe(true);
    expect(holds({ kind: 'ack', step: 'hello' }, s, facts())).toBe(false);
    expect(holds({ kind: 'ack', step: 'hello' }, s, facts({ acks: ['hello'] }))).toBe(true);
    expect(holds({ kind: 'objective', objective: 'o1' }, s, facts({ done: ['o1'] }))).toBe(true);
    expect(holds({ kind: 'since', event: 'e1', s: 5 }, s, facts())).toBe(false);
    expect(holds({ kind: 'since', event: 'e1', s: 5 }, s, facts({ firedAtS: { e1: 5 } }))).toBe(
      true,
    );
    expect(holds({ kind: 'since', event: 'e1', s: 5 }, s, facts({ firedAtS: { e1: 6 } }))).toBe(
      false,
    );
  });

  it('combines with all, any and not', () => {
    const yes: Condition = { kind: 'time', min: 0 };
    const no: Condition = { kind: 'time', max: -1 };
    expect(holds({ kind: 'all', of: [yes, no] }, s, facts())).toBe(false);
    expect(holds({ kind: 'any', of: [yes, no] }, s, facts())).toBe(true);
    expect(holds({ kind: 'all', of: [] }, s, facts())).toBe(true);
    expect(holds({ kind: 'not', of: no }, s, facts())).toBe(true);
  });
});

describe('validateCondition', () => {
  const s = attack(CAT1, 0.6);
  const names = { objectives: ['o1'], events: ['e1'], coach: ['c1'] };
  const check = (c: Condition) => validateCondition(c, s, P, names);

  it('accepts names that resolve on the state', () => {
    expect(
      check({
        kind: 'all',
        of: [
          { kind: 'valve', valve: { line: 'line-38' } },
          { kind: 'valve', valve: { inlet: 'suction' } },
          { kind: 'branch', line: 'line-38' },
          { kind: 'objective', objective: 'o1' },
          { kind: 'since', event: 'e1', s: 1 },
          { kind: 'ack', step: 'c1' },
        ],
      }),
    ).toEqual([]);
  });

  it('lists every name that resolves to nothing', () => {
    const problems = check({
      kind: 'any',
      of: [
        { kind: 'valve', valve: { line: 'nope' } },
        { kind: 'branch', line: 'nope' },
        { kind: 'flow', line: 'nope' },
        { kind: 'primed', truck: 'ghost' },
        { kind: 'source', source: 'dam' },
        { kind: 'burst', link: 'relay' },
        { kind: 'objective', objective: 'o9' },
        { kind: 'since', event: 'e9', s: 1 },
        { kind: 'ack', step: 'c9' },
      ],
    });
    expect(problems).toHaveLength(9);
  });

  it('rejects a valve the appliance lacks', () => {
    const noSuction: ApplianceSpec = {
      ...CAT1,
      inlets: CAT1.inlets.filter((i) => i.kind !== 'suction'),
    };
    const state = createInitialState(noSuction);
    expect(
      validateCondition({ kind: 'valve', valve: { inlet: 'suction' } }, state, P, names),
    ).toHaveLength(1);
  });

  it('rejects a branch whose tip has no Table 1 pressure', () => {
    const [d] = CAT1.deliveries;
    if (d === undefined) throw new Error('no delivery');
    const state = createInitialState(CAT1, [{ ...layLine(d.id, '38L', 1, 17), id: 'odd' }]);
    expect(validateCondition({ kind: 'branch', line: 'odd' }, state, P, names)).toHaveLength(1);
  });
});
