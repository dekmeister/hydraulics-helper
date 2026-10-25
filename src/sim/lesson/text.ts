// Lesson copy that names what was laid on this appliance: a light tanker's crews run 38 mm where a
// Cat 1's run 65 mm, so text says `{line:line-65}` and the loader fills in what's on the ground.
import { BRANCH_OPTIMUM_KPA } from '../constants';
import { hoseType } from '../hose';
import type { SimState } from '../types';
import { workingFlowLpm } from './refs';
import type { LessonDef } from './types';

/**
 * Placeholders, each naming a line laid by the scenario or one of its events:
 * - `{line:ID}` "65 mm line", `{hose:ID}` "65 mm", `{tip:ID}` "20 mm", `{kpa:ID}` "500 kPa" (its
 *   branch's Table 1 pressure);
 * - `{flow:ID:F}` F × the line's working flow, to 10 L/min, e.g. "700 L/min" (`ofWorking` targets).
 * `{target}` is the UI's (the coach target's label) and passes through.
 */
const PLACEHOLDER = /\{(line|hose|tip|kpa|flow):([^}:]+)(?::([0-9.]+))?\}/g;

function fill(
  state: SimState,
  kind: string,
  id: string,
  fraction: string | undefined,
): string | undefined {
  const lay = state.lines.find((l) => l.id === id);
  const first = lay?.segments[0];
  if (lay === undefined || first === undefined) return undefined;
  const hoseMm = `${String(hoseType(first.hose).sizeMm)} mm`;
  switch (kind) {
    case 'line':
      return `${hoseMm} line`;
    case 'hose':
      return hoseMm;
    case 'tip':
      return `${String(lay.branch.tipMm)} mm`;
    case 'kpa': {
      const kpa = BRANCH_OPTIMUM_KPA[lay.branch.tipMm];
      return kpa === undefined ? undefined : `${String(kpa)} kPa`;
    }
    case 'flow': {
      const working = workingFlowLpm(state, id);
      const f = Number(fraction);
      if (working === undefined || fraction === undefined || !Number.isFinite(f)) return undefined;
      return `${String(Math.round((f * working) / 10) * 10)} L/min`;
    }
    default:
      return undefined;
  }
}

/** Placeholders in `text` that don't resolve on `state`; empty when every one does. */
export function textProblems(text: string, state: SimState): string[] {
  return [...text.matchAll(PLACEHOLDER)]
    .filter(([, kind, id, f]) => fill(state, kind ?? '', id ?? '', f) === undefined)
    .map(([m]) => `text: '${m}' names nothing laid`);
}

/** `text` with every placeholder filled from `state`; one that doesn't resolve is left as written. */
export function resolveText(text: string, state: SimState): string {
  return text.replace(
    PLACEHOLDER,
    (m, kind: string, id: string, f: string | undefined) => fill(state, kind, id, f) ?? m,
  );
}

/** Every string in a lesson that a player reads. */
function mapText(def: LessonDef, f: (text: string) => string): LessonDef {
  return {
    ...def,
    brief: f(def.brief),
    objectives: def.objectives.map((o) => ({ ...o, text: f(o.text) })),
    ...(def.failures === undefined
      ? {}
      : { failures: def.failures.map((x) => ({ ...x, text: f(x.text) })) }),
    ...(def.events === undefined
      ? {}
      : {
          events: def.events.map((e) =>
            e.radio === undefined ? e : { ...e, radio: { ...e.radio, text: f(e.radio.text) } },
          ),
        }),
    ...(def.coach === undefined
      ? {}
      : { coach: def.coach.map((c) => ({ ...c, text: f(c.text) })) }),
  };
}

/** The lesson's copy filled in for `state` (the fireground with every event's lines laid). */
export function resolveLessonText(def: LessonDef, state: SimState): LessonDef {
  return mapText(def, (t) => resolveText(t, state));
}

/** Every unresolvable placeholder in the lesson's copy. */
export function lessonTextProblems(def: LessonDef, state: SimState): string[] {
  const problems: string[] = [];
  mapText(def, (t) => {
    problems.push(...textProblems(t, state));
    return t;
  });
  return problems;
}
