# Plan — Pump Operator Training Game

Companion to `ARCHITECTURE.md`. Milestones are sized so a Claude Code session can complete one (or a slice of one) end-to-end with tests passing. Each milestone has a demoable outcome — never merge work that can't be shown running.

## Ways of working

* One milestone (or one checklist item) per session. Read `ARCHITECTURE.md` and `CLAUDE.md` first.
* Sim behaviour lands **tests-first**: write the failing Vitest case from the calibration table, then implement.
* Keep the app runnable at all times (`npm run dev` must never be broken at end of session).
* Anything ambiguous about doctrine/realism: stub it behind a constant, note it in `docs/CALIBRATION.md` under "needs Dek", and move on.

## M0 — Scaffold (small)

- [x] Vite + React + TypeScript strict + Vitest + ESLint/Prettier; `npm run dev / test / lint / build` all green.
- [x] Responsive shell: two placeholder panels, side-by-side ≥ 900 px, stacked below; test on a phone-sized viewport.
- [x] `sim/` package with `advance()` stub + one trivial passing test, proving the sim/UI boundary.
- [x] Playwright (exact-pinned) with `phone` / `tablet` / `desktop` projects against `vite build --mode e2e` + preview; `e2e/fixtures.ts` failing on console errors (`docs/TESTING.md` §4).
- [x] `src/testing/`: `window.__pumpops` stub (`load` / `step` / `settle` / `getState`), real-time loop disabled in e2e mode, `?fixture=` gallery with one fixture (`shell/empty`). Verify it's absent from the production bundle.
- [x] Layout invariants spec on the empty shell (no horizontal scroll, side-by-side ≥ 900 px vs stacked).
- [x] Review reporter: `npm run review` writes `review/report.md`, contact sheets, diffs; self-hosted font; first baselines committed. `npm run verify` chains everything. `.gitignore` gets `review/`, `test-results/`, `playwright-report/`.

**Demo:** empty two-panel app that resizes correctly; `npm run verify` green; `review/sheets/shell-empty.png` shows it at three widths.

## M1 — Core hydraulics: tank attack (the heart)

- [x] Types: `ApplianceSpec` (§9.2), `TruckState`, `HoseLine`, `Branch`, `PlayerInputs` (keyed by spec control ids, §9.3).
- [x] Reference appliance: **Cat 1 tanker** spec in `sim/appliances/` + catalogue. Manual-backed traits: electric rotary vane primer (1 min on in 3), relief valve preset (not adjustable) and dumping to tank. Pump curve, rpm and tank figures are PLACEHOLDER until Dek supplies them.
- [x] Pump curve + engine RPM lag + throttle input.
- [x] Single-truck network solver: tank source → the spec's deliveries (any N) → hose segments from the shared 25–90 mm catalogue → branch orifice; valve losses; elevation.
- [x] Tank volume integration; runs-dry behaviour (flow collapse, not a crash).
- [x] Calibration tests: ≥ 5 worked examples from `docs/CALIBRATION.md` asserted to within tolerance.
- [x] Appliance contract suite (`describe.each` over the catalogue): determinism (same inputs → identical state after N ticks), NaN fuzz, runs-dry.
- [x] Test fixture: a minimal second "test appliance" (different delivery count, no primer) registered only in tests, so single-appliance assumptions fail early.
- [x] Golden trace for the tank-attack scripted run (CSV snapshot per appliance) + `npm run sim:trace`.

**Demo:** headless — `npm run sim:trace -- tank-attack` prints gauges over time for a scripted run.

## M2 — Pump panel UI

- [x] Parameterised SVG `Gauge` (discharge, compound dual-scale, tacho, tank level).
- [x] `ValveHandle` (drag + tap), `Throttle`, tank-to-pump control; ≥ 44 px hit targets; keyboard operable.
- [x] Panel rendered from the reference appliance's layout data (`ui/appliances/<id>/layout.ts`); layout↔spec consistency test.
- [x] Wire to store: inputs → sim @ 10 Hz → damped needle rendering.
- [x] Warning strip (low tank, overheat placeholder, cavitation placeholder).
- [x] Fixtures: each gauge face at key values (zero, mid, red zone, compound vacuum); generated per-appliance panel fixtures (`idle`, `tank-attack-700`, `tank-low`). Contact sheets reviewed, baselines committed.
- [x] Journeys: tank attack, second line sag, runs dry, valve drag precision; layout invariants over every panel fixture; keyboard pass.

