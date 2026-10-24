# Index: RFS Hydraulics Manual v4.0 (NSW Rural Fire Service, June 2021)

Index only; no summary of content. Built for the hydraulics-helper pump-operator game.

- **Source text:** `Resources/hydraulics-manual.txt` (4,675 lines, `pdftotext -layout`). **All `L` numbers below are 1-based line numbers in that file** (as shown by `grep -n` / Read / awk NR). Range ends are inclusive and run to the line before the next heading, so they include page-footer lines.
- **Source PDF:** `2021-06-01 RFS HYDRAULICS MANUAL.pdf`, **130 pages** (confirmed with `pdfinfo`). Both files were left unmodified.
- **Page numbers (`p`) are PDF page numbers** (1-130), computed from form feeds. Printed page numbers differ: **PDF page = printed page + 13** (printed 1 = PDF 14; last printed page 117 = PDF 130). The printed Table of Contents (PDF p5-7) uses printed numbers; every TOC page was checked against the text with this offset (e.g. printed 8 "Firefighting hydraulics" = PDF 21, printed 92 "Relay pumping" = PDF 105).
- PDF pages 1-13 are unnumbered front matter. Each chapter is preceded by a divider page (text only); chapter ranges below start at the divider.
- **Section numbers in [brackets] are inferred.** The PDF has Word auto-numbering (e.g. "2.3", "2.21") that the text extraction dropped for most headings; numbers were reconstructed from heading order and cross-checked against the few that survived (2.21.1-3, 3.3.1-5, 8.4.x, 8.7.x, 9.x.x). Table captions ("Table 1:" etc.) were also dropped from the text; figure captions survived.
- The Introduction and the 9 content chapters plus the Appendix make **10 numbered chapters** (1-9 content, 10 Appendix).

## Tag key
CORE-SIM = formulas/constants/tables for the sim; CORE-OPS = operator procedures, sequences, panel controls; SCENARIO = worked examples, tactical/incident content; TERMINOLOGY = definitions/vocabulary; SAFETY = hazards, failure modes; BACKGROUND = theory/context; LOW = not relevant to the game.

## Suggested reading priority for the game
1. Ch 2 (physics: nozzle, head, friction, supply, lift) - [CORE-SIM] backbone, p20-42.
2. Ch 8 (practical operation, fault tables, relay) - [CORE-OPS][SCENARIO], p88-109.
3. Ch 5 (panel gauges/valves/controls) - [CORE-OPS], p59-70; Ch 4 (priming) p53-58; Ch 7.3-7.4 (cooling, engage/disengage) p83-86.
4. Ch 3.6 series/parallel p50-51; Ch 9.2.3 + 9.3-9.4 foam proportioner (optional extension).
5. Ch 1, 6, Intro, most of 3, 7.1-7.2, 9.1: background or LOW.

## Page to first-line map (PDF page : first line in .txt)
Pages 2, 4, 11, 13 are blank (no text, no images) and have no lines. Page 130 ends at L4675.
    p1:L1  p3:L3  p5:L64  p6:L104  p7:L146  p8:L156  p9:L193  p10:L219  p12:L229  p14:L242
    p15:L262  p16:L285  p17:L326  p18:L331  p19:L370  p20:L397  p21:L400  p22:L443  p23:L496  p24:L546
    p25:L578  p26:L596  p27:L636  p28:L681  p29:L720  p30:L756  p31:L783  p32:L833  p33:L921  p34:L974
    p35:L1022  p36:L1071  p37:L1121  p38:L1168  p39:L1213  p40:L1245  p41:L1273  p42:L1305  p43:L1355  p44:L1359
    p45:L1392  p46:L1428  p47:L1470  p48:L1508  p49:L1543  p50:L1580  p51:L1639  p52:L1673  p53:L1706  p54:L1710
    p55:L1753  p56:L1783  p57:L1837  p58:L1900  p59:L1931  p60:L1935  p61:L1978  p62:L2034  p63:L2077  p64:L2089
    p65:L2140  p66:L2178  p67:L2225  p68:L2284  p69:L2330  p70:L2376  p71:L2402  p72:L2404  p73:L2444  p74:L2485
    p75:L2515  p76:L2565  p77:L2601  p78:L2628  p79:L2632  p80:L2673  p81:L2708  p82:L2746  p83:L2793  p84:L2826
    p85:L2870  p86:L2917  p87:L2946  p88:L2977  p89:L2980  p90:L3020  p91:L3069  p92:L3117  p93:L3162  p94:L3210
    p95:L3263  p96:L3313  p97:L3361  p98:L3403  p99:L3450  p100:L3499  p101:L3552  p102:L3601  p103:L3651  p104:L3697
    p105:L3746  p106:L3780  p107:L3813  p108:L3861  p109:L3908  p110:L3953  p111:L3958  p112:L3999  p113:L4038  p114:L4093
    p115:L4141  p116:L4163  p117:L4199  p118:L4226  p119:L4248  p120:L4279  p121:L4322  p122:L4370  p123:L4416  p124:L4466
    p125:L4468  p126:L4517  p127:L4572  p128:L4619  p129:L4661  p130:L4667  

