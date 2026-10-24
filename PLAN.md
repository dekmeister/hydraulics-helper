# Plan — Pump Operator Training Game

Companion to `ARCHITECTURE.md`. Milestones are sized so a Claude Code session can complete one (or a slice of one) end-to-end with tests passing. Each milestone has a demoable outcome — never merge work that can't be shown running.

## Ways of working

* One milestone (or one checklist item) per session. Read `ARCHITECTURE.md` and `CLAUDE.md` first.
* Sim behaviour lands **tests-first**: write the failing Vitest case from the calibration table, then implement.
* Keep the app runnable at all times (`npm run dev` must never be broken at end of session).
* Anything ambiguous about doctrine/realism: stub it behind a constant, note it in `docs/CALIBRATION.md` under "needs Dek", and move on.

## M0 — Scaffold (small)

- [ ] Vite + React + TypeScript strict + Vitest + ESLint/Prettier; `npm run dev / test / lint / build` all green.
- [ ] Responsive shell: two placeholder panels, side-by-side ≥ 900 px, stacked below; test on a phone-sized viewport.
- [ ] `sim/` package with `advance()` stub + one trivial passing test, proving the sim/UI boundary.

**Demo:** empty two-panel app that resizes correctly.

## M1 — Core hydraulics: tank attack (the heart)

- [ ] Types: `TruckState`, `HoseLine`, `Branch`, `PlayerInputs`.
- [ ] Pump curve + engine RPM lag + throttle input.
- [ ] Single-truck network solver: tank source → up to 4 deliveries → 38/65 mm hose segments → branch orifice; valve losses; elevation.
- [ ] Tank volume integration; runs-dry behaviour (flow collapse, not a crash).
- [ ] Calibration tests: ≥ 5 worked examples from `docs/CALIBRATION.md` asserted to within tolerance.
- [ ] Determinism test: same inputs → identical state after N ticks.

**Demo:** headless — a test script prints gauges over time for a scripted run.

## M2 — Pump panel UI

- [ ] Parameterised SVG `Gauge` (discharge, compound dual-scale, tacho, tank level).
- [ ] `ValveHandle` (drag + tap), `Throttle`, tank-to-pump control; ≥ 44 px hit targets; keyboard operable.
- [ ] Wire to store: inputs → sim @ 10 Hz → damped needle rendering.
- [ ] Warning strip (low tank, overheat placeholder, cavitation placeholder).

**Demo:** playable tank attack — open tank-to-pump, open delivery, throttle up, watch discharge gauge and tank fall; sag when a second line opens.

## M3 — Scene panel v1

- [ ] Static SVG scene: truck, hose lays, branches, firefighters, dam; composed from components.
- [ ] Minimal reactivity: hose "charged" styling when flowing, branch spray on/off, water source level.
- [ ] Scene↔panel correspondence: tapping a hose lay highlights its delivery on the panel (and vice versa).

**Demo:** turn off a delivery and the corresponding branch stops spraying.

## M4 — Sources, priming, failure behaviours

- [ ] Hydrant/collector inlet source.
- [ ] Draughting: suction lift, primer interaction, prime/lose-prime states, compound gauge vacuum.
- [ ] Cavitation model + gauge flutter + throttle-does-nothing behaviour.
- [ ] Overheat on churn; water hammer detection + penalty.
- [ ] Tests for each behaviour (e.g. "lift 8 m ⇒ cannot achieve rated flow").

**Demo:** successfully draught from the dam; then induce and recover from cavitation.

## M5 — Relay pumping

- [ ] `RelayLink` + multi-truck solve order.
- [ ] Closed relay: supply truck feeds receiving inlet; residual-pressure lesson; over-pressure burst event.
- [ ] Open relay: discharge into tank/portable dam; dam volume dynamics.
- [ ] Second truck on scene panel; switch panels by tapping a truck; non-player truck holds fixed settings (AI later).

**Demo:** two-truck closed relay pushing water uphill; open relay via portable dam.

## M6 — Scenarios, tutorial, scoring, polish

- [ ] Scenario data format + loader; objectives, triggers, pass/fail; the 7-scenario ladder from `ARCHITECTURE.md` §5.
- [ ] Tutorial coach-marks engine; scenario 1 fully guided.
- [ ] Scoring + debrief screen ("you cavitated for 40 s; here's why").
- [ ] Audio pass (engine note by RPM, primer, cavitation rattle, spray) — behind a mute toggle.
- [ ] Settings + progress in `localStorage`; PWA manifest so it installs to a phone home screen.

**Demo:** a new player completes scenarios 1–3 unassisted.

## Later / parking lot

* Reactive firefighters (lose water → animate + radio call), incident escalation.
* Instructor mode: author/import scenarios as JSON.
* Replays and shareable debriefs.
* Additional appliances (Cat 7/9, bulk water), pump-specific quirks.
* Multiplayer relay (two humans, one relay) — architecture keeps state serialisable for this, but it's far off.

## Risks

* **Calibration is the credibility risk.** Wrong friction-loss numbers teach wrong habits. Mitigation: `docs/CALIBRATION.md` as single source of truth, Dek validates against RFS doctrine before M2 ships.
* **Solver stability** at edge cases (all valves nearly closed, zero-flow). Mitigation: clamp + bisection (monotone), fuzz test with random inputs asserting no NaNs.
* **Scope creep on scene art.** Mitigation: scene stays schematic-cute until M6; the panel is the product.
