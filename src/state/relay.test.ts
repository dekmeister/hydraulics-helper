// State for relays and several trucks (M5): switching trucks, relay selectors, SUPPLY lamp.
import { beforeEach, describe, expect, it } from 'vitest';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { HOSE_WORKING_KPA } from '../sim/constants';
import { getScenario } from '../sim/scenarios';
import { inputsWith, run, suctionInletOf, truck, withBigLines } from '../sim/testUtils';
import type { ApplianceSpec, PlayerInputs, SimState } from '../sim/types';
import { portableDams, relayLays, trucksOnScene } from './relay';
import { activeTruck, deliveryLines } from './selectors';
import { useStore } from './store';
import { supplyLays } from './supply';
import { selectWarnings } from './warnings';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

const supplyLamp = (sim: SimState, inputs: PlayerInputs) =>
  selectWarnings(sim, inputs).find((w) => w.id === 'supply');

describe('store: switching trucks', () => {
  beforeEach(() => {
    useStore.getState().loadScenario('closed-relay');
  });

  it('loads a relay scenario with the attack pump active and the base pump on scene', () => {
    const { sim } = useStore.getState();
    expect(sim.activeTruckId).toBe('attack');
    expect(trucksOnScene(sim).map((t) => [t.id, t.label, t.active])).toEqual([
      ['attack', 'Attack pump', true],
      ['base', 'Base pump', false],
    ]);
  });

  it('hands the player’s settings to the truck left, takes the other’s, and comes back to them', () => {
    const store = useStore.getState();
    const inlet = suctionInletOf(activeTruck(store.sim).spec);
    store.setValve(inlet, 1);
    store.setThrottle(0.4);
    store.toggleHighlight(activeTruck(store.sim).spec.deliveries[0]?.id ?? '', 'panel');
    store.step(5);
    store.setActiveTruck('base');
    let s = useStore.getState();
    expect(s.sim.activeTruckId).toBe('base');
    expect(s.inputs).toEqual(truck(s.sim, 'base').inputs);
    expect(s.inputs.throttle).toBeGreaterThan(0);
    expect(s.highlight).toBeNull();
    expect(s.wake).toEqual([]);
    // The attack pump keeps running on what it was left with.
    s.step(10);
    expect(truck(useStore.getState().sim, 'attack').inputs.throttle).toBe(0.4);

    useStore.getState().setThrottle(0.5);
    useStore.getState().setActiveTruck('attack');
    s = useStore.getState();
    expect(s.inputs.throttle).toBe(0.4);
    expect(s.inputs.valves[inlet]).toBe(1);
    expect(truck(s.sim, 'base').inputs.throttle).toBe(0.5);
  });

  it('keys the highlight by truck as well as delivery, and refuses an unknown truck', () => {
    const store = useStore.getState();
    const d = activeTruck(store.sim).spec.deliveries[0]?.id ?? '';
    store.toggleHighlight(d, 'scene');
    expect(useStore.getState().highlight).toEqual({
      truckId: 'attack',
      deliveryId: d,
      from: 'scene',
    });
    expect(() => {
      useStore.getState().setActiveTruck('ghost');
    }).toThrow(/no truck 'ghost'/);
  });

  it('builds the next scenario on the player’s appliance, not the support truck being operated', () => {
    const player = activeTruck(useStore.getState().sim).spec;
    const support = ALL.find((a) => a.id !== player.id);
    if (support === undefined) throw new Error('needs a second appliance');
    const s = getScenario('closed-relay').build(player, { base: support }).state;
    useStore.getState().reset(s, 'closed-relay');
    useStore.getState().setActiveTruck('base');
    expect(useStore.getState().playerSpec.id).toBe(player.id);
    useStore.getState().loadScenario('tank-attack');
    expect(activeTruck(useStore.getState().sim).spec.id).toBe(player.id);
  });
});