## Hierarchical table of contents

Format: `Title | PDF pages | line range | [tags] one-line description`. Chapters in bold; front matter first.

- Cover | p1 | L1-2
- Copyright, disclaimer, release history (v4.0, June 2021) | p3 | L3-63 | [LOW]
- Table of Contents | p5-7 | L64-155 | [LOW]
- Table of Figures (Figures 1-62) | p8-9 | L156-218 | [LOW]
- Table of Tables (9 tables) | p10 | L219-228 | [LOW]
- E-learning / Knowledge Hub links page | p12 | L229-241 | [LOW]
- "Hydraulics" course blurb and NSW RFS training framework | p14 | L242-261 | [LOW]
- Manual Icons | p15 | L262-284 | [LOW]
- **Introduction** | p16 | L285-325 | [LOW] Course overview and PUAFIR309 learning objectives; no technical content.
  - Overview | p16 | L286-301
  - Learning Objectives | p16 | L302-325
- **1 WHS in firefighting** | p17-19 | L326-396 | [SAFETY, LOW] Service Standards/SOPs, SDS, Codes of Practice and PPE as they apply to pumping; generic compliance material.
  - [1.1] Work health and safety (WHS) | p18-19 | L343-396
    - [1.1.1] Service Standards and SOPs | p18 | L349-369
      - [1.1.1.1] Service Standards | p18 | L353-356
      - [1.1.1.2] NSW RFS Fireground SOPs | p18 | L357-369
    - [1.1.2] Safety Data Sheets (SDS) | p19 | L370-378
    - [1.1.3] Codes of Practice (CoP) | p19 | L379-387
    - [1.1.4] Personnel Protection Equipment (PPE) | p19 | L388-396
- **2 Firefighting hydraulics** | p20-42 | L397-1354 | [CORE-SIM, CORE-OPS, SCENARIO, TERMINOLOGY, BACKGROUND] Core physics: nozzle discharge, pressure/head, friction loss laws and tables, pressurised vs static supply, draughting lift limits, source capacity maths.
  - [2.1] Introduction | p21 | L406-428
  - [2.2] Characteristics of the nozzle discharge | p21 | L429-442 | [BACKGROUND] Jet/fog/foam forms; energy in flow and pressure.
  - [2.3] Function of the branch and nozzle | p22 | L443-451 | [BACKGROUND, TERMINOLOGY] Branch converts pressure energy to velocity; velocity inversely with nozzle size.
  - [2.4] Discharge through nozzles | p22 | L452-495 | [CORE-SIM] Nozzle flow formula and Table 1 of optimum pressure, flow and jet reaction for 12-32 mm nozzles.
  - [2.5] Advantages of optimum nozzle pressures | p23 | L496-508 | [CORE-SIM] Why not to exceed optimum pressure (reach, turbulence, reaction).
  - [2.6] Optimum nozzle pressures - Fog and foam nozzles | p23 | L509-523 | [CORE-SIM] Fog about 700 kPa, foam about 550 kPa.
  - [2.7] Jet reaction | p23 | L524-535 | [CORE-SIM, SAFETY] Recoil force on branch operator and fatigue.
  - [2.8] Height of effective jets | p23 | L536-545 | [BACKGROUND, LOW] Practical jet height is well below theoretical head.
  - [2.9] Principles of pressure | p24-27 | L546-645 | [BACKGROUND, TERMINOLOGY] Six rules of fluid pressure with Figures 1-6; why pump must overcome head and friction.
  - [2.10] Pressure, head and height loss or gain | p27-30 | L646-768 | [CORE-SIM, SCENARIO, TERMINOLOGY] P = 10 x H, worked 16 m example, add/subtract 10 kPa per metre; hydraulic terms table.
  - [2.11] Loss of pressure due to friction | p30-31 | L769-819 | [CORE-SIM] The five laws of friction loss (length, diameter, velocity squared, roughness, independent of pressure).
  - [2.12] Estimating friction loss | p31-33 | L820-925 | [CORE-SIM] Friction loss chart (Fig 11) and per-30 m table by hose size/lining at low, medium and high flow.
  - [2.13] Typical friction loss at low flow rates | p33 | L926-960 | [CORE-SIM, SCENARIO, SAFETY] Worked pump-pressure examples, 25 mm vs 38 mm; hose burst-pressure guidance.
  - [2.14] Typical friction loss at high flow rates | p33-34 | L961-995 | [CORE-SIM, SCENARIO] Worked 500 L/min at 700 kPa examples across 38/50/65 mm and mixed lines.
  - [2.15] Friction loss in the delivery hose | p34 | L996-1021 | [CORE-SIM] 100 kPa-per-length rule and resulting max flow per hose diameter (25-90 mm).
  - [2.16] Friction loss in the supply hose | p35 | L1022-1046 | [CORE-SIM, SCENARIO] Twinning lines or larger hose to cut friction; worked 65 mm example.
  - [2.17] Pressurised water supply | p35-36 | L1047-1082 | [CORE-SIM, CORE-OPS, SAFETY, TERMINOLOGY] Static vs dynamic vs residual pressure, over-running the supply, lay-flat collapse.
  - [2.18] Changing from tank to a pressurised supply | p36 | L1083-1100 | [CORE-OPS, SAFETY, SCENARIO] Tank-to-hydrant changeover pressure surge risk and mitigations.
  - [2.19] Static/open water supply | p36-38 | L1101-1196 | [CORE-SIM, BACKGROUND, LOW] Rural Fires Act s26 water rights; atmospheric lift theory (10 m / 8 m / 7.5 m); lift-vs-capacity table.
  - [2.20] Negative pressure and suction lift | p38-39 | L1197-1215 | [CORE-SIM, CORE-OPS, TERMINOLOGY] -10 kPa per metre of lift; blockage vs air-leak signatures on inlet gauge.
  - [2.21] Calculation of static/open water capacity | p39-41 | L1216-1304 | [CORE-SIM, SCENARIO] Litres available in pools, tanks and creeks, and run-time at a given flow.
    - [2.21.1] Rectangular container | p39-40 | L1221-1246
    - [2.21.2] Cylindrical container | p40 | L1247-1272
    - [2.21.3] Flowing source | p41 | L1273-1304
  - [2.22] Summary | p42 | L1305-1354
