// /check: build the site, picture its key states at 1920x1080 and 1080x1920 on one contact sheet, and make sure
// nothing private went into dist/ (hostnames, IP addresses, ports, local paths, this machine's name, tokens).
//
//   node scripts/check.mjs             build, scan, screenshots, contact sheet
//   node scripts/check.mjs --no-shots  build and scan only (a machine without a browser)
//
// Exit code 1 on a leak, a page error or a picture that came out blank. It is also the git pre-push hook
// (.githooks/pre-push; enable it once per clone with `git config core.hooksPath .githooks`).
// The screenshots need `npm i --no-save playwright` once. Output: out/check/ (gitignored), contact-sheet.png in it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist'), out = path.join(root, 'out', 'check');
const argv = process.argv.slice(2), noShots = argv.includes('--no-shots');
const STEP_MS = 1000 / 30;
const problems = [];

/* ---------- 1. build ---------- */
execFileSync(process.execPath, [path.join(root, 'labs', 'build.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
console.log('built dist/');

/* ---------- 2. nothing private in dist/ ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const octet = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const RULES = [
  ['IP address', new RegExp(`(?<![\\w.])${octet}(?:\\.${octet}){3}(?![\\w.])`, 'g')],
  ['IPv6 address', /(?<![\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|fe80::[0-9a-f:]*|f[cd][0-9a-f]{2}:[0-9a-f]{1,4}:[0-9a-f:]+|::1)(?![\w:])/gi],
  ['loopback host', /\blocalhost\b|\[::1?\]/gi],
  ['URL with a port', /\b(?:https?|wss?|ftp):\/\/[^\s"'<>/?#]+:\d{2,5}/gi],
  ['host and port', /\b(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9-]+\.(?:local|lan|home|internal|ts\.net)):\d{2,5}\b/gi],
  ['port number', /\bports?\s*[:=#]?\s*\d{2,5}\b|--port[ =]\d{2,5}/gi],
  ['local path', /(?:^|[\s"'`(=,])(?:\/home\/|\/Users\/|\/root\/|\/mnt\/|\/media\/|\/tmp\/|\/var\/|\/etc\/|~\/[\w.-]|[A-Za-z]:\\)|file:\/\//gm],
  ['private network name', /\b[\w-]+\.(?:local|lan|internal|home\.arpa|ts\.net)\b|\btailnet\b/gi],
  ['token', /\b(?:ghp|gho|ghu|ghs|github_pat|xox[abprs]|sk-ant|hf)_[A-Za-z0-9_-]{16,}|\bsk-[A-Za-z0-9]{20,}/g],
  ['this machine', new RegExp(`\\b(?:${[os.hostname(), os.userInfo().username].filter(s => s && s.length > 2).map(esc).join('|')})\\b`, 'gi')]
];
function scan(dir) {
  const found = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (!/\.(html?|js|mjs|json|css|svg|txt|xml|md|webmanifest)$/i.test(e.name)) return;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => RULES.forEach(([what, re]) => {
      re.lastIndex = 0;
      for (let m; (m = re.exec(line));) {
        const a = Math.max(0, m.index - 40), b = Math.min(line.length, m.index + m[0].length + 40);
        found.push(`${path.relative(root, f)}:${i + 1}  ${what}: "${m[0].trim()}"  …${line.slice(a, b).replace(/\s+/g, ' ')}…`);
      }
    }));
  });
  walk(dir);
  return found;
}
const leaks = scan(dist);
if (leaks.length) { console.error(`\nPRIVATE DETAILS IN dist/ (${leaks.length}):\n  ` + leaks.join('\n  ')); process.exit(1); }
// every page carries the link preview
const pages = []; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.html')) pages.push(f); }); })(dist);
pages.forEach(f => { if (!/property="og:image"/.test(fs.readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)} has no og:image link preview`); });
console.log(`scanned dist/: no hostnames, IP addresses, ports, local paths or tokens (${pages.length} pages)`);
if (noShots) finish();

/* ---------- 3. the key states, wide and tall ---------- */
// run: what to do once the lab is up. Every lab page starts closed on the DGX Spark with Qwen3.8 27B, 4-bit, the question.
const MISSION = 'dist/01-liftoff/index.html';
const STATES = [
  { id: 'hub', title: 'Hub page', url: 'dist/index.html' },
  { id: 'closed', title: 'Mission 01: closed, interface on', url: MISSION, run: 'closed' },
  { id: 'writing', title: 'Open, writing the answer', url: MISSION, run: 'writing' },
  { id: 'record', title: 'Record mode, GPU close-up', url: MISSION + '?record=1&shot=3', run: 'writing' },
  { id: 'tour', title: 'Tour autoplay: The life of one answer, step 7', url: MISSION + '?tour=life&autoplay=1', run: 'tour', step: 6 },
  { id: 'tour-report', title: 'Tour autoplay: Mission Report', url: MISSION + '?tour=ep1&autoplay=1', run: 'tour', step: 3 },
  { id: 'showroom', title: 'Showroom: all five, one question, launched', url: MISSION + '?showroom=1', run: 'showroom' },
  { id: 'showroom-open', title: 'Showroom: the RTX 5090 picked and opened', url: MISSION + '?showroom=1&focus=rtx5090', run: 'showroom' },
  { id: 'room', title: 'The room on, writing (record mode)', url: MISSION + '?room=1&record=1', run: 'writing' }
];
const SIZES = [[1920, 1080], [1080, 1920]];

let chromium, shootLib;
try { ({ chromium } = await import('playwright')); shootLib = await import(pathToFileURL(path.join(root, 'labs', 'tools', 'shoot.mjs')).href); }
catch (e) { console.error('\nThe screenshots need Playwright: run `npm i --no-save playwright` at the repo root (or pass --no-shots).'); process.exit(1); }

async function launch() {
  try { return await chromium.launch({ channel: 'chromium', args: ['--use-angle=gles-egl', '--ignore-gpu-blocklist'] }); }
  catch (e) { return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); }
}

async function picture(browser, st, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
  await shootLib.cachedRoute(ctx, true);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  if (st.run) await page.addInitScript(shootLib.determinism, 20260929);
  await page.goto(pathToFileURL(path.join(root, st.url.split('?')[0])).href + (st.url.includes('?') ? '?' + st.url.split('?')[1] : ''), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  let gl = '';
  if (st.run) {
    await page.waitForFunction(() => window.__lab && window.__lab.sim.plan, null, { timeout: 30000, polling: 100 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(dt => __step(3, dt), STEP_MS);
    await page.waitForTimeout(900);                                   // the loading curtain fades in real time
    await page.evaluate(([run, step, dt]) => {
      const S = n => __step(n, dt);
      if (run === 'closed') S(60);
      else if (run === 'tour') { S(20); __lab.tour.go(step); S(48); }
      else if (run === 'showroom') { S(50); __lab.launch(); S(60); }
      else {
        __lab.launch();
        for (let i = 0; __lab.box.pending && i < 600; i++) S(1);    // a closed machine opens before it launches
        for (let i = 0; __lab.sim.phase !== 'writing' && i < 3000; i++) S(1);
        S(75);
      }
    }, [st.run, st.step || 0, STEP_MS]);
    gl = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  }
  const png = await page.screenshot();
  await ctx.close();
  return { png, errors, gl };
}

// one sheet: a row per state, the wide picture and the tall one side by side, labelled in the lab's inks
async function sheet(browser, rows) {
  const page = await browser.newPage();
  const res = await page.evaluate(async rows => {
    const load = async b64 => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const TH = 360, PAD = 24, LAB = 34, WW = Math.round(TH * 16 / 9), TW = Math.round(TH * 9 / 16);
    const W = PAD * 3 + WW + TW, H = PAD + rows.length * (LAB + TH + PAD) + 40;
    const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#1b1712'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#efe5cf'; x.font = '600 20px monospace'; x.fillText('DESK SPACE PROGRAM  /check  ' + new Date().toISOString().slice(0, 16).replace('T', ' '), PAD, 28);
    const blank = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], y = 40 + PAD + i * (LAB + TH + PAD);
      x.fillStyle = '#f2c230'; x.font = '600 18px monospace'; x.fillText(r.title, PAD, y + 20);
      for (const [k, dx, dw] of [['wide', PAD, WW], ['tall', PAD * 2 + WW, TW]]) {
        const im = await load(r[k]);
        x.drawImage(im, dx, y + LAB, dw, TH);
        x.strokeStyle = '#efe5cf'; x.lineWidth = 2; x.strokeRect(dx - 1, y + LAB - 1, dw + 2, TH + 2);
        // a picture that is one flat colour means the page didn't draw
        const d = x.getImageData(dx, y + LAB, dw, TH).data; let s = 0, s2 = 0; const n = d.length / 4;
        for (let j = 0; j < d.length; j += 4) { const v = (d[j] + d[j + 1] + d[j + 2]) / 3; s += v; s2 += v * v; }
        if (Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) < 4) blank.push(r.title + ' (' + k + ')');
      }
    }
    const blob = await c.convertToBlob({ type: 'image/png' }), buf = new Uint8Array(await blob.arrayBuffer());
    let str = ''; for (let i = 0; i < buf.length; i += 0x8000) str += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { png: btoa(str), blank };
  }, rows);
  await page.close();
  return res;
}

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const browser = await launch(), rows = [];
let renderer = '';
for (const st of STATES) {
  const row = { title: st.title };
  for (const size of SIZES) {
    const k = size[0] > size[1] ? 'wide' : 'tall', t0 = Date.now();
    const r = await picture(browser, st, size);
    fs.writeFileSync(path.join(out, `${st.id}-${size.join('x')}.png`), r.png);
    row[k] = r.png.toString('base64');
    if (r.gl) renderer = r.gl;
    r.errors.forEach(e => problems.push(`${st.id} ${size.join('x')}: ${e}`));
    console.log(`  ${st.id.padEnd(12)} ${size.join('x').padEnd(10)} ${((Date.now() - t0) / 1000).toFixed(1)} s${r.errors.length ? '  ' + r.errors.length + ' page error(s)' : ''}`);
  }
  rows.push(row);
}
const s = await sheet(browser, rows);
await browser.close();
fs.writeFileSync(path.join(out, 'contact-sheet.png'), Buffer.from(s.png, 'base64'));
s.blank.forEach(b => problems.push('blank picture: ' + b));
console.log(`contact sheet: ${path.relative(root, path.join(out, 'contact-sheet.png'))}  (renderer: ${renderer})`);
finish();

function finish() {
  if (problems.length) { console.error(`\nCHECK FAILED (${problems.length}):\n  ` + problems.join('\n  ')); process.exit(1); }
  console.log('check passed');
  process.exit(0);
}
