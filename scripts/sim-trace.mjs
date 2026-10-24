// Print a scenario's golden trace as an aligned table: the headless sim demo (docs/TESTING.md §2).
// Usage: npm run sim:trace -- <scenario> [applianceId]   (default: every eligible appliance)
// Loads the TypeScript sim through Vite's module runner, so no extra TS runtime is needed.
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const [scenarioId, applianceId] = process.argv.slice(2);
const entry = fileURLToPath(new URL('../src/sim/scenarios/index.ts', import.meta.url));
const { module: sim } = await runnerImport(entry, { configFile: false, logLevel: 'silent' });

if (scenarioId === undefined) {
  console.error('Usage: npm run sim:trace -- <scenario> [applianceId]');
  console.error(`Scenarios: ${sim.SCENARIOS.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

const scenario = sim.getScenario(scenarioId);
const specs = sim
  .eligibleAppliances(scenario)
  .filter((spec) => applianceId === undefined || spec.id === applianceId);
if (specs.length === 0) {
  console.error(`No registered appliance ${applianceId ?? ''} can play '${scenario.id}'`);
  process.exit(1);
}

for (const spec of specs) {
  const rows = sim
    .scenarioTraceCsv(scenario, spec)
    .trimEnd()
    .split('\n')
    .map((line) => line.split(','));
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  console.log(`\n${scenario.title} — ${spec.name} (${spec.id})\n`);
  for (const row of rows) console.log(row.map((cell, i) => cell.padStart(widths[i])).join('  '));
}
