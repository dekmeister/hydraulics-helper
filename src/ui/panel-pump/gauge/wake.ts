// The Wake (Design §6, sheet 04): a needle's afterimage over the last few seconds of sim time.
// band = min…max over the window (a sliver when steady, a fan when hunting); ghosts = past needle
// positions at fixed intervals, fading with age. Pure functions of the samples; no React.

export interface WakePoint {
  /** Sim time, s. */
  tS: number;
  v: number;
}

export interface Ghost {
  value: number;
  opacity: number;
}

export interface Wake {
  band: { lo: number; hi: number } | null;
  ghosts: Ghost[];
}

/** Design §6 figures: 3 s window, 5 ghosts 0.6 s apart, opacity 0.26 (newest) to 0.07. */
export const WAKE = {
  windowS: 3,
  ghostCount: 5,
  ghostIntervalS: 0.6,
  opacity: [0.26, 0.07],
} as const;

/** Latest sample at or before `tS`. Samples are oldest first. */
function atOrBefore(samples: readonly WakePoint[], tS: number): WakePoint | undefined {
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s !== undefined && s.tS <= tS + 1e-9) return s;
  }
  return undefined;
}

/** Band and ghosts for samples ordered oldest first; empty with no samples. */
export function computeWake(samples: readonly WakePoint[]): Wake {
  const now = samples.at(-1)?.tS;
  if (now === undefined) return { band: null, ghosts: [] };
  const inWindow = samples.filter((s) => s.tS >= now - WAKE.windowS - 1e-9);
  const values = inWindow.map((s) => s.v);
  const band = { lo: Math.min(...values), hi: Math.max(...values) };
  const ghosts: Ghost[] = [];
  const [o0, o1] = WAKE.opacity;
  for (let k = 1; k <= WAKE.ghostCount; k++) {
    const s = atOrBefore(samples, now - k * WAKE.ghostIntervalS);
    if (s === undefined) break;
    const f = (k - 1) / (WAKE.ghostCount - 1);
    ghosts.push({ value: s.v, opacity: o0 + (o1 - o0) * f });
  }
  return { band, ghosts };
}
