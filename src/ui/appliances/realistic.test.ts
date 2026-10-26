// Realistic layout ↔ spec and simplified layout (ARCHITECTURE §9.4): the realistic view places
// exactly what the simplified panel does (bar the warning strip, which it draws once under the
// plates), so both views name the same controls; and on a 375 px phone every control is a thumb
// target that overlaps no other.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import type { InstrumentKind } from '../../sim/types';
import {
  interactiveBoxes,
  itemBox,
  LEVER_ART,
  leverArtBox,
  PLATE_ROW_GAP_PX,
  plateRows,
  plateWidthsPx,
} from '../panel-real/geometry';
import type { DialId } from '../panel-pump/gauge/dials';
import { itemKey, realItemKey } from './itemKey';
import type { RBox, RealPlate } from './realistic';
import { CATALOGUE_REALISTIC, getPanelLayout, getRealisticLayout } from './registry';

/** Width the pump panel's content gets on a 375 px phone, CSS px (page and card padding off). */
const PHONE_PANEL_PX = 320;
const TOUCH_MIN_PX = 44;

const DIAL_KIND: Readonly<Record<DialId, InstrumentKind>> = {
  discharge: 'discharge',
  compound: 'compound',
  tacho: 'tacho',
};

const intersects = (a: RBox, b: RBox) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Whether a disc of radius `r` about (x, y) lies wholly inside `box`. */
const holdsDisc = (box: RBox, x: number, y: number, r: number) =>
  x - r >= box.x && y - r >= box.y && x + r <= box.x + box.w && y + r <= box.y + box.h;

