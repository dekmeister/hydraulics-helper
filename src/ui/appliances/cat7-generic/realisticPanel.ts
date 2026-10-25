import type { RealPlate } from '../realistic';

/**
 * Cat 7 pump panel, on the pump unit beside the bay (Resources/Photos/Cat7_Panel.jpg): COMPOUND
 * and PRESSURE dials with the hour meter beside them, the limits placard, the foam proportioner,
 * the engine's switches, STOP and the vernier THROTTLE. Enlarged and simplified on a grid; no
 * branding.
 */
export const CAT7_PANEL_PLATE: RealPlate = {
  id: 'panel',
  caption: null,
  viewBox: { w: 1000, h: 900 },
  inset: false,
  art: [
    { kind: 'panel', box: { x: 4, y: 4, w: 992, h: 892 } },
    { kind: 'plate', x: 840, y: 56, text: 'LIGHTS' },
    { kind: 'plate', x: 190, y: 130, text: 'COMPOUND', w: 200 },
    { kind: 'plate', x: 500, y: 130, text: 'PRESSURE', w: 200 },
    { kind: 'plate', x: 795, y: 420, text: 'HOURS' },
    { kind: 'plate', x: 560, y: 470, text: 'IGN', w: 110 },
    { kind: 'plate', x: 690, y: 470, text: 'ALT', w: 110 },
    { kind: 'plate', x: 820, y: 470, text: 'START', w: 110 },
    { kind: 'plate', x: 565, y: 700, text: 'STOP', w: 110 },
    { kind: 'plate', x: 830, y: 680, text: 'THROTTLE', w: 170 },
  ],
  items: [
    {
      kind: 'inert',
      id: 'fuses',
      label: 'Fuses',
      look: 'fuses',
      box: { x: 600, y: 32, w: 160, h: 48 },
    },
    {
      kind: 'inert',
      id: 'lights',
      label: 'Lights switch',
      look: 'toggle',
      box: { x: 905, y: 24, w: 64, h: 64 },
    },
    {
      kind: 'gauge',
      instrument: 'compound',
      dial: 'compound',
      box: { x: 55, y: 160, w: 270, h: 270 },
    },
    {
      kind: 'gauge',
      instrument: 'discharge',
      dial: 'discharge',
      box: { x: 365, y: 160, w: 270, h: 270 },
    },
    {
      kind: 'inert',
      id: 'hours',
      label: 'Hour meter',
      look: 'dial',
      box: { x: 700, y: 200, w: 190, h: 190 },
    },
    {
      kind: 'inert',
      id: 'limits',
      label: 'Operating limits placard',
      look: 'placard',
      box: { x: 40, y: 460, w: 440, h: 130 },
      text: [
        'IMPORTANT',
        '1. Do not exceed 3600 r/min.',
        '2. Do not exceed −80 kPa.',
        'Operate close to 0 as possible',
      ],
    },
    {
      kind: 'inert',
      id: 'foam',
      label:
        'Foam proportioner (class A/B selection and metering valves; operate between 600 and 1000 kPa only)',
      look: 'knobs',
      text: ['FOAM'],
      box: { x: 40, y: 610, w: 440, h: 260 },
    },
    {
      kind: 'inert',
      id: 'ignition',
      label: 'Ignition switch',
      look: 'toggle',
      box: { x: 520, y: 500, w: 80, h: 80 },
    },
    {
      kind: 'inert',
      id: 'alt',
      label: 'Alternator lamp',
      look: 'lamp',
      box: { x: 650, y: 500, w: 80, h: 80 },
    },
    {
      kind: 'inert',
      id: 'start',
      label: 'Start button',
      look: 'button',
      box: { x: 780, y: 500, w: 80, h: 80 },
    },
    {
      kind: 'inert',
      id: 'oil',
      label: 'Oil pressure lamp',
      look: 'lamp',
      box: { x: 650, y: 600, w: 70, h: 64 },
    },
    {
      kind: 'inert',
      id: 'stop',
      label: 'Engine stop handle',
      look: 'button',
      box: { x: 520, y: 730, w: 90, h: 90 },
    },
    // The vernier knob under its plate, as on the unit; wide so a thumb can slide it.
    { kind: 'throttle', variant: 'vernier', box: { x: 680, y: 712, w: 300, h: 170 } },
  ],
};
