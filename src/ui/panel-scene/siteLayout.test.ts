import { describe, expect, it } from 'vitest';
import { CAT1 } from '../../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { getScenario } from '../../sim/scenarios';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import type { ApplianceSpec, SimState } from '../../sim/types';
import { TEST_APPLIANCE_SCENE_ART } from '../../testing/appliances/testApplianceScene';
import { getSceneArt } from '../appliances/registry';
import type { SceneArt } from '../appliances/types';
import { layoutScene, SCENE_VIEW, SPRAY_REACH_U } from './geometry';
import { DAM, FIRE_FRONT_AT, TRUCK_AT } from './site';
import { layoutSite, siteInput, type SiteGeometry } from './siteLayout';

const artFor = (id: string): SceneArt =>
  id === TEST_APPLIANCE.id ? TEST_APPLIANCE_SCENE_ART : getSceneArt(id);

const layout = (sim: SimState): SiteGeometry => layoutSite(siteInput(sim, artFor));

const pathStart = (d: string) => {
  const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d);
  if (m === null) throw new Error(`no move-to: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
};
const pathEnd = (d: string) => {
  const m = /(-?[\d.]+)[ ,](-?[\d.]+)\s*$/.exec(d);
  if (m === null) throw new Error(`no end: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const truckOf = (g: SiteGeometry, id: string) => {
  const t = g.trucks.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no truck ${id}`);
  return t;
};

const PAIRS = [
  [CAT1, CAT1],
  [CAT1, TEST_APPLIANCE],
  [TEST_APPLIANCE, CAT1],
] as const;

describe('one truck', () => {
  it('lays out exactly as the single-truck scene', () => {
    const sim = TANK_ATTACK.build(CAT1).state;
    const site = layout(sim);
    const single = layoutScene(getSceneArt(CAT1.id), sim.lines);
    expect(site.trucks).toHaveLength(1);
    expect(site.trucks[0]?.pose).toEqual(single.truck);
    expect(site.trucks[0]?.lines).toEqual(single.lines);
    expect(site.unitsPerM).toBe(single.unitsPerM);
    expect(site.relays).toEqual([]);
  });
});

describe.each(PAIRS.map(([p, b]) => [`${p.id} with base ${b.id}`, p, b] as const))(
  'relay scenes: %s',
  (_name, player: ApplianceSpec, base: ApplianceSpec) => {
    for (const id of ['closed-relay', 'open-relay'] as const) {
      const sim = getScenario(id).build(player, { base }).state;
      const g = layout(sim);
      const attack = truckOf(g, 'attack');
      const supplier = truckOf(g, 'base');

      it(`${id}: puts the base pump at the water and the attack pump nearer the fire`, () => {
        expect(supplier.pose.x).toBe(TRUCK_AT.x);
        expect(supplier.pose.y).toBe(TRUCK_AT.y);
        expect(dist(attack.pose, FIRE_FRONT_AT)).toBeLessThan(dist(supplier.pose, FIRE_FRONT_AT));
        // Map symbols, larger than scale, but never on top of each other or in the dam.
        expect(dist(attack.pose, supplier.pose)).toBeGreaterThan(150);
        for (const t of g.trucks) {
          expect(
            t.pose.x < DAM.box.x0 - 40 || t.pose.x > DAM.box.x1 + 40 || t.pose.y < DAM.box.y0 - 40,
          ).toBe(true);
        }
      });

      it(`${id}: keeps every branch and its spray inside the view`, () => {
        for (const t of g.trucks)
          for (const lay of t.lines) {
            const tip = {
              x: lay.branch.x + SPRAY_REACH_U * Math.cos((lay.headingDeg * Math.PI) / 180),
              y: lay.branch.y + SPRAY_REACH_U * Math.sin((lay.headingDeg * Math.PI) / 180),
            };
            for (const p of [lay.branch, tip]) {
              expect(p.x).toBeGreaterThanOrEqual(0);
              expect(p.x).toBeLessThanOrEqual(SCENE_VIEW.w);
              expect(p.y).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(SCENE_VIEW.h);
            }
          }
      });

      it(`${id}: runs the relay from the base pump’s delivery coupling`, () => {
        const link = sim.links[0];
        const relay = g.relays[0];
        if (link === undefined || relay === undefined) throw new Error('no relay');
        const coupling = supplier.couplings.find(
          (c) => c.kind === 'delivery' && c.control === link.deliveryId,
        );
        if (coupling === undefined) throw new Error('no coupling');
        expect(pathStart(relay.path).x).toBeCloseTo(coupling.x, 1);
        expect(pathStart(relay.path).y).toBeCloseTo(coupling.y, 1);
      });

      it(`${id}: is deterministic`, () => {
        expect(layout(sim)).toEqual(g);
      });
    }

    it('closed-relay: ends the relay at the attack pump’s inlet coupling', () => {
      const sim = getScenario('closed-relay').build(player, { base }).state;
      const g = layout(sim);
      const link = sim.links[0];
      if (link?.to.kind !== 'inlet') throw new Error('not a closed relay');
      const inletId = link.to.inletId;
      const inlet = truckOf(g, 'attack').couplings.find(
        (c) => c.kind === 'inlet' && c.control === inletId,
      );
      if (inlet === undefined) throw new Error('no inlet coupling');
      const end = pathEnd(g.relays[0]?.path ?? '');
      expect(end.x).toBeCloseTo(inlet.x, 1);
      expect(end.y).toBeCloseTo(inlet.y, 1);
    });

    it('open-relay: pitches the portable dam by the attack pump, its suction and the relay ending in it', () => {
      const sim = getScenario('open-relay').build(player, { base }).state;
      const g = layout(sim);
      const [dam] = g.dams;
      if (dam === undefined) throw new Error('no portable dam drawn');
      expect(dist(dam, truckOf(g, 'attack').pose)).toBeLessThan(120);
      const suction = truckOf(g, 'attack').supplies[0];
      expect(suction?.end).toEqual({ x: dam.x, y: dam.y });
      expect(dist(pathEnd(g.relays[0]?.path ?? ''), dam)).toBeLessThanOrEqual(dam.r + 0.1);
      expect(dam.x - dam.r).toBeGreaterThanOrEqual(0);
      expect(dam.y + dam.r).toBeLessThanOrEqual(SCENE_VIEW.h);
    });

    it('marks a burst length on the relay path', () => {
      const built = getScenario('closed-relay').build(player, { base }).state;
      const sim: SimState = {
        ...built,
        links: built.links.map((l) => ({ ...l, burst: { atS: 0, segment: 0, peakKpa: 1400 } })),
      };
      const relay = layout(sim).relays[0];
      if (relay?.burst === undefined) throw new Error('no burst marked');
      const { at, headingDeg } = relay.burst;
      const start = pathStart(relay.path);
      const end = pathEnd(relay.path);
      // The first of four lengths: nearer the supplying end.
      expect(dist(at, start)).toBeLessThan(dist(at, end));
      // The heading runs along the hose, towards its far end (the gush is thrown square to it).
      const step = (sign: number) => ({
        x: at.x + sign * 5 * Math.cos((headingDeg * Math.PI) / 180),
        y: at.y + sign * 5 * Math.sin((headingDeg * Math.PI) / 180),
      });
      expect(dist(step(1), end)).toBeLessThan(dist(step(-1), end));
    });
  },
);
