import { describe, expect, it } from 'vitest';
import { rotate } from '../../sim/testUtils';
import { CAT1 } from '../../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { relayLays, portableDams } from '../../state/relay';
import { activeTruck, burstRelayInto, selectWarnings } from '../../state/selectors';
import { spillPoolSize } from '../../state/spill';
import type { SimState } from '../../sim/types';
import { burstGushScale } from '../../ui/panel-scene/burstGush';
import { relayState } from './relayStates';

const lit = (s: SimState) =>
  Object.fromEntries(
    selectWarnings(s, activeTruck(s).inputs)
      .filter((w) => w.level !== 'off')
      .map((w) => [w.id, w.level]),
  );

// The captions in catalog.ts promise these; a re-tuned placeholder that breaks one fails here.
describe.each(
  rotate(
    [
      [CAT1, CAT1],
      [CAT1, TEST_APPLIANCE],
      [TEST_APPLIANCE, CAT1],
    ],
    0,
  ).map(([p, b]) => [`${p?.id ?? ''} with base ${b?.id ?? ''}`, p ?? CAT1, b ?? CAT1] as const),
)('relay fixture states: %s', (_name, spec, base) => {
  const support = { base };

  it('closed-working: charged relay, residual over 100 kPa, nothing lit', () => {
    const s = relayState(spec, 'closed-working', support);
    expect(s.activeTruckId).toBe('attack');
    expect(relayLays(s)[0]?.state).toBe('charged');
    expect(activeTruck(s).readings.compoundKpa).toBeGreaterThan(100);
    expect(lit(s)).toEqual({});
  });

  it('closed-over-run: soft relay, supply caution and cavitation', () => {
    const s = relayState(spec, 'closed-over-run', support);
    expect(relayLays(s)[0]?.state).toBe('soft');
    expect(lit(s).supply).toBe('caution');
    expect(lit(s).cavitation).toBeDefined();
  });

  it('burst: the first length gone, water gushing out of it, the supply alarm lit', () => {
    const s = relayState(spec, 'burst', support);
    expect(s.links[0]?.burst?.segment).toBe(0);
    expect(burstGushScale(relayLays(s)[0]?.reading.flowLpm ?? 0)).toBeGreaterThan(0);
    expect(lit(s).supply).toBe('alarm');
    // Fixtures load without a lesson: free play offers the repair.
    expect(burstRelayInto(s)?.id).toBe('relay');
  });

  it('open-dam: primed on a portable dam the relay fills, nothing lit', () => {
    const s = relayState(spec, 'open-dam', support);
    expect(activeTruck(s).pump.primed).toBe(true);
    expect(relayLays(s)[0]?.state).toBe('charged');
    expect(portableDams(s)[0]?.level).toBe('ok');
    expect(lit(s)).toEqual({});
  });

  it('dam-overflowing: the dam full, the relay still running in, a pool round the dam', () => {
    const s = relayState(spec, 'dam-overflowing', support);
    const dam = portableDams(s)[0];
    expect(dam?.fraction).toBe(1);
    expect(relayLays(s)[0]?.state).toBe('charged');
    expect(spillPoolSize(dam?.source.spilledL ?? 0)).toBeDefined();
  });

  it('base-panel: the base pump operated, primed and delivering into the relay', () => {
    const s = relayState(spec, 'base-panel', support);
    expect(s.activeTruckId).toBe('base');
    expect(activeTruck(s).pump.primed).toBe(true);
    expect(relayLays(s)[0]?.state).toBe('charged');
    expect(lit(s)).toEqual({});
  });
});

// Free play's fixture (catalog.ts caption): both trucks working, the monitor flowing, nothing lit.
describe.each(rotate(APPLIANCES, 0).map((spec) => [spec.id, spec] as const))(
  'free-play fixture state: %s',
  (_id, spec) => {
    it('relay charged with residual to spare, base primed, every line flowing, nothing lit', () => {
      const s = relayState(spec, 'free-play');
      expect(s.activeTruckId).toBe('attack');
      expect(relayLays(s)[0]?.state).toBe('charged');
      expect(activeTruck(s).readings.compoundKpa).toBeGreaterThan(100);
      expect(s.trucks.find((t) => t.id === 'base')?.pump.primed).toBe(true);
      for (const l of s.lines) {
        const flow = s.trucks.find((t) => t.id === l.truckId)?.readings.branchFlowLpm[l.id] ?? 0;
        expect(flow).toBeGreaterThan(50);
      }
      expect(lit(s)).toEqual({});
    });
  },
);
