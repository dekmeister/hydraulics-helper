import type { RealisticLayout } from '../realistic';
import { CAT1_PANEL_PLATE } from './realisticPanel';

/** Lever length on the bay plates, plate units: long enough for a thumb on a 375 px phone. */
const LEVER_U = 128;

/**
 * Cat 1 tanker pump bay, from the photos (Resources/Photos/Cat1_*; Dek, 2026-10-25): the
 * instrument panel above with the tank's sight tube beside it, the plumbing and couplings below,
 * and an inset for what isn't on the rear: hydrant to tank (side of the truck). Positions follow the
 * real arrangement, enlarged and simplified; no branding. Levers swing in the drawing's plane:
 * across the pipe is shut, along it open.
 */
export const CAT1_REALISTIC: RealisticLayout = {
  applianceId: 'cat1-generic',
  plates: [
    CAT1_PANEL_PLATE,
    {
      // The sight tube beside the panel: watched while the operator monitors, not worked.
      id: 'tank',
      caption: null,
      viewBox: { w: 140, h: 912 },
      place: 'beside',
      art: [{ kind: 'plate', x: 70, y: 228, text: 'TANK' }],
      items: [
        { kind: 'tank-gauge', instrument: 'tank-level', box: { x: 10, y: 270, w: 120, h: 432 } },
      ],
    },
    {
      // Water in at the left, through the pump, out at the right. The tank feed and suction
      // meet and run into the pump's eye; the discharge leaves the volute's top, tees up (pump to
      // tank, back over the pump into the tank) and down to the manifold, its three outlet drops
      // and the riser to the right-hand reel.
      id: 'bay',
      caption: null,
      viewBox: { w: 1000, h: 720 },
      place: 'stack',
      art: [
        // Each run is split at its valve and drawn the way the water flows (see `PlateArt`).
        { kind: 'pipe', d: 'M60 0 V200', widthU: 34, water: { at: 'tank' } },
        {
          kind: 'pipe',
          d: 'M60 200 V300 H300',
          widthU: 34,
          water: { at: 'inlet', id: 'tank-to-pump', side: 'pump' },
        },
        {
          kind: 'pipe',
          d: 'M70 600 H180',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'source' },
        },
        {
          kind: 'pipe',
          d: 'M180 600 H300 V300',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'pump' },
        },
        {
          kind: 'pipe',
          d: 'M640 227 V150 H420',
          widthU: 22,
          water: { at: 'casing', feeds: ['pump-to-tank'] },
        },
        { kind: 'pipe', d: 'M420 150 H250 V0', widthU: 22, water: { at: 'pumpToTank' } },
        // The manifold: each run flows only toward the outlets drawing through it.
        { kind: 'pipe', d: 'M640 440 H560', widthU: 34, water: { at: 'casing', feeds: ['d1'] } },
        {
          kind: 'pipe',
          d: 'M640 440 H710',
          widthU: 34,
          water: { at: 'casing', feeds: ['d2', 'd3'] },
        },
        { kind: 'pipe', d: 'M710 440 H860', widthU: 34, water: { at: 'casing', feeds: ['d3'] } },
        // On to the reel riser: the reels aren't in the game, so this water never moves.
        { kind: 'pipe', d: 'M860 440 H955 V85', widthU: 22, water: { at: 'casing', feeds: [] } },
        ...(['d1', 'd2', 'd3'] as const).flatMap((id, i) => {
          const x = String(560 + 150 * i);
          return [
            {
              kind: 'pipe' as const,
              d: `M${x} 440 V560`,
              widthU: 28,
              water: { at: 'casing' as const, feeds: [id] },
            },
            {
              kind: 'pipe' as const,
              d: `M${x} 560 V640`,
              widthU: 28,
              water: { at: 'delivery' as const, id },
            },
          ];
        }),
        { kind: 'pipe', d: 'M590 227 H640', widthU: 34, water: { at: 'casing' } },
        {
          kind: 'pipe',
          d: 'M640 227 V440',
          widthU: 34,
          water: { at: 'casing', feeds: ['d1', 'd2', 'd3'] },
        },
        {
          kind: 'casing',
          cx: 470,
          cy: 300,
          r: 90,
          label: 'PUMP',
          outlet: { x: 590, y: 227, dir: 'right', widthU: 34 },
          water: { at: 'casing' },
        },
        // Inlet over the casing's face into the eye.
        { kind: 'pipe', d: 'M300 300 H470', widthU: 34, water: { at: 'casing' } },
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
      place: 'inset',
      art: [
        {
          kind: 'pipe',
          d: 'M90 190 H230',
          widthU: 34,
          water: { at: 'inlet', id: 'hydrant-to-tank', side: 'source' },
        },
        {
          kind: 'pipe',
          d: 'M230 190 H500',
          widthU: 34,
          water: { at: 'inlet', id: 'hydrant-to-tank', side: 'pump' },
        },
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
  ],
};
