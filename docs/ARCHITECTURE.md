# Architecture — Pump Operator Training Game

An overview: the module map, the structural rules and the sim approach. Detail lives next to the thing it describes (see *Where detail lives*, below), so this file stays short. `CLAUDE.md` has the working rules.

## What it is

A browser game teaching fireground pump operation from the pump panel. The player works realistic controls (throttle, deliveries, tank-to-pump, inlets, primer) and reads realistic instruments (discharge and compound gauges, tank level, tacho) while a simplified but honest hydraulics model responds. Equipment and terminology follow NSW RFS fitout and doctrine, with no RFS branding.

* **Pump panel**: the rear of the truck, fully interactive, in a simplified or a realistic view.
* **Scene panel**: a plan-view SVG of the fireground (trucks, hose lays, branches, crews, water sources, relays) driven by sim state.

The scene sits beside the panel at ≥ 900 px (`SIDE_BY_SIDE_MIN_PX`, `ui/layout/breakpoints.ts`) and above it below that. A portrait phone is the baseline constraint: everything is operable with a thumb.

## Stack

TypeScript (strict), Vite, React 18, SVG for both panels, Zustand, Vitest, Playwright (Chromium). No backend, no canvas or game engine; revisit only if profiling demands it.

## Module map

```
src/
  sim/         Pure TypeScript, deterministic. advance(state, inputs, dt) -> state.
    appliances/  ApplianceSpec per vehicle + catalogue + contract suite
    lesson/      Lesson conditions, effects, progress, scoring, scripted operator
    scenarios/   Scenario definitions, loader, scripted runs + golden traces (__traces__/)
  state/       Zustand store (owns SimState), selectors, warning lamps, lesson/debrief views, persistence, rAF loop
  ui/          React + SVG. panel-pump (generic controls), panel-real (realistic bay),
               panel-scene, appliances (per-truck layout + scene art), menu, lesson dock, debrief
  audio/       Pure sound parameters -> a small Web Audio synth (never started in the e2e build)
  testing/     e2e build only: window.__pumpops API, fixture gallery, test-only appliance
e2e/           Playwright journeys, layout invariants, visual review reporter
```

Each `sim/` module opens with a header comment saying what it models and the assumptions it makes; read the header before changing the module.

## Structural rules

1. **`sim/` is pure.** Plain serialisable data in and out; no React, DOM, Zustand or `Math.random()`/`Date.now()`. Every hydraulics behaviour is demonstrable in a Vitest case without rendering.
2. **The UI reads through selectors and writes through `PlayerInputs`.** UI-only state never enters `SimState` ([006](decisions/006-ui-state-stays-out-of-the-sim.md)).
3. **An appliance is data, never a code branch** ([002](decisions/002-appliances-are-data.md)).
4. **Lesson state lives beside `SimState`**, changed by pure effects ([005](decisions/005-lessons-are-declarative-data.md)).
5. **Constants:** physics in `sim/constants.ts`, per-truck figures in the spec, each tagged `doctrine-confirmed` or `PLACEHOLDER — needs Dek`; `docs/CALIBRATION.md` is the single source of truth for the numbers.

## Simulation approach

Each tick (fixed 10 Hz) solves the network as if steady, then Euler-steps the slow states ([001](decisions/001-quasi-steady-solver.md)). The network is a small graph, `[source] → inlet → [pump] → deliveries → hose → [branch]`, solved for any number of inlets and deliveries:

* **Inlets** ([003](decisions/003-inlets-as-parallel-paths.md)): tank, hydrant, draught and closed relay are parallel source paths at the pump inlet, floored at the cavitation pressure. Hydrant to tank bypasses the pump.
* **Pump**: an affinity-law curve, `P = shutoff·(rpm/max)² − droop·Q²`, per appliance, with engine start/stop, relief and recirculation as spec options.
* **Lines**: valve loss, hose friction per metre (`HOSES` catalogue), elevation at 10 kPa/m, branch orifice law. Lines fill and empty (`lineFill.ts`).
* **Relays** ([004](decisions/004-relay-equivalent-source.md)): a closed relay couples two pump solves; an open relay ends at a tank or dam.
* **Teaching behaviours**: cavitation, priming and loss of prime, churn overheat, water hammer, relay bursts, tank running dry and overflow. Each module's header says how it works; the assumptions that need Dek's confirmation are in `docs/CALIBRATION.md`.

`src/sim/types.ts` is authoritative for the state shape. All of it is serialisable, which leaves the door open for replays and shareable scenarios.

## Scenarios and lessons

A scenario (`sim/scenarios/`) builds a fireground for any eligible appliance (`build(spec, support)`), declares the capabilities it needs, and may carry a lesson and a scripted `solution`. `scenarios/index.ts` lists the ladder in order, then free play (the sandbox, no lesson). `loadScenario` checks capabilities and validates the lesson against the fireground. Details in [005](decisions/005-lessons-are-declarative-data.md).

## Panels

The pump panel is rendered from the appliance's layout data; the scene from its scene art; the realistic view from an optional plate layout. Components are generic, and `ui/appliances/*.test.ts` check each layout against its spec. Every layout meets the mobile floor (375 px, 44 px targets), and `e2e/layout.spec.ts` enforces it. If a real panel is too dense, group the controls rather than shrink them.

## Persistence

`localStorage` holds one versioned blob (`state/persist.ts`, key `pumpops:v1`): settings, the player's appliance and per-scenario results, parsed defensively. `SimState` is not saved yet and carries no schema version. The PWA manifest and a network-first service worker ship in production builds; `check-prod-bundle` fails if they don't.

## Where detail lives

| What | Where |
|---|---|
| Why a structural choice was made | `docs/decisions/` |
| What a module models, its formulas and assumptions | the header comment of the module |
| Doctrine figures, worked examples, open questions for Dek | `docs/CALIBRATION.md` |
| Open work, deferred items, known limits | `docs/BACKLOG.md` |
| Test layers, hooks, fixtures, the review loop | `docs/TESTING.md` |

Add a decision record when a decision constrains future work; put module-only facts in the module's header; don't record what the code makes obvious. If something here has drifted from the code, fix it in the same session.
