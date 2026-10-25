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

Not yet asserted (it needs a later milestone): C15 open-water capacity (M6).

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
* The compound gauge reads slightly negative on tank supply, and more so at higher flow (L3529).
* With tank-to-pump shut, or the tank empty, every gauge reads zero (Table 6).
* The relief opens above its set pressure and holds discharge near it.
* On a hydrant the compound reads its static pressure with nothing flowing and falls as more is drawn (L3613); over-run, it reads zero (Table 7).
* At the cavitation floor more throttle adds no flow and no discharge (L3353–3355); easing back below it stops the cavitation.

---

## Cat 1 tanker (`sim/appliances/cat1.ts`, id `cat1-generic`)

| Figure | Value | Status |
|---|---|---|
| Deliveries | d1 65 mm, d2 38 mm, d3 38 mm, each on a blue quarter-turn lever (no discharge master) | doctrine-confirmed (Dek, 2026-10-25, photos `Resources/Photos/Cat1_*`); hose reels deferred |
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
| Gauge scales | discharge 0–4000, compound −100…2500 kPa, tacho 0–4000 rpm (the fitted faces, psi dropped); tacho red from 3000 and compound red past −80 (the panel placard); other zones in Needs Dek #9 | faces and placard limits doctrine-confirmed (photos, Dek 2026-10-25); other zones PLACEHOLDER |
| Suction inlet | 65 mm with a green lever valve, low left of the bay; 10 kPa at 1000 L/min through it | size doctrine-confirmed (Dek, 2026-10-25); loss PLACEHOLDER — needs Dek |
| Pump to tank | Blue lever above the suction inlet: a valved return from the discharge into the tank, ~500 L/min at 700 kPa (k = 2.8e-3 kPa/(L/min)²), 38 mm | function doctrine-confirmed (Dek, 2026-10-25); size and loss PLACEHOLDER — needs Dek #34 |
| Hydrant to tank | 65 mm coupling with a green lever on the side of the truck, straight into the tank past the pump; 30 kPa at 1000 L/min through it, water climbs 2 m into the tank | function and size doctrine-confirmed (Dek, 2026-10-25); loss, fill height and position PLACEHOLDER — needs Dek #35 |
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

**Closed-relay trace** (`closed-relay.cat1-generic.csv`): base pump primed at the dam (2 m lift, held at throttle 0.8), 4 × 30 m 65 mm up 20 m to the attack pump's suction inlet; the attack pump runs the tank-attack pair. One line at 0.4: base 823 kPa, relay 627 L/min, residual 421 kPa. Both lines at 0.6: base 696, relay 822 L/min, residual 151 (compound) / 157 (hose end). Full throttle: over-run, compound 0, 912 L/min, cavitation 0.37; back at 0.6 it recovers. The mixed traces (`…cat1-generic+test-2d.csv`, `…test-2d+cat1-generic.csv`) land within 30 kPa of these.

**Open-relay trace** (`open-relay.cat1-generic.csv`): base pump on the hydrant (throttle 0.2) fills a 5000 L portable dam (2000 L at the start, 1 m lift) at ~660 L/min through 4 × 30 m 65 mm up 10 m; the attack pump primes on it. One line (557 L/min) fills the dam, both at 0.6 (729) drain it slowly, both at full throttle (1035) at ~375 L/min.

**Tank-refill trace** (`tank-refill.cat1-generic.csv`, free play): 400 kPa hydrant, 2 × 30 m 65 mm layflat to hydrant to tank, tank at 500 L. Half open: 922 L/min; fully open: 1032 L/min, which is the closed form √((400 − 20)/(main + hose + valve)) to 0.1 L/min, with the engine at idle and the pump dry. The tank is full at t ≈ 149 s and overflows: hydrant to tank keeps reading 1032 L/min with the tank full (to the end of the trace), the excess going out the overflow until the player shuts it. Through the pump instead (suction + pump to tank at throttle 0.3) the same hydrant gives ~455 L/min (`sim/tankFill.test.ts`). Hydrant to tank also added an `inletLpm.hydrant-to-tank` column (0, after the other inlets) to every other Cat 1 trace.

