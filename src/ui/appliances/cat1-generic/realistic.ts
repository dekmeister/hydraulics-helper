import type { RealisticLayout } from '../realistic';
import { CAT1_PANEL_PLATE } from './realisticPanel';

/** Lever length on the bay plates, plate units: long enough for a thumb on a 375 px phone. */
const LEVER_U = 128;

/**
 * Cat 1 tanker pump bay, from the photos (Resources/Photos/Cat1_*; Dek, 2026-10-25): the
 * instrument panel above, the plumbing and couplings below it, and two insets for what isn't on
 * the rear: hydrant to tank (side of the truck) and the tank's sight tube. Positions follow the
 * real arrangement, enlarged and simplified; no branding. Levers swing in the drawing's plane:
 * across the pipe is shut, along it open.
 */
export const CAT1_REALISTIC: RealisticLayout = {
  applianceId: 'cat1-generic',
  plates: [
    CAT1_PANEL_PLATE,
    {
      // Water in at the left, through the pump, out at the right. The tank feed and suction
      // meet and run into the pump's eye; the discharge leaves the volute's top, tees up (pump to
      // tank, back over the pump into the tank) and down to the manifold, its three outlet drops
      // and the riser to the right-hand reel.
      id: 'bay',
      caption: null,
      viewBox: { w: 1000, h: 720 },
      inset: false,
      art: [
        { kind: 'pipe', d: 'M60 0 V300', widthU: 34 },
        { kind: 'pipe', d: 'M70 600 H300 V300', widthU: 34 },
        { kind: 'pipe', d: 'M640 227 V150 H250 V0', widthU: 22 },
        { kind: 'pipe', d: 'M560 440 H955', widthU: 34 },
        { kind: 'pipe', d: 'M560 440 V640 M710 440 V640 M860 440 V640', widthU: 28 },
        { kind: 'pipe', d: 'M955 440 V85', widthU: 22 },
        { kind: 'pipe', d: 'M590 227 H640 V440', widthU: 34 },
        {
          kind: 'casing',
          cx: 470,
          cy: 300,
          r: 90,
          label: 'PUMP',
          outlet: { x: 590, y: 227, dir: 'right', widthU: 34 },
        },
        // Inlet over the casing's face into the eye.
        { kind: 'pipe', d: 'M60 300 H470', widthU: 34 },
        { kind: 'fitting', cx: 470, cy: 300, r: 30 },
        { kind: 'fitting', cx: 60, cy: 300, r: 19 },
        { kind: 'fitting', cx: 300, cy: 300, r: 19 },
        { kind: 'fitting', cx: 640, cy: 227, r: 19 },
        { kind: 'fitting', cx: 640, cy: 440, r: 19 },
        { kind: 'fitting', cx: 560, cy: 440, r: 19 },
        { kind: 'fitting', cx: 710, cy: 440, r: 19 },
        { kind: 'fitting', cx: 860, cy: 440, r: 19 },
        { kind: 'fitting', cx: 955, cy: 440, r: 19 },
        { kind: 'flange', x: 60, y: 6, widthU: 34, along: 'v' },
        { kind: 'flange', x: 250, y: 6, widthU: 22, along: 'v' },
        { kind: 'coupling', cx: 70, cy: 600, r: 58 },
        { kind: 'text', x: 87, y: 30, text: 'FROM TANK', anchor: 'start' },
        { kind: 'text', x: 271, y: 30, text: 'TO TANK', anchor: 'start' },
        { kind: 'plate', x: 186, y: 245, text: 'TANK TO PUMP' },
        { kind: 'plate', x: 540, y: 110, text: 'PUMP TO TANK' },
        { kind: 'plate', x: 200, y: 668, text: 'SUCTION' },
      ],
      items: [
        {
          kind: 'lever',
          control: 'tank-to-pump',
          pivot: { x: 60, y: 200 },
          shutDeg: 90,
          openDeg: 0,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'pump-to-tank',
          pivot: { x: 420, y: 150 },
          shutDeg: 0,
          openDeg: -90,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'suction',
          pivot: { x: 180, y: 600 },
          shutDeg: 0,
          openDeg: 90,
          lengthU: LEVER_U,
        },
        // The PRIME T-handle sits on the bumper between the suction and the outlets.
        {
          kind: 'primer',
          control: 'primer',
          variant: 'pull-handle',
          box: { x: 340, y: 480, w: 150, h: 200 },
        },
        ...(['d1', 'd2', 'd3'] as const).map((control, i) => {
          const x = 560 + 150 * i;
          return {
            kind: 'outlet' as const,
            control,
            pivot: { x, y: 560 },
            shutDeg: 90,
            openDeg: 0,
            lengthU: LEVER_U,
            // Centred on its drop, which ends at the coupling's centre.
            coupling: { x: x - 70, y: 580, w: 140, h: 140 },
          };
        }),
        {
          kind: 'inert',
          id: 'reels',
          label: 'Hose reels and the right reel valve',
          look: 'reel',
          box: { x: 915, y: 30, w: 80, h: 110 },
        },
      ],
    },
    {
      id: 'side',
      caption: 'Side of truck',
      viewBox: { w: 500, h: 300 },
      inset: true,
      art: [
        { kind: 'pipe', d: 'M90 190 H500', widthU: 34 },
        { kind: 'flange', x: 494, y: 190, widthU: 34, along: 'h' },
        { kind: 'coupling', cx: 90, cy: 190, r: 60 },
        { kind: 'text', x: 430, y: 150, text: 'TO TANK' },
        { kind: 'plate', x: 280, y: 262, text: 'HYDRANT TO TANK' },
      ],
      items: [
        {
          kind: 'lever',
          control: 'hydrant-to-tank',
          pivot: { x: 230, y: 190 },
          shutDeg: 0,
          openDeg: 90,
          lengthU: LEVER_U,
        },
      ],
    },
    {
      id: 'tank',
      caption: 'Tank',
      viewBox: { w: 300, h: 300 },
      inset: true,
      art: [],
      items: [
        { kind: 'tank-gauge', instrument: 'tank-level', box: { x: 110, y: 10, w: 80, h: 280 } },
      ],
    },
  ],
};
