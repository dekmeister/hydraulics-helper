import { memo, useId } from 'react';
import { COLOR } from '../../theme/colors';
import { formatReading } from '../../format';
import {
  GEOM,
  radialText,
  range,
  scaleArc,
  sector,
  ticks,
  valueToAngle,
  zoneArcs,
  zoneAt,
  type DialSpec,
} from './gaugeScale';
import './Gauge.css';

export interface GaugeProps {
  dial: DialSpec;
  /** Displayed (damped) value in native units. */
  value: number;
  /** Accessible name, e.g. 'Discharge'. */
  label: string;
  /** Native unit for the readout and accessible value, e.g. 'kPa'. */
  unit: string;
  /** Name plate on the face; defaults to the dial's own. */
  plate?: string;
  /** Rendered size: 'large' (discharge, compound) or 'medium' (tacho). CSS sets the pixels. */
  size?: 'large' | 'medium';
}

const TONE = { caution: COLOR.caution, alarm: COLOR.alarm } as const;

/**
 * One parameterised dial gauge (Design sheet 02): static face from `dial`, needle at `value`,
 * with a mono readout underneath. Exposed as role="meter" in native units (docs/TESTING.md §3.3).
 */
export function Gauge({ dial, value, label, unit, plate, size = 'large' }: GaugeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [lo, hi] = range(dial);
  const zone = zoneAt(dial, value);
  const reading = formatReading(value, unit);
  return (
    <div
      className={`gauge gauge--${size}`}
      role="meter"
      aria-label={label}
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={Math.round(value)}
      aria-valuetext={reading}
      data-zone={zone ?? 'normal'}
    >
      <svg className="gauge__dial" viewBox="-106 -106 214 214" aria-hidden="true">
        <DialFace dial={dial} uid={uid} plate={plate ?? dial.plate ?? null} />
        <Needle angle={valueToAngle(dial, value)} uid={uid} />
      </svg>
      <span className="gauge__readout">{reading}</span>
    </div>
  );
}

