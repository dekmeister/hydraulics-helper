#!/usr/bin/env node
// Fail the production build if e2e-only test hooks leaked into it (docs/TESTING.md §3), or if the
// install-to-home-screen pieces (manifest, its icons, service worker) didn't ship.
// Usage: node scripts/check-prod-bundle.mjs [distDir]   (default: dist)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const pwa = [];
const manifestPath = join(distDir, 'manifest.webmanifest');
if (!existsSync(manifestPath)) pwa.push('manifest.webmanifest missing');
else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const icon of manifest.icons ?? [])
    if (!existsSync(join(distDir, icon.src))) pwa.push(`manifest icon ${icon.src} missing`);
  for (const size of ['192x192', '512x512'])
    if (!(manifest.icons ?? []).some((i) => i.sizes === size && i.type === 'image/png'))
      pwa.push(`no ${size} PNG icon (needed to install)`);
}
if (!existsSync(join(distDir, 'sw.js'))) pwa.push('sw.js missing');
if (!readFileSync(join(distDir, 'index.html'), 'utf8').includes('rel="manifest"'))
  pwa.push('index.html has no manifest link');
if (pwa.length > 0) {
  console.error(`check-prod-bundle: PWA incomplete:\n  ${pwa.join('\n  ')}`);
  process.exit(1);
}
console.error(
  `check-prod-bundle: ${String(files.length)} file(s) clean; manifest, icons, sw.js ok`,
);
