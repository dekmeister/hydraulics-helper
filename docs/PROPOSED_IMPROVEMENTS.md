# Proposed improvements

A review of how to make the project easier to update, more robust and more testable (2026-10-28, at `9c79cd6`). Proposals only: nothing here is decided. Items Dek accepts move to `docs/BACKLOG.md`; several already sit in its "Code health" section and are cross-referenced rather than restated.

**Baseline.** The foundations are sound: strict type-checked lint is clean, 1192 unit tests pass in ~50 s, sim purity is enforced by ESLint (`no-restricted-imports`, `Date.now`, `Math.random`, DOM globals), and the appliance-as-data design, contract suite, golden traces and review loop are the right shape. Keep the stack; nothing below needs a new dependency.

## 1. Outside the code (highest leverage)

### 1.1 Continuous integration

There is no `.github/` workflow, so `npm run verify` only runs when someone remembers to.

* Add a workflow running `npm run verify` on every push.
* Run Playwright inside the pinned `mcr.microsoft.com/playwright:v1.64.1` image: screenshot baselines are font- and OS-sensitive, and will drift between Dek's machine and anything else.
* Pin Node with `.nvmrc` (`package.json` only says `>=20.19`).

### 1.2 Screenshot baselines are bloating the repo

The git pack is 205 MB after 33 commits; `e2e/visual/__screenshots__` (62 MB on disk) appears in history 1345 times. Every UI change rewrites hundreds of PNGs across three viewports, and each new appliance multiplies the matrix. Options:

* Move `e2e/visual/__screenshots__` to Git LFS, or
* trim the matrix: phone and desktop for most fixtures, tablet only for fixtures about layout.

Worth settling before the next appliance (Cat 9) lands.

**Decided (2026-10-28): neither.** Baselines are rendered from a reference commit and never committed (`scripts/review-baseline.mjs`, `docs/TESTING.md` §5); LFS was rejected because the files are derivable and its bandwidth would be spent on every clone. Removing them from history is a separate, Dek-run `git filter-repo` rewrite.

## 2. Structural refactors

In priority order. All but the first are in `BACKLOG.md` "Code health".

1. **One list of returns to the tank.** Relief to tank, pump to tank and recirc are summed by hand in 7 non-test files (`network.ts`, `engine.ts`, `state/plumbing.ts`, `scenarios/trace.ts`, `testUtils.ts`, `create.ts`, `dryReadings`). This is the likeliest place for a silent physics bug: a new appliance's return gets added in five places and missed in two. Fold them into one `returns[]` with a single return-to-tank reading.
2. **Hydrant to tank as `tankInlets`, not `InletKind 'tankFill'`.** `'tankFill'` appears in 14 non-test files, many of them only to exclude it from pump-side sums. A separate field makes the exclusion structural instead of remembered.
3. **Per-truck inputs to `advance()`.** Unblocks AI support operators, scripted fill sequences and booster-failure lessons. It is an API change, so it gets dearer the longer it waits.
4. **`SimState` schema version** before anything saves or replays a game. A version from day one is cheap; a migration retrofitted after the first save isn't. The save must keep last tick's `linkReadings` (the closed-relay fit reads them).
5. **Split `store.ts`** into slices (routing, lesson, settings, sim), and move the `localStorage` write out of the `set` updater into a subscriber.

## 3. Robustness

### 3.1 Error boundary and tick-loop guard

There is no React error boundary. An exception in `store.step` (e.g. a lesson effect that throws because no delivery is free, see `BACKLOG.md`) repeats every frame and blanks the app. Catch it in the tick, end the lesson with the error, and leave the panel usable; wrap the screens in an error boundary with a "back to scenarios" way out. Write the failing test first (a lesson whose event effect throws).

### 3.2 PLACEHOLDER ↔ CALIBRATION consistency test

There are ~70 `PLACEHOLDER` markers across `sim/constants.ts`, `sim/appliances/cat1.ts` and `sim/appliances/cat7.ts`. A data-consistency test requiring each to cite a `docs/CALIBRATION.md` "Needs Dek" row (and each row to still have a marker, or be marked resolved) keeps the doctrine-question list from drifting from the code. Calibration is the stated credibility risk, so this is cheap insurance.

## 4. Easier to update

### 4.1 Keep the fast test loop fast

The cross-product tests are already the slowest files and grow multiplicatively with every appliance and support pairing:

| File | Time |
| --- | --- |
| `sim/scenarios/scenarios.test.ts` | ~41 s |
| `sim/appliances/contract.test.ts` | ~26 s |
| `testing/fixtures/sceneStates.test.ts` | ~25 s |
| `testing/fixtures/relayStates.test.ts` | ~22 s |
| `testing/fixtures/realisticStates.test.ts` | ~18 s |
| `sim/scenarios/ladder.test.ts` | ~17 s |

Move the full matrix to a `test:matrix` tier (as `test:e2e:full` does for journeys), keeping a representative slice in `npm run test` so the inner loop stays around 10 s. `verify` and CI run everything.

### 4.2 Thin `ARCHITECTURE.md`

It is ~470 lines of dense prose and is accreting into a changelog of decisions. Keep it as a 2–3 page overview (module map, the hard rules, the sim approach) and move the detail into short decision records (`docs/decisions/NNN-*.md`) or module header comments beside the code. Detail kept in one big file goes stale first, and every session pays to read it.

### 4.3 Oversized files

30 non-test source files exceed the ~200-line guideline. Split them opportunistically as they're touched for other work, not as a project of their own.

## Suggested order

1. CI (§1.1) and screenshot storage (§1.2).
2. Returns to the tank (§2.1).
3. Error boundary and tick guard (§3.1), PLACEHOLDER test (§3.2).
4. Test tiers (§4.1).
5. The remaining structural items (§2.2–2.5) before the next appliance or before save/replay, whichever comes first.
