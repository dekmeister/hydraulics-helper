import type { PanelLayout } from '../types';

/**
 * Cat 7 tanker pump panel, simplified, in the photographed order (Resources/Photos/Cat7_*):
 * COMPOUND left of PRESSURE on the pump's own panel (no tacho: an hour meter sits beside them),
 * the tank to pump and suction levers, pump to tank, the hand primer, and the two outlets on the
 * manifold. The hose reel, foam and crew protection sprays are deferred with the sim (docs/BACKLOG.md).
 */
export const CAT7_LAYOUT: PanelLayout = {
  applianceId: 'cat7-generic',
  sections: [
    {
      id: 'pressures',
      title: null,
      arrangement: 'row',
      span: 'half',
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
          label: 'Pressure',
          plate: 'PRESSURE',
          size: 'large',
        },
      ],
    },
    {
      id: 'tank',
      title: null,
      arrangement: 'row',
      span: 'half',
      items: [{ kind: 'tank-level', instrument: 'tank-level', label: 'Tank' }],
    },
    {
      id: 'warnings',
      title: 'Warnings',
      arrangement: 'row',
      span: 'half',
      items: [{ kind: 'warnings' }],
    },
    {
      id: 'throttle',
      title: 'Throttle',
      arrangement: 'list',
      span: 'half',
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
        {
          // A return from the discharge side, so blue like the outlets.
          kind: 'valve',
          control: 'pump-to-tank',
          label: 'Pump to tank',
          function: 'outlet',
          tap: 'toggle',
        },
        { kind: 'primer', control: 'primer', label: 'Hand primer' },
      ],
    },
    {
      id: 'deliveries',
      title: 'Deliveries',
      arrangement: 'cards',
      items: [
        {
          kind: 'delivery',
          control: 'd1',
          label: 'Delivery 1',
          tag: 'D1',
          glyph: 'circle',
          tap: 'toggle',
        },
        {
          kind: 'delivery',
          control: 'd2',
          label: 'Delivery 2',
          tag: 'D2',
          glyph: 'square',
          tap: 'toggle',
        },
      ],
    },
  ],
};
