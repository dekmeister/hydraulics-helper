import type { DialSpec } from './gaugeScale';

/**
 * Dial presets from sheet 02. Zone thresholds and ranges are PLACEHOLDERS chosen for the
 * design comps — replace them with values from the simulation model (see OPEN_DECISIONS.md #5).
 */

const hundreds = (v: number) => String(v / 100);
const MUTED = '#3E4448';

export const pressureDial: DialSpec = {
  id: 'pressure',
  segments: [{ v: [0, 1600], a: [-135, 135], major: 200, minor: 50, label: hundreds }],
  zones: [
    { v: [1200, 1400], tone: 'caution' },
    { v: [1400, 1600], tone: 'alarm' },
  ],
  units: 'kPa ×100',
  plate: 'DISCHARGE',
};

/** Compound gauge: two linear segments sharing 0 kPa at -75°. */
export const compoundDial: DialSpec = {
  id: 'compound',
  segments: [
    {
      v: [-100, 0], a: [-135, -75], major: 50, minor: 10,
      label: (v) => (v === 0 ? null : `−${Math.abs(v)}`), labelSize: 15, labelColor: MUTED,
      tint: '#E1E6E8',
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

export const tachDial: DialSpec = {
  id: 'tach',
  segments: [{ v: [0, 4000], a: [-135, 135], major: 1000, minor: 250, label: (v) => String(v / 1000), labelSize: 22 }],
  zones: [{ v: [3500, 4000], tone: 'alarm' }],
  units: 'RPM ×1000',
  plate: 'ENGINE',
};

/** Mini delivery dial (< 100 px). No numerals; value is shown as a mono readout beside it. */
export const miniPressureDial: DialSpec = {
  id: 'mini-pressure',
  segments: [{ v: [0, 1600], a: [-135, 135], major: 400, minor: 400 }],
  zones: pressureDial.zones,
  units: '',
  mini: true,
};

/** Small engine dials on layout A (temperature, oil). Ranges are placeholders. */
export const engineTempDial: DialSpec = {
  id: 'engine-temp',
  segments: [{ v: [40, 120], a: [-135, 135], major: 20, minor: 20 }],
  zones: [{ v: [105, 120], tone: 'alarm' }],
  units: '°C',
  mini: true,
};

export const oilPressureDial: DialSpec = {
  id: 'oil-pressure',
  segments: [{ v: [0, 600], a: [-135, 135], major: 150, minor: 150 }],
  zones: [{ v: [0, 75], tone: 'alarm' }],
  units: 'kPa',
  mini: true,
};
