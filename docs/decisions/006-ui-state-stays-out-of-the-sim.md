# 006 — UI reads sim state through selectors; UI-only state never enters it

**Decision.**
- The UI reads through `state/selectors.ts` and writes only through `PlayerInputs` actions on the store. Components never mutate sim state.
- State that exists only for the screen lives in the store beside `SimState`: the scene↔panel highlight, the Wake (the last 3 s of displayed readings), lesson progress, settings. It is never sim state.
- Anything cosmetic is added at the edge. Cavitation gauge flutter is a seeded random walk added to the *displayed* readings by the selectors, so sim readings, traces and calibration stay clean. Needles chase readings with a critically damped spring in `ui/panel-pump/damping.ts`.
- Scene geometry is UI data. `HoseLine` has no coordinates; `ui/panel-scene/geometry.ts` lays the scene out as a pure function of the truck's scene art and the lines. Water in pipes and hoses is drawn from sim flows (`state/plumbing.ts`), adding no hydraulics.
- Testability is a UI requirement (`docs/TESTING.md` §3): instruments are `role="meter"` with `aria-valuenow` in native units, controls use Pointer Events only, and the e2e build replaces the real-time loop with `__pumpops.step()`.

**Why.** The sim stays a pure library that a Vitest case can exercise without rendering, and the UI can be reviewed and tested against real readings rather than pixels.

**Costs.** The speed controller's ramp lives in the store (`state/throttleRamp.ts`), so scripts, lessons and traces can't see it (BACKLOG).
