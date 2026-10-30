# CLAUDE.md — Pump Operator Training Game

Read `docs/ARCHITECTURE.md` (design) and `docs/BACKLOG.md` (open work) before writing code, and `docs/TESTING.md` before writing tests or UI. This file is about *how* we work.

## Project one-liner

Browser game teaching NSW-style fire pump operation: interactive pump panel + scene overview, driven by a small, honest hydraulics sim. Built to support multiple appliance types (different pumps, plumbing and panel layouts); each appliance is data, not code (`docs/decisions/002-appliances-are-data.md`). TypeScript + Vite + React + SVG + Zustand + Vitest + Playwright. No backend, no RFS branding.

## Commands

```bash
npm run dev       # Vite dev server
npm run test      # Vitest fast tier (~25 s): sim, contract suite, golden traces, data consistency; a slice of each cross-product
npm run test:matrix    # Vitest with every appliance × scenario × support case; part of verify
npm run test:e2e  # Playwright: journeys on the phone, layout invariants at 375/768/1280, keyboard on desktop
npm run test:e2e:full  # The exhaustive matrix (every journey × viewport × fixture state); opt-in
npm run review    # Visual review bundle in review/ against baselines rendered from HEAD (read review/report.md)
npm run review:baseline [ref]  # Render baselines from another commit (default HEAD); never committed
npm run lint      # ESLint + Prettier check
npm run build     # Type-check + production build
npm run verify    # lint → test:matrix → build → test:e2e → review (~3–4 min)
```

**Fast loop: test what you touched, scale the final check to the change.** Dek shouldn't wait minutes for a minor change.

* While iterating: only the tests for what you changed: `npx vitest run <file|dir>` (~3 s), `npx playwright test <spec>`, `npx eslint <files>`.
* Before finishing: `npm run test` (~25 s), `npx tsc -b`, lint on the touched files; for UI changes also the touched e2e specs and `npm run review`.
* Full `npm run verify` only for cross-cutting changes (sim engine, `ApplianceSpec`/types, a new or changed appliance, scenarios catalogue, test harness, build config) or when Dek asks.
* A new cross-product test wraps its case list in `matrix()`/`rotate()` (`sim/testUtils.ts`) so the fast tier stays fast.

If you break `dev`, fixing it takes priority over new features.

## Non-negotiable rules

1. **`src/sim/` is pure.** No imports from React, DOM APIs, Zustand, or `src/ui|state`. It's a deterministic library: `advance(state, inputs, dt) → state` on plain serialisable data. If you feel the urge to reach for `Date.now()`, `Math.random()`, or a DOM type inside `sim/`, stop — take time/randomness as parameters.
2. **Sim behaviour is tests-first.** New hydraulics behaviour starts with a failing Vitest case, preferably a worked example added to `docs/CALIBRATION.md`. No sim PR without tests.
3. **Physical constants live in `sim/constants.ts`; appliance-specific figures live in that appliance's spec (`sim/appliances/<id>.ts`)** and nowhere else. Every one carries a comment stating the real-world figure it represents and its source status (`// doctrine-confirmed` or `// PLACEHOLDER — needs Dek`). Never inline a magic hydraulic number elsewhere. Rule of thumb: if it would differ between two trucks, it belongs in the spec. If it's physics, it belongs in `constants.ts`.
4. **Units:** kPa, L/min, metres, seconds — everywhere, including variable names when ambiguous (`pressureKpa`, `flowLpm`). No PSI, no GPM, ever.
5. **Terminology is Australian fire-service:** deliveries (not discharges as a noun for outlets), branch (not nozzle, except for the orifice maths), draughting, compound gauge, tank-to-pump, appliance/truck. UI copy uses these terms; teaching correct vocabulary is part of the product.
6. **TypeScript strict; no `any`,** no non-null assertions without a comment justifying them. Exported sim functions get doc comments explaining the physics in one or two lines.
7. **No new dependencies without asking Dek.** The stack is deliberately small. State the problem and the candidate lib first.
8. **No RFS logos, names, or livery.** Generic rural fire aesthetic only.
9. **No single-appliance assumptions.** Don't hardcode delivery counts, control ids, hose sizes or gauge sets, and never branch on appliance identity (`if (id === 'cat1')`). A behaviour that varies between vehicles is a field or enum on `ApplianceSpec`, handled for every enum member with tests. v1 has one appliance; the code must work unchanged when a second is added.

