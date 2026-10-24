import { createInitialState } from '../engine';
import { attachLines, inletOfKind, twoLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * The 38 mm line first, then a 65 mm line: the friction contrast and the pump-droop sag when the
 * second line opens. Tips from Table 1: 15 mm (350 kPa, ~280 L/min) and 20 mm (500 kPa, ~600 L/min).
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20 },
];

export const TANK_ATTACK: Scenario = {
  id: 'tank-attack',
  title: 'Tank attack: 38 mm line, then a 65 mm line',
  requires: { tank: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const tankInlet = inletOfKind(spec, 'tank', 'tank-attack');
    const [a, b] = twoLines(lines, 'tank-attack');
    return {
      state: createInitialState(spec, lines),
      script: [
        { tS: 0, valves: { [tankInlet]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 0.8 },
      ],
      durationS: 300,
    };
  },
};