- **3 Centrifugal firefighting pumps** | p43-52 | L1355-1705 | [BACKGROUND, TERMINOLOGY, CORE-SIM] Pump types, centrifugal pump principle and components, multi-stage series/parallel, peripheral pumps.
  - [3.1] Displacement pumps | p45 | L1392-1412 | [BACKGROUND] Positive vs non-positive displacement pumps.
  - [3.2] Principles of operation of a centrifugal pump | p45-46 | L1413-1450 | [BACKGROUND, SAFETY] How impeller works; why suited to firefighting; needs priming; dirty-water damage warning.
  - [3.3] Main components of a centrifugal pump | p46-48 | L1451-1510 | [TERMINOLOGY, SAFETY] Impeller, casing, volute, guide vanes, mechanical seal (dry-run/sand damage).
    - [3.3.1] Impeller | p46 | L1452-1469
    - [3.3.2] Casing | p47 | L1470-1477
    - [3.3.3] Volute | p47 | L1478-1485
    - [3.3.4] Guide vanes | p47 | L1486-1496
    - [3.3.5] Mechanical seal | p47-48 | L1497-1510
  - [3.4] Multi-stage pumps | p48 | L1511-1523 | [BACKGROUND] Why add impellers for higher pressure.
  - [3.5] Series pumps | p48-49 | L1524-1579 | [BACKGROUND, CORE-SIM] Stages in series each add pressure at same flow.
  - [3.6] Series/parallel pumps | p50-51 | L1580-1643 | [CORE-SIM, CORE-OPS] Pressure (series) vs volume (parallel) mode; Fig 24-25 give example flow/pressure doubling figures.
  - [3.7] Peripheral pumps | p51 | L1644-1672 | [BACKGROUND, LOW] High-pressure, low-flow peripheral impeller.
  - [3.8] Summary | p52 | L1673-1705
- **4 Priming a centrifugal pump** | p53-58 | L1706-1930 | [CORE-OPS, BACKGROUND, SAFETY] Why centrifugal pumps need priming and how force/lift, diaphragm and rotary vane primers work, incl. primer duty-cycle and foam fouling.
  - [4.1] Force and lift pumps | p54-56 | L1739-1821 | [BACKGROUND, LOW] Reciprocating primers and air vessels.
  - [4.2] Diaphragm primer | p56-57 | L1822-1852 | [BACKGROUND, CORE-OPS] Hand-operated primer (Cat 7/9 tankers).
  - [4.3] Rotary vane primer | p57-58 | L1853-1908 | [CORE-OPS, SAFETY, CORE-SIM] Electric primer (Cat 1); max 1 min on in 3, water lubrication, foam residue jams vanes.
  - [4.4] Summary | p58 | L1909-1930
