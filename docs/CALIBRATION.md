# Calibration

The single source of truth for the sim's numbers (ARCHITECTURE §6, §9.5). Constants carry the same status as the code comments:

* **doctrine-confirmed**: stated in the RFS Hydraulics Manual v4.0, or fitted directly to its tables.
* **PLACEHOLDER — needs Dek**: the manual is silent; a plausible value until Dek supplies the real one.

Citations: `L1234` = line in `Resources/hydraulics-manual.txt`; `p32` = PDF page. The digest is in `Resources/hydraulics-manual-GAME-NOTES.md`.

Tests: `src/sim/calibration.test.ts` asserts every worked example below. A failing calibration test is fixed in the model or this table, **never** by updating a golden trace.

---

## Shared physics (`sim/constants.ts`)

| Quantity | Value | Source | Status |
|---|---|---|---|
| Head | 10 kPa per m | L702–741 | doctrine-confirmed |
| Standard hose length | 30 m | L823 | doctrine-confirmed |
| Hose friction | `ΔP = k_m · L_m · Q²` (kPa, m, L/min) | law 3 L798, law 5 L815 | doctrine-confirmed |
| Branch flow | `Q = (2/3)·d²·√(P/100)` (L/min, mm, kPa) | Table 1, L462–490 (printed formula lacks the √) | doctrine-confirmed |
| Valve loss, fully open | 1.1e-4 kPa/(L/min)² at 38 mm (≈ 10 kPa at 300 L/min), × (38/d)⁴; partly open ÷ open² | — | PLACEHOLDER — needs Dek |
| Hard suction friction `65H` | taken as 65 mm lined, 4.07e-6 per m | — | PLACEHOLDER — needs Dek |
| Layflat collapse | below 0 kPa at the inlet ("inlet zero, supply hose soft") | Table 7, L1055–1065 | doctrine-confirmed |
| Strainer loss | 15 kPa at 1000 L/min | — | PLACEHOLDER — needs Dek |
| Vacuum hold | a sealed pump's vacuum decays with τ = 120 s | — | PLACEHOLDER — needs Dek |
| Cavitation gauge flutter | ±100 kPa discharge, ±15 kPa compound, × intensity | Design §6 (±2–5° of needle) | PLACEHOLDER — needs Dek |
| Water heat capacity | 4.186 kJ per L per °C | physics | — |
| Ambient water / casing loss | 20 °C; 0.02 kW per °C | — | PLACEHOLDER — needs Dek |
| Temperature lamp | caution 60 °C, alarm 80 °C | — | PLACEHOLDER — needs Dek |
| Water hammer | surge `ρ·a·Δv`, a = 250 m/s in charged hose; event above 500 kPa | qualitative only (L2255, L3112) | PLACEHOLDER — needs Dek |

### Hose friction coefficients

These are least-squares fits to Table 3 (p32, kPa per 30 m length), divided by 30. Table 3 was checked against the page image on 2026-10-24, and it matches the notes. Fit scatter is ≤ ±10 %.

| Hose | k_m (kPa per (L/min)² per m) | Check point (manual) |
|---|---|---|
| 25 mm lined `25L` | 3.60e-4 | 150 L/min → 250 kPa/length (L928) |
| 38 mm unlined `38U` | 1.43e-4 | 500 L/min → 1000 |
| 38 mm lined `38L` | 5.10e-5 | 500 L/min → 400 (L966) |
| 50 mm unlined `50U` | 3.47e-5 | 500 L/min → 260 |
| 50 mm lined `50L` | 1.21e-5 | 500 L/min → 90 (L991) |
| 65 mm unlined `65U` | 1.14e-5 | 1000 L/min → 350 (L1026) |
| 65 mm lined `65L` | 4.07e-6 | 500 L/min → 30 (L975) |
| 70 mm unlined `70U` | 7.0e-6 | 1000 L/min → 200 |
| 70 mm lined `70L` | 2.56e-6 | 1000 L/min → 75 |
| 90 mm unlined `90U` | 2.17e-6 | 1000 L/min → 65 (L1039) |

### Branches (Table 1, L465–490)

All six rows are asserted to within ±2 % (the manual rounds its flows).

