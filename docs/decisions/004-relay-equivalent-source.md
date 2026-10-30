# 004 — A closed relay is the supplying pump as an equivalent source

**Problem.** In a closed relay one truck's delivery feeds another truck's suction inlet, so the two solves depend on each other.

**Decision** (`sim/relay.ts`). Seen from its relay delivery, a pump on tank or hydrant supply is exactly `P = H − R·Q²`: the pump curve and the inlet loss are both square laws. Each tick:

1. Upstream first (`relayOrder`, a topological sort; a loop throws), prepare each truck, then fit `H` and `R` from two solves of the supplier: relay flow 0, and the link's previous flow (`RELAY_FIT_PROBE_LPM` when dry).
2. The receiver takes the relay as one more inlet path ([003](003-inlets-as-parallel-paths.md)), so its inlet and cavitation machinery is unchanged.
3. Downstream first, solve each truck with its closed relays taking exactly what the receiver drew, so water is conserved.

Chains (base → booster → attack) work the same way. An open relay ends at atmosphere (into a tank or a portable dam), so the pumps are decoupled.

**Bursts** (`checkBursts`). Peak pressure is the higher end now, or, when the receiving pump cut the flow this tick by shutting a valve, the higher end before plus a Joukowsky surge. At `HOSE_BURST_KPA` a length bursts where the pressure was highest. A flow lost at the supplying end sends no surge. So slamming the relay inlet bursts it, and throttling down from the attack end and easing shut doesn't, which is the manual's shutdown sequence (L3865–3873). A burst is latched until a lesson event or free play's "Replace burst length" repairs it.

**Costs.** The fit is exact only with the relay alone open; with other lines, relief or a cavitation cap it is a secant through the last operating point that settles over a few ticks. It reads last tick's flow, so a saved game must keep `linkReadings`. The burst surge is per tick (CALIBRATION 22, 27).