- **5 Pump gauges, valves and controls** | p59-70 | L1931-2401 | [CORE-OPS, TERMINOLOGY, SAFETY] Pump panel instruments (compound, pressure, flow, tacho, tank, oil, temp), valve types, pressure relief and engine controls.
  - [5.1] Gauges | p60-65 | L1959-2145
    - [5.1.1] Compound gauge | p60-61 | L1967-1991 | [CORE-OPS, CORE-SIM, TERMINOLOGY] Inlet gauge, -100 to 0 kPa vacuum scale plus positive scale.
    - [5.1.2] Pressure gauge | p61-62 | L1992-2040 | [CORE-OPS, TERMINOLOGY] Delivery gauge, Bourdon tube, zero error.
    - [5.1.3] Flow meter | p62 | L2041-2066 | [CORE-OPS, CORE-SIM] Per-outlet flow meters; automatic nozzles hold pressure so flow, not pressure, is set.
    - [5.1.4] Tachometer | p62-63 | L2067-2088 | [CORE-OPS, SAFETY] RPM indication; includes closed-outlet churning/overheating/scald warning (L2077-2083).
    - [5.1.5] Tank gauge | p64 | L2089-2127 | [CORE-OPS, SAFETY] Sight gauge and light panel; low-level alarm; keep crew-protection reserve in bush ops.
    - [5.1.6] Oil pressure gauge | p64 | L2128-2139 | [CORE-OPS, SAFETY] Loss of oil pressure means shut down.
    - [5.1.7] Temperature gauge | p65 | L2140-2145 | [CORE-OPS, SAFETY] Engine temperature monitoring.
  - [5.2] Valves and control mechanisms | p65-69 | L2146-2338 | [CORE-OPS, TERMINOLOGY] Panel valve inventory: tank-to-pump, deliveries, supply inlets, foam, series/parallel.
    - [5.2.1] Clack valve | p65-66 | L2164-2196
    - [5.2.2] Ball valve | p66 | L2197-2224
    - [5.2.3] Mushroom valve | p67 | L2225-2249
    - [5.2.4] Butterfly valve | p67 | L2250-2283 | [SAFETY] Contains water-hammer warning (L2255-2256).
    - [5.2.5] Gate valve | p68 | L2284-2305
    - [5.2.6] Pump drain valve | p68 | L2306-2317
    - [5.2.7] Pressure-relief mechanism | p68-69 | L2318-2338 | [CORE-OPS, CORE-SIM, SAFETY] Dumps excess pressure to inlet/tank to protect branch operators; setting procedure continues L2330-2336.
  - [5.3] Engine controls | p69 | L2339-2375
    - [5.3.1] Throttle | p69 | L2343-2362 | [CORE-OPS] Slide-lever, Vernier and electronic throttles; gradual changes avoid pressure surges.
    - [5.3.2] Emergency stop | p69 | L2363-2375
  - [5.4] Summary | p70 | L2376-2401
- **6 Portable pumps** | p71-77 | L2402-2627 | [LOW, CORE-OPS, SAFETY] Self-contained portable and high-pressure low-volume pumps: safety, start/prime steps, maintenance cycle; limited relevance to appliance pump panel.
  - [6.1] Precautions | p73 | L2444-2465 | [SAFETY, LOW] Manual handling, exhaust, refuelling, incline hazards.
  - [6.2] Operation | p73-74 | L2466-2514 | [CORE-OPS, LOW] Start/prime sequence for portable pumps, self-priming fill, strainers.
  - [6.3] Maintenance | p75 | L2515-2545 | [LOW] Four-level maintenance regime.
  - [6.4] High-pressure, low-volume pumps | p75-76 | L2546-2600 | [BACKGROUND, SAFETY, LOW] 7000-15000 kPa, 2-20 L/min fine-droplet pumps; limits and hazards.
    - [6.4.1] High-volume, low-pressure pumps | p76 | L2587-2600 | [LOW] Fast-fill pump with Fig 44 pump curve (image only).
  - [6.5] Summary | p77 | L2601-2627
- **7 Appliance-mounted pumps** | p78-87 | L2628-2976 | [CORE-OPS, SAFETY, BACKGROUND] Pump mounting, power train, transfer case vs PTO, secondary cooling, engage/disengage sequences, rural tanker independent pumps.
  - [7.1] Pump installation | p80-82 | L2673-2762 | [BACKGROUND, TERMINOLOGY] Midship vs rear mount, plumbing inventory and panel position.
    - [7.1.1] Midship-mounted | p80 | L2678-2707
    - [7.1.2] Rear-mounted | p81 | L2708-2719
    - [7.1.3] Urban pumpers | p81-82 | L2720-2762 | [BACKGROUND, CORE-OPS] Includes power train and manual/auto transmission, top-gear hold.
  - [7.2] Powering the pump | p82-83 | L2763-2810 | [BACKGROUND, CORE-OPS] Transfer case (pump or road) vs PTO.
    - [7.2.1] Transfer case | p82-83 | L2769-2801
    - [7.2.2] Power take-off (PTO) | p83 | L2802-2810
  - [7.3] Cooling systems | p83-84 | L2811-2844 | [CORE-SIM, CORE-OPS, SAFETY] Secondary cooling heat exchanger; closed-delivery churning overheats; recirculate or bleed water.
  - [7.4] Operation | p84-86 | L2845-2919 | [CORE-OPS, SCENARIO] Numbered engage/disengage steps for transfer-case and PTO pumps; rural tanker pumps.
    - [7.4.1] Pump with a transfer case | p84-85 | L2851-2885
    - [7.4.2] Pump with a PTO | p85 | L2886-2901
    - [7.4.3] Rural tankers | p85-86 | L2902-2919
  - [7.5] Maintenance | p86-87 | L2920-2952
  - [7.6] Summary | p87 | L2953-2976
