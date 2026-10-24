import type { DialSpec } from './gaugeScale';

// Dial faces (Design sheet 02). A layout picks a face per instrument. Ranges and zone thresholds
// are the design comps' figures, not doctrine (Design OPEN_DECISIONS #5). // PLACEHOLDER — needs Dek

const hundreds = (v: number) => String(v / 100);

/** Discharge (pressure) gauge, 0–1600 kPa. */
export const DISCHARGE_DIAL: DialSpec = {
  id: 'discharge',
  segments: [{ v: [0, 1600], a: [-135, 135], major: 200, minor: 50, label: hundreds }],
  zones: [
    { v: [1200, 1400], tone: 'caution' },
    { v: [1400, 1600], tone: 'alarm' },
  ],
  units: 'kPa ×100',
  plate: 'DISCHARGE',
};

/** Compound gauge: vacuum −100…0 kPa on a stretched sector, pressure 0…1600 kPa, joined at −75°. */
export const COMPOUND_DIAL: DialSpec = {
  id: 'compound',
  segments: [
    {
      v: [-100, 0],
      a: [-135, -75],
      major: 50,
      minor: 10,
      label: (v) => (v === 0 ? null : `−${String(Math.abs(v))}`),
      labelSize: 15,
      labelMuted: true,
      tint: true,
    },
    { v: [0, 1600], a: [-75, 135], major: 400, minor: 100, label: hundreds },
  ],
  zones: [
    { v: [-85, -70], tone: 'caution' },
    { v: [-100, -85], tone: 'alarm' },
  ],
  breaks: [0],
  units: 'kPa ×100',
  plate: 'COMPOUND',
  subLabel: { text: 'VAC kPa', atValue: -50, r: 28 },
};

/** Engine tachometer, 0–4000 rpm. */
export const TACHO_DIAL: DialSpec = {
  id: 'tacho',
  segments: [
    {
      v: [0, 4000],
      a: [-135, 135],
      major: 1000,
      minor: 250,
      label: (v) => String(v / 1000),
      labelSize: 22,
    },
  ],
  zones: [{ v: [3500, 4000], tone: 'alarm' }],
  units: 'RPM ×1000',
  plate: 'ENGINE',
};

/** Faces a layout can name. */
export const DIALS = {
  discharge: DISCHARGE_DIAL,
  compound: COMPOUND_DIAL,
  tacho: TACHO_DIAL,
} as const satisfies Record<string, DialSpec>;

export type DialId = keyof typeof DIALS;