describe.each(ALL.map((spec) => [spec.id, spec] as const))('relay selectors: %s', (_id, spec) => {
  const closed = getScenario('closed-relay').build(spec).state;
  const suction = suctionInletOf(spec);
  const lines = closed.lines.map((l) => l.deliveryId);
  const attackInputs = (throttle: number) => inputsWith(throttle, [suction, ...lines]);

  it('describes the base pump’s relay delivery as a hose, charged once water flows', () => {
    const link = closed.links[0];
    if (link === undefined) throw new Error('no relay');
    const s = run(closed, attackInputs(0.4), 100);
    const row = deliveryLines(s, 'base').find((d) => d.deliveryId === link.deliveryId);
    expect(row?.relay?.id).toBe(link.id);
    expect(row?.state).toBe('charged');
    expect(row?.flowLpm).toBeGreaterThan(0);
    const [lay] = relayLays(s);
    expect(lay).toMatchObject({ kind: 'closed', state: 'charged', fromLabel: 'Base pump' });
    expect(lay?.toLabel).toBe('Attack pump');
    expect(lay?.reading.endKpa).toBeGreaterThan(0);
  });

  it('reads a closed relay charged once the base pump pressurises it, before water flows', () => {
    const s = run(closed, inputsWith(0, []), 50);
    const [lay] = relayLays(s);
    expect(lay?.reading.flowLpm).toBe(0);
    expect(lay?.reading.endKpa).toBeGreaterThan(0);
    expect(lay?.state).toBe('charged');
  });

  it('reads a relay soft when over-run and burst once a length goes', () => {
    const soft = run(withBigLines(closed), attackInputs(1), 100);
    expect(relayLays(soft)[0]?.state).toBe('soft');
    const burst: SimState = {
      ...closed,
      links: closed.links.map((l) => ({ ...l, burst: { atS: 0, segment: 3, peakKpa: 1400 } })),
    };
    expect(relayLays(burst)[0]?.state).toBe('burst');
  });

  it('draws a non-active truck’s supplies from its own held inputs', () => {
    const lays = supplyLays(closed, activeTruck(closed).inputs, 'base');
    expect(lays.map((l) => [l.supply.truckId, l.open, l.state])).toEqual([
      ['base', true, 'primed'],
    ]);
  });

  it('reports a portable dam’s water as a fraction of what it holds', () => {
    const open = getScenario('open-relay').build(spec).state;
    const [dam] = portableDams(open);
    expect(dam?.source.label).toBe('Portable dam');
    expect(dam?.fraction).toBeCloseTo(0.4, 6);
    expect(dam?.level).toBe('ok');
    expect(relayLays(open)[0]).toMatchObject({ kind: 'open', toLabel: 'Portable dam' });
  });

  describe('SUPPLY lamp on the receiving pump', () => {
    it('stays off with a good residual', () => {
      const s = run(closed, attackInputs(0.3), 100);
      expect(truck(s, 'attack').readings.compoundKpa).toBeGreaterThan(100);
      expect(supplyLamp(s, attackInputs(0.3))?.level).toBe('off');
    });

    it('warns when the residual falls under 100 kPa', () => {
      const s = run(closed, attackInputs(1), 100);
      const w = supplyLamp(s, attackInputs(1));
      expect(w?.level).toBe('caution');
      expect(w?.message).toMatch(/residual/i);
      expect(w?.message).toMatch(/100 kPa/);
      expect(w?.message).toMatch(/base pump/);
    });

    it('warns when the relay pressure climbs past the hose’s working pressure', () => {
      const shutLines = inputsWith(0.3, [suction]);
      const s = run(closed, shutLines, 50);
      const end = s.linkReadings.relay?.endKpa ?? 0;
      const w = supplyLamp(s, shutLines);
      if (end > HOSE_WORKING_KPA) {
        expect(w?.level).toBe('caution');
        expect(w?.message).toMatch(/pressure high/i);
      } else {
        expect(w?.level).toBe('off');
      }
      const forced: SimState = {
        ...s,
        linkReadings: { relay: { flowLpm: 0, startKpa: 1200, endKpa: 1050, collapsed: false } },
      };
      expect(supplyLamp(forced, shutLines)?.message).toMatch(/pressure high/i);
    });

    it('raises an alarm when the relay hose has burst, whatever is open', () => {
      const burst: SimState = {
        ...closed,
        links: closed.links.map((l) => ({ ...l, burst: { atS: 0, segment: 3, peakKpa: 1400 } })),
      };
      const w = supplyLamp(run(burst, inputsWith(0, []), 1), inputsWith(0, []));
      expect(w?.level).toBe('alarm');
      expect(w?.message).toMatch(/burst/i);
    });

    it('says when no water comes down the relay', () => {
      const dry: SimState = {
        ...closed,
        trucks: closed.trucks.map((t) =>
          t.id === 'base'
            ? {
                ...t,
                inputs: {
                  ...t.inputs,
                  valves: { ...t.inputs.valves, [closed.links[0]?.deliveryId ?? '']: 0 },
                },
              }
            : t,
        ),
      };
      const s = run(dry, attackInputs(0.3), 20);
      const w = supplyLamp(s, attackInputs(0.3));
      expect(w?.level).toBe('caution');
      expect(w?.message).toMatch(/no water from the relay/i);
    });
  });
});
