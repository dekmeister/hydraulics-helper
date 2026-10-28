import { describe, expect, it } from 'vitest';
import type { HoseLine, RelayLink } from '../../sim/types';
import { describeLine, describeRelay } from './lineText';

const line = (segments: HoseLine['segments'], elevationM = 0): HoseLine => ({
  id: 'l',
  truckId: 't',
  deliveryId: 'd1',
  segments,
  elevationM,
  branch: { tipMm: 15 },
});

describe('hose lay description', () => {
  it('groups lengths of the same hose', () => {
    const l = line([
      { hose: '38L', lengthM: 30 },
      { hose: '38L', lengthM: 30 },
      { hose: '38L', lengthM: 30 },
    ]);
    expect(describeLine(l)).toBe('3 × 30 m 38 mm lined · 15 mm branch');
  });

  it('lists mixed hose in order and states the climb', () => {
    const l = line(
      [
        { hose: '65L', lengthM: 30 },
        { hose: '65L', lengthM: 30 },
        { hose: '38U', lengthM: 30 },
      ],
      14,
    );
    expect(describeLine(l)).toBe(
      '2 × 30 m 65 mm lined + 1 × 30 m 38 mm unlined · 15 mm branch · 14 m uphill',
    );
    expect(describeLine({ ...l, elevationM: -6 })).toMatch(/6 m downhill$/);
  });

  it('names a monitor for what it is', () => {
    const l = line([{ hose: '65L', lengthM: 30 }]);
    expect(describeLine({ ...l, branch: { tipMm: 25, kind: 'monitor' } })).toBe(
      '1 × 30 m 65 mm lined · 25 mm monitor',
    );
  });
});

describe('relay hose description', () => {
  const relay = (elevationM: number): RelayLink => ({
    id: 'r',
    truckId: 'base',
    deliveryId: 'd1',
    segments: Array.from({ length: 4 }, () => ({ hose: '65L', lengthM: 30 })),
    elevationM,
    to: { kind: 'inlet', truckId: 'attack', inletId: 'suction' },
  });

  it('names the hose, where it goes and the climb', () => {
    expect(describeRelay(relay(20), 'Attack pump')).toBe(
      'Relay · 4 × 30 m 65 mm lined · to Attack pump · 20 m uphill',
    );
    expect(describeRelay(relay(0), 'Portable dam')).toBe(
      'Relay · 4 × 30 m 65 mm lined · to Portable dam',
    );
  });

  it('says when a length has burst', () => {
    const burst = { ...relay(0), burst: { atS: 1, segment: 3, peakKpa: 1400 } };
    expect(describeRelay(burst, 'Attack pump')).toBe(
      'Relay · 4 × 30 m 65 mm lined · to Attack pump · length 4 burst',
    );
  });
});
