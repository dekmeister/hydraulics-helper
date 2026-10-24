# Testing — strategy, harness and the Claude review loop

Companion to `ARCHITECTURE.md` and `CLAUDE.md`. This describes **what** gets tested at which layer, the **test hooks** the app exposes, and the **review loop** that lets Claude check rendered output without driving a browser by hand.

## 1. Principles

* **End-to-end where it counts.** The game is only correct if a player's thumb on a valve moves the right needle. So the main UI tests drive the *built app* in a real browser with real pointer, touch and keyboard input, and check what is shown on screen.
* **Pure where possible.** Anything that doesn't need a browser (sim, selectors, layout↔spec data, scenario loading) is tested in Vitest under Node: milliseconds, no flakiness.
* **Text before pixels.** Every rendered check that *can* be a number or a string is one: gauge values via ARIA, layout via bounding boxes, structure via accessibility-tree snapshots. Screenshots are the last layer and catch what text can't (clipping, overlap, a needle drawn at the wrong angle, ugly).
* **Deterministic or it doesn't count.** No wall clock, no unseeded randomness, no animation in any test that compares output. A flaky test gets fixed or deleted the same session.
* **A scripted loop, not manual browsing.** Claude does not use the Chrome extension or click around a dev server to check UI work. It runs one command and reads the files it writes (§6). Manual browsing is for exploration when Dek asks for it.
* **Coverage follows the appliance catalogue.** Rendered tests use `describe.each` over every registered appliance, just like the sim contract suite (CLAUDE.md rule 9). Adding an appliance gets you its screenshots and layout checks with no extra work.

## 2. Layers

| # | Layer | Tool | Location | Proves |
|---|---|---|---|---|
| 1 | Sim unit + calibration | Vitest (node) | `src/sim/**/*.test.ts` | Physics formulas; `docs/CALIBRATION.md` worked examples to tolerance |
| 2 | Appliance contract suite | Vitest `describe.each` | `src/sim/appliances/contract.test.ts` | Determinism, NaN fuzz, runs-dry, cavitation, priming — every appliance |
| 3 | Scenario golden traces | Vitest `toMatchFileSnapshot` | `src/sim/scenarios/__traces__/*.csv` | Behaviour over a scripted multi-minute run; diffs as readable CSV |
| 4 | Data consistency | Vitest | next to the data | Layout ↔ spec one-to-one; inputs keyed by real control ids; scenario loader rejects missing capabilities; fixture registry valid |
| 5 | Browser journeys | Playwright (Chromium) | `e2e/journeys/*.spec.ts` | Real input → store → sim → rendered instruments, on the built app |
| 6 | Layout invariants | Playwright | `e2e/layout.spec.ts` | Mobile floor checked by code: 44 px targets, no horizontal scroll, no overlapping controls, every spec control rendered |
| 7 | Visual baselines + review bundle | Playwright `toHaveScreenshot` + custom reporter | `e2e/visual/*.spec.ts`, `e2e/review/` | Pixel regressions; images + expectations for Claude to review |

There is **no jsdom / React Testing Library layer**. Light component tests ("render smoke test per panel", "valve drag") run in Playwright against a real browser, where pointer events, SVG geometry and layout are real. That saves two dependencies and a whole class of "works in jsdom, broken in Chrome" bugs.

### Layer 3 — golden traces

A trace test runs a scenario with a scripted input timeline (`t=0 open tank-to-pump; t=5 open delivery d1 to 100 %; t=10 throttle 0.6; …`) through `advance()` at 10 Hz and writes a CSV sampled once a second. Columns come from the spec's ids (`dischargeKpa`, `compoundKpa`, `rpm`, `tankL`, `flowLpm.<deliveryId>`, …), so a second appliance gets its own columns with no code change.

* Snapshot is compared with `expect(csv).toMatchFileSnapshot('__traces__/<scenario>.<applianceId>.csv')`.
* A changed trace shows up as a line-by-line numeric diff that Claude can read and explain ("discharge 20 kPa lower from t=12 because the 38 mm friction coefficient changed").
* `npm run sim:trace -- <scenario> [appliance]` prints the same table to the terminal (this is the M1 headless demo).
* Traces catch *drift*; calibration tests (layer 1) state *correctness*. A failing calibration test is never "fixed" by updating a snapshot.

## 3. Test hooks in the app

Rendered tests need determinism and a way in. Both live in `src/testing/`, which is **only bundled in the `e2e` build mode** (`vite build --mode e2e` sets `VITE_E2E=true`; production builds tree-shake it out).

### 3.1 `window.__pumpops`

```ts
interface PumpOpsTestApi {
  /** Load a scenario (or a raw SimState) with a fixed RNG seed. Pauses the real-time loop. */
  load(opts: { scenario?: string; appliance?: string; state?: SimState; seed?: number }): void;
  /** Advance the sim N fixed ticks (100 ms each) synchronously. Wall clock is ignored. */
  step(ticks: number): void;
  /** Snap damped needles/animations to their targets so a screenshot is stable. */
  settle(): void;
  /** Serialisable snapshot for assertions. */
  getState(): SimState;
}
```

