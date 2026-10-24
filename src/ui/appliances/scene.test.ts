// Scene art ↔ spec consistency (ARCHITECTURE §9.4, docs/TESTING.md layer 4): one coupling per
// spec delivery and suction inlet, nothing the spec lacks, and every coupling drawn on the truck body.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import type { ApplianceSpec } from '../../sim/types';
import { TEST_APPLIANCE_SCENE_ART } from '../../testing/appliances/testApplianceScene';
import { CATALOGUE_SCENE_ART, getSceneArt } from './registry';
import type { SceneArt } from './types';

const PAIRS: [string, ApplianceSpec, SceneArt][] = [
  ...APPLIANCES.map((s): [string, ApplianceSpec, SceneArt] => [s.id, s, getSceneArt(s.id)]),
  [TEST_APPLIANCE.id, TEST_APPLIANCE, TEST_APPLIANCE_SCENE_ART],
];

describe('scene art registry', () => {
  it('has exactly one scene art per catalogue appliance', () => {
    expect(CATALOGUE_SCENE_ART.map((a) => a.applianceId).sort()).toEqual(
      APPLIANCES.map((a) => a.id).sort(),
    );
  });
});

describe.each(PAIRS)('scene art ↔ spec: %s', (_id, spec, art) => {
  it('belongs to its appliance', () => {
    expect(art.applianceId).toBe(spec.id);
  });

  it('has one coupling per delivery and per suction inlet, and nothing else', () => {
    const of = (kind: 'delivery' | 'inlet') =>
      art.couplings
        .filter((c) => c.kind === kind)
        .map((c) => c.control)
        .sort();
    expect(of('delivery')).toEqual(spec.deliveries.map((d) => d.id).sort());
    expect(of('inlet')).toEqual(
      spec.inlets
        .filter((i) => i.kind === 'suction')
        .map((i) => i.id)
        .sort(),
    );
  });

  it('puts every coupling on the body, at distinct points', () => {
    for (const c of art.couplings) {
      expect(Math.abs(c.x)).toBeLessThanOrEqual(art.lengthU / 2);
      expect(Math.abs(c.y)).toBeLessThanOrEqual(art.widthU / 2);
    }
    const points = art.couplings.map((c) => `${String(c.x)},${String(c.y)}`);
    expect(new Set(points).size).toBe(points.length);
  });

  it('fits the cab inside the body', () => {
    expect(art.cabU).toBeGreaterThan(0);
    expect(art.cabU).toBeLessThan(art.lengthU / 2);
  });
});
