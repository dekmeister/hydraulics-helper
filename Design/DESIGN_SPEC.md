# Design spec: pump operator training game

Section references such as "sheet 02" point to `sheets/png/` and `sheets/html/`. Token names refer to `tokens/tokens.json`.

## 1. Principles

- **Reference feeling:** a beautifully drawn equipment manual that came alive. Instructions and coaching sit on paper (`material.paper`) in ink. The instrument is dark ironbark metal (`material.ironbark`). The subject is water and machinery; fire appears only as glow and smoke at the edges of the scene.
- **Instrument-grade legibility first.** A player must be able to read a needle at a glance on a phone in sunlight.
- **Tactile and mechanical.** Drag controls always draw their travel path; tap controls always show a raised cap. The player should know which gesture a part wants before touching it.
- **Educational states are visual states.** Every fault reads without sound and without text (§6).
- **Two registers, one family.** The panel is precise and near-schematic; the scene is simpler and warmer. Both share the palette, the line-weight steps and a single light direction.
- **Learn the real truck.** The realistic layouts (§8) keep the physical arrangement of the real pump bay. The simplified panel is an on-ramp to the same arrangement, not a different machine.

### Hard exclusions

- No agency logos, crests, wordmarks or names.
- No Battenburg or chevron livery and no exact agency livery. The truck body is a plain red (`scene.truckBody`) with a white reflective stripe.
- No photorealistic people. Crews are simple top-down figures (sheet 06).
- No gore and no imagery of fire victims.
- No raster art and no 3D: everything is SVG + CSS.

## 2. Colour

