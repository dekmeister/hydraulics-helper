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
- [ ] Playwright (exact-pinned) with `phone` / `tablet` / `desktop` projects against `vite build --mode e2e` + preview; `e2e/fixtures.ts` failing on console errors (`docs/TESTING.md` §4).
- [ ] `src/testing/`: `window.__pumpops` stub (`load` / `step` / `settle` / `getState`), real-time loop disabled in e2e mode, `?fixture=` gallery with one fixture (`shell/empty`). Verify it's absent from the production bundle.
- [ ] Layout invariants spec on the empty shell (no horizontal scroll, side-by-side ≥ 900 px vs stacked).
- [ ] Review reporter: `npm run review` writes `review/report.md`, contact sheets, diffs; self-hosted font; first baselines committed. `npm run verify` chains everything. `.gitignore` gets `review/`, `test-results/`, `playwright-report/`.

**Demo:** empty two-panel app that resizes correctly; `npm run verify` green; `review/sheets/shell-empty.png` shows it at three widths.

## M1 — Core hydraulics: tank attack (the heart)

- [ ] Types: `ApplianceSpec` (§9.2), `TruckState`, `HoseLine`, `Branch`, `PlayerInputs` (keyed by spec control ids, §9.3).
- [ ] Reference appliance: **Cat 1 tanker** spec in `sim/appliances/` + catalogue. Manual-backed traits: electric rotary vane primer (1 min on in 3), relief valve preset (not adjustable) and dumping to tank. Pump curve, rpm and tank figures are PLACEHOLDER until Dek supplies them.
- [ ] Pump curve + engine RPM lag + throttle input.
- [ ] Single-truck network solver: tank source → the spec's deliveries (any N) → 38/65 mm hose segments → branch orifice; valve losses; elevation.
- [ ] Tank volume integration; runs-dry behaviour (flow collapse, not a crash).
- [ ] Calibration tests: ≥ 5 worked examples from `docs/CALIBRATION.md` asserted to within tolerance.
- [ ] Appliance contract suite (`describe.each` over the catalogue): determinism (same inputs → identical state after N ticks), NaN fuzz, runs-dry.
- [ ] Test fixture: a minimal second "test appliance" (different delivery count, no primer) registered only in tests, so single-appliance assumptions fail early.
- [ ] Golden trace for the tank-attack scripted run (CSV snapshot per appliance) + `npm run sim:trace`.

**Demo:** headless — `npm run sim:trace -- tank-attack` prints gauges over time for a scripted run.

## M2 — Pump panel UI

- [ ] Parameterised SVG `Gauge` (discharge, compound dual-scale, tacho, tank level).
- [ ] `ValveHandle` (drag + tap), `Throttle`, tank-to-pump control; ≥ 44 px hit targets; keyboard operable.
- [ ] Panel rendered from the reference appliance's layout data (`ui/appliances/<id>/layout.ts`); layout↔spec consistency test.
- [ ] Wire to store: inputs → sim @ 10 Hz → damped needle rendering.
- [ ] Warning strip (low tank, overheat placeholder, cavitation placeholder).
- [ ] Fixtures: each gauge face at key values (zero, mid, red zone, compound vacuum); generated per-appliance panel fixtures (`idle`, `tank-attack-700`, `tank-low`). Contact sheets reviewed, baselines committed.
- [ ] Journeys: tank attack, second line sag, runs dry, valve drag precision; layout invariants over every panel fixture; keyboard pass.

**Demo:** playable tank attack — open tank-to-pump, open delivery, throttle up, watch discharge gauge and tank fall; sag when a second line opens.

## M3 — Scene panel v1

- [ ] Static SVG scene: truck, hose lays, branches, firefighters, dam; composed from components. Truck art chosen by appliance id; hose lays drawn from the spec's deliveries.
- [ ] Minimal reactivity: hose "charged" styling when flowing, branch spray on/off, water source level.
- [ ] Scene↔panel correspondence: tapping a hose lay highlights its delivery on the panel (and vice versa).
- [ ] Scene fixtures (all charged / one line off / tank low) and a journey for the correspondence tap.

**Demo:** turn off a delivery and the corresponding branch stops spraying.

