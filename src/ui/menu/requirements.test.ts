import { describe, expect, it } from 'vitest';
import { CAT1 } from '../../sim/appliances/cat1';
import { SCENARIOS } from '../../sim/scenarios';
import { supports } from '../../sim/scenarios/types';
import type { ApplianceSpec } from '../../sim/types';
import { missingCapabilities } from './requirements';

const BARE: ApplianceSpec = {
  ...CAT1,
  inlets: CAT1.inlets.filter((i) => i.kind === 'tank'),
  deliveries: CAT1.deliveries.slice(0, 1),
};

describe('missingCapabilities', () => {
  it('names nothing exactly when the scenario can be played', () => {
    for (const spec of [CAT1, BARE])
      for (const s of SCENARIOS)
        expect(missingCapabilities(s, spec).length === 0, `${s.id} on ${spec.id}`).toBe(
          supports(s, spec),
        );
  });

  it('names what is missing', () => {
    const draughting = SCENARIOS.find((s) => s.id === 'draughting');
    if (draughting === undefined) throw new Error('no draughting');
    expect(missingCapabilities(draughting, BARE)).toEqual(['a suction inlet', '2 deliveries']);
  });
});