* In e2e mode the real-time `requestAnimationFrame` accumulator is **off**. Time moves only when a test calls `step()`. A journey that needs 30 s of sim time calls `step(300)`: fast and exact.
* There is deliberately **no `setInputs`** on the API. Journeys must change inputs through the real controls; that is the point of a journey. Visual fixtures that need a particular input state get it from scenario data or a `state` blob (§3.2).
* Randomness (cavitation gauge flutter, events) comes from a seeded RNG passed into the sim (CLAUDE.md rule 1), so `seed` makes noisy states reproducible.

### 3.2 Fixture gallery (`?fixture=<id>`)

A dependency-free "storybook": `src/testing/fixtures/` holds a registry of named render states. `/?fixture=gauge/compound-vacuum` renders just that state, full-screen, nothing else.

```ts
interface Fixture {
  id: string;                       // 'gauge/compound-vacuum', 'panel/cat1-generic/tank-attack-700'
  render: () => JSX.Element;        // component + props, or the full app shell with a loaded state
  steps?: number;                   // sim ticks to run before capture
  expect: string;                   // what a reviewer should see — goes into the review report
  viewports?: ViewportName[];       // default: all three
}
```

* Panel and scene fixtures are **generated per catalogue appliance** (`panel/<applianceId>/idle`, `…/tank-attack-700`, `…/tank-low`, `…/cavitating`), so a new appliance gets them automatically.
* The visual spec is one `describe.each` over the registry × viewports: **adding a fixture = adding a screenshot.**
* `expect` is plain English, written for review: *"Discharge needle at ~700 kPa, compound ~0 kPa, tank gauge ~¾, delivery 1 handle fully open, others closed. No warnings."*

### 3.3 Markup conventions the tests rely on

* Every instrument is `role="meter"` with an accessible name and `aria-valuenow` = displayed (damped) value in its native unit (kPa, L, rpm). Journeys assert readings with `getByRole('meter', { name: 'Discharge' })`, never by measuring needle pixels.
* Every control is a `button`, `slider` or `switch` with an accessible name taken from the layout label (Australian terminology — rule 5, so tests double as a vocabulary check).
* Controls use **Pointer Events only** (no separate touch/mouse handlers), so a Playwright mouse drag exercises the same code path as a finger. Taps are tested with `locator.tap()` in the touch-enabled phone project.
* `data-testid` only where no role/name fits (e.g. scene hose lays: `data-testid="hose-lay-d1"`, keyed by spec id).

## 4. Playwright setup

* **One browser: Chromium**, from Playwright's pinned download (`npx playwright install chromium`, no sudo; if system libraries are missing, Dek runs `sudo npx playwright install-deps chromium`). Baselines are only valid for that pinned browser and this OS; `@playwright/test` is pinned to an exact version and upgraded deliberately (that upgrade will refresh baselines).
* **Target:** `vite build --mode e2e` + `vite preview` on a fixed port, started by Playwright's `webServer`. Testing the built app catches production-only issues and avoids HMR noise. `reuseExistingServer` keeps the local loop fast.
* **Projects (viewports):**

  | Project | Viewport | Notes |
  |---|---|---|
  | `phone` | 375 × 812 | `hasTouch`, `isMobile`: the baseline constraint |
  | `tablet` | 768 × 1024 | `hasTouch`; just below the side-by-side breakpoint |
  | `desktop` | 1280 × 800 | mouse + keyboard |

* **Stability settings for screenshots:** `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`, `toHaveScreenshot({ animations: 'disabled', caret: 'hide' })`, a self-hosted font file in the repo (no network fonts), `await document.fonts.ready`, then `__pumpops.settle()` before capture. Default tolerance `maxDiffPixelRatio: 0.002`; tighten per test if needed, never loosen to make a test pass.
* **Shared test fixture** (`e2e/fixtures.ts`): every test fails on any `console.error`, `pageerror` or failed request. It also attaches the page's ARIA snapshot and the `__pumpops.getState()` readouts to the test result for the review bundle.
* `fullyParallel: true`. Budget: the whole Playwright run (`test:e2e` + `review`) under ~60 s locally. If it gets slower, trim fixtures before adding hardware.

### Layout invariants (layer 6)

Run in every project, over the app shell and every panel fixture:

1. Every interactive element (`button`, `slider`, `switch`, `link`) has a bounding box ≥ 44 × 44 CSS px.
2. `document.documentElement.scrollWidth <= window.innerWidth`, so no horizontal page scroll.
3. No two interactive elements' boxes intersect.
4. Every control and instrument in the appliance spec is rendered exactly once (counted by accessible name / `data-testid` from the layout data), and each is reachable: inside the viewport or inside a scroll/swipe container that can bring it in.
5. Keyboard: tabbing visits every control; arrow keys change a focused slider.

This turns "test layouts at 375 / 768 / 1280 px" from a manual step into a failing test.

### Journeys (layer 5)

Each journey plays a lesson as a player would, at the `phone` project at minimum. Examples:

