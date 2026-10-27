import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { activeTruck, deliveryLines } from '../../state/selectors';
import { LOW_TANK_FRACTION } from '../../state/tankLevel';
import { sceneState } from './panelStates';

describe.each([...APPLIANCES, TEST_APPLIANCE].map((s) => [s.id, s] as const))(
  'scene fixture states: %s',
  (_id, spec) => {
    const states = (id: Parameters<typeof sceneState>[1]) =>
      deliveryLines(sceneState(spec, id)).filter((d) => d.state !== 'none');

    it('all-charged charges every laid line', () => {
      expect(states('all-charged').map((d) => d.state)).toEqual(
        states('all-charged').map(() => 'charged'),
      );
    });

    it('one-line-off has the first line dry and every other line charged', () => {
      const first = sceneState(spec, 'one-line-off').lines[0]?.deliveryId;
      for (const d of states('one-line-off'))
        expect(d.state).toBe(d.deliveryId === first ? 'dry' : 'charged');
    });

    it('tank-low keeps every line charged on a tank under the low mark', () => {
      const s = sceneState(spec, 'tank-low');
      const t = activeTruck(s);
      expect(t.tankL).toBeGreaterThan(0);
      expect(t.tankL).toBeLessThanOrEqual(LOW_TANK_FRACTION * (spec.tank?.capacityL ?? 0));
      for (const d of deliveryLines(s)) if (d.state !== 'none') expect(d.state).toBe('charged');
    });

    it('tank-empty leaves water standing in level lines; a downhill line drains: nothing flows', () => {
      const s = sceneState(spec, 'tank-empty');
      for (const d of states('tank-empty')) {
        const downhill = (s.lines.find((l) => l.deliveryId === d.deliveryId)?.elevationM ?? 0) < 0;
        expect(d.state).toBe(downhill ? 'dry' : 'holding');
        expect(d.branchFlowLpm).toBe(0);
      }
    });

    it('line-filling has the first line half full and still charging, nothing at its branch', () => {
      const s = sceneState(spec, 'line-filling');
      const opened = s.lines[0]?.deliveryId;
      const first = states('line-filling').find((d) => d.deliveryId === opened);
      const rest = states('line-filling').filter((d) => d.deliveryId !== opened);
      expect(first?.state).toBe('filling');
      expect(first?.level).toBeGreaterThanOrEqual(0.5);
      expect(first?.level).toBeLessThan(0.75);
      expect(first?.branchFlowLpm).toBe(0);
      for (const d of rest) expect(d.state).toBe('dry');
      expect(activeTruck(s).readings.cavitation).toBe(0);
    });
  },
);
