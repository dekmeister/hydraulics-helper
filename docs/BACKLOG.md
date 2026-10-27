# Backlog — Pump Operator Training Game

What's left after the original milestone plan (M0–M7 and R1, complete as of 2026-10-26; the plan itself is in git history as `docs/PLAN.md`). Companion to `ARCHITECTURE.md`. Doctrine questions live in `docs/CALIBRATION.md` under "needs Dek", not here.

New work: pick an item (or the slice Dek names), and when it's done delete it from here; anything deferred while doing it gets added.

## Open housekeeping

* **Visual baselines on the pinned Chromium (1248)** (left open from M7). The container used for M7 only had Chromium 1243, so the Cat 7 baselines were captured there and the menu, guided-lesson, incident and debrief baselines (and `menu/resume`, new) still show the old copy. On the pinned browser: `npx playwright test -c playwright.review.config.ts --update-snapshots`, then review the contact sheets of the `menu/*`, `lesson/*`, `debrief/*` and `*/cat7-generic/*` fixtures, and get `npm run verify` green.
* **Review run time.** `test:e2e` is trimmed (#26), but `npm run review` still screenshots every fixture at three widths (~4 min on the M7 container). Trims: the shell fixtures are full-page at three widths (scene-alone fixtures they now cover could go); the overheat journey steps 400 s of sim.
* **No CI workflow:** `npm run verify` runs only locally, and baselines are tied to the pinned browser and OS.
* `@axe-core/playwright` WCAG audit now that real controls exist (new dependency: ask Dek).

## Gameplay and content

* Reactive firefighters (lose water → animate + radio call), incident escalation.
* Branch shut-off by the crew (branch operator closing a controlled branch) as a scenario event. Goes with **pressurised vs flowing** (CALIBRATION row 13): `LineState` `charged` is "delivery flows"; once a branch can be shut, split it so the hose follows pressure (`DeliveryLine.branchKpa`) and the spray follows flow.
* Unlined hose in scenarios (the catalogue already has it); hose carried per appliance.
* Replays and shareable debriefs.
* Multiplayer relay (two humans, one relay): state is serialisable for this, but it's far off.
* **Instructor-authored scenarios:** the lesson is JSON-shaped already; the fireground is still a `build()` function. A JSON site format (trucks by role, lines by hose size, sources, supplies, relays, scene placement) and an import screen would finish it.
* **AI support operators.** Support trucks hold fixed settings and change them only through lesson events (`holdSettings`, throttle only). Wanted: AI operators (hold 700 kPa at the delivery, the fill sequence of 500 then 700 kPa, manual L3850–3853), radio calls between operators, and the booster-failure loss (~30 %, L3881) for the relay scenarios. Blocked on `advance()` taking per-truck inputs (see code health).
* Lessons don't drive the scene beyond what the sim shows: no crew animation on a radio call, no marker on the coach's target when it's on the scene. Coach targets are panel items only.
* Lessons on the Cat 7 are easier where the physics says so (it can't over-run the hydrant), so its hydrant and relay lessons don't teach over-running. A lesson variant per appliance class, or scenario hydrants sized to the pump, would restore it.
* Lesson titles are fixed text; a title naming hose sizes would need the same placeholders as the copy. Lesson copy names a line by its first segment's hose (`lesson/text.ts`); a line of mixed hose would need to say so.
* Mixed relay lessons with a much smaller base pump than the attack pump aren't required to pass (`ladder.test.ts`); the app never offers them.
* A refill lesson on the `tank-refill` fireground. Overflow now spills a pool (issue #18); the lesson could tally litres wasted out the overflow for the debrief, or fault leaving hydrant to tank open on a full tank.
* `hydrant-tank` can't ask "hold the tank level" or "the tank is rising": conditions see only the tank fraction. A tank-trend condition (rate over a window) would let the lesson teach reading the tank gauge against the hydrant, e.g. a second crew that out-draws the fill.
* "Resume a game in progress" (needs `SimState` versioning, see code health).

## Sim and hydraulics

* **Failure behaviours:** water hammer on inlet (butterfly) valves and weighted by hose size; hammer surge depends on the tick rate (CALIBRATION "needs Dek" 21), so measure the closure against the line's 2L/a, not per tick, once Dek picks the model. Hydrant back-fill into an open tank valve; the tank-to-hydrant changeover surge (manual L1083–1098, CALIBRATION "needs Dek" 30), so the incident's changeover has a trap. Prime-loss events (air leak at a coupling, vortex, strainer blocking) and dam level dropping the lift. Engine load droop, so losing prime shows the manual's rpm surge. A temperature gauge where an appliance fits one.
* **Bursts:** repairing a burst relay length is a lesson event; in free play a burst relay still needs a reload. Bursting delivery lines (not only relays) on over-pressure, with the same peak model. The supplying truck has no lamp for a burst on its own delivery (the receiver's SUPPLY lamp, the scene and the Table 6 gauges show it); decide with the lamp acknowledge work.
* **Engine model beyond start and stop** (issue #19 added ignition, cranking and hold-to-stop): oil temperature and oil pressure gauges, a preheat step for a cold diesel, and an oil lamp that goes out on oil pressure rather than on "running".
* **Does the primer need the engine?** (needs Dek, CALIBRATION 43) Priming is independent of the engine today. The manual calls the Cat 1's rotary vane primer electric, but if ours is engine-driven it can't prime with the engine stopped; that would be a `PrimerSpec` field (needs engine running / needs ignition only), handled for every primer kind.
* Closed-relay solve fits the supplying pump from last tick's flow; a pump far from a square law (several lines, relief, cavitating) settles over a few ticks. A second secant pass per tick would tighten it if a scenario needs it.
* A hydrant feeding two hoses at once (shared main loss); relays into hydrant to tank. Until then `validateSite` allows one hose per hydrant while it fills a tank (`site.ts`).
* **Hoses that still fill at once** (issue #6 did delivery lays): relay hoses (an open relay could reuse `lineFill.ts`; a closed relay couples two pumps through the fit) and a hydrant's layflat (charged before the job starts). The surge as a water front reaches the branch (CALIBRATION 44c). Branch shut-off turns filling from venting air to compressing it: the same `lineWaterL`, with an air-pressure term in the fill load.
* Priming is one `pump.primed` flag, so `validateSite` allows one static source per truck. Track priming per supply before an appliance with two suction inlets.

## Appliances

* Further appliances (Cat 9, bulk water, urban pumper, portable pump), pump-specific quirks.
* Multiple independent pumps on one appliance (`pumps: PumpSpec[]`, e.g. a separate high-pressure reel pump), see `ARCHITECTURE.md` §9.2.
* **Cat 7 figures** are mostly PLACEHOLDER (CALIBRATION Cat 7 section, needs Dek 38–40): pump curve, tank, idle, primer, where the tank level is shown, which side the suction is on.
* **Cat 7 unmodelled kit:** the 3-way valve's FOAM ON position (bleed back to the suction through the proportioner) and the proportioner's selection and metering; crew protection sprays (wheel sprays, front sprays, ring mains) and hose reel; the hour meter.
* **Cat 1 hose reels** (two, each with its own blue lever off the discharge manifold; the right one is drawn inert on the realistic bay). Deferred from M1 (Dek, 2026-10-24). There is no discharge master on the Cat 1 (photos, 2026-10-25).
* `TEST_APPLIANCE` has no pump to tank or realistic layout, so those paths are proven on Cat 1 only, and the electronic `bands` tank gauge has no fixture. Adding them adds trace columns and fixtures, and needs a review pass.

## Panels and scene

* **Realistic view:** foam (bypass / foam-off / foam-on switch, selection and metering valves), fuses, the air-cleaner indicator, reels; a callouts toggle for a "find it yourself" mode (Design §8).
* **Realistic water:** an accessible summary of where the water is (pipes are decorative, `aria-hidden`); a drain cock for trucks that have one; the hose reels' water once reels are modelled.
* **Speed controller ramp** lives in the store (`state/throttleRamp.ts`), not the sim, so scripts, lessons and traces can't see it and lesson timing differs between views. Moving it into `advance` (a `PlayerInputs.throttleRate` of −1/0/+1) would make the Simplified view ramp too, which is a design call. Its rates are in the spec (`EngineSpec.speedController`).
* **Phone legibility of the realistic bay:** plate text is 18–26 viewBox units, ~6–9 px at 320 px, so placards are unreadable and "NO LINE" clips at the plate edge; `e2e/layout.spec.ts` doesn't check text size. The desktop bay is ~1350 px tall, so it can't be seen with the scene.
* **Scene off-screen on a phone while operating:** below 900 px the scene stacks above the panel, so turning a delivery valve and watching its branch stop needs a scroll (the scene↔panel locate buttons scroll both ways). Candidates: a compact sticky scene or line-state HUD strip on phones, or a panel/scene tab switch. Needs a design decision.
* **Warning lamps:** acknowledge (tap → steady); the coach is a dock, so a lamp tap could open the lamp's explanation there. On a 375 px phone the six lamps wrap HAMMER onto a second row, and long scenario titles truncate in the picker; both readable, tidy with acknowledge.
* **Layout vocabulary gaps:** an adjustable relief needs its own set-pressure control kind rather than `valve` (open/closed, inlet/outlet colour); `{ kind: 'warnings' }` shows every lamp the sim can light (temperature, cavitation, hammer), whatever the truck actually fits.
* **Scene:** hydraulic section view along a line (Design sheet 06) with pump, friction, head and branch figures; elevation terrain that matches line elevations; a pressure-scaled spray throw; hose casing swelling on over-pressure (Design §6 scene cues). Fan layout spread is capped (38°, 16° per step), so 5–6 lines at short reach would crowd the branch markers; fine for ≤ 3 deliveries. Scene stations: trucks at the same relay depth spread across the route, and one farm dam and one hydrant are placed by the base pump's station; scenarios with several hydrants or dams, or trucks far apart, need placement data on the scenario. The relay hose is a map symbol labelled with its climb, not drawn to the lays' scale. Lays show a coupling at each join between lengths (#22); relay and supply hoses don't, since they aren't to scale.

## Code health

* `advance(state, inputs, dt)` takes inputs for the active truck only, so a `ScriptStep` can't drive a support truck (the fill sequence, a booster failure) and an AI operator would have to write `truck.inputs` from outside `advance`. Change it to a per-truck inputs map (unlisted trucks keep their held inputs).
* `SimState` has no schema version; settings and results are persisted (versioned), but add one before saving a game in progress. The closed-relay fit reads last tick's `linkReadings` flow, so a save must keep it.
* **Returns to the tank** are summed by hand per mechanism (relief `dumpTo: 'tank'`, `pumpToTank`, `recirc`) in `network.ts`, `engine.ts`, `state/plumbing.ts`, `scenarios/trace.ts`, `testUtils.ts`, `create.ts` and `dryReadings`. Before a second appliance fits a recirc, or a switchable one (the Cat 7's FOAM ON), fold them into one list of returns with a single return-to-tank reading, and decide whether a recirc can be a control. `RecircSpec.sizeMm` is descriptive only (the sim reads the loss); drop it or use it in that rework.
* Hydrant to tank is an `InletKind` ('tankFill'), so every pump-side sum over `inletFlowLpm` must exclude it (`inletPaths`, `warnings.ts`, `SceneTruck`, `site.ts` do). A separate `tankInlets` field would make that structural.
* `EngineSpec.vernier.throttlePerTurn` is read only by the realistic panel, as `speedController`'s rates are; both stay in the spec (rule 3: a figure that differs between trucks). If more UI-only figures appear, move them with their layout variant so a layout and its spec can't disagree.
* Lesson event effects are validated in definition order but fire in condition order; one that throws at run time (no free delivery) throws inside `store.step`, every frame. Safe today because each event waits on the previous objective. Catch and end the lesson with the error, or validate in firing order.
* `ladder.test.ts` proves a passing run exists with a tuned operator; there's no per-scenario test that each failure condition fires. The closed-relay lesson's hand-tuned throttle bump is CALIBRATION "needs Dek" 31.
* `store.ts` (~270 lines) mixes routing, lessons, settings and sim; `persist()` writes `localStorage` inside a `set` updater. Split when it next grows. Results are keyed by the player's appliance only, so a mixed-appliance relay shares one result.
* The service worker is checked for its files only, not registration or offline behaviour.
* The menu builds every lesson's fireground to fill its brief, once per pick; cheap now, worth caching if scenarios grow.
* Split `ValveHandle.tsx` (~260 lines) and `Gauge.tsx` (~250) under the ~200-line guideline; both are mostly SVG.

## Risks

* **Calibration is the credibility risk.** Wrong friction-loss numbers teach wrong habits. Mitigation: `docs/CALIBRATION.md` as single source of truth, validated by Dek against doctrine.
* **Solver stability** at edge cases (all valves nearly closed, zero-flow). Mitigation: clamp + bisection (monotone), fuzz test with random inputs asserting no NaNs.
* **Scope creep on scene art.** Mitigation: the scene stays schematic; the panel is the product.
* **Single-appliance assumptions creeping in** (hardcoded "4 deliveries", per-delivery input fields). Mitigation: CLAUDE.md rule 9, the test-only appliance, and the contract suite.
* **Flaky or rubber-stamped visual tests.** Screenshot suites rot if they flake or if baselines get updated without looking. Mitigation: determinism rules and the review loop in `docs/TESTING.md` (text assertions first, baselines updated only after the image is reviewed and the reason stated).
* **Over-abstracting ahead of real appliances.** Mitigation: the spec covers only what real appliances need plus fields already known to vary (§9.1); each new appliance is where the abstraction is proven and corrected (§9.8).
