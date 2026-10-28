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
    engineControl.ts # Ignition, cranking, hold-to-stop (engine running state)
    inlets.ts     # Inlet paths (tank, hydrant, draught) in parallel; cavitation floor, layflat collapse
    network.ts    # Per-truck steady-state solver (bisection on discharge pressure)
    lineFill.ts   # Water in a delivery line: wet length, head to the front, drain through the branch
    priming.ts    # Primer vacuum, catching, duty cycle, loss of prime (switches on primer.kind)
    thermal.ts    # Churn heat vs flow-through cooling
    hammer.ts     # Water hammer (Joukowsky surge on valve closures)
    rng.ts        # Seeded PRNG step (gauge flutter)
    site.ts       # Fireground data checks (supplies and relays → trucks, sources, inlets, deliveries)
    tank.ts       # Tank volume integration
    tankFill.ts   # Tank-fill inlets (hydrant to tank), past the pump
    relay.ts      # Relays: solve order, equivalent source, outlets, two-pass site solve, bursts
    create.ts     # Fireground state at t = 0 (createSiteState), switchTruck, reseed
    engine.ts     # Tick loop: advance(state, inputs, dt) -> state
    appliances/   # ApplianceSpec per vehicle type + catalogue (see §9)
    lesson/       # Lessons (§5): conditions, refs, effects, progress, validation, scoring, scripted operator
    scenarios/    # Scenario definitions + lessons; loader (load.ts); scripted runs + golden traces (__traces__/)
  state/
    store.ts      # Zustand store; owns SimState; dispatches player inputs
    selectors.ts  # Derived values for UI (displayed readings, delivery lines)
    warnings.ts   # Warning lamps
    supply.ts     # Primer status, supply hoses for the scene
    relay.ts      # Trucks on scene, relay hoses, portable dams
    lesson.ts     # The lesson in play: begin, step with the sim, record a result
    lessonView.ts # The dock's objective rows (live readings vs targets) and coach target
    debrief.ts    # Findings that explain each fault
    persist.ts    # Versioned localStorage blob: settings and results
    loop.ts       # requestAnimationFrame accumulator → fixed 10 Hz ticks (not started in the e2e build)
  ui/
    panel-pump/   # Generic controls (Gauge, ValveHandle, Throttle, Primer) + layout-driven renderer
    panel-real/   # Realistic view: BayLever, PullHandlePrimer, SpeedSwitch, TankGauge, plate renderer
    panel-scene/  # SceneView, pure geometry.ts + siteLayout.ts, Backdrop + backdrops/ (bush, village, interface), SceneTruck, ApplianceArt, HoseLay,
                  # BranchCrew, SupplyLay, RelayLay, PortableDam, SceneLegend
    appliances/   # Per-appliance panel layout + scene art (see §9.4)
    layout/       # AppRoot (app bar + screens), responsive shell, scenario picker, truck switcher
    menu/         # Scenario ladder menu
    lesson/       # Lesson dock: coach steps, objectives, radio
    debrief/      # Debrief screen
  audio/          # soundParams (pure) → Web Audio synth: engine note, primer, cavitation rattle, spray, overflow
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

An appliance's inlets are *ports* (`InletKind = 'tank' | 'suction' | 'tankFill'`); what is plugged into an external inlet is scenario data: `SimState.sources` (water sources: hydrants and static water such as a dam, whose volume changes) and `SimState.supplies` (`SupplyLine`: inlet → source over hose segments, hard suction or layflat). Every open inlet path that can deliver water is a source head behind a resistance (`inlets.ts`), and the paths combine in parallel at the pump inlet:

* **Tank** (tank-to-pump valve): the head of the tank's water above the pump (`TankSpec.headM`, issue #13), `P_in = 10·headM − k_inlet·Q²/open²`: opening tank to pump lifts the compound a few kPa while nothing flows, and with flow it reads slightly *negative*, more so as flow rises (manual L3529). With tank-to-pump shut or the tank empty, the pump is dry: the discharge reads 0 (Table 6) and the compound shows any primer vacuum.
* **Hydrant to suction** (layflat to a collecting head on the suction inlet; the less common technique, e.g. village firefighting on a good main; the usual one is hydrant to tank, below): `P_in = static − (main + layflat + inlet valve)·Q²`, the square law behind the manual's reserve-flow rule (C14). Layflat collapses below 0 kPa (`LAYFLAT_COLLAPSE_KPA`), so over-running the hydrant reads "inlet zero, hose soft" (Table 7). A hydrant at higher pressure than the tank means the tank feed gives nothing (no back-fill modelled).
* **Draughting** (hard suction to static water): `P_in = −10·lift − (hard suction + strainer + inlet valve)·Q²`, and only once primed (§4.6). C11: 4 m of lift reads −40 kPa.
* **Closed relay** (M5, §4.7): another truck's delivery feeding a suction inlet. The supplying pump is taken as an equivalent source, so the relay is one more path `H − 10·Δh − (R + valve + hose + inlet valve)·Q²`; layflat flattens at 0, so over-running a relay reads "inlet zero, hose soft" like a hydrant.

Two more ways water reaches the tank (`tankFill.ts`, 2026-10-25, from the Cat 1 photos):

* **Pump to tank** (`ApplianceSpec.pumpToTank`, optional): a valved return from the discharge into the tank, `Q = open·√(P_d/k)` at atmospheric pressure. It is demand like relief dumped to the tank (drawn through the inlets, returned to the tank), so it refills the tank from a hydrant or a draught through the pump, recirculates on tank supply with the level unchanged, and counts as flow-through cooling. Open, it lets air in on the discharge side, so the primer can't catch (an assumption: CALIBRATION needs-Dek 34). Reading `pumpToTankLpm`.
* **Hydrant to tank** (`InletKind 'tankFill'`): an external inlet straight into the tank, past the pump. A hydrant supply on it flows `√((static − 10·fillHeight)/(main + hose + valve/open²))` whatever the pump is doing, into `inletFlowLpm`; the tank overflows when full. This is how a hydrant is normally taken: the pump keeps working off tank to pump, and the tank level shows whether the hydrant keeps up. Every appliance has one (Cat 7 and test appliance figures are placeholders). The pump-side code (`inletPaths`, priming, the SUPPLY lamp via `pumpInlets`) ignores it.

