import { SCENE_VIEW } from '../geometry';
import { BUSH_EDGE, INTERFACE_LOTS } from '../site';
import { FireFront, Slope } from './BushBackdrop';
import { House, Scrub, Street } from './parts';

// The urban interface (issue #10): the edge of town on the truck's side, with its street, hydrant
// and houses; up and right of the bush edge the slope, scrub and fire front of the bush backdrop.

const { w } = SCENE_VIEW;

/** The bush, up and right of its edge. */
const BUSH = `${BUSH_EDGE} L${String(w)} 0 Z`;

/** Scrub in the bush, all of it beyond the edge. */
const SCRUB: readonly [number, number, number][] = [
  [430, 30, 0.9],
  [520, 64, 1],
  [560, 22, 0.85],
  [744, 118, 0.8],
  [776, 58, 0.9],
];

export function InterfaceBackdrop() {
  return (
    <>
      <defs>
        <clipPath id="scene-bush">
          <path d={BUSH} />
        </clipPath>
      </defs>
      <g clipPath="url(#scene-bush)">
        <path className="scene-ground scene-ground--1" d={BUSH} />
        <Slope />
      </g>
      <path className="scene-bush-edge" d={BUSH_EDGE} />
      <FireFront />
      <Street />
      {INTERFACE_LOTS.map((lot) => (
        <House key={`${String(lot.x)},${String(lot.y)}`} lot={lot} />
      ))}
      {SCRUB.map(([x, y, s]) => (
        <Scrub key={`${String(x)},${String(y)}`} x={x} y={y} s={s} />
      ))}
    </>
  );
}
