// Readout formatting (Design §3): whole numbers, a space as the thousands separator ("1 050 kPa").

/** Round to a whole number and group thousands with a plain space, e.g. 1050 → "1 050". */
export function formatWhole(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  const sign = n < 0 ? '−' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Value with its unit, e.g. "1 050 kPa". */
export function formatReading(value: number, unit: string): string {
  return `${formatWhole(value)} ${unit}`;
}

/** 0–1 as a whole percentage, e.g. 0.6 → "60 %". */
export function formatPercent(fraction: number): string {
  return `${formatWhole(fraction * 100)} %`;
}
