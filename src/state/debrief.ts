// The debrief: what went wrong in a lesson and why, in plain words. Pure.
import { RELAY_MIN_RESIDUAL_KPA } from '../sim/constants';
import type { CavitationSupply, DryCause, LessonProgress } from '../sim/lesson/progress';
import type { Score } from '../sim/lesson/score';
import type { LessonDef } from '../sim/lesson/types';

export interface Finding {
  id: string;
  tone: 'good' | 'fault';
  title: string;
  detail: string;
}

export interface Debrief {
  headline: string;
  findings: Finding[];
}

const seconds = (s: number) => `${String(Math.round(s))} s`;
const times = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The key with the largest value, if any is positive. */
function largest<K extends string>(m: Partial<Record<K, number>>): K | undefined {
  let best: K | undefined;
  for (const [k, v] of Object.entries(m) as [K, number][]) {
    if (v > 0 && (best === undefined || v > (m[best] ?? 0))) best = k;
  }
  return best;
}

const CAVITATION_WHY: Record<CavitationSupply, string> = {
  static:
    'The lift couldn’t supply that much water, so the inlet sat at its limit and more throttle ' +
    'added nothing. Ease the throttle until the compound steadies.',
  hydrant:
    'You over-ran the hydrant: the compound fell to zero and the supply hose went soft. Ease the ' +
    'throttle back; the compound’s positive reading is the water the hydrant has left.',
  relay:
    'You over-ran the relay: the residual on the compound fell to zero. Ease back, and keep it ' +
    `above ${String(RELAY_MIN_RESIDUAL_KPA)} kPa.`,
  tank: 'The tank feed couldn’t keep up with the flow you asked for. Ease the throttle back.',
};

const DRY_WHY: Record<DryCause, string> = {
  tank: 'the tank ran dry',
  prime: 'the pump lost its prime',
  relay: 'the relay hose burst',
  other: 'the supply couldn’t keep up',
};

/** Findings for a finished (or abandoned) lesson, faults first, worst first. */
export function debrief(def: LessonDef, p: LessonProgress, score: Score): Debrief {
  const findings: Finding[] = [];
  const failure = def.failures?.find((f) => f.id === p.failure);
  if (failure !== undefined)
    findings.push({ id: 'failure', tone: 'fault', title: 'Scenario failed', detail: failure.text });

  const amount = (id: string) => score.lines.find((l) => l.id === id)?.amount ?? 0;
  const cavitationS = amount('cavitation');
  if (cavitationS > 0) {
    const why = largest(p.stats.cavitationBy) ?? 'tank';
    findings.push({
      id: 'cavitation',
      tone: 'fault',
      title: `You cavitated for ${seconds(cavitationS)}`,
      detail: CAVITATION_WHY[why],
    });
  }
  if (p.stats.crewDryS > 0) {
    const why = largest(p.stats.dryCauses) ?? 'other';
    findings.push({
      id: 'crew-dry',
      tone: 'fault',
      title: `A crew was without water for ${seconds(p.stats.crewDryS)}`,
      detail: `Their delivery was open but ${DRY_WHY[why]}. Watch the gauges that warn you first.`,
    });
  }
  if (p.stats.bareOpenS > 0)
    findings.push({
      id: 'bare-outlet',
      tone: 'fault',
      title: `Water ran out an empty delivery for ${seconds(p.stats.bareOpenS)}`,
      detail:
        `About ${String(Math.round(p.stats.bareOpenL / 10) * 10)} L went on the ground at the ` +
        'truck. Keep a delivery with nothing connected shut.',
    });
  const bursts = amount('bursts');
  if (bursts > 0)
    findings.push({
      id: 'bursts',
      tone: 'fault',
      title: `${times(bursts, 'relay length', 'relay lengths')} burst`,
      detail:
        'Cutting the flow at the receiving pump sends a surge back up the relay hose. Throttle ' +
        'down first, then ease valves shut.',
    });
  const hammer = amount('hammer');
  if (hammer > 0)
    findings.push({
      id: 'hammer',
      tone: 'fault',
      title: `Water hammer ${times(hammer, 'time', 'times')}`,
      detail: 'A delivery was shut too fast. Close valves over a few seconds, never slam them.',
    });
  const overheatS = amount('overheat');
  if (overheatS > 0)
    findings.push({
      id: 'overheat',
      tone: 'fault',
      title: `The pump ran hot for ${seconds(overheatS)}`,
      detail:
        'Water churned in the pump with nowhere to go. With the lines shut, keep the throttle at ' +
        'idle or crack a delivery.',
    });
  if (findings.length === 0)
    findings.push({
      id: 'clean',
      tone: 'good',
      title: 'Clean running',
      detail: 'No cavitation, overheating, water hammer, wasted water or crews left without water.',
    });

  const headline =
    p.status === 'passed'
      ? 'Scenario complete'
      : p.status === 'failed'
        ? 'Scenario failed'
        : 'Scenario not finished';
  return { headline, findings };
}
