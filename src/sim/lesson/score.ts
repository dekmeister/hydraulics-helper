// Scoring a lesson (ARCHITECTURE §5): gentle, a trainer not a punisher. The weights are UI tuning,
// not physics. // PLACEHOLDER — needs Dek (CALIBRATION "needs Dek": scoring)
import type { SimState } from '../types';
import type { LessonProgress } from './progress';
import { truckOf } from './refs';
import type { LessonDef } from './types';

/** Points for completing the objectives, shared equally between them. */
export const OBJECTIVE_POINTS = 60;
/** Points for clean running, less the penalties below. */
export const CLEAN_POINTS = 40;

interface Penalty {
  /** Points off per unit (second or event). */
  per: number;
  /** Most it can take off. */
  cap: number;
}

export const PENALTIES = {
  cavitation: { per: 0.5, cap: 15 },
  overheat: { per: 0.5, cap: 10 },
  hammer: { per: 5, cap: 15 },
  bursts: { per: 20, cap: 20 },
  crewDry: { per: 0.5, cap: 15 },
} as const satisfies Record<string, Penalty>;

export type ScoreLineId = 'objectives' | keyof typeof PENALTIES;

export interface ScoreLine {
  id: ScoreLineId;
  /** How much of it there was: objectives done, seconds, or events. */
  amount: number;
  /** Points: positive for objectives, zero or negative for penalties. */
  points: number;
}

export interface Score {
  /** 0–100. */
  points: number;
  /** 0 when failed or unfinished; a pass earns at least 1. */
  stars: 0 | 1 | 2 | 3;
  lines: ScoreLine[];
}

/** Points for 2 and 3 stars. */
export const STAR_POINTS = { two: 75, three: 90 } as const;

const penalty = (id: keyof typeof PENALTIES, amount: number): ScoreLine => {
  const { per, cap } = PENALTIES[id];
  return { id, amount, points: -Math.min(cap, per * amount) };
};

/**
 * The lesson's score: objectives done, then penalties for cavitation and overheat seconds, water
 * hammer, burst relay lengths and seconds a crew was left without water. Uses the faults frozen at
 * the end of the lesson, or the live ones while it runs.
 */
export function scoreLesson(def: LessonDef, p: LessonProgress, state: SimState): Score {
  const truck = truckOf(state, p.playerTruckId, undefined);
  const tally = p.final?.tally ?? truck?.tally;
  const bursts = p.final?.bursts ?? state.trucks.reduce((n, t) => n + t.tally.hoseBursts, 0);
  const done = def.objectives.filter((o) => p.objectives[o.id]?.doneAtS !== undefined).length;
  const lines: ScoreLine[] = [
    {
      id: 'objectives',
      amount: done,
      points: Math.round((OBJECTIVE_POINTS * done) / Math.max(1, def.objectives.length)),
    },
    penalty('cavitation', tally?.cavitationS ?? 0),
    penalty('overheat', tally?.overheatS ?? 0),
    penalty('hammer', tally?.waterHammer ?? 0),
    penalty('bursts', bursts),
    penalty('crewDry', p.stats.crewDryS),
  ];
  const clean = Math.max(0, CLEAN_POINTS + lines.slice(1).reduce((a, l) => a + l.points, 0));
  const points = Math.round(lines[0]?.points ?? 0) + Math.round(clean);
  const stars =
    p.status !== 'passed' ? 0 : points >= STAR_POINTS.three ? 3 : points >= STAR_POINTS.two ? 2 : 1;
  return { points, stars, lines };
}
