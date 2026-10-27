import type { SimState } from '../../sim/types';
import { spillPoolSize } from '../../state/spill';
import { getSceneArt } from '../appliances/registry';
import type { SiteGeometry } from './siteLayout';

/** Furthest the pool spreads past what it spills from, drawing units (~10 m at 5 u/m). */
const SPREAD_U = 50;

interface Props {
  /** Test id suffix: `truck-<id>` or `dam-<id>`. */
  id: string;
  x: number;
  y: number;
  headingDeg: number;
  /** Half-length and half-width of what it spills from, drawing units. */
  rx: number;
  ry: number;
  /** How far it has spread, 0–1 (`spillPoolSize`). */
  size: number;
}

/**
 * Overflowed water on the ground round a truck or portable dam, drawn under everything on the map:
 * an uneven puddle that spreads with the water spilled and shrinks as it soaks away.
 */
export function SpillPool({ id, x, y, headingDeg, rx, ry, size }: Props) {
  const a = rx + SPREAD_U * size;
  const b = ry + SPREAD_U * size;
  return (
    <g
      className="scene-spill"
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${headingDeg.toFixed(1)})`}
      data-testid={`spill-pool-${id}`}
      data-size={size.toFixed(2)}
      aria-hidden="true"
    >
      <ellipse rx={a.toFixed(1)} ry={b.toFixed(1)} />
      <ellipse
        cx={(a * 0.45).toFixed(1)}
        cy={(b * 0.35).toFixed(1)}
        rx={(a * 0.6).toFixed(1)}
        ry={(b * 0.8).toFixed(1)}
      />
      <ellipse
        cx={(-a * 0.4).toFixed(1)}
        cy={(-b * 0.3).toFixed(1)}
        rx={(a * 0.55).toFixed(1)}
        ry={(b * 0.75).toFixed(1)}
      />
    </g>
  );
}

/** Every truck's and portable dam's pool, for the layer under everything else on the map. */
export function SpillPools({ sim, geometry }: { sim: SimState; geometry: SiteGeometry }) {
  const pools = [
    ...geometry.trucks.map((g) => {
      const truck = sim.trucks.find((t) => t.id === g.id);
      const art = truck === undefined ? undefined : getSceneArt(truck.spec.id);
      const size = spillPoolSize(truck?.spilledL ?? 0);
      if (art === undefined || size === undefined) return null;
      const { x, y, headingDeg } = g.pose;
      return {
        id: `truck-${g.id}`,
        x,
        y,
        headingDeg,
        rx: art.lengthU / 2,
        ry: art.widthU / 2,
        size,
      };
    }),
    ...geometry.dams.map((g) => {
      const source = sim.sources.find((s) => s.id === g.sourceId);
      const size = spillPoolSize(source?.kind === 'static' ? (source.spilledL ?? 0) : 0);
      if (size === undefined) return null;
      return { id: `dam-${g.sourceId}`, x: g.x, y: g.y, headingDeg: 0, rx: g.r, ry: g.r, size };
    }),
  ];
  return <>{pools.map((p) => (p === null ? null : <SpillPool key={p.id} {...p} />))}</>;
}
