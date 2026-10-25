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
| 4 | Data consistency | Vitest | next to the data | Layout ↔ spec one-to-one; inputs keyed by real control ids; scenario loader rejects missing capabilities and unresolvable lessons; every ladder scenario passed cleanly by the scripted operator on every appliance (`scenarios/ladder.test.ts`); fixture registry valid |
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

Rendered tests need determinism and a way in. Both live in `src/testing/`, which is **only bundled in the `e2e` build mode** (`npm run build:e2e` = `vite build --mode e2e --outDir dist-e2e`; `vite.config.ts` statically defines `import.meta.env.VITE_E2E` from the mode, so production builds tree-shake it out). `npm run build` runs `scripts/check-prod-bundle.mjs`, which fails if `__pumpops` or fixture code appears in `dist/`.

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
  /** The lesson's progress (objectives, coach, status), or null in free play. Read-only. */
  getLesson(): LessonProgress | null;
}
```

* `load({ scenario, appliance, support, seed, lesson: true })` starts the scenario's **lesson** (objectives, coach, dock) instead of free play. Without `lesson`, every load is free play, as before M6. The real app opens on the scenario menu; any `load` shows the panels.

* In e2e mode the real-time `requestAnimationFrame` accumulator is **off**. Time moves only when a test calls `step()`. A journey that needs 30 s of sim time calls `step(300)`: fast and exact.
* There is deliberately **no `setInputs`** on the API. Journeys must change inputs through the real controls; that is the point of a journey. Visual fixtures that need a particular input state get it from scenario data or a `state` blob (§3.2).
* Randomness (cavitation gauge flutter, later events) comes from seeded RNG streams, one per truck in `TruckState.rngState` (CLAUDE.md rule 1); `load({ seed })` restarts them (`reseed`), so noisy states are reproducible. `load({ scenario, appliance, support })` puts every support truck of a relay scenario on the `support` appliance.

### 3.2 Fixture gallery (`?fixture=<id>`)

A dependency-free "storybook": `src/testing/fixtures/` holds a registry of named render states. Metadata (`id`, `expect`, `steps`, `viewports`) lives in `catalog.ts` as plain data so Playwright specs can enumerate fixtures without importing React; the render functions live in `renderers.tsx`, keyed by the same ids (a Vitest test keeps the two one-to-one). `/?fixture=gauge/compound-vacuum` renders just that state, full-screen, nothing else.

```ts
interface Fixture {
  id: string;                       // 'gauge/compound-vacuum', 'panel/cat1-generic/tank-attack-700'
  render: () => JSX.Element;        // component + props, or the full app shell with a loaded state
  steps?: number;                   // sim ticks to run before capture
  expect: string;                   // what a reviewer should see — goes into the review report
  viewports?: ViewportName[];       // default: all three
}
```

* A renderer may supply a `state()`: the sim state loaded into the store before render (`renderers.tsx`). Panel states are built from the tank-attack scenario by pure sim calls (`panelStates.ts`); `tank-attack-700` finds its throttle by bisection so its caption holds on any appliance.
* Panel and scene fixtures are **generated per catalogue appliance** (`panel/<applianceId>/idle`, `…/tank-attack-700`, `…/tank-low`, `…/tank-empty`; `scene/<applianceId>/all-charged`, `…/one-line-off`, `…/tank-low`, `…/tank-empty`, `…/highlighted`), so a new appliance gets them automatically. `surface` in the catalog says whether a fixture renders the whole shell or the scene alone; a renderer may also set a `highlight` after its state loads. Scene states are built next to the panel states (`panelStates.ts`, `sceneState`). Source and fault fixtures (`panel/<applianceId>/draught-priming`, `…/draught-working`, `…/cavitating`, `…/hydrant`, `…/faults`) are generated for every catalogue appliance that can play the scenario they come from (`sourceStates.ts`); `draught-priming` needs a primer control. `cavitating` sets `steps` so the store has 3 s of history for the Wake. Relay fixtures (`relay/<applianceId>/closed-working`, `…/closed-over-run`, `…/burst`, `…/open-dam`, `…/base-panel`, and `relay/<applianceId>/with-test-2d/closed-working` with the test appliance as base pump) are built from the relay scenarios in `relayStates.ts`; `relayStates.test.ts` holds each caption's promises (lamps, relay state, residual) on every spec pair. A renderer names its `scenario`, so the header picker shows it.
* Menu, lesson and debrief fixtures (`menu/fresh`, `menu/progress`, `lesson/<applianceId>/guided`, `…/incident`, `debrief/<applianceId>/passed`, `…/failed`) render the whole app (`AppRoot`). Their store states are built by playing lessons with the scripted operator (`lessonStates.ts`, captions held by `lessonStates.test.ts`) and applied by the renderer's `setup()`. Lesson fixtures set `capture: 'viewport'`: the dock is fixed to the viewport, so a full-page shot would draw it over the middle of the page; the viewport shot is what the player sees, at the scroll the coach chose. Every other fixture is a full-page shot from the top.
* The visual spec is one `describe.each` over the registry × viewports: **adding a fixture = adding a screenshot.**
* `expect` is plain English, written for review: *"Discharge needle at ~700 kPa, compound ~0 kPa, tank gauge ~¾, delivery 1 handle fully open, others closed. No warnings."*

### 3.3 Markup conventions the tests rely on

* Every instrument is `role="meter"` with an accessible name and `aria-valuenow` = displayed (damped) value in its native unit (kPa, L, rpm). Journeys assert readings with `getByRole('meter', { name: 'Discharge' })`, never by measuring needle pixels.
* Every control is a `button`, `slider` or `switch` with an accessible name taken from the layout label (Australian terminology — rule 5, so tests double as a vocabulary check).
* Controls use **Pointer Events only** (no separate touch/mouse handlers), so a Playwright mouse drag exercises the same code path as a finger. Taps are tested with `locator.tap()` in the touch-enabled phone project. Plain buttons that only act on a tap (scene hoses, legend rows, the panel's delivery-row locate buttons) use `onClick`, which a tap and a click both fire; anything dragged uses Pointer Events.
* `data-testid` only where no role/name fits, keyed by spec id: scene hose lays `hose-lay-<deliveryId>` (with `data-state="charged|dry"`, `data-highlighted` and `data-cavitating`), `spray-<deliveryId>`, `branch-<deliveryId>`, `coupling-<controlId>` (deliveries and suction inlets), `supply-lay-<inletId>` (`data-state="primed|dry|charged|soft"`), `scene-hydrant`, `scene-tank` (`data-level`), `relay-lay-<linkId>` (`data-state="charged|dry|soft|burst"`), `relay-burst-<linkId>`, `portable-dam-<sourceId>` (`data-level`), `truck-tap-<truckId>` (a truck the player isn't operating). Delivery and inlet ids repeat between trucks, so each truck's scene elements sit in groups marked `data-truck` and `data-truck-active`; `e2e/scene.ts` scopes `hoseLay` and `spray` to the active truck. The legend's relay rows carry `data-relay`, portable-dam rows `data-dam`, and the pump panel header's truck switcher is a group "Truck you operate" of buttons with `aria-pressed`. The realistic bay's watered pipes and pump carry `data-water="flowing|still|empty"` and `data-water-ref` (`waterRefKey`: `tank`, `casing`, `casing:d2+d3`, `inlet:<id>:source|pump`, `delivery:<id>`, `pumpToTank`). Gauges carry `data-alert` (amber needle) and the primer's wrapper `data-state` (`idle|running|check-suction|primed|cut-out`). Journeys tap a hose at a point on its path (`e2e/scene.ts` `tapHoseLay`), since a curved path's box centre is rarely on the hose.
* The scene map is `role="img"`; its legend buttons ("Show Delivery 1 on panel") and the panel's delivery-row buttons ("Show Delivery 1 on scene", `aria-pressed`) are the accessible route to the correspondence.

## 4. Playwright setup

* **One browser: Chromium**, from Playwright's pinned download. On a machine whose preinstalled Chromium doesn't match the pinned Playwright (e.g. a cloud container, where `/opt/pw-browsers/chromium_headless_shell-<build>/chrome-headless-shell-linux64/chrome-headless-shell` works), set `PW_CHROMIUM_EXECUTABLE` to that browser; screenshots taken with a different build may need their baselines checked (`npx playwright install chromium`, no sudo; if system libraries are missing, Dek runs `sudo npx playwright install-deps chromium`). Baselines are only valid for that pinned browser and this OS; `@playwright/test` is pinned to an exact version and upgraded deliberately (that upgrade will refresh baselines).
* **Target:** `npm run build:e2e` + `vite preview --outDir dist-e2e` on fixed port 4317 (`--strictPort`), started by Playwright's `webServer`. Testing the built app catches production-only issues and avoids HMR noise. The server is always rebuilt (`reuseExistingServer: false`): the e2e build takes under a second, and reusing a running server risks testing a stale bundle.
* **Configs:** `playwright.base.ts` holds the shared server and projects; `playwright.config.ts` (`test:e2e`) runs everything except `e2e/visual/`; `playwright.review.config.ts` (`review`) runs only `e2e/visual/` with the review reporter and `updateSnapshots: 'none'`, so a missing baseline fails as **New** instead of being written silently.
* **Projects (viewports):**

  | Project | Viewport | Notes |
  |---|---|---|
  | `phone` | 375 × 812 | `hasTouch`, `isMobile`: the baseline constraint |
  | `tablet` | 768 × 1024 | `hasTouch`; just below the side-by-side breakpoint |
  | `desktop` | 1280 × 800 | mouse + keyboard |

* **Stability settings for screenshots:** `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`, `toHaveScreenshot({ animations: 'disabled', caret: 'hide' })`, a self-hosted font file in the repo (no network fonts), `await document.fonts.ready`, then `__pumpops.settle()` before capture. Default tolerance `maxDiffPixelRatio: 0.002`; tighten per test if needed, never loosen to make a test pass.
* **Shared test fixture** (`e2e/fixtures.ts`): every test fails on any `console.error`, `pageerror` or failed request (a smoke test proves this with `test.fail()` on an unknown fixture). It also attaches the page's ARIA snapshot and the `__pumpops.getState()` readouts to the test result for the review bundle.
* Layout invariant helpers are in `e2e/invariants.ts`; the side-by-side breakpoint comes from `src/ui/layout/breakpoints.ts` (`SIDE_BY_SIDE_MIN_PX`) and is checked at exactly that width and one pixel below.
* `fullyParallel: true`. Budget: the whole Playwright run (`test:e2e` + `review`) under ~60 s locally. If it gets slower, trim fixtures before adding hardware.

### Layout invariants (layer 6)

Run in every project, over the app shell and every generated panel and scene fixture:

1. Every interactive element (`button`, `slider`, `switch`, `link`) has a bounding box ≥ 44 × 44 CSS px.
2. `document.documentElement.scrollWidth <= window.innerWidth`, so no horizontal page scroll.
3. No two interactive elements' boxes intersect, except an element in the lesson dock (`[data-dock]`, fixed over the page) against one in the page: instead, the page must reserve at least the dock's height at its foot (`expectDockReserved`), so every control can be scrolled clear of it.
4. Every control and instrument in the appliance spec is rendered exactly once (counted by accessible name / `data-testid` from the layout data), and each is reachable: inside the viewport or inside a scroll/swipe container that can bring it in.
5. Keyboard: tabbing visits every control (including the scene↔panel locate buttons); arrow keys change a focused slider.
6. Scene: one legend button per delivery of the truck operated, one hose lay per laid line (on its own truck) and one relay hose per relay.

The menu and a lesson in play (`first-line`, and `incident` with its objective list open) get invariants 1–4 too (`menu and lesson layout invariants`).

This turns "test layouts at 375 / 768 / 1280 px" from a manual step into a failing test.

### Journeys (layer 5)

Helpers in `e2e/panel.ts` drive the real controls (`dragValve` sweeps around the lever's `data-part="pivot"`, `dragThrottle` moves the `data-part="handle"` along the `data-part="track"`), find names from the layout data, and `stepAndSettle()` before reading meters. Journeys run over every catalogue appliance.

Each journey plays a lesson as a player would, at the `phone` project at minimum. Examples:

* **Tank attack:** load scenario → tap tank-to-pump → drag delivery 1 valve open → drag throttle to ~60 % → `step(300)` → expect discharge meter within the scenario's band, tank meter lower than at start, no warnings. Open delivery 2 → `step(50)` → discharge has sagged.
* **Runs dry:** tank attack with a small tank → `step` until empty → warning strip shows the low-tank and then empty message; discharge collapses; nothing throws.
* **Scene (M3 demo):** open both lines → both hose lays charged and spraying; drag one delivery shut → that line goes dry and stops spraying, the other keeps going. Tank runs out → every line dry. Tap a hose → its panel row is highlighted and in view; tap a panel row's locate button → its hose is highlighted and the scene in view.
* **Draughting (M4 demo):** open the suction inlet, hold the primer (pointer down while `step()` runs) until it shows PRIMED, compound at −10 kPa per m of lift; open a line and throttle → water and no warnings; second line, throttle wide → cavitation lamp, amber compound needle, gapped hoses; four vernier steps back → same discharge and flow at lower rpm (the throttle did nothing); drag back to 60 % → recovered. Also hydrant over-run (compound ≈ 0 within the flutter, layflat soft), churn overheat and cooling by cracking a delivery, water hammer from `Home` on an open delivery, and the vacuum test.
* **Relays (M5 demo):** closed relay: open the relay inlet and both lines, residual above 100 kPa with no lamps; full throttle over-runs the relay (compound ≈ 0, hose soft, SUPPLY "Relay residual low"); back to 60 % recovers. Tap the relay inlet shut (the shutdown spike) and the relay hose bursts. Switch to the base pump by tapping it on the map (test appliance as base: its own panel, the relay delivery described and open), ease its throttle, switch back with the switcher; the base pump holds its throttle. Open relay: prime on the portable dam, watch the relay fill it, then draw it down with both lines. The keyboard pass reaches the switcher and switches with Enter.
* **Lessons (M6 demo, `e2e/journeys/lessons.spec.ts`, phone):** scenario 1 guided from the menu by the coach on every journey appliance (Got it, tap tank-to-pump, drag the delivery, throttle to ~700 kPa, hold the branch in band with the vernier, throttle to idle, ease the delivery shut in steps; debrief shows the pass, no water hammer); scenarios 2 and 3 unassisted, the journey closed-loop on what the branches and compound show but acting only through the controls (vernier presses, a fine valve drag that overshoots and comes back inside one gesture, as a thumb must to beat the drag threshold), then the debrief's Next scenario; the menu shows 2 and 3 passed after a reload; the incident's events (crew uphill: radio call, the branch now short; second line laid on the scene); the sound setting kept across visits. The keyboard pass starts a lesson from the menu and works the coach's Got it.
* **Valve drag precision:** drag to half-open and assert the slider value is in 0.45–0.55 and the sim input matches (`getState()`).

Assertions use tolerances that come from the calibration/scenario data, not new magic numbers in test files.

## 5. Visual baselines

* Baselines live in `e2e/visual/__screenshots__/` and **are committed**: they are the visual spec.
* A screenshot diff fails `npm run review` (and therefore `verify`). Playwright writes `expected`, `actual` and `diff` PNGs.
* `maxDiffPixelRatio: 0.002` is relative to the whole page, so a small change (e.g. one heading's font size) can stay under it at 1280 px while failing at 375 px. If a change *should* show at every viewport and the report says unchanged there, treat that as a finding (§6 step 4).
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
* Audio. Test the *state* that drives audio (`src/audio/params.test.ts`: pitch and levels from rpm, primer, cavitation, flow), not the sound. The synth never starts in the e2e build.
* Performance. Revisit if the scene panel gets animated enough to matter (ARCHITECTURE §2).
