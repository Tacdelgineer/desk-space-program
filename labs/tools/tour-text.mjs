// A tour as plain text, every number filled in from labs/data and tagged, as the page would show it.
//   node labs/tools/tour-text.mjs ep4            (builds first; needs `npm i --no-save playwright` once)
//   node labs/tools/tour-text.mjs ep4 --json     (the outline make-short reads)
// Use it to proofread a new tour: a "(not measured)" or "—" means a metric has no number for that setup.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [id = 'life', flag] = process.argv.slice(2);
execFileSync(process.execPath, [path.join(root, 'labs', 'build.mjs')], { stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'dist', '01-liftoff', 'index.html')).href + `?tour=${id}&autoplay=1`);
await page.waitForFunction(() => window.DSP && DSP.tour && DSP.tour.active(), null, { timeout: 30000 });
const o = await page.evaluate(() => DSP.tour.outline());
await browser.close();
if (errors.length) { console.error('page errors:\n  ' + errors.join('\n  ')); process.exit(1); }
if (flag === '--json') { console.log(JSON.stringify(o, null, 2)); process.exit(0); }
const tag = c => `${c.text}${c.unit ? (c.unit === '%' || c.unit === '×' ? '' : ' ') + c.unit : ''} (${c.tag})`;
console.log(`${o.title}   [${o.id}, autoplay ${o.autoplayS.toFixed(1)} s]`);
o.steps.forEach(s => {
  console.log(`\n${s.i + 1}. ${s.act} · ${s.title}   [cam ${s.cam}, ${s.start.toFixed(1)}-${s.end.toFixed(1)} s]`);
  s.text.forEach(p => console.log('   ' + p));
  console.log('   ' + s.metaphor);
  console.log('   chips: ' + s.chips.map(c => `${c.label}: ${tag(c)}`).join(' | '));
  if (s.big) console.log('   big:   ' + `${s.big.label}: ${tag(s.big)}`);
  if (s.report) s.report.forEach(r => console.log(`   report ${r.name}: ${r.text}${r.tag ? ' (' + r.tag + ')' : ''}`));
  console.log('   caption: ' + s.caption);
});
if (Object.keys(o.short).length) console.log('\nshort: ' + JSON.stringify(o.short));
