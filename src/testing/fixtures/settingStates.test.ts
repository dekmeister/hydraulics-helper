import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { inletOfKind } from '../../sim/appliances/controls';
import { activeTruck, deliveryLines } from '../../state/selectors';
import { settingState } from './settingStates';

describe.each(APPLIANCES.map((s) => [s.id, s] as const))(
  'setting fixture states: %s',
  (_id, spec) => {
    it.each(['village', 'interface'] as const)(
      '%s has both crews charged and the hydrant filling the tank',
      (id) => {
        const s = settingState(spec, id);
        const laid = deliveryLines(s).filter((d) => d.state !== 'none');
        expect(laid).toHaveLength(2);
        for (const d of laid) {
          expect(d.state).toBe('charged');
          expect(d.branchFlowLpm).toBeGreaterThan(50);
        }
        const fill = inletOfKind(spec, 'tankFill');
        expect(activeTruck(s).readings.inletFlowLpm[fill]).toBeGreaterThan(0);
      },
    );
  },
);