- **8 Practical pump operation** | p88-109 | L2977-3952 | [CORE-OPS, CORE-SIM, SCENARIO, SAFETY] Central operational chapter: siting, tank/hydrant/draught set-up, priming and emergency priming, cavitation, delivering water, gauge fault-finding tables, relay pumping with spacing calc.
  - [8.1] Positioning the appliance | p90 | L3020-3050 | [SCENARIO, SAFETY] Safe-siting checklist (traffic, wind, escape route, hazards).
  - [8.2] Pumping from the appliance tank | p90-91 | L3051-3081 | [CORE-OPS, SCENARIO] Tank-supply discipline: estimate duration, keep reserve, plan alternate supply.
  - [8.3] Pumping from reticulated water | p91-92 | L3082-3138 | [CORE-OPS, CORE-SIM, SCENARIO, SAFETY] Hydrant operation, inlet pressure rules, reserve-flow estimate from inlet drop, over-use, water hammer, shutdown.
  - [8.4] Pumping from static/open water | p92-97 | L3139-3372 | [CORE-OPS, CORE-SIM, SAFETY] Draughting set-up, vacuum test, priming steps, emergency priming, cavitation.
    - [8.4.1] Draughting | p92-94 | L3147-3262 | [CORE-OPS, CORE-SIM] Includes siting, submergence depth, vortex, vacuum test (L3195-3205), prime steps (L3210-3221), lift table (L3234-3252).
    - [8.4.2] Emergency priming | p95 | L3263-3279 | [CORE-OPS, SAFETY] List of reasons a prime fails.
    - [8.4.3] Using a blanking cap | p95 | L3280-3312
    - [8.4.4] Using a collecting head | p96 | L3313-3324
    - [8.4.5] Priming by back flushing | p96 | L3325-3335
    - [8.4.6] Cavitation | p96-97 | L3336-3372 | [CORE-SIM, SAFETY, TERMINOLOGY] Boiling point vs pressure, symptoms, causes (draught and hydrant).
  - [8.5] Delivering water | p97-99 | L3373-3498 | [CORE-OPS, CORE-SIM, SAFETY, SCENARIO] Static vs dynamic pressure on throttle changes, water-on protocol, charging lines, multi-line operation, hose reels.
    - [8.5.1] Water on | p97 | L3388-3402
    - [8.5.2] Charging a hose line | p98 | L3403-3412
    - [8.5.3] Delivering optimum nozzle pressure | p98 | L3413-3431 | [CORE-OPS, CORE-SIM] Limits 550 kPa controlled / 400 kPa open branch until signal; fog 700 kPa.
    - [8.5.4] Operating multiple lines | p98-99 | L3432-3456
    - [8.5.5] Valve, throttle and pressure relief operation | p99 | L3457-3463
    - [8.5.6] Shutting down and adding hose lines | p99 | L3464-3472
    - [8.5.7] Hose reel operation | p99 | L3473-3498
  - [8.6] Gauge interpretation and fault-finding | p100-104 | L3499-3745 | [CORE-OPS, CORE-SIM, SCENARIO, SAFETY] How inlet/delivery gauges respond to rpm and flow, plus fault tables for tank, hydrant and draught supplies.
    - [8.6.1] Appliance tank | p100-102 | L3526-3611 | [SCENARIO] Fault tables incl. cavitation (Table 6).
    - [8.6.2] Reticulated water | p102-103 | L3612-3683 | [SCENARIO] Fault table (Table 7).
    - [8.6.3] Static/open water | p103-104 | L3684-3745 | [SCENARIO] Fault table (Table 8), incl. loss of prime.
  - [8.7] Relay pumping | p105-108 | L3746-3907 | [CORE-OPS, CORE-SIM, SCENARIO, SAFETY] Open vs closed circuit, 600 kPa spacing formula and worked example, setup, shutdown pressure spike, breakdown, comms.
    - [8.7.1] Open-circuit relay | p105 | L3755-3766
    - [8.7.2] Closed-circuit relay | p105-106 | L3767-3781
    - [8.7.3] Relaying over undulating ground | p106 | L3782-3792
    - [8.7.4] Calculating the distance between pumps | p106 | L3793-3812
    - [8.7.5] Calculation one | p107 | L3813-3821
    - [8.7.6] Calculation two | p107 | L3822-3834
    - [8.7.7] Setting up the relay | p107-108 | L3835-3864
    - [8.7.8] Shutting down the relay | p108 | L3865-3877 | [SAFETY, CORE-OPS] Shutdown pressure spike (burst/casing fracture) and sequence.
    - [8.7.9] Breakdown (closed relay) | p108 | L3878-3892
    - [8.7.10] Communications | p108 | L3893-3907
  - [8.8] Summary | p109 | L3908-3952
