# 002 — An appliance is data

**Decision.** The engine and UI are generic; a vehicle type is a set of data, and no code branches on which vehicle it is (`if (id === 'cat1')`).

- **Spec** (`sim/appliances/<id>.ts`, type `ApplianceSpec` in `sim/types.ts`): pump, engine, tank, inlets, deliveries, primer, relief, pump-to-tank, recirculation, instruments. A behaviour that varies between trucks is a field or an enum on the spec, and the engine module handling it covers every member with tests.
- **Copied into state.** The spec is copied into `TruckState.spec` at scenario load, so `advance()` keeps its signature and a saved state or replay stays self-contained if the spec is re-tuned.
- **Inputs by control id.** `PlayerInputs` holds maps keyed by ids the spec defines (`valves` 0–1, `switches`, `throttle`), derived by `sim/appliances/controls.ts`; never a field like `delivery1Open`.
- **Layout and scene art are data too** (`ui/appliances/<id>/layout.ts`, `scene.ts`, optional `realistic.ts`), drawn by generic components. Tests check each against the spec one-to-one: every control and instrument placed once, nothing placed that the spec lacks, one coupling per delivery and external inlet.
- **Scenarios name capabilities, not appliances** (tank, deliveries ≥ N, suction inlet, primer, or an explicit id list). `loadScenario` rejects an appliance that lacks one, and the menu disables the card and says what's missing.
- **Contract suite** (`sim/appliances/contract.test.ts`) runs `describe.each` over the catalogue, plus a relay contract over every ordered pair. A test-only appliance (`src/testing/appliances/`, registered in the e2e build) keeps the suite honest about single-appliance assumptions.

**Why.** The product is several trucks (Cat 1, Cat 7, later tankers, bulk water, urban pumpers) sharing one physics. The Cat 7, the second truck, went in through this path and turned up gaps (no relief, no tacho, vernier throttle, hand primer, smaller outlets); each became a field or generic mechanism rather than a special case.

**Costs / known limits.** One pump, one primer and one static source per truck; no hose reels (all in `docs/BACKLOG.md`). A figure that differs between trucks lives in the spec, which means UI-only figures (`speedController`, `vernier`) sit there too.

**Adding an appliance.** (1) Spec, every figure tagged `doctrine-confirmed` or `PLACEHOLDER — needs Dek`. (2) A `docs/CALIBRATION.md` section with worked examples. (3) Contract suite passes; add tests for anything appliance-specific. (4) A new behaviour kind extends an enum and its engine module test-first. (5) Layout and scene art; fixtures and layout invariants cover it at 375/768/1280 px; run `npm run review`. (6) Register it in the catalogue.
