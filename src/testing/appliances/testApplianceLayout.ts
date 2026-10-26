import type { PanelLayout } from '../../ui/appliances/types';

/**
 * Panel for the test-only appliance (src/sim/appliances/testAppliance.ts): two deliveries, no
 * compound gauge, tacho or primer, and a different order. Proves the panel renderer is generic.
 */
export const TEST_APPLIANCE_LAYOUT: PanelLayout = {
  applianceId: 'test-2d',
  sections: [
    {
      id: 'gauges',
      title: null,
      arrangement: 'row',
      items: [
        {
          kind: 'gauge',
          instrument: 'pressure',
          dial: 'discharge',
          label: 'Pressure',
          size: 'large',
        },
        { kind: 'tank-level', instrument: 'level', label: 'Water level' },
      ],
    },
    {
      id: 'engine',
      title: 'Engine',
      arrangement: 'row',
      items: [
        { kind: 'engine-switch', control: 'key', role: 'ignition', label: 'Key' },
        { kind: 'engine-switch', control: 'crank', role: 'start', label: 'Crank' },
        { kind: 'engine-switch', control: 'kill', role: 'stop', label: 'Kill' },
        { kind: 'engine-status' },
      ],
    },
    {
      id: 'lines',
      title: 'Deliveries',
      arrangement: 'list',
      items: [
        {
          kind: 'delivery',
          control: 'left',
          label: 'Left delivery',
          tag: 'L',
          glyph: 'square',
          tap: 'toggle',
        },
        {
          kind: 'delivery',
          control: 'right',
          label: 'Right delivery',
          tag: 'R',
          glyph: 'hexagon',
          tap: 'none',
        },
      ],
    },
    {
      id: 'controls',
      title: 'Pump',
      arrangement: 'row',
      items: [
        {
          kind: 'valve',
          control: 'tank-valve',
          label: 'Tank valve',
          function: 'inlet',
          tap: 'toggle',
        },
        { kind: 'valve', control: 'intake', label: 'Intake', function: 'inlet', tap: 'toggle' },
        { kind: 'valve', control: 'fill', label: 'Tank fill', function: 'inlet', tap: 'toggle' },
        { kind: 'throttle', variant: 't-handle', label: 'Throttle' },
      ],
    },
    { id: 'warnings', title: 'Warnings', arrangement: 'row', items: [{ kind: 'warnings' }] },
  ],
};
