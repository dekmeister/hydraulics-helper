// Names the lesson dock uses, taken from the panel layout so it can't disagree with the panel.
import type { Metric } from '../../state/lessonView';
import type { SimState } from '../../sim/types';
import type { PanelLayout } from '../appliances/types';
import { itemKey } from '../appliances/itemKey';

/** The label of the panel item with `key`, for a coach step's `{target}`. */
export function targetLabel(layout: PanelLayout, key: string): string {
  if (key === 'warnings') return 'the warning lamps';
  const item = layout.sections.flatMap((s) => s.items).find((i) => itemKey(i) === key);
  return item !== undefined && 'label' in item ? item.label : 'the control';
}

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
