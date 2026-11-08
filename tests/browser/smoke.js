#!/usr/bin/env node
// Browser smoke test: serves the repo, loads the app in headless Chromium at
// an iPhone-sized landscape viewport, waits for the ground to load, taps Fly,
// feeds simulated tilt and checks that it renders and the jet responds. Playwright and Chromium must
// be installed as developer tools; they are not an app dependency.
//
//   node tests/browser/smoke.js [screenshot-dir]

import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { serve, sensor } from './harness.js';

const require = createRequire(import.meta.url);

async function main() {
  const shots = process.argv[2];
  const { chromium } = require('playwright');
  const { server, url } = await serve();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    await context.grantPermissions(['accelerometer', 'gyroscope', 'magnetometer']);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    const shot = async (name) => {
      if (!shots) return;
      try { await page.screenshot({ path: join(shots, `${name}.png`), timeout: 10000, animations: 'disabled' }); }
      catch (e) { console.warn(`screenshot ${name} skipped: ${e.message.split('\n')[0]}`); }
    };

    await page.goto(url + 'index.html?debug=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.warwagon && window.warwagon.version);
    const version = await page.evaluate(() => window.warwagon.version);
    assert.equal(await page.evaluate(() => window.warwagon.mode), 'start');
    assert.equal(await page.evaluate(() => document.getElementById('screen-start').hidden), false);
    await shot('start');
    await page.click('#settings-start');
    assert.equal(await page.evaluate(() => document.getElementById('screen-settings').hidden), false, 'settings from the start screen');
    await page.click('#settings-done');
    assert.equal(await page.evaluate(() => document.getElementById('screen-start').hidden), false, 'done returns to the start screen');

    // the ground loads (Fly is disabled until it has), and the air start is 10,000 ft over Newmarket at 250 KIAS, pointed at Mildenhall
    await page.waitForFunction(() => window.warwagon.terrain !== null, null, { timeout: 60000 });
    const ground = await page.evaluate(() => ({ patches: window.warwagon.terrain.region.patches.length, ground: window.warwagon.ground, water: window.warwagon.terrain.sampler.waterAt(-569000 + 400000, -(278000 - 400000)) }));
    assert.equal(ground.patches, 2, 'the Mildenhall patch and the two bases in LiDAR');
    assert.ok(ground.ground > 50 && ground.ground < 250, `Newmarket's heath is about 110 ft up: ${ground.ground} ft`);
    assert.equal(ground.water, 0, 'the middle of England is dry');
    const colour = await page.evaluate(() => ({ ...window.warwagon.terrain.colour, expect: { base: window.warwagon.terrain.region.base, atlas: window.warwagon.terrain.region.atlas, scale: window.warwagon.terrain.region.colour.scale } }));
    assert.deepEqual([colour.base.w, colour.base.h], [colour.expect.base.w, colour.expect.base.h], 'the base imagery sits on the base posts');
    assert.deepEqual([colour.atlas.w, colour.atlas.h], [colour.expect.atlas.w * colour.expect.scale, colour.expect.atlas.h * colour.expect.scale], 'the patch imagery at its scale');
    // tap Fly: no permission prompt in Chromium, so flight starts at once, at the air start
    await page.click('#fly');
    await page.waitForFunction(() => window.warwagon.mode === 'flying');
    const start = await page.evaluate(() => ({ alt: window.warwagon.sim.airdata.altitude, agl: window.warwagon.sim.airdata.altitude - window.warwagon.ground, heading: window.warwagon.sim.airdata.heading, kcas: window.warwagon.sim.airdata.kcas, nz: window.warwagon.sim.aux.nz, n1: window.warwagon.sim.engines.n1 }));
    assert.ok(Math.abs(start.alt - 10000) < 1 && Math.abs(start.kcas - 250) < 0.5, `the air start: ${start.alt} ft (${start.agl} ft above the ground), ${start.kcas} KIAS`);
    assert.ok(Math.abs(start.heading - 22) < 0.5, `pointed at Mildenhall: ${start.heading}`);
    assert.ok(Math.abs(start.nz - 1) < 0.01 && start.n1 > 40 && start.n1 < 80, `trimmed at 1 g, N1 ${start.n1}`);
    assert.equal(await page.evaluate(() => document.getElementById('controls').hidden), false);

    // feed tilt until the simulation has flown `seconds` of its own time
    const simTime = () => page.evaluate(() => window.warwagon.sim.time);
    const feed = async (back, turn, seconds) => {
      const s = sensor(back, turn);
      const t0 = await simTime();
      const deadline = Date.now() + 120000;
      while ((await simTime()) < t0 + seconds) {
        if (Date.now() > deadline) throw new Error(`the simulation did not advance ${seconds} s in 120 s of wall time`);
        await page.evaluate((o) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', o)), s);
        await page.waitForTimeout(16);
      }
    };
    await feed(30, 0, 0.5);
    assert.ok(await page.evaluate(() => window.warwagon.neutral !== null), 'neutral captured');
    const level = await page.evaluate(() => ({ nz: window.warwagon.sim.aux.nz, bank: window.warwagon.sim.airdata.roll, t: window.warwagon.sim.time }));
    assert.ok(level.t > 0.3, `simulation advancing: t ${level.t}`);
    assert.ok(Math.abs(level.nz - 1) < 0.1, `level at ${level.nz} g`);
    assert.ok(await page.evaluate(() => window.warwagon.draws > 0), 'the renderer drew something');
    await shot('level');

    // pull: tilt the top edge 20° toward the pilot; the jet is slow to answer, so give it 3 s
    await feed(50, 0, 3);
    const pulled = await page.evaluate(() => ({ nz: window.warwagon.sim.aux.nz, yoke: window.warwagon.yoke.pitch, de: window.warwagon.surfaces.de, pitch: window.warwagon.sim.airdata.pitch }));
    // the sensor's sense in headless Chromium is not the phone's (the mapping's signs were set on the iPhone), so either way counts
    assert.ok(Math.abs(pulled.yoke) > 0.5, `pitch yoke moved: ${pulled.yoke}`);
    assert.ok(Math.abs(pulled.de) > 2 && Math.sign(pulled.de) === -Math.sign(pulled.yoke), `the elevator followed the yoke: yoke ${pulled.yoke}, elevator ${pulled.de}`);
    assert.ok(pulled.nz > 1.3 || pulled.nz < 0.7, `the jet responded in g: ${pulled.nz}`);
    await shot('pull');

    // roll: turn the wheel 25° to the right; a heavy jet takes a few seconds to bank
    await feed(30, -25, 4);
    const sf = await page.evaluate(() => ({ da: window.warwagon.surfaces.da, dr: window.warwagon.surfaces.dr, is: window.warwagon.surfaces.is }));
    assert.ok(Math.abs(sf.da) > 2, `roll control deflected in the roll: ${sf.da}`);
    const rolled = await page.evaluate(() => ({ bank: window.warwagon.sim.airdata.roll, yoke: window.warwagon.yoke.roll }));
    assert.ok(Math.abs(rolled.yoke) > 0.5, `roll yoke moved: ${rolled.yoke}`);
    assert.ok(Math.abs(rolled.bank) > 10, `the jet banked: ${rolled.bank}`);
    await shot('roll');

    // full throttle: the engines spool, N1 climbs toward the cap
    await page.evaluate(() => { window.warwagon.throttle = 1; });
    await page.waitForFunction((n0) => window.warwagon.sim.engines.n1 > n0 + 10, start.n1, { timeout: 60000 });
    await shot('power');
    await page.evaluate(() => { window.warwagon.throttle = 0.3; });

    // look around: a drag on the view swings the camera; lifting the finger eases it back
    await page.mouse.move(600, 200); await page.mouse.down(); await page.mouse.move(420, 240, { steps: 6 });
    const yaw = await page.evaluate(() => window.warwagon.look.yaw);
    assert.ok(yaw < -20, `dragging left looks right: yaw ${yaw}`);
    await shot('look');
    await page.mouse.up();
    await page.waitForFunction(() => window.warwagon.look.yaw === 0 && !window.warwagon.look.active, null, { timeout: 15000 });

    // pause, settings, theme, resume
    await page.click('#pause');
    await page.waitForFunction(() => window.warwagon.mode === 'paused');
    await shot('pause');
    await page.click('#recenter');
    await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 30, gamma: 0 })));
    assert.ok((await page.evaluate(() => document.getElementById('recenter').textContent)).startsWith('Recentered'), 'recenter button confirms');
    await page.waitForFunction(() => document.getElementById('recenter').textContent === 'Recenter controls', null, { timeout: 5000 });
    await page.click('#settings-open');
    await page.click('#theme button[data-theme="dark"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('warwagon.theme')), 'dark');
    await shot('settings');
    assert.equal(await page.evaluate(() => document.getElementById('feedback').getAttribute('href')), `mailto:135crewdog.github@gmail.com?subject=War%20Wagon%20${version}%20feedback`, 'feedback opens an email with the version');
    await page.click('#credits-open');
    assert.equal(await page.evaluate(() => document.getElementById('screen-credits').hidden), false, 'credits screen shows');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#screen-credits .credits h3').length), 5, 'five credits');
    await shot('credits');
    await page.click('#credits-back');
    await page.click('#settings-done');
    await page.click('#resume');
    await page.waitForFunction(() => window.warwagon.mode === 'flying');

    // portrait: the rotate screen wins over every other screen and nothing flies
    await page.click('#pause');
    await page.waitForFunction(() => window.warwagon.mode === 'paused');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.getElementById('screen-rotate').hidden && document.getElementById('screen-pause').hidden, null, { timeout: 60000 });
    await page.evaluate(() => document.getElementById('resume').click());
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.warwagon.mode), 'paused', 'still paused in portrait');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => !document.getElementById('screen-pause').hidden);
    await page.click('#resume');
    await page.waitForFunction(() => window.warwagon.mode === 'flying');

    // Fly again returns to the start screen, at the air start
    await page.click('#pause');
    await page.waitForFunction(() => window.warwagon.mode === 'paused');
    await page.click('#fly-again');
    await page.waitForFunction(() => window.warwagon.mode === 'start');
    assert.equal(await page.evaluate(() => document.getElementById('controls').hidden), true, 'the controls are hidden on the start screen');
    assert.ok(Math.abs((await page.evaluate(() => window.warwagon.sim.airdata.altitude)) - 10000) < 1, 'back at the air start, 10,000 ft');

    // the service worker registers and caches under a warwagon- prefix
    const caches = await page.evaluate(async () => { await navigator.serviceWorker.ready; return (await window.caches.keys()); });
    assert.ok(caches.some((k) => k.startsWith('warwagon-')), `caches: ${caches}`);
    assert.ok(caches.every((k) => k.startsWith('warwagon-')), 'only warwagon- caches touched');

    // the HUD canvas has pixels
    const hudPixels = await page.evaluate(() => {
      const c = document.getElementById('hud'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n;
    });
    assert.ok(hudPixels > 50, `HUD drawn: ${hudPixels}`);

    assert.deepEqual(errors, []);
    console.log('browser smoke test passed');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
