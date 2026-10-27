import type { LineState } from '../../state/selectors';
import type { LayGeometry } from './geometry';
import { HoseWater } from './HoseWater';

interface Props {
  lay: LayGeometry;
  state: Exclude<LineState, 'none'>;
  /** How full the hose is, 0–1 from the truck. */
  level: number;
  /** Water moving into it from the delivery. */
  moving: boolean;
  highlighted: boolean;
  /** The pump is cavitating: the charged core breaks into gaps (Design §6). */
  cavitating?: boolean;
  onTap: () => void;
}

/** Radius of the coupling drawn where two lengths join, drawing units: a lump on the casing. */
const COUPLING_R_U = 6;

/**
 * One hose lay (Design §7): laid but dry is thin dashed canvas; the part with water in it is an
 * ink casing round an outlet-blue core, filling from the truck while it charges, with a white flow
 * highlight while water moves (animated only without reduced motion). A coupling marks each join
 * between lengths. A wide invisible stroke takes taps; the legend is the keyboard and
 * screen-reader route to the same act.
 */
export function HoseLay({
  lay,
  state,
  level,
  moving,
  highlighted,
  cavitating = false,
  onTap,
}: Props) {
  const gapped = cavitating && state === 'charged';
  return (
    <g
      className={`scene-hose scene-hose--${state}${gapped ? ' scene-hose--gapped' : ''}`}
      data-testid={`hose-lay-${lay.deliveryId}`}
      data-state={state}
      data-level={level.toFixed(2)}
      data-moving={moving}
      data-cavitating={gapped}
      data-highlighted={highlighted}
      onClick={onTap}
    >
      {highlighted && <path className="scene-highlight scene-highlight--outer" d={lay.path} />}
      {highlighted && <path className="scene-highlight" d={lay.path} />}
      {level < 1 && <path className="scene-hose__dry" d={lay.path} />}
      <HoseWater
        curve={lay.curve}
        level={level}
        from="start"
        moving={moving && !gapped}
        variant="outlet"
      />
      <g aria-hidden="true" data-part="joints">
        {lay.joints.map((p, i) => (
          <circle key={i} className="scene-hose__coupling" cx={p.x} cy={p.y} r={COUPLING_R_U} />
        ))}
      </g>
      <path className="scene-hose__hit" data-part="hit" d={lay.path} />
    </g>
  );
}
