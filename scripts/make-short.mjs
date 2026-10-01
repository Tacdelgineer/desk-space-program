// Makes a 9:16 YouTube Short from a guided tour or an episode's tour, end to end:
//   1. a 1-second animated hook card in the screenprint style (the tour's short.hook, one word in yellow)
//   2. the tour filmed at 1080x1920, 30 fps (scripts/film.mjs, the clean short layout), with punch-in zooms on the
//      key step (short.key) and big burned-in captions, one per step, from the tour's own captions
//   3. the Mission Report as the end card (the tour's report step: every number from labs/data, tagged)
//   4. music from assets/music/ at about -18 dB if there is a file there; silent otherwise
//
//   node scripts/make-short.mjs <tour id | episode number> [--no-film] [--music <file>]
//   node scripts/make-short.mjs 1         -> shorts/ep1.mp4 (and shorts/ep1.json: the words, numbers and timings used)
//   node scripts/make-short.mjs life      -> shorts/life.mp4
//
// --no-film reuses out/film/<id>-short-1080x1920.mp4 when it is there. The tour needs a short block
// ({ hook, key, lesson, next }; numbers as {metric} placeholders, *word* marks the yellow word). shorts/ is gitignored.
// Needs `npm i --no-save playwright` once, and ffmpeg.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, film, launch, tourId } from './film.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1920, FPS = 30, HOOK_S = 1, END_S = 3.5, MUSIC_DB = -18;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
if (!argv[0] || argv[0].startsWith('--')) { console.error('usage: node scripts/make-short.mjs <tour id | episode number> [--no-film] [--music <file>]'); process.exit(2); }
const id = tourId(argv[0]);
const work = path.join(root, 'out', 'short', id), outDir = path.join(root, 'shorts');
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(outDir, { recursive: true });
const ff = (args, what) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status) throw new Error('ffmpeg failed: ' + what); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *word* marks the yellow word; without a mark, the first word with a digit in it
function marked(text) {
  const s = esc(text);
  if (/\*[^*]+\*/.test(s)) return s.replace(/\*([^*]+)\*/, '<em>$1</em>').replace(/\*/g, '');
  return s.replace(/(^|\s)([^\s]*\d[^\s]*)/, '$1<em>$2</em>');
}
const plain = s => String(s).replace(/\*/g, '');

/* ---------- 1. the footage ---------- */
build();
const { browser } = await launch();
const filmBase = path.join(root, 'out', 'film', `${id}-short-1080x1920`);
let meta;
if (argv.includes('--no-film') && fs.existsSync(filmBase + '.mp4') && fs.existsSync(filmBase + '.json')) meta = JSON.parse(fs.readFileSync(filmBase + '.json', 'utf8'));
else meta = (await film(browser, { id, size: [W, H], fps: FPS, short: true })).meta;
const O = meta.outline, sh = O.short || {};
if (!sh.hook || !sh.lesson || !sh.next) throw new Error(`the tour ${id} needs a short block with hook, key, lesson and next (labs/tours/${id}.json)`);
const report = O.steps.find(s => s.report);
if (!report) throw new Error(`the tour ${id} has no Mission Report step (report: true)`);
const footS = meta.frames / FPS;

/* ---------- pages drawn in the browser: the hook card's frames, the captions, the end card ---------- */
const { cachedRoute } = await import(pathToFileURL(path.join(root, 'labs', 'tools', 'shoot.mjs')).href);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await cachedRoute(ctx, true);
const page = await ctx.newPage();
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Narrow:wght@600;700&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">';
const BASE = `:root{--paper:#efe5cf;--paper2:#e2d4b4;--ink:#1b1712;--soft:#5a5144;--red:#df3a2c;--yellow:#f2c230;--teal:#1f8783}
*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;overflow:hidden}
.grain{position:absolute;inset:0;pointer-events:none}
.dots{position:absolute;width:420px;height:420px;background:radial-gradient(circle,var(--yellow) 30%,transparent 33%) 0 0/22px 22px;-webkit-mask:radial-gradient(circle at 50% 50%,#000 25%,transparent 68%)}`;
// a paper grain drawn with its own seeded numbers, the same on every frame
const GRAIN = `<canvas class="grain" width="${W / 2}" height="${H / 2}" style="width:${W}px;height:${H}px"></canvas><script>
(function(){const c=document.querySelector('.grain'),x=c.getContext('2d');let s=7;const r=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
for(let i=0;i<c.width*c.height/14;i++){x.fillStyle='rgba('+(r()<.5?'239,229,207':'0,0,0')+','+(r()*0.07).toFixed(3)+')';x.fillRect(r()*c.width,r()*c.height,1.5,1.5);}})();</script>`;
async function show(html, transparent) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}</style></head><body${transparent ? ' style="background:transparent"' : ''}>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

