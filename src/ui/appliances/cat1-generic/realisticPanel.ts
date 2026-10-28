import type { RealPlate } from '../realistic';

/**
 * Cat 1 instrument panel, above the pump bay (Resources/Photos/Cat1B_Panel.jpg): the real
 * arrangement on a regular grid, enlarged and simplified to limits and labels; no branding.
 */
export const CAT1_PANEL_PLATE: RealPlate = {
  // On a grid: 32 u margins; the limits over their dials, the dials on one top line with their
  // plates under them, the lamps in a 2 × 2 grid under the tacho, then the stopping note, the
  // switches, speed controller and foam metering knob along the bottom.
  id: 'panel',
  caption: null,
  viewBox: { w: 1000, h: 952 },
  place: 'stack',
  art: [
    { kind: 'panel', box: { x: 4, y: 4, w: 992, h: 944 } },
    { kind: 'plate', x: 167, y: 66, text: 'DO NOT EXCEED −80 kPa', w: 270 },
    { kind: 'plate', x: 750, y: 66, text: 'DO NOT EXCEED 3000 RPM', w: 270 },
    { kind: 'plate', x: 167, y: 392, text: 'COMPOUND', w: 200 },
    { kind: 'plate', x: 467, y: 392, text: 'PRESSURE', w: 200 },
    { kind: 'plate', x: 690, y: 412, text: 'PUMP RUNNING', w: 170 },
    { kind: 'plate', x: 870, y: 412, text: 'ALTERNATOR', w: 170 },
    { kind: 'plate', x: 690, y: 522, text: 'ENGINE FAULT', w: 170 },
    { kind: 'plate', x: 870, y: 522, text: 'WATER TEMP', w: 170 },
    { kind: 'plate', x: 117, y: 570, text: 'STOP', w: 84 },
    { kind: 'plate', x: 291, y: 570, text: 'IGNITION', w: 120 },
    { kind: 'plate', x: 465, y: 570, text: 'START', w: 84 },
    { kind: 'plate', x: 654, y: 570, text: 'THROTTLE', w: 140 },
  ],
  items: [
    {
      kind: 'gauge',
      instrument: 'compound',
      dial: 'compound',
      box: { x: 32, y: 100, w: 270, h: 270 },
    },
    {
      kind: 'gauge',
      instrument: 'discharge',
      dial: 'discharge',
      box: { x: 332, y: 100, w: 270, h: 270 },
    },
    {
      kind: 'gauge',
      instrument: 'tacho',
      dial: 'tacho',
      box: { x: 650, y: 115, w: 200, h: 200 },
    },
    {
      kind: 'engine-lamp',
      id: 'pump-running',
      label: 'Pump running lamp',
      litWhen: 'running',
      tone: 'green',
      box: { x: 660, y: 335, w: 60, h: 60 },
    },
    {
      kind: 'engine-lamp',
      id: 'alt',
      label: 'Alternator (charge) lamp',
      box: { x: 840, y: 335, w: 60, h: 60 },
    },
    {
      kind: 'engine-lamp',
      id: 'engine-fault',
      label: 'Engine fault lamp',
      box: { x: 660, y: 445, w: 60, h: 60 },
    },
    {
      kind: 'inert',
      id: 'water-temp',
      label: 'Engine water temperature lamp',
      look: 'lamp',
      box: { x: 840, y: 445, w: 60, h: 60 },
    },
    {
      kind: 'inert',
      id: 'stop-note',
      label: 'Stopping placard',
      look: 'placard',
      box: { x: 167, y: 432, w: 300, h: 72 },
      text: ['NOTE:', 'To stop pump, ignition must be on'],
    },
    // Energise-to-stop: works only with the ignition on (the placard above it).
    {
      kind: 'engine-switch',
      control: 'stop',
      look: 'button',
      box: { x: 32, y: 600, w: 170, h: 170 },
    },
    {
      kind: 'engine-switch',
      control: 'ignition',
      look: 'toggle',
      box: { x: 206, y: 600, w: 170, h: 170 },
    },
    {
      kind: 'engine-switch',
      control: 'start',
      look: 'button',
      box: { x: 380, y: 600, w: 170, h: 170 },
    },
    {
      // Tall so each half takes a thumb, with the tank column beside the panel narrowing it on a
      // phone.
      kind: 'throttle',
      variant: 'speed-switch',
      box: { x: 566, y: 600, w: 176, h: 320 },
    },
    {
      kind: 'inert',
      id: 'foam',
      label: 'Foam metering valve',
      look: 'knob',
      text: ['FOAM'],
      box: { x: 774, y: 600, w: 194, h: 220 },
    },
  ],
};
