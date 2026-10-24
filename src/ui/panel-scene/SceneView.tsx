import { useEffect, useRef } from 'react';
import { activeTruck, deliveryLines, tankFraction } from '../../state/selectors';
import { useStore } from '../../state/store';
import { tankLevelState } from '../../state/tankLevel';
import { deliveryIdentities } from '../appliances/identity';
import { getPanelLayout, getSceneArt } from '../appliances/registry';
import { ApplianceArt } from './ApplianceArt';
import { Backdrop, MapFurniture } from './Backdrop';
import { BranchCrew } from './BranchCrew';
import { layoutScene, SCENE_VIEW } from './geometry';
import { HoseLay } from './HoseLay';
import { SceneLegend } from './SceneLegend';
import './Scene.css';

/**
 * Plan view of the fireground (ARCHITECTURE §7, Design §7): the active truck, its hose lays and the
 * crews on the branches, drawn from the appliance's scene art and the sim's lines. Lines charge and
 * branches spray from sim flow; tapping a line or its legend row highlights its delivery on the
 * panel. Generic: nothing here knows which truck it is drawing.
 */
export function SceneView() {
  const sim = useStore((s) => s.sim);
  const highlight = useStore((s) => s.highlight);
  const toggleHighlight = useStore((s) => s.toggleHighlight);
  const ref = useRef<HTMLDivElement>(null);

  const truck = activeTruck(sim);
  const { spec } = truck;
  const art = getSceneArt(spec.id);
  // Cheap enough to recompute each tick: a handful of lines.
  const identities = deliveryIdentities(getPanelLayout(spec.id));
  const geometry = layoutScene(
    art,
    sim.lines.filter((l) => l.truckId === sim.activeTruckId),
  );
  const deliveries = deliveryLines(sim);
  const byDelivery = new Map(deliveries.map((d) => [d.deliveryId, d]));
  const capacityL = spec.tank?.capacityL;
  const tankLevel = tankLevelState(truck.tankL, capacityL ?? 0);
  const isHighlighted = (id: string) => highlight?.deliveryId === id;
  const tapFromScene = (id: string) => {
    toggleHighlight(id, 'scene');
  };

  // Asked from the panel: bring the scene into view (it's above the panel on a phone).
  useEffect(() => {
    if (highlight?.from === 'panel') ref.current?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const identityOf = (id: string) => {
    const identity = identities.get(id);
    if (identity === undefined) throw new Error(`${spec.id} layout places no delivery '${id}'`);
    return identity;
  };

  return (
    <div className="scene" ref={ref} data-appliance={spec.id}>
      <svg
        className="scene__map"
        viewBox={`0 0 ${String(SCENE_VIEW.w)} ${String(SCENE_VIEW.h)}`}
        role="img"
        aria-label={`Plan view: the ${spec.name} with its hose lays and crews.`}
      >
        <Backdrop />
        {geometry.lines.map((lay) => {
          const d = byDelivery.get(lay.deliveryId);
          return (
            <HoseLay
              key={lay.lineId}
              lay={lay}
              state={d?.state === 'charged' ? 'charged' : 'dry'}
              highlighted={isHighlighted(lay.deliveryId)}
              onTap={() => {
                tapFromScene(lay.deliveryId);
              }}
            />
          );
        })}
        <ApplianceArt
          art={art}
          pose={geometry.truck}
          couplings={deliveries.map((d) => ({
            deliveryId: d.deliveryId,
            capped: d.state === 'none',
            highlighted: d.state === 'none' && isHighlighted(d.deliveryId),
          }))}
          {...(capacityL === undefined
            ? {}
            : { tank: { fraction: tankFraction(truck), level: tankLevel } })}
        />
        {geometry.lines.map((lay) => {
          const d = byDelivery.get(lay.deliveryId);
          return (
            <BranchCrew
              key={lay.lineId}
              lay={lay}
              identity={identityOf(lay.deliveryId)}
              spraying={d?.state === 'charged'}
              elevationM={d?.line?.elevationM ?? 0}
              onTap={() => {
                tapFromScene(lay.deliveryId);
              }}
            />
          );
        })}
        <MapFurniture unitsPerM={geometry.unitsPerM} scaleBarM={geometry.scaleBarM} />
      </svg>
      <SceneLegend
        rows={deliveries.map((d) => ({
          delivery: d,
          identity: identityOf(d.deliveryId),
          highlighted: isHighlighted(d.deliveryId),
        }))}
        {...(capacityL === undefined
          ? {}
          : { tank: { valueL: truck.tankL, capacityL, level: tankLevel } })}
        onTap={tapFromScene}
      />
    </div>
  );
}
