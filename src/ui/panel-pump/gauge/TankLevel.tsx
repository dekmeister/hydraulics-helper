import { COLOR } from '../../theme/colors';
import { formatReading } from '../../format';
import { tankSegments } from '../../../state/tankLevel';

export interface TankLevelProps {
  /** Displayed (damped) volume, L. */
  valueL: number;
  capacityL: number;
  label: string;
}

const SEG = { w: 40, h: 22, gap: 6, x: 4 };
const VIEW_H = 5 * SEG.h + 4 * SEG.gap + 8;

/**
 * Tank level: a five-segment LED column (Design §4). At or below the low mark the last lit
 * segment turns amber with a triangle; empty, the column outline flashes alarm red.
 */
export function TankLevel({ valueL, capacityL, label }: TankLevelProps) {
  const { lit, level } = tankSegments(valueL, capacityL);
  const reading = formatReading(valueL, 'L');
  return (
    <div
      className="tank-level"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={capacityL}
      aria-valuenow={Math.round(valueL)}
      aria-valuetext={reading}
      data-level={level}
    >
      <svg className="tank-level__column" viewBox={`0 0 48 ${String(VIEW_H)}`} aria-hidden="true">
        <rect x={1} y={1} width={46} height={VIEW_H - 2} rx={4} style={{ fill: COLOR.ink }} />
        {[0, 1, 2, 3, 4].map((i) => {
          // i = 0 is the bottom segment.
          const y = 4 + (4 - i) * (SEG.h + SEG.gap);
          const on = i < lit;
          const amber = on && level === 'low' && i === lit - 1;
          return (
            <g key={i}>
              <rect
                x={SEG.x}
                y={y}
                width={SEG.w}
                height={SEG.h}
                rx={2}
                style={{ fill: amber ? COLOR.caution : on ? COLOR.tankLit : COLOR.tankUnlit }}
              />
              {amber && (
                <path
                  d={`M24 ${String(y + 4)} L31 ${String(y + 18)} L17 ${String(y + 18)} Z`}
                  style={{ fill: COLOR.ink }}
                />
              )}
            </g>
          );
        })}
        {level === 'empty' && (
          <rect
            className="tank-level__empty-outline"
            x={1.5}
            y={1.5}
            width={45}
            height={VIEW_H - 3}
            rx={4}
            fill="none"
            strokeWidth={3}
            style={{ stroke: COLOR.alarm }}
          />
        )}
      </svg>
      <span className="tank-level__readout">{reading}</span>
    </div>
  );
}
