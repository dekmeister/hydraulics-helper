# Architecture — Pump Operator Training Game

Working title: **PumpOps** (placeholder — rename freely).

## 1. What we're building

A browser game teaching fireground pump operation from the operator's position at the pump panel. The player manipulates realistic controls (throttle, deliveries, tank-to-pump, suction/collector inlets, primer) and reads realistic instruments (discharge gauge, compound gauge, tank level, tacho) while a simplified but honest hydraulics model responds. Equipment and terminology follow standard NSW RFS fitout and doctrine (deliveries, branches, draughting, kPa, L/min), but the game carries no RFS branding.

Two panels:

* **Pump panel** — close-up of the rear of the truck: gauges, valve handles, throttle, primer. Fully interactive from day one.
* **Scene panel** — top-down/isometric overview: truck, hose lays, branches, firefighters, water sources, relay trucks. Static illustration initially, driven by sim state later (flow animation, firefighters reacting to loss of water, tank/dam levels).

Layout: side-by-side on tablet/desktop (≥ ~900 px), stacked (scene above panel) on phones. Portrait phone is the baseline constraint — all controls must be operable with a thumb.

## 2. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript, strict | Type-safe sim, refactor confidence |
| Build | Vite | Fast, zero-config, static output |
| UI framework | React 18 | Component model fits panel controls; huge ecosystem |
| Graphics | SVG (both panels) | Gauges/valves are vector-native; crisp at any DPI; DOM events for free; no engine needed at this scale |
| State | Zustand | Minimal store; sim state lives outside React, UI subscribes |
| Testing | Vitest | Unit tests for the sim are the backbone of correctness |
| Deployment | Static hosting (any) | No backend; game is fully client-side |

Deliberately **no** Pixi/Phaser/canvas engine for v1. The scene panel is a handful of animated SVG elements, not thousands of sprites. Revisit only if profiling demands it.

## 3. Module layout

```
src/
  sim/            # Pure TypeScript. NO imports from React, DOM, or state/.
    types.ts      # Entities, units, config interfaces
    constants.ts  # Tunable physical constants (see §6)
    pump.ts       # Pump curve, priming, cavitation, overheat
    network.ts    # Hose network graph + steady-state solver
    tank.ts       # Tank / dam volume integration
    relay.ts      # Relay link logic (open & closed)
    engine.ts     # Tick loop: advance(state, inputs, dt) -> state
    scenarios/    # Scenario definitions as data (JSON-like TS)
  state/
    store.ts      # Zustand store; owns SimState; dispatches player inputs
    selectors.ts  # Derived values for UI (gauge angles, warnings)
  ui/
    panel-pump/   # Gauges, ValveHandle, Throttle, Primer, TankGauge
    panel-scene/  # SceneView, Truck, HoseLay, Branch, WaterSource
    layout/       # Responsive shell, HUD, dialogs
    tutorial/     # Coach marks / guided steps
  audio/          # Engine note, priming whine, cavitation rattle (later)
```

**The hard rule:** `sim/` is a pure, deterministic library. `advance(state, inputs, dt)` takes plain data and returns new plain data. Every hydraulics behaviour must be demonstrable in a Vitest test without rendering anything. UI reads sim state through selectors and writes only through a small `PlayerInputs` interface (valve positions 0–1, throttle 0–1, primer engaged, etc.).

## 4. Simulation model

### 4.1 Approach: quasi-steady-state with slow integrators

Hydraulic transients settle in seconds; gameplay happens over minutes. So each tick:

1. **Solve the network instantaneously** — given current valve positions, throttle, sources, and hose layout, find the equilibrium flows and pressures.
2. **Integrate the slow states** — tank volumes, pump temperature, primer progress, engine RPM lag — with simple Euler steps.

Tick the sim at **10 Hz** fixed timestep (accumulator pattern). UI renders at display rate and interpolates gauge needles with critically-damped smoothing (needles also get realism from this lag).

### 4.2 Units

SI-adjacent, matching Australian practice: **kPa** for pressure, **L/min** for flow, **m** for length/elevation. One elevation constant: 1 m of head ≈ **9.8 kPa**.

### 4.3 The network

Model the plumbing as a small directed graph:

```
[Source] -> inlet -> [Pump] -> deliveries[1..4] -> hose segments -> [Branch]
```

Sources (mutually exclusive or combined per fitout):

* **Tank** (tank-to-pump valve): inlet pressure ≈ 0 kPa gauge (small positive head), limited by tank volume.
* **Hydrant/collector**: fixed positive inlet pressure (scenario parameter, e.g. 300–700 kPa), effectively unlimited volume.
* **Draughting** (static source via suction hose): inlet pressure is *negative* — lift converts to vacuum. Requires priming. Max practical lift ~7 m; performance degrades well before that.
* **Relay inlet**: pressure supplied by another truck's discharge (closed relay).

### 4.4 Pump curve

Centrifugal pump approximation using affinity-law shape:

