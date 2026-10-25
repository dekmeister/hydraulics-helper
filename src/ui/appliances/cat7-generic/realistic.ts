import type { RealisticLayout } from '../realistic';
import { CAT7_PANEL_PLATE } from './realisticPanel';

/** Lever length on the bay plate, plate units: long enough for a thumb on a 375 px phone. */
const LEVER_U = 128;

/**
 * Cat 7 tanker pump bay, from the photos (Resources/Photos/Cat7_*; Dek, 2026-10-25) and the
 * hydraulic diagram on the locker door: the pump's own panel, then the bay as the operator faces
 * it. Left to right: the hose reel, the hand primer, the manifold's two outlets, the pump with its
 * recirculation line and the 3-way valve on top, then the strainer into the eye, where the tank
 * feed (from above) and the suction (from the coupling below) meet. Levers swing in the drawing's
 * plane: across the pipe is shut, along it open. The tank's sight tube is an inset: where the
 * Cat 7 shows its level isn't in the photos (CALIBRATION needs Dek 40).
 */
export const CAT7_REALISTIC: RealisticLayout = {
  applianceId: 'cat7-generic',
  plates: [
    CAT7_PANEL_PLATE,
    {
      id: 'bay',
      caption: null,
      viewBox: { w: 1000, h: 760 },
      inset: false,
      art: [
        // Supply, split at each valve and drawn the way the water flows (see `PlateArt`).
        { kind: 'pipe', d: 'M960 0 V200', widthU: 34, water: { at: 'tank' } },
        {
          kind: 'pipe',
          d: 'M960 200 V380 H900',
          widthU: 34,
          water: { at: 'inlet', id: 'tank-to-pump', side: 'pump' },
        },
        {
          kind: 'pipe',
          d: 'M900 600 V520',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'source' },
        },
        {
          kind: 'pipe',
          d: 'M900 520 V380',
          widthU: 34,
          water: { at: 'inlet', id: 'suction', side: 'pump' },
        },
        // Discharge: up out of the volute to a tee, pump to tank up into the tank, the manifold
        // left along the outlets to the reel.
        {
          kind: 'pipe',
          d: 'M602 230 V160',
          widthU: 34,
          water: { at: 'casing', feeds: ['d1', 'd2', 'pump-to-tank'] },
        },
        {
          kind: 'pipe',
          d: 'M602 160 V70',
          widthU: 22,
          water: { at: 'casing', feeds: ['pump-to-tank'] },
        },
        { kind: 'pipe', d: 'M602 70 V0', widthU: 22, water: { at: 'pumpToTank' } },
        {
          kind: 'pipe',
          d: 'M602 160 H440',
          widthU: 34,
          water: { at: 'casing', feeds: ['d1', 'd2'] },
        },
        { kind: 'pipe', d: 'M440 160 H260', widthU: 34, water: { at: 'casing', feeds: ['d1'] } },
        // On to the reel: the reel isn't in the game, so this water never moves.
        { kind: 'pipe', d: 'M260 160 H76 V180', widthU: 22, water: { at: 'casing', feeds: [] } },
        ...(['d1', 'd2'] as const).flatMap((id, i) => {
          const x = String(260 + 180 * i);
          return [
            {
              kind: 'pipe' as const,
              d: `M${x} 160 V330`,
              widthU: 28,
              water: { at: 'casing' as const, feeds: [id] },
            },
            {
              kind: 'pipe' as const,
              d: `M${x} 330 V410`,
              widthU: 28,
              water: { at: 'delivery' as const, id },
            },
          ];
        }),
        // Recirculation: off the volute, through the 3-way valve and a check valve into the tank.
        { kind: 'pipe', d: 'M740 306 V0', widthU: 16, water: { at: 'recirc' } },
        {
          kind: 'casing',
          cx: 680,
          cy: 380,
          r: 95,
          label: 'PUMP',
          outlet: { x: 602, y: 230, dir: 'up', widthU: 34 },
          water: { at: 'casing' },
        },
        // Through the Y-strainer into the eye, over the casing's face.
        { kind: 'pipe', d: 'M900 380 H680', widthU: 34, water: { at: 'casing' } },
        { kind: 'fitting', cx: 680, cy: 380, r: 30 },
        { kind: 'fitting', cx: 800, cy: 380, r: 28 },
        { kind: 'fitting', cx: 900, cy: 380, r: 19 },
        { kind: 'fitting', cx: 960, cy: 380, r: 19 },
        { kind: 'fitting', cx: 602, cy: 160, r: 19 },
        { kind: 'fitting', cx: 440, cy: 160, r: 19 },
        { kind: 'fitting', cx: 260, cy: 160, r: 19 },
        { kind: 'flange', x: 960, y: 6, widthU: 34, along: 'v' },
        { kind: 'flange', x: 602, y: 6, widthU: 22, along: 'v' },
        { kind: 'flange', x: 740, y: 6, widthU: 16, along: 'v' },
        { kind: 'coupling', cx: 900, cy: 600, r: 58 },
        { kind: 'text', x: 948, y: 30, text: 'FROM TANK', anchor: 'end' },
        { kind: 'text', x: 614, y: 30, text: 'TO TANK', anchor: 'start' },
        { kind: 'text', x: 752, y: 56, text: 'RECIRC', anchor: 'start' },
        { kind: 'plate', x: 440, y: 60, text: 'PUMP TO TANK' },
        { kind: 'plate', x: 850, y: 260, text: 'TANK TO PUMP' },
        { kind: 'plate', x: 900, y: 700, text: 'SUCTION' },
      ],
      items: [
        {
          kind: 'inert',
          id: 'reel',
          label: 'Hose reel',
          look: 'reel',
          box: { x: 16, y: 20, w: 120, h: 150 },
        },
        {
          kind: 'inert',
          id: 'reel-valve',
          label: 'Hose reel valve',
          look: 'valve',
          box: { x: 122, y: 132, w: 56, h: 56 },
        },
        {
          kind: 'inert',
          id: 'three-way',
          label: '3-way valve: tank recirculation or foam (set to TANK RECIRC)',
          look: 'valve',
          box: { x: 712, y: 120, w: 56, h: 56 },
        },
        {
          kind: 'lever',
          control: 'tank-to-pump',
          pivot: { x: 960, y: 200 },
          shutDeg: -90,
          openDeg: 0,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'pump-to-tank',
          pivot: { x: 602, y: 70 },
          shutDeg: 90,
          openDeg: 180,
          lengthU: LEVER_U,
        },
        {
          kind: 'lever',
          control: 'suction',
          pivot: { x: 900, y: 520 },
          shutDeg: -90,
          openDeg: 0,
          lengthU: LEVER_U,
        },
        // The hand primer stands left of the outlets, low on the bay.
        {
          kind: 'primer',
          control: 'primer',
          variant: 'hand-pump',
          box: { x: 20, y: 400, w: 150, h: 240 },
        },
        ...(['d1', 'd2'] as const).map((control, i) => {
          const x = 260 + 180 * i;
          return {
            kind: 'outlet' as const,
            control,
            pivot: { x, y: 330 },
            shutDeg: 90,
            openDeg: 0,
            lengthU: LEVER_U,
            // Centred on its drop, which ends at the coupling's centre.
            coupling: { x: x - 70, y: 350, w: 140, h: 140 },
          };
        }),
      ],
    },
    {
      id: 'tank',
      // The only inset, so it spans the row: wide, with the tube in the middle.
      caption: 'Tank (position to confirm)',
      viewBox: { w: 1000, h: 300 },
      inset: true,
      art: [],
      items: [
        { kind: 'tank-gauge', instrument: 'tank-level', box: { x: 460, y: 10, w: 80, h: 280 } },
      ],
    },
  ],
};
