// Names the lesson dock uses, taken from the panel layout so it can't disagree with the panel.
import type { Metric } from '../../state/lessonView';
import type { SimState } from '../../sim/types';
import type { RealisticLayout, RealItem } from '../appliances/realistic';
import type { PanelLayout } from '../appliances/types';
import { itemKey } from '../appliances/itemKey';

/** The label of the panel item with `key`, for a coach step's `{target}`. */
export function targetLabel(layout: PanelLayout, key: string): string {
  if (key === 'warnings') return 'the warning lamps';
  const item = layout.sections.flatMap((s) => s.items).find((i) => itemKey(i) === key);
  return item !== undefined && 'label' in item ? item.label : 'the control';
}

/**
 * How to work the panel item with `key`, for a coach step's `{gesture}`, from the layout the player
 * is looking at (`realistic` when the realistic view is showing): a lever's colour and whether a
 * tap works, the throttle's kind. Lesson copy can't say this itself: it plays on every appliance.
 */
export function gestureHint(
  layout: PanelLayout,
  realistic: RealisticLayout | undefined,
  key: string,
): string {
  const item = layout.sections.flatMap((s) => s.items).find((i) => itemKey(i) === key);
  if (item === undefined) return 'use it';
  switch (item.kind) {
    case 'valve':
    case 'delivery': {
      const colour = item.kind === 'valve' && item.function === 'inlet' ? 'green' : 'blue';
      return item.tap === 'toggle'
        ? `tap its ${colour} handle, or drag it a quarter turn to open it part way`
        : `drag its ${colour} handle a quarter turn`;
    }
    case 'throttle': {
      const real = realistic?.plates.flatMap((p) => p.items).find((i) => i.kind === 'throttle');
      if (real?.kind === 'throttle') return THROTTLE_HINTS[real.variant];
      return 'the throttle’s − and + buttons';
    }
    case 'primer':
      return 'hold it on';
    default:
      return 'use it';
  }
}

/** How to trim a realistic throttle, by its variant. */
const THROTTLE_HINTS: Readonly<Record<Extract<RealItem, { kind: 'throttle' }>['variant'], string>> =
  { 'speed-switch': 'the speed switch: a flick up or down, or hold it' };

/** The delivery a line is on, by its panel label ('Delivery 1'), or the line id. */
export function lineLabel(layout: PanelLayout, sim: SimState, line: string): string {
  const deliveryId = [...sim.lines, ...sim.links].find((l) => l.id === line)?.deliveryId;
  const item = layout.sections
    .flatMap((s) => s.items)
    .find((i) => i.kind === 'delivery' && i.control === deliveryId);
  return item !== undefined && 'label' in item ? item.label : line;
}

const kpa = (x: number) => `${String(Math.round(x))} kPa`;
const lpm = (x: number) => `${String(Math.round(x))} L/min`;

function target(min: number | undefined, max: number | undefined, unit: (x: number) => string) {
  if (min !== undefined && max !== undefined) return `target ${unit(min)}–${unit(max)}`;
  if (min !== undefined) return `${unit(min)} or more`;
  return max === undefined ? '' : `${unit(max)} or less`;
}

/** A live reading against its target: 'Branch on Delivery 1: 332 kPa · target 315 kPa–385 kPa'. */
export function metricText(layout: PanelLayout, sim: SimState, m: Metric): string {
  switch (m.kind) {
    case 'branch':
      return `Branch on ${lineLabel(layout, sim, m.line)}: ${kpa(m.kpa)} · ${target(m.minKpa, m.maxKpa, kpa)}`;
    case 'flow':
      return `${lineLabel(layout, sim, m.line)}: ${lpm(m.lpm)} · ${target(m.min, m.max, lpm)}`;
    case 'gauge': {
      const name = m.gauge === 'rpm' ? 'Engine' : m.gauge === 'compound' ? 'Compound' : 'Discharge';
      const unit = m.gauge === 'rpm' ? (x: number) => `${String(Math.round(x))} rpm` : kpa;
      return `${name}: ${unit(m.value)} · ${target(m.min, m.max, unit)}`;
    }
  }
}

/** True when a metric's reading is within its target. */
export function metricMet(m: Metric): boolean {
  const [v, min, max] =
    m.kind === 'branch'
      ? [m.kpa, m.minKpa, m.maxKpa]
      : m.kind === 'flow'
        ? [m.lpm, m.min, m.max]
        : [m.value, m.min, m.max];
  return (min === undefined || v >= min) && (max === undefined || v <= max);
}
