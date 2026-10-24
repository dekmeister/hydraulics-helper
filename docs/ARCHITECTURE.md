# Architecture — Pump Operator Training Game

Working title: **PumpOps** (placeholder — rename freely).

## 1. What we're building

A browser game teaching fireground pump operation from the operator's position at the pump panel. The player manipulates realistic controls (throttle, deliveries, tank-to-pump, suction/collector inlets, primer) and reads realistic instruments (discharge gauge, compound gauge, tank level, tacho) while a simplified but honest hydraulics model responds. Equipment and terminology follow standard NSW RFS fitout and doctrine (deliveries, branches, draughting, kPa, L/min), but the game carries no RFS branding.

Two panels:

* **Pump panel** — close-up of the rear of the truck: gauges, valve handles, throttle, primer. Fully interactive from day one.
* **Scene panel** — top-down/isometric overview: truck, hose lays, branches, firefighters, water sources, relay trucks. Static illustration initially, driven by sim state later (flow animation, firefighters reacting to loss of water, tank/dam levels).

**Multiple appliances.** The game is built to train on several vehicle types (tankers of different categories, bulk water, urban pumpers), each with its own pump, plumbing and panel layout. The physics is shared; each appliance is a data definition. v1 ships one reference appliance. See §9.

Layout: side-by-side at ≥ 900 px (`SIDE_BY_SIDE_MIN_PX`, `ui/layout/breakpoints.ts`), stacked (scene above panel) below that, so a 768 px portrait tablet stacks and a 1024 px landscape tablet is side by side. (`Design/DESIGN_SPEC.md` §7 says "tablet side by side" without a width; this doc and `docs/TESTING.md` are what's implemented — open question for Dek.) Portrait phone is the baseline constraint — all controls must be operable with a thumb.

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
    pump.ts       # Pump curve, engine rpm lag (priming, cavitation, overheat from M4)
    network.ts    # Per-truck steady-state solver (bisection on discharge pressure)
    tank.ts       # Tank / dam volume integration
    relay.ts      # Relay link logic (open & closed)
    engine.ts     # Tick loop: advance(state, inputs, dt) -> state
    appliances/   # ApplianceSpec per vehicle type + catalogue (see §9)
    scenarios/    # Scenario definitions as data (JSON-like TS); scripted runs + golden traces (__traces__/)
  state/
    store.ts      # Zustand store; owns SimState; dispatches player inputs
    selectors.ts  # Derived values for UI (gauge angles, warnings)
    loop.ts       # requestAnimationFrame accumulator → fixed 10 Hz ticks (not started in the e2e build)
  ui/
    panel-pump/   # Generic controls (Gauge, ValveHandle, Throttle, Primer) + layout-driven renderer
    panel-scene/  # SceneView, Appliance, HoseLay, Branch, WaterSource
    appliances/   # Per-appliance panel layout + scene art (see §9.4)
    layout/       # Responsive shell, HUD, dialogs
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

* **Tank** (tank-to-pump valve): the compound gauge reads slightly *negative*, more so with flow (manual L3529): `P_in = −k_inlet·Q²/open²`, limited by tank volume. With tank-to-pump shut or the tank empty, the pump is dry and every gauge reads 0 (Table 6). Smarter starvation behaviour arrives with cavitation in M4.
* **Hydrant/collector**: fixed positive inlet pressure (scenario parameter, e.g. 300–700 kPa), effectively unlimited volume.
* **Draughting** (static source via suction hose): inlet pressure is *negative* — lift converts to vacuum. Requires priming. Max practical lift ~7 m; performance degrades well before that.
* **Relay inlet**: pressure supplied by another truck's discharge (closed relay).

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

**Solver** (`network.ts`): for a given discharge pressure `P_d`, each open line's flow has a closed form, `Q = √((P_d − 10·Δh)/R)`, where `R` = valve + hose + `1/k_branch²`. Total demand (lines + relief) rises with `P_d`; the supply (pump curve less inlet loss) falls with flow. So bisect `P_d` on `[0, shutoff at current rpm]` for a fixed `SOLVER_ITERATIONS`, which keeps it deterministic. No matrix solvers, no external libs. One line per delivery.

### 4.6 Failure & realism behaviours (the fun part)

These make the model *teach*:

* **Cavitation**: when demanded flow exceeds what the inlet can supply (draughting lift too high, suction strainer restriction, or outrunning a relay), inlet pressure collapses. Symptoms: discharge pressure sags and fluctuates (add noise to gauge), rattling audio, throttle stops responding ("adding RPM does nothing" — the classic lesson). Sustained cavitation damages the pump (scenario fail state).
* **Priming**: draughting requires running the primer until the compound gauge pulls vacuum and the pump catches. Losing prime (air leak event, running the source dry) forces re-priming.
* **Tank runs dry**: level gauge, low-water warning, then flow collapse. Firefighters on the scene panel lose water.
* **Overheat**: pump running at pressure with zero flow heats up; recirculation/relief line or cracking a delivery fixes it.
* **Water hammer**: slamming a valve from high flow to closed too fast scores damage; teaches smooth valve operation. (Detect via dQ/dt threshold — no transient sim needed.)
* **Over-pressuring a closed relay**: receiving operator's compound gauge climbs; exceeding hose rating bursts a length (scenario event).

### 4.7 Relay pumping

A scenario can contain multiple trucks; the player operates one panel at a time (tap a truck on the scene panel to switch — later milestone), others follow simple AI or fixed settings.

* **Closed relay**: truck A discharge → 65 mm supply line → truck B inlet. Solve trucks in supply order each tick: A's network sees B as a "branch" whose demand is B's current total flow; B's inlet pressure = A's discharge − friction − elevation. Key instrument lesson: B's compound gauge shows *positive* inlet pressure; B's operator must keep it above ~100 kPa residual, A's operator must not over/under-drive.
* **Open relay**: truck A discharges into truck B's tank (or a portable dam) via an open line; B draughts/tanks independently. Model as a flow into B's tank volume, capped by A's line. Decouples the pumps — the lesson is *why* you'd choose this (simpler, tolerant) vs closed (efficient, no dam needed).

### 4.8 State shape (sketch)

```ts
interface SimState {
  time: number;
  trucks: TruckState[];      // spec (copied ApplianceSpec, §9.2) + dynamic pump/tank/engine/valve state
  links: RelayLink[];        // truck->truck or truck->dam connections
  sources: WaterSource[];    // dam, hydrant, portable dam
  lines: HoseLine[];         // segments, elevation profile, branch
  events: SimEvent[];        // burst hose, air leak, etc.
  score: ScoreState;
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
* **Controls** must work by drag *and* tap (tap a valve = toggle open/closed with animated travel; drag = fine control). Hit targets ≥ 44 px.
* **Scene panel v1** is a static SVG composition with a few state-driven bits (hose highlight when flowing, branch spray on/off, tank fill bar). Structure it as components from day one so reactivity is added incrementally, not rebuilt.
* **Warnings/telemetry HUD**: small strip surfacing what a real operator would hear/feel (engine note, cavitation rattle) as text/icons until audio exists.
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
| Physics: 10 kPa/m head, hose friction per size, orifice law, lift-derate table, atmospheric pressure | Pump: shutoff pressure, droop, rated flow, rpm idle/priming/max, stages, series/parallel (pressure/volume) mode if fitted |
| Hose and branch catalogue (25/38/65 mm …): the physics of a 38 mm length doesn't change by truck | Equipment carried: which hose sizes/lengths and branches are stowed |
| Failure behaviours: cavitation, loss of prime, churn overheat, water hammer | Tank: capacity, crew-protection reserve, tank-to-pump valve type; absent on a portable pump |
| Network solver, tick loop, relay logic | Inlets available (tank, hydrant/collector, draught suction, relay) and their sizes |
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
  pump: PumpSpec;                // { shutoffKpa, droopKpaPerLpm2 }
  engine: EngineSpec;            // { idleRpm, maxRpm, rpmLagS }
  tank?: TankSpec;               // { capacityL }
  inlets: InletSpec[];           // { id, label, kind: 'tank'|'hydrant'|'draught'|'relay', lossKpaPerLpm2, sizeMm? }
  deliveries: DeliverySpec[];    // { id, label, sizeMm }
  primer?: PrimerSpec;           // { kind: 'rotaryVane', id, maxOnS, periodS } | { kind: 'diaphragm', id } | { kind: 'selfPriming' }
  relief?: ReliefSpec;           // { kind: 'preset', setKpa, … } | { kind: 'adjustable', id, minKpa, maxKpa, … }; dumpTo 'tank'|'inlet'
  instruments: InstrumentSpec[]; // { id, kind: 'compound'|'discharge'|'tacho'|'tank' }
}
```

Control ids are the inlet, delivery and adjustable-relief ids (valves, 0–1) plus primer ids (switches); `appliances/controls.ts` derives them. Hose lays (`HoseLine`) are scenario data rather than part of the spec, so the hose carried isn't modelled yet.

* Specs are immutable. At scenario load the spec is **copied into `TruckState.spec`**, so `advance(state, inputs, dt)` keeps its signature and a saved state or replay stays self-contained even if the spec file is later re-tuned.
* One pump per appliance in this version. A vehicle with two independent pumps (e.g. a separate high-pressure reel pump) would need `pumps: PumpSpec[]`. That is deferred and listed in the PLAN parking lot.

### 9.3 Inputs keyed by control id

`PlayerInputs` must not have per-control fields such as `delivery1Open`. Inputs are maps keyed by ids the spec defines: `valves: Record<ControlId, number>` (0–1), `switches: Record<ControlId, boolean>` (primer, relief, series/parallel mode), plus `throttle`. A test checks that every control id in the inputs exists on the spec.

### 9.4 Panel layout as data

Each appliance has a layout in `ui/appliances/<id>/layout.ts` that places each spec control and instrument on the panel's `viewBox`: position, orientation, label, and which `Gauge` face to use. The pump panel renderer iterates the layout using the generic components (`Gauge`, `ValveHandle`, `Throttle`, `PrimerControl`, `Lever`). Adding an appliance means adding a spec, a layout and optionally scene art; a new component is needed only for a genuinely new kind of control.

* Real panels differ in arrangement, and finding the right control is part of the skill, so a layout should follow the real arrangement (generic styling, no livery).
* Every layout must meet the mobile floor (375 px, 44 px targets). If a real panel is too dense, group the controls (e.g. a swipeable delivery bank) rather than shrink them.
* A test checks that the layout and spec match one-to-one: every control is placed, and nothing is placed that the spec doesn't have.

### 9.5 Calibration and tests per appliance

* `docs/CALIBRATION.md` has a **shared physics** section (friction, branches, lift, head) and **one section per appliance** (pump curve, tank, rated flow, rpm). Every spec number carries the same `// doctrine-confirmed` / `// PLACEHOLDER — needs Dek` comment as `constants.ts`.
* A **contract suite** runs `describe.each` over all registered appliances: determinism, NaN/edge fuzz, tank runs dry without crashing, cavitation onset, prime/lose-prime where a primer exists. A new appliance gets these for free; appliance-specific worked examples go alongside.

### 9.6 Scenarios

Scenarios name appliances by `id`. Where the lesson is generic (e.g. "tank attack"), a scenario declares the **capabilities** it requires (`tank`, `deliveries ≥ 2`, `draught inlet`) instead of a fixed appliance, so it can be played on any appliance that has them. The loader rejects a scenario whose appliances lack those capabilities. Relay scenarios may mix appliance types (e.g. bulk water carrier supplying a Cat 1).

### 9.7 Adding an appliance — checklist

1. `sim/appliances/<id>.ts` spec; every figure has a status comment.
2. `docs/CALIBRATION.md` section with worked examples; Dek confirms or marks PLACEHOLDER.
3. Contract suite passes; add tests for anything appliance-specific.
4. If it needs a new behaviour kind (e.g. a new primer type), extend the enum and the engine module test-first, not as a special case.
5. Panel layout + scene art. Generated fixtures and layout invariants cover it at 375 / 768 / 1280 px automatically; run `npm run review`, look at the new contact sheets and commit the new baselines.
6. Register it in the appliance catalogue, then list it in scenario selection.