- **9 Firefighting foam and foam-making techniques** | p110-123 | L3953-4465 | [CORE-OPS, BACKGROUND, TERMINOLOGY, SAFETY, LOW] Foam classes/expansion, foam-making equipment, RFS tanker round-the-pump proportioner procedures and flushing; mostly an optional extension for the game.
  - [9.1] Types of foam | p112-114 | L3999-4096 | [BACKGROUND, TERMINOLOGY] Class A/B, expansion ratios, high-energy foam.
    - [9.1.1] Class A foams | p112 | L4005-4012
    - [9.1.2] Class B foams | p112 | L4013-4028
    - [9.1.3] Low, medium and high expansion foams | p112-113 | L4029-4087 Expansion table at L4038-4069.
    - [9.1.4] Low and high energy foams | p113-114 | L4088-4096
  - [9.2] Foam-making equipment | p114-120 | L4097-4321 | [BACKGROUND, CORE-OPS] Branches, inductors, generators, proportioners, CAFS.
    - [9.2.1] Foam branches | p114-116 | L4115-4180
    - [9.2.2] Foam inductor and generator | p116-117 | L4181-4212
    - [9.2.3] Round-the-pump proportioner | p117-118 | L4213-4247 | [SAFETY, CORE-OPS] Foam-lock hazard; needs sub-atmospheric inlet pressure (L4220-4237).
    - [9.2.4] Automatic foam-proportioning systems | p119 | L4248-4278
    - [9.2.5] Compressed air foam systems (CAFSs) | p120 | L4279-4321
  - [9.3] NSW RFS tanker foam system operation | p121-122 | L4322-4389 | [CORE-OPS, TERMINOLOGY] Foam controls on RFS tankers: proportioner valves, recirc valve, Y strainer, concentrate drum.
    - [9.3.1] General description | p121 | L4323-4334
    - [9.3.2] Proportioner | p121 | L4335-4357
    - [9.3.3] Foam on/off (tank recirc.) valve | p121 | L4358-4369
    - [9.3.4] 'Y' type strainer | p122 | L4370-4377
    - [9.3.5] Foam concentrate | p122 | L4378-4389
  - [9.4] Proportioner operating procedure | p122-123 | L4390-4438 | [CORE-OPS, SCENARIO] Step lists: supply foam, standby, shut down, flush; extra notes at L4424-4436.
    - [9.4.1] To supply foam | p122 | L4391-4401
    - [9.4.2] On standby (charged hose) | p122 | L4402-4408
    - [9.4.3] To shut down foam | p122 | L4409-4415
    - [9.4.4] To flush foam system | p123 | L4416-4438
  - [9.5] Summary | p123 | L4439-4465
- **10 Appendix** | p124-128 | L4466-4660 | [TERMINOLOGY, LOW] Glossary, units/abbreviations and references.
  - Appendix A - Glossary of terms | p125-127 | L4469-4618 | [TERMINOLOGY] Glossary entries (AFFF ... Water hammer) plus maths abbreviations table at L4598-4613.
  - Appendix B - References | p128 | L4619-4660
- Notes (blank page) and back cover | p129-130 | L4661-4675 | [LOW]

## Tables, formulae and worked examples

Format: `Title | PDF pages | line range | [relevance] extraction status`. "intact" = numbers/text survived extraction. Table numbers follow the printed Table of Tables order; the body text cross-references some tables with different numbers (noted).

