// Render public/icons/icon.svg to the PNG sizes the web manifest and iOS want. Run by hand when the
// icon changes (`node scripts/make-icons.mjs`) and commit the PNGs; the build doesn't run it.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = await readFile(`${dir}icon.svg`, 'utf8');
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

// Maskable icons keep their art inside the central 80 % safe zone.
const sizes = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];
for (const { file, size, pad } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  const inset = Math.round(size * pad);
  await page.setContent(
    `<body style="margin:0;background:#1b1e21"><div style="padding:${inset}px">` +
      svg.replace('<svg ', `<svg width="${size - 2 * inset}" height="${size - 2 * inset}" `) +
      '</div></body>',
  );
  await page.screenshot({ path: `${dir}${file}`, omitBackground: false });
  console.log(`wrote public/icons/${file}`);
}
await browser.close();
