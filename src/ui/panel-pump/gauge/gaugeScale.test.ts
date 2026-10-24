// Ported from Design/reference-impl/gaugeScale.test.ts (node:test → Vitest).
import { describe, expect, it } from 'vitest';
import { compoundDial, dischargeDial, majorStep, tachoDial } from './dials';
import { arc, range, ticks, valueToAngle, zoneArcs, zoneAt } from './gaugeScale';

// Sheet 02's faces, built from scales like an appliance spec's.
const DISCHARGE_DIAL = dischargeDial({
  fullScale: 1600,
  zones: [
    { from: 1200, to: 1400, tone: 'caution' },
    { from: 1400, to: 1600, tone: 'alarm' },
  ],
});
const COMPOUND_DIAL = compoundDial({
  fullScale: 1600,
  zones: [
    { from: -85, to: -70, tone: 'caution' },
    { from: -100, to: -85, tone: 'alarm' },
  ],
});
const TACHO_DIAL = tachoDial({ fullScale: 4000, zones: [{ from: 3500, to: 4000, tone: 'alarm' }] });

describe('gauge scale', () => {
  it('maps the discharge dial linearly over 270°', () => {
    expect(valueToAngle(DISCHARGE_DIAL, 0)).toBeCloseTo(-135, 9);
    expect(valueToAngle(DISCHARGE_DIAL, 800)).toBeCloseTo(0, 9);
    expect(valueToAngle(DISCHARGE_DIAL, 1050)).toBeCloseTo(42.1875, 9);
    expect(valueToAngle(DISCHARGE_DIAL, 1600)).toBeCloseTo(135, 9);
  });

  it('clamps values off the scale to the stops, and NaN to the low stop', () => {
    expect(valueToAngle(DISCHARGE_DIAL, -50)).toBeCloseTo(-135, 9);
    expect(valueToAngle(DISCHARGE_DIAL, 2400)).toBeCloseTo(135, 9);
    expect(valueToAngle(DISCHARGE_DIAL, Number.NaN)).toBeCloseTo(-135, 9);
  });

  it('joins the compound dial’s two segments at 0 kPa = −75°', () => {
    expect(valueToAngle(COMPOUND_DIAL, -100)).toBeCloseTo(-135, 9);
    expect(valueToAngle(COMPOUND_DIAL, -40)).toBeCloseTo(-99, 9);
    expect(valueToAngle(COMPOUND_DIAL, 0)).toBeCloseTo(-75, 9);
    expect(valueToAngle(COMPOUND_DIAL, -78)).toBeCloseTo(-121.8, 9);
    expect(valueToAngle(COMPOUND_DIAL, 1600)).toBeCloseTo(135, 9);
  });

  it('has the tick counts of sheet 02', () => {
    const p = ticks(DISCHARGE_DIAL);
    expect(p).toHaveLength(33);
    expect(p.filter((t) => t.major)).toHaveLength(9);
    expect(p.filter((t) => t.label).map((t) => t.label)).toEqual([
      '0',
      '2',
      '4',
      '6',
      '8',
      '10',
      '12',
      '14',
      '16',
    ]);
    const c = ticks(COMPOUND_DIAL);
    expect(c).toHaveLength(11 + 17 - 1); // shared tick at 0
    expect(c.filter((t) => t.label).map((t) => t.label)).toEqual([
      '−100',
      '−50',
      '0',
      '4',
      '8',
      '12',
      '16',
    ]);
    expect(ticks(TACHO_DIAL)).toHaveLength(17);
  });

  it('draws arcs as dash-arrayed circles rotated to their start angle', () => {
    const a = arc(84, 67.5, 101.25, 7);
    expect(a.strokeDasharray).toBe('49.48 527.79');
    expect(a.transform).toBe('rotate(-22.5)');
    expect(zoneArcs(COMPOUND_DIAL)[0]?.transform).toBe('rotate(-216)'); // −85 kPa = −126°
  });

  it('prefers alarm over caution', () => {
    expect(zoneAt(DISCHARGE_DIAL, 1000)).toBeNull();
    expect(zoneAt(DISCHARGE_DIAL, 1300)).toBe('caution');
    expect(zoneAt(DISCHARGE_DIAL, 1400)).toBe('alarm');
    expect(zoneAt(COMPOUND_DIAL, -78)).toBe('caution');
  });
});

describe('dial faces from a spec scale', () => {
  it('picks round tick steps for the full scale', () => {
    expect(majorStep(1600, 8)).toBe(200);
    expect(majorStep(1600, 4)).toBe(400);
    expect(majorStep(1400, 8)).toBe(200);
    expect(majorStep(4000, 4)).toBe(1000);
    expect(majorStep(3500, 4)).toBe(1000);
  });

  it('ends the scale at the spec full scale and carries its zones', () => {
    const d = dischargeDial({ fullScale: 1400, zones: [{ from: 1200, to: 1400, tone: 'alarm' }] });
    expect(range(d)).toEqual([0, 1400]);
    expect(zoneAt(d, 1300)).toBe('alarm');
    expect(range(compoundDial({ fullScale: 2400, zones: [] }))).toEqual([-100, 2400]);
  });

  it('labels a tacho only on whole thousands when the scale ends between them', () => {
    const t = ticks(tachoDial({ fullScale: 3500, zones: [] }));
    expect(t).toHaveLength(15);
    expect(t.filter((x) => x.label).map((x) => x.label)).toEqual(['0', '1', '2', '3']);
  });
});
