import type { RelayLay as RelayLayState } from '../../state/relay';
import { formatWhole } from '../format';
import type { RelayGeometry } from './siteLayout';

interface Props {
  geometry: RelayGeometry;
  relay: RelayLayState;
  /** Its supplying delivery is highlighted on the panel. */
  highlighted: boolean;
}

/** Spokes of the burst marker: water jetting out of the split length. */
const BURST_SPOKES = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    const r = deg % 90 === 0 ? 17 : 11;
    return `M${(6 * Math.cos(a)).toFixed(1)} ${(6 * Math.sin(a)).toFixed(1)} L${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
  })
  .join(' ');

/**
 * A relay hose between trucks, or into a tank or dam (Design §7): drawn like a delivery hose,
 * charged blue while water moves, thin dashed canvas when dry, flattened (dashed) when the
 * receiving pump over-runs it, and split with a jet of water where a length has burst. A label
 * halfway gives the climb. Not interactive: its legend row and the panel describe it.
 */
export function RelayLay({ geometry, relay, highlighted }: Props) {
  const { path, mid, burstAt } = geometry;
  const climb = relay.link.elevationM;
  return (
    <g
      className={`scene-relay scene-relay--${relay.state}`}
      data-testid={`relay-lay-${geometry.linkId}`}
      data-state={relay.state}
      data-highlighted={highlighted}
      aria-hidden="true"
    >
      {highlighted && <path className="scene-highlight scene-highlight--outer" d={path} />}
      {highlighted && <path className="scene-highlight" d={path} />}
      {relay.state === 'charged' ? (
        <>
          <path className="scene-hose__casing" d={path} />
          <path className="scene-hose__core" d={path} />
          <path className="scene-hose__flow" d={path} />
        </>
      ) : relay.state === 'soft' ? (
        <path className="scene-supply__soft" d={path} />
      ) : (
        <path className="scene-hose__dry" d={path} />
      )}
      {burstAt !== undefined && (
        <g
          transform={`translate(${burstAt.x.toFixed(1)} ${burstAt.y.toFixed(1)})`}
          data-testid={`relay-burst-${geometry.linkId}`}
        >
          <circle className="scene-relay__burst-ring" r="9" />
          <path className="scene-relay__burst" d={BURST_SPOKES} />
        </g>
      )}
      {climb !== 0 && (
        <g transform={`translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)})`}>
          <rect className="scene-paper" x="-26" y="-13" width="52" height="24" rx="4" />
          <text className="scene-label scene-label--mono" y="5" textAnchor="middle">
            {`${climb > 0 ? '+' : '−'}${formatWhole(Math.abs(climb))} m`}
          </text>
        </g>
      )}
    </g>
  );
}
