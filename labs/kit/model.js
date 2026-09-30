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
  // A table (Gemma's per-layer embeddings, Flash-Next's n-gram table) takes memory but is barely read per token.
  // Prompt memory: kvMB per prompt token plus stateMB per request (sliding windows, linear-attention state).
  // A run (data/measured/<machine>.json or data/reported/<machine>.json: same model, compression and prompt, one
  // request) replaces the estimated speeds, and the weights' size if it has one; everything else stays estimated.
  // p.measured is the run, p.source says where the writing speed comes from ('measured', 'reported' or 'estimated'),
  // p.readSource the same for reading (a reported run may have no reading speed).
  // Without a run for exactly this setup, the nearest run on the same machine, model and compression (one request, the
  // closest prompt length) still sets the scale: the estimated memory time per step is stretched so that it matches the
  // run at the run's prompt length, and reading uses the run's reading speed (p.scaledFrom, still estimated). That is
  // how a crew, or another prompt, is estimated from one measured or reported request.
  // A discrete GPU (m.tableOnHost) leaves a model's lookup table in the PC's own memory, as llama.cpp does, so only the
  // rest has to fit on the card: p.weightsGB is what sits in the machine's memory, p.hostTableGB what stays outside.
  function calc(m, model, prec, prompt, crew) {
    const n = crew || 1;
    const run = measuredRun(m, model, prec, prompt, n), base = run || nearestRun(m, model, prec, prompt);
    const has = k => !!base && base[k] != null;
    const tableGB = has('tableGB') ? base.tableGB : (model.table || 0) * prec.bpp;
    const weightsGB = has('weightsGB') ? base.weightsGB : (model.total + (model.table || 0)) * prec.bpp;
    const hostGB = m.tableOnHost ? tableGB : 0, cardGB = weightsGB - hostGB;
    const stateMB = model.stateMB || 0, seen = t => model.attnBudget ? Math.min(model.attnBudget, t) : t;
    const kvGB = (model.kvMB * (prompt.tokens + ANSWER) + stateMB) / 1024;  // one request
    const kvTotal = n * kvGB;
    const needGB = cardGB + kvTotal, usable = m.memGB - m.reserveGB, fits = needGB <= usable;
    const activeGB = model.active * prec.bpp;
    const avgKvAt = tokens => (model.kvMB * seen(tokens + ANSWER / 2) + stateMB) / 1024;
    const eff = model.moe ? 0.5 : 0.7;
    const flops = 0.5 * m.tflops * 1e12;
    const memAt = (tokens, n) => ((model.moe ? Math.min(weightsGB - tableGB, activeGB * n) : activeGB) + n * avgKvAt(tokens)) / (eff * m.bw);
    const memEst = n => memAt(prompt.tokens, n);
    const stepMath = n => n * 2 * model.active * 1e9 / flops;
    const kMem = has('tgTps') ? Math.max(1 / base.tgTps - stepMath(1), 1e-6) / memAt(base.prompt, 1) : 1;
    const stepMem = n => memEst(n) * kMem;
    const tMem = stepMem(n), tMath = stepMath(n), step = run && run.tgTps ? 1 / run.tgTps : Math.max(tMem, tMath);
    const writeTps = 1 / step, totalTps = n / step;                       // per request, all requests
    const readTps = has('ppTps') ? base.ppTps : flops / (2 * model.active * 1e9);
    const readS = n * prompt.tokens / readTps, writeS = ANSWER / writeTps;
    const busyWrite = Math.min(1, tMath / step), busWrite = Math.min(1, tMem / step), gpuMax = tMath >= tMem;
    const chunk = 512, readBytes = model.moe ? Math.min(cardGB, activeGB * 8) : cardGB;
    const busRead = Math.min(1, (readBytes / m.bw) / (2 * model.active * 1e9 * chunk / flops));
    // where the crew dial runs out: the first crew size where the math takes longer than the memory, and the
    // biggest crew whose prompt memory still fits (0 if the model alone doesn't fit)
    let crewGpu = Infinity;
    for (let k = 1; k <= 4096; k++) if (stepMath(k) >= stepMem(k)) { crewGpu = k; break; }
    const crewMem = Math.max(0, Math.floor((usable - cardGB) / kvGB));
    const source = run && run.tgTps ? run.source : 'estimated', readSource = run && run.ppTps != null ? run.source : 'estimated';
    return { crew: n, measured: run || null, source, readSource, scaledFrom: run ? null : base, weightsGB: cardGB, tableGB: tableGB - hostGB, hostTableGB: hostGB, kvGB, kvTotal, needGB, usable, fits, writeTps, totalTps, readTps, readS, writeS, totalS: readS + writeS, busyWrite, busWrite, gpuMax, busRead, crewGpu, crewMem };
  }

  // A model picked with the size handle: dense, sizeB billion parameters. Its prompt memory per token is
  // scaled from the presets (sizeHandle in data/models.json), so it is an estimate like the rest.
  function sizedModel(sizeB, handle) {
    const kvMB = handle.kvMBat8B * Math.pow(sizeB / 8, handle.kvExponent);
    const b = sizeB < 10 ? Math.round(sizeB * 10) / 10 : Math.round(sizeB);
    return { id: 'size', short: b + 'B', name: 'A ' + b + 'B dense model', total: b, active: b, table: 0, kvMB, stateMB: 0, moe: false };
  }
  const fmtS = s => s < 60 ? (s < 10 ? s.toFixed(1) : s.toFixed(0)) + ' s' : Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
  const fmtT = v => v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const fmtGB = v => v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  const pct = f => f < 0.01 && f > 0 ? '<1%' : Math.round(f * 100) + '%';

  // The data files write every number as {value, source}. The code above wants plain numbers, so this
  // unwraps them and keeps where each one came from in .sources and .links (not enumerable, so they stay out of the way).
  function plain(rec) {
    const out = {}, sources = {}, links = {};
    Object.keys(rec).forEach(k => {
      const v = rec[k];
      if (v && typeof v === 'object' && 'value' in v) { out[k] = v.value; sources[k] = v.source; if (v.link) links[k] = v.link; }
      else out[k] = v;
    });
    Object.defineProperty(out, 'sources', { value: sources });
    Object.defineProperty(out, 'links', { value: links });
    return out;
  }

  // A model from data/models.json: plain numbers, plus its prompt memory worked out from arch (the model's config).
  //   kvMB    per prompt token: keys and values, 16-bit, on the layers that keep a growing cache (+ Flash-Next's indexer keys)
  //   stateMB per request, fixed: sliding-window layers at a full window, linear-attention state (32-bit) and conv buffer
  const MB = 1024 * 1024;
  function archModel(rec) {
    const out = plain(rec), a = rec.arch || {};
    out.table = out.table || 0;
    let perTok = 2 * (a.kvLayers || 0) * (a.kvHeads || 0) * (a.headDim || 0) * 2;
    if (a.indexerKeyDim) perTok += (a.kvLayers || 0) * a.indexerKeyDim * 2 / (a.indexerCompress || 1);
    let fixed = 2 * (a.windowLayers || 0) * (a.windowHeads || 0) * (a.windowHeadDim || 0) * 2 * (a.window || 0);
    if (a.linearLayers) {
      const conv = 2 * a.linearKeyHeads * a.linearKeyDim + a.linearValueHeads * a.linearValueDim;
      fixed += a.linearLayers * (a.linearValueHeads * a.linearKeyDim * a.linearValueDim + (a.convKernel - 1) * conv) * 4;
    }
    out.kvMB = perTok / MB; out.stateMB = fixed / MB; out.attnBudget = a.attnBudget || 0;
    out.sources.kvMB = out.sources.stateMB = a.source || 'config';
    return out;
  }

  // Runs, one file per machine: { machine, source, runs: [{ model, bits, prompt (tokens), ppTps, tgTps, weightsGB, tableGB, ... }] }.
  // source is 'measured' (data/measured/, run on the creator's machine, the default) or 'reported' (data/reported/,
  // published by someone else, each run with its link). A file replaces the one before it for the same machine only.
  let runFiles = {};
  function setRuns(...files) {
    files.forEach(f => {
      if (!f || !f.machine) return;
      (f.runs || []).forEach(r => { r.source = f.source || 'measured'; });
      runFiles[f.machine] = f;
    });
  }
  function measuredRun(m, model, prec, prompt, crew) {
    const f = runFiles[m.id];
    if (!f || crew !== 1 || !model) return null;
    return (f.runs || []).find(r => r.model === model.id && r.bits === prec.id && r.prompt === prompt.tokens) || null;
  }
  // the run on the same machine, model and compression whose prompt length is closest (by ratio) to this prompt
  function nearestRun(m, model, prec, prompt) {
    const f = runFiles[m.id];
    if (!f || !model) return null;
    let best = null, bestD = Infinity;
    (f.runs || []).forEach(r => {
      if (r.model !== model.id || r.bits !== prec.id) return;
      const d = Math.abs(Math.log(r.prompt / prompt.tokens));
      if (d < bestD) { best = r; bestD = d; }
    });
    return best;
  }
  const measuredFor = machineId => runFiles[machineId] || null;

  // Each JSON script element in a page (type application/json, with an id and a src) stands for one data file.
  // The built page has the JSON inline. A source page has only src, so it is fetched (serve labs/ over http).
  function loadData(ids) {
    return Promise.all(ids.map(id => {
      const el = document.getElementById(id), text = el.textContent.trim();
      if (text) return JSON.parse(text);
      return fetch(el.getAttribute('src')).then(r => { if (!r.ok) throw new Error(r.status + ' ' + el.getAttribute('src')); return r.json(); });
    }));
  }

  DSP.model = { ANSWER, pick, calc, sizedModel, fmtS, fmtT, fmtGB, pct, plain, archModel, setRuns, setMeasured: setRuns, measuredFor, loadData };
})(window.DSP = window.DSP || {});
