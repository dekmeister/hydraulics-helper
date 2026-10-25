# Architecture — Pump Operator Training Game

Working title: **PumpOps** (placeholder — rename freely).

## 1. What we're building

A browser game teaching fireground pump operation from the operator's position at the pump panel. The player manipulates realistic controls (throttle, deliveries, tank-to-pump, suction/collector inlets, primer) and reads realistic instruments (discharge gauge, compound gauge, tank level, tacho) while a simplified but honest hydraulics model responds. Equipment and terminology follow standard NSW RFS fitout and doctrine (deliveries, branches, draughting, kPa, L/min), but the game carries no RFS branding.

Two panels:

* **Pump panel** — close-up of the rear of the truck: gauges, valve handles, throttle, primer. Fully interactive from day one.
* **Scene panel** — top-down/isometric overview: truck, hose lays, branches, firefighters, water sources, relay trucks. Static illustration initially, driven by sim state later (flow animation, firefighters reacting to loss of water, tank/dam levels).

**Multiple appliances.** The game is built to train on several vehicle types (tankers of different categories, bulk water, urban pumpers), each with its own pump, plumbing and panel layout. The physics is shared; each appliance is a data definition. v1 ships one reference appliance. See §9.

Layout: side-by-side at ≥ 900 px (`SIDE_BY_SIDE_MIN_PX`, `ui/layout/breakpoints.ts`), stacked (scene above panel) below that, so a 768 px portrait tablet stacks and a 1024 px landscape tablet is side by side. (`Design/DESIGN_SPEC.md` §7 says "tablet side by side" without a width; this doc and `docs/TESTING.md` are what's implemented — open question for Dek.) Portrait phone is the baseline constraint — all controls must be operable with a thumb. Side by side, the page scrolls the pump panel while the scene stays in view (sticky).

## 2. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript, strict | Type-safe sim, refactor confidence |
| Build | Vite | Fast, zero-config, static output |
| UI framework | React 18 | Component model fits panel controls; huge ecosystem |
| Graphics | SVG (both panels) | Gauges/valves are vector-native; crisp at any DPI; DOM events for free; no engine needed at this scale |
| State | Zustand | Minimal store; sim state lives outside React, UI subscribes |
| Unit testing | Vitest | Unit tests for the sim are the backbone of correctness |
| Browser testing | Playwright (Chromium) | Real-browser journeys, layout invariants, screenshot baselines and the Claude review bundle; replaces jsdom/RTL/Storybook (see `docs/TESTING.md`) |
| Deployment | Static hosting (any) | No backend; game is fully client-side |

Deliberately **no** Pixi/Phaser/canvas engine for v1. The scene panel is a handful of animated SVG elements, not thousands of sprites. Revisit only if profiling demands it.

## 3. Module layout

```
src/
  sim/            # Pure TypeScript. NO imports from React, DOM, or state/.
    types.ts      # Entities, units, config interfaces
    constants.ts  # Tunable physical constants (see §6)
    hose.ts       # Hose friction from the shared hose catalogue
    branch.ts     # Branch orifice law
    pump.ts       # Pump curve, engine rpm lag
    inlets.ts     # Inlet paths (tank, hydrant, draught) in parallel; cavitation floor, layflat collapse
    network.ts    # Per-truck steady-state solver (bisection on discharge pressure)
    priming.ts    # Primer vacuum, catching, duty cycle, loss of prime (switches on primer.kind)
    thermal.ts    # Churn heat vs flow-through cooling
    hammer.ts     # Water hammer (Joukowsky surge on valve closures)
    rng.ts        # Seeded PRNG step (gauge flutter)
    site.ts       # Fireground data checks (supplies and relays → trucks, sources, inlets, deliveries)
    tank.ts       # Tank volume integration
    relay.ts      # Relays: solve order, equivalent source, outlets, two-pass site solve, bursts
    create.ts     # Fireground state at t = 0 (createSiteState), switchTruck, reseed
    engine.ts     # Tick loop: advance(state, inputs, dt) -> state
    appliances/   # ApplianceSpec per vehicle type + catalogue (see §9)
    scenarios/    # Scenario definitions as data (JSON-like TS); scripted runs + golden traces (__traces__/)
  state/
    store.ts      # Zustand store; owns SimState; dispatches player inputs
    selectors.ts  # Derived values for UI (displayed readings, delivery lines)
    warnings.ts   # Warning lamps
    supply.ts     # Primer status, supply hoses for the scene
    relay.ts      # Trucks on scene, relay hoses, portable dams
    loop.ts       # requestAnimationFrame accumulator → fixed 10 Hz ticks (not started in the e2e build)
  ui/
    panel-pump/   # Generic controls (Gauge, ValveHandle, Throttle, Primer) + layout-driven renderer
    panel-scene/  # SceneView, pure geometry.ts + siteLayout.ts, Backdrop, SceneTruck, ApplianceArt, HoseLay,
                  # BranchCrew, SupplyLay, RelayLay, PortableDam, SceneLegend
    appliances/   # Per-appliance panel layout + scene art (see §9.4)
    layout/       # Responsive shell, scenario picker, truck switcher, HUD, dialogs
    tutorial/     # Coach marks / guided steps
  audio/          # Engine note, priming whine, cavitation rattle (later)
  testing/        # e2e build mode only: window.__pumpops test API, fixture gallery (docs/TESTING.md §3)
e2e/              # Playwright: journeys/, visual/ (+ committed __screenshots__), layout.spec.ts, invariants.ts, fixtures.ts, review/ reporter
scripts/          # Node build helpers (check-prod-bundle.mjs)
```

**The hard rule:** `sim/` is a pure, deterministic library. `advance(state, inputs, dt)` takes plain data and returns new plain data. Every hydraulics behaviour must be demonstrable in a Vitest test without rendering anything. UI reads sim state through selectors and writes only through a small `PlayerInputs` interface (valve positions 0–1, throttle 0–1, primer engaged, etc.), keyed by the control ids the appliance spec defines (§9.3).

## 4. Simulation model

### 4.1 Approach: quasi-steady-state with slow integrators

Hydraulic transients settle in seconds; gameplay happens over minutes. So each tick:

1. **Solve the network instantaneously** — given current valve positions, throttle, sources, and hose layout, find the equilibrium flows and pressures.
2. **Integrate the slow states** — tank volumes, pump temperature, primer progress, engine RPM lag — with simple Euler steps.

Tick the sim at **10 Hz** fixed timestep (accumulator pattern). UI renders at display rate and interpolates gauge needles with critically-damped smoothing (needles also get realism from this lag).

### 4.2 Units

SI-adjacent, matching Australian practice: **kPa** for pressure, **L/min** for flow, **m** for length/elevation. One elevation constant: 1 m of head = **10 kPa** (doctrine figure the manual teaches; the physical 9.8 is deliberately not used).

### 4.3 The network

Model the plumbing as a small directed graph:

```
[Source] -> inlet -> [Pump] -> deliveries[1..N] -> hose segments -> [Branch]
```

The number and size of inlets and deliveries come from the appliance spec (§9). The solver must handle any N.

Sources (which ones exist, and whether they can be combined, is set by the appliance spec):

An appliance's inlets are *ports* (`InletKind = 'tank' | 'suction'`); what is plugged into a suction inlet is scenario data: `SimState.sources` (water sources: hydrants and static water such as a dam, whose volume changes) and `SimState.supplies` (`SupplyLine`: inlet → source over hose segments, hard suction or layflat). Every open inlet path that can deliver water is a source head behind a resistance (`inlets.ts`), and the paths combine in parallel at the pump inlet:

* **Tank** (tank-to-pump valve): head 0, `P_in = −k_inlet·Q²/open²`: the compound gauge reads slightly *negative*, more so with flow (manual L3529). With tank-to-pump shut or the tank empty, the pump is dry: the discharge reads 0 (Table 6) and the compound shows any primer vacuum.
* **Hydrant** (layflat to a collecting head on the suction inlet): `P_in = static − (main + layflat + inlet valve)·Q²`, the square law behind the manual's reserve-flow rule (C14). Layflat collapses below 0 kPa (`LAYFLAT_COLLAPSE_KPA`), so over-running the hydrant reads "inlet zero, hose soft" (Table 7). A hydrant at higher pressure than the tank means the tank feed gives nothing (no back-fill modelled).
* **Draughting** (hard suction to static water): `P_in = −10·lift − (hard suction + strainer + inlet valve)·Q²`, and only once primed (§4.6). C11: 4 m of lift reads −40 kPa.
* **Closed relay** (M5, §4.7): another truck's delivery feeding a suction inlet. The supplying pump is taken as an equivalent source, so the relay is one more path `H − 10·Δh − (R + valve + hose + inlet valve)·Q²`; layflat flattens at 0, so over-running a relay reads "inlet zero, hose soft" like a hydrant.

`readings.inletCollapsed` says which inlets have their layflat pulled flat, so the scene draws a soft hose from what the sim solved rather than re-deriving it. Sites are checked when the state is created (`site.ts` `validateSite`): every supply goes to a truck, source and *suction* inlet that exist, one supply per inlet, unique ids, and at most one static source per truck, because priming is tracked per pump (§4.6). A layflat to static water is allowed but never primes: the "use hard suction" mistake is something to teach, not a data error.

The pump can't pull its inlet below `pump.cavitationInletKpa` (§4.6 cavitation).

### 4.4 Pump curve

Centrifugal pump approximation using affinity-law shape:

```
P_pump(rpm, Q) = P_shutoff · (rpm/rpm_max)² − k_droop · Q²
```

Curve parameters are **per appliance** (`ApplianceSpec.pump`, §9). The formula is shared.

* `P_shutoff` — pressure at zero flow at max RPM (e.g. ~1400 kPa for a mid-size pump; PLACEHOLDER until Dek supplies ratings).
* Multi-stage pumps with a series/parallel (pressure/volume) mode switch change the effective curve: series ≈ ×2 pressure at the same flow, parallel ≈ ×2 flow at the same pressure (manual Figs 24–25). This is a spec option, not a separate engine.
* Discharge pressure (what the discharge gauge reads) = `P_inlet + P_pump`, clamped ≥ 0.
* Engine RPM chases throttle with a first-order lag (~0.5 s) so the throttle feels mechanical.
* **Pressure relief** (`ApplianceSpec.relief`): a bypass that opens above its set pressure, `Q_relief = slope·(P_d − P_set)`, and dumps to the tank or the pump inlet (manual L2322–2336). It adds to pump flow, so droop holds discharge just above the set pressure, and it doesn't drain the tank. `preset` (Cat 1) or `adjustable` (the set pressure comes from a panel control). `reliefFlowLpm` drives the over-pressure lamp. This is not RPM shedding.

### 4.5 Delivery lines and branches

Each delivery is a series path: valve → hose segments → branch (nozzle).

* **Valve**: quadratic loss scaled by opening, `ΔP_valve = k_v(d)/open² · Q²`, with `k_v ∝ 1/d⁴`. Below `VALVE_CLOSED_EPS` the valve is shut. A delivery with no line laid is blank-capped.
* **Hose friction**: `ΔP_hose = k_m · L_m · Q²`, per metre (Dek, 2026-10-24); scenarios still lay hose in 30 m lengths. The `HOSES` catalogue in `constants.ts` covers 25–90 mm, lined and unlined, fitted to manual Table 3 (`docs/CALIBRATION.md`). 65 mm is dramatically lower than 38 mm; this contrast is a core lesson.
* **Elevation**: `ΔP_elev = 10 · Δh` (uphill positive).
* **Branch**: orifice law, `Q = k_branch · √P_nozzle`. Branch types as data: 38 mm attack branch, 65 mm branch, fog/jet setting affecting `k`. Target teaching point: branches want ~700 kPa at the nozzle.

**Solver** (`network.ts`): for a given discharge pressure `P_d`, each open line's flow has a closed form, `Q = √((P_d − 10·Δh)/R)`, where `R` = valve + hose + `1/k_branch²`. Total demand (lines + relief) rises with `P_d`; the supply (inlet pressure at that flow plus the pump rise) falls with flow. So bisect `P_d` on `[0, highest source head + shutoff at current rpm]` for a fixed `SOLVER_ITERATIONS`, which keeps it deterministic. The inlet pressure for a given inlet flow is itself a bisection over the parallel paths, down to the cavitation floor. Past the flow the paths can give at the floor, the inlet pressure is taken to plunge, which pins the root at the capped flow; the discharge is then whatever the open lines take at that flow. No matrix solvers, no external libs. One line per delivery.

### 4.6 Failure & realism behaviours (the fun part)

These make the model *teach*:

* **Cavitation**: the pump cavitates when its inlet would fall below `pump.cavitationInletKpa` (−84 kPa reproduces Table 4's lift derate to 5 % up to 7 m). The inlet can't go lower, so the flow is capped: lift too high, suction restriction, a weak hydrant or outrunning a relay (where the layflat flattens at 0 first). Extra throttle adds no flow and no discharge ("adding RPM does nothing", the classic lesson). `readings.cavitation` (0–1) is how far past the cap the pump would go if the inlet could be pulled without limit. Gauges flutter: a seeded random walk (each truck's own stream, `TruckState.rngState`, one draw per tick) in `pump.flutter`, scaled by intensity and added to the *displayed* readings by the selectors, so sim readings, traces and calibration stay clean. Sustained cavitation is tallied (`tally.cavitationS`); pump damage and fail states are M6.
* **Priming** (`priming.ts`): tank and hydrant supplies are flooded and never need it; a draught path supplies water only once primed. The primer pulls vacuum on the casing (plus the hard suction when its valve is open) towards `maxVacuumKpa`, with time constant air volume / `displacementLps`; the pump catches at `vacuum ≥ 10·lift`, and only up hard suction (layflat flattens under vacuum). An open delivery with a line is an air leak (no vacuum, L3265–3276); a casing flooded by an open tank or hydrant has no air to pull; with the suction valve shut, vacuum builds fast and holds (the vacuum test). `primer.kind`: rotary vane (switch; 1 min on in 3 duty, a cut-out that clears after the rest), hand diaphragm (switch = stroking; slower), self-priming (no control, primes whenever the suction is open), none (can't draught). Prime is lost when the static source runs dry. Air leaks and vortexing as events are M6. `pump.primed` is one flag per pump, which is why a truck may draught from only one static source for now; per-supply priming waits for an appliance with two suction inlets (M7).
* **Tank runs dry**: level gauge, low-water warning, then flow collapse. Firefighters on the scene panel lose water.
* **Overheat** (`thermal.ts`): casing water temperature from churn heat `churnKw·(rpm/max)³` against flow-through cooling `Q·4.186·ΔT` (deliveries, and relief dumped to the tank; relief dumped to the inlet recirculates and doesn't cool) and a little loss to air. A dry pump doesn't heat. Lamp at 60 / 80 °C; tallied.
* **Water hammer** (`hammer.ts`): a delivery valve that closed further this tick, with the flow drop over the tick turned into a Joukowsky surge `ρ·a·Δv` in the hose. Above `WATER_HAMMER_SURGE_KPA` it is an event: `tally.waterHammer` (the penalty, scored in M6) and `lastHammer`, which latches a lamp for 5 s. A closure that stays over the threshold on consecutive ticks on the same delivery counts once. The surge is taken per tick, so it depends on the tick rate (fine at the fixed 10 Hz, but not a physical closure time; CALIBRATION "needs Dek" 21). Flow lost any other way (tank dry, cavitation onset) isn't hammer. Inlet (butterfly) valves aren't checked yet.
* **Over-pressuring a closed relay** (`relay.ts` `checkBursts`): with the receiver taking less, its compound climbs (the SUPPLY lamp warns past the hose's 1000 kPa working pressure). A flow cut at the far end sends a Joukowsky surge back up the hose, adding to the pressure everywhere it passes; peak = max(each end now, the higher end before + surge). At `HOSE_BURST_KPA` a length bursts where the pressure was highest (by the pump on a flat or uphill relay): `link.burst`, `tally.hoseBursts` on the supplying truck, the receiver loses its supply and the supplying delivery runs into the open end (Table 6: high rpm, low delivery pressure, water flowing). A flow cut by the supplying pump's own valve is water hammer on that pump instead. Slamming the relay inlet bursts it; throttling down from the attack end and easing shut doesn't (the manual's shutdown sequence, L3865–3873). Repairing a length is an M6 event.

### 4.7 Relay pumping

A fireground can hold several trucks (`createSiteState`, `TruckSetup`: id, label such as "Base pump", spec, held inputs, already primed). The player operates one at a time; the others hold the inputs they were left with (AI later). A `RelayLink` (`SimState.links`) is a hose from a truck's delivery (one hose per delivery: a lay or a relay) over segments with an elevation, ending at `to`: another truck's suction inlet (closed relay), another truck's tank or a static source (open relay). `site.ts` checks it fits: real truck, delivery and inlet, one connection per inlet, no relay back to its own truck, closed relays don't loop.

* **Closed relay: the supplying pump as an equivalent source.** Seen from its relay delivery, a pump on tank or hydrant supply is exactly `P = H − R·Q²` (its curve and the inlet loss are both square laws). Each tick, upstream first (`relayOrder`, a topological sort over closed relays), each truck is prepared (rpm, priming, which needs the relay feeds into it to know if its casing is flooded) and H and R are fitted from two solves of the supplying truck: relay flow 0 and the link's previous flow (`RELAY_FIT_PROBE_LPM` when dry). The receiver takes the relay as one more inlet path, so the parallel-inlet and cavitation machinery is unchanged. Then downstream first, each truck is solved with its closed relays taking exactly what the receiver drew, so water is conserved. The fit is exact with only the relay open; with other lines, relief or a cavitation cap it is a secant through the last operating point that settles over a few ticks. Chains (base → booster → attack) work the same way.
* **Readings** (`SimState.linkReadings`): flow, pressure at the start (discharge less valve loss) and far end (start − friction − 10·Δh, the manual's spacing rule, C12/C13), whether the receiver has pulled the layflat flat. Key instrument lesson: the receiver's compound shows *positive* residual; keep it above 100 kPa (`RELAY_MIN_RESIDUAL_KPA`), which the receiver's SUPPLY lamp says, along with no water, pressure too high and a burst.
* **Open relay**: the hose ends at atmospheric pressure, `Q = √((P_d − 10·Δh)/(valve + hose))`, into the receiving truck's tank (overflows at capacity) or a static source; a static source with a `capacityL` is a portable dam, which fills, overflows and drains. The pumps are decoupled; the lesson is the dam level, filled at one rate and drawn at another.
* **Noise**: each truck draws gauge flutter from its own stream (`TruckState.rngState`; truck 0 keeps the scenario seed), so adding a truck doesn't shift another's.
* Scenarios: `closed-relay` (base pump primed at the dam, 4 lengths of 65 mm up 20 m to the attack pump) and `open-relay` (base pump on the hydrant filling a portable dam the attack pump draughts from).

### 4.8 State shape (sketch)

```ts
interface SimState {                 // src/sim/types.ts is authoritative
  timeS: number;
  activeTruckId: string;
  trucks: TruckState[];      // spec copy, rpm, tank, inputs, readings, pump (primed, vacuum, primer duty,
                             // temperature, flutter), tally (cavitation s, overheat s, hammer), lastHammer
  lines: HoseLine[];         // delivery lays: segments, elevation, branch
  sources: WaterSource[];    // hydrants, static water (dam volume changes)
  supplies: SupplyLine[];    // inlet ← source hoses (hard suction, layflat)
  links: RelayLink[];        // relay hoses: delivery → inlet (closed), tank or dam (open); burst state
  linkReadings: Record<string, RelayReading>; // flow, start/end pressure, collapsed
  // trucks also carry label and their own rngState (flutter); later: events: SimEvent[] and score (M6)
}
```

All serialisable → free save/restore, replay, and shareable scenario states.

## 5. Scenarios, tutorial, scoring

* **Scenario = data file**: initial layout (appliances by spec id or required capabilities — §9.6, sources, hose lays), objectives ("maintain 700 kPa at branch 1 for 3 minutes", "establish draughting supply"), events on a timeline or triggers, pass/fail conditions.
* **Tutorial**: scripted coach-marks over the sandbox ("open tank-to-pump", "bring throttle up until discharge reads 700"). Implemented as scenarios with step gates.
* **Sandbox**: free play, every parameter exposed.
* **Scoring**: water delivered to objectives, penalties (water hammer, cavitation seconds, dry-running, crew left without water). Keep it gentle — this is a trainer, not a punisher.

Suggested scenario ladder: 1) tank attack, single 38 mm line → 2) two lines + branch pressure management → 3) hydrant supply → 4) draughting from a dam → 5) closed relay uphill → 6) open relay with portable dam → 7) full incident with events.