### Roles
| Role | Token | Rule |
|---|---|---|
| Outlet valve handle | `color.function.outlet` #2470C2 | Real-truck convention. All outlets: discharge master, outlets, reel valves. |
| Inlet valve handle | `color.function.inlet` #14A37F | Real-truck convention. Suction inlet and tank-to-pump. |
| Caution | `color.signal.caution` #F2A900 | Always paired with a **triangle**. Steady. "Act soon." |
| Alarm | `color.signal.alarm` #E5362B (lit core #FF5A44) | Always paired with a **diamond**. Flashes at 2 Hz. "Act now." |
| Delivery identity | `color.delivery.d1..d4` | **Under review** (OPEN_DECISIONS #1). Glyph + numeral always carry identity: circle, square, bar, hexagon. |

- Triangle and diamond are reserved for signals and never used as delivery glyphs.
- Never carry meaning by colour alone; every colour comes with a shape, numeral or label. Under protan/deutan simulation the Gum and Galah delivery colours converge (simulated swatches are on sheet 01).
- Materials (ironbark, galv, dial, paper, canvas, dust and so on) never carry meaning.
- Truck body red is deliberately duller than alarm red.

### Contrast (checked)
- Steel #C9CFD3 on ironbark: 10.6:1. Steel-dim #9AA3A9 on ironbark: 6.5:1. Pencil #5B6166 on paper: 5.5:1.
- White on outlet blue: 5.0:1. Ink on inlet green: 5.5:1. White on plate red #A8251E: about 7:1.
- Alarm red on ironbark is only 3.9:1, so use it for lamps and zones and never for small text. For alarm text on dark backgrounds use `signal.alarm.textOnDark` #FF6A55 (5.9:1).

## 3. Type, line, light, spacing

- **Barlow Condensed** 600/700: gauge numerals, labels, headings. Labels are uppercase with +0.06 to 0.08 em tracking and an 11 px floor.
- **IBM Plex Mono** 400/500: live readouts with `font-variant-numeric: tabular-nums` and a space as the thousands separator ("1 050 kPa"), plus spec callouts.
- **IBM Plex Sans** 400/600: tutorial and coaching text, 14–16 px.
- **Gauge numerals:** cap height at least 7% of the dial diameter and never below 12 px rendered. Below a 100 px dial, drop the numerals and use the mini variant.
- **Line weights (one pen, two scales):** 1 hairline · 1.5 detail · 2.5 primary · 4 heavy. The panel uses hairline to primary; the scene uses detail to heavy, one step heavier.
- **Light:** from the upper left (315°). Highlights at top-left. Shadows fall down-right: +2/+3 px on the panel, +5/+8 when an element is lifted while dragged, +4/+4 in the scene. Glow only on lit lamps.
- **Spacing:** 4 px base (4, 8, 12, 16, 24, 32, 48).
- **Radii:** plates 3, cards 6, lamps and knobs round.
- **Touch targets:** 44 px minimum, 48 preferred.
- **Focus:** a double ring, 2 px dial colour inside 2 px ink, readable on both paper and ironbark. It never uses amber.

## 4. Gauges (sheet 02, `reference-impl/`)

One parameterised component. Face, bezel, scale and numerals are static per dial type. Needle, Wake and plate change at runtime.

**Geometry** (dial units, bezel radius R = 100, viewBox `-106 -106 214 214`; all values in `GEOM`):
- Bezel 100→92 (galv gradient). Lip ring at 93. Face 92 (radial gradient on `dial`).
- Scale arc r 88, 1.2 wide. Zone band r 84, 7 wide.
- Major ticks 88→72 at 2.5 wide; minor ticks 88→80 at 1.2 wide. Scale-break tick 91→66 at 3.4 wide.
- Numerals centred at r 61, size 20. Units at y +33, size 10. Plate 76×18 at y 54.
- Needle tip r 82, tail 18, maximum width 6.4, with a dial-coloured spine. The counterweight disc (r 6.2) carries a tag-colour inlay. Hub r 8.5, galv cap 3.4.
- Shadow at +3/+4.

**Angles:** clockwise from 12 o'clock, 270° sweep from −135 to +135. Ticks are a `rotate(θ)` line template. Arcs are circles with a `stroke-dasharray`, rotated to `θstart − 90`, so the markup needs no trigonometry.

**Dials** (`dials.ts`; ranges and zones are placeholders, see OPEN_DECISIONS #5):
- **Pressure (discharge):** 0–1600 kPa, majors every 200, minors every 50, labels ×100. Caution 1200–1400, alarm 1400–1600.
- **Compound:** two linear segments. Vacuum −100…0 kPa maps to −135…−75°; pressure 0…1600 maps to −75…135°. The vacuum sector is tinted #E1E6E8 and a heavy break tick marks 0. Caution −70…−85, alarm −85…−100.
- **Tachometer:** 0–4000 rpm, majors every 1000, numerals 22. Alarm 3500–4000.
- **Mini (under 100 px):** no numerals, majors 5 wide, zone band 12 wide. The value moves to a mono readout beside the dial, and that readout turns amber or red with the zone.
- **Rendered sizes:** discharge and compound 160 px on a phone / 220 on desktop; tachometer 112/150; mini 60/76.

**Tank level:** a five-segment LED column. Lit #DCEFF5, unlit #2A2F33. At ≤ ¼ the last segment turns amber with a triangle. When empty its outline flashes alarm red.

## 5. Controls (sheet 03; real arrangement on sheets 07–08)

| Control | Gesture | States |
|---|---|---|
| Quarter-turn lever valve (outlets, reels, discharge master) | Drag the grip through 90°. Detents at closed and open; holds anywhere between. A tap does nothing, so a stray thumb never charges a line. | **Default:** closed, dotted travel arc. **Active:** lifted shadow, arc fills in the handle colour, % readout. **Disabled:** 50% opacity, sleeve loses colour, no arc, reason chip ("NO LINE"). **Warning:** amber collar around the valve body plus a triangle badge (e.g. opened into a shut branch). |
| Tank-to-pump / inlet valves | Same mechanism. On the realistic layout the handle is inlet green. | Disabled example: "DRAFTING" (scenario lock). Warning: closed while the pump runs with no supply. |
| Throttle: vernier knob (layout A, C10) | Rotate for fine control; press the centre for coarse travel. Released, it stays put — a cable, not a spring. | Over-rev: the readout turns alarm red and a diamond badge appears. |
| Throttle: T-handle (sheet 03 variant, other trucks) | Drag out for coarse travel; − / + buttons for 25 rpm vernier steps. | Disabled: "PUMP NOT ENGAGED". Warning: red shaft band exposed. |
| Primer | Press and hold. The progress ring fills as vacuum builds and the cap sinks 2 px. Releases on catch, or after 30 s. | 30 s timeout: amber ring plus "CHECK SUCTION". Primed: check mark, disabled. |
| Key switch (C6) | Rotate: OFF → RUN → START (spring return from START). | |
| Warning lamp | Read. Tap to acknowledge: flashing → steady, and the coaching card opens. | Unlit: icon ghosted in the glass. Caution: amber, triangle frame, steady. Alarm: red, diamond frame, 2 Hz. Not in scenario: dashed outline. |

**Keyboard:** every drag or rotate control is backed by a real `input[type=range]` (or a custom element with the slider role and full key handling). Left/right moves 10%, Home/End goes to closed/open. Buttons are real `<button>`s. Hold-to-prime also works with Space held down.

## 6. The Wake and fault states (sheet 04)

**The Wake.** Every needle drags an afterimage of the last 3 s.
- **Band:** the min…max of the window, drawn at r 68–90 in ink at 12% opacity, with 0.8 hairlines at the min and max.
- **Ghosts:** 5 past needles at 0.6 s intervals, opacity 0.26 down to 0.07.
- **Reading it:** a sliver means steady, a trail on one side means a surge, a fan on both sides means hunting (failing supply or cavitation).
- **Flutter:** ±2–5° at about 2.4 Hz, only while `isHunting()` is true.
- **Restrictions:** the Wake is never coloured and never drawn over the label plate.
- **Reduced motion:** remove the flutter and wake flicker; keep the Wake. It is information, not decoration.

**Fault states:**

| Fault | Panel cue | Scene cue |
|---|---|---|
| Cavitation | Compound needle in amber; the Wake fans out and flickers. | The hose core breaks into gaps (dash pattern 18 5 7 4 22 5, animated dash offset). |
| Low water | The last tank segment turns amber; TANK triangle lamp. | At empty, every charged line deflates to the flat dry style within 2 s. |
| Overheat (pump churning) | ENG TEMP diamond lamp flashing; all outlets closed; 0 L/min. | Heat shimmer rises off the pump bay. |
| Over-pressure | Discharge needle and Wake pinned in the red zone. | The line swells (casing 9→13, core 5→8) inside a breathing red halo, 24 wide at 15–50% opacity. No burst animation. |

## 7. Scene (sheet 06)

- **View:** a plan view with contour lines, index contours every 10 m drawn heavier, and hypsometric ground tints (`scene.dust*`). A north arrow and a scale bar make it read like a manual.
- **Hoses:**
  - Charged: ink casing 11 + colour core 6 with round caps, plus a moving white flow highlight (`2 16` dash, 0.6 s period).
  - Laid but dry: canvas colour, 3–3.5 wide, dashed.
  - Hard suction: galv core 9 with ink casing 14, and a strainer at the dam.
  - Each line ends at the branch with its identity glyph.
- **Crews:** top-down simple figures (khaki PPE, white helmet, hi-vis band) with a spray fan toward the fire.
- **Fire:** a radial glow from the scene edge, a dashed red front line, an ash tint behind the front, and drifting smoke.
- **Section view:** a hydraulic section along a chosen line (A–A), vertical ×5, annotated with pump pressure, elevation loss, friction loss and branch pressure. The figures on sheet 06 are illustrative only.
- **Responsive:** on desktop and tablet the panel and scene sit side by side. On a 375 px phone they stack with the scene on top (sheet 05).

## 8. Realistic layouts (sheets 07–08, `layouts/`)

- **Purpose:** trainees get comfortable finding gauges and controls on the real truck. Progression goes from the simplified panel to the realistic bay, with the same physical arrangement throughout.
- **Zones** (layout A):
  - A — left reel
  - B — pump and inlets
  - C — instrument panel
  - D — discharge
  - E — right reel
- **Item IDs:** zone-scoped (A1, B3, C2, D4…). IDs are what the trainee sees in the callouts.
- **Item roles:** a stable semantic role per item (e.g. `outlet-1`). Game logic keys off `role` and `sim`, so a second truck type is a new JSON file with the same roles in different positions. Items a truck lacks are simply absent.
- **Views:** the bay elevation (sheet 07) is the overview. Tapping zone C zooms into the panel close-up (sheet 08), which keeps the real arrangement but is enlarged so it can be read. Callouts can be toggled off for a "find it yourself" mode.
- **Colour convention:** outlet handles blue, inlet handles green. Couplings are galv, with white number plates beside the outlets.
- **Control variants vary by truck:** for example, `throttle: 'vernier-knob' | 't-handle'`. Keep one interaction model per variant.
- **Assumptions to confirm:** see `assumed: true` items in `layout-a.json` and OPEN_DECISIONS #3.

## 9. Accessibility

- Every touch target is at least 44 px.
- Focus rings are always visible (§3).
- Gauges are `role="img"` with an `aria-label` that includes the current value. Throttle readouts announce through a polite live region at most once a second.
- Lamps are buttons. Their accessible name includes the state ("Engine temperature lamp, alarm").
- Colour is never the only channel: valves use shape and position, signals use triangle or diamond, deliveries use glyph and numeral.
- Under `prefers-reduced-motion`: no needle flutter, no wake flicker, no hose flow animation, no smoke drift, and alarm lamps hold steady with a doubled ring.
- Alarm flashing at 2 Hz stays below the 3 flashes/s photosensitivity threshold.
