import { SCENE_VIEW } from '../geometry';
import { STREET, YARD_U, type Lot } from '../site';

// Scenery shared by the settings' backdrops (Design §7, sheet 06): flat plan-view shapes in the
// map's muted palette, decorative only.

const { w, h } = SCENE_VIEW;

/** A clump of scrub, or a garden tree at a smaller scale. */
export function Scrub({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${String(x)} ${String(y)}) scale(${String(s)})`}>
      <ellipse className="scene-shadow" cx="5" cy="6" rx="26" ry="20" />
      <path
        className="scene-scrub"
        d="M-22 4 c-6 -14 8 -24 20 -18 c6 -12 26 -8 26 6 c14 0 16 18 3 22 c-9 10 -26 8 -30 0 c-12 4 -24 -4 -19 -10 Z"
      />
      <path className="scene-scrub__highlight" d="M-12 -6 c2 -6 10 -8 14 -3" />
    </g>
  );
}

/** A glow of fire light centred at (cx, cy) as fractions of the view, `r` of its size. */
export function FireGlow({ id, cx, cy, r }: { id: string; cx: number; cy: number; r: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx={cx} cy={cy} r={r}>
          <stop offset="0" stopColor="var(--color-signal-alarm)" stopOpacity="0.5" />
          <stop offset="0.4" stopColor="var(--color-signal-caution)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-signal-caution)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

/** Smoke drifting off to the north-east, as overlapping puffs [x, y, r]. */
export function Smoke({ puffs }: { puffs: readonly (readonly [number, number, number])[] }) {
  return (
    <g className="scene-smoke">
      {puffs.map(([x, y, r]) => (
        <circle key={`${String(x)},${String(y)}`} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

/** The village street: sealed, kerbed, a dashed centre line. */
export function Street() {
  return (
    <g>
      <path className="scene-street__kerb" d={STREET} />
      <path className="scene-street" d={STREET} />
      <path className="scene-street__line" d={STREET} />
    </g>
  );
}

/** A hip roof in plan: the ridge along the long side and a hip line to each corner. */
export function HipRoof({ w: rw, h: rh, className }: { w: number; h: number; className: string }) {
  const ridge = Math.max(0, rw / 2 - rh / 2);
  const [x0, x1, y0, y1] = [-rw / 2, rw / 2, -rh / 2, rh / 2];
  return (
    <>
      <rect className={className} x={x0} y={y0} width={rw} height={rh} />
      <path
        className="scene-roof__ridge"
        d={`M${String(x0)} ${String(y0)} L${String(-ridge)} 0 L${String(x0)} ${String(y1)} M${String(-ridge)} 0 L${String(ridge)} 0 M${String(x1)} ${String(y0)} L${String(ridge)} 0 L${String(x1)} ${String(y1)}`}
      />
    </>
  );
}

/** A house in its fenced yard, with a tree in the back corner. */
export function House({ lot }: { lot: Lot }) {
  const yw = lot.w + 2 * YARD_U;
  const yh = lot.h + 2 * YARD_U;
  return (
    <g transform={`translate(${String(lot.x)} ${String(lot.y)}) rotate(${String(lot.deg)})`}>
      <rect className="scene-lawn" x={-yw / 2} y={-yh / 2} width={yw} height={yh} />
      <rect
        className="scene-shadow"
        x={-lot.w / 2 + 4}
        y={-lot.h / 2 + 5}
        width={lot.w}
        height={lot.h}
      />
      <HipRoof w={lot.w} h={lot.h} className={`scene-roof scene-roof--${lot.roof}`} />
      <Scrub x={-lot.w / 2 - 2} y={-lot.h / 2 - 2} s={0.36} />
    </g>
  );
}
