# 001 — Quasi-steady network solve plus slow integrators

**Decision.** Hydraulic transients settle in seconds and play happens over minutes, so each tick (`TICK_S` = 0.1 s, fixed; `state/loop.ts` accumulates real time into whole ticks) does two things:

1. Solve the network as if steady (`sim/network.ts`): given valves, throttle, sources and lays, find the flows and pressures.
2. Euler-step the slow states: tank and dam volumes, line water, pump temperature, primer vacuum, engine rpm lag.

Each open line has a closed-form flow, `Q = √((P_d − 10·Δh)/R)`. The only search is a bisection on discharge pressure for a fixed `SOLVER_ITERATIONS`, plus one for the inlet pressure over the parallel inlet paths. No matrix solver, no library.

Units are kPa, L/min and metres. 1 m of head is **10 kPa**, the figure the manual teaches, not the physical 9.8.

**Why.** Determinism: golden traces, replays and the NaN/edge fuzz tests need `advance(state, inputs, dt)` to give the same answer every time, and a fixed-count bisection on a monotone function does. It is also fast enough that the UI's needles, not the solver, set the frame cost.

**Costs.**
- No fluid inertia: a filling line's front moves at the quasi-steady flow (CALIBRATION "needs Dek" 44).
- Surges (water hammer, relay burst) are the flow drop over one tick, so they depend on the tick rate (CALIBRATION 21, 27). Fine at the fixed 10 Hz, not a physical closure time.
- Revisit only if a scenario needs real transients.
