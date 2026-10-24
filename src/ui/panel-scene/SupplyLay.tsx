import type { SupplyState } from '../../state/supply';
import type { SupplyGeometry } from './geometry';
import { HYDRANT } from './site';

/**
 * A supply hose on the map (Design §7). Hard suction: ink casing round a galvanised core, inlet
 * green inside once primed, with a strainer in the dam. Layflat from a hydrant: inlet green while
 * charged, thin dashed canvas when over-run and soft. Not interactive: the legend row describes it.
 */
export function SupplyLay({ lay, state }: { lay: SupplyGeometry; state: SupplyState }) {
  const hard = lay.sourceKind === 'static';
  return (
    <g
      className={`scene-supply scene-supply--${state}`}
      data-testid={`supply-lay-${lay.inletId}`}
      data-state={state}
      aria-hidden="true"
    >
      {hard ? (
        <>
          <path className="scene-supply__hard-casing" d={lay.path} />
          <path className="scene-supply__hard-core" d={lay.path} />
          {state === 'primed' && <path className="scene-supply__water" d={lay.path} />}
          <g transform={`translate(${lay.end.x.toFixed(1)} ${lay.end.y.toFixed(1)})`}>
            <circle className="scene-supply__strainer" r="8" />
            <path className="scene-supply__strainer-mesh" d="M-5 -3 H5 M-5 0 H5 M-5 3 H5" />
          </g>
        </>
      ) : state === 'soft' ? (
        <path className="scene-supply__soft" d={lay.path} />
      ) : (
        <>
          <path className="scene-hose__casing" d={lay.path} />
          <path className="scene-supply__water scene-supply__water--layflat" d={lay.path} />
        </>
      )}
    </g>
  );
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