- Nozzle discharge formula L/min = 2/3 d^2 (P/100), as printed | p22 | L461-463 | [CORE-SIM] TEXT OK but formula as printed omits a square root; Table 1 values only fit 2/3 d^2 sqrt(P/100) (e.g. 20 mm at 500 kPa gives about 596) - verify before coding
- Table 1: Discharge through various sized nozzles (12-32 mm: optimum kPa, L/min, jet reaction kgf) | p22 | L465-490 | [CORE-SIM] numbers intact; bracketed values are formula-computed flow
- Table 2: Hydraulic terms (acceleration, force of gravity, newton, pascal, kPa) | p27 | L651-667 | [TERMINOLOGY] intact
- Worked: P = 10 x H, nozzle 16 m above pump (700 to 860 kPa); 16 m below (700 to 540 kPa); +/-10 kPa per metre rule | p28-29 | L702-741 | [CORE-SIM] intact
- Worked: weight of 1 m3 water to 10 kPa per metre derivation (F = m x a, g rounded to 10) | p27-28 | L669-695 | [BACKGROUND] intact
- Five laws of friction loss (length, diameter, velocity squared, roughness, pressure-independent) | p31 | L783-817 | [CORE-SIM] intact, includes twin-line quarter-loss reasoning L805-808
- Figure 11: Pressure loss vs flow rate chart (25 mm polythene, 38/52/65 mm layflat) | p32 | L833-873 | [CORE-SIM] GARBLED/IMAGE: curve data lost; y-axis labels irregular ("1,6000", missing 400); series names only. Use Table 3 instead
- Table 3: Effects of friction loss in a 30 m length of hose (kPa; low/medium/high flow bands; 25-90 mm, lined/unlined) | p32 | L876-915 | [CORE-SIM] numbers intact but column headers are scrambled by layout extraction (e.g. L879-883, L892-896, L905-909); read header order from PDF p32 image. Body text calls it "Table 2"
- Worked: low-flow friction (150 L/min, 25 mm x1 and x4 vs 38 mm lined x4); hose rated burst about 4000 kPa, operate at or below 25 percent | p33 | L926-958 | [CORE-SIM] intact
- Worked: high-flow friction (500 L/min at 700 kPa; 38 mm, 65 mm, mixed, 50 mm) | p33-34 | L961-993 | [CORE-SIM] intact
- Max flow per hose diameter for 100 kPa per 30 m (25 mm 100, 38 mm 250, 50 mm 500, 65 mm 1000, 70 mm 1200, 90 mm 2000 L/min); 700 kPa nozzle and 1000 kPa pump cap rationale | p34 | L996-1016 | [CORE-SIM] intact
- Worked: twinning supply lines (65 mm unlined, 1000 L/min: 1050 vs 255 kPa; 90 mm 195 kPa) | p35 | L1022-1044 | [CORE-SIM] intact
- Lift limits: atmospheric 101.3 kPa, 10 m theoretical, 8 m practicable, 7.5 m maximum attempted, 3 m rated lift | p37-38 | L1121-1176 | [CORE-SIM] intact; Fig 12-13 (L1154-1174) labels lost
- Table 4: Fractional loss of pump capacity vs lift (3.0 m rated, 4.5 m 1/7, 6.0 m 1/3, 7.0 m 1/2, 7.5 m 2/3 loss) | p38 | L1179-1194 | [CORE-SIM] intact
- Negative pressure vs lift (-10 kPa per metre); blocked-suction and air-leak behaviour | p38 | L1202-1208 | [CORE-SIM] intact; Fig 14 dimension labels (3 m, 7 m) are image-only
- Worked: rectangular pool capacity (8 x 4 x average depth x 1000 = 48000 L; 24 min at 2000 L/min) | p39 | L1221-1239 | [CORE-SIM] PARTLY GARBLED: average-depth fraction renders as stray symbols at L1231-1233
- Worked: cylindrical tank capacity 0.8 x depth x d^2 x 1000 (38400 L) | p40 | L1247-1257 | [CORE-SIM] intact
- Worked: flowing creek capacity (depth x width x speed x 1000 = 10000 L/min) | p41 | L1273-1294 | [CORE-SIM] intact except L1281-1285 repeats the cylinder calc by mistake (in PDF text layer); L1293 has "Error! Reference source not found"
- Figures 24-25: series vs parallel mode example flows/pressures (2000 L/min at 2100 kPa vs 4000 L/min at 1050 kPa) | p50 | L1587-1633 | [CORE-SIM] diagram labels survive as scattered text
- Compound gauge scale (about -100 to 0 kPa vacuum scale) and Fig 33-34 gauge faces | p61 | L1978-2028 | [CORE-OPS] scale in text; dial artwork lost, Fig 34 shows stray dial numbers L2009-2020
- Rotary vane primer duty limit (max 1 min running in 3) and foam-residue jam | p57-58 | L1890-1906 | [CORE-SIM] intact
- High-pressure low-volume pump figures (7000-15000 kPa, 2-20 L/min, 10 mm hose) | p75 | L2555-2559 | [LOW] intact
- Figure 44: High volume pump performance curve (head/power vs flow, GP960 with Honda GX200) | p76 | L2590-2595 | [LOW] IMAGE-ONLY: no curve data in text; only title; values would need reading from PDF p76
- Reserve-flow estimate from inlet-gauge pressure drop (<10 percent: 3x; <15 percent: 2x; <25 percent: 1x) plus 25 mm/1100 L/min worked case | p92 | L3117-3130 | [CORE-SIM] intact (last band wording is vague: "more than 25 percent, greater than original")
- Vacuum test and priming procedure (inlet gauge about 10 kPa per metre lift; 4 m lift gives about 40 kPa) | p93-94 | L3195-3225 | [CORE-OPS] intact
- Table 5 (duplicate of Table 4): lift vs capacity loss | p94 | L3234-3252 | [CORE-SIM] intact
- Cavitation: boiling point falls with pressure (70 kPa gives 89.6 C); causes and symptoms | p96-97 | L3339-3370 | [CORE-SIM] intact
- Nozzle pressure limits until "water on" confirmed (550 kPa controlled, 400 kPa open branch); fog 700 kPa | p98 | L3417-3428 | [CORE-SIM] intact
- Table 6: Fault finding using appliance tanks (indication / cause / action; includes cavitation) | p100-102 | L3535-3609 | [SCENARIO] text OK; multi-line bullet cells, row pairing must be rebuilt from PDF p101-102 layout
- Table 7: Fault finding using reticulated water | p102-103 | L3620-3682 | [SCENARIO] as above
- Table 8: Fault finding using static/open water (incl. loss of prime) | p104 | L3697-3740 | [SCENARIO] as above
- Relay spacing formula: hoses between pumps = (600 kPa +/- static head) / friction loss per length; 700 kPa out, 100 kPa residual in | p106 | L3793-3803 | [CORE-SIM] intact
- Worked: 350 m relay (120 m + 180 m + 50 m, three pumps) | p106-107 | L3805-3833 | [CORE-SIM] intact
- Relay set-up pressures (500 kPa fill, 700 kPa operating, 100 kPa min inlet; 2 spare hose lengths); 30 percent output loss on booster failure | p107 | L3845-3857 | [CORE-SIM] intact; breakdown L3878-3881
- Table 9: Foam expansion levels (low 2:1-20:1, medium 20:1-200:1, high 200:1-2000:1) | p113 | L4038-4069 | [BACKGROUND] intact; body text calls it "Table 7"
- Foam proportioner procedure pressures (above 600 kPa, 700 kPa optimum; inlet below +50 kPa on 75 mm closed relay) | p122-123 | L4391-4436 | [CORE-OPS] intact
- Maths abbreviations and units (bar, d, H, kPa, L/min, m/sec2, N/m2, P) | p127 | L4598-4613 | [TERMINOLOGY] intact

