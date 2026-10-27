import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { createInitialState } from '../engine';
import { attachLines, BUSH_LINE, VILLAGE_LINE, type PlannedLine } from '../scenarios/lay';
import { getScenario } from '../scenarios';
import { lessonBrief, loadScenario } from '../scenarios/load';
import type { ApplianceSpec } from '../types';
import { holds, noFacts, validateCondition } from './conditions';
import { genericText, lessonTextProblems, resolveText } from './text';

/** A light tanker: two 38 mm outlets and nothing bigger. */
const LIGHT: ApplianceSpec = {
  ...CAT1,
  id: 'light-test',
  deliveries: [
    { id: 'a', label: 'A', sizeMm: 38 },
    { id: 'b', label: 'B', sizeMm: 38 },
  ],
};

const PLANS: readonly PlannedLine[] = [
  { id: 'line-1', ...BUSH_LINE },
  { id: 'line-2', ...VILLAGE_LINE, elevationM: -10 },
];

describe('line plans', () => {
  it('puts 25 mm on a 38 mm outlet (the adaptor), not the 65 mm one', () => {
    const [bush] = attachLines(CAT1, PLANS);
    const outlet = CAT1.deliveries.find((d) => d.id === bush?.deliveryId);
    expect(outlet?.sizeMm).toBe(38);
  });

  it('lays the kit as planned, branch height included', () => {
    const [, village] = attachLines(LIGHT, PLANS);
    expect(village?.segments.map((x) => x.hose)).toEqual(['38L', '38L', '38L']);
    expect(village?.branch.tipMm).toBe(15);
    expect(village?.elevationM).toBe(-10);
  });
});

describe('lesson copy', () => {
  const cat1 = createInitialState(CAT1, attachLines(CAT1, PLANS));
  const light = createInitialState(LIGHT, attachLines(LIGHT, PLANS));

  it('names what was laid', () => {
    const text = 'Charge the {line:ID} ({hose:ID}, {tip:ID} branch at {kpa:ID}).';
    expect(resolveText(text.replaceAll('ID', 'line-1'), cat1)).toBe(
      'Charge the 25 mm line (25 mm, 12 mm branch at 250 kPa).',
    );
    expect(resolveText(text.replaceAll('ID', 'line-2'), light)).toBe(
      'Charge the 38 mm line (38 mm, 15 mm branch at 350 kPa).',
    );
  });

  it('gives a flow as a fraction of the line’s working flow, to 10 L/min', () => {
    // A 15 mm tip at 350 kPa: (2/3)·15²/10·√350 ≈ 281 L/min.
    expect(resolveText('{flow:line-2:1}', cat1)).toBe('280 L/min');
    expect(resolveText('{flow:line-2:0.5}', cat1)).toBe('140 L/min');
  });

  it('leaves {target} to the UI and flags a placeholder naming nothing', () => {
    expect(resolveText('Open {target}.', cat1)).toBe('Open {target}.');
    expect(lessonTextProblems({ ladder: 1, brief: '{line:nope}', objectives: [] }, cat1)).toEqual([
      "text: '{line:nope}' names nothing laid",
    ]);
  });

  it('reads generically where no appliance fills it', () => {
    expect(genericText('a {line:line-1} with a {tip:line-1} branch')).toBe(
      'a line with a suitable branch',
    );
  });

  it('gives the menu a brief for the appliance, filled in', () => {
    const brief = lessonBrief(getScenario('tank-attack'), LIGHT);
    expect(brief).toContain('25 mm line');
    expect(brief).not.toMatch(/\{/);
  });

  it('is filled in by the loader, every ladder lesson on every appliance', () => {
    for (const spec of [CAT1, LIGHT]) {
      const loaded = loadScenario(getScenario('tank-attack'), spec);
      const def = loaded.lesson?.def;
      expect(JSON.stringify(def)).not.toMatch(/\{(line|hose|tip|kpa|flow):/);
    }
  });
});

describe('flow as a fraction of working flow', () => {
  it('scales the target with the line laid', () => {
    const cond = { kind: 'flow', line: 'line-2', ofWorking: true, min: 0.5 } as const;
    const facts = noFacts('truck-1');
    for (const state of [
      createInitialState(CAT1, attachLines(CAT1, PLANS)),
      createInitialState(LIGHT, attachLines(LIGHT, PLANS)),
    ]) {
      const truck = state.trucks[0];
      const lay = state.lines.find((l) => l.id === 'line-2');
      if (truck === undefined || lay === undefined) throw new Error('no truck');
      const at = (q: number) => ({
        ...state,
        trucks: [
          {
            ...truck,
            readings: { ...truck.readings, branchFlowLpm: { [lay.id]: q } },
          },
        ],
      });
      const working = (2 / 3) * (lay.branch.tipMm ** 2 / 10) * Math.sqrt(350);
      expect(holds(cond, at(0.49 * working), facts)).toBe(false);
      expect(holds(cond, at(0.51 * working), facts)).toBe(true);
      expect(
        validateCondition(cond, state, 'truck-1', { objectives: [], events: [], coach: [] }),
      ).toEqual([]);
    }
  });
});
