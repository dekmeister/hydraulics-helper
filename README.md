# PumpOps — pump operator part-task trainer

A part-task trainer for fire appliance pump operation, built as a browser game. You work the pump panel and a hydraulics simulation responds the way a real pump does. It runs entirely in the browser and works on a phone.

> PumpOps is an independent training aid. It is not produced or endorsed by any fire service, and it doesn't replace your brigade's training, your manuals or your instructors.

## What you can do

- **Work a pump panel.** Gauges (discharge, compound, tacho, tank), delivery and inlet valves, throttle and primer, in either a **simplified** panel or a **realistic** one drawn like the real pump bay. Every job starts with the pump engine cold and ends with it shut down: ignition on, hold START until it fires, and at the end hold STOP until it has stopped (let go too soon and it picks up again).
- **See the fireground.** A map of the truck, hose lays, branches and crews, water sources and other trucks. Lines charge when water flows; tap a hose to find its delivery on the panel.
- **Play the lesson ladder.** Seven scenarios, from your first 38 mm line on tank through hydrant supply, draughting, closed and open relays, to a changing incident. The first one is fully guided. Each ends with a debrief that tells you what went wrong and why ("you cavitated for 40 s: the lift was too high for that flow").
- **Free play.** Any scenario's setup with no objectives, to experiment.
- **Choose your truck.** Each appliance has its own pump, plumbing and panel layout. Currently a Category 1 and a Category 7 tanker.

Terminology is Australian fire-service throughout: deliveries, branches, draughting, tank-to-pump, kPa and L/min.

## Running it

You need Node.js 20.19 or newer.

```bash
npm install
npm run dev        # open the URL Vite prints
```

To build a static copy you can host anywhere:

```bash
npm run build      # output in dist/
npm run preview    # serve the build locally
```

The build is a plain static site and installs to a phone's home screen as a web app.

## How accurate is it?

The simulation aims to be _honest_ rather than exact: the right shape of behaviour, with numbers close enough to what an operator is taught. Figures come from published hydraulics doctrine where possible, and every constant in the code says where it came from. Values that are still estimates are marked `PLACEHOLDER` in the source and listed in [`docs/CALIBRATION.md`](docs/CALIBRATION.md), along with the worked examples the tests check against. If something reads wrong to you, an issue with the scenario and what you'd expect to see is very welcome.

## Developing

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `npm run dev`      | Dev server with hot reload                                           |
| `npm run test`     | Unit tests: the simulation, every appliance, scenario traces         |
| `npm run test:e2e` | Browser tests with Playwright at phone, tablet and desktop widths    |
| `npm run test:e2e:full` | The same over every width × appliance × state (slow; opt-in)   |
| `npm run review`   | Screenshot baselines and a visual review bundle in `review/`         |
| `npm run lint`     | ESLint and Prettier                                                  |
| `npm run build`    | Type-check and production build                                      |
| `npm run verify`   | All of the above, in order; must pass before a change goes in        |

Browser tests need Playwright's Chromium: `npx playwright install chromium`.

The stack is TypeScript, React, SVG, Zustand, Vite, Vitest and Playwright. The core idea is that the hydraulics live in a pure, deterministic library (`src/sim/`) with no UI in it, and each truck is a data definition rather than code, so adding an appliance means writing its spec and panel layout, not changing the engine.

Where to read next:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the sim, state and UI fit together, and how to add an appliance (§9).
- [`docs/BACKLOG.md`](docs/BACKLOG.md): what's left to build, open follow-ups and risks.
- [`docs/CALIBRATION.md`](docs/CALIBRATION.md): the doctrine figures and worked examples the sim is held to.
- [`docs/TESTING.md`](docs/TESTING.md): the testing approach, fixtures and the screenshot review loop.
- [`Design/`](Design/README.md): the visual design spec, tokens and reference art.
- [`CLAUDE.md`](CLAUDE.md): working rules for AI coding agents on this repo (also a decent summary of the house rules for anyone).

## License

[MIT](LICENSE).
