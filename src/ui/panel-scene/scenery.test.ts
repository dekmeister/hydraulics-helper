// The village and interface houses (issue #10) never sit under a truck, the hydrant, a hose or a
// crew: every fireground drawn on those backdrops, on every appliance, with every hose its lesson
// lays or moves.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { applyEffect } from '../../sim/lesson/effects';
import { eligibleAppliances, SCENARIOS } from '../../sim/scenarios';
import type { SimState } from '../../sim/types';
import { TEST_APPLIANCE_SCENE_ART } from '../../testing/appliances/testApplianceScene';
import { getSceneArt } from '../appliances/registry';
import { cubicAt } from './cubic';
import { SPRAY_REACH_U, toScene, type Point } from './geometry';
import { BURNING, HYDRANT, INTERFACE_LOTS, lotCorners, VILLAGE_LOTS, type Lot } from './site';
import { layoutSite, siteInput } from './siteLayout';

const artFor = (id: string) =>
  id === TEST_APPLIANCE.id ? TEST_APPLIANCE_SCENE_ART : getSceneArt(id);

/** Whether `p` is inside the convex polygon `poly` (corners in order). */
function inside(p: Point, poly: readonly Point[]): boolean {
  const sides = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length] ?? a;
    return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  });
  return sides.every((s) => s >= 0) || sides.every((s) => s <= 0);
}

/** The fireground once every lesson effect has fired: the lays the crews end up on. */
function finalSite(state: SimState, effects: Parameters<typeof applyEffect>[2][]): SimState {
  return effects.reduce((s, e) => applyEffect(s, s.activeTruckId, e), state);
}

/** Points the scenery must keep clear of: bodies, hoses, the hydrant, branches and their sprays. */
function occupied(state: SimState, sprays: boolean): { what: string; p: Point }[] {
  const site = layoutSite(siteInput(state, artFor));
  const ts = Array.from({ length: 21 }, (_, i) => i / 20);
  return site.trucks.flatMap((t) => {
    const art = artFor(state.trucks.find((x) => x.id === t.id)?.spec.id ?? '');
    const hx = art.lengthU / 2;
    const hy = art.widthU / 2;
    const body = ts.flatMap((f) =>
      [
        { x: (2 * f - 1) * hx, y: -hy },
        { x: (2 * f - 1) * hx, y: hy },
        { x: -hx, y: (2 * f - 1) * hy },
        { x: hx, y: (2 * f - 1) * hy },
      ].map((local) => ({ what: `${t.id} body`, p: toScene(t.pose, local) })),
    );
    const lays = t.lines.flatMap((l) => [
      ...ts.map((f) => ({ what: `${l.lineId} hose`, p: cubicAt(l.curve, f) })),
      ...(sprays
        ? [
            {
              what: `${l.lineId} spray`,
              p: {
                x: l.branch.x + SPRAY_REACH_U * Math.cos((l.headingDeg * Math.PI) / 180),
                y: l.branch.y + SPRAY_REACH_U * Math.sin((l.headingDeg * Math.PI) / 180),
              },
            },
          ]
        : []),
    ]);
    const supplies = t.supplies.flatMap((s) =>
      ts.map((f) => ({ what: `${s.supplyId} hose`, p: cubicAt(s.curve, f) })),
    );
    return [...body, ...lays, ...supplies, { what: 'hydrant', p: HYDRANT }];
  });
}

const BURNING_LOT: Lot = { ...BURNING, roof: 'iron' };

describe.each(
  SCENARIOS.filter((s) => s.setting !== 'bush').map((s) => [s.id, s.setting, s] as const),
)('scenery on %s (%s)', (_id, setting, scenario) => {
  const effects = (scenario.lesson?.events ?? []).flatMap((e) => e.effects ?? []);
  const specs = eligibleAppliances(scenario, [...APPLIANCES, TEST_APPLIANCE]);

  it.each(specs.map((s) => [s.id, s] as const))('keeps the houses clear, on %s', (_s, spec) => {
    const start = scenario.build(spec).state;
    const lots = setting === 'village' ? VILLAGE_LOTS : INTERFACE_LOTS;
    for (const state of [start, finalSite(start, effects)]) {
      const points = occupied(state, true);
      for (const lot of lots) {
        const yard = lotCorners(lot);
        for (const { what, p } of points)
          expect(inside(p, yard), `${what} at ${p.x.toFixed(0)},${p.y.toFixed(0)} in a yard`).toBe(
            false,
          );
      }
      // The crews' streams may reach the burning house; nothing else may stand on it.
      if (setting === 'village') {
        const walls = lotCorners(BURNING_LOT, 0);
        for (const { what, p } of occupied(state, false))
          expect(inside(p, walls), `${what} in the burning house`).toBe(false);
      }
    }
  });
});
