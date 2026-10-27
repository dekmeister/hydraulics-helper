import { SCENE_VIEW } from '../geometry';
import { DAM, FIRE_FRONT, TRACK } from '../site';
import { FireGlow, Scrub, Smoke } from './parts';

// The bush (Design §7, sheet 06): ground tints, contours, track, scrub, the dam, fire glow at the
// edge. Contours are unlabelled because the ground isn't modelled: a line's elevation is shown at
// its branch instead.

const { w } = SCENE_VIEW;

/** Contours with the x they start from at the left; the middle one is an index contour. */
export const CONTOURS: readonly { d: string; startX: number }[] = [
  { d: 'M0 300 C 160 280, 320 330, 450 300 S 640 250, 800 275', startX: 0 },
  { d: 'M100 190 C 240 165, 380 215, 510 190 S 690 165, 800 190', startX: 100 },
  { d: 'M240 100 C 360 75, 500 115, 610 90 S 740 58, 800 75', startX: 240 },
];

/** Ground tints step lighter uphill: each fills from its contour to the top edge. */
const TINTS = CONTOURS.map(({ d, startX }) => `${d} L${String(w)} 0 L${String(startX)} 0 Z`);

const SCRUB: readonly [number, number, number][] = [
  [48, 208, 1],
  [24, 250, 0.8],
  [416, 125, 1],
  [469, 147, 0.85],
  [362, 207, 0.75],
  [512, 467, 1],
  [560, 433, 0.9],
  [740, 420, 0.9],
  [700, 446, 0.7],
  [240, 33, 0.8],
];

/** The fire front's smoke, off the top-right corner. */
export const FRONT_SMOKE = [
  [750, 18, 32],
  [788, 56, 27],
  [703, 5, 22],
] as const;

/** Tints and contours: the slope, lighter uphill towards the fire. */
export function Slope() {
  return (
    <>
      {TINTS.map((d, i) => (
        <path key={d} className={`scene-ground scene-ground--${String(i + 1)}`} d={d} />
      ))}
      {CONTOURS.map(({ d }, i) => (
        <path
          key={d}
          className={i === 1 ? 'scene-contour scene-contour--index' : 'scene-contour'}
          d={d}
        />
      ))}
    </>
  );
}

/** Burnt ground behind the fire front, its glow, the front and its smoke. */
export function FireFront() {
  return (
    <>
      <path className="scene-ash" d={`${FIRE_FRONT} L${String(w)} 0 Z`} />
      <FireGlow id="scene-fire" cx={1} cy={0} r={0.62} />
      <path className="scene-fire-front scene-fire-front--glow" d={FIRE_FRONT} />
      <path className="scene-fire-front" d={FIRE_FRONT} />
      <Smoke puffs={FRONT_SMOKE} />
    </>
  );
}

export function BushBackdrop() {
  return (
    <>
      <Slope />
      <FireFront />
      <path className="scene-track" d={TRACK} />
      <path className="scene-track__ruts" d={TRACK} />
      {SCRUB.map(([x, y, s]) => (
        <Scrub key={`${String(x)},${String(y)}`} x={x} y={y} s={s} />
      ))}
      <path className="scene-dam" d={DAM.path} />
      <g className="scene-dam__ripples">
        {DAM.ripples.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <text className="scene-dam__label" x={DAM.label.x} y={DAM.label.y}>
        DAM
      </text>
    </>
  );
}