* **Tank attack:** load scenario → tap tank-to-pump → drag delivery 1 valve open → drag throttle to ~60 % → `step(300)` → expect discharge meter within the scenario's band, tank meter lower than at start, no warnings. Open delivery 2 → `step(50)` → discharge has sagged.
* **Runs dry:** tank attack with a small tank → `step` until empty → warning strip shows the low-tank and then empty message; discharge collapses; nothing throws.
* **Valve drag precision:** drag to half-open and assert the slider value is in 0.45–0.55 and the sim input matches (`getState()`).

Assertions use tolerances that come from the calibration/scenario data, not new magic numbers in test files.

## 5. Visual baselines

* Baselines live in `e2e/visual/__screenshots__/` and **are committed**: they are the visual spec.
* A screenshot diff fails `npm run review` (and therefore `verify`). Playwright writes `expected`, `actual` and `diff` PNGs.
* **Updating baselines** (`npm run review -- --update-snapshots`, scoped with `-g <fixture>` where possible) is allowed only after Claude has looked at the new image (§6) and can say why the change is intended. The session summary lists every baseline that changed and why. Dek sees the PNG changes in `git diff --stat` / their git client before committing.
* Baselines go stale for legitimate reasons, such as Dek supplying a doctrine figure that moves a needle. Regenerate in the same session as the change, never as a separate "fix the tests" step.

## 6. The Claude review loop

The goal is a fast loop that gives Claude **text first and only the images that matter**, so it can actually check rendering rather than trusting a green tick.

`npm run review` runs the visual spec with a custom reporter (`e2e/review/reporter.ts`, no extra dependency) that writes a gitignored bundle:

```
review/
  report.md                 # start here
  sheets/<fixture>.png      # contact sheet: the fixture at phone | tablet | desktop, labelled, one image
  shots/<project>/<fixture>.png
  diffs/<project>/<fixture>.png   # only when the baseline differs: expected | actual | diff, side by side
```

`report.md` is ordered for triage:

1. **Failures**: test errors, console errors, layout-invariant failures (text, with the failing element names).
2. **Changed**: fixtures whose screenshot differs from baseline, with % pixels changed, the path to the diff image and the contact sheet.
3. **New**: fixtures with no baseline yet.
4. **Unchanged**: one line per fixture (name only).

Each changed/new entry carries the fixture's `expect` caption, the instrument readings from `getState()`/ARIA (e.g. `Discharge 702 kPa · Compound 4 kPa · Tank 2 870 L`), and a trimmed ARIA snapshot. Claude compares *what it should see* with *what was rendered* in one place.

Contact sheets and diff composites are made by Playwright itself: the reporter writes a small HTML grid and screenshots it. That avoids an image-processing dependency, and each review costs one image read per fixture instead of three.

### What Claude does with it

1. `npm run test` and `npm run test:e2e`. Fix anything red from the text output first.
2. `npm run review`, then read `review/report.md`.
3. For every **changed** or **new** entry, Read the contact sheet (and the diff image if changed). Check it against its `expect` caption and this checklist:
   * needles point where the readings say (a 700 kPa reading on a 0–1600 face is a little under half-sweep);
   * nothing clipped, overlapping, or off-canvas at 375 px; labels legible;
   * labels use Australian terminology (deliveries, branch, compound gauge, tank-to-pump);
   * warning strip matches the state; no RFS branding or livery;
   * at 375 px the layout is clearly thumb-operable, not just technically ≥ 44 px.
4. Don't open unchanged shots unless the work was a visual change that *should* have altered them. "Expected change but unchanged" is a bug too.
5. In the session summary, state which fixtures were reviewed, what was seen, and which baselines were updated and why.

When a UI change has no fixture that shows it, add one. That's how the gallery grows.

## 7. Commands

| Command | Runs | When |
|---|---|---|
| `npm run test` | Vitest: layers 1–4 | Constantly; `-- --watch` while doing sim work |
| `npm run sim:trace -- <scenario> [appliance]` | Prints a trace table | Exploring sim behaviour |
| `npm run test:e2e` | Playwright journeys + layout invariants (no pixel compare) | Any UI change |
| `npm run review` | Visual baselines + review bundle in `review/` | Any change that could affect rendering |
| `npm run verify` | lint → test → build → test:e2e → review | Must pass before a session ends |

## 8. Dependencies

* `@playwright/test`, exact-pinned: the only addition this strategy needs. It brings browser automation, screenshot diffing, ARIA snapshots, viewport/touch emulation and the reporter API, which together replace jsdom, React Testing Library, Storybook, pixelmatch and an image library.
* **Not adopted / ask Dek first:** `@axe-core/playwright` (automated WCAG audit; worth adding once M2 has real controls), WebKit project (closest to iOS Safari, but needs extra system packages), Vitest browser mode (overlaps Playwright).

## 9. Out of scope (for now)

* Cross-browser pixel baselines. Chromium only; a non-pixel WebKit/Firefox smoke run may come later.
* Audio. Test the *state* that drives audio (cavitating, primer running), not the sound.
* Performance. Revisit if the scene panel gets animated enough to matter (ARCHITECTURE §2).
