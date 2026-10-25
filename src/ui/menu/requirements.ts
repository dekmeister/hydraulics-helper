import type { Scenario, ScenarioRequirements } from '../../sim/scenarios/types';
import type { ApplianceSpec } from '../../sim/types';

/** What `spec` lacks to play `scenario` (support roles on the same appliance), in words. */
export function missingCapabilities(scenario: Scenario, spec: ApplianceSpec): string[] {
  const all = [scenario.requires, ...(scenario.support ?? []).map((r) => r.requires)];
  const missing = new Set<string>();
  for (const r of all) for (const m of lacks(r, spec)) missing.add(m);
  return [...missing];
}

function lacks(r: ScenarioRequirements, spec: ApplianceSpec): string[] {
  const out: string[] = [];
  if (r.appliances !== undefined && !r.appliances.includes(spec.id))
    out.push('a different appliance');
  if (r.tank && (spec.tank === undefined || !spec.inlets.some((i) => i.kind === 'tank')))
    out.push('a tank');
  if (r.suction === true && !spec.inlets.some((i) => i.kind === 'suction'))
    out.push('a suction inlet');
  if (r.primer === true && spec.primer === undefined) out.push('a primer');
  if (spec.deliveries.length < r.minDeliveries) out.push(`${String(r.minDeliveries)} deliveries`);
  return out;
}
