// The fireground the scene is drawn on (Design §7, sheet 06): where the truck parks, which way the
// fire lies, and where the dam, track and fire front sit. One definition, so the truck's anchor and
// the scenery it is parked among can't drift apart (geometry.test.ts checks they don't collide).

/** Where the truck is parked, drawing units: left of centre, room to lay out towards the fire. */
export const TRUCK_AT = { x: 230, y: 330 } as const;

/**
 * With several trucks (relays), the one nearest the fire (the attack pump) stands here, up the
 * track towards the fire; trucks further back along a relay stand between it and `TRUCK_AT`, by
 * the water.
 */
export const ATTACK_AT = { x: 470, y: 230 } as const;

/** The fire front lies up and to the right of the truck; lays fan out about this heading, degrees (y down). */
export const FIRE_HEADING_DEG = -25;

/** Fire front at the top-right corner of the view, across `FIRE_HEADING_DEG` from the truck. */
export const FIRE_FRONT = 'M610 0 C 640 25, 688 17, 720 42 S 792 67, 800 100';

/** A point on the fire front, to measure how near a truck stands to it. */
export const FIRE_FRONT_AT = { x: 720, y: 42 } as const;

/** Farm track: passes the truck on its fire side and runs off the top-left; never under the truck. */
export const TRACK =
  'M480 500 C 460 430, 430 360, 380 290 C 340 230, 240 230, 160 190 S 64 60, 43 0';

/** The dam, just behind the cab: in suction-hose reach of the truck (M4 draughts from it). */
export const DAM = {
  path: 'M23 435 C 19 400, 62 385, 105 395 C 139 403, 151 425, 139 450 C 124 480, 43 485, 28 465 C 23 457, 25 448, 23 435 Z',
  /** Bounding box of the path's points (control points included, so it contains the outline). */
  box: { x0: 19, y0: 385, x1: 151, y1: 485 },
  ripples: [
    'M52 406 q6 -2 11 0',
    'M81 426 q6 -2 11 0',
    'M57 445 q5 -2 10 0',
    'M100 402 q5 -2 10 0',
  ],
  label: { x: 58, y: 440 },
  /** Where hard suction goes in: just inside the bank nearest the truck. */
  intake: { x: 122, y: 414 },
} as const;

/** A hydrant on the track's verge below the truck: in layflat reach of a suction inlet. */
export const HYDRANT = { x: 372, y: 452, label: { x: 390, y: 478 } } as const;

/**
 * The village street (issue #10) runs where the farm track does, so the truck parks on its verge
 * and the hydrant stands beside it whatever the setting.
 */
export const STREET = TRACK;

/**
 * A house in plan: its roof centred at x, y, `w` × `h`, turned `deg`, in a fenced yard `YARD_U`
 * wider all round. Iron or tiled roof.
 */
export interface Lot {
  x: number;
  y: number;
  w: number;
  h: number;
  deg: number;
  roof: 'iron' | 'tile';
}

/** Yard beyond the house on every side, drawing units. */
export const YARD_U = 14;

/**
 * Houses along the street, clear of the truck, the hydrant and its layflat, and the fan the crews
 * lay out towards the fire in (geometry.test.ts checks).
 */
const WEST: Lot = { x: 78, y: 300, w: 56, h: 40, deg: -15, roof: 'tile' };
const NORTH: Lot = { x: 210, y: 92, w: 52, h: 38, deg: 28, roof: 'iron' };
const SOUTH: Lot = { x: 566, y: 422, w: 60, h: 42, deg: 0, roof: 'iron' };
const SOUTH_EAST: Lot = { x: 704, y: 404, w: 54, h: 40, deg: 6, roof: 'tile' };
const EAST: Lot = { x: 700, y: 300, w: 52, h: 38, deg: -6, roof: 'iron' };

export const VILLAGE_LOTS: readonly Lot[] = [WEST, NORTH, SOUTH, SOUTH_EAST, EAST];

/** The interface keeps its houses on the truck's side of the bush edge. */
export const INTERFACE_LOTS: readonly Lot[] = [WEST, NORTH, SOUTH, SOUTH_EAST];

/**
 * The house alight in the village, where the bush has its fire front: up and right of the truck,
 * between the two crews' streams.
 */
export const BURNING = { x: 690, y: 150, w: 96, h: 70, deg: -8 } as const;

/**
 * Where the bush begins at the urban interface: everything up and right of this line is bush
 * (tints, scrub, fire front), the rest the edge of town.
 */
export const BUSH_EDGE = 'M330 0 C 420 90, 560 150, 800 300';

/** Corners of a lot's yard (or of a rect with margin `pad`), for overlap checks. */
export function lotCorners(
  lot: Pick<Lot, 'x' | 'y' | 'w' | 'h' | 'deg'>,
  pad = YARD_U,
): { x: number; y: number }[] {
  const r = (lot.deg * Math.PI) / 180;
  const hw = lot.w / 2 + pad;
  const hh = lot.h / 2 + pad;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx = 0, dy = 0]) => ({
    x: lot.x + dx * Math.cos(r) - dy * Math.sin(r),
    y: lot.y + dx * Math.sin(r) + dy * Math.cos(r),
  }));
}
