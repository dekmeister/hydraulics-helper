import { memo, useId } from 'react';
import {
  GEOM, type DialSpec, valueToAngle, ticks, zoneArcs, scaleArc, sector, radialText, arc,
} from './gaugeScale';
import type { Ghost } from './wake';

/**
 * Reference implementation of the parameterised gauge (sheet 02) with the Wake (sheet 04).
 * Static parts (shell, face, scale, numerals) depend only on `spec` and are memoised;
 * per-frame parts (wake, needle) depend on `value` / `wake`.
 *
 * Styling hooks (see gauge.css): `.gauge--flutter` on the needle group, `.gauge__wake`.
 */

const INK = '#16191B';
const DIAL = '#F5F2EA';
const TONE = { caution: '#F2A900', alarm: '#E5362B' } as const;

export interface GaugeProps {
  spec: DialSpec;
  value: number;
  /** Rendered diameter in CSS px. Below 100 px use a `mini` spec. */
  size: number;
  /** Accessible name, e.g. "Compound gauge". The value is appended automatically. */
  label: string;
  /** Unit string for the accessible value, e.g. "kPa". */
  unit: string;
  wake?: { band: { lo: number; hi: number } | null; ghosts: Ghost[] };
  /** Counterweight inlay colour (delivery or function colour). Defaults to galv. */
  tagColor?: string;
  /** Override or hide (null) the plate in the spec. */
  plate?: string | null;
  /** Adds the flutter animation class to the needle (only while hunting). */
  fluttering?: boolean;
  /** Target notch on the bezel (scenario setpoint), in value units. */
  target?: number;
}

export const Gauge = memo(function Gauge(props: GaugeProps) {
  const { spec, value, size, label, unit, wake, tagColor = '#AEB5BA', fluttering, target } = props;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const plate = props.plate === undefined ? spec.plate : props.plate;
  const angle = valueToAngle(spec, value);
  const ariaValue = `${label}: ${Math.round(value)} ${unit}`;

  return (
    <svg width={size} height={size} viewBox="-106 -106 214 214" role="img" aria-label={ariaValue} className="gauge">
      <DialFace spec={spec} uid={uid} plate={plate ?? null} />
      {target !== undefined && (
        <path d="M0 -92.5 L-4.5 -100 L4.5 -100 Z" fill={INK} transform={`rotate(${valueToAngle(spec, target)})`} />
      )}
      {wake && <Wake spec={spec} band={wake.band} ghosts={wake.ghosts} />}
      <Needle angle={angle} mini={!!spec.mini} tagColor={tagColor} fluttering={fluttering} uid={uid} />
    </svg>
  );
});

/** Static dial artwork. Memoised on spec identity + plate. */
const DialFace = memo(function DialFace({ spec, uid, plate }: { spec: DialSpec; uid: string; plate: string | null }) {
  const galv = `${uid}-galv`, face = `${uid}-face`;
  const all = ticks(spec);
  const sa = scaleArc(spec);
  const majorInner = spec.mini ? GEOM.mini.majorInner : GEOM.majorInner;
  const majorW = spec.mini ? GEOM.mini.majorW : GEOM.majorW;
  return (
    <g>
      <defs>
        <linearGradient id={galv} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#F4F6F7" /><stop offset="0.35" stopColor="#C3C9CD" />
          <stop offset="0.7" stopColor="#8E969B" /><stop offset="1" stopColor="#5E666C" />
        </linearGradient>
        <radialGradient id={face} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FCFAF5" /><stop offset="0.6" stopColor={DIAL} /><stop offset="1" stopColor="#E6E1D3" />
        </radialGradient>
      </defs>
      {/* shell — light from upper left, shadow falls down-right */}
      <circle cx={3} cy={4} r={GEOM.bezelR} fill="#000" opacity={0.3} />
      <circle r={GEOM.bezelR} fill={`url(#${galv})`} />
      <circle r={GEOM.lipR} fill="none" stroke="#4A5156" strokeWidth={1.2} />
      <circle r={GEOM.faceR} fill={`url(#${face})`} />

      {spec.segments.map((s, i) => {
        if (!s.tint) return null;
        const t = sector(GEOM.faceR, valueToAngle(spec, s.v[0]), valueToAngle(spec, s.v[1]));
        return <circle key={`tint${i}`} r={t.r} fill="none" stroke={s.tint} strokeWidth={t.strokeWidth} strokeDasharray={t.strokeDasharray} transform={t.transform} />;
      })}

      {zoneArcs(spec).map((z, i) => (
        <circle key={`z${i}`} r={z.r} fill="none" stroke={TONE[z.tone]} strokeWidth={z.strokeWidth} strokeDasharray={z.strokeDasharray} transform={z.transform} />
      ))}

      <circle r={sa.r} fill="none" stroke={INK} strokeWidth={sa.strokeWidth} strokeDasharray={sa.strokeDasharray} transform={sa.transform} />

      <g stroke={INK}>
        {all.filter((t) => !t.major && !spec.mini).map((t) => (
          <line key={`m${t.value}`} y1={-GEOM.tickOuter} y2={-GEOM.minorInner} strokeWidth={GEOM.minorW} transform={`rotate(${t.angle})`} />
        ))}
        {all.filter((t) => t.major).map((t) => (
          <line key={`M${t.value}`} y1={-GEOM.tickOuter} y2={-majorInner} strokeWidth={majorW} transform={`rotate(${t.angle})`} />
        ))}
        {(spec.breaks ?? []).map((v) => (
          <line key={`b${v}`} y1={-GEOM.breakOuter} y2={-GEOM.breakInner} strokeWidth={GEOM.breakW} transform={`rotate(${valueToAngle(spec, v)})`} />
        ))}
      </g>

      {!spec.mini && (
        <g fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif" fontWeight={600} textAnchor="middle">
          {all.filter((t) => t.label).map((t) => (
            <text key={`l${t.value}`} transform={radialText(t.angle, spec.numeralRadius ?? GEOM.numeralR)}
              dy={t.labelSize * 0.35} fontSize={t.labelSize} fill={t.labelColor ?? INK}>{t.label}</text>
          ))}
          {spec.subLabel && (
            <text transform={radialText(valueToAngle(spec, spec.subLabel.atValue), spec.subLabel.r)} dy={3}
              fontSize={9} letterSpacing={1} fill="#3E4448">{spec.subLabel.text}</text>
          )}
          {spec.units && <text y={GEOM.unitsY} fontSize={GEOM.unitsSize} letterSpacing={1} fill="#3E4448">{spec.units}</text>}
        </g>
      )}

      {plate && !spec.mini && (
        <g>
          <rect x={GEOM.plate.x} y={GEOM.plate.y} width={GEOM.plate.w} height={GEOM.plate.h} rx={2} fill={INK} />
          <text y={GEOM.plate.textY} textAnchor="middle" fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
            fontWeight={700} fontSize={GEOM.plate.textSize} letterSpacing={1.2} fill={DIAL}>{plate}</text>
        </g>
      )}
    </g>
  );
});

