import type { TankLevelState } from '../../state/tankLevel';
import type { SceneArt } from '../appliances/types';
import { outletGushLobe } from './burstGush';
import { PUMP_BAY_U as BAY_U, type TruckPose } from './geometry';

export interface CouplingView {
  /** Spec control id of the coupling (delivery or suction inlet). */
  control: string;
  /** Nothing connected: the coupling carries a blank cap. */
  capped: boolean;
  highlighted: boolean;
  /**
   * A bare delivery opened (issue #16): how big to draw the water thrown out of it, 0–1
   * (`burstGushScale`); 0 or omitted, none.
   */
  gush?: number;
}

interface Props {
  art: SceneArt;
  pose: TruckPose;
  couplings: readonly CouplingView[];
  /** Tank fill, 0–1, and its level state; omitted for an appliance with no tank. */
  tank?: { fraction: number; level: TankLevelState };
}

const BAR_H = 8;

/** Water thrown out of a bare delivery opened at the truck, from its coupling. */
function OutletGush(props: {
  control: string;
  at: { x: number; y: number };
  facingDeg: number;
  scale: number;
}) {
  const lobe = outletGushLobe(props.scale, props.facingDeg);
  return (
    <g
      className="scene-gush"
      transform={`translate(${props.at.x.toFixed(1)} ${props.at.y.toFixed(1)})`}
      data-testid={`outlet-gush-${props.control}`}
      data-scale={props.scale.toFixed(2)}
    >
      <path className="scene-gush__body" d={lobe.body} />
      {lobe.streaks.map((d) => (
        <path key={d} className="scene-gush__streak" d={d} />
      ))}
    </g>
  );
}

/**
 * Tank fill bar along the body: tank-lit fill, amber with a triangle (on the empty end of the bar,
 * clear of the hatch) when low, red outline when empty.
 */
function TankBar({
  art,
  fraction,
  level,
}: {
  art: SceneArt;
  fraction: number;
  level: TankLevelState;
}) {
  const x0 = -art.lengthU / 2 + BAY_U + 6;
  const len = art.lengthU / 2 - art.cabU - 6 - x0;
  const y = art.widthU / 2 - BAR_H - 5;
  return (
    <g className={`scene-tank scene-tank--${level}`} data-testid="scene-tank" data-level={level}>
      <rect className="scene-tank__track" x={x0} y={y} width={len} height={BAR_H} rx="2" />
      <rect
        className="scene-tank__fill"
        x={x0}
        y={y}
        width={len * fraction}
        height={BAR_H}
        rx="2"
      />
      {level === 'low' && (
        <path
          className="scene-tank__triangle"
          d={`M${String(x0 + len - 9)} ${String(y - 3)} l7 12 h-14 Z`}
        />
      )}
    </g>
  );
}

/**
 * A truck from above, drawn from its scene art (Design §7: plain red body, white cab, no livery):
 * pump bay at the rear, optional tank hatch, tank fill bar, a coupling per delivery and per
 * suction inlet (inlet green, Design OPEN_DECISIONS #1).
 */
export function ApplianceArt({ art, pose, couplings, tank }: Props) {
  const L = art.lengthU;
  const W = art.widthU;
  const views = new Map(couplings.map((c) => [c.control, c]));
  const tankStart = -L / 2 + BAY_U;
  const tankEnd = L / 2 - art.cabU;
  return (
    <g
      transform={`translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) rotate(${pose.headingDeg.toFixed(1)})`}
      data-testid="scene-truck"
    >
      <rect className="scene-shadow" x={-L / 2 + 4} y={-W / 2 + 4} width={L} height={W} rx="5" />
      <rect className="scene-truck__body" x={-L / 2} y={-W / 2} width={L} height={W} rx="5" />
      <rect
        className="scene-truck__cab"
        x={L / 2 - art.cabU}
        y={-W / 2}
        width={art.cabU}
        height={W}
        rx="5"
      />
      <rect className="scene-truck__bay" x={-L / 2} y={-W / 2 + 6} width={BAY_U} height={W - 12} />
      {art.hatch && (
        <circle className="scene-truck__hatch" cx={(tankStart + tankEnd) / 2} cy={-6} r="9" />
      )}
      {tank !== undefined && <TankBar art={art} fraction={tank.fraction} level={tank.level} />}
      {art.couplings.map((c) => {
        const view = views.get(c.control);
        const classes = ['scene-coupling'];
        if (c.kind === 'inlet') classes.push('scene-coupling--inlet');
        if (view?.capped === true) classes.push('scene-coupling--capped');
        return (
          <g key={c.control} data-testid={`coupling-${c.control}`}>
            {view?.highlighted === true && (
              <circle className="scene-highlight scene-highlight--outer" cx={c.x} cy={c.y} r="13" />
            )}
            {view?.highlighted === true && (
              <circle className="scene-highlight" cx={c.x} cy={c.y} r="10" />
            )}
            <circle className={classes.join(' ')} cx={c.x} cy={c.y} r="5.5" />
            {view?.gush !== undefined && view.gush > 0 && (
              <OutletGush control={c.control} at={c} facingDeg={c.facingDeg} scale={view.gush} />
            )}
          </g>
        );
      })}
    </g>
  );
}
