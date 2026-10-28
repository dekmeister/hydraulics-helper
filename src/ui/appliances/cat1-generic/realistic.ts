import type { RealisticLayout } from '../realistic';
import { CAT1_PANEL_PLATE } from './realisticPanel';

/** Lever length on the bay plates, plate units: long enough for a thumb on a 375 px phone. */
const LEVER_U = 128;

/**
 * Cat 1 tanker pump bay, from the Cat1B photos (Resources/Photos/Cat1B_*; Dek, 2026-10-28): the
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
      // As tall as the instrument panel beside it, the tube centred on it.
      viewBox: { w: 140, h: 952 },
      place: 'beside',
      art: [{ kind: 'plate', x: 70, y: 218, text: 'TANK' }],
      items: [
        { kind: 'tank-gauge', instrument: 'tank-level', box: { x: 10, y: 260, w: 120, h: 432 } },
      ],
    },
    {
      // Water in at the left, through the pump, out at the right. The tank feed and the external
      // inlet meet and run into the pump's eye; the discharge leaves the volute's top, tees up to
      // the left reel and down to the manifold under the pump. Off the manifold: pump to tank at its
      // left end (back into the tank, passing in front of the external inlet's riser as on the
      // truck), the outlets 38 | 65 | 38, and the riser to the right reel.
      id: 'bay',
      caption: null,
      viewBox: { w: 1000, h: 740 },
      place: 'stack',
      art: [
        // Each run is split at its valve and drawn the way the water flows (see `PlateArt`).
        { kind: 'pipe', d: 'M60 0 V170', widthU: 34, water: { at: 'tank' } },
        {
          kind: 'pipe',
          d: 'M60 170 V300 H250',
          widthU: 34,
          water: { at: 'inlet', id: 'tank-to-pump', side: 'pump' },
        },
        {
          kind: 'pipe',
          d: 'M70 640 H180',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'source' },
        },
        {
          kind: 'pipe',
          d: 'M180 640 H250 V300',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'pump' },
        },
        // The discharge, and the left reel's branch up off it: the reels aren't in the game, so
        // that water never moves.
        { kind: 'pipe', d: 'M560 227 H620', widthU: 34, water: { at: 'casing' } },
        { kind: 'pipe', d: 'M620 227 V70', widthU: 22, water: { at: 'casing', feeds: [] } },
        {
          kind: 'pipe',
          d: 'M620 227 V470',
          widthU: 34,
          water: { at: 'casing', feeds: ['d1', 'd2', 'd3', 'pump-to-tank'] },
        },
        // The manifold: each run flows only toward the outlets drawing through it.
        {
          kind: 'pipe',
          d: 'M620 470 H545',
          widthU: 34,
          water: { at: 'casing', feeds: ['d1', 'pump-to-tank'] },
        },
        {
          kind: 'pipe',
          d: 'M545 470 H300',
          widthU: 22,
          water: { at: 'casing', feeds: ['pump-to-tank'] },
        },
        // Pump to tank, left into the tank through the frame.
        { kind: 'pipe', d: 'M300 470 H0', widthU: 22, water: { at: 'pumpToTank' } },
        {
          kind: 'pipe',
          d: 'M620 470 H695',
          widthU: 34,
          water: { at: 'casing', feeds: ['d2', 'd3'] },
        },
        { kind: 'pipe', d: 'M695 470 H845', widthU: 34, water: { at: 'casing', feeds: ['d3'] } },
        { kind: 'pipe', d: 'M845 470 H960 V85', widthU: 22, water: { at: 'casing', feeds: [] } },
        ...(['d1', 'd2', 'd3'] as const).flatMap((id, i) => {
          const x = String(545 + 150 * i);
          // The 65 mm centre drop is the bigger pipe.
          const widthU = id === 'd2' ? 34 : 28;
          return [
            {
              kind: 'pipe' as const,
              d: `M${x} 470 V560`,
              widthU,
              water: { at: 'casing' as const, feeds: [id] },
            },
            {
              kind: 'pipe' as const,
              d: `M${x} 560 V640`,
              widthU,
              water: { at: 'delivery' as const, id },
            },
          ];
        }),
        {
          kind: 'casing',
          cx: 440,
          cy: 300,
          r: 90,
          label: 'PUMP',
          outlet: { x: 560, y: 227, dir: 'right', widthU: 34 },
          water: { at: 'casing' },
        },
        // Inlet over the casing's face into the eye.
        { kind: 'pipe', d: 'M250 300 H440', widthU: 34, water: { at: 'casing' } },
        { kind: 'fitting', cx: 440, cy: 300, r: 30 },
        { kind: 'fitting', cx: 60, cy: 300, r: 19 },
        { kind: 'fitting', cx: 250, cy: 300, r: 19 },
        { kind: 'fitting', cx: 620, cy: 227, r: 19 },
        { kind: 'fitting', cx: 620, cy: 470, r: 19 },
        { kind: 'fitting', cx: 545, cy: 470, r: 19 },
        { kind: 'fitting', cx: 695, cy: 470, r: 19 },
        { kind: 'fitting', cx: 845, cy: 470, r: 19 },
        { kind: 'fitting', cx: 960, cy: 470, r: 15 },
        { kind: 'flange', x: 60, y: 6, widthU: 34, along: 'v' },
        { kind: 'flange', x: 6, y: 470, widthU: 22, along: 'h' },
        { kind: 'coupling', cx: 70, cy: 640, r: 58 },
        { kind: 'text', x: 87, y: 30, text: 'FROM TANK', anchor: 'start' },
        { kind: 'text', x: 20, y: 505, text: 'TO TANK', anchor: 'start' },
        { kind: 'plate', x: 186, y: 245, text: 'TANK TO PUMP' },
        { kind: 'plate', x: 125, y: 430, text: 'PUMP TO TANK', w: 170 },
        { kind: 'plate', x: 220, y: 712, text: 'EXTERNAL INLET', w: 180 },
      ],
      items: [
        {
          kind: 'lever',
          control: 'tank-to-pump',
          pivot: { x: 60, y: 170 },
          shutDeg: 90,
          openDeg: 0,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'pump-to-tank',
          pivot: { x: 300, y: 470 },
          shutDeg: 0,
          openDeg: 90,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'suction',
          pivot: { x: 180, y: 640 },
          shutDeg: 0,
          openDeg: 90,
          lengthU: LEVER_U,
        },
        // The PRIME T-handle sits on the bumper between the external inlet and the outlets.
        {
          kind: 'primer',
          control: 'primer',
          variant: 'pull-handle',
          box: { x: 330, y: 510, w: 140, h: 190 },
        },
        ...(['d1', 'd2', 'd3'] as const).map((control, i) => {
          const x = 545 + 150 * i;
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
          id: 'reel-left',
          label: 'Left hose reel and its valve',
          look: 'reel',
          box: { x: 580, y: 20, w: 80, h: 100 },
        },
        {
          kind: 'inert',
          id: 'reels',
          label: 'Right hose reel and its valve',
          look: 'reel',
          box: { x: 920, y: 30, w: 80, h: 110 },
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
