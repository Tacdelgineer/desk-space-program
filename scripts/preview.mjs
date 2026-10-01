// The link-preview image (1200 x 630) that every page names in its og:image and twitter:image tags:
// a render of the open DGX Spark writing an answer, beside the title in the screenprint inks.
//   node scripts/preview.mjs        -> labs/assets/preview.png (the build copies labs/assets/ to dist/assets/)
// Needs `npm i --no-save playwright` once. Renders on the GPU when it can (see labs/tools/shoot.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { cachedRoute, determinism } from '../labs/tools/shoot.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'labs', 'assets', 'preview.png');
const STEP_MS = 1000 / 30, RW = 760, H = 630;
execFileSync(process.execPath, [path.join(root, 'labs', 'build.mjs')], { stdio: 'ignore' });

let browser;
try { browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=gles-egl', '--ignore-gpu-blocklist'] }); }
catch (e) { browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); }

// 1. the machine: record mode (no interface), the overview, writing
const ctx = await browser.newContext({ viewport: { width: RW, height: H }, deviceScaleFactor: 2 });
await cachedRoute(ctx, true);
const lab = await ctx.newPage();
await lab.addInitScript(determinism, 20260929);
await lab.goto(pathToFileURL(path.join(root, 'dist', '01-liftoff', 'index.html')).href + '?record=1&shot=1');
await lab.waitForFunction(() => window.__lab && window.__lab.sim.plan, null, { timeout: 30000, polling: 100 });
await lab.evaluate(() => document.fonts.ready);
await lab.evaluate(dt => __step(3, dt), STEP_MS);
await lab.waitForTimeout(900);
await lab.evaluate(dt => {
  for (let i = 0; __lab.sim.phase !== 'writing' && i < 3000; i++) __step(1, dt);
  __step(140, dt);
}, STEP_MS);
const shot = (await lab.screenshot()).toString('base64');
await ctx.close();

// 2. the card: title on the left, the render on the right
const page = await browser.newPage({ viewport: { width: 1200, height: H }, deviceScaleFactor: 1 });
await cachedRoute(page.context(), true);
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Narrow:wght@600;700&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">
<style>
:root{--paper:#efe5cf;--ink:#1b1712;--red:#df3a2c;--yellow:#f2c230;--teal:#1f8783}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:${H}px;overflow:hidden;background:#07070b}
.shot{position:absolute;right:0;top:0;width:${RW}px;height:${H}px;background:url(data:image/png;base64,${shot}) center/cover}
.fade{position:absolute;left:${1200 - RW - 2}px;top:0;width:120px;height:${H}px;background:linear-gradient(90deg,#07070b,rgba(7,7,11,0))}
.left{position:absolute;left:0;top:0;width:${1200 - RW + 40}px;height:${H}px;padding:46px 0 0 48px}
.stamp{display:inline-block;font:500 15px "IBM Plex Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--red);border:2.5px solid var(--red);padding:4px 10px;transform:rotate(-2deg)}
h1{margin:26px 0 22px;font:400 74px/0.92 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.005em}
h1 span{display:block}.l1{color:var(--paper);text-shadow:4px 4px 0 var(--red)}.l2{color:var(--yellow);text-shadow:4px 4px 0 var(--red)}
.sticker{width:400px;padding:13px 16px 14px;background:var(--paper);color:var(--ink);border:2.5px solid var(--ink);box-shadow:5px 5px 0 var(--red);transform:rotate(-.6deg);font:600 21px/1.3 "Archivo Narrow",sans-serif}
.foot{position:absolute;left:48px;bottom:34px;font:500 17px "IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--paper)}
.foot b{color:var(--yellow);font-weight:500}
.dots{position:absolute;right:-30px;top:-30px;width:170px;height:170px;background:radial-gradient(circle,var(--yellow) 32%,transparent 34%) 0 0/14px 14px;opacity:.85;-webkit-mask:radial-gradient(circle at 70% 30%,#000 30%,transparent 70%)}
</style></head><body>
<div class="shot"></div><div class="fade"></div><div class="dots"></div>
<div class="left"><span class="stamp">Mission 01: Liftoff</span>
<h1><span class="l1">Your GPU isn't slow.</span><span class="l2">It's starving.</span></h1>
<p class="sticker">Open up five AI machines and watch a model run inside. Every number is tagged measured, reported or estimated.</p></div>
<div class="foot"><b>DESK SPACE PROGRAM</b> · interactive missions</div>
</body></html>`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await page.screenshot({ path: outFile });
await browser.close();
console.log(`wrote ${path.relative(root, outFile)}  (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