/** A point drawn at (dx, dy) from the pivot in the lever's own frame (pointing up), turned `deg` clockwise. */
const turned = (pivot: { x: number; y: number }, dx: number, dy: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return {
    x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
};

describe('realistic layout registry', () => {
  it('registers layouts only for catalogue appliances, one each', () => {
    const ids = CATALOGUE_REALISTIC.map((l) => l.applianceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(APPLIANCES.map((a) => a.id)).toContain(id);
    for (const l of CATALOGUE_REALISTIC) expect(getRealisticLayout(l.applianceId)).toBe(l);
  });
});

describe('plate rows', () => {
  const plate = (id: string, place: RealPlate['place'], w: number, h: number): RealPlate => ({
    id,
    caption: null,
    viewBox: { w, h },
    place,
    art: [],
    items: [],
  });
  const plates = [
    plate('panel', 'stack', 1000, 800),
    plate('tank', 'beside', 200, 800),
    plate('bay', 'stack', 1000, 700),
    plate('a', 'inset', 300, 300),
    plate('b', 'inset', 100, 300),
  ];

  it('groups each stacked plate with the plates beside it', () => {
    expect(plateRows(plates).map((r) => r.map((p) => p.id))).toEqual([['panel', 'tank'], ['bay']]);
  });

  it('draws a row at one height, filling the width bar the gaps', () => {
    const widths = plateWidthsPx(plates, 320);
    const w = (id: string) => widths.get(id) ?? NaN;
    expect(w('panel') + w('tank') + PLATE_ROW_GAP_PX).toBeCloseTo(320, 6);
    expect((w('panel') * 800) / 1000).toBeCloseTo((w('tank') * 800) / 200, 6);
    expect(w('bay')).toBe(320);
    expect(w('a') + w('b') + PLATE_ROW_GAP_PX).toBeCloseTo(320, 6);
    expect(w('a') / w('b')).toBeCloseTo(3, 6);
  });
});

describe.each(CATALOGUE_REALISTIC.map((l) => [l.applianceId, l] as const))(
  'realistic layout: %s',
  (id, layout) => {
    const spec = APPLIANCES.find((a) => a.id === id);
    if (spec === undefined) throw new Error(`no appliance '${id}'`);
    const items = layout.plates.flatMap((p) => p.items);

    it('draws the throttle and primer the spec has: a speed switch, a vernier, a hand pump', () => {
      for (const i of items) {
        if (i.kind === 'throttle' && i.variant === 'speed-switch')
          expect(spec.engine.speedController).toBeDefined();
        if (i.kind === 'throttle' && i.variant === 'vernier')
          expect(spec.engine.vernier).toBeDefined();
        if (i.kind === 'primer')
          expect(spec.primer?.kind).toBe(i.variant === 'hand-pump' ? 'diaphragm' : 'rotaryVane');
      }
    });

    it('puts beside plates after a main plate, and insets last', () => {
      const places = layout.plates.map((p) => p.place);
      expect(places[0]).toBe('stack');
      const firstInset = places.indexOf('inset');
      if (firstInset >= 0) expect(places.slice(firstInset).every((p) => p === 'inset')).toBe(true);
    });

    it('draws each beside plate as tall as the plate it stands beside', () => {
      for (const row of plateRows(layout.plates)) {
        const [main, ...beside] = row;
        for (const p of beside) expect(p.viewBox.h).toBe(main?.viewBox.h);
      }
    });

    it("shows the tank's level beside the instrument panel, where it is watched", () => {
      const [panelRow] = plateRows(layout.plates);
      const beside = (panelRow ?? []).slice(1);
      expect(beside.some((p) => p.items.some((i) => i.kind === 'tank-gauge'))).toBe(true);
    });

    it('places what the simplified panel places, each exactly once', () => {
      const simplified = getPanelLayout(id)
        .sections.flatMap((s) => s.items)
        .map(itemKey)
        // The realistic panel shows the engine's state on its lamps and the ignition's description.
        .filter((k) => k !== 'warnings' && k !== 'engine-status');
      const placed = items.flatMap((i) => {
        const k = realItemKey(i);
        return k === null ? [] : [k];
      });
      expect([...placed].sort()).toEqual([...simplified].sort());
    });

    it('puts each instrument on a face that can show it, and deliveries on outlets', () => {
      const kinds = new Map(spec.instruments.map((x) => [x.id, x.kind]));
      const deliveries = new Set(spec.deliveries.map((d) => d.id));
      for (const i of items) {
        if (i.kind === 'gauge') expect(kinds.get(i.instrument)).toBe(DIAL_KIND[i.dial]);
        if (i.kind === 'tank-gauge') expect(kinds.get(i.instrument)).toBe('tank');
        if (i.kind === 'outlet') expect(deliveries.has(i.control)).toBe(true);
        if (i.kind === 'lever') expect(deliveries.has(i.control)).toBe(false);
        if (i.kind === 'lever' || i.kind === 'outlet')
          expect(Math.abs(i.openDeg - i.shutDeg)).toBe(90);
      }
    });

    it("names only the spec's own inlets and outlets in its pipework's water", () => {
      const inlets = new Set(spec.inlets.map((i) => i.id));
      const outlets = new Set([
        ...spec.deliveries.map((d) => d.id),
        ...(spec.pumpToTank === undefined ? [] : [spec.pumpToTank.id]),
      ]);
      const refs = layout.plates.flatMap((p) =>
        p.art.flatMap((a) =>
          (a.kind === 'pipe' || a.kind === 'casing') && a.water !== undefined ? [a.water] : [],
        ),
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        if (ref.at === 'inlet') expect(inlets.has(ref.id)).toBe(true);
        if (ref.at === 'delivery') expect(spec.deliveries.map((d) => d.id)).toContain(ref.id);
        if (ref.at === 'casing')
          for (const id of ref.feeds ?? []) expect(outlets.has(id)).toBe(true);
        if (ref.at === 'pumpToTank') expect(spec.pumpToTank).toBeDefined();
        if (ref.at === 'tank') expect(spec.inlets.some((i) => i.kind === 'tank')).toBe(true);
      }
    });

    it('keeps every item on its plate, with unique plate and inert ids', () => {
      const plates = layout.plates.map((p) => p.id);
      expect(new Set(plates).size).toBe(plates.length);
      const inert = items.flatMap((i) => (i.kind === 'inert' ? [i.id] : []));
      expect(new Set(inert).size).toBe(inert.length);
      for (const plate of layout.plates) {
        for (const item of plate.items) {
          const boxes = [itemBox(item), ...interactiveBoxes(item).map((b) => b.box)];
          for (const b of boxes) {
            expect(b.x, plate.id).toBeGreaterThanOrEqual(0);
            expect(b.y, plate.id).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w, plate.id).toBeLessThanOrEqual(plate.viewBox.w);
            expect(b.y + b.h, plate.id).toBeLessThanOrEqual(plate.viewBox.h);
          }
        }
      }
    });

    it('bounds each lever drawing: pivot boss, grip and drag shadow, shut and open', () => {
      const a = LEVER_ART;
      const gripR = a.gripHalfW + a.gripStrokeW / 2;
      for (const i of items) {
        if (i.kind !== 'lever' && i.kind !== 'outlet') continue;
        const box = leverArtBox(i);
        const L = i.lengthU;
        expect(holdsDisc(box, i.pivot.x, i.pivot.y, a.pivotR), `${i.control} pivot`).toBe(true);
        for (const deg of [i.shutDeg, i.openDeg]) {
          // The grip is a stadium: its round end, and both sides where it starts down the shank.
          const discs = [
            { ...turned(i.pivot, 0, -(L - a.gripHalfW), deg), r: gripR },
            { ...turned(i.pivot, gripR, -L * (1 - a.gripLengthFrac), deg), r: 0 },
            { ...turned(i.pivot, -gripR, -L * (1 - a.gripLengthFrac), deg), r: 0 },
            {
              ...turned(i.pivot, a.dragLift.x, -(L - a.dragLift.y - a.shadowHalfW), deg),
              r: a.shadowHalfW,
            },
          ];
          for (const d of discs)
            expect(holdsDisc(box, d.x, d.y, d.r), `${i.control} grip at ${String(deg)}°`).toBe(
              true,
            );
        }
      }
    });

    it('gives every control a 44 px target on a phone, overlapping no other', () => {
      const widths = plateWidthsPx(layout.plates, PHONE_PANEL_PX);
      for (const plate of layout.plates) {
        const scale = (widths.get(plate.id) ?? 0) / plate.viewBox.w;
        const boxes = plate.items.flatMap(interactiveBoxes);
        for (const { name, box } of boxes) {
          expect(box.w * scale, `${name} width`).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
          expect(box.h * scale, `${name} height`).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
        }
        boxes.forEach((a, i) => {
          for (const b of boxes.slice(i + 1))
            expect(intersects(a.box, b.box), `${a.name} ∩ ${b.name}`).toBe(false);
        });
      }
    });
  },
);