Pump to tank (2026-10-25) added a `pumpToTankLpm` column (after `reliefLpm`) to every Cat 1 trace; it is 0 throughout, and no other value moved. Its behaviour is asserted in `sim/tankFill.test.ts`: Q = open·√(P_d/k), recirculating on tank holds the level, refilling from a hydrant at the return flow, overflowing when full, cooling a churning pump (5 min at 0.8 throttle: > 10 °C cooler cracked 20 %), and blocking the primer.

## Cat 7 tanker (`sim/appliances/cat7.ts`, id `cat7-generic`)

From Dek's photos (`Resources/Photos/Cat7_*`, 2026-10-25): the pump's own panel, the bay, and the hydraulic diagram plate on the locker door. Figures not in the photos are sized for a small single-stage pump that can run two crew lines.

| Figure | Value | Status |
|---|---|---|
| Pump drive | Separate air-cooled diesel with its own panel: IGN / ALT / START, oil lamp, STOP T-handle, hour meter, vernier THROTTLE (RELEASE · HOLD) | doctrine-confirmed (photo); engine controls not modelled |
| Engine max | 3600 rpm (placard: "do not exceed 3600 r/min") | doctrine-confirmed (photo) |
| Engine idle | 1200 rpm | PLACEHOLDER — needs Dek |
| Throttle → rpm lag | τ = 0.4 s | PLACEHOLDER — needs Dek |
| Cylinders (engine note) | 1 | PLACEHOLDER — needs Dek |
| Pump shutoff (zero flow, max rpm) | 1400 kPa | PLACEHOLDER — needs Dek |
| Pump droop | 700/550² kPa/(L/min)², i.e. rated ~550 L/min at 700 kPa | PLACEHOLDER — needs Dek (sized so the 38 mm crew line and the light line run together, row 39) |
| Tank | 1600 L | PLACEHOLDER — needs Dek |
| Deliveries | d1, d2: two outlets with blue ball-valve levers on the manifold; 38 mm from the couplings | arrangement doctrine-confirmed (photo); size PLACEHOLDER — needs Dek; the hose reel's valve is deferred |
| Tank to pump | Butterfly valve with a yellow, green-tipped lever on the pipe down from the tank; 6 kPa at 400 L/min | valve doctrine-confirmed (photo, diagram); loss PLACEHOLDER — needs Dek |
| Suction inlet | 65 mm on a butterfly valve with a notched yellow lever, then a check valve and the DN65 Y-strainer on the pump's eye; 10 kPa at 400 L/min | arrangement and size doctrine-confirmed (photo: strainer marked DN65); loss PLACEHOLDER — needs Dek |
| Pump to tank | Ball valve from the discharge up into the tank; 25 mm, ~200 L/min at 700 kPa | function doctrine-confirmed (diagram); size and loss PLACEHOLDER — needs Dek |
| Tank recirculation (`recirc`) | The 3-way valve at TANK RECIRC: a bleed through a check valve into the tank, ~30 L/min at 700 kPa, always flowing | function doctrine-confirmed (diagram, tag on the pump); flow PLACEHOLDER — needs Dek (row 38) |
| Relief | None fitted | doctrine-confirmed (photos, diagram) |
| Primer | Hand diaphragm (`diaphragm`), the red pump with a long handle left of the outlets; best vacuum 75 kPa, 0.6 L/s | that it is the primer and its performance PLACEHOLDER — needs Dek |
| Cavitation inlet pressure | −84 kPa (the generic Table 4 fit); the placard's −80 kPa is drawn red on the compound | PLACEHOLDER — needs Dek |
| Casing volume / churn heat | 4 L; 5 kW at max rpm | PLACEHOLDER — needs Dek |
| Gauge scales | compound −100…1600, pressure 0–1600 kPa (the fitted faces), compound red past −80 (placard), no tacho | doctrine-confirmed (photo) |
| Tank gauge | A sight tube, assumed | PLACEHOLDER — needs Dek (none shows in the photos) |

