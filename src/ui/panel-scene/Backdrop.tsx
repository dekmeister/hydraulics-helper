import { memo } from 'react';
import { SCENE_VIEW } from './geometry';
import { DAM, FIRE_FRONT, TRACK } from './site';

// Static scenery (Design §7, sheet 06): ground tints, contours, track, scrub, the dam, fire glow
// at the edge. Decorative only; nothing here reads sim state. Contours are unlabelled because the
// ground isn't modelled: a line's elevation is shown at its branch instead.

const { w, h } = SCENE_VIEW;

/** Contours with the x they start from at the left; the middle one is an index contour. */
const CONTOURS: readonly { d: string; startX: number }[] = [
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

function Scrub({ x, y, s }: { x: number; y: number; s: number }) {
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

/** Ground, track, scrub, dam and fire glow, drawn under everything else. */
export const Backdrop = memo(function Backdrop() {
  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id="scene-fire" cx="1" cy="0" r="0.62">
          <stop offset="0" stopColor="var(--color-signal-alarm)" stopOpacity="0.5" />
          <stop offset="0.4" stopColor="var(--color-signal-caution)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-signal-caution)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="scene-ground" width={w} height={h} />
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
      <path className="scene-ash" d={`${FIRE_FRONT} L${String(w)} 0 Z`} />
      <rect width={w} height={h} fill="url(#scene-fire)" />
      <path className="scene-fire-front scene-fire-front--glow" d={FIRE_FRONT} />
      <path className="scene-fire-front" d={FIRE_FRONT} />
      <g className="scene-smoke">
        <circle cx="750" cy="18" r="32" />
        <circle cx="788" cy="56" r="27" />
        <circle cx="703" cy="5" r="22" />
      </g>
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
    </g>
  );
});

/** North arrow and a scale bar for the hose lays, drawn over the scene. */
export function MapFurniture({ unitsPerM, scaleBarM }: { unitsPerM: number; scaleBarM: number }) {
  const bar = scaleBarM * unitsPerM;
  return (
    <g aria-hidden="true">
      <g transform="translate(30 30)">
        <circle className="scene-paper" r="17" />
        <path className="scene-ink" d="M0 -12 L5.5 6 L0 3 L-5.5 6 Z" />
        <text className="scene-label" y="34" textAnchor="middle">
          N
        </text>
      </g>
      <g transform={`translate(${String(w - 24 - bar)} ${String(h - 22)})`} className="scene-scale">
        <path
          d={`M0 0 h${String(bar)} M0 -6 v12 M${String(bar / 2)} -4 v8 M${String(bar)} -6 v12`}
        />
        <text className="scene-label" x={bar / 2} y="-10" textAnchor="middle">
          {`${String(scaleBarM)} m`}
        </text>
      </g>
    </g>
  );
}
