import { describe, expect, it } from 'vitest';
import { formatPercent, formatReading, formatWhole } from './format';

describe('readout formatting', () => {
  it('groups thousands with a space and rounds', () => {
    expect(formatWhole(0)).toBe('0');
    expect(formatWhole(702.4)).toBe('702');
    expect(formatWhole(1050)).toBe('1 050');
    expect(formatWhole(1234567)).toBe('1 234 567');
  });

  it('uses a true minus sign and never shows −0', () => {
    expect(formatWhole(-28)).toBe('−28');
    expect(formatWhole(-0.2)).toBe('0');
  });

  it('treats non-finite values as zero', () => {
    expect(formatWhole(Number.NaN)).toBe('0');
  });

  it('adds units and percentages', () => {
    expect(formatReading(1050, 'kPa')).toBe('1 050 kPa');
    expect(formatPercent(0.604)).toBe('60 %');
  });
});
