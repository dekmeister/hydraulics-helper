import type { CSSProperties } from 'react';
import type { TankBand, TankDisplay } from '../../sim/types';
import { formatReading } from '../format';
import { COLOR } from '../theme/colors';

export interface TankGaugeProps {
  display: TankDisplay;
  label: string;
  valueL: number;
  capacityL: number;
  style: CSSProperties;
}

const BAND_COLOR: Readonly<Record<TankBand['tone'], string>> = {
  green: COLOR.inlet,
  blue: COLOR.outlet,
  red: COLOR.alarm,
};

/** Tube geometry in the 100 × 360 viewBox: the water column runs from TUBE_BOTTOM up to TUBE_TOP. */
const TUBE_TOP = 16;
const TUBE_BOTTOM = 344;

function SightTube({ fraction }: { fraction: number }) {
  const y = TUBE_BOTTOM - fraction * (TUBE_BOTTOM - TUBE_TOP);
  return (
    <>
      {(['F', '¾', '½', '¼', 'E'] as const).map((mark, i) => {
        const my = TUBE_TOP + (i / 4) * (TUBE_BOTTOM - TUBE_TOP);
        return (
          <g key={mark}>
            <line
              x1={22}
              x2={34}
              y1={my}
              y2={my}
              strokeWidth={2}
              style={{ stroke: COLOR.steelDim }}
            />
            <text x={16} y={my + 5} textAnchor="end" className="tank-gauge__mark">
              {mark}
            </text>
          </g>
        );
      })}
      <rect
        x={38}
        y={TUBE_TOP - 6}
        width={28}
        height={TUBE_BOTTOM - TUBE_TOP + 12}
        rx={8}
        style={{ fill: COLOR.ink }}
      />
      {fraction > 0 && (
        <rect x={42} y={y} width={20} height={TUBE_BOTTOM - y} style={{ fill: COLOR.tankLit }} />
      )}
      {/* The float: foam at the water line, so the top shows clearly. */}
      <rect x={40} y={y - 7} width={24} height={10} rx={4} style={{ fill: COLOR.caution }} />
      <rect
        x={38}
        y={TUBE_TOP - 6}
        width={28}
        height={TUBE_BOTTOM - TUBE_TOP + 12}
        rx={8}
        fill="none"
        strokeWidth={3}
        style={{ stroke: COLOR.galvLight }}
      />
    </>
  );
}

/** The band the level is in: the last whose start it has reached. */
export function activeBand(bands: readonly TankBand[], fraction: number): TankBand | undefined {
  return [...bands].reverse().find((b) => fraction >= b.fromFraction) ?? bands[0];
}

function Bands({ bands, fraction }: { bands: readonly TankBand[]; fraction: number }) {
  const lit = activeBand(bands, fraction);
  const h = (TUBE_BOTTOM - TUBE_TOP) / bands.length;
  // Highest band at the top.
  return (
    <>
      {[...bands].reverse().map((b, i) => (
        <rect
          key={b.fromFraction}
          x={26}
          y={TUBE_TOP + i * h + 4}
          width={48}
          height={h - 8}
          rx={8}
          data-lit={b === lit}
          style={{ fill: b === lit ? BAND_COLOR[b.tone] : COLOR.tankUnlit }}
        />
      ))}
    </>
  );
}

/**
 * The tank's level as the truck shows it (`TankDisplay` on the spec): a sight tube with a float,
 * or an electronic gauge lighting one coloured band. role="meter" in litres, like the panel's.
 */
export function TankGauge({ display, label, valueL, capacityL, style }: TankGaugeProps) {
  const fraction = capacityL > 0 ? Math.min(1, Math.max(0, valueL / capacityL)) : 0;
  return (
    <div
      className="tank-gauge"
      style={style}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={capacityL}
      aria-valuenow={Math.round(valueL)}
      aria-valuetext={formatReading(valueL, 'L')}
      data-display={display.kind}
    >
      <svg viewBox="0 0 100 360" aria-hidden="true">
        {display.kind === 'sightTube' ? (
          <SightTube fraction={fraction} />
        ) : (
          <Bands bands={display.bands} fraction={fraction} />
        )}
      </svg>
    </div>
  );
}
