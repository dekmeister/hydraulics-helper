import type { LineState } from '../../state/selectors';
import type { LayGeometry } from './geometry';

interface Props {
  lay: LayGeometry;
  state: Exclude<LineState, 'none'>;
  highlighted: boolean;
  /** The pump is cavitating: the charged core breaks into gaps (Design §6). */
  cavitating?: boolean;
  onTap: () => void;
}

/**
 * One hose lay (Design §7): laid but dry is thin dashed canvas; charged is an ink casing with an
 * outlet-blue core and a white flow highlight (animated only without reduced motion). A wide
 * invisible stroke takes taps; the legend is the keyboard and screen-reader route to the same act.
 */
export function HoseLay({ lay, state, highlighted, cavitating = false, onTap }: Props) {
  return (
    <g
      className={`scene-hose scene-hose--${state}${cavitating && state === 'charged' ? ' scene-hose--gapped' : ''}`}
      data-testid={`hose-lay-${lay.deliveryId}`}
      data-state={state}
      data-cavitating={cavitating && state === 'charged'}
      data-highlighted={highlighted}
      onClick={onTap}
    >
      {highlighted && <path className="scene-highlight scene-highlight--outer" d={lay.path} />}
      {highlighted && <path className="scene-highlight" d={lay.path} />}
      {state === 'charged' ? (
        <>
          <path className="scene-hose__casing" d={lay.path} />
          <path className="scene-hose__core" d={lay.path} />
          <path className="scene-hose__flow" d={lay.path} />
        </>
      ) : (
        <path className="scene-hose__dry" d={lay.path} />
      )}
      <path className="scene-hose__hit" data-part="hit" d={lay.path} />
    </g>
  );
}
