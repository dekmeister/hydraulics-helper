import { cubicPath, cubicPortion, type Cubic } from './cubic';

interface Props {
  curve: Cubic;
  /** How full the hose is, 0–1, measured from `from`. */
  level: number;
  /** The end water enters: a delivery fills from its coupling, a suction from its strainer. */
  from: 'start' | 'end';
  /** Water moving: white streaks run the way it flows (animated only without reduced motion). */
  moving: boolean;
  /** Outlet-blue water in an ink casing (lays), or an inlet-green core (supply hoses). */
  variant: 'outlet' | 'inlet' | 'layflat';
}

/**
 * The water in a hose (issues #6, #8): a core over the part that's full, with the front where the
 * water has reached, and streaks while it moves. The part is cut from the hose's own curve and
 * runs the way the water travels, so the streaks always flow towards the front.
 */
export function HoseWater({ curve, level, from, moving, variant }: Props) {
  const part = cubicPortion(curve, Math.min(1, level), from);
  if (part === undefined) return null;
  const d = cubicPath(part);
  return (
    <>
      {variant !== 'inlet' && <path className="scene-hose__casing" d={d} />}
      <path
        className={
          variant === 'outlet'
            ? 'scene-hose__core'
            : `scene-supply__water${variant === 'layflat' ? ' scene-supply__water--layflat' : ''}`
        }
        d={d}
      />
      {moving && <path className="scene-hose__flow" data-part="flow" d={d} />}
    </>
  );
}
