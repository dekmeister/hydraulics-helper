# 003 — Inlets are ports; sources join the pump inlet as parallel paths

**Decision.** An appliance's inlets are ports (`InletKind` `tank | suction | tankFill`). What is plugged into an external inlet is scenario data: `SimState.sources` (hydrants, static water) and `SimState.supplies` (inlet → source over hose segments). Every open path that can deliver water is a source head behind a resistance (`sim/inlets.ts`), and the paths combine in parallel at the pump inlet:

- tank: the water's head above the pump, minus a small flow loss (the compound reads slightly negative when flowing);
- hydrant to suction: static pressure less main, layflat and valve losses, a square law;
- draught: `−10·lift` less hard suction, strainer and valve losses, and only once primed;
- closed relay: see [004](004-relay-equivalent-source.md).

The inlet is floored at `pump.cavitationInletKpa`. At the floor the flow is capped, extra rpm adds nothing, and `readings.cavitation` says how far past the cap the pump would go. Layflat collapses at 0 kPa, so over-running a hydrant or relay reads "inlet zero, hose soft".

**Hydrant to tank is not a pump-side path.** A `tankFill` inlet feeds the tank past the pump whatever the pump is doing, and the tank overflows when full. That is how a hydrant is normally taken: the pump keeps working off tank to pump and the tank level is the operator's gauge for whether the hydrant keeps up.

**Returns to the tank** (relief dumped to the tank, pump to tank, recirculation) are demand drawn through the inlets and handed back to the tank, so on tank supply the level holds and the flow counts as cooling.

**Priming** is one `pump.primed` flag, so `validateSite` allows one static source per truck.

**Why.** One mechanism gives tank, hydrant, draught and relay supply, and cavitation falls out of the floor; a single cavitation pressure (−84 kPa) reproduces the manual's Table 4 lift derate.

**Costs.** Every pump-side sum over `inletFlowLpm` must exclude `tankFill` (`inletPaths`, `warnings.ts`, `SceneTruck`, `site.ts` do), and returns to the tank are summed by hand per mechanism. Both are in `docs/BACKLOG.md` code health.
