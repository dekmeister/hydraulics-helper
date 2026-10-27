import { SCENE_VIEW } from '../geometry';
import { BURNING, VILLAGE_LOTS } from '../site';
import { FireGlow, HipRoof, House, Scrub, Smoke, Street } from './parts';

// The village (issue #10): a street with the hydrant on its verge, houses in fenced yards, and one
// house alight up and right of the truck, where the crews' streams go. Flat ground, so no contours.

const { w, h } = SCENE_VIEW;

/** Street trees and the odd tree in a paddock between the houses. */
const TREES: readonly [number, number, number][] = [
  [36, 430, 0.7],
  [118, 470, 0.6],
  [470, 40, 0.65],
  [560, 24, 0.55],
  [600, 482, 0.6],
  [330, 40, 0.6],
];

/** The burning house's smoke, blown off to the north-east. */
const PLUME = [
  [716, 118, 18],
  [742, 92, 24],
  [770, 60, 30],
  [796, 24, 34],
] as const;

/** Flames licking from the roof, in roof-local units: [x, y, scale]. */
const FLAMES: readonly [number, number, number][] = [
  [10, -30, 1],
  [36, -14, 0.8],
  [28, 20, 0.9],
  [-6, 4, 0.7],
];

function BurningHouse() {
  const { x, y, w: bw, h: bh, deg } = BURNING;
  return (
    <g data-testid="scene-burning-house">
      <ellipse className="scene-ash" cx={x + 8} cy={y} rx={bw * 0.75} ry={bh * 0.85} />
      <FireGlow id="scene-house-fire" cx={x / w} cy={y / h} r={0.32} />
      <g transform={`translate(${String(x)} ${String(y)}) rotate(${String(deg)})`}>
        <rect className="scene-shadow" x={-bw / 2 + 5} y={-bh / 2 + 6} width={bw} height={bh} />
        <HipRoof w={bw} h={bh} className="scene-roof scene-roof--iron" />
        {/* The roof has burnt through over the back half. */}
        <path
          className="scene-char"
          d={`M${String(-4)} ${String(-bh / 2)} L${String(bw / 2)} ${String(-bh / 2)} L${String(bw / 2)} ${String(bh / 2)} L${String(14)} ${String(bh / 2)} C 4 10, 18 -4, -4 ${String(-bh / 2)} Z`}
        />
        {FLAMES.map(([fx, fy, s]) => (
          <g
            key={`${String(fx)},${String(fy)}`}
            transform={`translate(${String(fx)} ${String(fy)}) scale(${String(s)})`}
          >
            <path className="scene-flame" d="M0 10 C -9 4, -6 -6, 0 -14 C 6 -6, 9 4, 0 10 Z" />
            <path className="scene-flame__core" d="M0 7 C -4 3, -3 -2, 0 -6 C 3 -2, 4 3, 0 7 Z" />
          </g>
        ))}
      </g>
      <Smoke puffs={PLUME} />
    </g>
  );
}

export function VillageBackdrop() {
  return (
    <>
      <Street />
      {VILLAGE_LOTS.map((lot) => (
        <House key={`${String(lot.x)},${String(lot.y)}`} lot={lot} />
      ))}
      {TREES.map(([x, y, s]) => (
        <Scrub key={`${String(x)},${String(y)}`} x={x} y={y} s={s} />
      ))}
      <BurningHouse />
    </>
  );
}