## M4 — Sources, priming, failure behaviours

- [ ] Hydrant/collector inlet source.
- [ ] Draughting: suction lift, primer interaction, prime/lose-prime states, compound gauge vacuum. Primer behaviour switches on `primer.kind` (rotary vane duty cycle / hand diaphragm / self-priming), each kind tested.
- [ ] Cavitation model + gauge flutter + throttle-does-nothing behaviour.
- [ ] Overheat on churn; water hammer detection + penalty.
- [ ] Tests for each behaviour (e.g. "lift 8 m ⇒ cannot achieve rated flow").

**Demo:** successfully draught from the dam; then induce and recover from cavitation.

## M5 — Relay pumping

- [ ] `RelayLink` + multi-truck solve order. Tests include a relay between two **different** appliance specs.
- [ ] Closed relay: supply truck feeds receiving inlet; residual-pressure lesson; over-pressure burst event.
- [ ] Open relay: discharge into tank/portable dam; dam volume dynamics.
- [ ] Second truck on scene panel; switch panels by tapping a truck; non-player truck holds fixed settings (AI later).

**Demo:** two-truck closed relay pushing water uphill; open relay via portable dam.

## M6 — Scenarios, tutorial, scoring, polish

- [ ] Scenario data format + loader; objectives, triggers, pass/fail; the 7-scenario ladder from `ARCHITECTURE.md` §5. Scenarios name appliances by id or declare required capabilities (§9.6); loader validates them.
- [ ] Tutorial coach-marks engine; scenario 1 fully guided.
- [ ] Scoring + debrief screen ("you cavitated for 40 s; here's why").
- [ ] Audio pass (engine note by RPM, primer, cavitation rattle, spray) — behind a mute toggle.
- [ ] Settings + progress in `localStorage`; PWA manifest so it installs to a phone home screen.

**Demo:** a new player completes scenarios 1–3 unassisted.

## M7 — Second appliance (proves extensibility)

- [ ] Add a second real appliance by following the `ARCHITECTURE.md` §9.7 checklist: spec, calibration section, layout, scene art. Choice and figures from Dek.
- [ ] Appliance picker in scenario selection; generic scenarios playable on both.
- [ ] Any engine change needed is a new spec field/enum, not an appliance special case. Record in `ARCHITECTURE.md` anything the spec didn't anticipate.

**Demo:** the same tank-attack scenario on two appliances with different panels and pump performance.

## Later / parking lot

* Reactive firefighters (lose water → animate + radio call), incident escalation.
* Instructor mode: author/import scenarios as JSON.
* Replays and shareable debriefs.
* Further appliances beyond M7 (Cat 7/9, bulk water, urban pumper, portable pump), pump-specific quirks.
* Multiple independent pumps on one appliance (`pumps: PumpSpec[]`, e.g. separate high-pressure reel pump) — deferred, see `ARCHITECTURE.md` §9.2.
* Multiplayer relay (two humans, one relay) — architecture keeps state serialisable for this, but it's far off.

## Risks

* **Calibration is the credibility risk.** Wrong friction-loss numbers teach wrong habits. Mitigation: `docs/CALIBRATION.md` as single source of truth, Dek validates against RFS doctrine before M2 ships.
* **Solver stability** at edge cases (all valves nearly closed, zero-flow). Mitigation: clamp + bisection (monotone), fuzz test with random inputs asserting no NaNs.
* **Scope creep on scene art.** Mitigation: scene stays schematic-cute until M6; the panel is the product.
* **Single-appliance assumptions creeping in** (hardcoded "4 deliveries", per-delivery input fields). Mitigation: CLAUDE.md rule 9, the test-only second appliance from M1, and the contract suite.
* **Flaky or rubber-stamped visual tests.** Screenshot suites rot if they flake or if baselines get updated without looking. Mitigation: determinism rules and the review loop in `docs/TESTING.md` (text assertions first, baselines updated only after the image is reviewed and the reason stated).
* **Over-abstracting before a second real appliance exists.** Mitigation: the spec covers only what the reference appliance needs plus fields already known to vary (§9.1); M7 is where the abstraction is proven and corrected.
