import type { PipeDir, PlateArt } from '../appliances/realistic';
import { COLOR } from '../theme/colors';
import { PLATE_FONT_U, PLATE_H_U, plateWidthU, textWidthU } from './geometry';
import { CasingWater, PipeWater } from './PipeWater';

/**
 * A pipe: dark edge, galvanised body and a sheen down its middle, square at both ends; with
 * `water`, what the water in it is doing, drawn over the sheen.
 */
function Pipe({ art }: { art: Extract<PlateArt, { kind: 'pipe' }> }) {
  const { d, widthU, water } = art;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="butt">
      <path d={d} strokeWidth={widthU} style={{ stroke: COLOR.galvEdge }} />
      <path d={d} strokeWidth={widthU - 6} style={{ stroke: COLOR.galvMid }} />
      <path d={d} strokeWidth={widthU * 0.22} style={{ stroke: COLOR.galvLight }} opacity={0.7} />
      {water !== undefined && <PipeWater d={d} widthU={widthU} water={water} />}
    </g>
  );
}

const UNIT: Readonly<Record<PipeDir, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** A flange: a collar across a pipe end, `along` the way the pipe runs. */
function Flange({
  x,
  y,
  widthU,
  along,
}: {
  x: number;
  y: number;
  widthU: number;
  along: 'h' | 'v';
}) {
  const across = widthU * 1.5;
  const thick = 10;
  const w = along === 'h' ? thick : across;
  const h = along === 'h' ? across : thick;
  return (
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      rx={2}
      strokeWidth={2}
      style={{ fill: COLOR.galvLight, stroke: COLOR.galvEdge }}
    />
  );
}

/**
 * A radial pump's volute: the casing, and its discharge nozzle tangent to the edge (drawn first,
 * so the circle hides its root), ending in a flange at the outlet.
 */
function Casing({ art }: { art: Extract<PlateArt, { kind: 'casing' }> }) {
  const { cx, cy, r, outlet: o } = art;
  const u = UNIT[o.dir];
  // Nozzle: from the centreline at the casing's middle out to the outlet point.
  const x0 = Math.min(o.x, u.x === 0 ? o.x : cx);
  const x1 = Math.max(o.x, u.x === 0 ? o.x : cx);
  const y0 = Math.min(o.y, u.y === 0 ? o.y : cy);
  const y1 = Math.max(o.y, u.y === 0 ? o.y : cy);
  const half = o.widthU / 2;
  return (
    <g>
      <rect
        x={u.x === 0 ? o.x - half : x0}
        y={u.y === 0 ? o.y - half : y0}
        width={u.x === 0 ? o.widthU : x1 - x0}
        height={u.y === 0 ? o.widthU : y1 - y0}
        className="real-art__casing"
      />
      <circle cx={cx} cy={cy} r={r} className="real-art__casing" />
      {art.water !== undefined && <CasingWater cx={cx} cy={cy} r={r} water={art.water} />}
      <Flange x={o.x} y={o.y} widthU={o.widthU} along={u.x === 0 ? 'v' : 'h'} />
      <text
        x={cx}
        y={cy - r * 0.62}
        textAnchor="middle"
        dominantBaseline="central"
        className="real-art__plate-text"
        style={{ fontSize: PLATE_FONT_U }}
      >
        {art.label}
      </text>
    </g>
  );
}

/** Pipework, the pump casing, couplings, the panel box and its label plates. */
export function Art({ art }: { art: PlateArt }) {
  switch (art.kind) {
    case 'panel':
      return (
        <rect
          x={art.box.x}
          y={art.box.y}
          width={art.box.w}
          height={art.box.h}
          rx={14}
          className="real-art__panel"
        />
      );
    case 'pipe':
      return <Pipe art={art} />;
    case 'casing':
      return <Casing art={art} />;
    case 'coupling':
      return (
        <g>
          <circle cx={art.cx} cy={art.cy} r={art.r} style={{ fill: COLOR.galvLight }} />
          <circle cx={art.cx} cy={art.cy} r={art.r * 0.72} style={{ fill: COLOR.galv }} />
          <circle cx={art.cx} cy={art.cy} r={art.r * 0.45} style={{ fill: COLOR.galvDark }} />
        </g>
      );
    case 'fitting':
      return (
        <circle
          cx={art.cx}
          cy={art.cy}
          r={art.r}
          strokeWidth={3}
          style={{ fill: COLOR.galvMid, stroke: COLOR.galvEdge }}
        />
      );
    case 'flange':
      return <Flange x={art.x} y={art.y} widthU={art.widthU} along={art.along} />;
    case 'plate': {
      const w = art.w ?? plateWidthU(art.text);
      const room = w - 16;
      return (
        <g>
          <rect
            x={art.x - w / 2}
            y={art.y - PLATE_H_U / 2}
            width={w}
            height={PLATE_H_U}
            rx={3}
            className="real-art__plate"
          />
          <text
            x={art.x}
            y={art.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="real-art__plate-text"
            style={{ fontSize: PLATE_FONT_U }}
            // Squeeze a long label into a fixed-width plate rather than overrun it.
            {...(textWidthU(art.text, PLATE_FONT_U) > room
              ? { textLength: room, lengthAdjust: 'spacingAndGlyphs' }
              : {})}
          >
            {art.text}
          </text>
        </g>
      );
    }
    case 'text':
      return (
        <text
          x={art.x}
          y={art.y}
          textAnchor={art.anchor ?? 'middle'}
          dominantBaseline="central"
          className="real-art__text"
        >
          {art.text}
        </text>
      );
  }
}
