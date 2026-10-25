import { describe, expect, it } from 'vitest';
import { CAT1 } from '../../sim/appliances/cat1';
import { CAT7 } from '../../sim/appliances/cat7';
import { applianceSummary } from './summary';

describe('applianceSummary', () => {
  it('reads the fitout off the spec', () => {
    expect(applianceSummary(CAT1)).toBe(
      '3 deliveries (65, 38, 38 mm) · 3000 L tank · electric primer · tacho',
    );
    expect(applianceSummary(CAT7)).toBe(
      '2 deliveries (38, 38 mm) · 1600 L tank · hand primer · no tacho',
    );
  });
});
