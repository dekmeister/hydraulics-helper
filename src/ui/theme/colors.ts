// Design tokens as CSS custom-property references (tokens.css), for SVG `style` props.
// SVG presentation attributes don't resolve var(), so pass these through `style`.

export const COLOR = {
  ink: 'var(--color-material-ink)',
  dial: 'var(--color-material-dial)',
  galv: 'var(--color-material-galv)',
  galvLight: 'var(--color-material-galv-light)',
  galvMid: 'var(--color-material-galv-mid)',
  galvDark: 'var(--color-material-galv-dark)',
  galvEdge: 'var(--color-material-galv-edge)',
  steel: 'var(--color-material-steel)',
  steelDim: 'var(--color-material-steel-dim)',
  pencil: 'var(--color-material-pencil)',
  tankLit: 'var(--color-material-tank-lit)',
  tankUnlit: 'var(--color-material-tank-unlit)',
  outlet: 'var(--color-function-outlet)',
  outletStroke: 'var(--color-function-outlet-stroke)',
  inlet: 'var(--color-function-inlet)',
  inletStroke: 'var(--color-function-inlet-stroke)',
  caution: 'var(--color-signal-caution)',
  alarm: 'var(--color-signal-alarm)',
  alarmText: 'var(--color-signal-alarm-text-on-dark)',
} as const;
