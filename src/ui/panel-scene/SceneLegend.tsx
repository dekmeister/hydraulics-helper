import { useId } from 'react';
import type { DeliveryLine } from '../../state/selectors';
import type { SupplyLay } from '../../state/supply';
import type { TankLevelState } from '../../state/tankLevel';
import type { DeliveryIdentity } from '../appliances/identity';
import { formatWhole } from '../format';
import { DeliveryTag } from '../panel-pump/DeliveryTag';

export interface LegendRow {
  delivery: DeliveryLine;
  identity: DeliveryIdentity;
  highlighted: boolean;
}

interface Props {
  rows: readonly LegendRow[];
  tank?: { valueL: number; capacityL: number; level: TankLevelState };
  /** Supply hoses to the truck's suction inlets. */
  supplies?: readonly SupplyLay[];
  /** The pump is cavitating: charged lines say so. */
  cavitating?: boolean;
  onTap: (deliveryId: string) => void;
}

function statusText(d: DeliveryLine, cavitating: boolean): string {
  switch (d.state) {
    case 'charged':
      return `Charged · ${formatWhole(d.flowLpm)} L/min${cavitating ? ' · cavitating' : ''}`;
    case 'dry':
      return 'Laid, dry';
    case 'none':
      return 'No line';
  }
}

/** Caution is always a triangle, alarm a diamond (Design §2): colour never stands alone. */
function SignalGlyph({ level }: { level: 'low' | 'empty' }) {
  return (
    <svg className="scene-legend__signal" viewBox="0 0 14 14" aria-hidden="true">
      <path d={level === 'low' ? 'M7 1.5 L13 12.5 H1 Z' : 'M7 1 L13 7 L7 13 L1 7 Z'} />
    </svg>
  );
}

/** Line style swatch, matching the hose on the map. */
function Swatch({ state }: { state: DeliveryLine['state'] }) {
  return (
    <svg className="scene-legend__swatch" viewBox="0 0 36 14" aria-hidden="true">
      {state === 'charged' && (
        <>
          <path className="scene-hose__casing" d="M5 7 h26" />
          <path className="scene-hose__core" d="M5 7 h26" />
        </>
      )}
      {state === 'dry' && <path className="scene-hose__dry" d="M4 7 h28" />}
      {state === 'none' && (
        <circle className="scene-coupling scene-coupling--capped" cx="18" cy="7" r="5" />
      )}
    </svg>
  );
}

/** What a supply row says: source, state and flow. */
function supplyText(s: SupplyLay): { name: string; status: string } {
  const flow = s.flowLpm >= 1 ? ` · ${formatWhole(s.flowLpm)} L/min` : '';
  switch (s.source.kind) {
    case 'static':
      return {
        name: `Suction · ${s.source.label}`,
        status:
          s.state === 'primed'
            ? `Primed${flow}`
            : `Not primed · ${formatWhole(s.source.liftM)} m lift`,
      };
    case 'hydrant': {
      const status =
        s.state === 'soft'
          ? 'Soft: over-running the hydrant'
          : s.flowLpm >= 1
            ? `Charged${flow}`
            : s.open
              ? 'Charged'
              : 'Charged · inlet shut';
      return { name: s.source.label, status };
    }
  }
}

function SupplyRow({ supply }: { supply: SupplyLay }) {
  const { name, status } = supplyText(supply);
  return (
    <li
      className={`scene-legend__info scene-legend__supply--${supply.state}`}
      data-supply={supply.supply.inletId}
    >
      <span className="scene-legend__name">{name}</span>
      <span className="scene-legend__status">{status}</span>
    </li>
  );
}

function Row({
  row,
  cavitating,
  onTap,
}: {
  row: LegendRow;
  cavitating: boolean;
  onTap: (deliveryId: string) => void;
}) {
  const statusId = useId();
  const { delivery, identity, highlighted } = row;
  return (
    <li>
      <button
        type="button"
        className="scene-legend__row"
        aria-label={`Show ${identity.label} on panel`}
        aria-describedby={statusId}
        aria-pressed={highlighted}
        data-state={delivery.state}
        onClick={() => {
          onTap(delivery.deliveryId);
        }}
      >
        <Swatch state={delivery.state} />
        <DeliveryTag tag={identity.tag} glyph={identity.glyph} />
        <span className="scene-legend__name">{identity.label}</span>
        <span id={statusId} className="scene-legend__status">
          {statusText(delivery, cavitating)}
        </span>
      </button>
    </li>
  );
}

/**
 * The scene's key and its accessible, thumb-sized equivalent: one button per delivery (tap to find
 * it on the panel) with the line's state, the supply hoses, and the water left in the tank.
 */
export function SceneLegend({ rows, tank, supplies = [], cavitating = false, onTap }: Props) {
  return (
    <ul className="scene-legend" aria-label="Lines and water">
      {rows.map((row) => (
        <Row key={row.delivery.deliveryId} row={row} cavitating={cavitating} onTap={onTap} />
      ))}
      {supplies.map((s) => (
        <SupplyRow key={s.supply.id} supply={s} />
      ))}
      {tank !== undefined && (
        <li className={`scene-legend__tank scene-legend__tank--${tank.level}`}>
          <span className="scene-legend__name">Tank water</span>
          <span className="scene-legend__status">
            {tank.level !== 'ok' && <SignalGlyph level={tank.level} />}
            {`${formatWhole(tank.valueL)} L of ${formatWhole(tank.capacityL)} L`}
            {tank.level === 'low' && ' · low'}
            {tank.level === 'empty' && ' · empty'}
          </span>
        </li>
      )}
    </ul>
  );
}
