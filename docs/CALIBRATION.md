# Calibration

The single source of truth for the sim's numbers (`ARCHITECTURE.md`). Constants carry the same status as the code comments:

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
| Relay design pressures | 700 kPa out, 100 kPa minimum residual in, 600 kPa budget between pumps | L3794–3796 | doctrine-confirmed |
| Hose working pressure | 1000 kPa (a quarter of the ~4000 kPa rated burst); the receiving pump is warned above it | L945–948 | doctrine-confirmed |
| Relay hose burst | 1300 kPa peak (steady, or the higher end before plus the Joukowsky surge of a flow cut by a valve shut on the receiving pump) | L3865–3873 qualitative | PLACEHOLDER — needs Dek |
| Lesson branch band | Table 1 optimum ± 10 % (`BRANCH_BAND_FRACTION`) | — | PLACEHOLDER — needs Dek |
| Casing water (display only) | the casing stays full once water reaches it; with no feed, an open line (with a hose) or pump to tank empties it in one tick; no gravity drain, no drain cock | — | PLACEHOLDER — needs Dek |
| Pump damage (lesson fail) | 60 s cavitation or 60 s above temperature caution, summed | — | PLACEHOLDER — needs Dek |

### Hose friction coefficients

These are least-squares fits to Table 3 (p32, kPa per 30 m length), divided by 30. Table 3 was checked against the page image on 2026-10-24, and it matches the notes. Fit scatter is ≤ ±10 %.

| Hose | k_m (kPa per (L/min)² per m) | Check point (manual) |
|---|---|---|
| 25 mm lined `25L` | 3.60e-4 | 150 L/min → 250 kPa/length (L928) |
| 25 mm unlined `25U` (bush canvas, percolating) | 1.0e-3 | **PLACEHOLDER — needs Dek** (row 50): Table 3 has no 25 mm unlined column; 25L × 2.8, the unlined:lined ratio at 38 and 65 mm, so 150 L/min → ~680 kPa/length (`calibration.test.ts`) |
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
| C15 | Cat 1 rated duty at max rpm | 1000 kPa at 1200 L/min | 1000 (±1) | data plate (`Cat1B_Panel.jpg`) |
| T4 | Capacity at lift vs at 3 m, flat out: 4.5 / 6 / 7 m | 6/7 / 2/3 / 1/2 | within 5 % | Table 4, L1179–1194 |

Table 4 is reproduced by one figure, the inlet pressure the pump cavitates at: the flow a draught can give is `√((−P_cav − 10·lift)/R)`, so its ratio to the 3 m flow doesn't depend on the suction hose. −84 kPa fits 4.5–7 m (fits per row: 86.5, 84, 83.3). At 7.5 m it keeps 43 % against the manual's 33 % (a −81 kPa fit); not asserted, needs Dek.

Not yet asserted (it needs a later milestone): C15 open-water capacity (M6).

### Filling hoses (issues #6, #8; asserted in `lineFill.test.ts`, `priming.test.ts`)

| # | Setup | Expected | Sim | Basis |
|---|---|---|---|---|
| F1 | Cat 1 on tank, throttle 0.5, one 30 m length of 38 mm (34 L) from dry | fills when ∫Q dt = V; no branch flow before; steady C-row values after | to ±1 tick | conservation |
| F2 | Prime at 4 m on 2 × 3 m of 65 mm hard suction | Cat 1 ≈ 14 s, Cat 7 ≈ 30 s | 13.9 / 30.4 (±0.5) | placeholder targets |

