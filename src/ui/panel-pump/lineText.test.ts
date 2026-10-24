import { describe, expect, it } from 'vitest';
import type { HoseLine } from '../../sim/types';
import { describeLine } from './lineText';

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
});
