// Layout ↔ spec consistency (ARCHITECTURE §9.4, docs/TESTING.md layer 4): every control and
// instrument the spec defines is placed exactly once, and nothing is placed that it lacks.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { switchControlIds, valveControlIds } from '../../sim/appliances/controls';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import type { ApplianceSpec, InstrumentKind } from '../../sim/types';
import { TEST_APPLIANCE_LAYOUT } from '../../testing/appliances/testApplianceLayout';
import type { DialId } from '../panel-pump/gauge/dials';
import { deliveryIdentities, deliveryIdentity } from './identity';
import { CATALOGUE_LAYOUTS, getPanelLayout } from './registry';
import type { PanelItem, PanelLayout } from './types';

/** Which instrument kind each dial face can show. */
const DIAL_KIND: Readonly<Record<DialId, InstrumentKind>> = {
  discharge: 'discharge',
  compound: 'compound',
  tacho: 'tacho',
};

const PAIRS: [string, ApplianceSpec, PanelLayout][] = [
  ...APPLIANCES.map((s): [string, ApplianceSpec, PanelLayout] => [s.id, s, getPanelLayout(s.id)]),
  [TEST_APPLIANCE.id, TEST_APPLIANCE, TEST_APPLIANCE_LAYOUT],
];

const items = (layout: PanelLayout): PanelItem[] => layout.sections.flatMap((s) => s.items);

describe('panel layout registry', () => {
  it('has exactly one layout per catalogue appliance', () => {
    expect(CATALOGUE_LAYOUTS.map((l) => l.applianceId).sort()).toEqual(
      APPLIANCES.map((a) => a.id).sort(),
    );
  });
});

describe.each(PAIRS)('panel layout ↔ spec: %s', (_id, spec, layout) => {
  const all = items(layout);

  it('belongs to its appliance', () => {
    expect(layout.applianceId).toBe(spec.id);
  });

  it('places every control exactly once and nothing else', () => {
    const placed = all.flatMap((i) =>
      i.kind === 'valve' || i.kind === 'delivery' || i.kind === 'primer' ? [i.control] : [],
    );
    expect([...placed].sort()).toEqual(
      [...valveControlIds(spec), ...switchControlIds(spec)].sort(),
    );
  });

  it('places deliveries as delivery rows and switches as switch controls', () => {
    const deliveryIds = new Set(spec.deliveries.map((d) => d.id));
    const switches = new Set(switchControlIds(spec));
    for (const i of all) {
      if (i.kind === 'delivery') expect(deliveryIds.has(i.control)).toBe(true);
      if (i.kind === 'valve')
        expect(deliveryIds.has(i.control) || switches.has(i.control)).toBe(false);
      if (i.kind === 'primer') expect(switches.has(i.control)).toBe(true);
    }
  });

  it('places every instrument exactly once on a face that can show it', () => {
    const kinds = new Map(spec.instruments.map((x) => [x.id, x.kind]));
    const placed: string[] = [];
    for (const i of all) {
      if (i.kind === 'gauge') {
        placed.push(i.instrument);
        expect(kinds.get(i.instrument)).toBe(DIAL_KIND[i.dial]);
      }
      if (i.kind === 'tank-level') {
        placed.push(i.instrument);
        expect(kinds.get(i.instrument)).toBe('tank');
      }
    }
    expect(placed.sort()).toEqual(spec.instruments.map((x) => x.id).sort());
  });

  it('has exactly one throttle and one warning strip', () => {
    expect(all.filter((i) => i.kind === 'throttle')).toHaveLength(1);
    expect(all.filter((i) => i.kind === 'warnings')).toHaveLength(1);
  });

  it('uses unique section ids and unique accessible names', () => {
    const sections = layout.sections.map((s) => s.id);
    expect(new Set(sections).size).toBe(sections.length);
    const names = all.flatMap((i) => ('label' in i ? [i.label] : []));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe.each(PAIRS)('delivery identity: %s', (_id, spec, layout) => {
  it('names and marks every delivery, with distinct tags and glyphs', () => {
    const ids = deliveryIdentities(layout);
    expect([...ids.keys()].sort()).toEqual(spec.deliveries.map((d) => d.id).sort());
    const tags = [...ids.values()].map((i) => i.tag);
    expect(new Set(tags).size).toBe(tags.length);
    const glyphs = [...ids.values()].map((i) => i.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    for (const d of spec.deliveries) expect(deliveryIdentity(layout, d.id).label).not.toBe('');
  });
});
