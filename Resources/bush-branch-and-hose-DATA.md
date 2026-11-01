# Bush crew branch and 25 mm canvas hose: reference data

Collected 2026-11-01 to settle CALIBRATION "needs Dek" rows 7 (bush branch) and 50 (25 mm percolating hose), after Dek confirmed bush crews routinely run **2+ lengths of 25 mm unlined canvas** (5+ seen) on a **Dial-a-Jet** type branch. Neither RFS manual has these figures (`hydraulics-manual-GAME-NOTES.md`, `bush-firefighter-manual-NOTES.md`).

**Status tags:** `SOURCED` = published figure, reference given; `DERIVED` = computed by us from sourced figures (method given).

---

## 1. Sources

| Ref | Source | What it gives | Copy |
|---|---|---|---|
| **[DH10]** | A. Doull & P. Huynh, *An Experimental Investigation of Pressure Loss in Canvas Fire Hose*, 17th Australasian Fluid Mechanics Conference, Auckland, 5–9 Dec 2010. University of Technology Sydney. <https://opus.lib.uts.edu.au/bitstream/10453/16402/1/2010000132.pdf> | Field measurements **from the back of an RFS Cat 1 tanker** (Glenbrook/Lapstone brigade), percolating hose in 25/38/65 mm, **25 mm Dial-A-Jet** on the 25 mm hose, nozzle held at **700 kPa**, flow by stopwatch and drum. Straight, moderate-bend and severe-bend lays; new (< 6 months) and used (> 3 years) hose. Compared with the manufacturer's AS-2792 figures and the RFS rule of thumb. | `Resources/2010 Doull & Huynh - Pressure Loss in Canvas Fire Hose (17th AFMC).pdf` |
| **[DAJ]** | Dial-A-Jet Nozzles (division of Wind Dancer Pty Ltd, Oberon NSW), *Specifications* page, archived 15 Oct 2009: <http://web.archive.org/web/20091015055046/http://www.dial-a-jet.com.au/specifications/index.html>; product page archived 13 Feb 2005: <http://web.archive.org/web/20050213235608/http://dial-a-jet.com.au:80/index.htm>. The page [DH10] cites as its ref. [2]. | Manufacturer's flow and jet length per setting at three inlet pressures. 3 mm, 5 mm, 8 mm jets and fog/mist, selected by rotating the head (quarter turn to off); 1" BSP inlet; aluminium alloy body. | Table reproduced in §2 |
| [FRA] | Fire & Rescue Australia, *Bushfire Fighting Nozzles* listing (accessed 2026-11-01): <https://www.fireandrescueaustralia.com/bushfire%20nozzles/1%20firefighting%20nozzles/firefighting%20equipment/2%20fire/page/shop/browse> | Dial-A-Jet "25mm (1") BSP female", 3/5/8 mm jets plus fog, described as hard to get now. Other 25 mm bush nozzles with ratings (§3). | — |
| [FR] | Fire Response, *Dial A Jet Nozzle* (accessed 2026-11-01): <https://www.fireresponse.com.au/product/dial-a-jet-nozzle/> | "Popular choice for rural fire fighting and bushfire fighting"; 3/5/8 mm and fog; 1" BSP female. No flows. | — |
| [AK] | Akron Brass, *Style 1030 Forestry Handline Nozzle* (accessed 2026-11-01): <https://www.akronbrass.com/forestry-nozzle> | 1" inlet; 10 gpm / 40 L/min and 30 gpm / 115 L/min (straight stream or narrow fog); **rated 100 psi (7 bar)**; max operating 200 psi (13.8 bar). Listed as the replacement for Akron's "style 1700 Aussie Bush Nozzle". | — |
| [PK] | Protek Style 309 Wildland/Forestry Nozzle manual: <https://www.manualsdir.com/manuals/343905/protek-309-wildland_forestry-nozzle.html> | 1" inlet, dual flow 10–30 gpm (37–115 L/min). [FRA] adds "rated at 700 kPa but will flow at lower pressure with a reduced flow rate". | — |
| [HM] | NSW RFS Hydraulics Manual v4.0 (2021), `Resources/hydraulics-manual.txt` | Fog nozzles best at 700 kPa (L510); Table 3 friction (no 25 mm unlined column); 100 kPa/length rule of thumb (L823). | in repo |
| [PLATE] | Cat1B panel data plate, `Resources/Photos/Cat1B_Panel.jpg` | Fog branch 700 kPa, straight branch 500 kPa. | in repo |

## 2. Dial-A-Jet flow table [DAJ] (SOURCED)

Flow (L/min) and jet length at the nozzle inlet pressure:

| Setting | 350 kPa | 690 kPa | 1034 kPa |
|---|---|---|---|
| 3.2 mm jet | 14 L/min, 10 m | 18 L/min, 10 m | 20 L/min, 13 m |
| 5 mm jet | 32 L/min, 14 m | 45 L/min, 16 m | 50 L/min, 18 m |
| 8 mm jet | 45 L/min, 14 m | **77 L/min**, 18 m | 91 L/min, 20 m |
| Fog | 32 L/min | 41 L/min | 32 L/min |

