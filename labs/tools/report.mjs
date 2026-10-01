// Mission Report numbers for a preset, straight from labs/data/ through the lab's own speed model (kit/model.js).
//   node labs/tools/report.mjs "model=q27&bits=4&prompt=q&crew=1"
// Prints FITS?, TOKENS/S (writing, per answer; total too when crew > 1) and DONE IN for the five machines, in the
// report's column order, plus where the crew dial runs out. Every input is tagged with its source in the data files:
// a number from data/measured/ is marked (meas.), one from data/reported/ (someone else's published run) (rep.),
// everything else (est.).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const labs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(labs, 'kit', 'model.js'), 'utf8'), ctx);
const { calc, pick, plain, archModel, setRuns, setPrecisions, sizedModel, fmtS, fmtT, fmtGB, ANSWER } = ctx.window.DSP.model;
const data = f => JSON.parse(fs.readFileSync(path.join(labs, 'data', f), 'utf8'));
const mf = data('machines.json'), df = data('models.json');
const runFiles = ['measured', 'reported'].flatMap(dir => fs.readdirSync(path.join(labs, 'data', dir)).filter(f => f.endsWith('.json')).map(f => path.join(dir, f)));
setRuns(...runFiles.map(data));

const q = new URLSearchParams(process.argv[2] || '');
const models = df.models.map(archModel), precs = df.precisions.map(plain), prompts = df.prompts.map(plain);
setPrecisions(precs);
const handle = plain(df.sizeHandle);
const model = pick(models, q.get('model') || 'q27') || sizedModel(+q.get('model'), handle);
const prec = pick(precs, q.get('bits') || '4'), prompt = pick(prompts, q.get('prompt') || 'q'), crew = +(q.get('crew') || 1);
const order = ['spark', 'rtx5090', 'mac', 'strix', 'pro6000'];
const machines = order.map(id => plain(mf.machines.find(m => m.id === id)));

const short = { measured: 'meas.', reported: 'rep.', estimated: 'est.' };
// writing and reading each: from a run (meas. / rep.), scaled from a run on the same machine (est. from ...), or the formula (est.)
const tag = (src, from) => src !== 'estimated' ? short[src] : from ? `est. from ${short[from.source]}` : 'est.';
const tags = p => {
  const w = tag(p.source, p.scaledFrom), r = tag(p.readSource, p.readFrom);
  return { tps: ` (${w})`, done: w === r ? ` (${w})` : ` (${w} writing, ${r} reading)` };
};
console.log(`${model.name}, ${prec.short}, ${prompt.tokens} prompt tokens, crew ${crew}, ${ANSWER}-token answer`);
for (const m of machines) {
  const p = calc(m, model, prec, prompt, crew), t = tags(p);
  const tps = p.fits ? fmtT(p.writeTps) + (crew > 1 ? ` each, ${fmtT(p.totalTps)} total` : '') + t.tps : '-';
  console.log(`  ${m.name.padEnd(20)} FITS? ${p.fits ? 'YES' : 'NO '}  TOKENS/S ${tps.padEnd(28)} DONE IN ${p.fits ? fmtS(p.totalS) + t.done : '-'}` +
    `   (needs ${fmtGB(p.needGB)} of ${p.usable} GB${p.tableGB ? `, table ${fmtGB(p.tableGB)}` : ''}${p.hostTableGB ? `, table ${fmtGB(p.hostTableGB)} in the PC's memory` : ''}; read ${fmtS(p.readS)}, write ${fmtS(p.writeS)}; GPU maxes at crew ${isFinite(p.crewGpu) ? p.crewGpu : "never"}, memory full past ${p.crewMem})`);
}
const src = (rec, keys) => keys.map(k => `${k}=${rec.sources[k]}`).join(' ');
console.log('sources:');
machines.forEach(m => {
  const links = [...new Set(['memGB', 'reserveGB', 'bw', 'tflops'].map(k => m.links[k]).filter(Boolean))];
  console.log(`  data/machines.json ${m.id}: ${src(m, ['memGB', 'reserveGB', 'bw', 'tflops'])}${links.length ? '  ' + links.join(' ') : ''}`);
});
console.log(`  data/models.json ${model.id}: ${model.sources ? src(model, ['total', 'active', 'kvMB']) + ` (kvMB ${model.kvMB.toFixed(4)}/token, stateMB ${model.stateMB.toFixed(0)}/request)` : 'sized from sizeHandle (estimated)'}; ${prec.id}-bit bpp=${prec.sources.bpp}; prompt ${prompt.id} tokens=${prompt.sources.tokens}; answer length: kit/model.js ANSWER`);
machines.forEach(m => {
  const p = calc(m, model, prec, prompt, crew);
  const used = [...new Set([p.measured, p.scaledFrom, p.readFrom].filter(Boolean))];
  const file = runFiles.find(f => data(f).machine === m.id);
  used.forEach(r => {
    const roles = [p.measured === r && 'this setup', p.scaledFrom === r && 'scales the writing', p.readFrom === r && 'gives the reading'].filter(Boolean).join(', ');
    const nums = `${r.ppTps != null ? `reading ${r.ppTps} tok/s` : 'no reading speed'}, ${r.tgTps != null ? `writing ${r.tgTps} tok/s` : 'no writing speed'}`;
    if (r.source === 'measured') console.log(`  data/${file}: ${r.model} ${r.bits}-bit ${r.quant}, ${r.prompt}-token prompt (${roles}): ${nums}, weights ${r.weightsGB} GB (measured ${r.date})`);
    else console.log(`  data/${file}: ${r.model} ${r.bits}-bit ${r.quant}, used for the ${r.prompt}-token prompt (${roles}; ${r.point}): ${nums}; ${r.engine}; reported by ${r.by}, ${r.date}  ${r.link}`);
  });
});