function Wake({ spec, band, ghosts }: { spec: DialSpec; band: { lo: number; hi: number } | null; ghosts: Ghost[] }) {
  if (!band) return null;
  const a0 = valueToAngle(spec, band.lo), a1 = valueToAngle(spec, band.hi);
  const b = arc(GEOM.wake.r, a0, a1, GEOM.wake.width);
  const w = GEOM.wake;
  return (
    <g className="gauge__wake" pointerEvents="none">
      {Math.abs(a1 - a0) > 0.2 && (
        <circle r={b.r} fill="none" stroke={INK} strokeOpacity={0.12} strokeWidth={b.strokeWidth} strokeDasharray={b.strokeDasharray} transform={b.transform} />
      )}
      {ghosts.map((g, i) => (
        <line key={i} y1={-w.ghostInner} y2={-w.ghostOuter} stroke={INK} strokeOpacity={g.opacity} strokeWidth={w.ghostW}
          strokeLinecap="round" transform={`rotate(${valueToAngle(spec, g.value)})`} />
      ))}
      {[a0, a1].map((a, i) => (
        <line key={`e${i}`} y1={-w.edgeOuter} y2={-w.edgeInner} stroke={INK} strokeOpacity={0.5} strokeWidth={0.8} transform={`rotate(${a})`} />
      ))}
    </g>
  );
}

function Needle({ angle, mini, tagColor, fluttering, uid }: { angle: number; mini: boolean; tagColor: string; fluttering?: boolean; uid: string }) {
  const n = GEOM.needle;
  const path = mini
    ? 'M0 -84 L6 -6 L4 20 L-4 20 L-6 -6 Z'
    : `M0 ${-n.tip} L${n.halfWidth} -8 L2.4 ${n.tail} L-2.4 ${n.tail} L${-n.halfWidth} -8 Z`;
  return (
    <g>
      {!mini && (
        <g transform="translate(1.6 2.2)"><path d={path} fill="#000" opacity={0.2} transform={`rotate(${angle})`} /></g>
      )}
      {/* The CSS flutter animates this outer group; the angle lives on the inner group. */}
      <g className={fluttering ? 'gauge--flutter' : undefined}>
        <g transform={`rotate(${angle})`}>
          <path d={path} fill={INK} />
          {!mini && <line x1={0} y1={-74} x2={0} y2={-14} stroke={DIAL} strokeWidth={0.9} />}
          <circle cy={mini ? 16 : n.counterweightY} r={mini ? 9 : n.counterweightR} fill={mini ? tagColor : INK}
            stroke={mini ? INK : undefined} strokeWidth={mini ? 3 : undefined} />
          {!mini && <circle cy={n.counterweightY} r={n.counterweightInsetR} fill={tagColor} />}
        </g>
      </g>
      <circle r={mini ? 12 : GEOM.hub.r} fill={INK} />
      {!mini && <circle r={GEOM.hub.capR} fill={`url(#${uid}-galv)`} />}
    </g>
  );
}
