import type { ApplianceSpec } from '../types';

/**
 * Cat 1 tanker: the v1 reference appliance (decided by Dek, 2026-10-24). Delivery set follows
 * Design Layout A's three outlets; its hose reels and discharge master are deferred (PLAN parking lot).
 * Figures and status: docs/CALIBRATION.md § "Cat 1 tanker".
 */
export const CAT1: ApplianceSpec = {
  id: 'cat1-generic',
  name: 'Category 1 tanker',
  pump: {
    shutoffKpa: 1400, // pressure rise at zero flow, max rpm // PLACEHOLDER — needs Dek
    droopKpaPerLpm2: 4e-4, // gives 1000 kPa at 1000 L/min, max rpm // PLACEHOLDER — needs Dek
  },
  engine: {
    idleRpm: 800, // PLACEHOLDER — needs Dek
    maxRpm: 3000, // PLACEHOLDER — needs Dek
    rpmLagS: 0.5, // throttle-to-rpm time constant (ARCHITECTURE §4.4) // PLACEHOLDER — needs Dek
  },
  tank: {
    capacityL: 3000, // PLACEHOLDER — needs Dek
  },
  inlets: [
    {
      id: 'tank-to-pump',
      label: 'Tank to pump',
      kind: 'tank',
      // Inlet reads slightly negative on tank supply (L3529): −15 kPa at 1000 L/min. // PLACEHOLDER — needs Dek
      lossKpaPerLpm2: 15 / 1000 ** 2,
    },
  ],
  deliveries: [
    { id: 'd1', label: 'Delivery 1', sizeMm: 64 }, // Layout A outlet 1 // PLACEHOLDER — needs Dek (from photo)
    { id: 'd2', label: 'Delivery 2', sizeMm: 38 }, // Layout A outlet 2 // PLACEHOLDER — needs Dek (from photo)
    { id: 'd3', label: 'Delivery 3', sizeMm: 38 }, // Layout A outlet 3 // PLACEHOLDER — needs Dek (from photo)
  ],
  // Electric rotary vane primer, max 1 min on in 3 (L1853–1908, L1890). // doctrine-confirmed
  primer: { kind: 'rotaryVane', id: 'primer', maxOnS: 60, periodS: 180 },
  relief: {
    kind: 'preset', // Cat 1 relief is preset, not adjustable, and dumps to tank (L2322–2336) // doctrine-confirmed
    dumpTo: 'tank',
    setKpa: 1100, // PLACEHOLDER — needs Dek
    slopeLpmPerKpa: 50, // bypass flow per kPa over set; holds discharge within ~20 kPa of set // PLACEHOLDER — needs Dek
  },
  // Dial markings: the design comps' faces, with the discharge caution band starting at the relief
  // set pressure and the tacho redline just above the governed max (CALIBRATION row 9).
  instruments: [
    {
      id: 'compound',
      kind: 'compound',
      scale: {
        fullScale: 1600, // PLACEHOLDER — needs Dek
        zones: [
          { from: -85, to: -70, tone: 'caution' }, // PLACEHOLDER — needs Dek
          { from: -100, to: -85, tone: 'alarm' }, // PLACEHOLDER — needs Dek
        ],
      },
    },
    {
      id: 'discharge',
      kind: 'discharge',
      scale: {
        fullScale: 1600, // PLACEHOLDER — needs Dek
        zones: [
          { from: 1100, to: 1400, tone: 'caution' }, // relief set → shutoff // PLACEHOLDER — needs Dek
          { from: 1400, to: 1600, tone: 'alarm' }, // above shutoff: pressurised supply only // PLACEHOLDER — needs Dek
        ],
      },
    },
    {
      id: 'tacho',
      kind: 'tacho',
      scale: {
        fullScale: 3500, // PLACEHOLDER — needs Dek
        zones: [{ from: 3100, to: 3500, tone: 'alarm' }], // redline above governed max // PLACEHOLDER — needs Dek
      },
    },
    { id: 'tank-level', kind: 'tank' },
  ],
};
