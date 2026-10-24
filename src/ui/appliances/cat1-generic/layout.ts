import type { PanelLayout } from '../types';

/**
 * Cat 1 tanker pump panel, simplified (Design sheet 05) with Layout A's real ordering: compound
 * left of discharge, engine rpm beside them, three outlets (sheet 07–08). Reels and the discharge
 * master are deferred with the sim (PLAN parking lot).
 */
export const CAT1_LAYOUT: PanelLayout = {
  applianceId: 'cat1-generic',
  sections: [
    {
      id: 'pressures',
      title: null,
      arrangement: 'row',
      items: [
        {
          kind: 'gauge',
          instrument: 'compound',
          dial: 'compound',
          label: 'Compound',
          size: 'large',
        },
        {
          kind: 'gauge',
          instrument: 'discharge',
          dial: 'discharge',
          label: 'Discharge',
          size: 'large',
        },
      ],
    },
    {
      id: 'engine',
      title: null,
      arrangement: 'row',
      items: [
        { kind: 'gauge', instrument: 'tacho', dial: 'tacho', label: 'Engine rpm', size: 'medium' },
        { kind: 'tank-level', instrument: 'tank-level', label: 'Tank' },
      ],
    },
    { id: 'warnings', title: 'Warnings', arrangement: 'row', items: [{ kind: 'warnings' }] },
    {
      id: 'throttle',
      title: 'Throttle',
      arrangement: 'list',
      items: [{ kind: 'throttle', variant: 't-handle', label: 'Throttle' }],
    },
    {
      id: 'supply',
      title: 'Supply',
      arrangement: 'row',
      items: [
        {
          kind: 'valve',
          control: 'tank-to-pump',
          label: 'Tank to pump',
          function: 'inlet',
          tap: 'toggle',
        },
        {
          kind: 'valve',
          control: 'suction',
          label: 'Suction inlet',
          function: 'inlet',
          tap: 'toggle',
        },
        { kind: 'primer', control: 'primer', label: 'Primer' },
      ],
    },
    {
      id: 'deliveries',
      title: 'Deliveries',
      arrangement: 'list',
      items: [
        {
          kind: 'delivery',
          control: 'd1',
          label: 'Delivery 1',
          tag: 'D1',
          glyph: 'circle',
          tap: 'none',
        },
        {
          kind: 'delivery',
          control: 'd2',
          label: 'Delivery 2',
          tag: 'D2',
          glyph: 'square',
          tap: 'none',
        },
        {
          kind: 'delivery',
          control: 'd3',
          label: 'Delivery 3',
          tag: 'D3',
          glyph: 'bar',
          tap: 'none',
        },
      ],
    },
  ],
};
