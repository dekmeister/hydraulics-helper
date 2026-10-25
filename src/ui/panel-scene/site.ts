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
