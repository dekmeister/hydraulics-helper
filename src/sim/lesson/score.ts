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

/** The caps sum to `CLEAN_POINTS`, so the score's lines always add up to its total. */
export const PENALTIES = {
  cavitation: { per: 0.5, cap: 5 },
  overheat: { per: 0.5, cap: 5 },
  hammer: { per: 5, cap: 10 },
  bursts: { per: 10, cap: 10 },
  crewDry: { per: 0.5, cap: 5 },
  bareOutlet: { per: 0.5, cap: 5 },
} as const satisfies Record<string, Penalty>;

export type ScoreLineId = 'objectives' | 'clean' | keyof typeof PENALTIES;

export interface ScoreLine {
  id: ScoreLineId;
  /** How much of it there was: objectives done, seconds, or events. */
  amount: number;
  /** Points: positive for objectives and clean running, zero or negative for penalties. */
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
 * hammer, burst relay lengths, seconds a crew was left without water and seconds water ran out a
 * delivery with nothing connected. Uses the faults frozen at
 * the end of the lesson, or the live ones while it runs.
 */
export function scoreLesson(def: LessonDef, p: LessonProgress, state: SimState): Score {
  const truck = truckOf(state, p.playerTruckId, undefined);
  const tally = p.final?.tally ?? truck?.tally;
  const bursts = p.final?.bursts ?? state.trucks.reduce((n, t) => n + t.tally.hoseBursts, 0);
  const done = def.objectives.filter((o) => p.objectives[o.id]?.doneAtS !== undefined).length;
  const failed = p.status === 'failed';
  const objectives: ScoreLine = {
    id: 'objectives',
    amount: done,
    points: Math.round((OBJECTIVE_POINTS * done) / Math.max(1, def.objectives.length)),
  };
  // A failed run earns its objectives only: clean running counts towards a finished job, so
  // there is nothing to take penalties from (the faults are still listed, for the debrief).
  const penalties = [
    penalty('cavitation', tally?.cavitationS ?? 0),
    penalty('overheat', tally?.overheatS ?? 0),
    penalty('hammer', tally?.waterHammer ?? 0),
    penalty('bursts', bursts),
    penalty('crewDry', p.stats.crewDryS),
    penalty('bareOutlet', p.stats.bareOpenS),
  ].map((l) => ({ ...l, points: failed ? 0 : Math.round(l.points) }));
  const lines: ScoreLine[] = [
    objectives,
    { id: 'clean', amount: 0, points: failed ? 0 : CLEAN_POINTS },
    ...penalties,
  ];
  const points = lines.reduce((a, l) => a + l.points, 0);
  const stars =
    p.status !== 'passed' ? 0 : points >= STAR_POINTS.three ? 3 : points >= STAR_POINTS.two ? 2 : 1;
  return { points, stars, lines };
}
