import { formatWhole } from '../format';
import { GLYPH_PATH } from '../appliances/glyphs';
import type { DeliveryIdentity } from '../appliances/identity';
import { SPRAY_REACH_U, type LayGeometry } from './geometry';

interface Props {
  lay: LayGeometry;
  identity: DeliveryIdentity;
  spraying: boolean;
  /** Branch height above the pump, m. */
  elevationM: number;
  /** A monitor on the ground instead of a crew: no figure, a longer, tighter jet. */
  monitor?: boolean;
  onTap: () => void;
}

/** Half-angle of the spray fan, degrees: a crew's, and a monitor's tighter stream. */
const SPRAY_HALF_DEG = 11;
const MONITOR_HALF_DEG = 6;
/** A monitor throws further than a hand line (a map symbol, not to scale). */
const MONITOR_REACH = 1.7;
/** Identity marker sits this far to the branch's right, drawing units. */
const MARKER_OFFSET_U = 30;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The working end of a line: a crew figure on the branch (Design §7: khaki PPE, white helmet,
 * hi-vis band, top-down) or a monitor on its base, the spray fan while water flows, and the
 * delivery's glyph and tag so the player can trace the line back to its valve.
 */
export function BranchCrew({ lay, identity, spraying, elevationM, monitor = false, onTap }: Props) {
  const { x, y } = lay.branch;
  const h = lay.headingDeg;
  const reach = SPRAY_REACH_U * (monitor ? MONITOR_REACH : 1);
  const half = monitor ? MONITOR_HALF_DEG : SPRAY_HALF_DEG;
  const tip = (deg: number) => ({
    x: x + reach * Math.cos(rad(deg)),
    y: y + reach * Math.sin(rad(deg)),
  });
  const a = tip(h - half);
  const b = tip(h + half);
  const mid = tip(h);
  const marker = {
    x: x + MARKER_OFFSET_U * Math.cos(rad(h + 90)),
    y: y + MARKER_OFFSET_U * Math.sin(rad(h + 90)),
  };
  const elevation =
    elevationM === 0 ? null : `${elevationM > 0 ? '+' : '−'}${formatWhole(Math.abs(elevationM))} m`;
  return (
    <g data-testid={`branch-${lay.deliveryId}`} onClick={onTap} className="scene-branch">
      {spraying && (
        <g data-testid={`spray-${lay.deliveryId}`}>
          <path
            className="scene-spray"
            d={`M${x.toFixed(1)} ${y.toFixed(1)} L${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)} Z`}
          />
          <path
            className="scene-spray__jet"
            d={`M${x.toFixed(1)} ${y.toFixed(1)} L${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`}
          />
        </g>
      )}
      <g
        transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(h + 90).toFixed(1)}) scale(1.25)`}
        data-branch={monitor ? 'monitor' : 'crew'}
      >
        {monitor ? (
          <>
            {/* Top down: three splayed legs on the ground, the barrel pointing at the fire. */}
            <ellipse className="scene-shadow" cx="2" cy="4" rx="12" ry="10" />
            <path className="scene-monitor__legs" d="M0 0 L-10 8 M0 0 L10 8 M0 0 L0 -10" />
            <rect className="scene-monitor__barrel" x="-3" y="-17" width="6" height="17" rx="2" />
            <circle className="scene-monitor__body" r="5" />
          </>
        ) : (
          <>
            <ellipse className="scene-shadow" cx="2" cy="4" rx="11" ry="8" />
            <ellipse className="scene-crew__ppe" rx="10" ry="6.5" />
            <path className="scene-crew__band" d="M-9 1.5 h18" />
            <circle className="scene-crew__helmet" cy="-1" r="4.6" />
          </>
        )}
      </g>
      <g transform={`translate(${marker.x.toFixed(1)} ${marker.y.toFixed(1)})`}>
        <circle className="scene-paper" r="13" />
        <path className="scene-ink" d={GLYPH_PATH[identity.glyph]} transform="translate(-10 -10)" />
        <text className="scene-label scene-label--tag" x="18" y="6">
          {identity.tag}
        </text>
        {elevation !== null && (
          <text className="scene-label scene-label--mono" x="18" y="24">
            {elevation}
          </text>
        )}
      </g>
    </g>
  );
}