(The manufacturer's 1034 kPa = 150 psi, 690 = 100 psi, 350 ≈ 50 psi: a US-psi test series.)

**Cross-check:** [DH10] measured **75.2 L/min at 700 kPa** on a 25 mm Dial-A-Jet, 2 % under the table's 8 mm figure. So the RFS test crew had it on the **8 mm jet**, and the table holds in the field.

**Orifice-law fit (DERIVED).** Taking `Q = k·√P` through the 690 kPa column (the rated point):

| Setting | k (L/min per √kPa) | Equivalent Table 1 tip, `d = √(15·k)` |
|---|---|---|
| 3.2 mm | 0.685 | 3.2 mm |
| 5 mm | 1.71 | 5.1 mm |
| 8 mm | **2.93** | **6.6 mm**: the 8 mm setting flows less than an 8 mm smooth bore (internal passages) |
| Fog | 1.56 | 4.8 mm |

The table does not follow √P exactly (8 mm: 45 at 350 kPa is ~18 % under the fit). At 1034 kPa the fit runs 3.5 % high on 8 mm and 10 % high on 5 mm and 3.2 mm, and fog flow falls there (so fog isn't modelled). The fit is good for 500–1000 kPa, and generous below (22 % high at 350 kPa on 8 mm).

## 3. What pressure a small bush branch wants (SOURCED)

* **Small variable / forestry branches are rated at 700 kPa (100 psi):** Dial-A-Jet's rated column is 690 kPa [DAJ]; Akron 1030 rated 7 bar [AK]; Protek 309 rated 700 kPa and "will flow at lower pressure with a reduced flow rate" [FRA]; the RFS field test held 700 kPa [DH10]; the RFS manual says most fog nozzles operate best at 700 kPa [HM L510]; the Cat1B plate says fog branch 700 kPa [PLATE].
* **They work over a wide band:** the Dial-A-Jet is specified from 350 to 1034 kPa [DAJ]; jet length only drops from 18 m to 14 m on the 8 mm setting between 690 and 350 kPa. Akron's maximum is 200 psi (1380 kPa) [AK].
* **Table 1's 250 kPa for a 12 mm tip is for smooth-bore straight-stream branches** [HM L465–490], not these. The game's bush line (12 mm at 250 kPa, ~150 L/min) is about double the real flow.
* **Typical flows on 25 mm:** 18–91 L/min on the Dial-A-Jet, 37–40 or 115 L/min on the two-setting forestry nozzles [AK, PK], ~60 L/min at 3 bar for a plastic 25 mm nozzle [FRA]. Compare the manual's guide of ~100 L/min as the most 25 mm *lined* hose should carry (L1006).

## 4. 25 mm percolating hose friction [DH10] (SOURCED)

At 75.2 L/min, 700 kPa at the nozzle, 30 m lengths, averaged over runs and hose age (age made no significant difference):

| Hose | Flow | Manufacturer, AS-2792 (straight; DERIVED from the paper's stated % differences) | Measured, "straight" lay (still curves off the truck) | Measured, severe bends |
|---|---|---|---|---|
| 25 mm percolating | 75.2 L/min | ~5.7 kPa/m (DERIVED: measured − 1.2 kPa/m, "21 % higher") | **~6.9 kPa/m ≈ 207 kPa per length** | higher still; the 25 mm plot (Fig 9) spans ~6–8.5 kPa/m. Plotted only, not tabulated |
| 38 mm percolating | 117.3 L/min | ~2.0 kPa/m | ~2.1 kPa/m (+5 %) | higher (Fig 9, plotted only) |
| 65 mm percolating | 124.4 L/min | ~0.37 kPa/m | ~0.47 kPa/m (+27 %) | — |

Conclusions [DH10]: field losses exceed the manufacturer's straight-hose figures, and bends add more, especially on small hose. The RFS rule of thumb of 100 kPa per length (3.33 kPa/m, from AF/5 *Operate Pumps*) is conservative for 38 and 65 mm but **underestimates 25 mm** about twofold.

**Against the sim's catalogue (DERIVED), k_m = ΔP/(L·Q²):**

| Hose | From [DH10] | `sim/constants.ts` | |
|---|---|---|---|
| `25U` | manufacturer 1.01e-3; field straight 1.22e-3; more with bends | **1.0e-3** (was 25L × 2.8, PLACEHOLDER) | the placeholder equals the manufacturer figure; the field lay is ~20 % higher |
| `38U` | manufacturer 1.45e-4; field 1.53e-4 | 1.43e-4 (Table 3) | ✓ agrees with [HM] Table 3 |
| `65U` | manufacturer 2.4e-5 at 124 L/min | 1.14e-5 (Table 3, fitted at 500–2000 L/min) | 2× apart at a flow far below 65 mm's working range; [DH10] notes 65 mm f rises anomalously; not a concern for supply lines at 500+ L/min |

So **the 25 mm canvas friction was about right; the bush branch's flow was the error.**

## 5. What a bush line needs at the pump (DERIVED)

Dial-A-Jet on 25 mm percolating, flat, `25U` at the manufacturer figure (field lay ~5–10 % more pump pressure, shown in brackets):

| Lengths | 8 mm at 700 kPa (77.6 L/min, ~180 kPa/length) | Pump held at 1000 kPa, 8 mm: nozzle / flow | 5 mm at 700 kPa (45.3 L/min, ~62 kPa/length) |
|---|---|---|---|
| 1 | 880 kPa (920) | 795 kPa / 83 L/min | 760 kPa |
| 2 | **1060 kPa** (1140) | 660 kPa / 75 L/min | 825 kPa |
| 3 | 1240 kPa (1360) | 565 kPa / 70 L/min | 885 kPa |
| 4 | 1420 kPa | 490 kPa / 65 L/min | 945 kPa |
| 5 | 1600 kPa | 435 kPa / 61 L/min | **1010 kPa** |
| 6 | 1780 kPa | 395 kPa / 58 L/min | 1070 kPa |

What this means:
* **5+ lengths of canvas is workable**, as Dek has seen: at a ~1000 kPa pump the 8 mm jet still gives ~60 L/min at ~435 kPa (inside the Dial-A-Jet's 350 kPa column), or the crew dials to 5 mm and gets the full 700 kPa on 5 lengths.
* **The 8 mm jet at its rated 700 kPa only holds on 1–2 lengths** at a ~1000–1100 kPa pump. That makes a real teaching point: long lay → lower branch pressure, or dial down.
* Two 8 mm lines draw only ~155 L/min, well within a Cat 1 or Cat 7 pump.

## 6. Decisions and what is still open

**Decided (Dek, 2026-11-01):**
* **Working pressure for a Dial-A-Jet:** 700 kPa is the preferred (rated) pressure, but anything in the maker's 350–1034 kPa band works acceptably. A lesson should aim a crew at 700 kPa and not fail them for anything inside the band.
* **25 mm friction:** use the manufacturer figure (`25U` = 1.0e-3). The field figure (1.22e-3) is close enough that the difference is a working error.

**Still open:** which setting a crew normally works on (8 mm for attack, 5 mm on a long lay?), and whether the branch setting can change mid-lesson (the crew dialling down by radio).

**Cat 1 relief set point (researched 2026-11-01; ASSUMPTION, not sourced).**
* *What a relief is for.* The hydraulics manual (L2318–2336) calls it a safety device that stops sudden pressure rises reaching the branch operator. It dumps water back to the pump inlet side (to the tank on most Cat 1s). A pump operator sets an adjustable one by raising the wheel until it begins to operate (a light), then backing off until the light goes out; so it sits just above the working pressure, not at a fixed ceiling. "Most Cat 1 tankers" instead carry a preset one. Neither manual gives its value, and web searches (RFS, Cat 7 operating manual, hose and pump makers, NFPA) found no Cat 1 figure.
* *The Cat 1 photos show no relief.* Neither Cat 1 panel photo has a relief lamp or adjuster, and `Cat1B_Pump.jpg`/`Cat1B_Piping.jpg` show no labelled relief valve. The manual only says most Cat 1s have one, so that this truck has one is unconfirmed.
* *Why a preset must clear working pressure.* If it opens within the pressure a normal lay needs, it fights the operator. 1100 kPa was a placeholder only 40 kPa over the ~1060 kPa a 2-length 8 mm line needs for 700 kPa at the branch, and under the 1240 kPa for 3 lengths, so it sat in the normal working range. It is also only 10 % over the data plate's rated 1000 kPa (row 56).
* *Ceilings above it.* Cat 1B pump shutoff is a 1400 kPa placeholder. Percolating hose working pressures found: 1400 kPa (Australian Fire Hose Pioneer 650, 25–70 mm), 1500 kPa assembly / 2000 kPa recommended (Sabre 25 mm percolating kit). The Cat1B foam proportioner is placarded for 600–1000 kPa.
* **Assumption: 1200 kPa.** It clears 2 lengths on the 8 mm jet at 700 kPa (1060 kPa at the pump, or 1140 with field friction) and 5 lengths on the 5 mm jet (1010); it is 17 % over the rated 1000 kPa, 200 kPa under the placeholder shutoff, and under the hose ratings above. On the 8 mm jet at 1200 kPa the branch still gets ~677 kPa on 3 lengths and ~591 kPa on 4 (orifice fit, `25U` 1.0e-3), inside the maker's band, so with "700 preferred, band acceptable" nobody needs the relief to open. It opens only when the player pushes for 700 kPa on 3+ lengths of 8 mm (1240 kPa and up), which is the cue to dial down or accept a lower branch pressure. Applied in `sim/appliances/cat1.ts` (2026-11-01, with the Dial-A-Jet slice). PLACEHOLDER — needs Dek.