**Demo:** playable tank attack — open tank-to-pump, open delivery, throttle up, watch discharge gauge and tank fall; sag when a second line opens.

### M2 implementation plan

Decisions taken to keep M2 demoable without building past `Design/OPEN_DECISIONS.md` (each is flagged under "needs Dek" in `docs/CALIBRATION.md`):

* **Panel layout is grouped, not absolute.** `ui/appliances/<id>/layout.ts` is an ordered list of sections (instruments, throttle, inlets, deliveries…), each placing spec instruments and controls with label, gauge face and control variant. The renderer lays sections out with CSS grid / container queries so one layout works at 375, 768 and 1280 px; each component draws its own SVG in its own `viewBox`. The realistic bay and close-up views (Design sheets 07–08, `layout-a.json` coordinates) are a later view over the same data, not M2.
* **Handle colour by function (OPEN_DECISIONS #1, option B, the designer's recommendation):** outlets blue, inlets green; delivery identity is carried by numeral and glyph only.
* **Tap behaviour is layout data.** `tap: 'toggle'` (tank-to-pump: tap opens/closes) or `tap: 'none'` (deliveries: a stray thumb never charges a line, Design §5). ARCHITECTURE §7 said every valve toggles on tap and the Design spec says outlets ignore taps, so this is a per-item choice.
* **One throttle variant:** the push-pull T-handle (horizontal drag + − / + buttons). The vernier knob (Layout A, OPEN_DECISIONS #4) is parked.
* **Instruments are `role="meter"`** (docs/TESTING.md), not `role="img"` (Design §9). `aria-valuenow` is the damped, displayed value.
* **No per-delivery flow readouts on the panel**: the spec fits no flow meters. Line status ("NO LINE" when nothing is laid on a delivery) is shown, and those valves are disabled, per Design sheet 03.
* **The Wake** (needle afterimage) is parked until M4 cavitation, where hunting matters. The geometry module keeps its arc helpers.
* **Warning lamps are read-only in M2.** Acknowledging a lamp needs coaching cards (M6).

Work order (one commit each, `npm run verify` green at the end):

1. **Harness repair.** `.gitignore` `review/` → `/review/`. Rebuild `e2e/review/reporter.ts` (report.md, contact sheets, shots, diffs), which M0 lost to that pattern. Add an opt-in `PW_CHROMIUM_EXECUTABLE` for machines whose preinstalled Chromium doesn't match the pinned Playwright.
2. **Gauge geometry + dials** (`ui/panel-pump/gauge/`). Port `Design/reference-impl/gaugeScale.ts` and its tests to Vitest. Dial presets: discharge 0–1600, compound −100…1600 dual scale, tacho 0–4000. Zones are PLACEHOLDER (OPEN_DECISIONS #5).
3. **`Gauge` component** (one parameterised SVG; mini variant below 100 px) and `TankLevel` (five-segment LED column, amber ≤ ¼, alarm outline when empty).
4. **Store + selectors.** Store actions `setValve`, `setThrottle`, `setSwitch`; an instrument reading per `InstrumentKind`; the line on each delivery; warnings. The default app state is the tank-attack scenario's initial state (lines laid, nothing open). Tests in Vitest.
5. **Needle damping.** A pure critically damped step function (Vitest) plus a `useDampedValue` hook on `requestAnimationFrame`. `__pumpops.settle()` snaps every needle via `flushSync`.
6. **Controls.** `ValveHandle` (quarter-turn lever, drag by angle about the pivot, Pointer Events only, `role="slider"`, arrows ±10 %, Home/End, optional tap toggle, disabled reason chip), `Throttle` (T-handle slider + − / + buttons, 5 % steps), `PrimerControl` (hold = switch on; behaviour arrives in M4). All targets ≥ 44 px.
7. **Panel renderer + layouts.** `PumpPanel` iterates the layout. Cat 1 layout; a layout for the test-only appliance lives in `src/testing/` so the e2e build proves the renderer is generic. Layout↔spec consistency test over every catalogue appliance and the test appliance.
8. **Warning strip.** Lamps: tank (caution ≤ ¼, alarm empty), no supply (deliveries open with every inlet shut), over-pressure (relief flowing), and engine temperature and cavitation shown as "not simulated yet" placeholders. A polite live region carries the text.
9. **Test hooks + fixtures.** `__pumpops.load({ scenario })` loads a scenario's initial state. Gauge-face fixtures (discharge, compound, tacho, tank at key values), a controls fixture, and generated panel fixtures per appliance (`idle`, `tank-attack-700`: throttle found by bisection so it holds for any appliance, `tank-low`, `tank-empty`).
10. **Journeys + invariants.** Tank attack, second-line sag, runs dry, valve drag precision, throttle drag; keyboard pass; layout invariants (44 px, no scroll, no overlap, every spec control and instrument rendered once) over the app and every panel fixture.
11. **Review loop**, baselines, docs (ARCHITECTURE §7/§9.4 reconciled with what was built, TESTING, CALIBRATION "needs Dek").

## M3 — Scene panel v1

- [x] Static SVG scene: truck, hose lays, branches, firefighters, dam; composed from components. Truck art chosen by appliance id; hose lays drawn from the spec's deliveries.
- [x] Minimal reactivity: hose "charged" styling when flowing, branch spray on/off, water source level.
- [x] Scene↔panel correspondence: tapping a hose lay highlights its delivery on the panel (and vice versa).
- [x] Scene fixtures (all charged / one line off / tank low) and a journey for the correspondence tap.

**Demo:** turn off a delivery and the corresponding branch stops spraying.

### M3 implementation plan

Decisions taken to keep M3 demoable and schematic (PLAN risk "scope creep on scene art"); each open one is flagged under "needs Dek" in `docs/CALIBRATION.md`:

* **Scene geometry is UI data, not sim data.** `HoseLine` has no coordinates, and shouldn't: the sim only needs lengths and elevation. A pure function (`ui/panel-scene/geometry.ts`) lays every line out from the scene art and the sim's lines: lines fan out from their delivery's coupling toward the fireground, each branch sits at a straight-line distance proportional to the hose laid (hoses snake, so ~85 % of the length), and the map scale shrinks so the longest line fits. The scale bar is drawn from that scale. Trucks, crews and the dam are map symbols, drawn larger than scale.
* **Truck art is per-appliance data** (`ui/appliances/<id>/scene.ts`, registered like panel layouts): body size, cab end, tank hatch, and one coupling position per delivery, keyed by spec delivery id. One generic `ApplianceArt` component draws it. A consistency test checks art ↔ spec one-to-one, as for the panel layout. The test appliance's art lives in `src/testing/appliances/`.
* **Delivery identity comes from the panel layout** (tag + glyph), so the scene and panel can never disagree. Charged hoses are outlet blue for every line (OPEN_DECISIONS #1 option B); the glyph marker at the branch carries identity.
* **"Charged" means flowing.** Branches can't be shut by the crew yet (parking lot), so a pressurised line is a flowing one: a line is charged when its delivery flows ≥ 1 L/min (a display threshold, not physics). Otherwise a laid line is drawn dry; a delivery with no line shows a blank cap on its coupling.
* **Water source level is the truck's tank** (a fill bar on the truck, amber with a triangle at ≤ ¼, red outline when empty, the same thresholds as the panel). The dam is static scenery until draughting arrives in M4.
* **The scene SVG is `role="img"`; an HTML legend is its accessible, thumb-sized equivalent.** A hose drawn at phone scale is a few px wide and the bounding boxes of curved paths overlap, so the hoses can't be the 44 px targets. The legend lists every delivery (glyph, tag, label, "charged · 280 L/min" / "laid, dry" / "no line") plus the tank, and each row is a button. Tapping a hose on the map also works, through a wide invisible hit stroke.
* **Correspondence is UI state in the store** (`highlight: { deliveryId, from }`), never sim state. Tapping a hose or a legend row ("Show Delivery 1 on panel") highlights that delivery's panel row and scrolls it into view; each panel delivery row gets a "Show Delivery 1 on scene" button (its text block, beside the drag-only valve) that highlights the hose and legend row. Tapping the highlighted item again clears it. Highlight is a double ring in dial colour and ink (Design §3 focus ring), never amber.
* **Motion:** the flow highlight dash animates only under `prefers-reduced-motion: no-preference`; screenshots run reduced, so they are static.
* **No elevation terrain yet.** Contours are decorative and unlabelled; a branch above or below the pump gets a "+14 m" label. The hydraulic section view (sheet 06) is parked.

Work order (one commit each, `npm run verify` green at the end):

1. **Plan** (this section).
2. **Selectors + store.** `selectDeliveryLines(sim)` → per spec delivery: line, flow, branch pressure, state `charged | dry | none`; `tankFraction`; store `highlight` + `setHighlight` (toggle), cleared on `reset`. Vitest.
3. **Scene art data.** `SceneArt` type, Cat 1 art, test-appliance art, registry, shared delivery glyph paths (moved out of `DeliveryTag`), art ↔ spec consistency test.
4. **Geometry.** Pure `layoutScene(art, lines, view)` → truck pose, coupling points, a Bézier path + branch point + heading per laid line, map scale. Vitest: every laid line starts at its delivery's coupling, every branch inside the view, deterministic, longer lines reach further, a very long lay shrinks the scale instead of leaving the view.
5. **Scene components** (`ui/panel-scene/`): `Backdrop` (ground tints, contours, track, scrub, dam, fire glow, north arrow), `ApplianceArt` (body, cab, hatch, couplings, tank fill bar), `HoseLay` (dry / charged with flow highlight, highlight halo, `data-testid="hose-lay-<id>"`, `data-state`), `BranchCrew` (branch glyph marker, crew figure, spray fan when flowing), `SceneLegend`, `SceneView`; mounted in `AppShell`.
6. **Panel side of the correspondence.** Delivery row "Show … on scene" button with `aria-pressed`, highlighted row style, scroll into view.
7. **Fixtures.** Generated per appliance: `scene/<id>/all-charged`, `one-line-off`, `tank-low`, `tank-empty`, and `scene/<id>/highlighted` (whole shell, first line highlighted on both panels). The test appliance gets `all-charged` and `one-line-off`. Scene fixture states built from pure sim calls next to the panel states.
8. **Journeys + invariants.** `e2e/journeys/scene.spec.ts` over every journey appliance: the demo (open both lines → both charged and spraying; close one → it goes dry and stops spraying, the other keeps going), tank runs dry → every line dry, scene→panel tap on the hose itself, panel→scene tap, toggle off. Layout invariants over the scene fixtures (44 px, no scroll, no overlap, one legend row per delivery, one hose lay per line). Keyboard pass includes the new buttons.
9. **Review loop**, baselines (every panel and shell baseline changes because the scene is no longer empty), docs (ARCHITECTURE §3/§7/§9.4, TESTING, CALIBRATION "needs Dek", PLAN tick).

## M4 — Sources, priming, failure behaviours

- [x] Hydrant/collector inlet source.
- [x] Draughting: suction lift, primer interaction, prime/lose-prime states, compound gauge vacuum. Primer behaviour switches on `primer.kind` (rotary vane duty cycle / hand diaphragm / self-priming), each kind tested.
- [x] Cavitation model + gauge flutter + throttle-does-nothing behaviour.
- [x] Overheat on churn; water hammer detection + penalty.
- [x] Tests for each behaviour (e.g. "lift 8 m ⇒ cannot achieve rated flow").

**Demo:** successfully draught from the dam; then induce and recover from cavitation.

### M4 implementation plan

Decisions taken to keep M4 honest and demoable; each open figure is a `PLACEHOLDER` flagged under "needs Dek" in `docs/CALIBRATION.md`:

* **Inlets are ports; what's plugged into them is scenario data.** `InletKind` becomes `'tank' | 'suction'` (was `tank | hydrant | draught | relay`): Layout A's 64 mm suction inlet (B3) with its green-lever valve (B5) takes hard suction to a dam *or* a collecting head and layflat from a hydrant, so the source can't be a property of the truck. Scenarios add `sources: WaterSource[]` (`hydrant` with static pressure and main loss; `static` water such as a dam, with lift and volume) and `supplies: SupplyLine[]` (inlet → source over hose segments), alongside `lines`. M5's relay becomes a third supply kind.
* **One inlet model for every source.** Each open inlet path is a source head and a resistance: tank `0 − R·Q²`; hydrant `static − (main + layflat + inlet valve)·Q²` (C14's square law); draught `−10·lift − (hard suction + strainer + inlet valve)·Q²` (C11). Paths combine in parallel at the pump inlet. Shared figures (hard suction friction, strainer loss) go in `constants.ts`; the inlet valve loss stays on the spec.
* **Cavitation is a floor on inlet pressure.** The pump cavitates when its inlet gauge pressure would fall below `pump.cavitationInletKpa` (fitted: −84 kPa reproduces Table 4's lift derate, 1/7 at 4.5 m, 1/3 at 6 m, 1/2 at 7 m, to a few %). A layflat supply also collapses below 0 kPa, so over-running a hydrant reads "inlet zero" (Table 7). At the floor the inlet flow is capped, so the pump's flow is fixed and **more throttle does nothing**: the discharge is whatever the open lines take at that flow. Intensity (0–1) comes from how much more the pump would take without the floor. Gauges flutter with seeded noise (`SimState.rngState`, `__pumpops.load({ seed })`), scaled by intensity; readings stay clean in the sim and the selectors add the flutter, so traces and calibration checks don't carry noise.
* **Priming fills the suction hose.** Tank and hydrant supplies are flooded (positive head) and never need priming; a draught path supplies water only once primed. The primer pulls vacuum on the casing (plus the suction hose when the suction valve is open) towards its `maxVacuumKpa`, at a rate set by its air displacement over the air volume; the pump catches when the vacuum lifts water to the pump (`vacuum ≥ 10·lift`). An open delivery is an air leak, so vacuum can't build (manual: leaking delivery valve, L3265–3276); with the suction valve shut it builds fast and holds (the vacuum test). `primer.kind` switches: rotary vane (switch, duty cycle: a 60 s run trips a cut-out that clears after the 1-in-3 rest), hand diaphragm (switch = stroking the handle, slower, no duty limit), self-priming (no control; primes whenever the suction path is open), none (can't draught). Prime is lost when the dam runs out. Primer max vacuum puts the priming limit just under 8 m (manual: 7.5 m max attempted).
* **Overheat on churn.** Pump water temperature integrates churn heat `churnKw·(rpm/max)³` against flow-through cooling (`Q·4.186·ΔT`). Deliveries and relief dumped to the tank carry heat away; relief dumped to the inlet recirculates and doesn't. A dry pump doesn't heat (no water). Lamp at 60 / 80 °C.
* **Water hammer** is Joukowsky's surge `ρ·a·Δv` on a delivery whose valve closed this tick, Δv being the drop in hose velocity over one tick. Above a threshold it's an event: a tally (the penalty; scoring reads it in M6) and a lamp latched for 5 s sim time. Only valve closures count, so a tank running dry or cavitation onset isn't hammer. Inlet (butterfly) hammer is parked.
* **Tallies, not scores.** `TruckState.tally` accumulates cavitation seconds, overheat seconds, water hammer count and worst surge. M6 turns it into a debrief.
* **Panel:** Cat 1 gains the suction inlet valve (green, tap toggles, beside tank-to-pump). The primer shows a vacuum ring, RUNNING / PRIMED ✓ / CHECK SUCTION (running 30 s unprimed, Design §5) / COOLING (cut-out). Temperature and cavitation lamps go live and a HAMMER lamp is added; the "not simulated" lamps go. Compound needle turns amber while cavitating. **The Wake** (Design §6) is wired: the store keeps 3 s of sim-time readings per instrument, and each dial draws the min–max band and five ghosts, so hunting shows as a fan even through needle damping.
* **Scene:** scene-art couplings are keyed by control id with a kind (`delivery | inlet`, PLAN parking lot); a supply lay runs from the suction coupling to the dam (hard suction, strainer, green core once primed) or a hydrant on the track (layflat, green when charged, dashed when soft). While cavitating, charged hoses break into gaps (Design §6). The legend adds a non-interactive row per supply.
* **Scenario picker:** a native select in the shell header loads any scenario the active appliance can play (tank attack, hydrant supply, draughting), so the demo is reachable without the test API. Scenario selection proper is M6.
* **Test appliance** gains a suction inlet and a self-priming pump, so draughting is proven with a different primer kind and no primer control.

Work order (one commit each, `npm run verify` green at the end):

1. **Plan** (this section).
2. **Sources and solver.** Types (`InletKind`, `WaterSource`, `SupplyLine`, pump fields, `SimState.sources/supplies/rngState`), parallel inlet paths with cavitation floor and soft-hose collapse, per-inlet flow, tank and dam volumes. Tests first: hydrant compound positive and falls with flow, C14, tank and hydrant in parallel, the floor caps flow, throttle does nothing at the floor, relief to tank refills it on a hydrant. Tank-attack trace columns must stay identical.
3. **Priming.** Pump state (`primed`, vacuum, primer duty), every `primer.kind`, vacuum test, open delivery blocks priming, lose prime on an empty dam, C11 (4 m lift → −40 kPa), Table 4 derate at 3–7 m, "lift 8 m ⇒ can't prime", "7 m ⇒ half rated flow".
4. **Cavitation intensity and flutter.** Seeded noise, intensity, tally; determinism with seeds.
5. **Overheat and water hammer.** `thermal.ts`, `hammer.ts`, tallies, events.
6. **Scenarios.** `hydrant-supply` and `draughting` (Table-1 branches, lift 4 m), `ScriptStep.switches`, capability checks (`suction`, primer or self-priming), trace columns (primed, vacuum, cavitation, temperature, per-inlet flow), golden traces, contract suite (prime/lose prime, cavitation onset, fuzz with supplies, determinism) over every appliance with a suction inlet.
7. **State.** Selectors (warnings with supply reasons, primer status, supply lays, displayed readings with flutter, cavitating flag), store `loadScenario`, wake history. Vitest.
8. **Panel UI.** Layout items (suction valve; test-appliance intake), `PrimerControl` states and ring, amber needle, Wake band and ghosts, lamps.
9. **Scene UI.** Couplings by control id, `SupplyLay`, hydrant symbol, cavitation gaps, legend supply rows; art ↔ spec test covers inlets.
10. **Scenario picker** in the shell header.
11. **Fixtures + journeys.** Shell fixtures per eligible appliance: `draught-priming`, `draught-working`, `cavitating` (stepped so the Wake fans), `hydrant`, `faults` (hot pump + hammer lamp); gallery fixtures `gauge/wake` and the primer states. Journeys: draught and prime through the real primer, induce and recover cavitation with the throttle, hydrant over-run, overheat and recover, water hammer by slamming a valve, vacuum test. Layout invariants cover the new fixtures automatically.
12. **Review loop**, baselines, docs (ARCHITECTURE §4.3/§4.6/§4.8/§9, CALIBRATION rows and "needs Dek", TESTING, PLAN tick).

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
* Cat 1 hose reels (Layout A has two, with their own valves) and the discharge master valve. Deferred from M1 (Dek, 2026-10-24).
* Engine key switch / engine stop; M1 assumes the pump engine is always running.
* Branch shut-off by the crew (branch operator closing a controlled branch) as a scenario event.
* Unlined hose in scenarios (the catalogue already has it); hose carried per appliance.
* Multiple independent pumps on one appliance (`pumps: PumpSpec[]`, e.g. separate high-pressure reel pump) — deferred, see `ARCHITECTURE.md` §9.2.
* Realistic bay view and zone C close-up (Design sheets 07–08, `Design/layouts/layout-a.json`) as a second view over the panel layout data.
* Vernier-knob throttle variant (Layout A, Design OPEN_DECISIONS #4); M2 ships the T-handle only.
* Warning lamp acknowledge (tap → steady, opens a coaching card); needs coaching cards (M6).
* `@axe-core/playwright` WCAG audit now that real controls exist (new dependency: ask Dek).
* **Inputs have two sources of truth** (before M5, multi-truck relay): the store keeps one global `inputs`, while `TruckState.inputs` is the copy last applied on a tick, and there is no action to change the active truck. Make the active truck's inputs the single source, or key `inputs` by truck id. (PR #1 review.)
* **Layout vocabulary gaps** (M7, PR #1 review): `primer` items have no variant, but a diaphragm primer is a handle, not a hold-to-run button (the sim treats its switch as "stroking"); an adjustable relief needs its own set-pressure control kind rather than `valve` (open/closed, inlet/outlet colour); `{ kind: 'warnings' }` shows every lamp the sim can light (temperature, cavitation, hammer), whatever the truck actually fits.
* Scene follow-ups (M3): hydraulic section view along a line (Design sheet 06) with pump, friction, head and branch figures; elevation terrain that matches line elevations; a pressure-scaled spray throw; hose casing swelling on over-pressure and gaps on cavitation (Design §6 scene cues, with M4); a relay truck on the scene (M5).
* **Scene off-screen on a phone while operating** (PR #2 review): below 900 px the scene stacks above the panel, so turning a delivery valve and watching its branch stop needs a scroll (the scene↔panel locate buttons scroll both ways). Candidates: a compact sticky scene or line-state HUD strip on phones, or a panel/scene tab switch. Needs a design decision before M4 adds more to watch.
* **Scene model for M5** (PR #2 review): couplings are now keyed by control id with a `kind` (M4), and supplies end at the dam or one hydrant from `site.ts`. M5 needs several trucks with truck-to-truck links: grow a scene model (trucks, sources, links) with this fan layout as the per-truck piece, place more than one source of a kind, and key `highlight` by truck as well as delivery.
* **Pressurised vs flowing** (with branch shut-off above, CALIBRATION row 13): `LineState` `charged` is "delivery flows"; once a branch can be shut, split it so the hose follows pressure (`DeliveryLine.branchKpa`) and the spray follows flow.
* Fan layout with many lines: spread is capped (38°, 16° per step), so 5–6 lines at short reach would crowd the branch markers. Fine for v1 (≤ 3 deliveries); revisit with a bigger truck (M7).
* The e2e + review run is now ~2 min + ~1 min with the M4 fixtures and journeys (budget ~60 s total, docs/TESTING.md §4): the overheat journey steps 400 s of sim and the shell fixtures are full-page at three widths. Trim (e.g. scene-alone fixtures that the shell fixtures now cover) or parallelise before adding more.
* M4 follow-ups: water hammer on inlet (butterfly) valves and weighted by hose size; hydrant back-fill into an open tank valve and tank fill from a hydrant, the tank-to-hydrant changeover surge (manual L1083–1098); prime-loss events (air leak at a coupling, vortex, strainer blocking) and dam level dropping the lift (M6 events); engine load droop, so losing prime shows the manual's rpm surge; pump damage from sustained cavitation or overheat as a fail state (M6); a temperature gauge where an appliance fits one.
* On a 375 px phone the six warning lamps wrap HAMMER onto a second row, and the long scenario titles truncate in the picker. Both readable; tidy when lamps get acknowledge (M6).
* Split `ValveHandle.tsx` (~260 lines) and `Gauge.tsx` (~250) under the ~200-line guideline; both are mostly SVG.
* Multiplayer relay (two humans, one relay) — architecture keeps state serialisable for this, but it's far off.

## Risks

* **Calibration is the credibility risk.** Wrong friction-loss numbers teach wrong habits. Mitigation: `docs/CALIBRATION.md` as single source of truth, Dek validates against RFS doctrine before M2 ships.
* **Solver stability** at edge cases (all valves nearly closed, zero-flow). Mitigation: clamp + bisection (monotone), fuzz test with random inputs asserting no NaNs.
* **Scope creep on scene art.** Mitigation: scene stays schematic-cute until M6; the panel is the product.
* **Single-appliance assumptions creeping in** (hardcoded "4 deliveries", per-delivery input fields). Mitigation: CLAUDE.md rule 9, the test-only second appliance from M1, and the contract suite.
* **Flaky or rubber-stamped visual tests.** Screenshot suites rot if they flake or if baselines get updated without looking. Mitigation: determinism rules and the review loop in `docs/TESTING.md` (text assertions first, baselines updated only after the image is reviewed and the reason stated).
* **Over-abstracting before a second real appliance exists.** Mitigation: the spec covers only what the reference appliance needs plus fields already known to vary (§9.1); M7 is where the abstraction is proven and corrected.
