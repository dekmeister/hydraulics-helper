// The water each realistic fixture's caption promises (catalog.ts), checked against the selector.
import { describe, expect, it } from 'vitest';
import { inletOfKind } from '../../sim/appliances/controls';
import { activeTruck } from '../../state/activeTruck';
import { waterIn, type WaterRef, type WaterState } from '../../state/plumbing';
import { REALISTIC_APPLIANCES, realisticState, type RealisticStateId } from './realisticStates';

describe.each(REALISTIC_APPLIANCES.map((spec) => [spec.id, spec] as const))(
  'realistic fixture water: %s',
  (_id, spec) => {
    const tankIn = inletOfKind(spec, 'tank');
    const suction = inletOfKind(spec, 'suction');
    // The fixtures open their first laid line, not necessarily the first delivery.
    const first = realisticState(spec, 'idle').lines[0]?.deliveryId ?? '';
    const water = (id: RealisticStateId, ref: WaterRef): WaterState => {
      const s = realisticState(spec, id);
      return waterIn(s, activeTruck(s), ref);
    };

    it('idle: only the tank side holds water', () => {
      expect(water('idle', { at: 'tank' })).toBe('still');
      expect(water('idle', { at: 'casing' })).toBe('empty');
      expect(water('idle', { at: 'inlet', id: suction, side: 'pump' })).toBe('empty');
    });

    it('tank attack: the feed, pump and first line flow', () => {
      expect(water('tank-attack-700', { at: 'tank' })).toBe('flowing');
      expect(water('tank-attack-700', { at: 'casing' })).toBe('flowing');
      expect(water('tank-attack-700', { at: 'delivery', id: first })).toBe('flowing');
    });

    it('after the attack: the casing keeps still water; the lines are empty', () => {
      expect(water('after-tank-attack', { at: 'casing' })).toBe('still');
      expect(water('after-tank-attack', { at: 'inlet', id: tankIn, side: 'pump' })).toBe('still');
      expect(water('after-tank-attack', { at: 'delivery', id: first })).toBe('empty');
    });

    it('draughting: dry while priming, flowing once working', () => {
      expect(water('draught-priming', { at: 'inlet', id: suction, side: 'source' })).toBe('empty');
      expect(water('draught-priming', { at: 'casing' })).toBe('empty');
      expect(water('draught-working', { at: 'inlet', id: suction, side: 'source' })).toBe(
        'flowing',
      );
      expect(water('draught-working', { at: 'inlet', id: tankIn, side: 'pump' })).toBe('still');
      const drawn = realisticState(spec, 'draught-working').lines[0]?.deliveryId ?? '';
      expect(water('draught-working', { at: 'delivery', id: drawn })).toBe('flowing');
    });

    it.runIf(spec.inlets.some((i) => i.kind === 'tankFill'))(
      'refilling: hydrant to tank flows past the pump',
      () => {
        const fill = inletOfKind(spec, 'tankFill');
        expect(water('refilling', { at: 'inlet', id: fill, side: 'pump' })).toBe('flowing');
        expect(water('refilling', { at: 'casing' })).toBe('empty');
      },
    );
  },
);
