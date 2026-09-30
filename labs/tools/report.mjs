// Mission Report numbers for a preset, straight from labs/data/ through the lab's own speed model (kit/model.js).
//   node labs/tools/report.mjs "model=l70&bits=4&prompt=q&crew=1"
// Prints FITS?, TOKENS/S (writing, per answer; total too when crew > 1) and DONE IN for the three machines, in the
// report's column order, plus where the crew dial runs out. Every input is tagged with its source in the data files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const labs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(labs, 'kit', 'model.js'), 'utf8'), ctx);
const { calc, pick, plain, sizedModel, fmtS, fmtT, fmtGB, ANSWER } = ctx.window.DSP.model;
const data = f => JSON.parse(fs.readFileSync(path.join(labs, 'data', f), 'utf8'));
const mf = data('machines.json'), df = data('models.json');

const q = new URLSearchParams(process.argv[2] || '');
const models = df.models.map(plain), precs = df.precisions.map(plain), prompts = df.prompts.map(plain);
const handle = plain(df.sizeHandle);
const model = pick(models, q.get('model') || 'l70') || sizedModel(+q.get('model'), handle);
const prec = pick(precs, q.get('bits') || '4'), prompt = pick(prompts, q.get('prompt') || 'q'), crew = +(q.get('crew') || 1);
const order = ['spark', 'rtx5090', 'mac'];
const machines = order.map(id => plain(mf.machines.find(m => m.id === id)));

console.log(`${model.name}, ${prec.short}, ${prompt.tokens} prompt tokens, crew ${crew}, ${ANSWER}-token answer`);
for (const m of machines) {
  const p = calc(m, model, prec, prompt, crew);
  const tps = p.fits ? fmtT(p.writeTps) + (crew > 1 ? ` each, ${fmtT(p.totalTps)} total` : '') : '-';
  console.log(`  ${m.name.padEnd(20)} FITS? ${p.fits ? 'YES' : 'NO '}  TOKENS/S ${tps.padEnd(20)} DONE IN ${p.fits ? fmtS(p.totalS) : '-'}` +
    `   (needs ${fmtGB(p.needGB)} of ${p.usable} GB; read ${fmtS(p.readS)}, write ${fmtS(p.writeS)}; GPU maxes at crew ${isFinite(p.crewGpu) ? p.crewGpu : "never"}, memory full past ${p.crewMem})`);
}
const src = (rec, keys) => keys.map(k => `${k}=${rec.sources[k]}`).join(' ');
console.log('sources:');
machines.forEach(m => console.log(`  data/machines.json ${m.id}: ${src(m, ['memGB', 'reserveGB', 'bw', 'tflops'])}`));
console.log(`  data/models.json ${model.id}: ${model.sources ? src(model, ['total', 'active', 'kvMB']) : 'sized from sizeHandle (estimated)'}; ${prec.id}-bit bpp=${prec.sources.bpp}; prompt ${prompt.id} tokens=${prompt.sources.tokens}; answer length: kit/model.js ANSWER`);
