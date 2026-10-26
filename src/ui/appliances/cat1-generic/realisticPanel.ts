import type { RealPlate } from '../realistic';

/**
 * Cat 1 instrument panel, above the pump bay (Resources/Photos/Cat1_Panel.jpg): the real
 * arrangement on a regular grid, enlarged and simplified; no branding.
 */
export const CAT1_PANEL_PLATE: RealPlate = {
  // On a grid: 32 u margins; placards, then the dials on one centreline with their plates on
  // one line under them, then the switches, speed controller and foam along the bottom.
  id: 'panel',
  caption: null,
  viewBox: { w: 1000, h: 1132 },
  place: 'stack',
  art: [
    { kind: 'panel', box: { x: 4, y: 4, w: 992, h: 1124 } },
    { kind: 'plate', x: 167, y: 522, text: 'COMPOUND', w: 200 },
    { kind: 'plate', x: 467, y: 522, text: 'PRESSURE', w: 200 },
    { kind: 'plate', x: 895, y: 362, text: 'OIL TEMP', w: 150 },
    { kind: 'plate', x: 895, y: 522, text: 'OIL PRESSURE', w: 170 },
    { kind: 'plate', x: 117, y: 700, text: 'STOP', w: 84 },
    { kind: 'plate', x: 291, y: 700, text: 'IGN', w: 84 },
    { kind: 'plate', x: 117, y: 916, text: 'ALT', w: 84 },
    { kind: 'plate', x: 291, y: 916, text: 'START', w: 84 },
    { kind: 'plate', x: 895, y: 712, text: 'AIR CLEANER', w: 160 },
  ],
  items: [
    {
      kind: 'inert',
      id: 'idle-note',
      label: 'Idle placard',
      look: 'placard',
      box: { x: 32, y: 32, w: 170, h: 170 },
      text: ['NOTE', 'For extended', 'idle periods', 'set RPM', 'at 1200 rpm'],
    },
    {
      kind: 'inert',
      id: 'fuses',
      label: 'Fuses',
      look: 'fuses',
      box: { x: 440, y: 32, w: 120, h: 40 },
    },
    {
      kind: 'inert',
      id: 'limits',
      label: 'Operating limits placard',
      look: 'placard',
      box: { x: 280, y: 84, w: 440, h: 118 },
      text: [
        'IMPORTANT',
        '1. Do not exceed 3000 r/min.',
        '2. Do not exceed −80 kPa.',
        'Operate close to 0 as possible',
      ],
    },
    {
      kind: 'gauge',
      instrument: 'compound',
      dial: 'compound',
      box: { x: 32, y: 230, w: 270, h: 270 },
    },
    {
      kind: 'gauge',
      instrument: 'discharge',
      dial: 'discharge',
      box: { x: 332, y: 230, w: 270, h: 270 },
    },
    {
      kind: 'gauge',
      instrument: 'tacho',
      dial: 'tacho',
      box: { x: 627, y: 275, w: 180, h: 180 },
    },
    {
      kind: 'inert',
      id: 'oil-temp',
      label: 'Oil temperature gauge',
      look: 'dial',
      box: { x: 840, y: 230, w: 110, h: 110 },
    },
    {
      kind: 'inert',
      id: 'oil-pressure',
      label: 'Oil pressure gauge',
      look: 'dial',
      box: { x: 840, y: 390, w: 110, h: 110 },
    },
    {
      kind: 'inert',
      id: 'stop-note',
      label: 'Stopping placard',
      look: 'placard',
      box: { x: 32, y: 548, w: 344, h: 120 },
      text: ['NOTE:', 'To stop pump', 'ignition must', 'be on'],
    },
    // Energise-to-stop: works only with the ignition on (the placard beside it).
    {
      kind: 'engine-switch',
      control: 'stop',
      look: 'button',
      box: { x: 32, y: 720, w: 170, h: 170 },
    },
    {
      kind: 'engine-switch',
      control: 'ignition',
      look: 'toggle',
      box: { x: 206, y: 720, w: 170, h: 170 },
    },
    {
      kind: 'engine-lamp',
      id: 'alt',
      label: 'Charge (ALT) lamp',
      box: { x: 77, y: 981, w: 80, h: 80 },
    },
    {
      kind: 'engine-switch',
      control: 'start',
      look: 'button',
      box: { x: 206, y: 936, w: 170, h: 170 },
    },
    {
      // Under the pressure gauge, as on the truck; tall so each half takes a thumb, with the tank
      // column beside the panel narrowing it on a phone.
      kind: 'throttle',
      variant: 'speed-switch',
      box: { x: 388, y: 548, w: 176, h: 330 },
    },
    {
      kind: 'inert',
      id: 'foam',
      label: 'Foam proportioner (selection and metering valves)',
      look: 'knobs',
      text: ['FOAM'],
      box: { x: 566, y: 570, w: 234, h: 254 },
    },
    {
      kind: 'inert',
      id: 'air-cleaner',
      label: 'Air cleaner indicator',
      look: 'indicator',
      box: { x: 855, y: 744, w: 80, h: 80 },
    },
  ],
};
