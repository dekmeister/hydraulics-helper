import { activeTruck, waterIn, waterRefKey, type WaterRef } from '../../state/selectors';
import { useStore } from '../../state/store';

/** Water core across a pipe, as a fraction of the pipe's width (a charged hose's core to its casing). */
const CORE_FRACTION = 0.5;

function useWater(ref: WaterRef) {
  return useStore((s) => waterIn(s.sim, activeTruck(s.sim), ref));
}

/**
 * The water in a pipe, drawn x-ray style inside the metal as the scene draws a hose: a charged
 * core while water stands in it, with streaks running the way it flows (the path's direction)
 * while it flows; nothing while the pipe is empty.
 */
export function PipeWater({ d, widthU, water }: { d: string; widthU: number; water: WaterRef }) {
  const state = useWater(water);
  const coreU = widthU * CORE_FRACTION;
  return (
    <g className="real-water" data-water={state} data-water-ref={waterRefKey(water)}>
      {state !== 'empty' && <path d={d} className="real-water__core" strokeWidth={coreU} />}
      {state === 'flowing' && <path d={d} className="real-water__flow" strokeWidth={coreU * 0.3} />}
    </g>
  );
}

/**
 * Water in the pump casing, x-ray style: a pool round the eye while it holds any, with a ring of
 * streaks swirling round it while the pump moves water.
 */
export function CasingWater({
  cx,
  cy,
  r,
  water,
}: {
  cx: number;
  cy: number;
  r: number;
  water: WaterRef;
}) {
  const state = useWater(water);
  return (
    <g className="real-water" data-water={state} data-water-ref={waterRefKey(water)}>
      {state !== 'empty' && <circle cx={cx} cy={cy} r={r * 0.5} className="real-water__pool" />}
      {state === 'flowing' && <circle cx={cx} cy={cy} r={r * 0.42} className="real-water__swirl" />}
    </g>
  );
}
