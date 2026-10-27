import { useEffect, useRef } from 'react';
import { deliveryLines, sceneSetting, tankFraction } from '../../state/selectors';
import { portableDams, relayLays } from '../../state/relay';
import { supplyLays } from '../../state/supply';
import { useStore } from '../../state/store';
import { tankLevelState } from '../../state/tankLevel';
import type { TruckState } from '../../sim/types';
import { deliveryIdentities } from '../appliances/identity';
import { getPanelLayout, getSceneArt } from '../appliances/registry';
import { Backdrop, MapFurniture } from './Backdrop';
import { SCENE_VIEW } from './geometry';
import { PortableDam } from './PortableDam';
import { RelayLay } from './RelayLay';
import { SceneLegend } from './SceneLegend';
import { SceneTruck, TruckSupplies } from './SceneTruck';
import { SpillPools } from './SpillPool';
import { layoutSite, siteInput } from './siteLayout';
import { Hydrant } from './SupplyLay';
import './Scene.css';

/** A truck's tank fill and level, for the map and legend; undefined with no tank. */
function tankOf(truck: TruckState) {
  const capacityL = truck.spec.tank?.capacityL;
  if (capacityL === undefined) return undefined;
  return { capacityL, level: tankLevelState(truck.tankL, capacityL) };
}

/**
 * Plan view of the fireground (ARCHITECTURE §7, Design §7): every truck with its hose lays and the
 * crews on its branches, supply and relay hoses, drawn from each appliance's scene art and the
 * sim. Lines charge and branches spray from sim flow; tapping a line or its legend row highlights
 * its delivery on the panel, and tapping another truck operates it. Generic: nothing here knows
 * which trucks it is drawing.
 */
export function SceneView() {
  const sim = useStore((s) => s.sim);
  const inputs = useStore((s) => s.inputs);
  const highlight = useStore((s) => s.highlight);
  const toggleHighlight = useStore((s) => s.toggleHighlight);
  const setActiveTruck = useStore((s) => s.setActiveTruck);
  const setting = useStore((s) => sceneSetting(s.scenarioId));
  const ref = useRef<HTMLDivElement>(null);

  // Asked from the panel: bring the scene into view (it's above the panel on a phone).
  useEffect(() => {
    if (highlight?.from === 'panel') ref.current?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  // Cheap enough to recompute each tick: a handful of trucks and lines.
  const geometry = layoutSite(siteInput(sim, getSceneArt));
  const multi = sim.trucks.length > 1;
  const relays = relayLays(sim);
  const dams = portableDams(sim);
  const highlighted = highlight?.truckId === sim.activeTruckId ? highlight.deliveryId : null;
  // The active truck is drawn last, on top.
  const trucks = [...sim.trucks].sort(
    (a, b) => Number(a.id === sim.activeTruckId) - Number(b.id === sim.activeTruckId),
  );
  const perTruck = trucks.map((truck) => {
    const g = geometry.trucks.find((x) => x.id === truck.id);
    if (g === undefined) throw new Error(`No scene layout for truck '${truck.id}'`);
    const identities = deliveryIdentities(getPanelLayout(truck.spec.id));
    const identityOf = (id: string) => {
      const identity = identities.get(id);
      if (identity === undefined)
        throw new Error(`${truck.spec.id} layout places no delivery '${id}'`);
      return identity;
    };
    const supplies = supplyLays(sim, inputs, truck.id);
    const connected = new Set([
      ...supplies.map((s) => s.supply.inletId),
      ...sim.links.flatMap((l) =>
        l.to.kind === 'inlet' && l.to.truckId === truck.id ? [l.to.inletId] : [],
      ),
    ]);
    return {
      truck,
      geometry: g,
      supplies,
      connected,
      identityOf,
      deliveries: deliveryLines(sim, truck.id),
      active: truck.id === sim.activeTruckId,
    };
  });
  const active = perTruck.find((t) => t.active);
  if (active === undefined) throw new Error(`No active truck '${sim.activeTruckId}'`);
  const activeTank = tankOf(active.truck);
  const cavitating = active.truck.readings.cavitation > 0;

  return (
    <div className="scene" ref={ref} data-appliance={active.truck.spec.id}>
      <svg
        className="scene__map"
        viewBox={`0 0 ${String(SCENE_VIEW.w)} ${String(SCENE_VIEW.h)}`}
        role="img"
        aria-label={
          multi
            ? `Plan view: ${sim.trucks.map((t) => `the ${t.label.toLowerCase()} (${t.spec.name})`).join(' and ')} with their hose lays, relay, crews and water supply.`
            : `Plan view: the ${active.truck.spec.name} with its hose lays, crews and water supply.`
        }
      >
        <Backdrop setting={setting} />
        <SpillPools sim={sim} geometry={geometry} />
        {sim.sources.some((x) => x.kind === 'hydrant') && <Hydrant />}
        {geometry.dams.map((g) => {
          const dam = dams.find((d) => d.source.id === g.sourceId);
          return dam === undefined ? null : <PortableDam key={g.sourceId} geometry={g} dam={dam} />;
        })}
        {perTruck.map((t) => (
          <TruckSupplies
            key={t.truck.id}
            truck={t.truck}
            active={t.active}
            geometry={t.geometry}
            supplies={t.supplies}
          />
        ))}
        {geometry.relays.map((g) => {
          const relay = relays.find((r) => r.link.id === g.linkId);
          if (relay === undefined) return null;
          return (
            <RelayLay
              key={g.linkId}
              geometry={g}
              relay={relay}
              highlighted={g.truckId === sim.activeTruckId && highlighted === g.deliveryId}
            />
          );
        })}
        {perTruck.map((t) => {
          const tank = tankOf(t.truck);
          return (
            <SceneTruck
              key={t.truck.id}
              truck={t.truck}
              art={getSceneArt(t.truck.spec.id)}
              geometry={t.geometry}
              deliveries={t.deliveries}
              connectedInlets={t.connected}
              identityOf={t.identityOf}
              {...(tank === undefined
                ? {}
                : { tank: { fraction: tankFraction(t.truck), level: tank.level } })}
              active={t.active}
              multi={multi}
              highlighted={t.active ? highlighted : null}
              cavitating={t.truck.readings.cavitation > 0}
              onTapDelivery={(id) => {
                toggleHighlight(id, 'scene');
              }}
              onOperate={() => {
                setActiveTruck(t.truck.id);
              }}
            />
          );
        })}
        <MapFurniture unitsPerM={geometry.unitsPerM} scaleBarM={geometry.scaleBarM} />
      </svg>
      <SceneLegend
        rows={active.deliveries.map((d) => ({
          delivery: d,
          identity: active.identityOf(d.deliveryId),
          highlighted: highlighted === d.deliveryId,
        }))}
        {...(activeTank === undefined
          ? {}
          : {
              tank: {
                valueL: active.truck.tankL,
                capacityL: activeTank.capacityL,
                level: activeTank.level,
              },
            })}
        supplies={active.supplies}
        relays={relays}
        dams={dams}
        cavitating={cavitating}
        onTap={(id) => {
          toggleHighlight(id, 'scene');
        }}
      />
    </div>
  );
}
