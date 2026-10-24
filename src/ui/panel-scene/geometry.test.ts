import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import type { ApplianceSpec, HoseLine } from '../../sim/types';
import { TEST_APPLIANCE_SCENE_ART } from '../../testing/appliances/testApplianceScene';
import { getSceneArt } from '../appliances/registry';
import type { SceneArt } from '../appliances/types';
import { DEFAULT_UNITS_PER_M, layoutScene, SCENE_VIEW, SPRAY_REACH_U, toScene } from './geometry';
import { DAM, HYDRANT } from './site';

const PAIRS: [string, ApplianceSpec, SceneArt][] = [
  ...APPLIANCES.map((s): [string, ApplianceSpec, SceneArt] => [s.id, s, getSceneArt(s.id)]),
  [TEST_APPLIANCE.id, TEST_APPLIANCE, TEST_APPLIANCE_SCENE_ART],
];

/** The first point of an SVG path, 'M x y …'. */
function pathStart(d: string): { x: number; y: number } {
  const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d);
  if (m === null) throw new Error(`path has no move-to: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** The same lay with `lengths` 30 m lengths. */
function withLengths(line: HoseLine, lengths: number): HoseLine {
  const seg = line.segments[0] ?? { hose: '38L', lengthM: 30 };
  return { ...line, segments: Array.from({ length: lengths }, () => seg) };
}

const inside = (p: { x: number; y: number }, margin: number) =>
  p.x >= margin && p.x <= SCENE_VIEW.w - margin && p.y >= margin && p.y <= SCENE_VIEW.h - margin;

describe.each(PAIRS)('scene geometry: %s', (_id, spec, art) => {
  const lines = TANK_ATTACK.build(spec).state.lines;
  const scene = layoutScene(art, lines);

  it('places one coupling per delivery and one lay per line', () => {
    expect(
      scene.couplings
        .filter((c) => c.kind === 'delivery')
        .map((c) => c.control)
        .sort(),
    ).toEqual(spec.deliveries.map((d) => d.id).sort());
    expect(scene.lines.map((l) => l.lineId).sort()).toEqual(lines.map((l) => l.id).sort());
  });

  it('starts every lay at its delivery’s coupling', () => {
    for (const lay of scene.lines) {
      const coupling = scene.couplings.find(
        (c) => c.kind === 'delivery' && c.control === lay.deliveryId,
      );
      if (coupling === undefined) throw new Error(`no coupling for ${lay.deliveryId}`);
      const start = pathStart(lay.path);
      expect(start.x).toBeCloseTo(coupling.x, 1);
      expect(start.y).toBeCloseTo(coupling.y, 1);
    }
  });

  it('keeps every branch and its spray inside the view, at distinct points', () => {
    for (const lay of scene.lines) {
      expect(inside(lay.branch, 0)).toBe(true);
      const a = (lay.headingDeg * Math.PI) / 180;
      const sprayTip = {
        x: lay.branch.x + SPRAY_REACH_U * Math.cos(a),
        y: lay.branch.y + SPRAY_REACH_U * Math.sin(a),
      };
      expect(inside(sprayTip, 0)).toBe(true);
    }
    const ends = scene.lines.map((l) => `${l.branch.x.toFixed(0)},${l.branch.y.toFixed(0)}`);
    expect(new Set(ends).size).toBe(ends.length);
  });

  it('parks the truck clear of the dam', () => {
    // Walk the body outline in truck-local units; no point may fall in the dam (plus a bank).
    const BANK_U = 8;
    const hx = art.lengthU / 2;
    const hy = art.widthU / 2;
    const outline = Array.from({ length: 21 }, (_, i) => -1 + i / 10).flatMap((t) => [
      { x: t * hx, y: -hy },
      { x: t * hx, y: hy },
      { x: -hx, y: t * hy },
      { x: hx, y: t * hy },
    ]);
    const { x0, y0, x1, y1 } = DAM.box;
    for (const p of outline.map((local) => toScene(scene.truck, local))) {
      const inDam =
        p.x > x0 - BANK_U && p.x < x1 + BANK_U && p.y > y0 - BANK_U && p.y < y1 + BANK_U;
      expect(inDam, `body point ${p.x.toFixed(0)},${p.y.toFixed(0)}`).toBe(false);
    }
  });

  it('runs each supply hose from its inlet coupling to the dam or the hydrant', () => {
    const inletId = spec.inlets.find((i) => i.kind === 'suction')?.id ?? '';
    const withSupplies = layoutScene(art, lines, [
      { id: 'suction-hose', inletId, sourceKind: 'static' },
      { id: 'hydrant-line', inletId, sourceKind: 'hydrant' },
    ]);
    const coupling = withSupplies.couplings.find(
      (c) => c.kind === 'inlet' && c.control === inletId,
    );
    if (coupling === undefined) throw new Error('no inlet coupling');
    for (const s of withSupplies.supplies) {
      const start = pathStart(s.path);
      expect(start.x).toBeCloseTo(coupling.x, 0);
      expect(start.y).toBeCloseTo(coupling.y, 0);
      expect(inside(s.end, 0)).toBe(true);
    }
    const [dam, hydrant] = withSupplies.supplies;
    expect(dam?.end).toEqual(DAM.intake);
    expect(hydrant?.end).toEqual(HYDRANT);
    expect(DAM.intake.x).toBeGreaterThan(DAM.box.x0);
    expect(DAM.intake.x).toBeLessThan(DAM.box.x1);
    expect(DAM.intake.y).toBeGreaterThan(DAM.box.y0);
    expect(DAM.intake.y).toBeLessThan(DAM.box.y1);
  });

  it('is deterministic', () => {
    expect(layoutScene(art, lines)).toEqual(scene);
  });

  it('puts a longer lay’s branch further from the truck', () => {
    const [first] = lines;
    if (first === undefined) throw new Error('no line');
    const reach = (n: number) => {
      const lay = layoutScene(art, [withLengths(first, n)]).lines[0];
      if (lay === undefined) throw new Error('no lay');
      return Math.hypot(lay.branch.x - scene.truck.x, lay.branch.y - scene.truck.y);
    };
    expect(reach(4)).toBeGreaterThan(reach(2));
  });

  it('shrinks the map scale to keep a very long lay in view', () => {
    const [first] = lines;
    if (first === undefined) throw new Error('no line');
    const long = layoutScene(art, [withLengths(first, 20)]);
    expect(long.unitsPerM).toBeLessThan(DEFAULT_UNITS_PER_M);
    for (const lay of long.lines) expect(inside(lay.branch, 0)).toBe(true);
  });

  it('draws a scale bar of a round length at a readable size', () => {
    expect([5, 10, 20, 25, 50, 100, 200]).toContain(scene.scaleBarM);
    const u = scene.scaleBarM * scene.unitsPerM;
    expect(u).toBeGreaterThanOrEqual(40);
    expect(u).toBeLessThanOrEqual(160);
  });

  it('lays nothing when no line is laid', () => {
    expect(layoutScene(art, []).lines).toEqual([]);
  });
});