## 6. Constants & doctrine validation

All physical constants live in `sim/constants.ts` with a comment citing the intended real-world figure, and a `docs/CALIBRATION.md` table of worked examples the tests assert against, e.g.:

> One 38 mm line, 4 lengths (120 m), flat, branch needing 700 kPa at ~230 L/min → pump pressure ≈ 700 + FL. Fill in FL from RFS pump-calc doctrine and lock with a test.

**Owner action (Dek):** supply the doctrine numbers (friction loss per 100 m per hose size at reference flows, standard branch flows/pressures, tank capacities per category, pump ratings) — the sim is calibrated to whatever this table says, so the table is the single source of truth. Shared physics is calibrated once. Pump, tank and engine figures are calibrated **per appliance**, in that appliance's section (§9.5).

## 7. UI architecture notes

* **The pump panel is rendered from the appliance's layout data** (§9.4), not hand-composed per truck. Components are generic; the layout places them.
* **Gauges** are one parameterised SVG component (face, ticks, needle, red zones) — discharge, compound, tacho, tank all reuse it. Compound gauge face spans −100…+1600 kPa style dual scale.
* **Controls** are driven by drag; what a tap does is layout data per control (`tap: 'toggle' | 'none'`). Tank-to-pump toggles on a tap; deliveries ignore taps so a stray thumb never charges a line (Design §5). Hit targets ≥ 44 px.
* **Needles** chase the sim reading with a critically damped spring on `requestAnimationFrame` (`ui/panel-pump/damping.ts`); `aria-valuenow` is the displayed value, and `__pumpops.settle()` snaps them.
* **Handle colour by function** (inlets green, outlets blue); delivery identity is a glyph + tag, never colour alone (Design OPEN_DECISIONS #1, option B — pending Dek).
* **Scene panel v1** (`ui/panel-scene/`) is a plan-view SVG composed from components: static scenery (`Backdrop`), the truck drawn from its scene art (`ApplianceArt`), one `HoseLay` per line and a `BranchCrew` at each branch. State-driven bits: a line is drawn charged when its delivery flows (`deliveryLines` in `state/selectors.ts`; branches can't be shut yet, so pressurised means flowing), the branch sprays while charged, the truck's tank bar shows the water left (amber + triangle at ≤ ¼, red outline empty). The dam and a hydrant are where supply hoses end (see Scene supplies below).
  * **Geometry is UI data.** `HoseLine` has no coordinates; `geometry.ts` lays the scene out as a pure function of the scene art and the lines: the truck parks with its couplings facing the fireground, lines fan out from their couplings, each branch sits ~85 % of its hose length from the truck, and the map scale shrinks so the longest lay fits (the scale bar is drawn from it). Trucks, crews and the dam are map symbols, larger than scale. Where the truck parks, the fire heading, the dam, the track and the fire front are one definition (`ui/panel-scene/site.ts`), and a geometry test keeps every registered truck's body clear of the dam. One line per delivery is assumed by the scene and panel rows, and checked for every scenario in `sim/scenarios/scenarios.test.ts`. Contours are decorative; a branch's elevation is a label beside it.
  * **Identity:** delivery tag, glyph and label come from the panel layout (`ui/appliances/identity.ts`), so scene and panel can't disagree. Charged hoses are outlet blue for every line.
  * **Accessibility:** the map is `role="img"`; the HTML legend under it is the accessible, 44 px equivalent (a button per delivery with its state as description, plus the tank). Hoses on the map also take taps through a wide invisible hit stroke.
  * **Scene↔panel correspondence** is UI state in the store (`highlight: { deliveryId, from }`, never sim state). Tapping a hose, its branch or its legend row ("Show Delivery 1 on panel") highlights that delivery's panel row and scrolls it into view; the panel row's text is a button ("Show Delivery 1 on scene") that highlights the hose and legend row (its visible size and lay text is the button's accessible description). Tapping again clears it. The highlight is the focus ring's double band (dial inside ink), never amber.
* **Warnings/telemetry HUD**: small strip surfacing what a real operator would hear/feel (engine note, cavitation rattle) as text/icons until audio exists. Lamps (`state/warnings.ts`): tank, supply (why no water reaches the pump: inlets shut, not primed, dam empty, nothing connected), relief, temperature, cavitation (naming the lift or a hydrant over-run, and to ease the throttle), hammer (latched 5 s).
* **The Wake** (Design §6): the store keeps the last 3 s of *sim-time* displayed readings (`wake`), and each dial draws their min–max band and five fading ghosts (`gauge/wake.ts`, `WakeMarks`), so hunting shows as a fan even through needle damping and in a `step(300)` test. The compound needle turns amber while the pump cavitates.
* **Primer control**: hold to run; a ring fills with vacuum (fraction of the primer's best); captions RUNNING, CHECK SUCTION (30 s without catching, amber), PRIMED (check mark), COOLING (duty cut-out).
* **Scenario picker**: a native select at the top of the scene loads any scenario the active appliance can play (`store.loadScenario`). A stand-in for scenario selection (M6).
* **Several trucks** (M5): `siteLayout.ts` stands trucks at stations by relay depth (the truck that feeds no other nearest the fire at `ATTACK_AT`, the deepest at the old spot by the dam and hydrant), pitches a portable dam off the suction coupling that draws on it, and runs each relay from its supplying coupling to an inlet coupling, a tank hatch or a dam; lays share the tightest map scale. One truck lays out exactly as before. Each truck is a group (`data-truck`, `data-truck-active`) with its label on the map (inverted for the one operated); tapping another truck operates it. Relay hoses draw charged (flowing, or a closed relay pressurised), dry, soft (over-run) or burst (a jet at the split length), with the climb halfway; portable dams show a level ring. The legend adds relay rows (flow and kPa at the inlet) and portable-dam rows; a relay delivery reads "Relay · N L/min".
* **Truck switcher** (M5): with more than one truck, the pump panel's header has a button per truck (`aria-pressed`), reachable on a phone without scrolling to the map. `store.setActiveTruck` hands the store's inputs to the truck being left (held in the sim) and takes the other's, so the active truck's controls live in the store and every other truck's in the sim; it clears the highlight (keyed by truck and delivery) and the Wake. The panel remounts per truck and names it ("Base pump · Category 1 tanker"); a relay delivery's valve is operable and its row says where the relay goes.
* **Scene supplies**: a supply hose runs from its inlet coupling to the dam (hard suction, strainer, green water core once primed) or to a hydrant on the track (green layflat, dashed when soft). While cavitating, charged delivery hoses break into gaps. The legend adds a non-interactive row per supply.
* Accessibility floor: keyboard operable controls, ARIA labels with live gauge values, respects `prefers-reduced-motion`.
* **Testability is a UI requirement** (`docs/TESTING.md` §3): instruments are `role="meter"` with `aria-valuenow` in native units, controls use Pointer Events only, and in the `e2e` build the real-time loop is replaced by explicit `__pumpops.step()` so rendered tests are deterministic.

## 8. Persistence & future hooks

* `localStorage` for settings + scenario progress (single small JSON blob, versioned).
* Deterministic sim + serialisable state leaves the door open for: replays, instructor-authored scenarios (JSON import), and a "what happened" debrief screen.

## 9. Appliance extensibility

The game will grow to cover several vehicle types (Cat 1 / Cat 7 / Cat 9 tankers, bulk water carriers, urban pumpers, possibly portable pumps), each with a different pump, plumbing and panel layout. The hydraulics are the same for every vehicle; the fitout differs. So: **the engine and UI are generic, and an appliance is data.** v1 ships one reference appliance, a **Cat 1 tanker** (decided by Dek, 2026-10-24), but no code may assume it is the only one.

### 9.1 Shared vs per-appliance

| Shared — engine code + `sim/constants.ts` | Varies — `ApplianceSpec` (`sim/appliances/<id>.ts`) |
|---|---|
| Physics: 10 kPa/m head, hose friction per size, orifice law, layflat collapse, strainer loss, water heat capacity, Joukowsky surge | Pump: shutoff pressure, droop, rated flow, rpm idle/priming/max, stages, series/parallel (pressure/volume) mode if fitted |
| Hose and branch catalogue (25/38/65 mm …): the physics of a 38 mm length doesn't change by truck | Equipment carried: which hose sizes/lengths and branches are stowed |
| Failure behaviours: cavitation, loss of prime, churn overheat, water hammer | Tank: capacity, crew-protection reserve, tank-to-pump valve type; absent on a portable pump |
| Network solver, tick loop, relay logic | Inlets fitted (tank feed, suction inlets that take hard suction or a collecting head) and their sizes; pump cavitation pressure, casing volume, churn heat |
| | Deliveries: count, size, valve type; hose reels |
| | Primer: electric rotary vane (duty cycle) / hand diaphragm / self-priming / none |
| | Pressure relief: adjustable with lamp / preset / none; recirculation to tank or inlet |
| | Instruments fitted: compound gauge, tacho, flow meters, tank gauge type, pump temperature |
| | Engine: pump driven from road engine (PTO) vs separate pump engine; throttle feel |
| | Panel layout and scene art (UI only, §9.4) |

Differences are expressed as **fields and enums on the spec, never as `if (appliance === 'cat1')` branches.** A behaviour that varies (e.g. `primer.kind`) is an enum, and the engine module handling it covers every member of that enum, each with tests.

### 9.2 `ApplianceSpec` (sketch)

```ts
interface ApplianceSpec {        // src/sim/types.ts is authoritative
  id: string;                    // 'cat1-generic' — stable, used in saves/scenarios
  name: string;                  // UI copy; generic, no branding
  pump: PumpSpec;                // { shutoffKpa, droopKpaPerLpm2, cavitationInletKpa, casingVolumeL, churnKw }
  engine: EngineSpec;            // { idleRpm, maxRpm, rpmLagS }
  tank?: TankSpec;               // { capacityL }
  inlets: InletSpec[];           // { id, label, kind: 'tank'|'suction', lossKpaPerLpm2, sizeMm? }
  deliveries: DeliverySpec[];    // { id, label, sizeMm }
  primer?: PrimerSpec;           // { kind: 'rotaryVane', id, maxOnS, periodS } | { kind: 'diaphragm', id } | { kind: 'selfPriming' },
                                 // each with { maxVacuumKpa, displacementLps }
  relief?: ReliefSpec;           // { kind: 'preset', setKpa, … } | { kind: 'adjustable', id, minKpa, maxKpa, … }; dumpTo 'tank'|'inlet'
  instruments: InstrumentSpec[]; // { id, kind: 'compound'|'discharge'|'tacho', scale: { fullScale, zones } } | { id, kind: 'tank' }
}
```

Control ids are the inlet, delivery and adjustable-relief ids (valves, 0–1) plus primer ids (switches); `appliances/controls.ts` derives them. Hose lays (`HoseLine`) are scenario data rather than part of the spec, so the hose carried isn't modelled yet.

* Specs are immutable. At scenario load the spec is **copied into `TruckState.spec`**, so `advance(state, inputs, dt)` keeps its signature and a saved state or replay stays self-contained even if the spec file is later re-tuned.
* One pump per appliance in this version. A vehicle with two independent pumps (e.g. a separate high-pressure reel pump) would need `pumps: PumpSpec[]`. That is deferred and listed in the PLAN parking lot.

### 9.3 Inputs keyed by control id

`PlayerInputs` must not have per-control fields such as `delivery1Open`. Inputs are maps keyed by ids the spec defines: `valves: Record<ControlId, number>` (0–1), `switches: Record<ControlId, boolean>` (primer, relief, series/parallel mode), plus `throttle`. A test checks that every control id in the inputs exists on the spec.

### 9.4 Panel layout as data

Each appliance has a layout in `ui/appliances/<id>/layout.ts` (types in `ui/appliances/types.ts`, registered in `ui/appliances/registry.ts`): an ordered list of sections, each placing spec controls and instruments with their label, `Gauge` face, control variant and tap behaviour. The face is a template: its range and zones come from the instrument's `scale` on the spec, since gauge markings differ between trucks. Sections are `row` (wrapping) or `list` (stacked rows), and CSS container queries size the components, so one layout serves 375–1280 px; each component draws its own SVG in its own `viewBox`. Absolute positions on a drawing (`Design/layouts/layout-a.json`) belong to the later realistic bay view, not this panel. The pump panel renderer (`ui/panel-pump/PumpPanel.tsx`) iterates the layout using the generic components (`Gauge`, `TankLevel`, `ValveHandle`, `Throttle`, `PrimerControl`, `WarningStrip`). The throttle and warning strip are placed by the layout too, exactly once. Adding an appliance means adding a spec, a layout and scene art; a new component is needed only for a genuinely new kind of control.

**Scene art** (`ui/appliances/<id>/scene.ts`, type `SceneArt`, registered in the same registry) describes the truck from above in drawing units: body length and width, cab length, whether it has a tank hatch, and one coupling per delivery and per suction inlet (truck-local position and the way it faces), keyed by spec control id with a `kind` (`delivery | inlet`); the tank feed is internal and has none. One generic `ApplianceArt` draws it. `ui/appliances/scene.test.ts` checks art ↔ spec one-to-one, as for the layout; the test appliance's art lives in `src/testing/appliances/`.

* Real panels differ in arrangement, and finding the right control is part of the skill, so a layout should follow the real arrangement (generic styling, no livery).
* Every layout must meet the mobile floor (375 px, 44 px targets). If a real panel is too dense, group the controls (e.g. a swipeable delivery bank) rather than shrink them.
* A test (`ui/appliances/layout.test.ts`) checks that the layout and spec match one-to-one: every control and instrument is placed once on a face that can show it, and nothing is placed that the spec doesn't have. It covers the test-only appliance too, whose layout lives in `src/testing/appliances/` and is registered only in the e2e build.

### 9.5 Calibration and tests per appliance

* `docs/CALIBRATION.md` has a **shared physics** section (friction, branches, lift, head) and **one section per appliance** (pump curve, tank, rated flow, rpm). Every spec number carries the same `// doctrine-confirmed` / `// PLACEHOLDER — needs Dek` comment as `constants.ts`.
* A **contract suite** runs `describe.each` over all registered appliances: determinism, NaN/edge fuzz (on tank, hydrant and draught supplies), tank runs dry without crashing, and where a suction inlet and a primer exist: prime and draw, cavitation onset with throttle adding no flow, lose prime on an empty dam. A relay contract runs every ordered pair of appliances: a closed relay delivers and conserves water and replays exactly, over-running it is capped without NaN, fuzz on both pumps (bursting or not), an open relay refills a tank. A new appliance gets these for free; appliance-specific worked examples go alongside.

### 9.6 Scenarios

Scenarios name appliances by `id`. Where the lesson is generic (e.g. "tank attack"), a scenario declares the **capabilities** it requires (`tank`, `deliveries ≥ 2`, `suction` inlet, a `primer` of any kind) instead of a fixed appliance, so it can be played on any appliance that has them. The loader rejects a scenario whose appliances lack those capabilities (today `store.loadScenario` checks `supports()` and throws; the picker only offers eligible scenarios). Relay scenarios may mix appliance types (e.g. bulk water carrier supplying a Cat 1): `Scenario.support` lists the other trucks' roles with their own requirements, and `build(spec, support)` takes an appliance per role, defaulting to the player's. Tests and golden traces run the relays with the test appliance in either role.

### 9.7 Adding an appliance — checklist

1. `sim/appliances/<id>.ts` spec; every figure has a status comment.
2. `docs/CALIBRATION.md` section with worked examples; Dek confirms or marks PLACEHOLDER.
3. Contract suite passes; add tests for anything appliance-specific.
4. If it needs a new behaviour kind (e.g. a new primer type), extend the enum and the engine module test-first, not as a special case.
5. Panel layout + scene art. Generated fixtures and layout invariants cover it at 375 / 768 / 1280 px automatically; run `npm run review`, look at the new contact sheets and commit the new baselines.
6. Register it in the appliance catalogue, then list it in scenario selection.