/** Static dial artwork; memoised so a needle move doesn't rebuild the face. */
const DialFace = memo(function DialFace({
  dial,
  uid,
  plate,
}: {
  dial: DialSpec;
  uid: string;
  plate: string | null;
}) {
  const galv = `${uid}-galv`;
  const face = `${uid}-face`;
  const all = ticks(dial);
  const sa = scaleArc(dial);
  const majorInner = dial.mini ? GEOM.mini.majorInner : GEOM.majorInner;
  const majorW = dial.mini ? GEOM.mini.majorW : GEOM.majorW;
  const ink = { stroke: COLOR.ink };
  return (
    <g>
      <defs>
        <linearGradient id={galv} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" style={{ stopColor: COLOR.galvLight }} />
          <stop offset="0.35" style={{ stopColor: COLOR.galvMid }} />
          <stop offset="0.7" style={{ stopColor: COLOR.galvDark }} />
          <stop offset="1" style={{ stopColor: COLOR.galvEdge }} />
        </linearGradient>
        <radialGradient id={face} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FCFAF5" />
          <stop offset="0.6" style={{ stopColor: COLOR.dial }} />
          <stop offset="1" stopColor="#E6E1D3" />
        </radialGradient>
      </defs>
      {/* Shell: light from the upper left, shadow falls down-right. */}
      <circle cx={3} cy={4} r={GEOM.bezelR} fill="#000" opacity={0.3} />
      <circle r={GEOM.bezelR} fill={`url(#${galv})`} />
      <circle r={GEOM.lipR} fill="none" strokeWidth={1.2} style={{ stroke: COLOR.galvEdge }} />
      <circle r={GEOM.faceR} fill={`url(#${face})`} />

      {dial.segments.map((s) => {
        if (s.tint !== true) return null;
        const t = sector(GEOM.faceR, valueToAngle(dial, s.v[0]), valueToAngle(dial, s.v[1]));
        return (
          <circle
            key={`tint${String(s.v[0])}`}
            r={t.r}
            fill="none"
            stroke="#E1E6E8"
            strokeWidth={t.strokeWidth}
            strokeDasharray={t.strokeDasharray}
            transform={t.transform}
          />
        );
      })}

      {zoneArcs(dial).map((z) => (
        <circle
          key={`z${z.transform}`}
          r={z.r}
          fill="none"
          strokeWidth={z.strokeWidth}
          strokeDasharray={z.strokeDasharray}
          transform={z.transform}
          style={{ stroke: TONE[z.tone] }}
        />
      ))}

      <circle
        r={sa.r}
        fill="none"
        strokeWidth={sa.strokeWidth}
        strokeDasharray={sa.strokeDasharray}
        transform={sa.transform}
        style={ink}
      />

      <g style={ink}>
        {all
          .filter((t) => !t.major && dial.mini !== true)
          .map((t) => (
            <line
              key={`m${String(t.value)}`}
              y1={-GEOM.tickOuter}
              y2={-GEOM.minorInner}
              strokeWidth={GEOM.minorW}
              transform={`rotate(${String(t.angle)})`}
            />
          ))}
        {all
          .filter((t) => t.major)
          .map((t) => (
            <line
              key={`M${String(t.value)}`}
              y1={-GEOM.tickOuter}
              y2={-majorInner}
              strokeWidth={majorW}
              transform={`rotate(${String(t.angle)})`}
            />
          ))}
        {(dial.breaks ?? []).map((v) => (
          <line
            key={`b${String(v)}`}
            y1={-GEOM.breakOuter}
            y2={-GEOM.breakInner}
            strokeWidth={GEOM.breakW}
            transform={`rotate(${String(valueToAngle(dial, v))})`}
          />
        ))}
      </g>

      {dial.mini !== true && (
        <g className="gauge__numerals" textAnchor="middle">
          {all
            .filter((t) => t.label !== null)
            .map((t) => (
              <text
                key={`l${String(t.value)}`}
                transform={radialText(t.angle, GEOM.numeralR)}
                dy={t.labelSize * 0.35}
                fontSize={t.labelSize}
                style={{ fill: t.labelMuted ? '#3E4448' : COLOR.ink }}
              >
                {t.label}
              </text>
            ))}
          {dial.subLabel && (
            <text
              transform={radialText(valueToAngle(dial, dial.subLabel.atValue), dial.subLabel.r)}
              dy={3}
              fontSize={9}
              letterSpacing={1}
              fill="#3E4448"
            >
              {dial.subLabel.text}
            </text>
          )}
          {dial.units !== '' && (
            <text y={GEOM.unitsY} fontSize={GEOM.unitsSize} letterSpacing={1} fill="#3E4448">
              {dial.units}
            </text>
          )}
        </g>
      )}

      {plate !== null && dial.mini !== true && (
        <g>
          <rect
            x={GEOM.plate.x}
            y={GEOM.plate.y}
            width={GEOM.plate.w}
            height={GEOM.plate.h}
            rx={2}
            style={{ fill: COLOR.ink }}
          />
          <text
            className="gauge__plate"
            y={GEOM.plate.textY}
            textAnchor="middle"
            fontSize={GEOM.plate.textSize}
            letterSpacing={1.2}
            style={{ fill: COLOR.dial }}
          >
            {plate}
          </text>
        </g>
      )}
    </g>
  );
});

function Needle({ angle, uid }: { angle: number; uid: string }) {
  const n = GEOM.needle;
  const path = `M0 ${String(-n.tip)} L${String(n.halfWidth)} -8 L2.4 ${String(n.tail)} L-2.4 ${String(n.tail)} L${String(-n.halfWidth)} -8 Z`;
  const rotate = `rotate(${String(angle)})`;
  return (
    <g className="gauge__needle">
      <g transform="translate(1.6 2.2)">
        <path d={path} fill="#000" opacity={0.2} transform={rotate} />
      </g>
      <g transform={rotate}>
        <path d={path} style={{ fill: COLOR.ink }} />
        <line x1={0} y1={-74} x2={0} y2={-14} strokeWidth={0.9} style={{ stroke: COLOR.dial }} />
        <circle cy={n.counterweightY} r={n.counterweightR} style={{ fill: COLOR.ink }} />
        <circle cy={n.counterweightY} r={n.insetR} style={{ fill: COLOR.galv }} />
      </g>
      <circle r={GEOM.hub.r} style={{ fill: COLOR.ink }} />
      <circle r={GEOM.hub.capR} fill={`url(#${uid}-galv)`} />
    </g>
  );
}