**Overflow** (issue #18): a full tank, and a portable dam at its `capacityL`, overflows rather than backing any flow off. `stepStore` (`tank.ts`) holds the level and keeps what it couldn't hold as `TruckState.spilledL` / the source's `spilledL`, the pool on the ground, which soaks away exponentially (`SPILL_SOAK_TAU_S`, 5 s, so it follows the overflow), with the truck's rate out the overflow as `readings.overflowLpm`. Every inflow counts (hydrant to tank, pump to tank, relays in, relief and recirculation returns, net of the draw); in practice it's the main inlets against the main draw. The scene draws the pool (`ui/panel-scene/SpillPool.tsx`) under everything else, sized from `state/spill.ts`, and the active truck's overflow gushes on the audio (often how an operator finds out).

`readings.inletCollapsed` says which inlets have their layflat pulled flat, so the scene draws a soft hose from what the sim solved rather than re-deriving it. Sites are checked when the state is created (`site.ts` `validateSite`): every supply goes to a truck, source and *external* inlet that exist (a tank-fill inlet only from a hydrant of its own: two hoses on one main would share its loss, which isn't coupled), one supply per inlet, unique ids, and at most one static source per truck, because priming is tracked per pump (§4.6). A layflat to static water is allowed but never primes: the "use hard suction" mistake is something to teach, not a data error.

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
* **Starting and stopping** (`sim/engineControl.ts`, issue #19): `TruckState.engine` says whether it's firing. The spec's `EngineSpec.controls` names three held switches (ordinary `PlayerInputs.switches`): ignition, START and STOP. With the ignition on, START held spins it at `crankRpm` and it fires after `crankS` unbroken; let go early and the count restarts. START does nothing while it runs, and the ignition being off doesn't stop it (the Cat 1's is energise-to-stop). STOP cuts the fuel only while held: the engine runs down (`runDownS`) and is stopped below `refireRpm`, but let go above that and the fuel rack returns and it picks up again. `stop.needsIgnition` is a solenoid stop powered through the ignition (Cat 1: "to stop pump ignition must be on"), so with the ignition off STOP does nothing; a mechanical stop (Cat 7's T-handle) works either way. Stopped, the pump makes no rise, but a hydrant or relay still pushes water through it. Every scenario starts the player's truck cold (`TruckSetup.engine: 'off'`; support trucks run, their crews started them) and every lesson ends on `shutdownObjective` (throttle idle, lines eased shut, engine stopped, ignition off; `windDown`, so crews going dry during it isn't held against the player). `createInitialState` defaults to running so physics tests start at idle; `warmStart` starts a cold state for fixtures and tests about what comes after.
* **Pressure relief** (`ApplianceSpec.relief`): a bypass that opens above its set pressure, `Q_relief = slope·(P_d − P_set)`, and dumps to the tank or the pump inlet (manual L2322–2336). It adds to pump flow, so droop holds discharge just above the set pressure, and it doesn't drain the tank. `preset` (Cat 1) or `adjustable` (the set pressure comes from a panel control). `reliefFlowLpm` drives the over-pressure lamp. This is not RPM shedding.
* **Tank recirculation** (`ApplianceSpec.recirc`, M7, the Cat 7's 3-way valve at TANK RECIRC): an always-open bleed from the discharge through a check valve into the tank, `Q = √(P_d/k)` whenever the pump has water. Like pump to tank it is demand drawn through the inlets and returned to the tank (the level holds on tank supply) and it cools a churning pump, which is how a pump with no relief survives every delivery shut; unlike pump to tank its check valve keeps air out, so it doesn't stop the primer. Not a control. Reading `recircLpm`.

### 4.5 Delivery lines and branches

Each delivery is a series path: valve → hose segments → branch (nozzle).

* **Valve**: quadratic loss scaled by opening, `ΔP_valve = k_v(d)/open² · Q²`, with `k_v ∝ 1/d⁴`. Below `VALVE_CLOSED_EPS` the valve is shut. A delivery with no line laid is blank-capped.
* **Hose friction**: `ΔP_hose = k_m · L_m · Q²`, per metre (Dek, 2026-10-24); scenarios still lay hose in 30 m lengths. The `HOSES` catalogue in `constants.ts` covers 25–90 mm, lined and unlined, fitted to manual Table 3 (`docs/CALIBRATION.md`). 65 mm is dramatically lower than 38 mm; this contrast is a core lesson.
* **Elevation**: `ΔP_elev = 10 · Δh` (uphill positive).
* **Branch**: orifice law, `Q = k_branch · √P_nozzle`. Branch types as data: 38 mm attack branch, 65 mm branch, fog/jet setting affecting `k`. Target teaching point: branches want ~700 kPa at the nozzle.

**Lines fill and empty** (`lineFill.ts`, issue #6): each lay holds water (`SimState.lineWaterL`, L), conserved every tick: in through the delivery, out by the branch. While a line fills, the air ahead of the front leaves through the open branch, which barely resists it (orifice loss ∝ density), so the line's load is the valve, the friction of the *wet* length and the head up to the front; the branch flows nothing (`readings.branchFlowLpm`, the water on the fire, is 0). Once full it solves as below. With nothing coming in, a downhill line drains through its branch under its own head; flat or uphill it keeps its water. Quasi-steady front (no inertia), plug flow, uniform grade, no surge as the front arrives (CALIBRATION "needs Dek" 44). An empty hose takes all the pump gives, so charging at working revs can run a weak supply out: the scripted solutions charge at idle. Lessons and the crew-water stats read branch flow; tank, thermal, hammer and relays read delivery flow. `solveTruck` without `lineWaterL` takes every line as full (the steady solve the calibration rows use); `chargeLines` fills a state's lines for tests and fixtures. A lay on a delivery a scenario leaves open starts charged. Relay hoses still fill at once (backlog).

**Solver** (`network.ts`): for a given discharge pressure `P_d`, each open line's flow has a closed form, `Q = √((P_d − 10·Δh)/R)`, where `R` = valve + hose + `1/k_branch²`. Total demand (lines + relief) rises with `P_d`; the supply (inlet pressure at that flow plus the pump rise) falls with flow. So bisect `P_d` on `[0, highest source head + shutoff at current rpm]` for a fixed `SOLVER_ITERATIONS`, which keeps it deterministic. The inlet pressure for a given inlet flow is itself a bisection over the parallel paths, down to the cavitation floor. Past the flow the paths can give at the floor, the inlet pressure is taken to plunge, which pins the root at the capped flow; the discharge is then whatever the open lines take at that flow. No matrix solvers, no external libs. One line per delivery.

### 4.6 Failure & realism behaviours (the fun part)

These make the model *teach*:

* **Cavitation**: the pump cavitates when its inlet would fall below `pump.cavitationInletKpa` (−84 kPa reproduces Table 4's lift derate to 5 % up to 7 m). The inlet can't go lower, so the flow is capped: lift too high, suction restriction, a weak hydrant or outrunning a relay (where the layflat flattens at 0 first). Extra throttle adds no flow and no discharge ("adding RPM does nothing", the classic lesson). `readings.cavitation` (0–1) is how far past the cap the pump would go if the inlet could be pulled without limit. Gauges flutter: a seeded random walk (each truck's own stream, `TruckState.rngState`, one draw per tick) in `pump.flutter`, scaled by intensity and added to the *displayed* readings by the selectors, so sim readings, traces and calibration stay clean. Sustained cavitation is tallied (`tally.cavitationS`); in a lesson, past `PUMP_DAMAGE_CAVITATION_S` it fails as pump damage (§5), as overheating does past `PUMP_DAMAGE_OVERHEAT_S`.
* **Priming** (`priming.ts`): tank and hydrant supplies are flooded and never need it; a draught path supplies water only once primed. The primer pulls vacuum on the casing (plus the hard suction when its valve is open) towards `maxVacuumKpa`, with time constant air volume / `displacementLps`; the pump catches at `vacuum ≥ 10·lift`, and only up hard suction. The water stands `vacuum/10` m up the hard suction while it primes (`suctionWaterFraction`, drawn on the scene); shutting the suction valve traps that column (the hose keeps its own vacuum, `suctionVacuumKpa`) and reopening mixes the hose's air with the casing's, and the air balance counts the air that rising column squeezes, `τ = (V_air + p_abs·V_hose/(10·lift))/D` (issue #8) (layflat flattens under vacuum). An open delivery with a line is an air leak (no vacuum, L3265–3276); a casing flooded by an open tank or hydrant has no air to pull; with the suction valve shut, vacuum builds fast and holds (the vacuum test). `primer.kind`: rotary vane (switch; 1 min on in 3 duty, a cut-out that clears after the rest), hand diaphragm (switch = stroking; slower), self-priming (no control, primes whenever the suction is open), none (can't draught). Prime is lost when the static source runs dry. Air leaks and vortexing as lesson events are not modelled yet. `pump.primed` is one flag per pump, which is why a truck may draught from only one static source for now; per-supply priming waits for an appliance with two suction inlets (M7).
* **Casing water** (`PumpState.casingWet`, `engine.ts`): the casing and discharge manifold fill whenever water reaches the pump (flooded or primed) and stay full after the feed is shut, as a real pump does. With no feed, an open line or pump to tank pumps them out (PLACEHOLDER rule, CALIBRATION). Display only: no hydraulics read it; the realistic bay draws it (§7).
* **Tank runs dry**: level gauge, low-water warning, then flow collapse. Firefighters on the scene panel lose water.
* **Overheat** (`thermal.ts`): casing water temperature from churn heat `churnKw·(rpm/max)³` against flow-through cooling `Q·4.186·ΔT` (deliveries, and relief dumped to the tank; relief dumped to the inlet recirculates and doesn't cool) and a little loss to air. A dry pump doesn't heat. Lamp at 60 / 80 °C; tallied.
* **Water hammer** (`hammer.ts`): a delivery valve that closed further this tick, with the flow drop over the tick turned into a Joukowsky surge `ρ·a·Δv` in the hose. Above `WATER_HAMMER_SURGE_KPA` it is an event: `tally.waterHammer` (the penalty, scored in M6) and `lastHammer`, which latches a lamp for 5 s. A closure that stays over the threshold on consecutive ticks on the same delivery counts once. The surge is taken per tick, so it depends on the tick rate (fine at the fixed 10 Hz, but not a physical closure time; CALIBRATION "needs Dek" 21). Flow lost any other way (tank dry, cavitation onset) isn't hammer. Inlet (butterfly) valves aren't checked yet.
* **Over-pressuring a closed relay** (`relay.ts` `checkBursts`): with the receiver taking less, its compound climbs (the SUPPLY lamp warns past the hose's 1000 kPa working pressure). A flow cut at the far end (the receiving pump shut a valve this tick: its relay inlet or a delivery) sends a Joukowsky surge back up the hose, adding to the pressure everywhere it passes; peak = max(each end now, the higher end before + surge). At `HOSE_BURST_KPA` a length bursts where the pressure was highest (by the pump on a flat or uphill relay): `link.burst`, `tally.hoseBursts` on the supplying truck, the receiver loses its supply and the supplying delivery runs into the open end (Table 6: high rpm, low delivery pressure, water flowing). A flow lost at the supplying end lowers the hose's pressure and sends no surge: its own delivery shut is water hammer on that pump, and its tank running dry or its inlet shut is just loss of supply. Slamming the relay inlet bursts it; throttling down from the attack end and easing shut doesn't (the manual's shutdown sequence, L3865–3873). A lesson event can repair it (`repairRelay`, used by the closed-relay lesson).

### 4.7 Relay pumping

A fireground can hold several trucks (`createSiteState`, `TruckSetup`: id, label such as "Base pump", spec, held inputs, already primed). The player operates one at a time; the others hold the inputs they were left with (AI later). A `RelayLink` (`SimState.links`) is a hose from a truck's delivery (one hose per delivery: a lay or a relay) over segments with an elevation, ending at `to`: another truck's suction inlet (closed relay), another truck's tank or a static source (open relay). `site.ts` checks it fits: real truck, delivery and inlet, one connection per inlet, no relay back to its own truck, closed relays don't loop.

* **Closed relay: the supplying pump as an equivalent source.** Seen from its relay delivery, a pump on tank or hydrant supply is exactly `P = H − R·Q²` (its curve and the inlet loss are both square laws). Each tick, upstream first (`relayOrder`, a topological sort over closed relays), each truck is prepared (rpm, priming, which needs the relay feeds into it to know if its casing is flooded) and H and R are fitted from two solves of the supplying truck: relay flow 0 and the link's previous flow (`RELAY_FIT_PROBE_LPM` when dry). The receiver takes the relay as one more inlet path, so the parallel-inlet and cavitation machinery is unchanged. Then downstream first, each truck is solved with its closed relays taking exactly what the receiver drew, so water is conserved. The fit is exact with only the relay open; with other lines, relief or a cavitation cap it is a secant through the last operating point that settles over a few ticks. Chains (base → booster → attack) work the same way.
* **Readings** (`SimState.linkReadings`): flow, pressure at the start (discharge less valve loss) and far end (start − friction − 10·Δh, the manual's spacing rule, C12/C13), whether the receiver has pulled the layflat flat. Key instrument lesson: the receiver's compound shows *positive* residual; keep it above 100 kPa (`RELAY_MIN_RESIDUAL_KPA`), which the receiver's SUPPLY lamp says, along with no water, pressure too high and a burst.
* **Open relay**: the hose ends at atmospheric pressure, `Q = √((P_d − 10·Δh)/(valve + hose))`, into the receiving truck's tank (overflows at capacity) or a static source; a static source with a `capacityL` is a portable dam, which fills, overflows and drains. The pumps are decoupled; the lesson is the dam level, filled at one rate and drawn at another.
* **Noise**: each truck draws gauge flutter from its own stream (`TruckState.rngState`; truck 0 keeps the scenario seed), so adding a truck doesn't shift another's.
* Scenarios: `closed-relay` (base pump primed at the dam, 4 lengths of 65 mm up 20 m to the attack pump) and `open-relay` (base pump at the hydrant, its tank topped up through hydrant to tank, filling a portable dam the attack pump draughts from).

### 4.8 State shape (sketch)

```ts
interface SimState {                 // src/sim/types.ts is authoritative
  timeS: number;
  activeTruckId: string;
  trucks: TruckState[];      // spec copy, rpm, tank, inputs, readings, pump (primed, vacuum, primer duty,
                             // temperature, flutter), tally (cavitation s, overheat s, hammer), lastHammer
  lines: HoseLine[];         // delivery lays: segments, elevation, branch
  lineWaterL: Record<string, number>; // water in each lay, L (fills from the delivery, §4.5)
  sources: WaterSource[];    // hydrants, static water (dam volume changes)
  supplies: SupplyLine[];    // inlet ← source hoses (hard suction, layflat)
  links: RelayLink[];        // relay hoses: delivery → inlet (closed), tank or dam (open); burst state
  linkReadings: Record<string, RelayReading>; // flow, start/end pressure, collapsed
  // trucks also carry label and their own rngState (flutter)
}
// A lesson's progress (objectives, coach, fired events, debrief stats) lives beside SimState in the
// store, not in it (§5): the sim stays the physics; lesson events change it through pure effects.
```

All serialisable → free save/restore, replay, and shareable scenario states.

## 5. Scenarios, tutorial, scoring

* **A scenario** (`sim/scenarios/`) is a fireground `build(spec, support)` (trucks, lines laid by hose size on any spec, sources, supplies, relays), a scripted run for its golden trace, and, for the ladder, a **lesson** (`Scenario.lesson`, `sim/lesson/types.ts`) and a `solution`. Each has a **setting** (`Scenario.setting`, issue #10): `bush` (draughting, crews on one length of 25 mm canvas through a 38→25 adaptor, `BUSH_LINE`), `village` (hydrants, crews on three lengths of 38 mm rubber, `VILLAGE_LINE`, a house fire) or `interface` (both). The setting picks the crews' hose (`scenarios.test.ts` checks no attack line is bigger than 38 mm) and the scene's backdrop (§7); the sim never reads it. Scenarios declare required capabilities (`ScenarioRequirements`: tank, deliveries, suction inlet, hydrant-to-tank inlet, primer, or an `appliances` id list), §9.6.
* **A lesson is declarative, JSON-shaped data**, written symbolically so one lesson plays on every eligible appliance: a valve is `{ inlet: 'tank' | 'suction' | 'tankFill' }` or `{ line: 'line-38' }` (the delivery that line is on), never a spec control id. It holds the ladder position, a brief, objectives, failures, events and coach steps, all built from one small **condition** vocabulary (`conditions.ts`): valve opening, throttle, gauge, tank fraction, branch in its working band (Table 1 optimum ± `BRANCH_BAND_FRACTION`), line flow, primed, cavitating, source volume, relay burst, fault tallies, time, coach acknowledged, objective done, time since an event, and `all` / `any` / `not`.
* **Loader** (`scenarios/load.ts` `loadScenario`): checks capabilities, builds, and validates the lesson against the fireground (`lesson/validate.ts`): every valve, line, source, relay, instrument and named objective, event or coach step must resolve. Event effects are projected in order first, so an objective may name a line an event lays. Problems throw, listed.
* **Progress** (`lesson/progress.ts` `stepLesson`) runs after every sim tick, beside the sim (the store holds it): events whose condition holds fire once (radio call, effects); objectives complete once their condition has held `holdS` without a break, counting from the tick after their `after` objectives; the coach moves past satisfied steps; debrief stats accumulate (crew-without-water seconds and cause, cavitation seconds by supply kind); a failure condition or the last objective ends it, freezing the faults for scoring. The sim keeps running so the player can look around.
* **Events** apply pure effects (`lesson/effects.ts`), re-checked like an initial site: lay a line on the free delivery closest in size, move a branch (extra lengths, new height), connect a supply (and source), repair a burst relay, change a support truck's held throttle (how the closed relay's base pump raises its pressure once the attack lines are on: the fill sequence, L3850–3853). `advance()` is unchanged.
* **Scoring** (`lesson/score.ts`) is gentle: 60 points for objectives, 40 for clean running less capped penalties (cavitation, overheat, water hammer, relay bursts, crews without water); the caps sum to 40, so the lines always add to the total. A failed run earns its objective points only and no stars; a pass earns at least one star (≥ 75 two, ≥ 90 three). The **debrief** (`state/debrief.ts`) says why: "You cavitated for 40 s" with the reason for the supply that was feeding the pump (lift, hydrant over-run, relay over-run).
* **Winnable everywhere, proved**: `lesson/operator.ts` is a scripted operator (set and ease valves, prime, trim the throttle to a branch or compound target, gate a delivery back, ease off when cavitating). `scenarios/ladder.test.ts` plays every ladder scenario's `solution` on every eligible appliance and support pairing and requires a clean three-star pass. Script steps may wait on a condition (`ScriptStep.when`), so traces aren't hand-timed to one truck; a scenario whose events wait on objectives (the incident) is traced from its solution.
* **Tutorial**: coach steps (text, a target on the panel, and a `done` condition, default "Got it") walk scenario 1. The UI rings the target and scrolls it into view (§7).
* **Sandbox**: free play is any scenario's fireground with no lesson (`store.loadScenario`).

The ladder: 1 `first-line` (bush: one 25 mm line on tank, guided) → 2 `tank-attack` (bush: two lines, crew 2 10 m downhill, so gate it back to hold both branches in band) → 3 `hydrant-tank` (village house fire: hydrant to tank on a low tank, two 38 mm lines off tank to pump while the hydrant fills it) → 4 `hydrant-supply` (village house fire: hydrant to suction on a weaker village main: read the compound; don't over-run the hydrant) → 5 `draughting` (bush: prime, deliver; the compound reads the lift) → 6 `closed-relay` (bush: both branches with ≥ 100 kPa residual) → 7 `open-relay` (bush: draught from a portable dam the relay fills) → 8 `incident` (urban interface: crew 1 on 38 mm at the houses moves uphill, a second crew runs 25 mm canvas, a hydrant is connected to hydrant to tank: open it before the tank runs dry). Bush lines draw ~150 L/min each, too little to cavitate a 4 m draught, over-run or burst the C12 relay, or drain the portable dam, so those lessons no longer have that trap (needs Dek); tests and journeys of those faults lay heavy lines on the same fireground (`sim/scenarios/heavyLines.ts`, e2e `load(…, { heavy: true })`). Lesson effects can connect a supply to a suction or hydrant-to-tank inlet (`connectSupply` `inlet`).

## 6. Constants & doctrine validation

All physical constants live in `sim/constants.ts` with a comment citing the intended real-world figure, and a `docs/CALIBRATION.md` table of worked examples the tests assert against, e.g.:

> One 38 mm line, 4 lengths (120 m), flat, branch needing 700 kPa at ~230 L/min → pump pressure ≈ 700 + FL. Fill in FL from RFS pump-calc doctrine and lock with a test.

**Owner action (Dek):** supply the doctrine numbers (friction loss per 100 m per hose size at reference flows, standard branch flows/pressures, tank capacities per category, pump ratings) — the sim is calibrated to whatever this table says, so the table is the single source of truth. Shared physics is calibrated once. Pump, tank and engine figures are calibrated **per appliance**, in that appliance's section (§9.5).

## 7. UI architecture notes

* **The pump panel is rendered from the appliance's layout data** (§9.4), not hand-composed per truck. Components are generic; the layout places them.
* **Gauges** are one parameterised SVG component (face, ticks, needle, red zones) — discharge, compound, tacho, tank all reuse it. Compound gauge face spans −100…+1600 kPa style dual scale.
* **Controls** are driven by drag; what a tap does is layout data per control (`tap: 'toggle' | 'none'`). Cat 1 toggles every valve on a tap, deliveries included (Dek, 2026-10-25: the cavitation risk of snapping a delivery open is accepted); `'none'` (drag only, so a stray thumb never charges a line, Design §5) stays available and the test appliance's deliveries use it. Hit targets ≥ 44 px.
* **Needles** chase the sim reading with a critically damped spring on `requestAnimationFrame` (`ui/panel-pump/damping.ts`); `aria-valuenow` is the displayed value, and `__pumpops.settle()` snaps them.
* **Handle colour by function** (inlets green, outlets blue); delivery identity is a glyph + tag, never colour alone (Design OPEN_DECISIONS #1, option B — pending Dek).
* **Scene panel v1** (`ui/panel-scene/`) is a plan-view SVG composed from components: static scenery (`Backdrop`, one per scenario setting in `backdrops/`: the bush's slope, scrub, track, dam and fire front; the village's street along the track's line, fenced house lots and a burning house; the interface's bush beyond a bush edge with the street and houses on the truck's side; picked by `sceneSetting(scenarioId)`, the bush when none is loaded), the truck drawn from its scene art (`ApplianceArt`), one `HoseLay` per line and a `BranchCrew` at each branch. State-driven bits: a line is drawn charged when its delivery flows (`deliveryLines` in `state/selectors.ts`; branches can't be shut yet, so pressurised means flowing), the branch sprays while charged, the truck's tank bar shows the water left (amber + triangle at ≤ ¼, red outline empty). The dam and a hydrant are where supply hoses end (see Scene supplies below).
  * **Geometry is UI data.** `HoseLine` has no coordinates; `geometry.ts` lays the scene out as a pure function of the scene art and the lines: the truck parks with its couplings facing the fireground, lines fan out from their couplings, each branch sits ~85 % of its hose length from the truck, a coupling marks each join between 30 m lengths along the lay so they can be counted (issue #22), and the map scale shrinks so the longest lay fits (the scale bar is drawn from it). Trucks, crews and the dam are map symbols, larger than scale. Where the truck parks, the fire heading, the dam, the track (the village street follows it), the fire front, the house lots, the burning house and the bush edge are one definition (`ui/panel-scene/site.ts`); a geometry test keeps every registered truck's body clear of the dam, and `scenery.test.ts` keeps the houses clear of trucks, hoses, the hydrant, branches and sprays on every village and interface fireground, lesson lays included. One line per delivery is assumed by the scene and panel rows, and checked for every scenario in `sim/scenarios/scenarios.test.ts`. Contours are decorative; a branch's elevation is a label beside it.
  * **Identity:** delivery tag, glyph and label come from the panel layout (`ui/appliances/identity.ts`), so scene and panel can't disagree. Charged hoses are outlet blue for every line.
  * **Accessibility:** the map is `role="img"`; the HTML legend under it is the accessible, 44 px equivalent (a button per delivery with its state as description, plus the tank). Hoses on the map also take taps through a wide invisible hit stroke.
  * **Scene↔panel correspondence** is UI state in the store (`highlight: { deliveryId, from }`, never sim state). Tapping a hose, its branch or its legend row ("Show Delivery 1 on panel") highlights that delivery's panel row and scrolls it into view; the panel row's text is a button ("Show Delivery 1 on scene") that highlights the hose and legend row (its visible size and lay text is the button's accessible description). Tapping again clears it. The highlight is the focus ring's double band (dial inside ink), never amber.
* **Warnings/telemetry HUD**: small strip surfacing what a real operator would hear/feel (engine note, cavitation rattle) as text/icons until audio exists. Lamps (`state/warnings.ts`): tank, supply (why no water reaches the pump: inlets shut, not primed, dam empty, nothing connected), relief, temperature, cavitation (naming the lift or a hydrant over-run, and to ease the throttle), hammer (latched 5 s).
* **The Wake** (Design §6): the store keeps the last 3 s of *sim-time* displayed readings (`wake`), and each dial draws their min–max band and five fading ghosts (`gauge/wake.ts`, `WakeMarks`), so hunting shows as a fan even through needle damping and in a `step(300)` test. The compound needle turns amber while the pump cavitates.
* **Primer control**: hold to run; a ring fills with vacuum (fraction of the primer's best); captions RUNNING, CHECK SUCTION (30 s without catching, amber), PRIMED (check mark), COOLING (duty cut-out).
* **Screens** (M6, `ui/layout/AppRoot.tsx`): an app bar (name, Scenarios, a Sound switch) over the scenario menu (the start screen), the panels, or a debrief. The bar sits outside `AppShell`, so shell fixtures are unchanged. The **menu** starts with the **appliance picker** (M7, `ui/menu/AppliancePicker.tsx`: a radio group of the catalogue with a fitout line read off each spec; `store.setPlayerAppliance` saves the pick and reloads free play on it, ending any lesson in progress, which the picker warns of while one is running), then lists the ladder (brief filled in for the picked truck by `lessonBrief`, best stars, "Next up", disabled with what the appliance lacks, from the sim's `missingRequirements`) and free play. In free play the scene header's native select loads any scenario's fireground; during a lesson it names the lesson.
* **Lesson dock** (`ui/lesson/LessonDock.tsx`): fixed to the foot of the viewport (the right half from 900 px), on paper. It shows the coach step (with "Got it" for read-only steps), otherwise the objective in hand with live readings against target ("Branch on Delivery 2: 262 kPa · target 315 kPa–385 kPa") and a hold count; the latest radio call (polite live region); the objective checklist on demand; "See debrief" once ended. The page reserves the dock's height (`--dock-h` as padding and `scroll-padding-bottom`), so every control scrolls clear of it. Pop-overs were rejected: on a 375 px phone they'd cover the control they point at.
* **Coach copy names no truck's controls**: a coach step says `{target}` and `{gesture}`; the dock fills them from the layout showing (`ui/lesson/labels.ts` `gestureHint`: a lever's colour by function and whether a tap works, the throttle's kind in the simplified or realistic view), so "tap its green handle" is right on every truck.
* **Coach marks**: each panel item is wrapped in a `display: contents` `CoachAnchor`; the coach's target (`state/lessonView.ts` `coachTargetKey`, in the panel's item keys) gets the focus double ring and scrolls into view.
* **Debrief** (`ui/debrief/`): result, stars and points, findings, objectives, a score table that adds up; Next scenario, Try again, Back to the panel, All scenarios.
* **Audio** (`src/audio/`): pure `soundParams` (engine pitch and level by rpm, primer whine while it runs unprimed, cavitation rattle by intensity, spray by flow, a surging gush with splashing by tank overflow rate) drives a small Web Audio synth (no samples, no dependency), started on the first gesture, suspended when muted or off the panels, never in the e2e build.
* **Several trucks** (M5): `siteLayout.ts` stands trucks at stations by relay depth (the truck that feeds no other nearest the fire at `ATTACK_AT`, the deepest at the old spot by the dam and hydrant), pitches a portable dam off the suction coupling that draws on it, and runs each relay from its supplying coupling to an inlet coupling, a tank hatch or a dam; lays share the tightest map scale. One truck lays out exactly as before. Each truck is a group (`data-truck`, `data-truck-active`) with its label on the map (inverted for the one operated); tapping another truck operates it. Relay hoses draw charged (flowing, or a closed relay pressurised), dry, soft (over-run) or burst (a jet at the split length), with the climb halfway; portable dams show a level ring. The legend adds relay rows (flow and kPa at the inlet) and portable-dam rows; a relay delivery reads "Relay · N L/min".
* **Realistic view** (`ui/panel-real/`, §9.4): a header pair "Simplified · Realistic" (`aria-pressed`; `Settings.panelView`, saved; a new player starts on Realistic) switches the pump panel to the truck's own arrangement where its appliance has a realistic layout. It is a part-task trainer: gauges and controls where they are on the truck, simplified, no branding. Plates (instrument panel with the tank's sight tube beside it, since it is watched while monitoring rather than worked; plumbing bay; insets for what isn't on the rear) are drawn to the panel's width with items placed by percentage of each plate's viewBox; things the game doesn't model yet are drawn plainly as labelled images ("… (not in the game yet)"). Dials have no readout (the value stays in ARIA). Generic components (the variants are realistic-layout data, so a truck's simplified view keeps its button and T-handle): `HandPumpPrimer` (`primer` `variant: 'hand-pump'`, M7: a hand diaphragm primer's handle, held to stroke, rocking while held unless motion is reduced), `VernierThrottle` (`throttle` `variant: 'vernier'`, M7, needs `EngineSpec.vernier`: a vernier knob seen side on; a drag along the shaft pushes or pulls it with the release held, a drag across rolls it, one twist moving `throttlePerTurn`; arrows twist a quarter turn, Page Up/Down push or pull 10 %), `BayLever` (a quarter-turn lever swinging in the drawing's plane, across its pipe shut, along it open; gestures shared with `ValveHandle` in `useLeverGesture`), `PullHandlePrimer` (a T-handle, pull and hold), `SpeedSwitch` (a momentary speed controller: a press flicks the throttle by `flickRpm`, holding ramps it at `rampRpmPerS`, both from the spec's `EngineSpec.speedController`, through the store's `throttleRamp`, applied per sim tick so `__pumpops.step()` drives it; it lets go if it unmounts while held), `TankGauge` (the spec's `TankDisplay`: sight tube or electronic bands). A delivery's coupling and number plate is its scene-locate button; the coupling is drawn to its fitting size (`DeliverySpec.sizeMm`, radius ∝ √size) with the size stamped in its bore (issue #15). The warning strip sits under the plates (a real panel has no such lamps). **Water in the pipework** is drawn x-ray style as the scene draws a charged hose: an outlet-blue core while water stands, white streaks running the way it flows (moving only with motion), plain metal when empty; the pump shows a pool round its eye with a swirl while it moves water. A `pipe` or `casing` art item names its stretch with a `WaterRef` (tank side, an inlet's source or pump side, the casing with the outlets a manifold run `feeds`, beyond a delivery valve, the pump-to-tank return); `state/plumbing.ts` `waterIn` reads it from the sim's flows, the casing latch and what is connected to each inlet, adding no hydraulics. Watered pipes are split at each valve's pivot and drawn in the direction of flow.
* **Truck switcher** (M5): with more than one truck, the pump panel's header has a button per truck (`aria-pressed`), reachable on a phone without scrolling to the map. `store.setActiveTruck` hands the store's inputs to the truck being left (held in the sim) and takes the other's, so the active truck's controls live in the store and every other truck's in the sim; it clears the highlight (keyed by truck and delivery) and the Wake. The panel remounts per truck and names it ("Base pump · Category 1 tanker"); a relay delivery's valve is operable and its row says where the relay goes.
* **Scene supplies**: a supply hose runs from its inlet coupling to the dam (hard suction, strainer, a green water core rising from the strainer as the primer pulls, full once primed) or to a hydrant on the track (green layflat, dashed when soft); white streaks run to the pump while it draws.
* **Water in a hose** (`HoseWater.tsx`, issues #6, #8): a lay or supply hose draws its water over the part that's full, cut from its own cubic by arc length (`cubic.ts` `cubicPortion`) and running the way the water travels, so the streaks flow towards the front. `deliveryLines` gives each lay a `level`, `moving` and a `LineState` of `dry`, `filling` (front part way, no spray), `charged` (full, water at the branch; the crew sprays), or `holding` (water standing: shut, or the pump stopped; "Draining" on a downhill line); `supplyLays` gives `level` and `flowing`. Groups carry `data-level` and `data-moving`/`data-flowing`. While cavitating, charged delivery hoses break into gaps. The legend adds a non-interactive row per supply.
* Accessibility floor: keyboard operable controls, ARIA labels with live gauge values, respects `prefers-reduced-motion`.
* **Testability is a UI requirement** (`docs/TESTING.md` §3): instruments are `role="meter"` with `aria-valuenow` in native units, controls use Pointer Events only, and in the `e2e` build the real-time loop is replaced by explicit `__pumpops.step()` so rendered tests are deterministic.

## 8. Persistence & future hooks

* `localStorage` for settings + scenario progress: one versioned JSON blob (`state/persist.ts`, key `pumpops:v1`): the sound setting, the panel view, the appliance the player trains on (`applianceId`; an id not in the catalogue falls back to the default) and, per scenario and appliance, passed / best points / best stars. Parsed defensively; missing, blocked or malformed storage means defaults, never a broken app. No `SimState` is saved yet, so it carries no schema version.
* **PWA**: `public/manifest.webmanifest`, icons (SVG and PNGs rendered by `scripts/make-icons.mjs`), theme colour, and a network-first service worker (`public/sw.js`) registered in production builds only; `check-prod-bundle` fails if they don't ship.
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
  engine: EngineSpec;            // { idleRpm, maxRpm, rpmLagS, controls, crankS, crankRpm, refireRpm, runDownS }
  tank?: TankSpec;               // { capacityL }
  inlets: InletSpec[];           // { id, label, kind: 'tank'|'suction', lossKpaPerLpm2, sizeMm? }
  deliveries: DeliverySpec[];    // { id, label, sizeMm }
  primer?: PrimerSpec;           // { kind: 'rotaryVane', id, maxOnS, periodS } | { kind: 'diaphragm', id } | { kind: 'selfPriming' },
                                 // each with { maxVacuumKpa, displacementLps }
  relief?: ReliefSpec;           // { kind: 'preset', setKpa, … } | { kind: 'adjustable', id, minKpa, maxKpa, … }; dumpTo 'tank'|'inlet'
  pumpToTank?: PumpToTankSpec;   // { id, label, sizeMm, lossKpaPerLpm2 }: discharge → tank return
  instruments: InstrumentSpec[]; // { id, kind: 'compound'|'discharge'|'tacho', scale: { fullScale, zones } }
                                 // | { id, kind: 'tank', display: { kind: 'sightTube' } | { kind: 'bands', bands } }
}
```

Control ids are the inlet (tank-fill included), delivery, pump-to-tank and adjustable-relief ids (valves, 0–1) plus primer ids (switches); `appliances/controls.ts` derives them. Hose lays (`HoseLine`) are scenario data rather than part of the spec, so the hose carried isn't modelled yet.

* Specs are immutable. At scenario load the spec is **copied into `TruckState.spec`**, so `advance(state, inputs, dt)` keeps its signature and a saved state or replay stays self-contained even if the spec file is later re-tuned.
* One pump per appliance in this version. A vehicle with two independent pumps (e.g. a separate high-pressure reel pump) would need `pumps: PumpSpec[]`. That is deferred and listed in `docs/BACKLOG.md`.

### 9.3 Inputs keyed by control id

`PlayerInputs` must not have per-control fields such as `delivery1Open`. Inputs are maps keyed by ids the spec defines: `valves: Record<ControlId, number>` (0–1), `switches: Record<ControlId, boolean>` (primer, relief, series/parallel mode), plus `throttle`. A test checks that every control id in the inputs exists on the spec.

### 9.4 Panel layout as data

Each appliance has a layout in `ui/appliances/<id>/layout.ts` (types in `ui/appliances/types.ts`, registered in `ui/appliances/registry.ts`): an ordered list of sections, each placing spec controls and instruments with their label, `Gauge` face, control variant and tap behaviour. The face is a template: its range and zones come from the instrument's `scale` on the spec, since gauge markings differ between trucks. Sections are `row` (wrapping), `list` (stacked rows) or `cards` (side by side as cards where the panel is 560 px or wider, else stacked rows); a section with `span: 'half'` pairs with its neighbour on a panel 820 px or wider, so a truck's whole simplified panel fits a 1920 × 1080 screen without scrolling (checked by `e2e/layout.spec.ts` for every catalogue truck). CSS container queries size the components, so one layout serves 375–1920 px; each component draws its own SVG in its own `viewBox`. Absolute positions belong to the realistic view instead (below). The pump panel renderer (`ui/panel-pump/PumpPanel.tsx`) iterates the layout using the generic components (`Gauge`, `TankLevel`, `ValveHandle`, `Throttle`, `PrimerControl`, `WarningStrip`). The throttle and warning strip are placed by the layout too, exactly once. Adding an appliance means adding a spec, a layout and scene art; a new component is needed only for a genuinely new kind of control.

**Scene art** (`ui/appliances/<id>/scene.ts`, type `SceneArt`, registered in the same registry) describes the truck from above in drawing units: body length and width, cab length, whether it has a tank hatch, and one coupling per delivery and per external inlet, suction or tank fill (truck-local position and the way it faces), keyed by spec control id with a `kind` (`delivery | inlet`); the tank feed is internal and has none. One generic `ApplianceArt` draws it. `ui/appliances/scene.test.ts` checks art ↔ spec one-to-one, as for the layout; the test appliance's art lives in `src/testing/appliances/`.

* Real panels differ in arrangement, and finding the right control is part of the skill, so a layout should follow the real arrangement (generic styling, no livery).
* Every layout must meet the mobile floor (375 px, 44 px targets). If a real panel is too dense, group the controls (e.g. a swipeable delivery bank) rather than shrink them.
* A test (`ui/appliances/layout.test.ts`) checks that the layout and spec match one-to-one: every control and instrument is placed once on a face that can show it, and nothing is placed that the spec doesn't have. It covers the test-only appliance too, whose layout lives in `src/testing/appliances/` and is registered only in the e2e build.

**Realistic layout** (optional, `ui/appliances/<id>/realistic.ts`, types in `ui/appliances/realistic.ts`, `getRealisticLayout`): the truck's own arrangement as plates, each with a viewBox, backdrop art (pipes with square ends, the pump casing drawn as a radial pump — inlet into the eye at its centre, discharge off a nozzle tangent to the volute's edge — couplings, `fitting` collars over tees and elbows, `flange` caps where a pipe leaves the plate, the panel box, label plates sized from their text or a fixed `w`) and items placed in its units: `gauge` (a spec instrument on a dial face), `tank-gauge`, `lever` and `outlet` (lever geometry: pivot, `shutDeg`, `openDeg`, length; an outlet adds its coupling box), `primer` (`variant: 'pull-handle'`), `throttle` (`variant: 'speed-switch'` with its rates), `engine-switch`, `engine-lamp` (a warning lit with the ignition on and the engine stopped, or with `litWhen: 'running'` a pump-running lamp, red or green glass), and `inert` items for what isn't modelled yet. Each plate has a `place`: `stack` plates stack top to bottom as on the truck; a `beside` plate sits right of the stacked plate before it, the row sharing the width by aspect so all are one height (the tank's sight tube beside the instrument panel); `inset` plates (what's round the side, such as hydrant to tank) share one row under them. `geometry.ts` `plateRows` / `plateWidthsPx` give the rows and drawn widths (row gaps included) to the renderer and the tests. Items name spec ids only: labels, tags, glyphs, handle colour and tap behaviour come from the simplified layout, so both views name every control the same, and the coach keys (`itemKey` / `realItemKey`, `ui/appliances/itemKey.ts`) match. `ui/appliances/realistic.test.ts` checks it places exactly what the simplified layout does (bar the warning strip, which the renderer adds once) and, from `ui/panel-real/geometry.ts`, that every control's hit box is ≥ 44 px with no overlaps at a 320 px phone panel. The e2e layout invariants and journeys then run on its fixtures. Control variants (`pull-handle`, `speed-switch`) belong to the realistic layout because the simplified view of the same truck keeps its button and T-handle.

### 9.5 Calibration and tests per appliance

* `docs/CALIBRATION.md` has a **shared physics** section (friction, branches, lift, head) and **one section per appliance** (pump curve, tank, rated flow, rpm). Every spec number carries the same `// doctrine-confirmed` / `// PLACEHOLDER — needs Dek` comment as `constants.ts`.
* A **contract suite** runs `describe.each` over all registered appliances: determinism, NaN/edge fuzz (on tank, hydrant and draught supplies), tank runs dry without crashing, hydrant to tank (shut fills nothing, half open fills slower, shutting stops it the next tick and reopening resumes it, a full tank overflows onto a pool that soaks away once it's shut, it never feeds the pump, and the tank moves by fill less draw), and where a suction inlet and a primer exist: prime and draw, cavitation onset with throttle adding no flow, lose prime on an empty dam. A relay contract runs every ordered pair of appliances: a closed relay delivers and conserves water and replays exactly, over-running it is capped without NaN, fuzz on both pumps (bursting or not), an open relay refills a tank. A new appliance gets these for free; appliance-specific worked examples go alongside.

### 9.6 Scenarios

Scenarios name appliances by `id`. Where the lesson is generic (e.g. "tank attack"), a scenario declares the **capabilities** it requires (`tank`, `deliveries ≥ 2`, `suction` inlet, a `primer` of any kind) instead of a fixed appliance, so it can be played on any appliance that has them. The loader (`loadScenario`) rejects a scenario whose appliances lack those capabilities, or whose lesson names anything the fireground lacks; the menu disables a scenario and says what's missing. Relay scenarios may mix appliance types (e.g. bulk water carrier supplying a Cat 1): `Scenario.support` lists the other trucks' roles with their own requirements, and `build(spec, support)` takes an appliance per role, defaulting to the player's. Tests and golden traces run the relays with the test appliance in either role.

### 9.7 Adding an appliance — checklist

1. `sim/appliances/<id>.ts` spec; every figure has a status comment.
2. `docs/CALIBRATION.md` section with worked examples; Dek confirms or marks PLACEHOLDER.
3. Contract suite passes; add tests for anything appliance-specific.
4. If it needs a new behaviour kind (e.g. a new primer type), extend the enum and the engine module test-first, not as a special case.
5. Panel layout + scene art. Generated fixtures and layout invariants cover it at 375 / 768 / 1280 px automatically; run `npm run review`, look at the new contact sheets and commit the new baselines.
6. Register it in the appliance catalogue, then list it in scenario selection.

### 9.8 What the second appliance changed (M7, Cat 7)

The Cat 7 (`sim/appliances/cat7.ts`, from `Resources/Photos/Cat7_*`) went in by the checklist above. What the spec and engine didn't anticipate, each now a field or a generic mechanism rather than a special case:

* **A pump with no relief needs another way to shed churn heat**: `ApplianceSpec.recirc`, the tank recirculation bleed (§4.4). FOAM ON (the bleed back to the suction through the proportioner) and foam itself aren't modelled.
* **No tacho**: already allowed (instruments are what's fitted), but lessons read gauges, so a lesson now needs the gauges it asks the player to read (`lesson/validate.ts` `playerInstruments`; `missingRequirements(…, lesson = true)`); free play doesn't. The sound's firing rate moved into the spec (`EngineSpec.cylinders`).
* **A vernier throttle and a hand primer**: realistic-layout variants (§7) and `EngineSpec.vernier`; the simplified primer says STROKING for a `diaphragm` primer.
* **Lessons assumed a 65 mm outlet and a pump to feed it.** A line plan may carry a `light` kit (`scenarios/lay.ts`: what the crew runs when every free outlet is smaller than the hose; `LIGHT_LINE`, two lengths of 25 mm and a 12 mm branch), lesson copy names lines by placeholder (`lesson/text.ts`: `{line:…}`, `{kpa:…}`, `{flow:…:f}`, filled in by the loader), and a flow target may be a fraction of a line's working flow (`ofWorking`). Lesson titles stay fixed, so the tank attack became "two lines on the tank".
* **A small pump can't over-run what a big one does** (a 400 kPa hydrant, a 4 m draught, the relay), so behaviour tests that need an over-run push with big lines or a weak hydrant (`testUtils.withBigLines`), journeys ask the sim first (`e2e/sources.ts` `overRuns`, `relayBurstsOnSlam`), and generated fixtures exist only where their state shows. Lesson mixes with a support pump much smaller than the player's aren't required to pass (`ladder.test.ts`); the menu plays support roles on the player's own appliance.
* Still assumed, now listed for later: one primer per pump and one static source per truck (§4.6), no hose reels, engine controls inert.
