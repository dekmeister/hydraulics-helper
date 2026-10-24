# RFS Hydraulics Manual v4.0 — notes for the game

Reviewed against `ARCHITECTURE.md`, `PLAN.md`, `DESIGN_BRIEF.md`. Companion to `hydraulics-manual-INDEX.md` (navigation) — this file is the *digest*.

**Citations:** `L1234` = line in `hydraulics-manual.txt`; `p88` = PDF page (printed page + 13).
**Status tags** (per CLAUDE.md rule 3): `MANUAL` = stated in the manual; `DERIVED` = computed by us from manual data (method given); `GAP` = manual is silent → `needs Dek`.

**What was read in full:** Ch 2 (nozzle, friction, supply, lift), 3.6, 4.3, 5.1–5.3, 7.3–7.4, all of Ch 8. **Not read in detail:** 2.21 water-capacity maths (taken from the index), Ch 6, Ch 9 foam, Ch 1, glossary.

---

## 0. Decisions (Dek, 2026-10-24)

1. **Head = 10 kPa per metre** (not 9.8). Matches the manual and what operators are taught.
2. **Friction is specified per metre**, `ΔP = k_m · Q² · L_m` (k_m in kPa per (L/min)² per m). Hose lengths in scenarios are still multiples of 30 m (the manual's unit), but `sim/constants.ts` stores per-metre coefficients (§3).
3. **Reference appliance: Cat 1 tanker.** First (and v1-only) appliance spec. Others follow via `ARCHITECTURE.md` §9.
4. **First tutorial: two lines of 25 mm hose.** Worked numbers and implications in §4a. Note this is a change from `PLAN.md` M1 / `ARCHITECTURE.md` §5, which assume 38/65 mm and a 38 mm first scenario.

---

## 1. Headline findings (what changes our approach)

1. **The manual contains no pump curve, pump ratings or tank capacities.** Fig 44 (the only curve) is for a portable fast-fill pump, image-only, irrelevant. `P_shutoff`, `k_droop`, rated flow, and tank sizes are all `GAP` → Dek. The manual does give an *operating envelope*: ~1000 kPa practical pump pressure ceiling (L940, L999) and 700 kPa at the branch.
2. **Doctrine works in 30 m lengths, and friction is "kPa per 30 m length".** ARCHITECTURE §4.5 specifies "per 100 m" — change the hose coefficient unit to per-30 m length (or per metre, derived). Every worked example is a count of 30 m lengths.
3. **Doctrine uses 10 kPa per metre of head, not 9.8** (L702–741, L1127, L3789). ARCHITECTURE §4.2 says 9.8. Recommend **10** — it's what the player is taught and what Dek's calibration examples will use. Decision for Dek.
4. **Friction really is ∝ Q²** (law 3, L798) and independent of pressure (law 5, L815) — the quadratic hose model in §4.5 is exactly doctrine. Table data fit to ~±10% (§3 below).
5. **The nozzle formula as printed is missing a square root** (L462). Table 1 only fits `Q = (2/3)·d²·√(P/100)` (L/min, d mm, P kPa). This is also just the orifice law, so `Q = k·√P` in ARCHITECTURE is right; use `k = (2/3)·d²/10`.
6. **The manual's relay recipe is a closed-circuit design rule** (600 kPa budget between pumps) — directly implementable and a great scenario (§6).
7. **Cavitation, loss of prime, churn overheat, water hammer, shutdown pressure spike, and over-running the supply** are all described with *observable gauge symptoms* — i.e. the manual already specifies the "teaching" behaviour in ARCHITECTURE §4.6. Fault tables 6–8 are effectively a ready-made scenario/debrief spec (§7).
8. **Procedure matters as much as physics in the manual** ("water on" signal, gradual charging, compensate throttle when opening/closing a line). These suggest scoring/tutorial hooks beyond pure hydraulics (§8).

---

## 2. Core numbers (use in `sim/constants.ts`)

| Quantity | Value | Source | Status |
|---|---|---|---|
| Head → pressure | **10 kPa per m** (±10 kPa/m up/down) | L702–741, p28–29 | MANUAL |
| Standard hose length | **30 m** | throughout | MANUAL |
| Atmospheric pressure | 101.3 kPa (round to 100) | L1123 | MANUAL |
| Lift: theoretical / practicable / max attempted | 10 m / 8 m / **7.5 m** | L1148, L1162 | MANUAL |
| Pump **rated** capacity defined at | **3 m lift** | L1176 | MANUAL |
| Capacity loss vs lift | 3.0 m: 0 · 4.5 m: 1/7 · 6.0 m: 1/3 · 7.0 m: 1/2 · 7.5 m: 2/3 | Table 4, L1179–1194 | MANUAL |
| Inlet gauge reading at lift | ≈ −10 kPa per m of lift (4 m → −40 kPa) | L1203, L3222–3225 | MANUAL |
| Compound gauge vacuum scale | −100…0 kPa | L1979 | MANUAL |
| Optimum branch pressure — straight stream | by size (Table 1 below) | L465–490 | MANUAL |
| Optimum — fog | **700 kPa** | L510 | MANUAL |
| Optimum — foam | ~550 kPa | L511 | MANUAL |
| Branch pressure cap before "water on" signal | **550 kPa** controlled / **400 kPa** open | L3417–3418 | MANUAL |
| Practical pump ceiling | ~**1000 kPa** | L940, L999 | MANUAL (soft: "may not be capable…") |
| Hose burst | rated ~4000 kPa short-length; operate ≤ 25 % (= **~1000 kPa**) | L945–948 | MANUAL |
| Hose-length friction rule of thumb | ≤ 100 kPa per 30 m length | L823, L1001 | MANUAL |
| Max flow for ≤100 kPa/length (lined) | 25 mm 100 · 38 mm 250 · 50 mm 500 · 65 mm 1000 · 70 mm 1200 · 90 mm 2000 L/min | L1006–1011 | MANUAL |
| Relay: delivery / min residual inlet / budget | 700 / 100 / **600 kPa** | L3794–3796 | MANUAL |
| Relay fill pressure | 500 kPa, then 700 once all pumps have water | L3850–3853 | MANUAL |
| Relay — height ignored below | 10 m between pumps | L3789–3791 | MANUAL |
| Relay — loss if a booster fails | ~30 % of output | L3881 | MANUAL |
| Hydrant reserve-flow rule | inlet drop <10 % → 3× flow left · <15 % → 2× · <25 % → 1× · >25 % → "greater than original" (vague) | L3121–3126 | MANUAL |
| Rotary vane primer duty | max **1 min on in 3**; water-lubricated, don't run dry | L1890–1894 | MANUAL |
| Boiling point vs pressure | 70 kPa → 89.6 °C | L3341 | MANUAL |
| Suction strainer depth rule | submerged to 3× strainer depth (L3167) / 3× hose diameter (L3275) — manual is inconsistent | | MANUAL (ambiguous) |
| Series/parallel pump | series = ×2 pressure at same flow (2000 L/min @ 2100 kPa); parallel = ×2 flow at same pressure (4000 @ 1050) | Figs 24–25, L1587–1633 | MANUAL |
| Crew-protection water reserve (bush) | "significant minimum reserve" — no number | L2105, L3061 | **GAP** |
| Pump pressure at zero flow, droop, rated flow, RPM range, idle/priming rpm | — | — | **GAP** |
| Tank capacities by category (Cat 1/7/9), pump ratings | — | — | **GAP** |
| Pump casing temperature thresholds / heat-up rate | — | — | **GAP** |
| Water-hammer severity thresholds | qualitative only | L2255, L3112, L3869 | **GAP** |

### Table 1 — branch (nozzle) data, MANUAL (L465–490)

| Nozzle mm | Optimum kPa | Flow L/min | Jet reaction kgf |
|---|---|---|---|
| 12 | 250 | 150 | 6 |
| 15 | 350 | 280 | 12 |
| 20 | 500 | 600 | 31 |
| 25 | 700 | 1100 | 68 |
| 30 | 800 | 1700 | 113 |
| 32 | 800 | 1900 | 128 |

Formula check (DERIVED): `(2/3)·d²·√(P/100)` gives 152 / 281 / 596 / 1102 / 1697 / 1931 — matches the rounded column. The manual's bracketed values (147, 272, 578, 1068, …) are ~3 % lower, i.e. a discharge coefficient ≈ 0.97. **Suggest** `Cd = 0.97` in constants, tests at `toBeCloseTo(…, -1)` against the rounded column.

Jet reaction scales ≈ flow × velocity ∝ d²·P. Not needed for the pump-panel sim but useful as a "branch operator fatigue/loss-of-control" signal when pressure overshoots (L525–533).

---

## 3. Hose friction — table recovered and fitted

The extracted Table 3 (L876–915, p32) has scrambled headers. **Header order resolved (DERIVED)** by matching the worked examples (25 mm lined 150 L/min = 250 ✓ L928; 38 mm lined 150 = 35 ✓ L953; 38 lined 500 = 400 ✓ L966; 65 lined 500 = 30 ✓ L975; 50 lined 500 = 90 ✓ L991; 65 unlined 1000 = 350 ✓ L1026; 90 unlined 1000 = 65 → 195 over 3 lengths ✓ L1039). The table has **no 90 mm lined column** and **no 25 mm unlined column**.

kPa lost per 30 m length (MANUAL):

| L/min | 25 L | 38 U | 38 L | 50 U | 50 L | 65 U | 65 L | 70 U | 70 L | 90 U |
|---|---|---|---|---|---|---|---|---|---|---|
| 100 | 100 | 45 | 15 | 10 | – | | | | | |
| 150 | 250 | 100 | 35 | 25 | – | | | | | |
| 200 | 450 | 175 | 60 | 40 | 15 | 15 | | | | |
| 350 | | 500 | 180 | 125 | 45 | 40 | | | | |
| 500 | | 1000 | 400 | 260 | 90 | 85 | 30 | 55 | 20 | 15 |
| 1000 | | | | | | 350 | 120 | 200 | 75 | 65 |
| 2000 | | | | | | 1400 | 500 | 850 | 300 | 260 |

(U = unlined, L = lined; values rounded to 5 kPa in the manual.) Verified against p32 image **not yet done** — the index agent viewed p32 but I have not independently; Dek should eyeball before locking.

**Fitted `k`, `ΔP = k_m · Q² · L_m`, Q in L/min, L in metres (DERIVED = per-30 m fit ÷ 30; fit scatter ≤ ±10 %). Per-metre is the decided storage unit (§0).**

| Hose | k_m (kPa per (L/min)² per m) | k per 30 m length (cross-check vs manual) |
|---|---|---|
| **25 mm lined** | **3.60e-4** | 1.08e-2 |
| 38 mm unlined | 1.43e-4 | 4.3e-3 |
| 38 mm lined | 5.10e-5 | 1.53e-3 |
| 50 mm unlined | 3.47e-5 | 1.04e-3 |
| 50 mm lined | 1.21e-5 | 3.6e-4 |
| 65 mm unlined | 1.14e-5 | 3.4e-4 |
| 65 mm lined | 4.07e-6 | 1.22e-4 |
| 70 mm unlined | 7.0e-6 | 2.1e-4 |
| 70 mm lined | 2.56e-6 | 7.7e-5 |
| 90 mm unlined | 2.17e-6 | 6.5e-5 |

The 25 mm figure is fitted from only three points (100/150/200 L/min) and is the one the tutorial depends on — **verify it against PDF p32 first.**

**Design consequences**
- The "38 vs 65 contrast is a core lesson" (ARCHITECTURE §4.5) is confirmed and large: at 500 L/min, 38 mm lined loses 400 kPa/length, 65 mm lined 30 — **13×** (L966 vs L975, "1900 vs 790 kPa" at the pump for 3 lengths).
- Lined vs unlined matters (~2.8× for 38 mm). Worth a hose-type attribute but can be deferred; M1 can use lined only.
- Friction is pressure-independent ⇒ the solver never needs pressure-dependent hose terms.
- **Twin lines:** two parallel equal hoses ⇒ each carries Q/2 ⇒ ¼ friction (L805–808, L1029–1036). Falls out of the solver for free if parallel lines are modelled; worth a supply-line scenario.
- **Mixed lines** add per-length (e.g. 2×65 + 1×38 = 60 + 400 = 460 kPa at 500 L/min, L980–985).

---

## 4. Worked examples → seed rows for `docs/CALIBRATION.md`

All MANUAL, flat unless stated. "Pump pressure = nozzle pressure + friction (± head)".

| # | Setup | Expected pump kPa | Source |
|---|---|---|---|
| C1 | 25 mm hose, 1×30 m, 150 L/min, nozzle 250 kPa | 500 | L927–932 |
| C2 | same, 4×30 m | 1250 (exceeds ~1000 ceiling → "can't do it") | L933–938 |
| C3 | 38 mm lined, 4×30 m, 150 L/min, nozzle 250 | 390 | L949–954 |
| C4 | 38 mm lined, 3×30 m, 500 L/min, nozzle 700 | 1900 | L964–967 |
| C5 | 65 mm lined, 3×30 m, 500 L/min, nozzle 700 | 790 | L969–976 |
| C6 | 2×65 + 1×38 (lined), 500 L/min, nozzle 700 | 1160 | L980–985 |
| C7 | 50 mm lined, 3×30 m, 500 L/min, nozzle 700 | 970 | L987–993 |
| C8 | Nozzle 16 m above pump, 700 kPa at nozzle (no friction) | 860 | L702–741 |
| C9 | Nozzle 16 m below pump | 540 | L702–741 |
| C10 | Supply 1000 L/min, 3×30 m 65 mm unlined: single / twinned / 90 mm | 1050 / 255 / 195 kPa lost | L1024–1039 |
| C11 | Lift 4 m, primed | inlet gauge ≈ −40 kPa | L3222–3225 |
| C12 | Relay: head 20 m up, 100 kPa/length → lengths between pumps | 4 lengths (120 m) | L3813–3820 |
| C13 | Relay: flat, 100 kPa/length | 6 lengths (180 m) | L3822–3827 |
| C14 | Hydrant static 400 kPa → residual 300 kPa at 1100 L/min | drop 25 % → ~1100 L/min more available | L3127–3130 |
| C15 | Pool 8×4 m, avg depth 1.5 m | 48 000 L; 24 min at 2000 L/min | index L1221–1239 (not read; check avg-depth value) |

**Note on the ARCHITECTURE §6 example** ("38 mm, 4 lengths, 700 kPa at ~230 L/min"): superseded by decision 3 (§0). For the record, at the fitted 38 mm lined coefficient that line needs ≈ 1024 kPa at the pump — at/over the ~1000 kPa ceiling — so it's better kept as a later "at the limit" case. A 230 L/min branch at 700 kPa is a ~11.4 mm orifice, not in Table 1.

### 4a. Tutorial 1 — two lines of 25 mm (DERIVED from C1–C2 data)

Smallest Table 1 branch: **12 mm, 250 kPa, ~150 L/min**. 25 mm lined hose at 150 L/min loses ≈ 243 kPa per 30 m (manual: 250, L928).

| Lines (each) | Friction per line | Pump pressure to hold 250 kPa at each branch |
|---|---|---|
| 1 × 30 m | ~245 kPa | **~495 kPa** (manual C1: 500) |
| 2 × 30 m (60 m) | ~485 kPa | **~735 kPa** |
| 3 × 30 m (90 m) | ~730 kPa | ~980 kPa — at the ~1000 kPa ceiling |
| 4 × 30 m | ~975 kPa | ~1225 kPa — manual C2 says 1250, "over the limit" |

Suggested tutorial layout (**my suggestion, needs Dek's OK**): **two deliveries, each 2 × 30 m of 25 mm, 12 mm branch.** Pump ≈ 735 kPa with both open, comfortably under the ceiling, leaving headroom to show the 3-length case near the limit as an optional extension.

What this lesson teaches well:
- **Small hose is friction-dominated:** the hose, not the branch, eats two-thirds of the pump pressure — the manual's own contrast with 38 mm at the same flow (35 kPa/length, C3: 390 kPa for 4 lengths).
- **Delivery lines are independent paths:** with a fixed pump pressure, opening line 2 does not change line 1's own hose friction. The "opening a line steals pressure" lesson (L3379–3386, L3432–3436) comes only from **pump droop** — so it depends on the pump curve, which is a **GAP**. Until Dek supplies it, the tutorial can show the effect but the size is a PLACEHOLDER.
- **Total demand 300 L/min is small**, so tank depletion is slow — tutorial won't be dominated by a running-dry clock unless tank is also given a (PLACEHOLDER) small capacity.
- **Optimum-pressure discipline:** 250 kPa target (not 700) — tutorial copy must say the branch optimum is size-dependent; the 700 kPa fog figure arrives with 38 mm lines later. Pre-"water on" caps (400/550 kPa) are above 250, so don't bite here; the "water on" signal can still be taught as procedure.

Implications for the plan docs (not yet edited): `PLAN.md` M1 lists "38/65 mm hose segments" — add **25 mm**; M2 demo mentions a generic "tank attack"; `ARCHITECTURE.md` §5 ladder step 1 ("single 38 mm line") becomes "two 25 mm lines", with 38 mm vs 65 mm contrast moved to step 2.

---

## 5. Where ARCHITECTURE.md agrees, differs, or needs adding

| ARCHITECTURE | Manual says | Action |
|---|---|---|
| §4.2 9.8 kPa/m | 10 kPa/m | **Change to 10** (decided, §0) |
| §4.4 `P_shutoff ≈ 1400 kPa` | silent; ceiling ~1000 kPa operating | Keep behind PLACEHOLDER; note manual's ~1000 kPa operating ceiling. Dek to supply real rating. |
| §4.4 governor/relief "caps pressure by shedding RPM" | Relief **dumps water back to inlet side (or tank on Cat 1 tankers)**; operator sets it by raising wheel until light comes on, then back off until light goes out (L2322–2336) | Model relief as a **recirculation bypass valve** (flow to inlet/tank above a set pressure), not RPM shedding. Add the "light" lamp to the panel. Cat 1: pre-set, not adjustable. |
| §4.5 hose `C·(L/100 m)·Q²` | per 30 m length | Per-metre `k_m·L_m·Q²` (decided, §0); coefficients in §3 |
| §4.5 valve quadratic loss | manual: "all deliveries should be opened fully" (L3459) | Fine; but throttling via a delivery valve is *not* the intended control — **throttle is**. Good tutorial nudge. |
| §4.5 branch `Q=k√P`, "~700 kPa" | 700 fog; straight-stream by size; **550/400 kPa caps until water-on** | Make optimum pressure a per-branch attribute; add pre-"water-on" limit as scoring rule |
| §4.5 "automatic nozzles" not mentioned | Auto fog nozzles vary flow to hold ~700 kPa; then flow, not pressure, is what the operator sets, via **flow meters** (L2041–2065) | Add `autoBranch` type + per-delivery flow meter (later). Great advanced lesson. |
| §4.3 Tank: "inlet pressure ≈ 0, small positive head" | Doctrine: with tank supply, **inlet gauge shows a slight negative reading** (L3529–3530); zero reading + no flow = tank empty / valve shut / not primed | Tank-to-pump inlet should read slightly *negative* (≈ −5 to −20 kPa, PLACEHOLDER), growing with flow. This is a diagnostic cue in Table 6. |
| §4.3 Hydrant inlet fixed pressure | Hydrant = **static pressure falling with flow** (residual), reaching 0 = over-running supply: lay-flat collapses, cavitation (L1055–1065, L3107–3110) | Model hydrant as `P_static − k_supply·Q²` (+ supply-hose friction), not a constant. Over-run → cavitation + "hose going soft" visual. |
| §4.3 Draught "max practical lift ~7 m" | 7.5 m max attempted; **Table 4 capacity loss** from 3 m | Use Table 4 as the capacity derate curve (interpolate). Lift ≥7.5 m ⇒ can't prime (L3273). |
| §4.6 Cavitation: sag, flutter, throttle does nothing | ✔ "increase in engine speed does not produce increase in discharge pressure… clattering as if pebbles" (L3353–3355); inlet gauge **more negative and fluctuating**; fix = reduce rpm until steady | Exactly matches; add: inlet gauge goes *more negative* (draught/tank) or *to zero* (hydrant) |
| §4.6 Priming | manual adds: **vacuum test**, primer duty 1-in-3, water-lubrication, emergency priming (blank cap / collecting head / back-flushing), air-leak sources | Primer duty-cycle is a free "don't hold the button" mechanic; vacuum test = tutorial step |
| §4.6 Loss of prime symptoms | **zero on inlet and delivery gauges, dramatic rpm rise and noise** (L3731–3733) | Use as the signature |
| §4.6 Overheat on churn | ✔ plus **scald risk**, fix = recirc valve to tank or crack a delivery (L2077–2083, L2838–2842) | Add **recirculation valve** to the panel inputs (not currently in `PlayerInputs`) |
| §4.6 Water hammer | ✔ qualitative; butterfly (tank valve), hydrants, deliveries, controlled branches; worse in ≥65 mm (L3112–3113) | dQ/dt detection fine; weight by hose diameter |
| §4.7 Closed relay "keep ≥ ~100 kPa residual" | ✔ 700 out / 100 in; 500 kPa fill; **shutdown pressure spike** when flow stops → burst hose / fractured casing (L3865–3870) | Add shutdown spike: closing the end branch removes friction instantly → burst event unless pumps throttled to idle from incident end first (L3873) |
| §4.7 Open relay "simpler, tolerant" | ✔ but manual: can't use residual pressure of previous pump → less efficient; allows temporary higher flow by dipping into tank/dam (L3756–3760) | Teaching point matches; add "closed is more common" |
| §4.7 over-pressure bursts hose | also **portable pump casing fractures if relayed into over-pressured** (L3861) | Event for relay-to-portable scenario |
| §5 Scoring: "crew left without water" | manual: **keep a crew-protection reserve** in bush ops; advise OIC if tank will run short (L2105, L3074–3079) | Score *over-draining* tank below a reserve; and *not telling OIC* (comms action) |

**Things in the manual with no home in ARCHITECTURE yet**
- **Recirculation / bypass valve** and **pump-to-tank (bypass)** valve being left open as a fault (Table 6: "high rpm and low delivery pressure").
- **Tank-fill / back-fill** while on hydrant (L3102, L3641–3645; and "pressurised supply fed into tank rather than pump", L1095–1098 — avoids surge but wastes supply energy).
- **Tank → hydrant changeover surge** (L1083–1098): extra supply pressure *adds* to pump pressure at the branch → dangerous jump; mitigations are relief valve and valve-opening sequence. Strong scenario 3 content.
- **Pump engagement sequence** (park brake, neutral, idle, engage, top gear) — optional "pre-flight" step; skip for v1 unless Dek wants it. Rural tankers (the likely focus) have **independent diesel pumps** (L2902–2911) so no gearbox sequence there.
- **Series/parallel (volume/pressure) mode** — a two-position panel control on some pumps; parallel for relay/general, series for high-pressure hose reels (L1639–1641). Candidate later input.
- **Hose reels** (high-pressure, small bore, can run above 1000 kPa, L1014–1016).
- **Delivery numbering** left→right facing the panel; supply inlets numbered the same way; radio calls "Water on, Line 3!" (L3446–3453). Matches the four-colour delivery scheme in DESIGN_BRIEF — number them as well as colouring.

---

## 6. Hydraulic behaviours to implement — manual-faithful definitions

1. **Gauge response (L3504–3511).** Branch open, ↑rpm ⇒ delivery ↑ and **inlet ↓** (more negative / lower residual). ↓rpm ⇒ delivery ↓ and inlet ↑. Throttle fixed: **opening a line drops delivery pressure; closing one raises it.** (Your quasi-steady solver will do this naturally; add as explicit tests.)
2. **Static vs dynamic pressure on valve operations (L3379–3386).** Opening another delivery steals pressure from lines already running; operator compensates with throttle. This is the main skill in scenario 2.
3. **Hydrant:** inlet gauge positive; "the greater the positive reading, the more water available" (L3613–3614). Over-run ⇒ inlet 0, supply hose soft, cavitation (Table 7 row 2).
4. **Draught:** inlet gauge negative ≈ −10 kPa/m lift + friction/strainer; blocked suction ⇒ more negative, air leak ⇒ goes to 0 (L1206–1208). Blocked strainer / dropping dam level ⇒ more negative at constant rpm, falling flow (Table 8).
5. **Relay link:** lengths = (600 ± 10·Δh) / (FL per length). Positive head = gain downhill. Booster failure ⇒ ~30 % less flow.

---

## 7. Fault tables → scenario events & debrief text (Tables 6–8, L3535–3740)

Each row is `indication → cause → action`. These map almost 1:1 to `SimEvent`s plus a "why" string for the debrief.

**Tank supply (Table 6)**
- *High rpm, little/no delivery pressure* → inlet blockage / tank-pump valve problem → clean strainer (also: tank valve closed ⇒ inlet **more negative**; inlet **zero** ⇒ tank empty, pump not engaged or not primed).
- *High rpm, low delivery pressure, water flowing* → wrong gear, no branch fitted, over-sized branch, **burst hose**, relief set wrong, **pump-to-tank bypass open**.
- *High delivery pressure, reduced flow* → all branches shut → reduce throttle / **open recirc**. *Little flow + pump hot* → hose kinked/blocked → release water to cool.
- **Cavitation** → partial inlet blockage or trying to deliver more than is available → reduce rpm until gauges steady and noise stops.

**Hydrant (Table 7)**
- *Inlet zero, supply hose soft, cavitation* → inlet valve/hydrant not fully open, supply failed/over-used → open fully, try another hydrant (esp. lower elevation).
- *High negative inlet, supply hoses hard* → supply hose too small/too few, **water back-filling into tank through an open valve** → twin/larger hose, close tank valve.
- *Delivery pressure low + inlet residual dropped* → extra branches opened → raise rpm, else tell OIC to shut a line.
- *Both gauges rise* → branches shut, blockage (vehicle on hose), **or another pump further ahead in relay not using its water** → reduce rpm, shut down deliveries, communicate.

**Draught (Table 8)**
- *Delivery pressure rises* → all branches shut → reduce throttle / recirc.
- *Inlet less negative* → blocked hose/branch, or upstream relay pump not using water.
- *Constant rpm, flow falls, inlet more negative* → dam level / tide dropping → relocate pump. *Delivery falls* → suction blockage or strainer clogged → clear.
- **Loss of prime** → zero inlet and delivery, rpm surge/noise → replace suction hose (couplings), submerge hose deeper (vortex), relocate pump, add suction length.

**Prime failure causes (L3265–3276)**: loose couplings; damaged suction hose; leaking delivery valve (live reel, outlet, wheel spray, cab spray); faulty primer; wrong valves open; air pocket in suction; lift > 7.5 m; suction not submerged; blocked strainer. Good randomised "why won't it prime" events. Note the manual's hint that *air is far less viscous than water, so a drip becomes a big air leak under priming* (L3203).

---

## 8. Procedure & scoring hooks (beyond physics)

Manual-backed behaviours the game can measure:

- **Water-on discipline:** don't send water until the branch operator signals; before the signal keep branch pressure ≤ 550 kPa (controlled) / ≤ 400 kPa (open) (L3389–3418). *Scoring:* penalty for over-pressure before "water on"; scenario beat where the operator calls "water on, Line N" and you respond.
- **Charge gradually:** during charging the energy is velocity, not pressure; pressure builds fast at the branch. Charge slowly, or fast then back off as water reaches the nozzle, then ramp to optimum (L3404–3411). *Hook:* line "charging" state with a short window.
- **Compensate throttle when valves change** so branch pressure stays constant (L3466–3469, L3435–3436).
- **Hold the optimum pressure for the biggest branch** when mixed (L3437–3439); a pump can't safely serve high-pressure/high-volume and low-pressure/low-volume together (L3440–3442).
- **Don't over-commit the tank**; estimate remaining duration; keep a reserve; tell OIC if short (L3058–3080, L2105).
- **Watch the oil-pressure and temp gauges** (L2128–2143): falling oil pressure ⇒ shut down once branch operators are safe, advise OIC. *Optional extension gauges.*
- **Siting** (L3020–3050): safety/escape-route/wind/uphill is a pre-scenario "place the truck" mini-game candidate. Out of scope for v1 but a fun later idea; also "set up closer to a weak water supply".
- **Relay comms:** "Good communication is the secret to successful relay pumping" (L3856). Relay scenario should include radio calls (text) from the other operator.
- **Throttle behaviour:** gradual changes avoid pressure surges; older slide-lever throttles are "erratic", Vernier/electronic fix it (L2358–2361); pushing the Vernier in returns to idle as a safety shutdown (L2353–2354). Our throttle UI could offer the **idle button** shortcut.

---

## 9. Terminology to use in UI copy (manual vocabulary)

*delivery / delivery outlet / delivery line*, *branch* (not nozzle, except orifice maths — the manual itself says "branch" for the device, "nozzle" for the tip), *compound gauge* (inlet) vs *pressure gauge* (delivery), *draughting*, *lift*, *static/dynamic/residual pressure*, *over-running the supply*, *water on*, *base pump / booster pump / incident-ground pump*, *open-circuit / closed-circuit relay*, *pressure-relief mechanism*, *recirculation valve*, *tank-to-pump valve*, *suction strainer*, *hard suction hose* (draught) vs *layflat/soft supply hose* (hydrant), *collecting head*, *blanking cap*, *Officer in Charge (OIC)*, *Cat 1 / Cat 7 / Cat 9* tankers. (Glossary: Appendix A, L4469–4618, not read — worth a skim before UI copy is final.)

---

## 10. Source errata (don't trust blindly)

- Nozzle formula missing `√` (L462) — see §1.
- "7 m of air ≈ 250 kPa" (L1139–1140) is wrong; 7 m ≈ 70 kPa. Principle stands.
- Lift table appears twice (Table 4 L1179, Table 5 L3234) — identical.
- Body text cites tables by the wrong number (friction table "Table 2/3").
- Suction-submergence rule given as 3× strainer depth (L3167) *and* 3× hose diameter (L3275).
- Hydrant reserve-flow bands: last band wording is vague (L3126). Treat as ">25 % ⇒ less than original flow available" (inferred).
- Creek example (L1281–1285) repeats the cylinder calc; "Error! Reference source not found" at L1293, L1653, L1773.
- Table 3 header scramble (see §3); Figs 11, 12–14, 33–36, 44, 52–53 are images with no data in the text.

---

## 11. Suggested next steps (not done — for Dek's decision)

1. **Decisions:** made — see §0. Still open: number of 30 m lengths per tutorial line (suggest 2, §4a).
2. **Supply from Dek (GAPs):** pump curve (shutoff pressure, rated flow at 3 m lift and 700 kPa?), engine idle/priming/max rpm, tank capacities and reserve %, tank-pump inlet reading at flow, pump temp thresholds, hydrant static pressure ranges, series/parallel relevance for the Cat 1 (target appliance decided, §0).
3. **Visually verify Table 3 on PDF p32** and lift Table 4 on p38 before locking calibration tests.
4. **Docs to update when M0/M1 starts** (not edited now): ARCHITECTURE §4.2, §4.4 (relief valve model), §4.5 (units, auto-branch), §4.3 (hydrant model, tank inlet sign), §4.6 (recirc valve in `PlayerInputs`), §6 (calibration example). Create `docs/CALIBRATION.md` from §4 above.
5. **PLAN impact (minor):** M1 "Calibration tests ≥ 5" is easily met by C1–C10. M2 gains a recirculation valve + relief lamp. M4's cavitation/overheat/water-hammer items now have manual-backed symptoms. M5 relay spec is concrete (C12, C13, shutdown sequence). Suggest adding a "tank→hydrant changeover surge" lesson to the scenario 3 spec.
