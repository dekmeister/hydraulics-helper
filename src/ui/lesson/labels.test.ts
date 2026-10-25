import { describe, expect, it } from 'vitest';
import { CAT1_LAYOUT } from '../appliances/cat1-generic/layout';
import { CAT1_REALISTIC } from '../appliances/cat1-generic/realistic';
import { TEST_APPLIANCE_LAYOUT } from '../../testing/appliances/testApplianceLayout';
import { gestureHint } from './labels';

describe('gestureHint', () => {
  it('names a lever’s colour by function, and a tap only where the layout takes one', () => {
    expect(gestureHint(CAT1_LAYOUT, undefined, 'c:tank-to-pump')).toBe(
      'tap its green handle, or drag it a quarter turn to open it part way',
    );
    expect(gestureHint(CAT1_LAYOUT, undefined, 'c:d1')).toMatch(/^tap its blue handle/);
    // The test appliance's right delivery is drag only.
    expect(gestureHint(TEST_APPLIANCE_LAYOUT, undefined, 'c:right')).toBe(
      'drag its blue handle a quarter turn',
    );
  });

  it('names the throttle the player is looking at', () => {
    expect(gestureHint(CAT1_LAYOUT, undefined, 'throttle')).toBe('the throttle’s − and + buttons');
    expect(gestureHint(CAT1_LAYOUT, CAT1_REALISTIC, 'throttle')).toMatch(/speed switch/);
  });
});