**Recirculation** (asserted in `sim/recirc.test.ts` and the contract suite): Q = √(P_d/k) whenever the pump has water; drawn through the inlets and back into the tank (the level holds on tank supply, the tank fills while draughting); it cools a churning pump with no relief (10 min at full rpm with every delivery shut stays under the 60 °C lamp; without it the pump passes it); behind its check valve it lets no air in, so the primer still catches. It adds a `recircLpm` column (after `pumpToTankLpm`) to every Cat 7 trace.

**Lesson lines** (`scenarios/lay.ts` `LIGHT_LINE`): the Cat 7 has no 65 mm outlet, so where a lesson runs a 65 mm line the crew runs two lengths of 25 mm with a 12 mm branch (250 kPa, ~150 L/min; 25 mm loses ~250 kPa a length at that flow, L928). With the 38 mm crew line (3 lengths, 15 mm, ~280 L/min at ~710 kPa) that's ~460 L/min at ~720 kPa: within the pump with some throttle in hand, and both lines want nearly the same pump pressure.

**Tank-attack trace** (`tank-attack.cat7-generic.csv`): the 38 mm line on d1, the light line on d2.

| Phase | Discharge | Flows (d1 / d2) | Branch (38 / light) |
|---|---|---|---|
| 38 mm only, throttle 0.6 | 572 kPa | 250 / 0 L/min | 278 kPa |
| Second line opened, throttle 0.6 | 445 kPa (sag 127) | 221 / 117 L/min | 217 / 148 kPa |
| Throttle 0.8 | 622 kPa | 261 / 138 L/min | 302 / 207 kPa |

Recirculation takes 24–28 L/min throughout. Against the Cat 1 (669 kPa and 270 L/min on the 38 mm line at the same throttle) the smaller pump makes less pressure at the same throttle, and the lesson's operator holds both branches in band at ~0.9 throttle.

**Other traces:** on the 400 kPa hydrant the Cat 7 can't over-run it (at full throttle with both lines: compound +285 kPa, 543 L/min; its pump tops out near 780 L/min); draughting at 4 m: primed at t ≈ 32 s by the hand primer (the Cat 1’s electric primer: ≈ 16 s), both lines at full throttle −64 kPa and 483 L/min, no cavitation; closed relay (Cat 7 base pump at the dam): residual 345 kPa with both lines at 0.6, 118 kPa at full throttle (not over-run); open relay: the base pump at throttle 0.2 on the hydrant fills the portable dam at ~415 L/min, about what both lines draw at full throttle (489 L/min), so the dam falls slowly. The scripts' "push it past its supply" phases don't cavitate a pump this size; that is the physics, and the generic over-run tests use bigger lines or a weaker hydrant (`withBigLines`, `state/warnings.test.ts`).

---

## Needs Dek

