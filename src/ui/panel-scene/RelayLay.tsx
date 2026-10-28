import type { RelayLay as RelayLayState } from '../../state/relay';
import { formatWhole } from '../format';
import { burstGushLobes, burstGushScale } from './burstGush';
import type { RelayGeometry } from './siteLayout';

interface Props {
  geometry: RelayGeometry;
  relay: RelayLayState;
  /** Its supplying delivery is highlighted on the panel. */
  highlighted: boolean;
}

/**
 * A relay hose between trucks, or into a tank or dam (Design §7): drawn like a delivery hose,
 * charged blue while water moves, thin dashed canvas when dry, flattened (dashed) when the
 * receiving pump over-runs it, and split with a red marker where a length has burst, water gushing
 * out of both sides of the split as big as the flow running out of it (none once the supplying
 * delivery or pump stops). A label
 * halfway gives the climb. Not interactive: its legend row and the panel describe it.
 */
export function RelayLay({ geometry, relay, highlighted }: Props) {
  const { path, mid, burst } = geometry;
  const climb = relay.link.elevationM;
  const gush = burst === undefined ? 0 : burstGushScale(relay.reading.flowLpm);
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
      {burst !== undefined && (
        <g transform={`translate(${burst.at.x.toFixed(1)} ${burst.at.y.toFixed(1)})`}>
          {gush > 0 && (
            <g
              className="scene-relay__gush"
              data-testid={`relay-burst-gush-${geometry.linkId}`}
              data-scale={gush.toFixed(2)}
            >
              {burstGushLobes(gush, burst.headingDeg).map((lobe, i) => (
                <g key={i}>
                  <path className="scene-relay__gush-body" d={lobe.body} />
                  {lobe.streaks.map((d) => (
                    <path key={d} className="scene-relay__gush-streak" d={d} />
                  ))}
                </g>
              ))}
            </g>
          )}
          <g data-testid={`relay-burst-${geometry.linkId}`}>
            <circle className="scene-relay__burst-ring" r="12" />
            <path className="scene-relay__burst" d="M-5 -5 L5 5 M5 -5 L-5 5" />
          </g>
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