## Extraction quality notes
- **Blank pages (no text, no images):** PDF p2, 4, 11, 13.
- **Divider pages (chapter number and title only, under 170 chars):** p17 (Ch1), p20 (Ch2), p43 (Ch3), p53 (Ch4), p59 (Ch5), p71 (Ch6), p78 (Ch7), p88 (Ch8), p110 (Ch9), p124 (Ch10).
- **Image-dominated pages with little or no usable text:** p1 (cover photos), p12 (E-learning / Knowledge Hub banner, 309 chars), p130 (back-cover contact block only). No page in the body is a full-page scan: every body page has a real text layer, and table text was extractable throughout.
- **Tables:** all 9 tables came through as text with numbers intact. Table 3 (friction loss, p32, L876-915) has scrambled column-header order; check the header order against the PDF image before transcribing. Tables 6-8 (fault finding, p100-104, L3535-3740) keep their words, but cause/action cells are multi-bullet lists so the cause-to-action pairing is approximate in the text.
- **Charts and diagrams whose content is lost (image/vector only, text has caption or stray labels at best):**
  - Fig 11 friction-loss curves (p32, L833-873): data points lost; axis labels irregular.
  - Fig 12-14 lift/atmosphere diagrams (p37-39, L1154-1213): the 3 m / 7 m / 10 m dimension labels are not reliably in the text.
  - Fig 33-36 gauge faces and tank gauge (p61-64): dial scales lost; Fig 34 leaves stray dial numbers at L2009-2020.
  - Fig 44 pump curve (p76, L2590-2595): image only, no data in text.
  - Fig 52-53 open/closed relay layouts (p105-106, L3765, L3780): captions only.
  - Fig 1-10, 15-23, 26-32, 37-43, 45-51, 54-62: explanatory illustrations; captions only.
- **Garbled or broken text spots:** L1231-1233 (average-depth fraction rendered as stray characters); L1293, L1653, L1773 ("Error! Reference source not found." Word cross-reference failures, referring to Fig 17, 26, 29); L1998 (sentence cut off by a broken cross-reference to Fig 34); L1281-1285 (creek example repeats the cylinder calculation, present in the PDF text layer itself); L2231 stray "]"; L2718 stray backslash in a caption.
- **Source-document inconsistencies (not extraction faults), worth knowing before using as sim constants:** the nozzle discharge formula (L462) is printed without the square root that Table 1 implies; the lift-vs-capacity table appears twice (Table 4 L1179, Table 5 L3234); body text cites tables by different numbers than their captions (friction table cited as Table 2/3, foam table cited as Table 7); Chapter 7 learning objectives (L2633-2636) are copied from Chapter 6 (portable pump); even-numbered page footers read "Trainers Guide" instead of "Manual".
- **Reading aids:** the last line of each page is its footer (printed page number plus "NSW RURAL FIRE SERVICE - HYDRAULICS MANUAL/TRAINERS GUIDE V4.0"); the form feed sits at the start of each page's first line, so a line holding `^L^L` begins a page after a blank page.
