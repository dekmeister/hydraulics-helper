# RFS Bush Firefighter Manual v4.0 — notes for the game

Companion to `hydraulics-manual-GAME-NOTES.md`. Reviewed 2026-11-01 for anything the pump game can use, mainly to settle the bush crew's line (CALIBRATION "needs Dek" rows 7 and 50).

**Source:** `2020-11-01 RFS BUSH FIREFIGHTER MANUAL.pdf`, 264 pages (v4.0, November 2020).
**Text:** `bush-firefighter-manual.txt` (`pdftotext -layout`, 12,806 lines; the page is two-column, so read a page with `pdftotext -f N -l N` without `-layout` when you need reading order).
**Citations:** `L1234` = line in `bush-firefighter-manual.txt`; `p69` = PDF page. **PDF page = printed page + 10** (printed 59 "Hoses and small gear" = PDF 69).
**Status tags** as in the hydraulics notes: `MANUAL` = stated here; `DERIVED` = computed by us; `GAP` = silent.

**Read in full:** Ch 3 §7–9 (hoses, small gear, water supplies, pumps, relays, hose lay; p69–87), Ch 1 §5 hose reels (p19–20), Ch 4 §4 and §10 (suppression, working with tankers; p94–98, p108), Ch 7 §2 (typical operation; p160–164), tanker call-sign categories (p189). The rest (bushfire behaviour, PPE, hand tools, hazard reduction, first aid, radio, brigades) was keyword-searched only; no hydraulics content found.

---

## 1. Headline finding

**The Bush Firefighter manual has no hydraulic figures at all**: no friction loss, no branch flows or pressures, no pump pressures, no typical number of lengths. It is a foundation-level course; it says pump operation is taught in the Advanced Firefighter "pumps and pumping" component (p78, L3683). So it **cannot settle** the 25 mm canvas friction (row 50) or the bush branch flow (row 7). What it does give is doctrine on *which hose and branch* crews use, which constrains what the game should model (§2).

## 2. Findings relevant to the game

| # | Finding | Source | Status | Bearing on the game |
|---|---|---|---|---|
| 1 | Two delivery hose types "often used in rural firefighting": **unlined – percolating** (weeps droplets so it resists burning and scorching against hot material and embers) and **lined – non-percolating** (rubber/plastic lining, no seepage). | L3246–3256, p70 | MANUAL | Confirms `25U` (percolating canvas) is a real, standard bush hose, as Dek says. No friction figure given. |
| 2 | Hose size categories: **small (e.g. 25 mm)** "lightweight… to attack a small fire or to attach to the end of a hose reel to extend its reach"; **medium (e.g. 38 mm)** "fast to deploy… medium volume of water… excellent for fighting more intense bush fires"; **large (e.g. 65 mm)** "quite unusual to use a large hose for fire attack on a bush fire", for supply over distance. | L3220–3270, p70 | MANUAL | Matches issue #10's settings (25/38 mm attack, 65 mm supply only). 38 mm is the doctrinal line for heavier bush attack, so longer or harder bush scenarios can reasonably run 38 mm. |
| 3 | Branches: **standard** (jet) and **variable control** (shut-off, *water volume control*, jet/spray selector, fog). "It is always preferable to select a variable control branch"; "These branches operate at **different pressures** and the manufacturer's specifications should be consulted"; automatic branches "maintain a constant pressure at the branch over a wide range of flow rates." | L3400–3430, p72–73 | MANUAL | **Key for row 7.** Bush crews normally carry a *variable-flow* branch, not a fixed 12 mm smooth-bore tip. Flow is chosen at the branch, so the game's fixed 12 mm / 250 kPa / ~150 L/min is just one setting, likely a high one for long canvas lays. The manual defers flow and pressure to the manufacturer → GAP. |
| 4 | "Pumps working on too high a pressure will always make branch handling difficult." Change pressure and flow gradually: sudden changes alter jet reaction and cause water hammer. | L3436, p73; p81 | MANUAL | Already modelled (hammer, gradual throttle). Supports a coach line about not over-pressuring. |
| 5 | Hose is tested by pressurising to **1000 kPa**. | L10860, p225 | MANUAL | Agrees with the hydraulics manual's ~1000 kPa working ceiling. A lay that needs well over 1000 kPa at the pump is outside normal practice. |
| 6 | Centrifugal pump: pressure max / flow min with outlets shut; **pressure drops as outlets are opened** at constant speed; pressure and flow vary with pump speed. | L3750, p79 | MANUAL | Already modelled (pump curve and droop). |
| 7 | Hose lay: take all excess hose to the fire in 'S' bends; the **last 3–5 m to the branch laid straight**; a damaged length is replaced alongside. Drills cover "adding extra lengths of hose and replacing a damaged length". | L3993, p85; p89, p248 | MANUAL | Supports adding lengths in play (`moveBranch addLengths`) and the burst-length repair. No count of lengths given. |
| 8 | Hydrant supply: "use the **largest size hose available** between the hydrant and the pump"; watch that the inlet pressure doesn't fall to zero. | L3880, p82 | MANUAL | Matches the hydrant lessons. |
| 9 | Max practicable lift ≈ **8 m**. | L3888, p82 | MANUAL | Same as the hydraulics manual. |
| 10 | Moving grass-fire attack: typically a **38 mm branch** angled forward to knock down, another 38 mm branch or a hose reel angled rearward. | L5163, p108 | MANUAL | A possible future scenario (pump-and-roll); 38 mm again for heavier attack. |
| 11 | Tankers keep a **self-protection reserve, e.g. 1000 L on large Cat 1 tankers**. | L1764, p40 | MANUAL | New: a lesson objective or tank-low warning could use the 1000 L reserve rather than "ran dry". |
| 12 | Tanker categories by water carried: **Cat 1 = 4×4, 3001–4000 L**; Cat 7 = 4×4, 801–1600 L; Cat 9 = 4×4, 350–800 L (full list Cat 1–9). | L9163–9170, p189 | MANUAL | **`cat1.ts` tank `capacityL: 3000` (PLACEHOLDER) is below the Cat 1 band**; 3001–4000 L. `cat7.ts` 1600 L is at the top of its band ✓. |
| 13 | Vehicle hose reels: 19/20 mm usually, some tankers 25 mm; "dial-a-jet" nozzles with selectable settings. | L741, L3201, L7818; p20, p69, p164 | MANUAL | Hose reels aren't modelled yet. |

## 3. What this means for the bush-line question

* **Still open (GAP in both manuals):** friction loss of 25 mm percolating hose, and the flow/pressure of the branches bush crews carry. Neither RFS manual has them.
* **Narrowed:** Finding 3 shows the branch is normally variable-flow, set by the crew. That fits Dek's field experience (2+ lengths of canvas routinely, 5+ seen) better than a fixed 12 mm tip at ~150 L/min. With the current `25U` friction, lays that long only work at roughly 70–100 L/min (DERIVED: 5 lengths, ~1000 kPa at the pump, ~250–300 kPa at the branch → ~140 kPa a length → ~70 L/min on `25U`).
* **Next sources**, since neither manual has the numbers:
  1. The branch on Dek's truck (make/model, flow settings in L/min, rated pressure); its datasheet gives flow vs pressure directly.
  2. A friction-loss datasheet for the 25 mm percolating hose RFS issues (manufacturer or the RFS equipment SOP / "SP/5 EQO Manual", L3244, p70), or US NWCG wildland hose tables as a cross-check.
  3. One field reading: lengths, discharge gauge, branch setting.
  4. The Advanced Firefighter / pumps course material, which this manual says covers pump operation.
