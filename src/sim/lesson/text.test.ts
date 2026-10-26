import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { createInitialState } from '../engine';
import { attachLines, LIGHT_LINE, type PlannedLine } from '../scenarios/lay';
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
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20, light: LIGHT_LINE },
];

describe('line plans on a light tanker', () => {
  it('lays the planned hose where an outlet fits it, the light kit where none does', () => {
    const [, big] = attachLines(CAT1, PLANS);
    expect(big?.segments.map((x) => x.hose)).toEqual(['65L', '65L', '65L']);
    const [crew, light] = attachLines(LIGHT, PLANS);
    expect(crew?.segments).toHaveLength(3);
    expect(light?.segments.map((x) => x.hose)).toEqual(
      Array.from({ length: LIGHT_LINE.lengths }, () => LIGHT_LINE.hose),
    );
    expect(light?.branch.tipMm).toBe(LIGHT_LINE.tipMm);
  });

  it('keeps the planned hose (through an adaptor) when there is no light kit', () => {
    const [line] = attachLines(LIGHT, [{ id: 'x', hose: '65L', lengths: 1, tipMm: 20 }]);
    expect(line?.segments[0]?.hose).toBe('65L');
  });
});

describe('lesson copy', () => {
  const cat1 = createInitialState(CAT1, attachLines(CAT1, PLANS));
  const light = createInitialState(LIGHT, attachLines(LIGHT, PLANS));

  it('names what was laid', () => {
    const text =
      'Charge the {line:line-65} ({hose:line-65}, {tip:line-65} branch at {kpa:line-65}).';
    expect(resolveText(text, cat1)).toBe('Charge the 65 mm line (65 mm, 20 mm branch at 500 kPa).');
    expect(resolveText(text, light)).toBe(
      'Charge the 25 mm line (25 mm, 12 mm branch at 250 kPa).',
    );
  });

  it('gives a flow as a fraction of the line’s working flow, to 10 L/min', () => {
    // A 20 mm tip at 500 kPa: (2/3)·20²/10·√500 ≈ 596 L/min.
    expect(resolveText('{flow:line-65:1}', cat1)).toBe('600 L/min');
    expect(resolveText('{flow:line-65:0.5}', cat1)).toBe('300 L/min');
  });

  it('leaves {target} to the UI and flags a placeholder naming nothing', () => {
    expect(resolveText('Open {target}.', cat1)).toBe('Open {target}.');
    expect(lessonTextProblems({ ladder: 1, brief: '{line:nope}', objectives: [] }, cat1)).toEqual([
      "text: '{line:nope}' names nothing laid",
    ]);
  });

  it('reads generically where no appliance fills it', () => {
    expect(genericText('a {line:line-65} with a {tip:line-65} branch')).toBe(
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
    const cond = { kind: 'flow', line: 'line-65', ofWorking: true, min: 0.5 } as const;
    const facts = noFacts('truck-1');
    for (const state of [
      createInitialState(CAT1, attachLines(CAT1, PLANS)),
      createInitialState(LIGHT, attachLines(LIGHT, PLANS)),
    ]) {
      const truck = state.trucks[0];
      const lay = state.lines.find((l) => l.id === 'line-65');
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
      const working =
        (2 / 3) * (lay.branch.tipMm ** 2 / 10) * Math.sqrt(lay.branch.tipMm === 20 ? 500 : 250);
      expect(holds(cond, at(0.49 * working), facts)).toBe(false);
      expect(holds(cond, at(0.51 * working), facts)).toBe(true);
      expect(
        validateCondition(cond, state, 'truck-1', { objectives: [], events: [], coach: [] }),
      ).toEqual([]);
    }
  });
});
