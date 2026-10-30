# Decision records

Short records of choices that shape the code and would be expensive to rediscover. Each says what we decided, why, and what it costs. They are not a changelog: write one when a decision constrains future work, and keep it under a page. If a fact is only about one module, put it in that module's header comment instead; if it's a doctrine figure, it belongs in `docs/CALIBRATION.md`.

| # | Decision |
|---|---|
| [001](001-quasi-steady-solver.md) | Quasi-steady network solve plus slow integrators, fixed 10 Hz |
| [002](002-appliances-are-data.md) | An appliance is data: spec, inputs by control id, layout, scene art |
| [003](003-inlets-as-parallel-paths.md) | Inlets are ports; sources join the pump inlet as parallel paths |
| [004](004-relay-equivalent-source.md) | A closed relay is the supplying pump as an equivalent source |
| [005](005-lessons-are-declarative-data.md) | Lessons are symbolic, JSON-shaped data run beside the sim |
| [006](006-ui-state-stays-out-of-the-sim.md) | UI reads sim state through selectors; UI-only state never enters it |
