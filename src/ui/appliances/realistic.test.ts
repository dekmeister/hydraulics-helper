// Realistic layout ↔ spec and simplified layout (ARCHITECTURE §9.4): the realistic view places
// exactly what the simplified panel does (bar the warning strip, which it draws once under the
// plates), so both views name the same controls; and on a 375 px phone every control is a thumb
// target that overlaps no other.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import type { InstrumentKind } from '../../sim/types';
import { interactiveBoxes, itemBox, plateWidthsPx } from '../panel-real/geometry';
import type { DialId } from '../panel-pump/gauge/dials';
import { itemKey, realItemKey } from './itemKey';
import type { RBox } from './realistic';
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

describe('realistic layout registry', () => {
  it('registers layouts only for catalogue appliances, one each', () => {
    const ids = CATALOGUE_REALISTIC.map((l) => l.applianceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(APPLIANCES.map((a) => a.id)).toContain(id);
    for (const l of CATALOGUE_REALISTIC) expect(getRealisticLayout(l.applianceId)).toBe(l);
  });
});

describe.each(CATALOGUE_REALISTIC.map((l) => [l.applianceId, l] as const))(
  'realistic layout: %s',
  (id, layout) => {
    const spec = APPLIANCES.find((a) => a.id === id);
    if (spec === undefined) throw new Error(`no appliance '${id}'`);
    const items = layout.plates.flatMap((p) => p.items);

    it('draws a speed switch only where the spec has a speed controller', () => {
      const switches = items.filter((i) => i.kind === 'throttle');
      if (switches.length > 0) expect(spec.engine.speedController).toBeDefined();
    });

    it('places what the simplified panel places, each exactly once', () => {
      const simplified = getPanelLayout(id)
        .sections.flatMap((s) => s.items)
        .map(itemKey)
        .filter((k) => k !== 'warnings');
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
