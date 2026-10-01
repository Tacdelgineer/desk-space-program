// Films a guided tour (or an episode's tour) to video: headless Chrome on the GPU (full Chromium, ANGLE on OpenGL ES,
// the path that works on the DGX Spark), the page in render mode (?render=30: a fixed-step clock, so every frame is
// exactly 1/30 s of the tour whatever the machine's speed), one screenshot per frame piped into ffmpeg.
//
//   node scripts/film.mjs <tour id | episode number> [--size 1080x1920 | 1920x1080 | both] [--fps 30] [--short]
//   node scripts/film.mjs life            both sizes: out/film/life-1080x1920.mp4 and out/film/life-1920x1080.mp4
//   node scripts/film.mjs 1 --short       episode 1's tour (ep1) in the clean 9:16 layout that make-short.mjs cuts
//
// Beside each video a .json: the tour's outline (every step's words and numbers filled in and tagged, its start and
// end), the frame rate, and where the machine, the step card and the trip map sit on screen in each step (for the
// punch-ins).
// Needs `npm i --no-save playwright` once, and ffmpeg. Output goes to out/film/ (gitignored).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const tourId = arg => /^\d+$/.test(String(arg)) ? 'ep' + arg : String(arg);
export function build() { execFileSync(process.execPath, [path.join(root, 'labs', 'build.mjs')], { stdio: 'ignore' }); }

export async function launch() {
  const { chromium } = await import('playwright');
  try {
    const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=gles-egl', '--ignore-gpu-blocklist'] });
    return { browser: b, gpu: true };
  } catch (e) {
    console.warn('full Chromium is not installed: filming on the software renderer, which is slow (npx playwright install chromium)');
    return { browser: await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), gpu: false };
  }
}

// one video of one tour at one size; returns { mp4, json, meta }
export async function film(browser, { id, size, fps = 30, short = false, outDir = path.join(root, 'out', 'film'), log = console.log }) {
  const [W, H] = size, { cachedRoute } = await import(pathToFileURL(path.join(root, 'labs', 'tools', 'shoot.mjs')).href);
  fs.mkdirSync(outDir, { recursive: true });
  const name = `${id}${short ? '-short' : ''}-${W}x${H}`, mp4 = path.join(outDir, name + '.mp4'), json = path.join(outDir, name + '.json');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
  await cachedRoute(ctx, true);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, 'dist', '01-liftoff', 'index.html')).href + `?tour=${id}&autoplay=1&render=${fps}${short ? '&short=1' : ''}`);
  await page.waitForFunction(() => window.DSP && DSP.tour && DSP.tour.active() && window.__lab, null, { timeout: 30000, polling: 100 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);                                  // the plates and the console print again once the fonts are in
  const outline = await page.evaluate(() => DSP.tour.outline());
  if (outline.id !== id) throw new Error(`no tour "${id}" on the page (got ${outline.id}); tours live in labs/tours/ and need a <script id="tour-${id}"> tag`);
  const frames = Math.round(outline.autoplayS * fps);
  const gl = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  log(`filming ${name}: ${frames} frames (${outline.autoplayS.toFixed(1)} s at ${fps} fps) on ${gl}`);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg exited with ' + c)) : res()));
  const write = buf => new Promise(res => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });
  const steps = [], t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const st = await page.evaluate(() => {
      DSP.engine.renderFrames(1); const s = DSP.tour.state(); if (!s) return null;
      const r = q => { const e = document.querySelector(q), b = e && e.getClientRects().length ? e.getBoundingClientRect() : null; return b && { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
      return { i: s.i, area: DSP.tour.area(), card: r('.tour-card'), trip: r('.tour-trip') };
    });
    if (st && (!steps.length || steps[steps.length - 1].i !== st.i)) steps.push({ i: st.i, frame: f, t: f / fps, area: st.area, card: st.card, trip: st.trip });
    await write(await page.screenshot({ type: 'jpeg', quality: 93 }));
    if (f && f % 150 === 0) log(`  ${f}/${frames} frames, ${((Date.now() - t0) / f).toFixed(0)} ms a frame`);
  }
  ff.stdin.end(); await done;
  await ctx.close();
  if (errors.length) throw new Error('page errors while filming:\n  ' + errors.join('\n  '));
  const meta = { id, size: [W, H], fps, frames, durationS: frames / fps, short, renderer: gl, outline, steps };
  fs.writeFileSync(json, JSON.stringify(meta, null, 2));
  log(`  wrote ${path.relative(root, mp4)} (${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return { mp4, json, meta };
}

// the command line
const main = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (main) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  if (!argv[0] || argv[0].startsWith('--')) { console.error('usage: node scripts/film.mjs <tour id | episode number> [--size 1080x1920|1920x1080|both] [--fps 30] [--short]'); process.exit(2); }
  const id = tourId(argv[0]), fps = +opt('--fps', 30), which = opt('--size', 'both');
  const sizes = which === 'both' ? [[1080, 1920], [1920, 1080]] : [which.split('x').map(Number)];
  build();
  const { browser } = await launch();
  try { for (const size of sizes) await film(browser, { id, size, fps, short: argv.includes('--short') }); }
  finally { await browser.close(); }
}
