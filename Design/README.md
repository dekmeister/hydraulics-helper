# Pump operator training game: design handoff

This package holds the visual language and the first realistic layout for the fireground pump operation game (TypeScript / React / Vite). It is written for Claude Code: start here, then read `DESIGN_SPEC.md`. Check `OPEN_DECISIONS.md` before building anything it lists.

## What is in the box

| Path | What it is | How to use it |
|---|---|---|
| `DESIGN_SPEC.md` | The full written spec: principles, tokens, gauges, the Wake, controls, fault states, scene rules, realistic layouts, accessibility, motion | The authority. If a picture and the spec disagree, the spec wins and the disagreement is a bug to report. |
| `OPEN_DECISIONS.md` | Things not yet decided, with the options | Do not build past these without asking the owner. |
| `tokens/tokens.json` | Design tokens (colour, type, line, spacing, touch, motion, hose styles) | Source of truth. `tokens.css` (CSS custom properties) and `tokens.ts` (typed `as const` object) are generated from it. Regenerate rather than hand-editing. |
| `layouts/schema.ts` | Data model for truck layouts: zones, items, roles, sim bindings | Copy into the codebase. Every truck type is one `TruckLayout`. |
| `layouts/layout-a.json` | Layout A: the rear pump bay from the reference photo, 29 items in 5 zones | Drives both the realistic bay view and the simplified panel. 9 items are flagged `assumed: true`. |
| `reference-impl/` | `gaugeScale.ts` (pure geometry), `dials.ts` (presets), `wake.ts` (Wake buffer), `Gauge.tsx` (React SVG component), `gauge.css` (motion), `gaugeScale.test.ts` | Working reference code. Adapt it to the codebase's conventions rather than pasting it in blind. |
| `sheets/png/` | Rendered images of the 8 design sheets | Visual reference. **Rendered with substitute fonts** (see below). |
| `sheets/html/` | Each sheet as a standalone HTML page (loads the real fonts from Google Fonts) | Open in a browser for the true look. Plain HTML + inline SVG: the SVG can be lifted directly. |
| `sheets/svg/` | Standalone SVG for the scene map and section (06), the bay (07) and the panel close-up (08), with their label overlays as separate files | Reference art for drawing those views as components. Coordinates match `layout-a.json`. |
| `sheets/source-dc/` | The original design-canvas source files (`.dc.html` + `canvas.json`) | Archive only. They need the canvas runtime to render; use `sheets/html/` instead. |
| `brief/` | The original design brief and the reference photo of the real pump bay | Context. |

### The 8 sheets

1. **Foundations:** named colours, materials, type, line weights, light direction, spacing, touch and focus.
2. **Gauge system:** gauge anatomy with proportions, the component API, rendered sizes, variants (compound, tachometer, mini, tank level).
3. **Controls:** delivery valve, tank-to-pump valve, throttle (T-handle variant), primer and warning lamp, each in default, active, disabled and warning states.
4. **The Wake:** the signature visual device, plus the four fault states (cavitation, low water, overheat, over-pressure), each with a panel cue and a scene cue.
5. **Phone comp:** the simplified pump panel at 375 px, with the scene stacked on top.
6. **Tablet comp:** the scene view at 1024 px, a plan view with contours plus a hydraulic section along line 1.
7. **Rear pump bay, layout A:** the realistic elevation from the reference photo, with zone/ID callouts (the callouts can be toggled off).
8. **Instrument panel, layout A:** close-up of zone C, keeping the real arrangement but enlarged so it can be read.

## Suggested build order

1. **Tokens.** Copy `tokens/tokens.css` and `tokens/tokens.ts` into the app. Install fonts locally rather than hot-linking:
   `npm i @fontsource/barlow-condensed @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`, importing weights 500/600/700, 400/500/600 and 400/500 respectively.
2. **Gauge.** Port `reference-impl/` and keep the tests. Wire `WakeBuffer` to sim time, not wall-clock time, so pause and replay behave correctly.
3. **Layout model.** Add `layouts/schema.ts` and load `layout-a.json`. Key game logic off `role` and `sim`, never off `id` or position. That keeps truck types interchangeable.
4. **Controls.** Build the quarter-turn lever valve, vernier throttle knob, primer, key switch and lamps per spec §5. Each needs a real input element for keyboard and screen readers (spec §9).
5. **Realistic bay view (sheet 07).** Render it from `layout-a.json` positions, using `sheets/svg/07-bay-layout-a.svg` as the art reference. Tapping zone C zooms into the panel close-up (sheet 08).
6. **Simplified panel (sheet 05) and scene (sheet 06).** These wait on OPEN_DECISIONS #1 (colour identity) and #2 (outlet set).

## Status of the design

- **Final:** the visual language (palette roles, type, line/light rules), gauge geometry, the Wake, control interaction models, state styling, the fault-state cues and the layout data model.
- **Placeholder:** gauge zone thresholds and ranges, tank capacity, the hydraulic figures in the section view, and the operating-sequence placard text. These must come from the simulation model and the procedure being taught.
- **Under review:** the per-delivery identity colours, which conflict with the real-truck rule of blue for outlets and green for inlets (OPEN_DECISIONS #1).

## Fonts in the PNGs

The PNG previews were rendered offline with substitute fonts: TeX Gyre Heros Condensed for Barlow Condensed, Inter for IBM Plex Sans, DejaVu Sans Mono for IBM Plex Mono. Proportions are close but not exact. The HTML files use the real fonts.

## What was verified before handoff

- `reference-impl/` typechecks under `strict`, `noUnusedLocals` and `noUnusedParameters`, using a minimal React type shim because the real types weren't available offline. Expect to resolve minor type differences against real `@types/react`.
- All 9 unit tests in `gaugeScale.test.ts` pass: scale mapping, clamping, tick counts, arc maths, zone lookup, Wake band, ghosts and hunting detection.
- `Gauge.tsx` was rendered to SVG with a stub JSX runtime and screenshotted (`reference-impl/preview-rendered-gauges.png`). The output matches sheet 02.
- Every sheet was rendered at its frame size with no overflow.
- `layout-a.json` was checked for required fields, unique ids and roles, valid enums, positions inside the drawing, and valves carrying an inlet or outlet function.
