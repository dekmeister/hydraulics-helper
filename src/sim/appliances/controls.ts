import type { ApplianceSpec, ControlId, InletKind, PlayerInputs } from '../types';

/** Ids of every 0–1 valve-type control on the spec: inlet valves, deliveries, an adjustable relief wheel. */
export function valveControlIds(spec: ApplianceSpec): ControlId[] {
  const ids = [...spec.inlets.map((i) => i.id), ...spec.deliveries.map((d) => d.id)];
  if (spec.relief?.kind === 'adjustable') ids.push(spec.relief.id);
  return ids;
}

/** Control id of the primer's switch (or handle); undefined with no primer or a self-priming pump. */
export function primerControlId(spec: ApplianceSpec): ControlId | undefined {
  const primer = spec.primer;
  if (primer === undefined) return undefined;
  switch (primer.kind) {
    case 'rotaryVane':
    case 'diaphragm':
      return primer.id;
    case 'selfPriming':
      return undefined;
  }
}

/** Ids of every on/off control on the spec. */
export function switchControlIds(spec: ApplianceSpec): ControlId[] {
  const primer = primerControlId(spec);
  return primer === undefined ? [] : [primer];
}

/** The spec's first inlet of `kind`; throws (prefixed with `context`, if given) when it has none. */
export function inletOfKind(spec: ApplianceSpec, kind: InletKind, context?: string): ControlId {
  const inlet = spec.inlets.find((i) => i.kind === kind);
  if (inlet === undefined) {
    throw new Error(
      `${context === undefined ? '' : `${context}: `}${spec.id} has no ${kind} inlet`,
    );
  }
  return inlet.id;
}

export function controlIds(spec: ApplianceSpec): ControlId[] {
  return [...valveControlIds(spec), ...switchControlIds(spec)];
}

/** Problems with `inputs` for this spec (unknown control ids); empty when valid. */
export function validateInputs(spec: ApplianceSpec, inputs: PlayerInputs): string[] {
  const valves = new Set(valveControlIds(spec));
  const switches = new Set(switchControlIds(spec));
  return [
    ...Object.keys(inputs.valves)
      .filter((id) => !valves.has(id))
      .map((id) => `unknown valve '${id}' on ${spec.id}`),
    ...Object.keys(inputs.switches)
      .filter((id) => !switches.has(id))
      .map((id) => `unknown switch '${id}' on ${spec.id}`),
  ];
}

function clamp01(x: number | undefined): number {
  return x !== undefined && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Inputs restricted to this spec's controls: every id present, values clamped to 0–1, unknown ids dropped. */
export function sanitiseInputs(spec: ApplianceSpec, inputs: PlayerInputs): PlayerInputs {
  return {
    throttle: clamp01(inputs.throttle),
    valves: Object.fromEntries(valveControlIds(spec).map((id) => [id, clamp01(inputs.valves[id])])),
    switches: Object.fromEntries(
      switchControlIds(spec).map((id) => [id, inputs.switches[id] === true]),
    ),
  };
}

/** Neutral inputs: throttle idle, every valve shut, every switch off. */
export function idleInputs(spec: ApplianceSpec): PlayerInputs {
  return sanitiseInputs(spec, { throttle: 0, valves: {}, switches: {} });
}
