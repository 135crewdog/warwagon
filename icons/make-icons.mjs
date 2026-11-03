// Draws the app icon, the KC-135's planform in HUD green on black, as SVG and
// rasterises it with Chromium at the sizes iOS and the manifest need. A
// developer tool: needs Playwright installed, like the browser smoke test.
//
//   node icons/make-icons.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));

// The planform from the fact sheet's dimensions (length 136 ft, span 131 ft,
// wing swept 35°): [feet from the nose, half-width in feet] down the right
// side, mirrored for the left. The fuselage, the wing with its sweep and
// taper, the stabiliser and the boom.
const PLANFORM = [
  [0, 0], [4, 2.5], [10, 5], [18, 6], [30, 6.3], [48, 6.3],
  [50, 6.3], [78, 65.4], [86, 65.4], [72, 20], [66, 6.3],
  [105, 6.3], [108, 10], [122, 19.8], [128, 19.8], [122, 7], [132, 5], [136, 3], [142, 1.2], [142, 0],
];
const SCALE = 82 / 142, CX = 50, TOP = 9;      // nose up, 142 ft (with the boom) across 82 of the 100-unit box
const right = PLANFORM.map(([x, w]) => [CX + w * SCALE, TOP + x * SCALE]);
const left = PLANFORM.slice().reverse().map(([x, w]) => [CX - w * SCALE, TOP + x * SCALE]);
const points = right.concat(left).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
// the four engine pods, under the wing
const pods = [[25, 54], [43, 65]].map(([y, x]) => `<rect x="${(CX + y * SCALE - 1.6).toFixed(2)}" y="${(TOP + x * SCALE).toFixed(2)}" width="3.2" height="7.5" rx="1.2" fill="#000"/>
  <rect x="${(CX - y * SCALE - 1.6).toFixed(2)}" y="${(TOP + x * SCALE).toFixed(2)}" width="3.2" height="7.5" rx="1.2" fill="#000"/>`).join('\n  ');
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#000"/>
  <polygon points="${points}" fill="#7CFF4F"/>
  ${pods}
</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-32.png', 32]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#000">${svg(size)}</body></html>`);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  writeFileSync(join(here, name), buf);
  console.log(name, buf.length, 'bytes');
}
writeFileSync(join(here, 'icon.svg'), svg(512));
await browser.close();
