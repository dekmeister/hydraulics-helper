/**
 * The Wake (sheet 04): the needle's afterimage over the last few seconds.
 *
 *   band   = min..max of the value over the window          → drawn as a translucent arc band
 *   ghosts = past needle positions at fixed intervals         → faint needle lines, fading with age
 *   hunting = the value keeps reversing direction with a wide band → drives the optional flutter
 *
 * The wake is information, not decoration: with prefers-reduced-motion it is still drawn;
 * only the flutter animation is removed.
 */

export interface WakeOptions {
  windowS: number;          // default 3
  ghostCount: number;       // default 5
  ghostIntervalS: number;   // default 0.6
  ghostOpacity: [number, number]; // newest → oldest, default [0.26, 0.07]
}

export interface Sample { t: number; v: number }
export interface Ghost { value: number; opacity: number; ageS: number }

const DEFAULTS: WakeOptions = { windowS: 3, ghostCount: 5, ghostIntervalS: 0.6, ghostOpacity: [0.26, 0.07] };

export class WakeBuffer {
  private samples: Sample[] = [];
  readonly opts: WakeOptions;

  constructor(opts: Partial<WakeOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  /** Add a sample. `t` in seconds, monotonically increasing (e.g. sim time). */
  push(t: number, v: number): void {
    const last = this.samples[this.samples.length - 1];
    if (last && t < last.t) throw new Error('WakeBuffer.push: time went backwards');
    this.samples.push({ t, v });
    // Keep everything inside the window plus the newest sample at/before the cutoff,
    // so the oldest ghost (age == windowS) always has a sample to read.
    const cutoff = t - Math.max(this.opts.windowS, this.opts.ghostCount * this.opts.ghostIntervalS);
    let drop = 0;
    while (drop < this.samples.length - 1 && this.samples[drop + 1].t <= cutoff) drop++;
    if (drop) this.samples.splice(0, drop);
  }

  clear(): void { this.samples = []; }

  get latest(): Sample | undefined { return this.samples[this.samples.length - 1]; }

  /** Samples inside the window (t >= now − windowS). */
  private windowed(): Sample[] {
    const now = this.latest?.t;
    if (now === undefined) return [];
    return this.samples.filter((s) => s.t >= now - this.opts.windowS - 1e-9);
  }

  /** min..max over the window, or null with no samples. */
  band(): { lo: number; hi: number } | null {
    const w = this.windowed();
    if (!w.length) return null;
    let lo = Infinity, hi = -Infinity;
    for (const s of w) { if (s.v < lo) lo = s.v; if (s.v > hi) hi = s.v; }
    return { lo, hi };
  }

  /** Past needle positions, newest first. Uses the latest sample at or before each target time. */
  ghosts(): Ghost[] {
    const now = this.latest?.t;
    if (now === undefined) return [];
    const { ghostCount, ghostIntervalS, ghostOpacity: [o0, o1] } = this.opts;
    const out: Ghost[] = [];
    for (let k = 1; k <= ghostCount; k++) {
      const target = now - k * ghostIntervalS;
      const s = this.sampleAtOrBefore(target);
      if (!s) break;
      const f = ghostCount === 1 ? 0 : (k - 1) / (ghostCount - 1);
      out.push({ value: s.v, opacity: o0 + (o1 - o0) * f, ageS: now - s.t });
    }
    return out;
  }

  /**
   * True when the needle is hunting: at least `minReversals` direction changes in the window,
   * each move larger than `deadband`, and a band wider than `minSpan`.
   * Typical compound-gauge values: minSpan 15 kPa, deadband 2 kPa.
   */
  isHunting(minSpan: number, deadband = 0, minReversals = 4): boolean {
    const b = this.band();
    if (!b || b.hi - b.lo < minSpan) return false;
    const w = this.windowed();
    let reversals = 0, dir = 0, ref = w[0].v;
    for (const s of w) {
      const d = s.v - ref;
      if (Math.abs(d) <= deadband) continue;
      const nd = Math.sign(d);
      if (dir !== 0 && nd !== dir) reversals++;
      dir = nd; ref = s.v;
    }
    return reversals >= minReversals;
  }

  private sampleAtOrBefore(t: number): Sample | undefined {
    for (let i = this.samples.length - 1; i >= 0; i--) if (this.samples[i].t <= t + 1e-9) return this.samples[i];
    return undefined;
  }
}
