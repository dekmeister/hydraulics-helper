import type { ApplianceSpec } from '../types';

/**
 * Cat 7 tanker: the second appliance (Dek, 2026-10-25), read from Resources/Photos/Cat7_*. A small
 * radial pump on its own air-cooled diesel, with its own panel (compound and pressure dials, an
 * hour meter but no tacho, a vernier throttle), two 38 mm outlets on a manifold, a 65 mm suction
 * inlet, a hand diaphragm primer, no relief valve, and a 3-way valve that bleeds the discharge back
 * to the tank (TANK RECIRC) or through the foam proportioner. Its hose reel, foam and crew
 * protection sprays are deferred. Figures and status: docs/CALIBRATION.md § "Cat 7 tanker".
 */
export const CAT7: ApplianceSpec = {
  id: 'cat7-generic',
  name: 'Category 7 tanker',
  pump: {
    shutoffKpa: 1400, // pressure rise at zero flow, max rpm // PLACEHOLDER — needs Dek
    // Rated ~550 L/min at 700 kPa, max rpm: (1400 − 700) / 550². Sized so the lessons' two crew
    // lines (38 mm with a 15 mm tip, the 25 mm light line with a 12 mm tip) run at working
    // pressure with some throttle in hand: sized for the lessons, not read off the truck
    // (CALIBRATION needs Dek 39). // PLACEHOLDER — needs Dek
    droopKpaPerLpm2: 700 / 550 ** 2,
    // The generic pump's fit to the manual's lift derate (Table 4), as for the Cat 1; the placard's
    // −80 kPa is the operating limit, drawn on the compound. // PLACEHOLDER — needs Dek
    cavitationInletKpa: -84,
    casingVolumeL: 4, // PLACEHOLDER — needs Dek
    churnKw: 5, // heat churned at max rpm, all deliveries shut // PLACEHOLDER — needs Dek
  },
  engine: {
    idleRpm: 1200, // PLACEHOLDER — needs Dek
    maxRpm: 3600, // panel placard: do not exceed 3600 r/min // doctrine-confirmed (photo)
    rpmLagS: 0.4, // a small engine spins up quicker than the Cat 1's // PLACEHOLDER — needs Dek
    cylinders: 1, // air-cooled pump engine, for the engine note // PLACEHOLDER — needs Dek
    // THROTTLE is a vernier knob marked RELEASE · HOLD (photo). One twist moves it 4 % of its
    // travel. // PLACEHOLDER — needs Dek
    vernier: { throttlePerTurn: 0.04 },
    // IGN and START switches and a STOP T-handle (photo). The handle pulls the fuel rack by cable,
    // so it works with the ignition off. // doctrine-confirmed (photo, Dek)
    controls: {
      ignition: 'ignition',
      start: 'start',
      stop: { id: 'stop', needsIgnition: false },
    },
    crankS: 1.2, // cranking before a warm diesel fires // PLACEHOLDER — needs Dek
    crankRpm: 300, // starter speed // PLACEHOLDER — needs Dek
    refireRpm: 600, // let go of STOP above this and it picks up again // PLACEHOLDER — needs Dek
    runDownS: 0.5, // a small engine runs down quicker than the Cat 1's // PLACEHOLDER — needs Dek
  },
  tank: {
    capacityL: 1600, // PLACEHOLDER — needs Dek
  },
  inlets: [
    {
      // Butterfly valve with a yellow, green-tipped lever on the pipe down from the tank, joining
      // the suction before the strainer (photos). // doctrine-confirmed
      id: 'tank-to-pump',
      label: 'Tank to pump',
      kind: 'tank',
      // 6 kPa at 400 L/min through the valve and the shared strainer. // PLACEHOLDER — needs Dek
      lossKpaPerLpm2: 6 / 400 ** 2,
    },
    {
      // 65 mm suction inlet on a butterfly valve with a notched yellow lever, then a check valve
      // and the DN65 Y-strainer on the pump's eye (photos, hydraulic diagram). // doctrine-confirmed
      id: 'suction',
      label: 'Suction inlet',
      kind: 'suction',
      sizeMm: 65,
      // 10 kPa at 400 L/min through the valve, check valve and strainer. // PLACEHOLDER — needs Dek
      lossKpaPerLpm2: 10 / 400 ** 2,
    },
  ],
  deliveries: [
    // Two outlets with blue ball-valve levers on the manifold (photos). Size from the couplings:
    // 38 mm. // PLACEHOLDER — needs Dek (size)
    { id: 'd1', label: 'Delivery 1', sizeMm: 38 },
    { id: 'd2', label: 'Delivery 2', sizeMm: 38 },
  ],
  // Ball valve from the discharge up into the tank (hydraulic diagram). 25 mm, ~200 L/min at
  // 700 kPa. // function doctrine-confirmed; size and loss PLACEHOLDER — needs Dek
  pumpToTank: {
    id: 'pump-to-tank',
    label: 'Pump to tank',
    sizeMm: 25,
    lossKpaPerLpm2: 700 / 200 ** 2,
  },
  // The 3-way valve set to TANK RECIRC: a bleed through a check valve into the tank (hydraulic
  // diagram). ~30 L/min at 700 kPa. // function doctrine-confirmed; flow PLACEHOLDER — needs Dek
  recirc: {
    sizeMm: 15,
    lossKpaPerLpm2: 700 / 30 ** 2,
  },
  // Red hand diaphragm primer with a long handle, left of the outlets (photo). // PLACEHOLDER —
  // needs Dek (that this is the primer, and its performance)
  primer: {
    kind: 'diaphragm',
    id: 'primer',
    maxVacuumKpa: 75, // primes to ~7.5 m // PLACEHOLDER — needs Dek
    // Slower than the Cat 1's electric primer: ~30 s at 4 m on 6 m of 65 mm. // PLACEHOLDER — needs Dek
    displacementLps: 1.3,
  },
  // No relief valve in the photos or on the diagram. // doctrine-confirmed (photos)
  // Dial markings: the faces fitted (photo), −100…1600 compound and 0–1600 pressure. The placard
  // reads "do not exceed 3600 r/min, do not exceed −80 kPa, operate close to '0' as possible".
  instruments: [
    {
      id: 'compound',
      kind: 'compound',
      scale: {
        fullScale: 1600, // −100…1600 kPa face // doctrine-confirmed (photo)
        zones: [
          { from: -80, to: -70, tone: 'caution' }, // approaching the placard limit // PLACEHOLDER — needs Dek
          { from: -100, to: -80, tone: 'alarm' }, // past the placard's −80 kPa // doctrine-confirmed (photo)
        ],
      },
    },
    {
      id: 'discharge',
      kind: 'discharge',
      // 0–1600 kPa face with no zones // doctrine-confirmed (photo)
      scale: { fullScale: 1600, zones: [] },
    },
    // No tank gauge shows in the photos; a sight tube is assumed so the level can be read.
    // PLACEHOLDER — needs Dek
    { id: 'tank-level', kind: 'tank', display: { kind: 'sightTube' } },
  ],
};
