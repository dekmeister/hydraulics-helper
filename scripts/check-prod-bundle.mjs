#!/usr/bin/env node
// Fail the production build if e2e-only test hooks leaked into it (docs/TESTING.md §3).
// Usage: node scripts/check-prod-bundle.mjs [distDir]   (default: dist)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const FORBIDDEN = ['__pumpops', 'Unknown fixture', 'shell/default', 'tank-attack-700'];

const files = readdirSync(distDir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.js'))
  .map((d) => join(d.parentPath, d.name));

const leaks = files.flatMap((file) => {
  const src = readFileSync(file, 'utf8');
  return FORBIDDEN.filter((needle) => src.includes(needle)).map((needle) => `${file}: ${needle}`);
});

if (files.length === 0) {
  console.error(`check-prod-bundle: no .js files in ${distDir}`);
  process.exit(1);
}
if (leaks.length > 0) {
  console.error(
    `check-prod-bundle: test hooks found in production bundle:\n  ${leaks.join('\n  ')}`,
  );
  process.exit(1);
}
console.error(`check-prod-bundle: ${String(files.length)} file(s) clean`);
