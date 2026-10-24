# CLAUDE.md — Pump Operator Training Game

Read `ARCHITECTURE.md` (design) and `PLAN.md` (current milestone) before writing code. This file is about *how* we work.

## Project one-liner

Browser game teaching NSW-style fire pump operation: interactive pump panel + scene overview, driven by a small, honest hydraulics sim. TypeScript + Vite + React + SVG + Zustand + Vitest. No backend, no RFS branding.

## Commands

```bash
npm run dev      # Vite dev server
npm run test     # Vitest (watch: npm run test -- --watch)
npm run lint     # ESLint + Prettier check
npm run build    # Type-check + production build
```

All four must pass before a session ends. If you break `dev`, fixing it takes priority over new features.

## Non-negotiable rules

1. **`src/sim/` is pure.** No imports from React, DOM APIs, Zustand, or `src/ui|state`. It's a deterministic library: `advance(state, inputs, dt) → state` on plain serialisable data. If you feel the urge to reach for `Date.now()`, `Math.random()`, or a DOM type inside `sim/`, stop — take time/randomness as parameters.
2. **Sim behaviour is tests-first.** New hydraulics behaviour starts with a failing Vitest case, preferably a worked example added to `docs/CALIBRATION.md`. No sim PR without tests.
3. **Physical constants live in `sim/constants.ts` only**, each with a comment stating the real-world figure it represents and its source status (`// doctrine-confirmed` or `// PLACEHOLDER — needs Dek`). Never inline a magic hydraulic number elsewhere.
4. **Units:** kPa, L/min, metres, seconds — everywhere, including variable names when ambiguous (`pressureKpa`, `flowLpm`). No PSI, no GPM, ever.
5. **Terminology is Australian fire-service:** deliveries (not discharges as a noun for outlets), branch (not nozzle, except for the orifice maths), draughting, compound gauge, tank-to-pump, appliance/truck. UI copy uses these terms; teaching correct vocabulary is part of the product.
6. **TypeScript strict; no `any`,** no non-null assertions without a comment justifying them. Exported sim functions get doc comments explaining the physics in one or two lines.
7. **No new dependencies without asking Dek.** The stack is deliberately small. State the problem and the candidate lib first.
8. **No RFS logos, names, or livery.** Generic rural fire aesthetic only.

## Code style & structure

* Functional React components + hooks; no class components.
* UI reads sim state via `state/selectors.ts`; writes only through `PlayerInputs` actions. Components never mutate sim state directly.
* SVG components take a `viewBox`-relative coordinate system; layout/scaling happens in the parent. One parameterised `Gauge`, not four bespoke gauges.
* Prefer small files (< ~200 lines). Prefer plain functions to classes in `sim/`.
* Naming: `PascalCase` components, `camelCase` functions/vars, `SCREAMING_SNAKE` constants.
* Comments explain *physics or intent*, not mechanics. A formula gets a one-line "why" and units.

## Testing expectations

* `sim/`: high coverage, calibration examples asserted to tolerance (`expect(p).toBeCloseTo(target, …)` with tolerance noted), determinism test, NaN/edge fuzz test.
* UI: light — a render smoke test per panel and interaction tests for tricky controls (valve drag). Don't chase coverage in UI code.
* When you fix a bug, first write the test that would have caught it.

## Mobile & accessibility floor

* Everything operable on a 375 px-wide portrait phone with a thumb; touch targets ≥ 44 px.
* Controls keyboard-operable; gauges expose current values via ARIA (`role="meter"` or labelled text).
* Respect `prefers-reduced-motion` (needle damping stays, decorative animation stops).
* Test layouts at 375 px, 768 px, 1280 px before finishing UI work.

## Session workflow

1. Pick one `PLAN.md` checklist item (or the slice Dek names). Restate it in one sentence before starting.
2. Skim the relevant `ARCHITECTURE.md` section; if reality has diverged from the doc, update the doc in the same session.
3. Implement (tests-first for sim). Run `test`, `lint`, `build`.
4. Tick the checklist item in `PLAN.md`; add anything deferred to the parking lot or "needs Dek" list.
5. Summarise: what changed, what's demoable, open questions.

Commits: imperative, scoped, e.g. `sim: add draughting lift + prime states`, `ui: compound gauge dual scale`. Small commits over one mega-commit.

## When unsure

* **Physics/doctrine question** (a friction coefficient, standard branch flow, correct gauge behaviour): don't guess silently. Implement behind a `PLACEHOLDER` constant, add a row to `docs/CALIBRATION.md` under "needs Dek", and flag it in the summary. Dek is a systems/RF engineer with fire-service domain knowledge — precise questions get precise answers.
* **Design/scope question**: prefer the smaller interpretation that keeps the app demoable, and note the alternative.
* Never fabricate doctrine values and mark them confirmed.
