// Deterministic screenshots of a lab page, and a pixel compare of two folders of them.
//
//   npm i --no-save playwright            (once, at the repo root; node_modules is gitignored)
//   node labs/tools/shoot.mjs <page.html>[?preset] <outDir> [shots=1,2,3]
//   node labs/tools/shoot.mjs --compare <dirA> <dirB> [diffDir]
//
// Every shot is 1920x1080, UI hidden (H), a few seconds into the writing phase. The page's defaults are
// Qwen3.8 27B at 4-bit on the DGX Spark; a preset query (?machine=mac&crew=16, see the mission's URL
// parameters) changes that. Math.random is seeded and time is virtual (requestAnimationFrame and
// performance.now are stepped by hand), so the same page renders the same pixels on every run, grain included.
//
// Options (environment):
//   SHOOT_GPU=1           render on the GPU (full Chromium, ANGLE on OpenGL ES): about 10x faster, but pixels
//                         differ slightly from the software baseline, so compare software against software.
//                         (ANGLE on Vulkan fails on the GB10's driver in the shadow pass; see HANDOFF.)
//   SHOOT_SIZE=1080x1920  another final size, e.g. a 9:16 Short
//   SHOOT_UI=1            keep the interface (panels, labels) in the picture
//   SHOOT_PHASE=reading   halfway through reading the prompt instead (use a long prompt: ?prompt=doc)
//   SHOOT_PHASE=midwrite  halfway through writing the answer (fast machines finish within the usual 3 s)
//   SHOOT_CASE=closed     the machine still closed (no launch); =opening: the lid halfway off; =open: open, not launched.
//                         Without it the page launches, which opens the machine first, then runs.
//   SHOOT_EVAL='js'       run this in the page just before the picture (e.g. __lab.deck.pose({ hover: 'fader' }))
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [W, H] = (process.env.SHOOT_SIZE || '1920x1080').split('x').map(Number), STEP_MS = 1000 / 30, WRITING_FRAMES = 90;
const KEEP_UI = !!process.env.SHOOT_UI, PHASE = process.env.SHOOT_PHASE || 'writing', CASE = process.env.SHOOT_CASE || '', EVAL = process.env.SHOOT_EVAL || '';
const CACHE = path.join(os.tmpdir(), 'dsp-shoot-cache');

export const LAUNCH = process.env.SHOOT_GPU
  ? { channel: 'chromium', args: ['--use-angle=gles-egl', '--ignore-gpu-blocklist'] }
  : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

// Runs before the page's own scripts.
export function determinism(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const native = Math.random.bind(Math);
  // three.js spends Math.random on object ids; keep those out of the seeded stream so the count of
  // objects can change without changing the textures and particles drawn from it.
  Math.random = () => ((new Error().stack || '').split('\n')[2] || '').includes('three.min.js') ? native() : next();
  let now = 0, queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = (n, dt) => { for (let i = 0; i < n; i++) { now += dt; const run = queue; queue = []; run.forEach(cb => cb(now)); } };
}

export async function cachedRoute(ctx, keepFonts) {
  fs.mkdirSync(CACHE, { recursive: true });
  // Board text is drawn on canvases before the web fonts arrive (HANDOFF gotcha 9), so whether it
  // uses the fallback or the real font is a race. Block the font files to make it always the fallback.
  // keepFonts: let them in (from the cache), for pictures a person looks at rather than compares.
  if (!keepFonts) await ctx.route(/^https:\/\/fonts\.gstatic\.com\//, route => route.abort());
  await ctx.route(keepFonts ? /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\// : /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com)\//, async route => {
    const url = route.request().url(), f = path.join(CACHE, createHash('sha1').update(url).digest('hex'));
    if (fs.existsSync(f + '.body')) {
      const meta = JSON.parse(fs.readFileSync(f + '.json', 'utf8'));
      return route.fulfill({ status: 200, headers: meta.headers, body: fs.readFileSync(f + '.body') });
    }
    const r = await route.fetch();
    const body = await r.body();
    if (r.status() === 200) { fs.writeFileSync(f + '.body', body); fs.writeFileSync(f + '.json', JSON.stringify({ headers: r.headers() })); }
    return route.fulfill({ response: r, body });
  });
}