1. **Cat 1 pump curve**: shutoff pressure, rated flow and pressure, idle and max rpm, engine response.
2. **Cat 1 tank capacity** and crew-protection reserve.
3. **Relief set pressure** and how sharply it holds.
4. **Tank-to-pump inlet reading** at typical flows.
5. **Delivery valve loss** when fully open, per size.
6. **Dry-pump behaviour.** At the moment, tank-to-pump shut or tank empty means every gauge reads 0 at once. Real behaviour, such as a brief run-down or a full casing holding pressure with the inlet shut, is for M4, alongside cavitation.
7. **Trace branch choice**: 15 mm on the 38 mm line and 20 mm on the 65 mm line, both from Table 1. Is that representative of what a Cat 1 crew would run?
8. ~~**Cat 1 delivery sizes**~~ Resolved (Dek, 2026-10-25): 65/38/38 mm, the nominal 2½" and 1½" sizes. Moving d1 and the suction from 64 to 65 mm lowered d1's valve loss by (64/65)⁴ ≈ 6 %; every Cat 1 golden trace moved by ≤ 1.1 (kPa, L/min or L), except the incident, whose hydrant changeover now fires 2 s later (t = 84 s, a hold condition near a band edge) and so ends with 26 L less in the tank.
9. **Gauge zones** (`instruments[].scale` on each spec; `ui/panel-pump/gauge/dials.ts` builds the faces from it). The Cat 1 faces are now the fitted ones (Dek, 2026-10-25: compound −100…2500 kPa, discharge 0–4000 kPa, tacho 0–4000 rpm), with red past the placard's −80 kPa and 3000 r/min. Still guessed: compound amber −80…−70; discharge amber 1100–1400 (relief set to shutoff), and no discharge red band (it would cover most of the 4000 kPa face). Do the real faces carry any coloured zones, or should these go?
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
23. **Relay scenarios** (M5): the closed relay's base pump is already primed at the farm dam (2 m lift, 2 × 3 m hard suction) and holds throttle 0.8 (~700 kPa at its delivery with the attack pump drawing both lines); the open relay's base pump is on the 400 kPa hydrant at throttle 0.2; the portable dam holds 5000 L (2000 at the start) with its water 1 m below the attack pump's inlet, one 3 m length of hard suction over the wall. What does a Cat 1 carry (portable dam size, hard suction), and how would a base pump operator set up?
24. **Receiving pump's relief on shutdown**: on a Cat 1 receiver, slamming its *lines* shut opens its relief (dumping to tank), so the relay keeps flowing and no burst; only the inlet slammed shut bursts the relay. Is that how a real relief behaves under a relay, and should relief dumped into a full tank overflow?
25. **Relay procedure**: the fill sequence (500 kPa until every pump has water, then 700, L3850–3853), radio calls and the booster-failure loss (~30 %, L3881) aren't modelled; support trucks hold fixed settings. Which of these matter for the first relay scenarios (M6)?
26. **Relay display**: a closed relay is drawn charged once pressurised, even before the receiver draws; an open relay only while water flows. A burst length is drawn as a jet near its end of the hose, and the relay can't be repaired in play (reload the scenario). Right conventions?
27. **Relay burst vs closure time** (PR #4 review): the surge in row 22 is taken per tick, like row 21, but a burst is latched with no repair (row 26), so a tick-size artefact becomes permanent. The review measured ~1800 kPa for a single-tick slam at any dt from 0.02 to 0.2 s and no burst for a 3 s ease at any dt; by inference (untested) a closure over ~0.5 s is seen as several small steps and likely under-predicted, since 2L/a for 120 m of layflat is about 1 s. Should "instant closure" be judged against the hose's 2L/a (row 21's proposal) before a burst is decided?
28. **Lesson targets** (M6): a branch counts as "at working pressure" within ±10 % of its Table 1 optimum (`BRANCH_BAND_FRACTION`: 315–385 kPa for a 15 mm tip). Is that the tolerance an instructor would accept, or should it be a fixed ±kPa, or tighter for experienced players?
29. **Pump damage** (M6): a lesson fails after 60 s of cavitation or 60 s above the 60 °C temperature caution, summed over the scenario (`PUMP_DAMAGE_CAVITATION_S`, `PUMP_DAMAGE_OVERHEAT_S`). Deliberately gentle; how long does a real pump survive either?
30. **Hydrant lesson** (M6): "a healthy reserve" is the compound above 100 kPa with the 65 mm line at 700 L/min or more, and "not over-running" with both lines is the compound above 50 kPa. Should the lesson use the reserve-flow rule (drop from static: < 10 % ⇒ 3× flow left …, L3121–3126) instead of fixed readings? The tank-to-hydrant changeover surge (L1083–1098) is still not modelled, so the incident's changeover doesn't punish opening the hydrant before shutting the tank.
31. **Closed-relay lesson** (M6): with both attack lines in band the relay needs ~880 L/min up 20 m through 4 lengths, which leaves ~60 kPa residual at the base pump's 0.8 throttle (~700 kPa delivery). The lesson has the base pump's operator raise to 0.9 (~800–885 kPa) by radio once both attack lines flow (the fill sequence, L3850–3853), which also changed the closed-relay golden traces from t = 40 s. Is 800+ kPa at the base pump realistic here, or should the scenario use shorter lengths, less climb or a second relay line? A burst length is replaced after 30 s (`REPAIR_S`); how long does a crew take?
32. **Incident** (M6): crew 1 advances 10 m up the slope with one more length; crew 2 runs out 3 lengths of 65 mm with a 20 mm tip; the hydrant is 400 kPa static on two lengths of 65 mm. Representative?
33. **Scoring** (M6, UI tuning): 60 points for objectives, 40 for clean running less cavitation ½ point/s (cap 10), overheat ½/s (cap 5), water hammer 5 each (cap 10), relay bursts 10 (cap 10), crews without water ½/s (cap 5); a failed run keeps its objective points only; 2 stars at 75, 3 at 90. Does that weighting match what an instructor would mark down hardest?
34. **Pump to tank** (`ApplianceSpec.pumpToTank`): the Cat 1's is taken as a 38 mm return passing ~500 L/min at 700 kPa. What does it really pass? And when it's open while priming, the sim treats it as an air leak (the primer can't catch, like an open delivery), on the basis that operators close it first. With water in the tank above the pump, would opening it instead flood the casing (no priming needed)?
35. **Hydrant to tank** (`InletKind 'tankFill'`): which side of the Cat 1 is it on and where (the scene puts it on the left, forward of the suction)? Its loss is taken as 30 kPa at 1000 L/min and the water climbs 2 m into the tank, so a 400 kPa hydrant on two lengths of 65 mm fills at ~1030 L/min, over twice what the pump-to-tank route gives at a gentle throttle. Realistic? A hydrant may feed only one hose for now (two hoses on one main would share its loss, which isn't coupled yet).
36. **Speed controller** (realistic Cat 1 panel, `EngineSpec.speedController` in `sim/appliances/cat1.ts`): held, it runs the governor at 400 rpm/s (idle to max in ~5.5 s); a flick moves it ~50 rpm. How fast does the real one ramp, and how big is a flick?
37. **Realistic Cat 1 arrangement** (photo-derived; things not visible were placed by me): the tank-to-pump lever low on the far-left feed, and pump to tank on a return above the suction rising into the tank; hydrant to tank and the sight tube are insets, not placed on the body. The oil temperature / oil pressure dials, ignition, stop/start, ALT lamp, foam and air cleaner are drawn but inert. The "extended idle 1200 rpm" placard is shown, but idle in the sim is 800 rpm (row: Engine idle / max): should idle be 1200?
38. **Cat 7 tank recirculation** (`ApplianceSpec.recirc`): the 3-way valve set to TANK RECIRC is taken as an always-open bleed through a check valve into the tank, ~30 L/min at 700 kPa. Is that the flow? Is it there to keep the pump cool (it's how a pump with no relief survives churning here)? FOAM ON (the bleed back to the suction through the proportioner) isn't modelled; the selector is drawn inert.
39. **Cat 7 pump and lessons**: the pump is sized at ~550 L/min at 700 kPa (shutoff 1400) so that the 38 mm crew line and a light line run together at working pressure. Where a lesson runs a 65 mm line, a Cat 7 crew runs two lengths of 25 mm with a 12 mm branch (`LIGHT_LINE`). What does a Cat 7 pump really deliver, and what would its second crew run? The 25 mm is chosen so both lines want the same pump pressure; with 38 mm and a 12 mm tip the gated delivery sits ~7 % open, which is very touchy.
40. **Cat 7 unknowns from the photos**: is the red diaphragm pump left of the outlets the primer (the diagram shows none)? Where is the tank level shown (a sight tube is assumed)? Are the outlets 38 mm? Which side of the truck is the bay's suction coupling (the scene puts it on the left at the rear)? Idle rpm, tank capacity, engine cylinders.
