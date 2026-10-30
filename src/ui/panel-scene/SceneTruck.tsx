import type { DeliveryLine } from '../../state/selectors';
import type { SupplyLay as SupplyLayState } from '../../state/supply';
import type { TankLevelState } from '../../state/tankLevel';
import type { TruckState } from '../../sim/types';
import type { DeliveryIdentity } from '../appliances/identity';
import type { SceneArt } from '../appliances/types';
import { ApplianceArt } from './ApplianceArt';
import { burstGushScale } from './burstGush';
import { BranchCrew } from './BranchCrew';
import { HoseLay } from './HoseLay';
import type { SiteTruckGeometry } from './siteLayout';
import { SupplyLay } from './SupplyLay';

/** A truck's identity for each delivery, from its panel layout. */
export type IdentityOf = (deliveryId: string) => DeliveryIdentity;

interface TruckProps {
  truck: TruckState;
  art: SceneArt;
  geometry: SiteTruckGeometry;
  deliveries: readonly DeliveryLine[];
  /** Suction inlets with something connected (a supply hose or a relay). */
  connectedInlets: ReadonlySet<string>;
  identityOf: IdentityOf;
  tank?: { fraction: number; level: TankLevelState };
  active: boolean;
  /** More than one truck on the fireground: label them, and tap one to operate it. */
  multi: boolean;
  /** Delivery highlighted on the panel, on the active truck. */
  highlighted: string | null;
  cavitating: boolean;
  onTapDelivery: (deliveryId: string) => void;
  onOperate: () => void;
}

/** Group attributes that scope a truck's per-delivery test ids (docs/TESTING.md §3.3). */
const groupProps = (truck: TruckState, active: boolean) => ({
  'data-truck': truck.id,
  'data-truck-active': active,
});

/** A truck's supply hoses, drawn under everything else of it. */
export function TruckSupplies({
  truck,
  active,
  geometry,
  supplies,
}: {
  truck: TruckState;
  active: boolean;
  geometry: SiteTruckGeometry;
  supplies: readonly SupplyLayState[];
}) {
  const byId = new Map(supplies.map((s) => [s.supply.id, s]));
  const dry = { state: 'dry', level: 0, flowing: false } as const;
  return (
    <g {...groupProps(truck, active)}>
      {geometry.supplies.map((lay) => (
        <SupplyLay key={lay.supplyId} lay={lay} water={byId.get(lay.supplyId) ?? dry} />
      ))}
    </g>
  );
}

/** Rough width of the truck name chip, drawing units: display face caps at 15 px. */
const labelWidth = (label: string) => label.length * 10 + 20;

/**
 * One truck on the map: its hose lays, the truck from its scene art, the crews on its branches
 * and, with several trucks, its name. The active truck's hoses and crews take taps for the
 * scene↔panel highlight; any other truck takes a tap anywhere to become the one operated.
 */
export function SceneTruck(props: TruckProps) {
  const { truck, art, geometry, deliveries, identityOf, active, multi, highlighted } = props;
  const byDelivery = new Map(deliveries.map((d) => [d.deliveryId, d]));
  const tap = (deliveryId: string) => () => {
    if (active) props.onTapDelivery(deliveryId);
    else props.onOperate();
  };
  const { pose } = geometry;
  const label = truck.label.toUpperCase();
  const w = labelWidth(label);
  return (
    <g {...groupProps(truck, active)}>
      {geometry.lines.map((lay) => {
        const d = byDelivery.get(lay.deliveryId);
        return (
          <HoseLay
            key={lay.lineId}
            lay={lay}
            state={d === undefined || d.state === 'none' ? 'dry' : d.state}
            level={d?.level ?? 0}
            moving={d?.moving ?? false}
            highlighted={active && highlighted === lay.deliveryId}
            cavitating={props.cavitating}
            onTap={tap(lay.deliveryId)}
          />
        );
      })}
      <ApplianceArt
        art={art}
        pose={pose}
        couplings={[
          ...deliveries.map((d) => ({
            control: d.deliveryId,
            capped: d.state === 'none',
            highlighted: active && d.state === 'none' && highlighted === d.deliveryId,
            // Nothing connected but water moving: it's pouring out at the truck.
            gush: d.state === 'none' && d.moving ? burstGushScale(d.flowLpm) : 0,
          })),
          ...truck.spec.inlets
            .filter((i) => i.kind !== 'tank')
            .map((i) => ({
              control: i.id,
              capped: !props.connectedInlets.has(i.id),
              highlighted: false,
            })),
        ]}
        {...(props.tank === undefined ? {} : { tank: props.tank })}
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
            monitor={d?.line?.branch.kind === 'monitor'}
            onTap={tap(lay.deliveryId)}
          />
        );
      })}
      {multi && (
        <g
          className={`scene-truck-label${active ? ' scene-truck-label--active' : ''}`}
          transform={`translate(${pose.x.toFixed(1)} ${(pose.y - 62).toFixed(1)})`}
          aria-hidden="true"
        >
          <rect x={-w / 2} y="-13" width={w} height="26" rx="4" />
          <text y="5.5" textAnchor="middle">
            {label}
          </text>
        </g>
      )}
      {multi && !active && (
        <g
          transform={`translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) rotate(${pose.headingDeg.toFixed(1)})`}
        >
          <rect
            className="scene-truck-tap"
            data-testid={`truck-tap-${truck.id}`}
            x={-art.lengthU / 2 - 12}
            y={-art.widthU / 2 - 12}
            width={art.lengthU + 24}
            height={art.widthU + 24}
            onClick={props.onOperate}
          />
        </g>
      )}
    </g>
  );
}
