# Open decisions

These need the owner's call before the affected parts are built. Each lists what it blocks.

## 1. Delivery identity colour vs. the outlet-blue / inlet-green convention
**Blocks:** the simplified panel (sheet 05), the scene hose colours (sheet 06), and the delivery colours shown on sheets 01, 03 and 04.

The early sheets give each delivery its own colour (Cobalt, Gum, Sky, Galah) on its valve handle, gauge tag and hose. Real trucks colour handles by **function** instead: outlets blue, inlets green. Two of the delivery colours are effectively that blue and that green.

- **Option A — function colour on handles, identity elsewhere.** Handles are blue or green, as on the truck. Delivery identity moves to the numbered tag and a coloured collar or band, using colours clear of blue, green, amber and red. That palette is tight and weak for colour-blind players, so the numeral and glyph would do most of the work.
- **Option B — no identity colour.** Handles and charged hoses are blue; suction lines are green. The panel-to-scene trace relies on numeral and glyph markers along each hose and at the branch. *Recommended by the designer:* it is closest to the real truck, but you lose the instant colour match between a valve and its hose.

## 2. Which outlets the simplified panel shows
**Blocks:** sheet 05 rework.

The simplified comps assume four deliveries (D1–D4). Layout A actually has three outlets (64 / 38 / 38 mm) plus two hose reels with their own valves, and a discharge master. For the progression to be honest, the simplified panel should probably expose the same set.

## 3. Layout A assumptions to confirm against the real truck
**Blocks:** nothing structurally; only labels and positions in `layout-a.json`.

- **B4 tank-to-pump valve:** not visible in the photo; position guessed.
- **D1 discharge master:** a large blue lever on the diagonal pipe; function inferred.
- **D5 / D6 reel valves:** positions guessed.
- **C4 / C5:** the two small dials on the panel's right, taken to be engine temperature and oil pressure.
- **C6 key switch and C8 primer:** functions inferred from the photo's controls.
- **C7d over-pressure lamp:** a game addition.

## 4. Throttle style per truck type
**Blocks:** the control library.

Layout A uses a twist vernier knob. Sheet 03 shows a push-pull T-handle. Both are specced; each truck type picks one through `throttle` in its layout file. Confirm which trucks use which.

## 5. Placeholder numbers
**Blocks:** final dial artwork and the coaching text.

These come from the simulation model or the procedure being taught, not from design:
- Gauge ranges and zone thresholds: 1200/1400 kPa discharge, −70/−85 kPa compound, 3500 rpm.
- Engine temperature and oil ranges.
- Tank capacity: the comps show 2 400 L remaining.
- The hydraulic figures on sheet 06: 14 m rise = −137 kPa; 120 m of 38 mm at 410 L/min = −213 kPa friction.
- The operating-sequence placard text on sheet 08.
