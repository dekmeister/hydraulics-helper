import type { ApplianceSpec } from '../types';

/**
 * Cat 1 tanker: the v1 reference appliance (decided by Dek, 2026-10-24). Delivery set follows
 * Design Layout A's three outlets; its hose reels and discharge master are deferred (docs/BACKLOG.md).
 * Figures and status: docs/CALIBRATION.md § "Cat 1 tanker".
 */
export const CAT1: ApplianceSpec = {
  id: 'cat1-generic',
  name: 'Category 1 tanker',
  pump: {
    shutoffKpa: 1400, // pressure rise at zero flow, max rpm // PLACEHOLDER — needs Dek
    droopKpaPerLpm2: 4e-4, // gives 1000 kPa at 1000 L/min, max rpm // PLACEHOLDER — needs Dek
    // Cavitates below −84 kPa at the inlet: the fit to the manual's lift derate (Table 4, L1179)
    // for a generic pump; the Cat 1 pump's own figure is unknown. // PLACEHOLDER — needs Dek
    cavitationInletKpa: -84,
    casingVolumeL: 10, // PLACEHOLDER — needs Dek
    churnKw: 10, // heat churned at max rpm, all deliveries shut // PLACEHOLDER — needs Dek
  },
  engine: {
    idleRpm: 800, // PLACEHOLDER — needs Dek
    maxRpm: 3000, // PLACEHOLDER — needs Dek
    rpmLagS: 0.5, // throttle-to-rpm time constant (ARCHITECTURE §4.4) // PLACEHOLDER — needs Dek
    cylinders: 6, // pump engine, for the engine note // PLACEHOLDER — needs Dek
    speedController: {
      rampRpmPerS: 400, // governor run-up while the switch is held // PLACEHOLDER — needs Dek
      flickRpm: 50, // one quick flick of the switch // PLACEHOLDER — needs Dek
    },
    // IGN, START and STOP on the panel (photo). STOP energises a fuel rack solenoid through the
    // ignition: placard "To stop pump ignition must be on". // doctrine-confirmed (photo, Dek)
    controls: {
      ignition: 'ignition',
      start: 'start',
      stop: { id: 'stop', needsIgnition: true },
    },
    crankS: 1.5, // cranking before a warm diesel fires // PLACEHOLDER — needs Dek
    crankRpm: 200, // starter speed // PLACEHOLDER — needs Dek
    refireRpm: 400, // let go of STOP above this and it picks up again // PLACEHOLDER — needs Dek
    runDownS: 0.8, // spin-down time constant with the fuel cut // PLACEHOLDER — needs Dek
  },
  tank: {
    capacityL: 3000, // PLACEHOLDER — needs Dek
    // Tank water about 1 m above the pump eye: ~10 kPa on the compound at rest (issue #13). // PLACEHOLDER — needs Dek
    headM: 1,
  },
  inlets: [
    {
      id: 'tank-to-pump',
      label: 'Tank to pump',
      kind: 'tank',
      // Inlet reads slightly negative on tank supply (L3529): −15 kPa at 1000 L/min. // PLACEHOLDER — needs Dek
      lossKpaPerLpm2: 15 / 1000 ** 2,
    },
    {
      // 65 mm (2½") suction inlet with a green lever valve, low on the left of the pump bay; hard
      // suction or a collecting head connects here. // doctrine-confirmed (photos, Dek 2026-10-25)
      id: 'suction',
      label: 'Suction inlet',
      kind: 'suction',
      sizeMm: 65,
      lossKpaPerLpm2: 10 / 1000 ** 2, // 10 kPa at 1000 L/min through the open valve // PLACEHOLDER — needs Dek
    },
    {
      // Hydrant to tank: a 65 mm coupling with a green lever on the side of the truck, straight
      // into the tank past the pump (Dek, 2026-10-25). // doctrine-confirmed
      id: 'hydrant-to-tank',
      label: 'Hydrant to tank',
      kind: 'tankFill',
      sizeMm: 65,
      lossKpaPerLpm2: 30 / 1000 ** 2, // 30 kPa at 1000 L/min through the open valve and pipe // PLACEHOLDER — needs Dek
      fillHeightM: 2, // coupling to the top of the tank // PLACEHOLDER — needs Dek
    },
  ],
  deliveries: [
    { id: 'd1', label: 'Delivery 1', sizeMm: 65 }, // 65 mm outlet, big blue lever // doctrine-confirmed (Dek 2026-10-25)
    { id: 'd2', label: 'Delivery 2', sizeMm: 38 }, // 38 mm outlet // doctrine-confirmed (Dek 2026-10-25)
    { id: 'd3', label: 'Delivery 3', sizeMm: 38 }, // 38 mm outlet // doctrine-confirmed (Dek 2026-10-25)
  ],
  // Pump to tank: the blue lever above the suction inlet, a return from the discharge into the tank
  // (Dek, 2026-10-25). Sized as a 38 mm valved return passing ~500 L/min at 700 kPa.
  pumpToTank: {
    id: 'pump-to-tank',
    label: 'Pump to tank',
    sizeMm: 38, // PLACEHOLDER — needs Dek
    lossKpaPerLpm2: 700 / 500 ** 2, // 500 L/min at 700 kPa // PLACEHOLDER — needs Dek
  },
  // Electric rotary vane primer, max 1 min on in 3 (L1853–1908, L1890). // doctrine-confirmed
  primer: {
    kind: 'rotaryVane',
    id: 'primer',
    maxOnS: 60,
    periodS: 180,
    // Pulls up to 80 kPa vacuum (primes to just under 8 m lift; manual: 7.5 m max attempted,
    // L1162). // PLACEHOLDER — needs Dek
    maxVacuumKpa: 80,
    // Air moved, L/s: set for ~14 s to prime at 4 m on 6 m of 65 mm hard suction, counting the
    // air the rising column squeezes (sim/priming.ts). // PLACEHOLDER — needs Dek
    displacementLps: 2.9,
  },
  relief: {
    kind: 'preset', // Cat 1 relief is preset, not adjustable, and dumps to tank (L2322–2336) // doctrine-confirmed
    dumpTo: 'tank',
    setKpa: 1100, // PLACEHOLDER — needs Dek
    slopeLpmPerKpa: 50, // bypass flow per kPa over set; holds discharge within ~20 kPa of set // PLACEHOLDER — needs Dek
  },
  // Dial markings: the faces fitted to the Cat 1 (photos, Dek 2026-10-25), without the psi scale.
  // The panel placard reads "do not exceed 3000 r/min, do not exceed −80 kPa".
  instruments: [
    {
      id: 'compound',
      kind: 'compound',
      scale: {
        fullScale: 2500, // −100…2500 kPa face // doctrine-confirmed (photo)
        zones: [
          { from: -80, to: -70, tone: 'caution' }, // approaching the placard limit // PLACEHOLDER — needs Dek
          { from: -100, to: -80, tone: 'alarm' }, // past the placard's −80 kPa // doctrine-confirmed (photo)
        ],
      },
    },
    {
      id: 'discharge',
      kind: 'discharge',
      scale: {
        fullScale: 4000, // 0–4000 kPa face // doctrine-confirmed (photo)
        zones: [
          // Relief set → shutoff. No alarm band: on the 4000 kPa face it would paint most of the
          // dial red, and the fitted gauge carries no zones. // PLACEHOLDER — needs Dek
          { from: 1100, to: 1400, tone: 'caution' },
        ],
      },
    },
    {
      id: 'tacho',
      kind: 'tacho',
      scale: {
        fullScale: 4000, // 0–40 ×100 rpm face // doctrine-confirmed (photo)
        zones: [{ from: 3000, to: 4000, tone: 'alarm' }], // placard: do not exceed 3000 r/min // doctrine-confirmed (photo)
      },
    },
    // A clear sight tube on the tank with a float at the water line (Dek, 2026-10-25). // doctrine-confirmed
    { id: 'tank-level', kind: 'tank', display: { kind: 'sightTube' } },
  ],
};
