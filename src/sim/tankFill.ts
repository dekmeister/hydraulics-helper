// Tank-fill inlets (hydrant to tank): a hydrant pushes water straight into the tank, past the pump.
import { HEAD_KPA_PER_M, VALVE_CLOSED_EPS } from './constants';
import { hoseResistance } from './hose';
import { supplyOn, type ConnectedSupply } from './inlets';
import type { ApplianceSpec, ControlId, PlayerInputs } from './types';

/**
 * Flow in through each open tank-fill inlet, L/min. The tank is open to air, so the hydrant drives
 * Q = √((static − 10·fill height)/(main + hose + valve/open²)), whatever the pump is doing. A full
 * tank overflows rather than backing the flow off (`stepStore` holds the level and spills the rest).
 */
export function tankFillFlows(
  spec: ApplianceSpec,
  inputs: PlayerInputs,
  supplies: readonly ConnectedSupply[],
): Record<ControlId, number> {
  const flows: Record<ControlId, number> = {};
  for (const inlet of spec.inlets) {
    if (inlet.kind !== 'tankFill') continue;
    const open = inputs.valves[inlet.id] ?? 0;
    const connected = supplyOn(supplies, inlet.id);
    if (open < VALVE_CLOSED_EPS || connected?.source.kind !== 'hydrant') {
      flows[inlet.id] = 0;
      continue;
    }
    const { supply, source } = connected;
    const r =
      source.mainLossKpaPerLpm2 +
      hoseResistance(supply.segments) +
      inlet.lossKpaPerLpm2 / open ** 2;
    const drive = source.staticKpa - HEAD_KPA_PER_M * (inlet.fillHeightM ?? 0);
    flows[inlet.id] = Math.sqrt(Math.max(0, drive) / r);
  }
  return flows;
}