```
P_pump(rpm, Q) = P_shutoff · (rpm/rpm_max)² − k_droop · Q²
```

* `P_shutoff` — pressure at zero flow at max RPM (e.g. ~1400 kPa for a mid-size RFS pump; tunable).
* Discharge pressure (what the discharge gauge reads) = `P_inlet + P_pump`, clamped ≥ 0.
* Engine RPM chases throttle with a first-order lag (~0.5 s) so the throttle feels mechanical.
* Optional **pressure governor / relief valve** toggle: caps discharge pressure by shedding effective RPM (teaches why gauges behave differently with the governor on).

### 4.5 Delivery lines and branches

Each delivery is a series path: valve → hose segments → branch (nozzle).

* **Valve**: quadratic loss scaled by opening, `ΔP_valve = k_v(open) · Q²`, with `k_v → ∞` as `open → 0`.
* **Hose friction**: `ΔP_hose = C(diameter) · (L/100 m) · Q²`. Separate coefficients for 38 mm and 65 mm hose (65 mm is dramatically lower — this contrast is a core lesson). Values in `constants.ts`, tuned so worked examples match RFS-style pump calculations.
* **Elevation**: `ΔP_elev = 9.8 · Δh` (uphill positive).
* **Branch**: orifice law, `Q = k_branch · √P_nozzle`. Branch types as data: 38 mm attack branch, 65 mm branch, fog/jet setting affecting `k`. Target teaching point: branches want ~700 kPa at the nozzle.

**Solver**: for a given discharge pressure `P_d`, each open line's flow has a closed form or a fast 1-D bisection (monotone in Q). Total demand `ΣQ` feeds back into the pump curve, which is monotone decreasing in Q — so bisect on `P_d` (or fixed-point iterate) until supply = demand. Converges in <20 iterations; trivially fast at 10 Hz. No matrix solvers, no external libs.

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
  trucks: TruckState[];      // pump, tank, engine, deliveries
  links: RelayLink[];        // truck->truck or truck->dam connections
  sources: WaterSource[];    // dam, hydrant, portable dam
  lines: HoseLine[];         // segments, elevation profile, branch
  events: SimEvent[];        // burst hose, air leak, etc.
  score: ScoreState;
}
```

All serialisable → free save/restore, replay, and shareable scenario states.

## 5. Scenarios, tutorial, scoring

* **Scenario = data file**: initial layout (trucks, sources, hose lays), objectives ("maintain 700 kPa at branch 1 for 3 minutes", "establish draughting supply"), events on a timeline or triggers, pass/fail conditions.
* **Tutorial**: scripted coach-marks over the sandbox ("open tank-to-pump", "bring throttle up until discharge reads 700"). Implemented as scenarios with step gates.
* **Sandbox**: free play, every parameter exposed.
* **Scoring**: water delivered to objectives, penalties (water hammer, cavitation seconds, dry-running, crew left without water). Keep it gentle — this is a trainer, not a punisher.

Suggested scenario ladder: 1) tank attack, single 38 mm line → 2) two lines + branch pressure management → 3) hydrant supply → 4) draughting from a dam → 5) closed relay uphill → 6) open relay with portable dam → 7) full incident with events.

## 6. Constants & doctrine validation

All physical constants live in `sim/constants.ts` with a comment citing the intended real-world figure, and a `docs/CALIBRATION.md` table of worked examples the tests assert against, e.g.:

> One 38 mm line, 4 lengths (120 m), flat, branch needing 700 kPa at ~230 L/min → pump pressure ≈ 700 + FL. Fill in FL from RFS pump-calc doctrine and lock with a test.

**Owner action (Dek):** supply the doctrine numbers (friction loss per 100 m per hose size at reference flows, standard branch flows/pressures, tank capacities per category, pump ratings) — the sim is calibrated to whatever this table says, so the table is the single source of truth.

## 7. UI architecture notes

* **Gauges** are one parameterised SVG component (face, ticks, needle, red zones) — discharge, compound, tacho, tank all reuse it. Compound gauge face spans −100…+1600 kPa style dual scale.
* **Controls** must work by drag *and* tap (tap a valve = toggle open/closed with animated travel; drag = fine control). Hit targets ≥ 44 px.
* **Scene panel v1** is a static SVG composition with a few state-driven bits (hose highlight when flowing, branch spray on/off, tank fill bar). Structure it as components from day one so reactivity is added incrementally, not rebuilt.
* **Warnings/telemetry HUD**: small strip surfacing what a real operator would hear/feel (engine note, cavitation rattle) as text/icons until audio exists.
* Accessibility floor: keyboard operable controls, ARIA labels with live gauge values, respects `prefers-reduced-motion`.

## 8. Persistence & future hooks

* `localStorage` for settings + scenario progress (single small JSON blob, versioned).
* Deterministic sim + serialisable state leaves the door open for: replays, instructor-authored scenarios (JSON import), and a "what happened" debrief screen.