## Code style & structure

* Functional React components + hooks; no class components.
* UI reads sim state via `state/selectors.ts`; writes only through `PlayerInputs` actions. Components never mutate sim state directly.
* SVG components take a `viewBox`-relative coordinate system; layout/scaling happens in the parent. One parameterised `Gauge`, not four bespoke gauges.
* The pump panel is rendered from per-appliance layout data (`ui/appliances/<id>/layout.ts`); don't hand-compose a panel for a specific truck.
* Prefer small files (< ~200 lines). Prefer plain functions to classes in `sim/`.
* Naming: `PascalCase` components, `camelCase` functions/vars, `SCREAMING_SNAKE` constants.
* Comments explain *physics or intent*, not mechanics. A formula gets a one-line "why" and units.

## Testing expectations

* `sim/`: high coverage, calibration examples asserted to tolerance (`expect(p).toBeCloseTo(target, …)` with tolerance noted), determinism test, NaN/edge fuzz test.
* Generic behaviour tests (determinism, fuzz, runs-dry, cavitation, priming) go in the **appliance contract suite**, `describe.each` over every registered appliance, not against one hardcoded truck.
* Scripted scenario runs get a **golden trace** (CSV snapshot). If a trace changes, explain the numeric diff before updating it. Never "fix" a failing calibration test by updating a snapshot.
* UI is tested **in a real browser with Playwright, not jsdom**: journeys drive the built app through real controls (no input shortcuts), and assert readings via ARIA (`role="meter"`), not needle pixels. See `docs/TESTING.md`.
* Any new visual state gets a **fixture** (`src/testing/fixtures/`) with an `expect` caption; adding a fixture adds a screenshot at all three viewports.
* After UI work, run `npm run review`, read `review/report.md`, and **look at the contact sheet of every changed or new fixture** against its caption (checklist in `docs/TESTING.md` §6). Baselines are rendered from `HEAD`, never committed (`docs/TESTING.md` §5); accept locally only changes you've seen and can explain, and list them in the summary.
* **Don't drive Chrome by hand** (Chrome extension, clicking around the dev server) to check UI work. Use the review loop. Manual browsing is for exploration Dek asks for.
* Tests are deterministic: sim time moves only via `__pumpops.step()`, randomness is seeded, animations are off for screenshots. Fix or delete a flaky test the same session.
* When you fix a bug, first write the test that would have caught it.

## Mobile & accessibility floor

* Everything operable on a 375 px-wide portrait phone with a thumb; touch targets ≥ 44 px.
* Controls keyboard-operable; gauges expose current values via ARIA (`role="meter"` or labelled text).
* Respect `prefers-reduced-motion` (needle damping stays, decorative animation stops).
* Layouts at 375 px, 768 px and 1280 px are checked by `e2e/layout.spec.ts`: 44 px targets, no horizontal scroll, no overlapping controls, every spec control rendered. Whether a layout is actually comfortable to use still needs the review loop.

## Session workflow

1. Pick one `docs/BACKLOG.md` item (or the slice Dek names). Restate it in one sentence before starting.
2. Skim the relevant part of `ARCHITECTURE.md` and any `docs/decisions/` record for the area; if reality has diverged from the doc, update the doc in the same session.
3. Implement (tests-first for sim; journey/fixture alongside UI). Run the checks the change warrants (see Commands); for UI changes, do the review step above.
4. Remove the finished item from `docs/BACKLOG.md`; add anything deferred to the backlog or the "needs Dek" list.
5. Summarise: what changed, what's demoable, which fixtures you reviewed and which renders/traces changed and why, open questions.

Commits: imperative, scoped, e.g. `sim: add draughting lift + prime states`, `ui: compound gauge dual scale`. Small commits over one mega-commit.

## When unsure

* **Physics/doctrine question** (a friction coefficient, standard branch flow, correct gauge behaviour): don't guess silently. Implement behind a `PLACEHOLDER` constant, add a row to `docs/CALIBRATION.md` under "needs Dek", and flag it in the summary. Dek is a systems/RF engineer with fire-service domain knowledge — precise questions get precise answers.
* **Design/scope question**: prefer the smaller interpretation that keeps the app demoable, and note the alternative.
* Never fabricate doctrine values and mark them confirmed.
