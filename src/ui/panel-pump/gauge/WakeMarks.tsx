import { COLOR } from '../../theme/colors';
import { arc, valueToAngle, type DialSpec } from './gaugeScale';
import type { Wake } from './wake';

/** Band radii (Design §6: r 68–90) and ghost needle span. */
const BAND = { inner: 68, outer: 90 } as const;
const GHOST = { from: 14, to: 74 } as const;

/**
 * The Wake drawn on a dial: the min…max band in ink at 12 % with hairlines at its edges, and five
 * fading ghost needles. Never coloured, and drawn under the needle (Design §6).
 */
export function WakeMarks({ dial, wake }: { dial: DialSpec; wake: Wake }) {
  const { band, ghosts } = wake;
  if (band === null) return null;
  const a0 = valueToAngle(dial, band.lo);
  const a1 = valueToAngle(dial, band.hi);
  const ring = arc((BAND.inner + BAND.outer) / 2, a0, a1, BAND.outer - BAND.inner);
  const ink = { stroke: COLOR.ink };
  return (
    <g className="gauge__wake" data-part="wake" data-span={(band.hi - band.lo).toFixed(0)}>
      <circle
        r={ring.r}
        fill="none"
        strokeWidth={ring.strokeWidth}
        strokeDasharray={ring.strokeDasharray}
        transform={ring.transform}
        opacity={0.12}
        style={ink}
      />
      {[a0, a1].map((a, i) => (
        <line
          key={i}
          y1={-BAND.inner}
          y2={-BAND.outer}
          transform={`rotate(${a.toFixed(2)})`}
          strokeWidth={0.8}
          style={ink}
        />
      ))}
      {ghosts.map((g, i) => (
        <line
          key={i}
          y1={-GHOST.from}
          y2={-GHOST.to}
          transform={`rotate(${valueToAngle(dial, g.value).toFixed(2)})`}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={g.opacity}
          style={ink}
        />
      ))}
    </g>
  );
}