// the hook: three inks slide into register and the words stamp down, in one second
await show(`<style>
body{background:var(--ink)}
.dots{right:-120px;top:-110px;opacity:.9}
.hook{position:absolute;left:70px;right:70px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center}
.plate{position:absolute;left:0;right:0;font:400 150px/0.98 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.005em}
.plate em{font-style:normal}
.red{color:var(--red)}.yel{color:transparent}.yel em{color:var(--yellow)}
.main{color:var(--paper);-webkit-text-stroke:12px var(--ink);paint-order:stroke fill}.main em{color:var(--yellow)}
.stamp{position:absolute;left:70px;top:250px;font:500 34px "IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--red);border:4px solid var(--red);padding:8px 16px;text-transform:uppercase}
.brand{position:absolute;left:70px;bottom:330px;font:500 30px "IBM Plex Mono",monospace;letter-spacing:.08em;color:var(--yellow)}
.bar{position:absolute;left:70px;bottom:300px;height:10px;background:var(--red)}
</style>${GRAIN}<div class="dots"></div><span class="stamp">Mission 01: Liftoff</span>
<div class="hook"><div class="plate red">${marked(sh.hook)}</div><div class="plate yel">${marked(sh.hook)}</div><div class="plate main">${marked(sh.hook)}</div></div>
<div class="brand">DESK SPACE PROGRAM</div><div class="bar"></div>
<script>
const q=s=>document.querySelector(s), ease=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
window.at=t=>{
  const e=ease(t/0.42), s=ease((t-0.38)/0.22), b=ease((t-0.2)/0.5);
  q('.red').style.transform='translate('+((1-e)*-90+10)+'px,'+((1-e)*70+10)+'px)';
  q('.yel').style.transform='translate('+((1-e)*80)+'px,'+((1-e)*-60)+'px)';
  q('.main').style.transform='scale('+(1.22-0.22*e)+')'; q('.main').style.opacity=Math.min(1,t/0.1);
  q('.stamp').style.transform='rotate(-3deg) scale('+(1.9-0.9*s)+')'; q('.stamp').style.opacity=s;
  q('.dots').style.transform='translate('+((1-e)*160)+'px,'+((1-e)*-160)+'px)';
  q('.bar').style.width=(b*560)+'px'; q('.brand').style.opacity=b;
};
</script>`);
const hookFrames = path.join(work, 'hook'); fs.rmSync(hookFrames, { recursive: true, force: true }); fs.mkdirSync(hookFrames);
for (let f = 0; f < HOOK_S * FPS; f++) {
  await page.evaluate(t => window.at(t), (f + 1) / (HOOK_S * FPS));
  await page.screenshot({ path: path.join(hookFrames, String(f).padStart(3, '0') + '.png') });
}
ff(['-framerate', String(FPS), '-i', path.join(hookFrames, '%03d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', path.join(work, 'hook.mp4')], 'hook');

// the captions: one transparent picture per step, big, in the lower middle, clear of the Shorts buttons
const captions = [];
for (const s of O.steps) {
  const file = path.join(work, `caption-${s.i}.png`);
  await show(`<style>
.cap{position:absolute;left:56px;width:880px;top:1250px;height:280px;display:flex;align-items:center;justify-content:center;text-align:center;
font:400 86px/1.04 Anton,Impact,sans-serif;color:var(--paper);-webkit-text-stroke:14px var(--ink);paint-order:stroke fill;text-transform:none;letter-spacing:.005em}
.cap em{font-style:normal;color:var(--yellow)}
</style><div class="cap"><span>${marked(s.caption)}</span></div>`, true);
  await page.screenshot({ path: file, omitBackground: true });
  captions.push({ file, start: s.start, end: Math.min(s.end, footS), text: plain(s.caption) });
}

// the end card: the Mission Report, every number tagged as it is in the lab
const PROMPT = { q: 'QUESTION', doc: 'DOCUMENT', code: 'CODEBASE' };
const st = report.state, sub = `M01 LIFTOFF &nbsp; ${esc(String(report.model).toUpperCase())}, ${esc(st.bits)}-BIT, ${PROMPT[st.prompt] || ''}${st.crew > 1 ? ', CREW ' + st.crew : ''}`;
const tag = t => t ? `<i class="t ${t === 'measured' ? 'm' : t === 'reported' ? 'r' : 'e'}">${{ measured: 'meas.', reported: 'rep.', estimated: 'est.' }[t]}</i>` : '';
const rows = report.report.map(r => `<div class="row${r.done ? '' : ' no'}"><span class="n">${esc(r.name)}</span><b class="fit">${r.done ? 'YES' : 'NO'}</b>
  <span class="v">${r.done ? `<b>${esc(r.tps)}</b>${tag(r.tag)}` : '<b class="nob">NO</b>'}</span><span class="v">${r.done ? `<b>${esc(r.doneIn)}</b>${tag(r.doneTag)}` : `<small>needs ${esc(r.needGB)} GB</small>`}</span></div>`).join('');
await show(`<style>
body{background:var(--ink)}
.dots{left:-150px;bottom:180px;opacity:.55}
.card{position:absolute;left:56px;right:80px;top:150px;padding:44px 44px 40px;background:var(--paper);border:5px solid var(--ink);box-shadow:14px 14px 0 var(--red)}
.card .dots{left:auto;right:-60px;top:-60px;bottom:auto;width:300px;height:300px;opacity:.7}
h1{position:relative;font:400 118px/0.95 Anton,Impact,sans-serif;text-transform:uppercase;color:var(--ink)}
.rule{position:relative;height:10px;background:var(--red);margin:18px 0 18px}
.sub{position:relative;font:500 27px "IBM Plex Mono",monospace;letter-spacing:.03em;color:var(--ink)}
.head,.row{position:relative;display:grid;grid-template-columns:1.55fr .62fr 1.15fr 1.15fr;align-items:center;column-gap:16px}
.head{margin-top:34px;padding-bottom:10px;border-bottom:4px solid var(--ink);font:500 22px "IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--soft)}
.row{padding:14px 0;border-bottom:2px solid rgba(27,23,18,.25)}
.n{font:700 36px/1.05 "Archivo Narrow",sans-serif;color:var(--ink)}
.fit{font:400 48px Anton,Impact,sans-serif;color:var(--ink)}.row.no .fit,.nob{color:var(--red)}
.v{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.v b{font:400 58px/1 Anton,Impact,sans-serif;color:var(--ink)}.v small{font:500 22px "IBM Plex Mono",monospace;color:var(--red)}
.t{font:500 19px "IBM Plex Mono",monospace;font-style:normal;padding:1px 7px;border:2.5px solid var(--ink)}
.t.m{background:var(--teal);border-color:var(--teal);color:var(--paper)}.t.r{background:var(--yellow);border-color:var(--yellow);color:var(--ink)}.t.e{color:var(--soft);border-color:var(--soft)}
.lesson{position:relative;margin-top:32px;font:400 54px/1.08 Anton,Impact,sans-serif;color:var(--ink)}
.next{position:absolute;left:56px;right:80px;top:1340px;padding:26px 36px;background:var(--ink);border:5px solid var(--paper);box-shadow:12px 12px 0 var(--red)}
.next b{display:block;font:400 56px/1.05 Anton,Impact,sans-serif;color:var(--paper)}
.next span{display:block;margin-top:12px;font:500 26px "IBM Plex Mono",monospace;letter-spacing:.08em;color:var(--yellow)}
</style>${GRAIN}<div class="dots"></div>
<div class="card"><div class="dots"></div><h1>Mission Report</h1><div class="rule"></div><div class="sub">${sub}</div>
<div class="head"><span>MACHINE</span><span>FITS?</span><span>TOKENS/S</span><span>DONE IN</span></div>${rows}
<div class="lesson">${esc(plain(sh.lesson))}</div></div>
<div class="next"><b>${esc(plain(sh.next))}</b><span>DESK SPACE PROGRAM</span></div>`);
const endPng = path.join(work, 'end.png');
await page.screenshot({ path: endPng });
await ctx.close();
await browser.close();

/* ---------- 2. cut it together ---------- */
// punch-ins on the key step: a cut in to 1.15x, then to 1.3x, centred on the machine, back out at the step's end
const key = O.steps[sh.key != null ? sh.key : 1] || O.steps[0];
const keyMeta = meta.steps.find(s => s.i === key.i) || meta.steps[0], area = keyMeta.area;
const cx = (area.left + area.right) / 2, cy = (area.top + area.bottom) / 2;
const a = key.start, b = Math.min(key.end, footS), mid = a + (b - a) * 0.45;
// the trip map and the step card stay put: the band from the top of the frame to the card's bottom edge is laid back
// on top unzoomed, and each crop starts low enough that the zoomed band lands under it
const even = v => Math.max(0, Math.round(v / 2) * 2);
const band = keyMeta.card ? even(Math.min(H * 0.45, keyMeta.card.bottom + 8)) : 0;
const punch = [[1.15, a, mid], [1.3, mid, b]].map(([z, t0, t1]) => {
  const w = even(W / z), h = even(H / z);
  const x = Math.max(0, Math.min(W - w, Math.round(cx - w / 2))), y = Math.max(0, Math.min(H - h, Math.ceil(Math.max(cy - h / 2, band * (1 - 1 / z)))));
  return { z, t0, t1, crop: `crop=${w}:${h}:${x}:${y},scale=${W}:${H}:flags=lanczos,setsar=1` };
});

const musicDir = path.join(root, 'assets', 'music');
const music = opt('--music') || (fs.existsSync(musicDir) ? fs.readdirSync(musicDir).filter(f => /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(f)).sort().map(f => path.join(musicDir, f))[0] : null);
const total = HOOK_S + footS + END_S;
const inputs = ['-i', path.join(work, 'hook.mp4'), '-i', filmBase + '.mp4', '-loop', '1', '-framerate', String(FPS), '-t', String(END_S), '-i', endPng];
captions.forEach(c => inputs.push('-i', c.file));
const audioIn = 3 + captions.length;
if (music) inputs.push('-stream_loop', '-1', '-i', music); else inputs.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=48000:cl=stereo');
const keep = band ? [{ x: 0, y: 0, w: W, h: band }] : [];
const g = [];
g.push(`[1:v]setsar=1,split=${3 + keep.length}[base][p0][p1]${keep.map((k, i) => `[k${i}]`).join('')}`);
punch.forEach((p, i) => g.push(`[p${i}]${p.crop}[z${i}]`));
g.push(`[base][z0]overlay=0:0:enable='between(t,${p3(punch[0].t0)},${p3(punch[0].t1)})'[m0]`);
g.push(`[m0][z1]overlay=0:0:enable='between(t,${p3(punch[1].t0)},${p3(punch[1].t1)})'[m1]`);
let last = 'm1';
keep.forEach((k, i) => { g.push(`[k${i}]crop=${k.w}:${k.h}:${k.x}:${k.y}[kc${i}]`); g.push(`[${last}][kc${i}]overlay=${k.x}:${k.y}:enable='between(t,${p3(a)},${p3(b)})'[kk${i}]`); last = `kk${i}`; });
captions.forEach((c, i) => { g.push(`[${last}][${3 + i}:v]overlay=0:0:enable='between(t,${p3(c.start)},${p3(c.end - 0.001)})'[c${i}]`); last = `c${i}`; });
g.push(`[${last}]fps=${FPS},format=yuv420p[foot]`);
g.push(`[0:v]setsar=1,fps=${FPS},format=yuv420p[hook]`);
g.push(`[2:v]setsar=1,fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.25[end]`);
g.push(`[hook][foot][end]concat=n=3:v=1:a=0[v]`);
g.push(music ? `[${audioIn}:a]atrim=0:${p3(total)},asetpts=PTS-STARTPTS,volume=${MUSIC_DB}dB,afade=t=in:st=0:d=0.3,afade=t=out:st=${p3(total - 1.2)}:d=1.2[a]` : `[${audioIn}:a]anull[a]`);
const out = path.join(outDir, `${id}.mp4`);
ff([...inputs, '-filter_complex', g.join(';'), '-map', '[v]', '-map', '[a]', '-t', p3(total), '-r', String(FPS),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out], 'the cut');
function p3(v) { return (+v).toFixed(3); }

// what went into it, for review and for the description
const card = {
  id, video: path.relative(root, out), durationS: +total.toFixed(2), hook: plain(sh.hook), music: music ? path.basename(music) + ` at ${MUSIC_DB} dB` : 'none (silent)',
  punchIns: punch.map(p => ({ zoom: p.z, from: +(HOOK_S + p.t0).toFixed(2), to: +(HOOK_S + p.t1).toFixed(2) })),
  captions: captions.map(c => ({ from: +(HOOK_S + c.start).toFixed(2), to: +(HOOK_S + c.end).toFixed(2), text: c.text })),
  missionReport: { subtitle: sub.replace(/&nbsp;/g, ' '), rows: report.report.map(r => ({ machine: r.name, fits: r.done, tokensPerS: r.tps, tpsTag: r.tag, doneIn: r.doneIn, doneTag: r.doneTag, needGB: r.done ? undefined : r.needGB })), lesson: plain(sh.lesson), next: plain(sh.next) }
};
fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(card, null, 2));
console.log(`wrote ${card.video}: ${card.durationS} s, hook "${card.hook}", music: ${card.music}`);
