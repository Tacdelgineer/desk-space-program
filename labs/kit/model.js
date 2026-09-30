/* =========================================================
   MODEL: the speed model (HANDOFF "Speed model"), number formatting,
   and reading the data files. The math has no page and no three.js in it.
   ========================================================= */
(function (DSP) {
  'use strict';

  const ANSWER = 150;
  const pick = (list, id) => list.find(x => x.id === id);

  // crew: how many requests run at once (the crew dial). Per writing step every request gets one token:
  //   memory traffic = the weights (MoE: the experts the crew needs, at most all of them) + crew x prompt memory
  //   math           = crew x 2 x active parameters
  // A step takes whichever is slower, so each request stays nearly as fast until the math catches up.
  function calc(m, model, prec, prompt, crew) {
    const n = crew || 1;
    const weightsGB = model.total * prec.bpp;
    const kvGB = model.kvMB * (prompt.tokens + ANSWER) / 1024;            // one request
    const kvTotal = n * kvGB;
    const needGB = weightsGB + kvTotal, usable = m.memGB - m.reserveGB, fits = needGB <= usable;
    const activeGB = model.active * prec.bpp;
    const avgKv = model.kvMB * (prompt.tokens + ANSWER / 2) / 1024;
    const eff = model.moe ? 0.5 : 0.7;
    const flops = 0.5 * m.tflops * 1e12;
    const stepMem = n => ((model.moe ? Math.min(weightsGB, activeGB * n) : activeGB) + n * avgKv) / (eff * m.bw);
    const stepMath = n => n * 2 * model.active * 1e9 / flops;
    const tMem = stepMem(n), tMath = stepMath(n), step = Math.max(tMem, tMath);
    const writeTps = 1 / step, totalTps = n / step;                       // per request, all requests
    const readTps = flops / (2 * model.active * 1e9);
    const readS = n * prompt.tokens / readTps, writeS = ANSWER / writeTps;
    const busyWrite = Math.min(1, tMath / step), busWrite = tMem / step, gpuMax = tMath >= tMem;
    const chunk = 512, readBytes = model.moe ? Math.min(weightsGB, activeGB * 8) : weightsGB;
    const busRead = Math.min(1, (readBytes / m.bw) / (2 * model.active * 1e9 * chunk / flops));
    // where the crew dial runs out: the first crew size where the math takes longer than the memory, and the
    // biggest crew whose prompt memory still fits (0 if the model alone doesn't fit)
    let crewGpu = Infinity;
    for (let k = 1; k <= 4096; k++) if (stepMath(k) >= stepMem(k)) { crewGpu = k; break; }
    const crewMem = Math.max(0, Math.floor((usable - weightsGB) / kvGB));
    return { crew: n, weightsGB, kvGB, kvTotal, needGB, usable, fits, writeTps, totalTps, readTps, readS, writeS, totalS: readS + writeS, busyWrite, busWrite, gpuMax, busRead, crewGpu, crewMem };
  }

  // A model picked with the size handle: dense, sizeB billion parameters. Its prompt memory per token is
  // scaled from the presets (sizeHandle in data/models.json), so it is an estimate like the rest.
  function sizedModel(sizeB, handle) {
    const kvMB = handle.kvMBat8B * Math.pow(sizeB / 8, handle.kvExponent);
    const b = sizeB < 10 ? Math.round(sizeB * 10) / 10 : Math.round(sizeB);
    return { id: 'size', short: b + 'B', name: 'A ' + b + 'B dense model', total: b, active: b, kvMB, moe: false };
  }
  const fmtS = s => s < 60 ? (s < 10 ? s.toFixed(1) : s.toFixed(0)) + ' s' : Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
  const fmtT = v => v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const fmtGB = v => v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const pct = f => f < 0.01 && f > 0 ? '<1%' : Math.round(f * 100) + '%';

  // The data files write every number as {value, source}. The code above wants plain numbers, so this
  // unwraps them and keeps where each one came from in .sources (not enumerable, so it stays out of the way).
  function plain(rec) {
    const out = {}, sources = {};
    Object.keys(rec).forEach(k => {
      const v = rec[k];
      if (v && typeof v === 'object' && 'value' in v) { out[k] = v.value; sources[k] = v.source; }
      else out[k] = v;
    });
    Object.defineProperty(out, 'sources', { value: sources });
    return out;
  }

  // Each JSON script element in a page (type application/json, with an id and a src) stands for one data file.
  // The built page has the JSON inline. A source page has only src, so it is fetched (serve labs/ over http).
  function loadData(ids) {
    return Promise.all(ids.map(id => {
      const el = document.getElementById(id), text = el.textContent.trim();
      if (text) return JSON.parse(text);
      return fetch(el.getAttribute('src')).then(r => { if (!r.ok) throw new Error(r.status + ' ' + el.getAttribute('src')); return r.json(); });
    }));
  }

  DSP.model = { ANSWER, pick, calc, sizedModel, fmtS, fmtT, fmtGB, pct, plain, loadData };
})(window.DSP = window.DSP || {});