* **Delivery lines** hold water (`SimState.lineWaterL`), conserved each tick: in through the delivery, out by the branch. While filling, the pump sees the valve, friction of the wet length only and the head up to the front; the branch vents air (orifice loss ∝ density, air ~1/830 of water), so no branch term. Full, the line solves as before. With nothing coming in, a downhill line drains through its branch under the head of the water left in it; a flat or uphill line keeps its water. In the traces: 3 × 38 mm (102 L) charges in ~14–18 s, 3 × 65 mm (299 L) in ~20 s; afterwards every reading matches the old steady values, except that the water now held in the hoses has come out of the tank or dam (tank attack runs dry at t = 238 s instead of 250 (239 before the tank head, #13)).
* **Hard suction**: the water stands vacuum/10 m up it (`suctionWaterFraction`). The primer's air balance counts the air the rising column squeezes (isothermal: `(V_air + p·V_hose/(10·lift))·dp/dt = −p·D`, `ATMOSPHERIC_KPA` = 101.3), which roughly doubles the time to prime at a given displacement; the displacements were re-tuned to keep F2 (Cat 1 1.5 → 2.9 L/s, Cat 7 0.6 → 1.3 L/s, test appliance 1 → 2 L/s). At the open relay's 1 m lift the column fills the suction at low vacuum, so the attack pump catches about a second later than before.

### Relay (asserted in `relay.test.ts`)

| # | Setup | Manual | Sim | Source |
|---|---|---|---|---|
| C12 | 700 kPa out, 65 mm at 100 kPa per length, 20 m up: residual after 4 lengths | 100 kPa (the 600 kPa budget) | 100 | L3813–3820 |
| C13 | Same, flat: residual after 6 lengths | 100 kPa | 100 | L3822–3827 |

Also asserted, on Cat 1 and the test appliance in both roles: the residual is discharge − valve − friction − head and matches the receiving compound to 1 %; water is conserved through a relay and a three-pump chain; uphill leaves less residual; over-running the relay reads inlet zero, hose soft, cavitating, with throttle adding no flow; slamming the relay inlet bursts the length by the pump; throttling down, easing shut, and the base pump running dry or shutting its tank-to-pump don't; an open relay flows by valve and hose alone into a tank or a portable dam, which overflow when full and drain when drawn faster than filled.

### Solver behaviour (asserted in `network.test.ts` and `engine.test.ts`)

These are the manual's gauge-response rules (L3379–3386, L3504–3511):

* Raising the throttle raises discharge and pulls the compound gauge lower.
* Opening another line drops discharge and the flow in lines already running.
* On every line, discharge = branch + valve + friction + head.
* The compound gauge reads the tank's head (`TankSpec.headM`) on tank supply with nothing flowing, slightly negative at working flow, and lower the more it flows (L3529; issue #13). The contract suite checks every appliance reads its head with tank to pump open and the engine cold.
* With tank-to-pump shut, or the tank empty, every gauge reads zero (Table 6).
* The relief opens above its set pressure and holds discharge near it.
* On a hydrant the compound reads its static pressure with nothing flowing and falls as more is drawn (L3613); over-run, it reads zero (Table 7).
* At the cavitation floor more throttle adds no flow and no discharge (L3353–3355); easing back below it stops the cavitation.
* An open delivery with nothing connected discharges to air through its valve alone (issue #16): discharge = valve loss. On a Cat 1 holding 700 kPa on one 38 mm line, opening the bare 65 mm takes ~1500 L/min and drops the discharge to ~30 kPa (`empty-delivery-open` fixture). It also stops the primer catching, as a hosed delivery does.

---

## Cat 1 tanker (`sim/appliances/cat1.ts`, id `cat1-generic`)

| Figure | Value | Status |
|---|---|---|
| Deliveries | d1 38 mm, d2 65 mm, d3 38 mm left to right on the manifold, each on a blue quarter-turn lever (no discharge master) | doctrine-confirmed (Dek, 2026-10-28, photos `Resources/Photos/Cat1B_*`; was 65/38/38 on the older `Cat1_*` truck); hose reels deferred |
| Pump shutoff (zero flow, max rpm) | 1400 kPa | PLACEHOLDER — needs Dek |
| Pump droop | 400/1200² ≈ 2.78e-4 kPa/(L/min)²: 1200 L/min at 1000 kPa at max rpm (C15, asserted in `calibration.test.ts`) | rated duty doctrine-confirmed (data plate "Village pumpset, Hatz 3L, 1200 LPM @ 1000 kPa", `Cat1B_Panel.jpg`, 2026-10-28); fitted through the placeholder shutoff |
| Engine idle / max | 800 / 3000 rpm | max doctrine-confirmed (panel "do not exceed 3000 RPM"); idle PLACEHOLDER — needs Dek |
| Engine | Hatz 3L, 3 cylinders (engine note only) | doctrine-confirmed (data plate) |
| Throttle → rpm lag | τ = 0.5 s | PLACEHOLDER — needs Dek |
| Engine stop | energise-to-stop: STOP works only with the ignition on, held until it has stopped | doctrine-confirmed (placard, Dek) |
| Cranking | fires after 1.5 s held at 200 rpm | PLACEHOLDER — needs Dek |
| Stop run-down | τ = 0.8 s with the fuel cut; picks up again if STOP is let go above 400 rpm | PLACEHOLDER — needs Dek |
| Tank | 3000 L | PLACEHOLDER — needs Dek |
| Tank head | water 1 m above the pump eye: +10 kPa compound at rest | PLACEHOLDER — needs Dek (49) |
| Tank-to-pump loss | −15 kPa compound at 1000 L/min | PLACEHOLDER — needs Dek (manual: "slight negative", L3529) |
| Primer | Electric rotary vane, max 60 s on in 180 s | doctrine-confirmed (L1890) |
| Relief | Preset (not adjustable), dumps to tank | doctrine-confirmed (L2322–2336) |
| Relief set pressure | 1100 kPa | PLACEHOLDER — needs Dek |
| Relief bypass slope | 50 L/min per kPa over set (holds ~15 kPa over set) | PLACEHOLDER — needs Dek |
| Gauge scales | discharge 0–2500, compound −100…1600 kPa, tacho 0–4000 rpm (the Cat1B's GAAM faces); tacho red from 3000 and compound red past −80 (the panel's limits); other zones in Needs Dek #9 | faces and limits doctrine-confirmed (photos, 2026-10-28); other zones PLACEHOLDER |
| Suction inlet | 65 mm with a green lever valve, low left of the bay, plated "EXTERNAL INLET TO PUMP"; 10 kPa at 1000 L/min through it | size doctrine-confirmed (Dek, 2026-10-25); loss PLACEHOLDER — needs Dek |
| Pump to tank | Blue lever above the suction inlet: a valved return from the discharge into the tank, ~500 L/min at 700 kPa (k = 2.8e-3 kPa/(L/min)²), 38 mm | function doctrine-confirmed (Dek, 2026-10-25); size and loss PLACEHOLDER — needs Dek #34 |
| Hydrant to tank | 65 mm coupling with a green lever on the side of the truck, straight into the tank past the pump; 30 kPa at 1000 L/min through it, water climbs 2 m into the tank | function and size doctrine-confirmed (Dek, 2026-10-25); loss, fill height and position PLACEHOLDER — needs Dek #35 |
| Cavitation inlet pressure | −84 kPa (the Table 4 fit for a generic pump) | PLACEHOLDER — needs Dek (the Cat 1 pump's own) |
| Primer performance | best vacuum 80 kPa (primes to just under 8 m), 2.9 L/s of air (≈ 14 s at 4 m on 6 m of hard suction, counting the rising column; was 1.5 L/s before it was counted) | PLACEHOLDER — needs Dek |
| Casing volume / churn heat | 10 L; 10 kW at max rpm (≈ 4–5 min churning to the amber lamp at 0.8 throttle) | PLACEHOLDER — needs Dek |

**Tank-attack trace** (`src/sim/scenarios/__traces__/tank-attack.cat1-generic.csv`), since issue #10: two bush lines, each one length of 25 mm canvas with a 12 mm branch, crew 1 on d1 and crew 2 10 m downhill on d3 (both 38 mm outlets through the adaptor; crew 1 was on d2 before the Cat1B renumbering, no value moved).

| Phase | Discharge | Flows (d1 / d3) | Branch (crew 1 / crew 2) |
|---|---|---|---|
| Crew 1 only, throttle 0.75 | 937 kPa | 151 / 0 L/min | 248 kPa |
| Second line opened, throttle 0.75 | 916 kPa (sag 21) | 150 / 158 L/min | 243 / 269 kPa |
| Throttle 0.8 | 1000 kPa | 156 / 164 L/min | 265 / 291 kPa |

Crew 2's branch reads ~26 kPa over crew 1's: the 10 m drop less the extra flow it takes. The bush lines draw ~320 L/min, so the tank doesn't run dry in the 300 s trace (1573 L left). Before issue #10 (38 mm and 65 mm lines, ~890 L/min) it ran dry at t = 239 s and the second line sagged the pump ~200 kPa. M4 appended columns (per-inlet flow, primed, vacuum, cavitation, pump temperature); the earlier columns are unchanged.

**Cat1B pump curve** (2026-10-28): the droop refit to the data plate's 1200 L/min at 1000 kPa (from 1000 at 1000; shutoff unchanged) flattens the curve, so every Cat 1 trace with flow reads higher. At bush-line flows the change is a few kPa (tank attack 987 → 1000 kPa at throttle 0.8; first line 934 → 937); it grows with flow: hydrant-tank village lines 871 → 913 kPa; closed relay at full throttle 811 → 868 L/min through the attack pump's relief (base 536 → 585 kPa); open relay fill 668 → 717 L/min (base 323 → 358 kPa); the hydrant over-run at full throttle cavitates harder (0.27 → 0.57). Churn and shutoff readings don't move. The hydrant lesson's scripted solution now eases crew 2's line open over 15 s instead of 10 (an empty line filling under the stronger pump briefly over-ran the village main). The delivery renumbering before it (d1 38, d2 65) only swapped the d1/d2 trace columns. The paragraphs below give the pre-Cat1B figures where not restated.

**Hydrant trace** (`hydrant-supply.cat1-generic.csv`), since issue #10: the village main (300 kPa static, 200 at 600 L/min, row 52), 2 × 30 m 65 mm layflat; two village lines (3 × 30 m 38 mm, 15 mm branch). One line at throttle 0.4: compound +261 kPa, discharge 671, 271 L/min. Both lines, full throttle: over-run, compound 0, 694 L/min, cavitation 0.27; throttle 0.5 recovers (compound +158, branches 298 kPa). Before issue #10: the C14 hydrant, a 65 mm line with a 25 mm branch and a 38 mm line, over-run at 1090 L/min.

**Draughting trace** (`draughting.cat1-generic.csv`): dam 4 m below the pump, 2 × 3 m hard suction, two bush lines (one length of 25 mm canvas, 12 mm branch, since issue #10). Primer held from t = 1 s; primed at t ≈ 16 s, compound −40 with nothing flowing. One line at 0.6: 652 kPa, 126 L/min, compound −41. Both lines at full throttle: 1108 kPa (on the relief), 164 L/min each, compound −68 and no cavitation once they're charged; the cavitation in the trace (to 0.65) is the second line filling under full throttle. Before issue #10 (38 mm and 65 mm lines) the same script drew 944 L/min and cavitated at the 4 m lift; two bush lines can't (row 53).

**Closed-relay trace** (`closed-relay.cat1-generic.csv`): base pump primed at the dam (2 m lift, held at throttle 0.65 since issue #10), 4 × 30 m 65 mm up 20 m to the attack pump's suction inlet; the attack pump runs two bush lines. One line at 0.4: attack 961 kPa, 153 L/min, residual 531 kPa, base 743. Both lines at 0.45: attack 998, 312 L/min, branches 264 kPa, residual 538, base 788. Full throttle: the attack pump's relief opens (1110 kPa) and dumps to tank, pulling the relay to 811 L/min: compound 0, cavitation 0.06; back at 0.45 it recovers. Before issue #10 (heavy lines, base at 0.8) the relay carried 822 L/min with 151 kPa residual at 0.6. The mixed traces (`…cat1-generic+test-2d.csv`, `…test-2d+cat1-generic.csv`) follow the same shape.

**Open-relay trace** (`open-relay.cat1-generic.csv`): base pump on the hydrant (throttle 0.2) fills a 5000 L portable dam (2000 L at the start, 1 m lift) at ~668 L/min through 4 × 30 m 65 mm up 10 m; the attack pump primes on it and runs two bush lines. One line (129 L/min), both at 0.6 (2 × 127) and both at full throttle (2 × 165) all draw less than the relay brings, so the dam fills throughout (3740 L at t = 300 s). Before issue #10 (heavy lines) both at full throttle drew 1035 L/min and drained it at ~375 L/min (row 53).

**Tank refill** (the `tank-refill` free-play trace, retired with that scenario in issue #10; the refill and overflow fixtures and journey now use `hydrant-tank`'s fireground): 400 kPa hydrant, 2 × 30 m 65 mm layflat to hydrant to tank, tank at 500 L. Half open: 922 L/min; fully open: 1032 L/min, which is the closed form √((400 − 20)/(main + hose + valve)) to 0.1 L/min, with the engine at idle and the pump dry. The tank is full at t ≈ 149 s and overflows: hydrant to tank keeps reading 1032 L/min with the tank full (to the end of the trace), the excess going out the overflow until the player shuts it. Since issue #18 the excess is kept as `spilledL`, the pool round the truck, and its rate as `readings.overflowLpm` (`stepStore`, `sim/tank.ts`): each tick adds what the full tank couldn't hold, (in − draw)·dt, and the pool soaks away as `spilledL·e^(−dt/τ)`, τ = `SPILL_SOAK_TAU_S` = 5 s (Dek, 2026-10-27: quick on purpose, so the pool follows the overflow). Worked example: 1032 L/min into a full tank is 17.2 L/s, and the pool settles at 17.2·τ = 86 L within a few τ of filling (the ticked sum, 1.72/(1 − e^(−0.02)) = 86.9 L, is what the trace's `spilledL` column holds from t ≈ 170 s). Shut, it's down to e⁻³ ≈ 5 % after 3τ = 15 s (contract suite). Through the pump instead (suction + pump to tank at throttle 0.3) the same hydrant gives ~455 L/min (`sim/tankFill.test.ts`). Hydrant to tank also added an `inletLpm.hydrant-to-tank` column (0, after the other inlets) to every other Cat 1 trace.

Tank overflow (issue #18) appended a `spilledL` column to every truck in every trace, and `source.<id>.spilledL` for each portable dam; no other value moved. It is non-zero wherever a full tank is filled faster than it's drawn: the retired tank-refill trace (settling at overflow × τ, as above), `hydrant-tank.cat7-generic` (from t ≈ 171 s until two lines out-draw the hydrant), the open relay's base pump (~30 L: its hydrant puts ~1030 L/min into a full tank it draws ~660 L/min from, needs Dek 48), and 2–3 L on Cat 7 runs whose recirculation (~25 L/min) returns into a full tank while the pump works off a hydrant or draught. The scene draws a pool from 4 L (~50 L/min overflowing) and the overflow is heard from 50 L/min (`state/spill.ts`, `audio/params.ts`), so the recirculation's trickle is neither seen nor heard.

Pump to tank (2026-10-25) added a `pumpToTankLpm` column (after `reliefLpm`) to every Cat 1 trace; it is 0 throughout, and no other value moved. Its behaviour is asserted in `sim/tankFill.test.ts`: Q = open·√(P_d/k), recirculating on tank holds the level, refilling from a hydrant at the return flow, overflowing when full, cooling a churning pump (5 min at 0.8 throttle: > 10 °C cooler cracked 20 %), and blocking the primer.

## Cat 7 tanker (`sim/appliances/cat7.ts`, id `cat7-generic`)

From Dek's photos (`Resources/Photos/Cat7_*`, 2026-10-25): the pump's own panel, the bay, and the hydraulic diagram plate on the locker door. Figures not in the photos are sized for a small single-stage pump that can run two crew lines.

| Figure | Value | Status |
|---|---|---|
| Pump drive | Separate air-cooled diesel with its own panel: IGN / ALT / START, oil lamp, STOP T-handle, hour meter, vernier THROTTLE (RELEASE · HOLD) | doctrine-confirmed (photo); engine controls not modelled |
| Engine max | 3600 rpm (placard: "do not exceed 3600 r/min") | doctrine-confirmed (photo) |
| Engine idle | 1200 rpm | PLACEHOLDER — needs Dek |
| Throttle → rpm lag | τ = 0.4 s | PLACEHOLDER — needs Dek |
| Engine stop | mechanical T-handle on the fuel rack: works with the ignition off, held until it has stopped | doctrine-confirmed (photo, Dek) |
| Cranking | fires after 1.2 s held at 300 rpm | PLACEHOLDER — needs Dek |
| Stop run-down | τ = 0.5 s with the fuel cut; picks up again if STOP is let go above 600 rpm | PLACEHOLDER — needs Dek |
| Cylinders (engine note) | 1 | PLACEHOLDER — needs Dek |
| Pump shutoff (zero flow, max rpm) | 1400 kPa | PLACEHOLDER — needs Dek |
| Pump droop | 700/550² kPa/(L/min)², i.e. rated ~550 L/min at 700 kPa | PLACEHOLDER — needs Dek (sized so the 38 mm crew line and the light line run together, row 39) |
| Tank | 1600 L | PLACEHOLDER — needs Dek |
| Deliveries | d1, d2: two outlets with blue ball-valve levers on the manifold; 38 mm from the couplings | arrangement doctrine-confirmed (photo); size PLACEHOLDER — needs Dek; the hose reel's valve is deferred |
| Tank to pump | Butterfly valve with a yellow, green-tipped lever on the pipe down from the tank; 6 kPa at 400 L/min | valve doctrine-confirmed (photo, diagram); loss PLACEHOLDER — needs Dek |
| Suction inlet | 65 mm on a butterfly valve with a notched yellow lever, then a check valve and the DN65 Y-strainer on the pump's eye; 10 kPa at 400 L/min | arrangement and size doctrine-confirmed (photo: strainer marked DN65); loss PLACEHOLDER — needs Dek |
| Hydrant to tank | 65 mm coupling and valve straight into the tank; 60 kPa at 400 L/min; 1.5 m up to the top of the tank (~740 L/min from the scenario hydrant on 2 × 65 mm) | function and 65 mm size doctrine-confirmed (Dek, 2026-10-27: hydrant connections are always 65 mm); loss, height and position PLACEHOLDER — needs Dek (46) |
| Pump to tank | Ball valve from the discharge up into the tank; 25 mm, ~200 L/min at 700 kPa | function doctrine-confirmed (diagram); size and loss PLACEHOLDER — needs Dek |
| Tank recirculation (`recirc`) | The 3-way valve at TANK RECIRC: a bleed through a check valve into the tank, ~30 L/min at 700 kPa, always flowing | function doctrine-confirmed (diagram, tag on the pump); flow PLACEHOLDER — needs Dek (row 38) |
| Relief | None fitted | doctrine-confirmed (photos, diagram) |
| Primer | Hand diaphragm (`diaphragm`), the red pump with a long handle left of the outlets; best vacuum 75 kPa, 1.3 L/s (≈ 30 s at 4 m; was 0.6 before the rising column was counted) | that it is the primer and its performance PLACEHOLDER — needs Dek |
| Cavitation inlet pressure | −84 kPa (the generic Table 4 fit); the placard's −80 kPa is drawn red on the compound | PLACEHOLDER — needs Dek |
| Casing volume / churn heat | 4 L; 5 kW at max rpm | PLACEHOLDER — needs Dek |
| Gauge scales | compound −100…1600, pressure 0–1600 kPa (the fitted faces), compound red past −80 (placard), no tacho | doctrine-confirmed (photo) |
| Tank gauge | A sight tube, assumed | PLACEHOLDER — needs Dek (none shows in the photos) |

**Recirculation** (asserted in `sim/recirc.test.ts` and the contract suite): Q = √(P_d/k) whenever the pump has water; drawn through the inlets and back into the tank (the level holds on tank supply, the tank fills while draughting); it cools a churning pump with no relief (10 min at full rpm with every delivery shut stays under the 60 °C lamp; without it the pump passes it); behind its check valve it lets no air in, so the primer still catches. It adds a `recircLpm` column (after `pumpToTankLpm`) to every Cat 7 trace.

**Lesson lines**: until issue #10 the Cat 7, with no 65 mm outlet, ran a light line (two lengths of 25 mm lined, 12 mm branch, `LIGHT_LINE`) where a lesson ran 65 mm. Lessons now run bush lines (25 mm canvas) or village lines (38 mm) on any appliance, so the light line is gone.

**Tank-attack trace** (`tank-attack.cat7-generic.csv`): the two bush lines on d1 and d2.

| Phase | Discharge | Flows (d1 / d2) | Branch (crew 1 / crew 2) |
|---|---|---|---|
| Crew 1 only, throttle 0.75 | 902 kPa | 148 / 0 L/min | 239 kPa |
| Second line opened, throttle 0.75 | 753 kPa (sag 149) | 136 / 144 L/min | 199 / 226 kPa |
| Throttle 0.8 | 814 kPa | 141 / 149 L/min | 216 / 242 kPa |

Recirculation takes ~25 L/min throughout. The smaller pump sags more when the second line opens, and the lesson's operator holds both branches in band at a higher throttle.

**Other traces** (Cat 7, before issue #10: the 38 mm line and the light line): on the 400 kPa hydrant the Cat 7 couldn't over-run it (compound +285 kPa, 543 L/min at full throttle; its pump tops out near 780 L/min); draughting at 4 m: primed at t ≈ 32 s by the hand primer (the Cat 1’s electric primer: ≈ 16 s), both lines at full throttle −64 kPa and 483 L/min, no cavitation; closed relay: residual 345 kPa with both lines at 0.6, 118 kPa at full throttle; open relay: the dam fell slowly at full throttle. Since issue #10 the Cat 7 runs the same bush and village lines as the Cat 1, which draw less still, and on the village main its compound stays positive at full throttle. The generic over-run tests use bigger lines or a weaker hydrant (`withBigLines`, `state/warnings.test.ts`), and the fault fixtures and journeys the heavy pair (`scenarios/heavyLines.ts`).

---

## Needs Dek

1. **Cat 1 pump curve**: rated duty now from the Cat1B data plate (1200 L/min at 1000 kPa, row C15). Still needed: shutoff pressure (1400 kPa, which sets the droop through the rated point), idle rpm, engine response, and whether the plate's duty is at 3000 rpm.
2. **Cat 1 tank capacity** and crew-protection reserve.
3. **Relief set pressure** and how sharply it holds.
4. **Tank-to-pump inlet reading** at typical flows.
5. **Delivery valve loss** when fully open, per size.
6. **Dry-pump behaviour.** At the moment, tank-to-pump shut or tank empty means every gauge reads 0 at once. Real behaviour, such as a brief run-down or a full casing holding pressure with the inlet shut, is for M4, alongside cavitation.
7. **Trace branch choice**: 12 mm on the bush 25 mm line and 15 mm on the village 38 mm line, both from Table 1 (issue #10; before it, 15 mm on 38 mm and 20 mm on 65 mm). Is that representative of what a Cat 1 crew would run?
8. ~~**Cat 1 delivery sizes**~~ Resolved (Dek, 2026-10-25): 65/38/38 mm, the nominal 2½" and 1½" sizes. Moving d1 and the suction from 64 to 65 mm lowered d1's valve loss by (64/65)⁴ ≈ 6 %; every Cat 1 golden trace moved by ≤ 1.1 (kPa, L/min or L), except the incident, whose hydrant changeover now fires 2 s later (t = 84 s, a hold condition near a band edge) and so ends with 26 L less in the tank. Since 2026-10-28 the Cat 1 follows the Cat1B: 38 | 65 | 38 left to right, numbered d1–d3 in that order (Dek).
9. **Gauge zones** (`instruments[].scale` on each spec; `ui/panel-pump/gauge/dials.ts` builds the faces from it). The Cat 1 faces are the Cat1B's GAAM gauges (2026-10-28: compound −100…1600 kPa, pressure 0–2500 kPa, tacho 0–4000 rpm), with red past the panel's −80 kPa and 3000 RPM. Still guessed: compound amber −80…−70; discharge amber 1100–1400 (relief set to shutoff), and no discharge red band. Do the real faces carry any coloured zones, or should these go?
10. **Low-tank warning** at ≤ ¼ tank (`state/tankLevel.ts`, from the Design spec). Is there a doctrine crew-protection reserve to warn at instead?
11. **Panel conventions** (Design OPEN_DECISIONS #1, #4): handles coloured by function (outlets blue, inlets green) with delivery identity by glyph and tag; push-pull T-handle throttle; tank-to-pump toggles on a tap while deliveries are drag-only. Partly answered (Dek, 2026-10-25): the Cat 1 throttle is a momentary speed controller (the realistic view has it; the simplified panel keeps the T-handle) and PRIME is a pull-and-hold handle. Still to confirm: tap-to-toggle on inlets, pump to tank and hydrant to tank.
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
22. **Relay hose burst** (M5): 1300 kPa peak in a 65 mm relay, the surge taken per tick like water hammer (row 21). It separates a slammed relay inlet (~1700 kPa: ~700 at the pump plus ~1000 surge at 800 L/min) from a relay eased shut or held dead-headed (~900–1120 kPa, a Cat 1 base pump through its relief). Does in-service layflat burst anywhere near that, and should the shutdown spike be judged against the hose's rating or a test pressure?
23. **Relay scenarios** (M5): the closed relay's base pump is already primed at the farm dam (2 m lift, 2 × 3 m hard suction) and holds throttle 0.65 (~720 kPa at its delivery on a Cat 1 with the attack pump drawing both bush lines; 0.8 before issue #10, which with bush lines pushed the attack pump onto its relief); the open relay's base pump is on the 400 kPa hydrant at throttle 0.2; the portable dam holds 5000 L (2000 at the start) with its water 1 m below the attack pump's inlet, one 3 m length of hard suction over the wall. What does a Cat 1 carry (portable dam size, hard suction), and how would a base pump operator set up?
24. **Receiving pump's relief on shutdown**: on a Cat 1 receiver, slamming its *lines* shut opens its relief (dumping to tank), so the relay keeps flowing and no burst; only the inlet slammed shut bursts the relay. Is that how a real relief behaves under a relay, and should relief dumped into a full tank overflow?
25. **Relay procedure**: the fill sequence (500 kPa until every pump has water, then 700, L3850–3853), radio calls and the booster-failure loss (~30 %, L3881) aren't modelled; support trucks hold fixed settings. Which of these matter for the first relay scenarios (M6)?
26. **Relay display**: a closed relay is drawn charged once pressurised, even before the receiver draws; an open relay only while water flows. A burst length is drawn as a jet near its end of the hose, and the relay can't be repaired in play (reload the scenario). Right conventions?
27. **Relay burst vs closure time** (PR #4 review): the surge in row 22 is taken per tick, like row 21, but a burst is latched with no repair (row 26), so a tick-size artefact becomes permanent. The review measured ~1800 kPa for a single-tick slam at any dt from 0.02 to 0.2 s and no burst for a 3 s ease at any dt; by inference (untested) a closure over ~0.5 s is seen as several small steps and likely under-predicted, since 2L/a for 120 m of layflat is about 1 s. Should "instant closure" be judged against the hose's 2L/a (row 21's proposal) before a burst is decided?
28. **Lesson targets** (M6): a branch counts as "at working pressure" within ±10 % of its Table 1 optimum (`BRANCH_BAND_FRACTION`: 315–385 kPa for a 15 mm tip). Is that the tolerance an instructor would accept, or should it be a fixed ±kPa, or tighter for experienced players?
29. **Pump damage** (M6): a lesson fails after 60 s of cavitation or 60 s above the 60 °C temperature caution, summed over the scenario (`PUMP_DAMAGE_CAVITATION_S`, `PUMP_DAMAGE_OVERHEAT_S`). Deliberately gentle; how long does a real pump survive either?
30. **Hydrant lesson** (M6, reworked in issue #10): "a healthy reserve" is the compound above 100 kPa with crew 1's 38 mm branch at working pressure, and "not over-running" with both crews at working pressure is the compound above 50 kPa (row 52 for the main). Should the lesson use the reserve-flow rule (drop from static: < 10 % ⇒ 3× flow left …, L3121–3126) instead of fixed readings? The tank-to-hydrant changeover surge (L1083–1098) is still not modelled, so the incident's changeover doesn't punish opening the hydrant before shutting the tank.
31. **Closed-relay lesson** (M6; issue #10 changed its lines): with two bush lines in band the relay carries only ~300 L/min, so the residual is high (~500 kPa) and the lesson's over-run and burst can't happen (row 53). The base pump holds 0.65 and raises to 0.7 (~800 kPa on a Cat 1) by radio once both attack lines flow (before issue #10: 0.8 raised to 0.9, for ~880 L/min of heavy lines) (the fill sequence, L3850–3853), which also changed the closed-relay golden traces from t = 40 s. Is 800+ kPa at the base pump realistic here, or should the scenario use shorter lengths, less climb or a second relay line? A burst length is replaced after 30 s (`REPAIR_S`); how long does a crew take?
32. **Incident** (M6; the urban interface since issue #10): crew 1 is on three lengths of 38 mm rubber at the houses and advances 10 m up the slope with a fourth (~930 kPa at the pump); crew 2 runs one length of 25 mm canvas onto spot fires in the yards; the hydrant is 400 kPa static on two lengths of 65 mm into hydrant to tank. Representative? (Crew 1 can't be on 25 mm canvas: two lengths lose ~1400 kPa.)
33. **Scoring** (M6, UI tuning): 60 points for objectives, 40 for clean running less cavitation ½ point/s (cap 10), overheat ½/s (cap 5), water hammer 5 each (cap 10), relay bursts 10 (cap 10), crews without water ½/s (cap 5); a failed run keeps its objective points only; 2 stars at 75, 3 at 90. Does that weighting match what an instructor would mark down hardest?
34. **Pump to tank** (`ApplianceSpec.pumpToTank`): the Cat 1's is taken as a 38 mm return passing ~500 L/min at 700 kPa. What does it really pass? And when it's open while priming, the sim treats it as an air leak (the primer can't catch, like an open delivery), on the basis that operators close it first. With water in the tank above the pump, would opening it instead flood the casing (no priming needed)?
35. **Hydrant to tank** (`InletKind 'tankFill'`): which side of the Cat 1 is it on and where (the scene puts it on the left, forward of the suction)? Its loss is taken as 30 kPa at 1000 L/min and the water climbs 2 m into the tank, so a 400 kPa hydrant on two lengths of 65 mm fills at ~1030 L/min, over twice what the pump-to-tank route gives at a gentle throttle. Realistic? A hydrant may feed only one hose for now (two hoses on one main would share its loss, which isn't coupled yet).
36. **Speed controller** (realistic Cat 1 panel, `EngineSpec.speedController` in `sim/appliances/cat1.ts`): held, it runs the governor at 400 rpm/s (idle to max in ~5.5 s); a flick moves it ~50 rpm. How fast does the real one ramp, and how big is a flick? With the engine stopped the switch does nothing, and the governor goes back to idle when the engine stops, so a restart begins at idle (Dek, 2026-10-31, issue #29); a cable throttle (Cat 7) keeps its setting.
37. **Realistic Cat 1 arrangement** (from the Cat1B photos, 2026-10-28; things not visible were placed by me): tank to pump (remote green lever) top left; the external inlet (the suction) low left, its riser joining the tank feed into the eye; the discharge off the volute's top, down to a manifold under the pump; pump to tank off the manifold's left end, running left into the tank in front of the external inlet's riser (as on the truck); outlets 38 | 65 | 38; the left reel teed off the discharge near the pump and the right reel off the manifold's right end, both inert. Simplified: the left reel is drawn above the discharge tee, not at the far left; hydrant to tank stays an inset; the sight tube is drawn beside the instrument panel. The panel keeps limits and labels only (no data plate or foam procedure placard, Dek); the stopping placard is kept from the earlier Cat 1 though the Cat1B panel doesn't carry one. ALTERNATOR and ENGINE FAULT light with the ignition on and the engine stopped, PUMP RUNNING while it runs (Dek); WATER TEMP, the foam metering knob and the reels are inert. The foam bypass isolation lever and the underbody foam select (inner/outer) aren't drawn.
38. **Cat 7 tank recirculation** (`ApplianceSpec.recirc`): the 3-way valve set to TANK RECIRC is taken as an always-open bleed through a check valve into the tank, ~30 L/min at 700 kPa. Is that the flow? Is it there to keep the pump cool (it's how a pump with no relief survives churning here)? FOAM ON (the bleed back to the suction through the proportioner) isn't modelled; the selector is drawn inert.
39. **Cat 7 pump and lessons**: the pump is sized at ~550 L/min at 700 kPa (shutoff 1400) so that the 38 mm crew line and a light line run together at working pressure. (Since issue #10 no lesson runs a 65 mm line, so `LIGHT_LINE` is gone; the rest of this row is history.) Where a lesson ran a 65 mm line, a Cat 7 crew ran two lengths of 25 mm with a 12 mm branch. What does a Cat 7 pump really deliver, and what would its second crew run? The 25 mm is chosen so both lines want the same pump pressure; with 38 mm and a 12 mm tip the gated delivery sits ~7 % open, which is very touchy. Note this is calibration driven by lesson content, not by the truck: the pump was sized up until the lessons could be won. The lesson flow targets are tuned the same way (`RESERVE_OF_WORKING`, `BOTH_65_OF_WORKING`, `BOTH_38_OF_WORKING` in `scenarios/hydrantSupply.ts` reproduce the Cat 1's 700 / 500 / 200 L/min); on the Cat 7 they come out at ~100 L/min on the light line. And the Cat 7 can't over-run the hydrant, draught or relay those lessons are built round, so it passes them without meeting their point: should those lessons be hidden or marked on a truck that can't show it, until there is a per-class variant?
40. **Cat 7 unknowns from the photos**: is the red diaphragm pump left of the outlets the primer (the diagram shows none)? Where is the tank level shown (a sight tube is assumed)? Are the outlets 38 mm? Which side of the truck is the bay's suction coupling (the scene puts it on the left at the rear)? Idle rpm, tank capacity, engine cylinders.
41. **Source tags for photo-read figures**: facts read off the Cat 7 photos (no relief valve, the dial faces, the 3600 r/min placard) carry `// doctrine-confirmed (photo)`. They are observations of one truck, not doctrine. Should they get their own tag (e.g. `// photo-read`), with CLAUDE.md rule 3 updated to match?
42. **Engine start and stop** (issue #19): cranking 1.5 s at 200 rpm (Cat 1) / 1.2 s at 300 rpm (Cat 7) before it fires; with STOP held the engine runs down with τ 0.8 s / 0.5 s and is stopped below 400 / 600 rpm (let go above that and it picks up again); a diesel stops dead below a tenth of idle (`ENGINE_AT_REST_FRACTION_OF_IDLE`). Real crank times, how long STOP must be held, and the speed below which letting go no longer restarts it? Does a cold engine need a preheat step (not modelled)?
43. **Primer and the engine** (issue #19, also in `docs/BACKLOG.md`): priming is independent of the engine. The manual calls the Cat 1's rotary vane primer electric (L1853–1908), which suggests it needs only the ignition, but is it engine-driven on our trucks, so no prime with the engine stopped?
44. **Line filling simplifications** (issue #6, `sim/lineFill.ts`): (a) no fluid inertia: the front moves at the quasi-steady flow (ρ·L·v/Δp ≲ 0.6 s on 120 m of 38 mm, against fills of 10–40 s); (b) plug flow, no water running ahead under the air at low flow; (c) **no surge when the front reaches the branch**: the column decelerating at the orifice gives a real spike, not modelled (and not counted as water hammer); how big is it on a 38 mm line at working pressure, and should it be taught?; (d) the branch is always open (a shut branch would fill by compressing the trapped air); (e) water leaves a line only by its branch, under its own head: a flat or uphill line shut down keeps its water, and nothing runs back through a stopped pump. Does a shut-down layflat on the flat really hold most of its water? An empty hose takes all a pump gives, so charging at working revs runs a draught, hydrant or relay out (the ladder's solutions now charge at idle, and the incident eases its second line on). Is that the doctrine you'd teach?
45. **Suction column** (issue #8, `sim/priming.ts`): the hard suction is taken to rise evenly over the lift from the strainer; shutting the suction valve traps the column (`PumpState.suctionVacuumKpa`, leaking as slowly as a sound pump's vacuum), and reopening it mixes the hose's air with the casing's, isothermally by volume, so the column settles to the shared vacuum; the primer displacements are re-tuned to keep the old prime times (F2), so the times are still the placeholders to confirm (row 15).
46. **Cat 7 hydrant to tank** (`sim/appliances/cat7.ts`): the Cat 7 has one (Dek, 2026-10-27), its coupling is 65 mm like every hydrant connection, but its loss (60 kPa at 400 L/min), the height it lifts to the top of the tank (1.5 m) and where the coupling sits (the scene puts it on the left, ahead of the bay; the realistic view shows it in a Side of truck inset like the Cat 1's) are placeholders. Is there a float valve or anything else that throttles the fill as the tank tops up?
47. ~~**Spilled water soak time**~~ Resolved (Dek, 2026-10-27): τ = 5 s, a game-feel choice so the pool shows the overflow as it happens rather than a measured soak rate. The scene's pool shows from 4 L and stops spreading at 80 L (~10 m past the body), and the overflow gush is heard from 50 L/min, full at 1000 L/min: presentation, not hydraulics.
48. **Open relay base pump overflows** (`sim/scenarios/openRelay.ts`): the base pump's operator keeps hydrant to tank fully open, ~1030 L/min into a full tank it draws ~660 L/min from, so ~370 L/min goes out the overflow for the whole job and the scene shows a pool round the base pump. Would a real operator throttle hydrant to tank to match the draw, or is an overflowing base tank normal at a fill point? If it's throttled, the scenario holds a part-open setting and its traces' `base.spilledL` goes to 0.
49. **Tank head on the compound** (issue #13, `TankSpec.headM`): the tank's water is taken as 1 m above the pump eye on the Cat 1 (+10 kPa at rest) and 0.8 m on the Cat 7 (+8 kPa), constant over the tank's level. What does the compound show on each truck when tank to pump is opened, and does it fall noticeably as the tank empties? The head also gravity-feeds an open delivery with the engine stopped (a few L/min into a laid line), and the traces now reach each objective about a second sooner.
50. **25 mm percolating hose** (issue #10, `25U` in `sim/constants.ts`): Table 3 has no 25 mm unlined column, so the friction is 25L × 2.8 (the unlined:lined ratio at 38 and 65 mm): ~680 kPa a length at 150 L/min. That limits a bush crew to **one length** with a 12 mm branch (~950 kPa at the pump; two lengths would need ~1600). What does 25 mm canvas really lose, and what does a bush crew usually run (lengths, branch)? Percolation (the weep that keeps canvas from burning) isn't modelled as a flow.
51. **Tank attack downhill crew** (issue #10, `scenarios/tankAttack.ts`): with every bush line the same, crew 2 works 10 m below the pump so the lesson still teaches gating one delivery back (+100 kPa at its branch). Typical, and is 10 m the right drop?
52. **Village main** (issue #10, `scenarios/hydrantSupply.ts`): pumping direct from the hydrant uses a weaker village main, 300 kPa static and 200 kPa residual at 600 L/min, so that two 38 mm lines at full throttle over-run it on a Cat 1 (zero at ~760 L/min through two lengths of 65 mm); on the C14 main (400 static, 300 at 1100) two 38 mm lines never could. Representative of a village main? The test appliance's pump can't over-run even this one (compound ~45 kPa at full throttle).
53. **Bush lines and the supply traps** (issue #10): two bush lines draw ~300 L/min (~370 flat out), too little to cavitate the 4 m draught (it would need ~7.8 m of lift), over-run or burst the C12 closed relay (a slammed inlet surges ~465 kPa against 1300), or drain the open relay's portable dam. So the draughting and relay lessons no longer have those traps (Dek, 2026-10-27: accept for now; the briefs no longer promise them). Tests, fixtures and journeys of those faults lay a heavy pair (65 mm + 38 mm) on the same fireground (`scenarios/heavyLines.ts`). Restoring the traps needs a scenario change: a longer or steeper relay, a deeper dam, more crews, or a bulk-water attack truck. Which?
54. **25 mm hammer on a fill** (issue #10): on the test appliance's pump, a 25 mm line opened at 0.75 throttle logs a 502 kPa water hammer the moment it charges: the fill's rush (an empty hose takes all the pump gives) drops to branch flow in one tick, in a small bore. Row 44c says the front reaching the branch isn't modelled as a surge, but the flow drop is counted as one here. Is a hammer on charging a short 25 mm line something to teach ("charge at idle"), or should the fill's end be exempt until 44c is modelled? The guided first-line journey charges at idle; the coach doesn't yet say to.
55. **Cat1B data plate rules of thumb** (`Cat1B_Panel.jpg`): fog branch 700 kPa, straight branch 500 kPa, "1 length of 38 mm hose = 100 kPa loss", 1 m elevation = ±10 kPa. The head rule matches `HEAD_KPA_PER_M`. At what flow is the 100 kPa per 38 mm length meant (our `38L` loses 100 kPa a 30 m length at ~255 L/min, about a 15 mm branch’s flow)? And should the lessons teach 700 / 500 kPa branch pressures alongside the manual's Table 1 optimum pressures the sim uses?
56. **Cat1B pump at rated duty**: 1200 L/min at 1000 kPa is more than the relief's 1100 kPa set and 1400 kPa shutoff leave room for at high flow; is the relief set higher on this pumpset, and is 1400 kPa near its real shutoff?
57. **Free play** (`scenarios/freePlay.ts`, `MONITOR_LINE` in `scenarios/lay.ts`): the monitor is 2 lengths of 65 mm with a 25 mm tip (Table 1: 700 kPa, ~1100 L/min); on a Cat 1 at a 0.4 throttle on the relay it flows ~660 L/min at ~250 kPa, and at 0.6 it over-runs the relay. The attack crews are at +10 m (38 mm, 15 mm tip) and −10 m (25 mm canvas, 12 mm tip); the base pump draughts a 2 m lift on 2 × 3 m of hard suction, and the relay is 4 × 65 mm, 20 m up, as in the closed relay. What tip and lay would a crew put on a monitor off a Cat 1's 65 mm delivery, and does a monitor ever run off a Cat 7's 38 mm outlets?
58. **An open delivery with nothing connected** (issue #16): the sim takes it as open to air with only the valve's loss (still a placeholder, item 5), so an open 65 mm dumps ~1500 L/min and collapses the discharge, ignoring the blank cap. Is that the right lesson, or should the cap's bleeder limit it to a small flow? Is there an exit loss worth adding? Scoring: 0.5 points a second it flows, capped at 5, with cavitation's cap lowered from 10 to 5 so the clean-running caps still sum to 40. Is that weighting right?