| Tip mm | Optimum kPa | Flow L/min | Formula gives |
|---|---|---|---|
| 12 | 250 | 150 | 152 |
| 15 | 350 | 280 | 281 |
| 20 | 500 | 600 | 596 |
| 25 | 700 | 1100 | 1102 |
| 30 | 800 | 1700 | 1697 |
| 32 | 800 | 1900 | 1931 |

### Worked examples

Pump pressure = nozzle + friction ± head. Tolerance is ±5 %: the friction-fit scatter, diluted by the nozzle term.

| # | Setup | Manual | Sim | Source |
|---|---|---|---|---|
| C1 | 25 mm × 1 length, 150 L/min, nozzle 250 kPa | 500 | 493 | L927–932 |
| C2 | 25 mm × 4, same | 1250 | 1222 | L933–938 |
| C3 | 38 mm lined × 4, 150 L/min, nozzle 250 | 390 | 388 | L949–954 |
| C4 | 38 mm lined × 3, 500 L/min, nozzle 700 | 1900 | 1848 | L964–967 |
| C5 | 65 mm lined × 3, 500 L/min, nozzle 700 | 790 | 792 | L969–976 |
| C6 | 65 × 2 + 38 × 1 lined, 500 L/min, nozzle 700 | 1160 | 1144 | L980–985 |
| C7 | 50 mm lined × 3, 500 L/min, nozzle 700 | 970 | 972 | L987–993 |
| C8 | Branch 16 m above pump, 700 at nozzle | 860 | 860 | L702–741 |
| C9 | Branch 16 m below pump | 540 | 540 | L702–741 |
| C10 | 1000 L/min over 3 × 65 mm unlined: single / twinned / 90 mm (friction only) | 1050 / 255 / 195 | 1026 / 257 / 195 | L1024–1039 |

### Supply and draughting (asserted in `calibration.test.ts`, `sources.test.ts`)

| # | Setup | Manual | Sim | Source |
|---|---|---|---|---|
| C11 | Primed at 4 m lift, a trickle | inlet ≈ −40 kPa | −40 (±2) | L3222–3225 |
| C14 | Hydrant 400 kPa static, 300 residual at 1100 L/min | ~1100 L/min more available | residual 0 at 2200 L/min | L3127–3130 |
| T4 | Capacity at lift vs at 3 m, flat out: 4.5 / 6 / 7 m | 6/7 / 2/3 / 1/2 | within 5 % | Table 4, L1179–1194 |

Table 4 is reproduced by one figure, the inlet pressure the pump cavitates at: the flow a draught can give is `√((−P_cav − 10·lift)/R)`, so its ratio to the 3 m flow doesn't depend on the suction hose. −84 kPa fits 4.5–7 m (fits per row: 86.5, 84, 83.3). At 7.5 m it keeps 43 % against the manual's 33 % (a −81 kPa fit); not asserted, needs Dek.

Not yet asserted (they need later milestones): C12–C13 relay spacing (M5); C15 open-water capacity (M6).

### Solver behaviour (asserted in `network.test.ts` and `engine.test.ts`)

These are the manual's gauge-response rules (L3379–3386, L3504–3511):

* Raising the throttle raises discharge and pulls the compound gauge lower.
* Opening another line drops discharge and the flow in lines already running.
* On every line, discharge = branch + valve + friction + head.
* The compound gauge reads slightly negative on tank supply, and more so at higher flow (L3529).
* With tank-to-pump shut, or the tank empty, every gauge reads zero (Table 6).
* The relief opens above its set pressure and holds discharge near it.
* On a hydrant the compound reads its static pressure with nothing flowing and falls as more is drawn (L3613); over-run, it reads zero (Table 7).
* At the cavitation floor more throttle adds no flow and no discharge (L3353–3355); easing back below it stops the cavitation.

---

## Cat 1 tanker (`sim/appliances/cat1.ts`, id `cat1-generic`)

