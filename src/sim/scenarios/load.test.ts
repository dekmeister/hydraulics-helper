import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { FIRST_LINE } from './firstLine';
import { HYDRANT_SUPPLY } from './hydrantSupply';
import { loadScenario } from './load';
import { supports, type Scenario } from './types';

describe('loadScenario', () => {
  it('builds the run and starts the lesson on the player’s truck', () => {
    const loaded = loadScenario(FIRST_LINE, CAT1);
    expect(loaded.lesson?.progress.playerTruckId).toBe(loaded.run.state.activeTruckId);
    expect(loaded.lesson?.progress.status).toBe('running');
  });

  it('rejects an appliance without a capability the scenario needs', () => {
    const noSuction = { ...CAT1, inlets: CAT1.inlets.filter((i) => i.kind !== 'suction') };
    expect(() => loadScenario(HYDRANT_SUPPLY, noSuction)).toThrow(/can’t play/);
  });

  it('honours a scenario tied to named appliances', () => {
    const cat1Only: Scenario = {
      ...FIRST_LINE,
      requires: { ...FIRST_LINE.requires, appliances: [CAT1.id] },
    };
    expect(supports(cat1Only, CAT1)).toBe(true);
    expect(supports(cat1Only, TEST_APPLIANCE)).toBe(false);
    expect(() => loadScenario(cat1Only, TEST_APPLIANCE)).toThrow(/can’t play/);
  });

  it('rejects a lesson that names what the fireground doesn’t have, listing every problem', () => {
    const broken: Scenario = {
      ...FIRST_LINE,
      lesson: {
        ladder: 1,
        brief: '',
        objectives: [
          { id: 'a', text: '', when: { kind: 'branch', line: 'nope' } },
          { id: 'b', text: '', when: { kind: 'source', source: 'dam' } },
        ],
      },
    };
    expect(() => loadScenario(broken, CAT1)).toThrow(/no line 'nope'.*no static source 'dam'/);
  });
});
