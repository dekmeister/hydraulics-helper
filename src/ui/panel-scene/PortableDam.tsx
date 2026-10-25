import type { PortableDam as PortableDamState } from '../../state/relay';
import type { DamGeometry } from './siteLayout';

/**
 * A portable dam from above (Design §7): a round canvas wall around water, with a ring that
 * fills with the water held, amber with a triangle at a quarter or less, red when empty.
 */
export function PortableDam({ geometry, dam }: { geometry: DamGeometry; dam: PortableDamState }) {
  const { x, y, r } = geometry;
  const ring = r + 6;
  const circumference = 2 * Math.PI * ring;
  return (
    <g
      className={`scene-portable-dam scene-portable-dam--${dam.level}`}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      data-testid={`portable-dam-${geometry.sourceId}`}
      data-level={dam.level}
      aria-hidden="true"
    >
      <circle className="scene-shadow" cx="4" cy="5" r={r + 2} />
      <circle className="scene-portable-dam__wall" r={r} />
      <circle className="scene-portable-dam__water" r={r - 5} />
      <circle className="scene-portable-dam__track" r={ring} />
      <circle
        className="scene-portable-dam__level"
        r={ring}
        strokeDasharray={`${(circumference * dam.fraction).toFixed(1)} ${circumference.toFixed(1)}`}
        transform="rotate(-90)"
      />
      {dam.level === 'low' && (
        <path className="scene-tank__triangle" d={`M${String(ring + 4)} -14 l7 12 h-14 Z`} />
      )}
    </g>
  );
}