| Figure | Value | Status |
|---|---|---|
| Deliveries | d1 64 mm, d2 38 mm, d3 38 mm (Layout A outlets) | PLACEHOLDER — sizes read from photo; reels and discharge master deferred |
| Pump shutoff (zero flow, max rpm) | 1400 kPa | PLACEHOLDER — needs Dek |
| Pump droop | 4e-4 kPa/(L/min)², i.e. 1000 kPa at 1000 L/min | PLACEHOLDER — needs Dek |
| Engine idle / max | 800 / 3000 rpm | PLACEHOLDER — needs Dek |
| Throttle → rpm lag | τ = 0.5 s | PLACEHOLDER — needs Dek |
| Tank | 3000 L | PLACEHOLDER — needs Dek |
| Tank-to-pump loss | −15 kPa compound at 1000 L/min | PLACEHOLDER — needs Dek (manual: "slight negative", L3529) |
| Primer | Electric rotary vane, max 60 s on in 180 s | doctrine-confirmed (L1890) |
| Relief | Preset (not adjustable), dumps to tank | doctrine-confirmed (L2322–2336) |
| Relief set pressure | 1100 kPa | PLACEHOLDER — needs Dek |
| Relief bypass slope | 50 L/min per kPa over set (holds ~15 kPa over set) | PLACEHOLDER — needs Dek |
| Gauge scales | discharge 0–1600, compound −100…1600 kPa, tacho 0–3500 rpm; zones in Needs Dek #9 | PLACEHOLDER — needs Dek |
| Suction inlet | 64 mm with a lever valve (Layout A B3/B5); 10 kPa at 1000 L/min through it | photo; loss PLACEHOLDER — needs Dek |
| Cavitation inlet pressure | −84 kPa (the Table 4 fit for a generic pump) | PLACEHOLDER — needs Dek (the Cat 1 pump's own) |
| Primer performance | best vacuum 80 kPa (primes to just under 8 m), 1.5 L/s of air (≈ 15 s at 4 m on 6 m of hard suction) | PLACEHOLDER — needs Dek |
| Casing volume / churn heat | 10 L; 10 kW at max rpm (≈ 4–5 min churning to the amber lamp at 0.8 throttle) | PLACEHOLDER — needs Dek |

**Tank-attack trace** (`src/sim/scenarios/__traces__/tank-attack.cat1-generic.csv`): a 38 mm line, 3 × 30 m, 15 mm branch on d2; a 65 mm line, 3 × 30 m, 20 mm branch on d1.

| Phase | Discharge | Flows (d2 / d1) | Branch (38 / 65) |
|---|---|---|---|
| 38 mm only, throttle 0.6 | 669 kPa | 270 / 0 L/min | 325 kPa |
| Second line opened, throttle 0.6 | 471 kPa (sag 198) | 227 / 514 L/min | 229 / 371 kPa |
| Throttle 0.8 | 687 kPa | 274 / 620 L/min | 334 / 541 kPa |

The tank runs dry at t = 250 s, and every gauge then drops to zero. M4 appended columns (per-inlet flow, primed, vacuum, cavitation, pump temperature); the earlier columns are unchanged.

**Hydrant trace** (`hydrant-supply.cat1-generic.csv`): 400 kPa hydrant, 2 × 30 m 65 mm layflat; a 65 mm line with a 25 mm branch, then a 38 mm line. At throttle 0.4: compound +233 kPa, discharge 474. Both lines, full throttle: over-run, compound 0, 1090 L/min, cavitation 0.35; throttle 0.5 recovers (compound +148).

**Draughting trace** (`draughting.cat1-generic.csv`): dam 4 m below the pump, 2 × 3 m hard suction. Primer held from t = 1 s; primed at t ≈ 16 s, compound −40 with nothing flowing. 65 mm line at 0.6: 527 kPa, compound −55. Both lines at full throttle: compound −84, 944 L/min, cavitation 0.32; back at 0.6 it recovers.

---

## Needs Dek

1. **Cat 1 pump curve**: shutoff pressure, rated flow and pressure, idle and max rpm, engine response.
2. **Cat 1 tank capacity** and crew-protection reserve.
3. **Relief set pressure** and how sharply it holds.
4. **Tank-to-pump inlet reading** at typical flows.
5. **Delivery valve loss** when fully open, per size.
6. **Dry-pump behaviour.** At the moment, tank-to-pump shut or tank empty means every gauge reads 0 at once. Real behaviour, such as a brief run-down or a full casing holding pressure with the inlet shut, is for M4, alongside cavitation.
7. **Trace branch choice**: 15 mm on the 38 mm line and 20 mm on the 65 mm line, both from Table 1. Is that representative of what a Cat 1 crew would run?
8. **Cat 1 delivery sizes** (64/38/38 mm), which were read from the Layout A photo.
9. **Gauge faces** (`instruments[].scale` on each spec; `ui/panel-pump/gauge/dials.ts` builds the faces from it). Cat 1 now: discharge 0–1600 kPa, caution 1100–1400 (relief set to shutoff), alarm 1400–1600 (above shutoff, reachable only from a pressurised supply); compound −100…1600 kPa, caution −70…−85, alarm −85…−100; tacho 0–3500 rpm, alarm 3100–3500 (above the 3000 governed max, so unreachable by design). Ranges are the design comps' (Design OPEN_DECISIONS #5) and the zone placement is a guess. What do the Cat 1 gauges actually read, and where do their marked zones sit?
10. **Low-tank warning** at ≤ ¼ tank (`state/tankLevel.ts`, from the Design spec). Is there a doctrine crew-protection reserve to warn at instead?
11. **Panel conventions** (Design OPEN_DECISIONS #1, #4): handles coloured by function (outlets blue, inlets green) with delivery identity by glyph and tag; push-pull T-handle throttle; tank-to-pump toggles on a tap while deliveries are drag-only. Confirm, or say what a Cat 1 actually has.
12. **Needle response**: damped to settle in about 0.7 s (`NEEDLE_OMEGA`). Is a real discharge gauge noticeably faster or slower?
13. **Scene conventions** (M3, UI only, no physics): a line is drawn charged when its delivery flows ≥ 1 L/min, since branches can't be shut yet; branches sit ~85 % of the hose length from the truck; the truck parks with its outlets facing the fire. Is "charged = flowing" right for teaching, or should a line on an open delivery with a shut branch read as charged once branch shut-off exists? And should the scene ever show a truck parked another way (e.g. facing the exit, lines run round the side)?
14. **Cavitation**: one inlet pressure (−84 kPa) is used for every pump, fitted to Table 4. What does a Cat 1 pump's lift curve look like, and does the 7.5 m row (model 43 %, manual 33 %) matter?
15. **Priming**: primer best vacuum (80 kPa), air displacement (1.5 L/s), casing volume (10 L), how long a Cat 1 takes to prime at 3–6 m, and how far a sound pump's vacuum should fall in a vacuum test. Is the hard suction 2 × 3 m of 65 mm? Strainer loss?
16. **Priming procedure**: the model blocks priming while a delivery with a line is open (air leak) or while the tank or a hydrant is open to the pump (casing flooded). Should an open tank-to-pump instead prime the suction from the tank, as some crews do?
17. **Hydrant model**: residual = static − k·Q² (C14). No back-fill of the tank through an open tank valve (Table 7), no tank fill from a hydrant, no changeover surge yet. Typical static pressures for scenarios?
18. **Overheat**: churn heat 10 kW at max rpm, lamp at 60 / 80 °C. How fast does a real pump overheat churning, and is there a temperature gauge or lamp on a Cat 1?
19. **Water hammer**: Joukowsky with a 250 m/s wave speed, event above 500 kPa; size isn't weighted, though the manual says ≥ 65 mm is worse. A keyboard step from 10 % to shut on a 38 mm line counts as hammer. Thresholds?
20. **Cavitation flutter**: ±100 kPa discharge / ±15 kPa compound at full cavitation, scaled by intensity (0.25 excess flow = full). What does the hunting really look like?
21. **Water hammer vs tick rate** (PR #3 review): the surge is the flow drop over one tick, so one physical closure reads differently at other tick rates (a 1 s closure: 702 kPa at 10 Hz, none at 20 Hz; a 0.5 s closure: 889 kPa at 10 Hz, 702 kPa at 20 Hz). The sim runs at a fixed 10 Hz, so play is consistent, but the figure isn't physical. Proposal: compare the closure time with the line's critical time 2L/a (≈ 0.7 s for 90 m at 250 m/s) and take Joukowsky `ρ·a·Δv` for faster closures, Michaud `ρ·a·Δv·(2L/a)/T` for slower, with Δv measured over a 2L/a window instead of one tick. Is that the right model to teach, and should line length weight it?