async function shoot(pagePath, outDir, shots) {
  const [file, query] = pagePath.split('?');
  const url = /^https?:|^file:/.test(pagePath) ? pagePath : pathToFileURL(path.resolve(file)).href + (query ? '?' + query : '');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  for (const k of shots) {
    // Software rendering is slow, so the simulation is fast-forwarded in a small window and only the last frames are drawn at full size.
    const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
    await cachedRoute(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.addInitScript(determinism, 20260929);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lab && window.__lab.sim.plan, null, { timeout: 30000, polling: 100 });  // default polling uses rAF, which is stubbed
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(dt => __step(3, dt), STEP_MS);
    await page.waitForTimeout(1000);                       // the loading curtain fades in real time
    const hidden = await page.evaluate(() => document.body.classList.contains('hide-ui'));
    if (hidden === KEEP_UI) await page.keyboard.press('h');  // hide the interface (record=1 already has)
    await page.evaluate(([dt, n, phase, kase]) => {
      if (kase === 'closed') { __step(n, dt); return; }
      if (kase === 'opening') { __step(60, dt); __lab.openCase(true); for (let i = 0; __lab.box.k < 0.42 && i < 600; i++) __step(1, dt); return; }
      if (kase === 'open') { __lab.openCase(true); for (let i = 0; __lab.box.k < 1 && i < 600; i++) __step(1, dt); __step(n, dt); return; }
      __lab.launch();
      for (let i = 0; __lab.box.pending && i < 600; i++) __step(1, dt);   // a closed machine opens before it launches
      if (phase === 'reading') { for (let i = 0; __lab.sim.phase === 'reading' && __lab.sim.t < __lab.sim.plan.readS / 2 && i < 30000; i++) __step(1, dt); return; }
      if (phase === 'midwrite') { for (let i = 0; (__lab.sim.phase === 'reading' || __lab.sim.tokens < 75) && i < 30000; i++) __step(1, dt); return; }
      for (let i = 0; __lab.sim.phase !== 'writing' && i < 3000; i++) __step(1, dt);
      __step(n, dt);
    }, [STEP_MS, WRITING_FRAMES, PHASE, CASE]);
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(400);
    await page.evaluate(dt => __step(2, dt), STEP_MS);      // let resize() settle at full size
    await page.evaluate(([key, dt]) => { __lab.goShot(key, true); __step(3, dt); }, [k, STEP_MS]);
    if (EVAL) await page.evaluate(([code, dt]) => { (0, eval)(code); __step(12, dt); }, [EVAL, STEP_MS]);
    const info = await page.evaluate(() => ({ phase: __lab.sim.phase, tokens: Math.floor(__lab.sim.tokens), gl: (() => { const g = document.createElement('canvas').getContext('webgl2'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() }));
    const file = path.join(outDir, `shot-${k}.png`);
    await page.screenshot({ path: file });
    console.log(`shot ${k}: ${file}  (${info.phase}, ${info.tokens} tokens, ${info.gl})`);
    await ctx.close();
  }
  await browser.close();
}

// Compare shot-*.png in two folders. Reports how many pixels differ by more than 2/255 on any channel.
async function compare(a, b, diffDir) {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage();
  const files = fs.readdirSync(a).filter(f => /^shot-.*\.png$/.test(f)).sort();
  let bad = 0;
  for (const f of files) {
    if (!fs.existsSync(path.join(b, f))) { console.log(f, 'missing in', b); bad++; continue; }
    const r = await page.evaluate(async ([x, y]) => {
      const load = async d => { const i = await createImageBitmap(await (await fetch('data:image/png;base64,' + d)).blob()); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
      const A = await load(x), B = await load(y);
      if (A.width !== B.width || A.height !== B.height) return { size: false };
      const out = new ImageData(A.width, A.height); let n = 0, max = 0, sum = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
        sum += d; if (d > max) max = d; if (d > 2) n++;
        const v = Math.min(255, d * 8); out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255;
      }
      const c = new OffscreenCanvas(A.width, A.height); c.getContext('2d').putImageData(out, 0, 0);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; buf.forEach(v => { s += String.fromCharCode(v); });
      return { size: true, pixels: A.width * A.height, n, max, mean: sum / (A.width * A.height), diff: btoa(s) };
    }, [fs.readFileSync(path.join(a, f)).toString('base64'), fs.readFileSync(path.join(b, f)).toString('base64')]);
    if (!r.size) { console.log(f, 'different sizes'); bad++; continue; }
    console.log(`${f}: ${r.n} px differ by >2/255 (${(100 * r.n / r.pixels).toFixed(4)}%), max ${r.max}/255, mean ${r.mean.toFixed(4)}`);
    if (diffDir) { fs.mkdirSync(diffDir, { recursive: true }); fs.writeFileSync(path.join(diffDir, 'diff-' + f), Buffer.from(r.diff, 'base64')); }
    if (r.n > 0) bad++;
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
}

// run as a script (other tools import the helpers above)
const argv = process.argv.slice(2), main = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (!main) { /* imported */ }
else if (argv[0] === '--compare') await compare(argv[1], argv[2], argv[3]);
else if (argv.length >= 2) await shoot(argv[0], argv[1], (argv[2] || '1,2,3').split(','));
else { console.error('usage: shoot.mjs <page.html> <outDir> [1,2,3]   |   shoot.mjs --compare <dirA> <dirB> [diffDir]'); process.exit(2); }
