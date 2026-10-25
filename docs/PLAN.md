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
* **Tap behaviour is layout data.** `tap: 'toggle'` (tank-to-pump: tap opens/closes) or `tap: 'none'` (deliveries: a stray thumb never charges a line, Design §5). ARCHITECTURE §7 said every valve toggles on tap and the Design spec says outlets ignore taps, so this is a per-item choice. Since 2026-10-25 every Cat 1 valve toggles (Dek); the test appliance keeps `'none'` deliveries so both branches stay tested.
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

- [x] `RelayLink` + multi-truck solve order. Tests include a relay between two **different** appliance specs.
- [x] Closed relay: supply truck feeds receiving inlet; residual-pressure lesson; over-pressure burst event.
- [x] Open relay: discharge into tank/portable dam; dam volume dynamics.
- [x] Second truck on scene panel; switch panels by tapping a truck; non-player truck holds fixed settings (AI later).

**Demo:** two-truck closed relay pushing water uphill; open relay via portable dam.

### M5 implementation plan

Decisions taken to keep M5 honest and demoable; each open figure is a `PLACEHOLDER` flagged under "needs Dek" in `docs/CALIBRATION.md`:

* **A relay is a hose between trucks, not a source.** `RelayLink` (`SimState.links`) leaves a supplying truck's delivery (`truckId`, `deliveryId`, like a `HoseLine`) over hose segments with an elevation, and ends at `to`: `{ kind: 'inlet' }` another truck's suction inlet (closed relay), `{ kind: 'tank' }` another truck's tank or `{ kind: 'dam' }` a static source (open relay). Closed or open follows from where it ends. A delivery carries a line *or* a relay; an inlet takes a supply *or* a relay; closed relays may not form a loop (`site.ts`).
* **Closed relay solve: the supplying pump as an equivalent source.** Seen from its relay delivery, a pump on tank or hydrant supply is exactly `P = H − R·Q²` (pump curve plus inlet square law), so the receiving truck takes the relay as one more inlet path (`head = H − 10·Δh`, `r = R + valve + hose`, layflat collapse at 0) and the existing parallel-inlet and cavitation machinery works unchanged: over-running the relay reads "inlet zero, hose soft" like a hydrant. Each tick, upstream first (topological over closed links), H and R are fitted from two solves of the supplying truck: relay flow 0 and the link's previous flow (a probe flow when it was dry). Then trucks are solved downstream first, each supplying truck with its relay flow fixed at what the receiver drew, so water is conserved exactly. The fit is exact for a pump with only the relay open; with other lines, relief or a cavitation cap it is a secant through the last operating point, which converges over a few ticks (quasi-steady, ARCHITECTURE §4.1). Chains of three or more pumps work the same way.
* **Open relay** is an outlet with no branch: `Q = √((P_d − 10·Δh)/(valve + hose))` into the receiving tank (overflows at capacity) or a dam. Static sources gain an optional `capacityL` (a portable dam holds a fixed amount; open water has none), so a dam both fills and drains: volume dynamics, and lose prime when it runs dry.
* **Over-pressure burst.** Each tick a closed relay hose's peak pressure is its higher end now (start: discharge less valve loss; end: start less friction and head), or, when the receiver cut the flow this tick, a Joukowsky surge on top of the higher end before: the surge runs back up the hose and adds wherever it passes (the manual's shutdown spike, L3865–3873). A flow drop caused by the supplying truck's own valve is water hammer on that truck, not a surge in the hose. At `HOSE_BURST_KPA` a length bursts (`link.burst`, tallied as `hoseBursts` on the supplying truck): the receiver loses the relay, and the supplying delivery runs into the open end at the burst, the manual's "high rpm, low delivery pressure, water flowing" (Table 6). Repairing a length is an M6 event; reload the scenario. Bursting delivery lines (not relays) is parked.
* **Residual-pressure lesson.** The receiving truck's SUPPLY lamp explains its relay (no new lamp, so the panel layout data doesn't change): caution when the compound is below the 100 kPa minimum residual (L3794–3796), caution when it climbs past the hose working pressure (1000 kPa, L945–948), alarm when the relay hose burst, caution when no water comes.
* **Trucks as data.** `createSiteState(trucks, lines, site)` builds any number of trucks (`id`, `label` such as "Base pump", `spec`, held `inputs`, already `primed`); `createInitialState` stays as the one-truck form. The non-player truck holds the inputs the scenario gives it (AI later). Each truck draws flutter from its own RNG stream (`TruckState.rngState`; truck 0 keeps the scenario seed, so one-truck traces and fixtures are unchanged); `SimState.rngState` goes (PR #3 review).
* **Inputs: one source of truth per truck** (PR #1 review). The store's `inputs` are the active truck's controls; every other truck's live only in the sim (`TruckState.inputs`, held between ticks). `setActiveTruck` hands the store's inputs to the truck being left (pure `switchTruck` in `sim/engine.ts`) and takes the new truck's. The highlight carries the truck id and clears on a switch.
* **Scenarios with support trucks.** `Scenario.support` lists the other trucks' roles with their own requirements; `build(spec, support?)` takes a spec per role, defaulting to the player's, so the app plays both relays with two Cat 1s and tests mix the test appliance in either role. `closed-relay`: the base pump, already primed at the farm dam, pushes up 4 lengths of 65 mm to an attack pump 20 m up (C12); the player opens the relay inlet and two lines. `open-relay`: the base pump on the hydrant fills a portable dam beside the attack pump, which primes and draughts from it. Traces of multi-truck runs prefix columns with the truck id and add per-link flow and end pressures and each portable dam's volume; one-truck traces keep their columns.
* **Scene.** One truck: unchanged (same geometry, same baselines). Several: trucks stand at stations along the route from the water to the fire, by relay depth (the most downstream truck nearest the fire, the base pump at the old truck spot by the dam and hydrant); one map scale. A relay hose runs coupling to coupling (closed), into the hatch (tank) or into a portable dam drawn by its receiving truck with a water level. Burst: a split hose with a spray. Each truck is labelled; tapping a truck the player isn't operating switches the panel to it. Delivery-keyed test ids are scoped by `data-truck` / `data-truck-active`. The legend adds relay rows (flow, pressure at the far end, soft, burst) and portable-dam rows.
* **Panel.** A delivery with a relay hose is operable and describes it ("Relay · 4 × 30 m 65 mm lined · to Attack pump · 20 m uphill"). A truck switcher (buttons with `aria-pressed`) in the pump panel's header when there is more than one truck: switching is reachable from the panel on a phone, where the map is scrolled away. The panel remounts per truck, so needles start at the new truck's readings.

Work order (one commit each, `npm run verify` green at the end):

1. **Plan** (this section).
2. **Multi-truck state.** `createSiteState`, labels, per-truck RNG, `links`/`linkReadings` fields, `switchTruck`, `reseed`. All existing traces identical.
3. **Closed relay.** `relay.ts` (order, equivalent source, feeds and outlets), two-phase solve, link readings. Tests first: Cat 1 → test appliance and test appliance → Cat 1, residual = discharge − friction − head, C12/C13 spacing, flow conserved, over-running the relay goes soft and cavitates, chain of three, loop rejected.
4. **Burst and open relay.** Surge, burst and its open end, tallies; open relay into a tank (overflow) and a portable dam (fill, drain, lose prime).
5. **Scenarios.** `closed-relay`, `open-relay`, support roles, trace columns, golden traces (each appliance and mixed), relay contract suite over every pair of appliances.
6. **State.** Store `setActiveTruck`, highlight by truck, selectors by truck, `relayLays`, portable dams, relay warnings. Vitest.
7. **Panel UI.** Relay delivery rows, truck switcher.
8. **Scene UI.** `layoutSite`, truck groups and labels, tap to switch, `RelayLay`, `PortableDam`, burst, legend rows.
9. **Fixtures + journeys.** `relay/<id>/closed-working`, `closed-over-run`, `burst`, `open-dam`, `base-panel` per eligible appliance, plus a mixed-spec closed relay (`relay/<id>/with-test-2d/closed-working`); `__pumpops.load({ support })`. Journeys: the closed-relay demo (residual, over-run, recover), switch trucks by map and switcher, burst by slamming the attack lines, open relay via the portable dam.
10. **Review loop**, baselines, docs (ARCHITECTURE §3/§4.3/§4.7/§4.8/§7/§9.6, TESTING, CALIBRATION relay rows and "needs Dek", PLAN tick).

## M6 — Scenarios, tutorial, scoring, polish

- [x] Scenario data format + loader; objectives, triggers, pass/fail; the 7-scenario ladder from `ARCHITECTURE.md` §5. Scenarios name appliances by id or declare required capabilities (§9.6); loader validates them.
- [x] Tutorial coach-marks engine; scenario 1 fully guided.
- [x] Scoring + debrief screen ("you cavitated for 40 s; here's why").
- [x] Audio pass (engine note by RPM, primer, cavitation rattle, spray) — behind a mute toggle.
- [x] Settings + progress in `localStorage`; PWA manifest so it installs to a phone home screen.

**Demo:** a new player completes scenarios 1–3 unassisted.

### M6 implementation plan

Decisions taken to keep M6 honest, gentle and demoable; each open figure is a `PLACEHOLDER` flagged under "needs Dek" in `docs/CALIBRATION.md`:

* **A lesson is declarative data on the scenario; the site stays a `build()`.** `Scenario.lesson` (`sim/lesson/types.ts`) holds the ladder position, a brief, objectives, failures, events and coach steps as plain JSON-shaped data. Everything in it names things *symbolically*: a valve is `{ inlet: 'tank' | 'suction' }` or `{ line: 'line-38' }` (the delivery that line or relay is on), never a spec control id, so one lesson plays on every eligible appliance. The fireground itself stays `build(spec, support)`, which already lays lines by hose size on any spec; turning it into JSON belongs with instructor-authored scenarios (parking lot).
* **Conditions are one small closed vocabulary**: valve opening, throttle, gauge (discharge, compound, rpm), tank fraction, branch pressure in its working band, line flow, primed, cavitating, source volume, relay burst, fault tallies, sim time, coach acknowledgement, objective done, time since an event fired, and `all` / `any` / `not`. A branch's working band is `BRANCH_OPTIMUM_KPA` for its tip (Table 1) ±`BRANCH_BAND_FRACTION` (10 %, PLACEHOLDER).
* **Loader validates.** `loadScenario(scenario, spec, support)` checks capabilities (`supports()`, plus an optional `appliances` id list on `ScenarioRequirements` for scenarios tied to a vehicle) and walks every condition, event and coach target against the built state: each valve ref resolves to a control on the truck, each line, source and relay exists, each `after` / `objective` names a real objective. Problems throw, listed. A Vitest suite validates every scenario on every eligible appliance and support pair.
* **Objectives, failures, events.** An objective completes once its condition has held for `holdS` (after its `after` objectives) and stays done; all done → passed. A failure condition ends the lesson as failed with its reason (pump damage from sustained cavitation or overheat, the tank running dry with crews on the branches, a portable dam run dry). Events fire once when their condition holds, append a radio call, and apply effects: lay a line on a free delivery, move a branch (extra lengths, height), connect a supply, repair a burst relay, change a support truck's held settings. Effects are pure `SimState → SimState`; `advance()` is untouched.
* **Progress is lesson state beside the sim, not in it.** `stepLesson(def, progress, state, dt)` runs after each tick: fires events (which may change the sim state), updates objectives, coach, failures and debrief stats (crew-without-water seconds: a line that had water whose delivery is still open but no longer flows; cavitation seconds by supply kind, for the "why"). The sim keeps running after a pass or fail so the player can look around; the dock offers the debrief.
* **Scoring is gentle.** 60 points for objectives, 40 for clean running less capped penalties (cavitation, overheat, water hammer, relay bursts, crew without water); failing scores 0 stars, a pass at least 1, ≥ 75 2, ≥ 90 3. Weights are UI tuning (`sim/lesson/score.ts`), flagged for Dek.
* **Winnable on every appliance, proved.** `sim/lesson/operator.ts` is a scripted operator for tests: open, close, prime, and hold a branch or the compound by trimming throttle or gating a delivery, like a competent player. `ladder.test.ts` plays each ladder scenario's `solution` on every eligible appliance (and the test appliance) and asserts a pass with no penalties. The same runs build the debrief fixtures. Golden traces stay on the existing `script`s; `ScriptStep` gains `when` (a condition) so the draughting and open-relay primer is released when the pump catches rather than at a Cat 1 time (trace diff explained in the commit).
* **The ladder** (ARCHITECTURE §5): 1 `first-line` (new: one 38 mm line on tank, fully guided), 2 `tank-attack` (two lines: hold both branches in band), 3 `hydrant-supply` (water from the hydrant without over-running it), 4 `draughting` (prime, deliver, don't cavitate), 5 `closed-relay` (both branches with ≥ 100 kPa residual; a burst length is replaced after a while, not a fail), 6 `open-relay` (deliver without draining the portable dam), 7 `incident` (new: a tank attack where the crew moves uphill, a second line goes in, and a hydrant is connected so the player must change over before the tank runs dry).
* **Modes and screens.** The app opens on a scenario menu (ladder cards with brief, status, best score and stars, "recommended next", disabled with a reason when the appliance can't play one; plus free play). Starting a card is a *lesson*; free play and `__pumpops.load` are the *sandbox* (no lesson, today's behaviour), so every existing journey and fixture is unchanged. An app bar above the screens (outside `AppShell`, so shell baselines don't move) carries the menu button and the sound switch. A debrief screen shows the result, score, objectives, and findings that explain each fault ("You cavitated for 40 s: the lift couldn't supply that much water, so more throttle did nothing…"), with Retry, Next and Scenarios.
* **Coach marks are a dock, not pop-overs.** A lesson dock fixed to the bottom of the viewport shows the current coach step (text on paper, "Got it" for read-only steps) or the next objective with live values against target ("Branch 1: 332 kPa · target 315–385"), the latest radio call (polite live region) and an expandable objective checklist. The coach target (a panel control or instrument, the lamps) gets the focus double ring through a `display: contents` anchor and scrolls into view. Pop-overs would cover the controls they point at on a 375 px phone; a dock covers nothing once the page reserves its height (`padding-bottom` and `scroll-padding-bottom`). The overlap invariant skips dock ↔ page pairs and instead checks that reserve.
* **Settings and progress** live in one versioned `localStorage` blob (`pumpops:v1`: sound, and per scenario × appliance passed / best points / best stars), parsed defensively; storage that throws or is missing degrades to defaults. No `SimState` is saved, so the schema-version item stays parked.
* **Audio** (`src/audio/`): Web Audio, no dependency. A pure `soundParams(truck, inputs)` (Vitest) drives an engine note that follows rpm, a primer whine, a cavitation rattle scaled by intensity and spray noise by flow. Starts on the first tap after sound is on (autoplay rules), suspends when muted or off the play screen; never runs in the e2e build (TESTING §9: test the state, not the sound).
* **PWA**: `manifest.webmanifest`, SVG + PNG icons (generated once by `scripts/make-icons.mjs` with Playwright, committed), theme colour, and a small network-first service worker registered only in production builds. `check-prod-bundle` checks they ship.

Work order (one commit each, `npm run verify` green at the end):

1. **Plan** (this section).
2. **Lesson model**: types, conditions, refs and validation (tests first).
3. **Effects and progress**: events, objectives, failures, coach, stats; scoring.
4. **Scenario format and ladder**: `lesson` on every ladder scenario, `first-line` and `incident`, `appliances` requirement, `loadScenario`, `ScriptStep.when`, test operator + solutions, ladder test, traces for the new scenarios.
5. **State**: persistence, store lesson/screen/settings, debrief findings. Vitest.
6. **Shell**: `AppRoot` with app bar, scenario menu, debrief screen.
7. **Lesson dock and coach targets**; invariant update.
8. **Audio**.
9. **PWA**.

As built (2026-10-25): the plan held, with these changes. Lesson fixtures are captured at the viewport (a fixed dock in a full-page shot lands mid-page). The closed-relay lesson needed the base pump to raise its pressure once both attack lines flow (the fill sequence), done as a lesson event; that moved the closed-relay traces from t = 40 s. The incident is traced from its operator solution, since its events wait on objectives. Scenario titles were kept (they name the fireground, and the picker shows them in every shell baseline), except draughting's, which contradicted its lesson. Failing a lesson earns its objective points only, and the penalty caps sum to the clean-running points so the score table adds up (found in review).
10. **Fixtures + journeys**: menu (fresh, with progress), lesson dock (guided step, objectives with radio), debrief (passed, failed). Journeys: scenario 1 guided through the real controls to the debrief; scenarios 2 and 3 unassisted; progress survives a reload; the incident's events; sound setting persists.
11. **Review loop**, baselines, docs (ARCHITECTURE §3/§5/§7/§8, TESTING, CALIBRATION "needs Dek", PLAN tick).

## R1 — Realistic Cat 1 panel (part-task trainer)

From Dek's Cat 1 photos (`Resources/Photos/Cat1_*`, 2026-10-25), which corrected several Layout A guesses: no discharge master (the big blue lever is the 65 mm outlet's), tank to pump far left, the blue lever above the suction is pump to tank, hydrant to tank is round the side, PRIME is a pull handle on the bumper, the throttle is a speed controller, the small dials are oil temperature and oil pressure, and the tank level is a sight tube.

- [x] Baselines refreshed on the pinned Chromium (the committed ones came from another build).
- [x] Cat 1 65 mm outlet and suction; real gauge faces (compound −100…2500, discharge 0–4000, tacho 0–4000 with the placard limits).
- [x] Sim: pump to tank (`ApplianceSpec.pumpToTank`) and hydrant to tank (`InletKind 'tankFill'`), tests first, contract cases, `tank-refill` free-play scenario and trace.
- [x] Spec `TankDisplay` (sight tube / electronic bands).
- [x] Realistic layout data, generic components (bay lever, pull-handle primer, speed switch, tank gauges, plate backdrop), the Simplified · Realistic switch (saved), fixtures, journeys, review.
- [x] Polish (Dek, 2026-10-25): panel re-spaced on a grid, pipework terminated on fittings and flanges, radial pump (eye inlet, tangential outlet), plates sized from their text, speed switch as a face-on up/down toggle (swipe or press a half). Simplified panel: deliveries as side-by-side cards, half-width sections so it fits a 1080 screen; every Cat 1 valve toggles on a tap.

- [x] Water in the pipework (Dek, 2026-10-25): flowing, still or empty in every bay pipe and the pump, drawn like a charged hose (core + moving streaks); sim latch `PumpState.casingWet` keeps the pump full after the feed shuts; fixtures `after-tank-attack`, `draught-working`.

**Demo:** switch the Cat 1 to Realistic, run a tank attack with the bay levers and the speed controller, prime with the PRIME handle on the draughting fireground, refill at a hydrant through hydrant to tank.

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
* Cat 1 hose reels (two, each with its own blue lever off the discharge manifold; the right one is drawn inert on the realistic bay). Deferred from M1 (Dek, 2026-10-24). There is no discharge master on the Cat 1 (photos, 2026-10-25).
* Engine key switch / engine stop; M1 assumes the pump engine is always running. The realistic Cat 1 panel draws stop, ignition, ALT lamp and start as not in the game yet; "to stop pump, ignition must be on" is on its placard.
* Realistic-view future work (R1): oil temperature and oil pressure gauges (need an engine model), foam (bypass / foam-off / foam-on switch, selection and metering valves), fuses, the air-cleaner indicator, reels; a callouts toggle for a "find it yourself" mode (Design §8); a refill lesson on the `tank-refill` fireground; a hydrant feeding two hoses at once (shared main loss); relays into hydrant to tank; a realistic layout for the test appliance or M7's second truck; Cat 7 photos are in `Resources/Photos/` for when it's built.
* Realistic water follow-ups: an accessible summary of where the water is (pipes are decorative, `aria-hidden`); a drain cock for trucks that have one; water rising up the hard suction while priming; the hose reels' water once reels are modelled.
* **R1 review follow-ups:**
  * The speed controller ramps in the store (`state/throttleRamp.ts`), not the sim, so scripts, lessons and traces can't see it and lesson timing differs between views. Moving it into `advance` (a `PlayerInputs.throttleRate` of −1/0/+1) would make the Simplified view ramp too, which is a design call. Its rates are now in the spec (`EngineSpec.speedController`).
  * Hydrant to tank is an `InletKind` ('tankFill'), so every pump-side sum over `inletFlowLpm` must exclude it (`inletPaths`, `warnings.ts`, `SceneTruck`, `site.ts` do). A separate `tankInlets` field would make that structural.
  * `TEST_APPLIANCE` has no pump to tank, hydrant to tank or realistic layout, so those paths are proven on Cat 1 only, and the electronic `bands` tank gauge has no fixture. Adding them adds the test appliance's tank-refill eligibility, trace columns and fixtures, and needs a review pass.
  * Phone legibility of the realistic bay: plate text is 18–26 viewBox units, ~6–9 px at 320 px, so placards are unreadable and "NO LINE" clips at the plate edge; `e2e/layout.spec.ts` doesn't check text size. The desktop bay is ~1350 px tall, so it can't be seen with the scene.
* Branch shut-off by the crew (branch operator closing a controlled branch) as a scenario event.
* Unlined hose in scenarios (the catalogue already has it); hose carried per appliance.
* Multiple independent pumps on one appliance (`pumps: PumpSpec[]`, e.g. separate high-pressure reel pump) — deferred, see `ARCHITECTURE.md` §9.2.
* Vernier-knob throttle variant (Design OPEN_DECISIONS #4); the Cat 1 turned out to have a speed controller (R1), so the knob waits for a truck that has one.
* Warning lamp acknowledge (tap → steady, opens a coaching card). M6 built the coach as a dock, not cards; a lamp tap could open the lamp's explanation in the dock.
* `@axe-core/playwright` WCAG audit now that real controls exist (new dependency: ask Dek).
* **Layout vocabulary gaps** (M7, PR #1 review): `primer` items have no variant, but a diaphragm primer is a handle, not a hold-to-run button (the sim treats its switch as "stroking"); an adjustable relief needs its own set-pressure control kind rather than `valve` (open/closed, inlet/outlet colour); `{ kind: 'warnings' }` shows every lamp the sim can light (temperature, cavitation, hammer), whatever the truck actually fits.
* Scene follow-ups (M3): hydraulic section view along a line (Design sheet 06) with pump, friction, head and branch figures; elevation terrain that matches line elevations; a pressure-scaled spray throw; hose casing swelling on over-pressure (Design §6 scene cues).
* **Scene off-screen on a phone while operating** (PR #2 review): below 900 px the scene stacks above the panel, so turning a delivery valve and watching its branch stop needs a scroll (the scene↔panel locate buttons scroll both ways). Candidates: a compact sticky scene or line-state HUD strip on phones, or a panel/scene tab switch. Needs a design decision before M4 adds more to watch.
* **Pressurised vs flowing** (with branch shut-off above, CALIBRATION row 13): `LineState` `charged` is "delivery flows"; once a branch can be shut, split it so the hose follows pressure (`DeliveryLine.branchKpa`) and the spray follows flow.
* Fan layout with many lines: spread is capped (38°, 16° per step), so 5–6 lines at short reach would crowd the branch markers. Fine for v1 (≤ 3 deliveries); revisit with a bigger truck (M7).
* The e2e + review run is now ~2 min + ~1 min with the M4 fixtures and journeys, ~2.1 + ~0.9 min after M5 (budget ~60 s total, docs/TESTING.md §4): the overheat journey steps 400 s of sim and the shell fixtures are full-page at three widths. Trim (e.g. scene-alone fixtures that the shell fixtures now cover) or parallelise before adding more.
* M4 follow-ups: water hammer on inlet (butterfly) valves and weighted by hose size; hydrant back-fill into an open tank valve and tank fill from a hydrant, the tank-to-hydrant changeover surge (manual L1083–1098); prime-loss events (air leak at a coupling, vortex, strainer blocking) and dam level dropping the lift (M6 events); engine load droop, so losing prime shows the manual's rpm surge; pump damage from sustained cavitation or overheat as a fail state (M6); a temperature gauge where an appliance fits one.
* On a 375 px phone the six warning lamps wrap HAMMER onto a second row, and the long scenario titles truncate in the picker. Both readable; tidy when lamps get acknowledge (M6).
* Split `ValveHandle.tsx` (~260 lines) and `Gauge.tsx` (~250) under the ~200-line guideline; both are mostly SVG.
* **PR #3 review follow-ups** (M5–M7):
  * Water hammer surge depends on the tick rate (CALIBRATION "needs Dek" 21): measure the closure against the line's 2L/a, not per tick, once Dek picks the model.
  * Priming is one `pump.primed` flag, so `validateSite` allows one static source per truck. Track priming per supply before an appliance with two suction inlets (M7).
  * ~~`Scenario.build()` scripts hand-timed to Cat 1~~: done in M6 (`ScriptStep.when`, and `ladder.test.ts` passes every lesson's solution on every eligible appliance).
  * `SimState` has no schema version; M6 persists only settings and results (versioned), so add one before saving a game in progress.
  * No CI workflow: `npm run verify` runs only locally, and baselines are tied to the pinned browser and OS.
* **M5 follow-ups:**
  * Repairing a burst relay length is a lesson event (M6, closed-relay lesson); in free play a burst relay still needs a reload. Bursting delivery lines (not only relays) on over-pressure, and the tank-to-hydrant changeover surge, with the same peak model.
  * Support trucks hold fixed settings. AI operators (hold 700 kPa at the delivery, the fill sequence of 500 then 700 kPa, L3850–3853), radio calls between operators, and the booster-failure loss (~30 %, L3881) for the relay scenarios (M6).
  * The supplying truck has no lamp for a burst on its own delivery (the receiver's SUPPLY lamp, the scene and the Table 6 gauges show it). Decide with the lamp acknowledge / coaching cards work (M6).
  * Scene stations: trucks at the same relay depth spread across the route, and one farm dam and one hydrant are placed by the base pump's station; scenarios with several hydrants or dams, or trucks far apart, need placement data on the scenario (M6 data format). The relay hose is a map symbol labelled with its climb, not drawn to the lays' scale.
  * Closed-relay solve fits the supplying pump from last tick's flow; a pump far from a square law (several lines, relief, cavitating) settles over a few ticks. A second secant pass per tick would tighten it if a scenario needs it.
  * The e2e + review run is now ~2.1 + ~0.9 min with the relay fixtures and journeys (see the budget note above).
  * **PR #4 review follow-ups:** `advance(state, inputs, dt)` takes inputs for the active truck only, so a `ScriptStep` can't drive a support truck (the fill sequence, a booster failure) and an AI operator would have to write `truck.inputs` from outside `advance`. Change it to a per-truck inputs map (unlisted trucks keep their held inputs) before M6 builds scripts on it. The closed-relay fit reads last tick's `linkReadings` flow, so it's sim state: a save must keep it, which adds to the schema-version item above.
* **M6 follow-ups:**
  * Instructor-authored scenarios: the lesson is JSON-shaped already; the fireground is still a `build()` function. A JSON site format (trucks by role, lines by hose size, sources, supplies, relays, scene placement) and an import screen would finish it.
  * AI support operators: support trucks change settings only through lesson events (`holdSettings`, throttle only). The parking-lot items above (fill sequence by pressure, booster failure, radio between operators) and `advance()` taking per-truck inputs remain.
  * The tank-to-hydrant changeover surge isn't modelled, so the incident's changeover has no trap (CALIBRATION "needs Dek" 30).
  * Lessons don't drive the scene beyond what the sim shows: no crew animation on a radio call, no marker on the coach's target when it's on the scene. Coach targets are panel items only.
  * Lesson journeys run on the phone only; the e2e + review run is now ~2.2 + ~1.0 min (budget ~60 s, see above).
  * The menu lists the player's appliance but can't change it (M7: appliance picker).
  * Results are kept per appliance; a "resume a game in progress" save would need `SimState` versioning (above).
  * **PR #5 review follow-ups** (fixed in the PR: the sim pauses off the play screen; a `holdSettings` event on the truck the player has switched to moves its panel; free play picks a scenario the appliance can play; the relay residual and "charged" figures come from one constant each; the guided fixture's scroll is stable):
    * Coach copy names Cat 1 gestures and figures ("green handle", "700 kPa at the pump, 350 at the branch" in `firstLine.ts`). Take gesture hints from the panel layout data, and derive or assert the pressures against the golden trace (M7).
    * No instrument capability: a `gauge` condition on the compound passes `validateCondition` on an appliance without one, so the lesson would load but a person couldn't read it. Add the instrument to `ScenarioRequirements` (M7).
    * `ui/menu/requirements.ts` re-implements `meets()` from `sim/scenarios/types.ts` (a test keeps them in step). Have the sim return the missing list and derive the boolean from it.
    * `FIRING_PER_REV` in `audio/params.ts` assumes a 6-cylinder four-stroke; it's per appliance, so it belongs in the spec (M7).
    * The store boots a throwaway tank-attack sim on `cat1-generic`, and `playerSpec` changes only by loading a sim; the M7 picker needs a setter. Results are keyed by the player's appliance only, so a mixed-appliance relay shares one result.
    * Event effects are validated in definition order but fire in condition order; one that throws at run time (no free delivery) throws inside `store.step`, every frame. Safe today because each event waits on the previous objective. Catch and end the lesson with the error, or validate in firing order.
    * `ladder.test.ts` proves a passing run exists with a tuned operator; there's no per-scenario test that each failure condition fires. The closed-relay lesson's hand-tuned throttle bump is CALIBRATION "needs Dek" 31.
    * `store.ts` is ~270 lines and mixes routing, lessons, settings and sim; `persist()` writes `localStorage` inside a `set` updater. Split when it next grows. The service worker is checked for its files only, not registration or offline behaviour.
* Multiplayer relay (two humans, one relay) — architecture keeps state serialisable for this, but it's far off.

## Risks

* **Calibration is the credibility risk.** Wrong friction-loss numbers teach wrong habits. Mitigation: `docs/CALIBRATION.md` as single source of truth, Dek validates against RFS doctrine before M2 ships.
* **Solver stability** at edge cases (all valves nearly closed, zero-flow). Mitigation: clamp + bisection (monotone), fuzz test with random inputs asserting no NaNs.
* **Scope creep on scene art.** Mitigation: scene stays schematic-cute until M6; the panel is the product.
* **Single-appliance assumptions creeping in** (hardcoded "4 deliveries", per-delivery input fields). Mitigation: CLAUDE.md rule 9, the test-only second appliance from M1, and the contract suite.
* **Flaky or rubber-stamped visual tests.** Screenshot suites rot if they flake or if baselines get updated without looking. Mitigation: determinism rules and the review loop in `docs/TESTING.md` (text assertions first, baselines updated only after the image is reviewed and the reason stated).
* **Over-abstracting before a second real appliance exists.** Mitigation: the spec covers only what the reference appliance needs plus fields already known to vary (§9.1); M7 is where the abstraction is proven and corrected.
