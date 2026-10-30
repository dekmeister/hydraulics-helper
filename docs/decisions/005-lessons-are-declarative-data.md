# 005 — Lessons are symbolic, JSON-shaped data run beside the sim

**Decision.** A lesson (`sim/lesson/types.ts`) is plain data: a brief, objectives, failures, events and coach steps, all built from one condition vocabulary (`conditions.ts`). It is symbolic so one lesson plays on every eligible appliance: a valve is `{ inlet: 'suction' }` or `{ line: 'line-38' }`, never a spec control id, and copy uses placeholders (`{line:…}`, `{kpa:…}`, `{target}`, `{gesture}`) that the loader and dock fill in, so no copy names one truck's controls.

- `loadScenario` builds the fireground and validates the lesson against it (`lesson/validate.ts`): every valve, line, source, relay, instrument and named objective, event or coach step must resolve, with event effects projected in order. Problems throw, listed.
- Progress (`lesson/progress.ts` `stepLesson`) runs after each sim tick in the store, not inside `SimState`. Events apply pure effects (`lesson/effects.ts`); `advance()` is unchanged.
- **Winnable everywhere, proved.** `lesson/operator.ts` is a scripted operator, and `scenarios/ladder.test.ts` plays every ladder scenario's `solution` on every eligible appliance and support pairing, requiring a clean three-star pass.
- Scoring is gentle (60 points for objectives, 40 for clean running less capped penalties; CALIBRATION 33), and the debrief (`state/debrief.ts`) says why each fault happened.
- A scenario's `setting` (`bush`, `village`, `interface`) picks the crews' hose and the scene's backdrop; the sim never reads it.

**Why.** Symbolic data lets one lesson serve every truck, and keeps it checkable at load time. It also leaves room for instructor-authored scenarios; the fireground is still a `build()` function (BACKLOG).

**Costs.** Lesson event effects are validated in definition order but fire in condition order (BACKLOG code health). The sandbox is its own fireground with no lesson (`scenarios/freePlay.ts`).
