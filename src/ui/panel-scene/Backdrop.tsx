import { memo, type ComponentType } from 'react';
import type { ScenarioSetting } from '../../sim/scenarios/types';
import { BushBackdrop } from './backdrops/BushBackdrop';
import { InterfaceBackdrop } from './backdrops/InterfaceBackdrop';
import { VillageBackdrop } from './backdrops/VillageBackdrop';
import { SCENE_VIEW } from './geometry';
import './backdrops/Scenery.css';

// Static scenery (Design §7, sheet 06), one backdrop per setting (issue #10): the bush, the village
// or the urban interface. Decorative only; nothing here reads sim state.

const { w, h } = SCENE_VIEW;

const BACKDROPS: Readonly<Record<ScenarioSetting, ComponentType>> = {
  bush: BushBackdrop,
  village: VillageBackdrop,
  interface: InterfaceBackdrop,
};

/** The setting's ground and scenery, drawn under everything else. */
export const Backdrop = memo(function Backdrop({ setting }: { setting: ScenarioSetting }) {
  const Scenery = BACKDROPS[setting];
  return (
    <g aria-hidden="true" data-setting={setting}>
      <rect className="scene-ground" width={w} height={h} />
      <Scenery />
    </g>
  );
});

/** North arrow and a scale bar for the hose lays, drawn over the scene. */
export function MapFurniture({ unitsPerM, scaleBarM }: { unitsPerM: number; scaleBarM: number }) {
  const bar = scaleBarM * unitsPerM;
  return (
    <g aria-hidden="true">
      <g transform="translate(30 30)">
        <circle className="scene-paper" r="17" />
        <path className="scene-ink" d="M0 -12 L5.5 6 L0 3 L-5.5 6 Z" />
        <text className="scene-label" y="34" textAnchor="middle">
          N
        </text>
      </g>
      <g transform={`translate(${String(w - 24 - bar)} ${String(h - 22)})`} className="scene-scale">
        <path
          d={`M0 0 h${String(bar)} M0 -6 v12 M${String(bar / 2)} -4 v8 M${String(bar)} -6 v12`}
        />
        <text className="scene-label" x={bar / 2} y="-10" textAnchor="middle">
          {`${String(scaleBarM)} m`}
        </text>
      </g>
    </g>
  );
}
