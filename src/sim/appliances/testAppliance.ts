import type { ApplianceSpec } from '../types';

/**
 * Test-only appliance, never registered in APPLIANCES. Differs from the reference appliance where
 * single-appliance assumptions would hide: delivery count, ids and sizes, no primer, no relief,
 * different pump, engine and tank, and a self-priming pump on a bigger suction inlet. Figures are arbitrary but plausible; not calibration data.
 */
export const TEST_APPLIANCE: ApplianceSpec = {
  id: 'test-2d',
  name: 'Test appliance (2 deliveries)',
  pump: {
    shutoffKpa: 1200,
    droopKpaPerLpm2: 3e-4,
    cavitationInletKpa: -80,
    casingVolumeL: 8,
    churnKw: 8,
  },
  engine: { idleRpm: 1000, maxRpm: 2800, rpmLagS: 1 },
  tank: { capacityL: 1500 },
  inlets: [
    { id: 'tank-valve', label: 'Tank valve', kind: 'tank', lossKpaPerLpm2: 3e-5 },
    { id: 'intake', label: 'Intake', kind: 'suction', sizeMm: 75, lossKpaPerLpm2: 8e-6 },
  ],
  primer: { kind: 'selfPriming', maxVacuumKpa: 78, displacementLps: 1 },
  deliveries: [
    { id: 'left', label: 'Left', sizeMm: 38 },
    { id: 'right', label: 'Right', sizeMm: 65 },
  ],
  instruments: [
    {
      id: 'pressure',
      kind: 'discharge',
      scale: { fullScale: 1400, zones: [{ from: 1200, to: 1400, tone: 'alarm' }] },
    },
    { id: 'level', kind: 'tank' },
  ],
};
