import type { SupplyLay as SupplyLayState } from '../../state/supply';
import type { SupplyGeometry } from './geometry';
import { HoseWater } from './HoseWater';
import { HYDRANT } from './site';

type Water = Pick<SupplyLayState, 'state' | 'level' | 'flowing'>;

/**
 * A supply hose on the map (Design §7). Hard suction: ink casing round a galvanised core, with
 * inlet-green water rising from the strainer as the primer pulls (full once primed) and white
 * streaks running to the pump while it draws. Layflat from a hydrant: inlet green while charged,
 * streaked while flowing, thin dashed canvas when over-run and soft. Not interactive: the legend
 * row describes it.
 */
export function SupplyLay({ lay, water }: { lay: SupplyGeometry; water: Water }) {
  return (
    <g
      className={`scene-supply scene-supply--${water.state}`}
      data-testid={`supply-lay-${lay.inletId}`}
      data-state={water.state}
      data-level={water.level.toFixed(2)}
      data-flowing={water.flowing}
      aria-hidden="true"
    >
      <SupplyHose lay={lay} water={water} />
    </g>
  );
}

function SupplyHose({ lay, water }: { lay: SupplyGeometry; water: Water }) {
  switch (lay.sourceKind) {
    case 'static':
      return (
        <>
          <path className="scene-supply__hard-casing" d={lay.path} />
          <path className="scene-supply__hard-core" d={lay.path} />
          <HoseWater
            curve={lay.curve}
            level={water.level}
            from="end"
            moving={water.flowing}
            variant="inlet"
          />
          <g transform={`translate(${lay.end.x.toFixed(1)} ${lay.end.y.toFixed(1)})`}>
            <circle className="scene-supply__strainer" r="8" />
            <path className="scene-supply__strainer-mesh" d="M-5 -3 H5 M-5 0 H5 M-5 3 H5" />
          </g>
        </>
      );
    case 'hydrant':
      return water.state === 'soft' ? (
        <path className="scene-supply__soft" d={lay.path} />
      ) : (
        <HoseWater
          curve={lay.curve}
          level={water.level}
          from="end"
          moving={water.flowing}
          variant="layflat"
        />
      );
  }
}

/** A hydrant standpipe from above: a red post with two outlets (generic, no branding). */
export function Hydrant() {
  return (
    <g data-testid="scene-hydrant" aria-hidden="true">
      <g transform={`translate(${String(HYDRANT.x)} ${String(HYDRANT.y)})`}>
        <ellipse className="scene-shadow" cx="3" cy="4" rx="12" ry="10" />
        <rect className="scene-hydrant__outlet" x="-15" y="-3.5" width="30" height="7" rx="2" />
        <circle className="scene-hydrant__body" r="9" />
        <circle className="scene-hydrant__cap" r="4" />
      </g>
      <text className="scene-hydrant__label" x={HYDRANT.label.x} y={HYDRANT.label.y}>
        HYDRANT
      </text>
    </g>
  );
}
