import { memo } from 'react';
import type { InertLook, RBox, RealItem, RealPlate } from '../appliances/realistic';
import { COLOR } from '../theme/colors';
import { textWidthU } from './geometry';
import { Art } from './PlateArt';

const PLACARD_PAD_U = 12;
const PLACARD_FONT_U = 20;
const PLACARD_HEAD_U = 22;

/**
 * A placard: its lines spaced evenly down the box between equal top and bottom padding, each
 * squeezed to the box's width if it would overrun.
 */
function Placard({ box, lines }: { box: RBox; lines: readonly string[] }) {
  const pitch = (box.h - 2 * PLACARD_PAD_U) / Math.max(1, lines.length);
  const room = box.w - 2 * PLACARD_PAD_U;
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        className="real-inert__placard"
      />
      {lines.map((line, i) => {
        const fontU = i === 0 ? PLACARD_HEAD_U : PLACARD_FONT_U;
        return (
          <text
            key={String(i)}
            x={box.x + box.w / 2}
            y={box.y + PLACARD_PAD_U + pitch * (i + 0.5)}
            textAnchor="middle"
            dominantBaseline="central"
            className={i === 0 ? 'real-inert__placard-head' : 'real-inert__placard-line'}
            style={{ fontSize: fontU }}
            // Placards are mixed case, which runs about 0.8 of the capitals' width.
            {...(textWidthU(line, fontU) * 0.8 > room
              ? { textLength: room, lengthAdjust: 'spacingAndGlyphs' }
              : {})}
          >
            {line}
          </text>
        );
      })}
    </g>
  );
}

/** A simple drawing of something on the truck the game doesn't model yet. */
function InertShape({ look, box, text }: { look: InertLook; box: RBox; text?: readonly string[] }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) / 2;
  switch (look) {
    case 'button':
      return <circle cx={cx} cy={cy} r={r * 0.8} className="real-inert__button" />;
    case 'toggle':
      return (
        <g>
          <circle cx={cx} cy={cy} r={r * 0.7} style={{ fill: COLOR.ink }} />
          <rect
            x={cx - 6}
            y={cy - r * 0.8}
            width={12}
            height={r * 0.8}
            rx={6}
            style={{ fill: COLOR.galvMid }}
          />
        </g>
      );
    case 'lamp':
    case 'indicator':
      return <circle cx={cx} cy={cy} r={r * 0.75} className={`real-inert__${look}`} />;
    case 'dial':
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} style={{ fill: COLOR.ink }} />
          <circle cx={cx} cy={cy} r={r * 0.82} className="real-inert__dial-face" />
          <line
            x1={cx}
            y1={cy}
            x2={cx - r * 0.55}
            y2={cy + r * 0.4}
            strokeWidth={4}
            style={{ stroke: COLOR.caution }}
          />
        </g>
      );
    case 'knob':
      // One rotary selector on its legend plate (a foam metering valve).
      return (
        <g>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={8}
            className="real-inert__foam"
          />
          <rect
            x={cx - box.w * 0.25}
            y={cy}
            width={box.w * 0.5}
            height={box.h * 0.25}
            rx={10}
            style={{ fill: COLOR.ink }}
          />
          <text x={cx} y={box.y + 40} textAnchor="middle" className="real-art__plate-text">
            {text?.[0]}
          </text>
        </g>
      );
    case 'knobs':
      return (
        <g>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={8}
            className="real-inert__foam"
          />
          <rect
            x={box.x + box.w * 0.12}
            y={cy}
            width={box.w * 0.3}
            height={box.h * 0.25}
            rx={10}
            style={{ fill: COLOR.ink }}
          />
          <rect
            x={box.x + box.w * 0.58}
            y={cy}
            width={box.w * 0.3}
            height={box.h * 0.25}
            rx={10}
            style={{ fill: COLOR.ink }}
          />
          <text x={cx} y={box.y + 40} textAnchor="middle" className="real-art__plate-text">
            {text?.[0]}
          </text>
        </g>
      );
    case 'placard':
      return <Placard box={box} lines={text ?? []} />;
    case 'fuses':
      return (
        <g>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={4}
            className="real-inert__placard"
          />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={box.x + 12 + i * 26}
              y={box.y + 8}
              width={16}
              height={box.h - 16}
              rx={2}
              style={{ fill: COLOR.alarm }}
            />
          ))}
        </g>
      );
    case 'valve':
      // A valve the game doesn't work yet: a hub with a plain steel handle, never function-coloured.
      return (
        <g>
          <rect
            x={cx - r * 0.9}
            y={cy - r * 0.16}
            width={r * 1.8}
            height={r * 0.32}
            rx={r * 0.16}
            style={{ fill: COLOR.galvDark }}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r * 0.3}
            style={{ fill: COLOR.galvMid, stroke: COLOR.galvEdge }}
          />
        </g>
      );
    case 'reel':
      return (
        <g>
          <circle cx={cx} cy={cy} r={r * 0.95} className="real-inert__reel" />
          <circle cx={cx} cy={cy} r={r * 0.35} style={{ fill: COLOR.galvMid }} />
        </g>
      );
  }
}

/**
 * A plate's static drawing: art primitives, then everything on it the game doesn't model yet,
 * each a labelled image ("… (not in the game yet)").
 */
export const PlateBackdrop = memo(function PlateBackdrop({ plate }: { plate: RealPlate }) {
  const inert = plate.items.filter(
    (i): i is Extract<RealItem, { kind: 'inert' }> => i.kind === 'inert',
  );
  return (
    <svg
      className="real-plate__backdrop"
      viewBox={`0 0 ${String(plate.viewBox.w)} ${String(plate.viewBox.h)}`}
    >
      <g aria-hidden="true">
        {plate.art.map((a, i) => (
          <Art key={i} art={a} />
        ))}
      </g>
      {inert.map((i) => (
        <g key={i.id} role="img" aria-label={`${i.label} (not in the game yet)`} data-inert={i.id}>
          <title>{`${i.label}: not in the game yet`}</title>
          <InertShape
            look={i.look}
            box={i.box}
            {...(i.text === undefined ? {} : { text: i.text })}
          />
        </g>
      ))}
    </svg>
  );
});
