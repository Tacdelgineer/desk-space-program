/* =========================================================
   MISSION 01, LIFTOFF: the choices, the words, and the simulation that
   goes load -> reading -> writing -> done. Ties the kit together.
   Four machines (switcher), a model-size handle, a crew dial, and URL presets for filming:
     ?machine=spark|rtx5090|mac|strix &model=q27 (a preset id) or model=45 (billions, dense)
     &bits=4|8|16 &prompt=q|doc|code &crew=1..64 &shot=1..4 &speed=1|5 &record=1
   record=1 hides the interface and launches as soon as the model has loaded.
   Live mode (section 6) switches on when live/bridge.mjs serves the page: a chat box that runs a real model
   on the Spark, real memory, power and temperature, and the Benchmark button.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.machines || !DSP.machines.spark || !DSP.board) return; // the 3D engine didn't load; the fallback message is showing
  const E = DSP.engine, ui = DSP.ui, T = E.T;
  const { ANSWER, pick, calc, sizedModel, fmtS, fmtT, fmtGB, pct, plain, archModel } = DSP.model;
  const fmtB = b => b >= 1000 ? (b / 1000).toFixed(1) + 'T' : (b < 10 ? (Math.round(b * 10) / 10) : Math.round(b)) + 'B';

  DSP.model.loadData(['data-machines', 'data-models', 'data-measured', 'data-reported-strix']).then(([machinesFile, modelsFile, measuredFile, strixFile]) => {
    DSP.model.setRuns(measuredFile, strixFile);
    start(machinesFile, modelsFile);
  }).catch(err => {
    console.error(err);
    const f = document.getElementById('fallback');
    f.querySelector('p').textContent = 'The data files didn\'t load. Open the built page in dist/, or serve the labs folder over http.';
    f.hidden = false;
  });

  function start(machinesFile, modelsFile) {
    /* =========================================================
       1. CHOICES: specs come from data/*.json, the words are ours
       ========================================================= */
    const WORDS = {
      spark: { short: 'DGX Spark', the: 'the Spark', sticker: 'Inside a DGX Spark, the model lives in the memory chips. To write each token, the whole model crosses the memory bus to the GPU. The GPU does its math in a flash, then waits for the next delivery.' },
      rtx5090: { short: 'RTX 5090', the: 'the 5090', sticker: 'Inside an RTX 5090, the model lives in 16 memory chips ringed around the GPU. Count the lanes: its bus is twice as wide as the Spark\'s, so tokens arrive fast. But only 32 GB fits.' },
      mac: { short: 'Mac Studio', the: 'the Mac', sticker: 'Inside a Mac Studio M3 Ultra, the memory sits on the chip package itself, one short hop from the GPU cores. Count the lanes: four times as many as the Spark\'s.' },
      strix: { short: 'Strix Halo', the: 'the Strix Halo', sticker: 'Inside a Strix Halo mini PC (AMD Ryzen AI Max+ 395), the model sits in 8 memory packages around one big chip. Count the lanes: 8, like the Spark, so it writes about as fast. Its GPU has half the math, so it reads slower.' }
    };
    const MACHINES = machinesFile.machines.map(plain).map(m => Object.assign(m, { short: WORDS[m.id].short }));
    const MODELS = modelsFile.models.map(archModel);
    const PRECS = modelsFile.precisions.map(plain);
    const HANDLE = plain(modelsFile.sizeHandle);
    const PROMPTS = [
      { id: 'q', short: 'Question', name: 'a quick question', text: 'Why does my GPU feel slow?' },
      { id: 'doc', short: 'Document', name: 'a long document', text: '[a 30-page report] Summarize this and tell me why my GPU feels slow.' },
      { id: 'code', short: 'Codebase', name: 'a whole codebase', text: '[an entire codebase] Review this, then tell me why my GPU feels slow.' }
    ].map(pr => Object.assign(pr, { tokens: pick(modelsFile.prompts.map(plain), pr.id).tokens }));
    const SPEEDS = [{ id: '1', short: 'Real time', name: 'Real time', k: 1 }, { id: '5', short: '5x', name: '5x faster', k: 5 }];
    const CREW_MAX = 64;

    // URL presets (see the top of this file). Anything missing or unknown keeps the default.
    const q = new URLSearchParams(location.search);
    const alias = (v, map) => map[String(v || '').toLowerCase()];
    const start0 = {
      machine: alias(q.get('machine'), { spark: 'spark', dgx: 'spark', rtx5090: 'rtx5090', '5090': 'rtx5090', rtx: 'rtx5090', mac: 'mac', m3ultra: 'mac', studio: 'mac', strix: 'strix', strixhalo: 'strix', halo: 'strix', amd: 'strix', ryzen: 'strix', '395': 'strix' }) || 'spark',
      prec: alias(q.get('bits'), { 4: '4', 8: '8', 16: '16' }) || '4',
      prompt: alias(q.get('prompt'), { q: 'q', question: 'q', doc: 'doc', document: 'doc', code: 'code', codebase: 'code' }) || 'q',
      speed: alias(q.get('speed'), { 1: '1', 5: '5' }) || '1',
      crew: Math.max(1, Math.min(CREW_MAX, Math.round(+q.get('crew')) || 1)),
      model: 'q27', size: null
    };
    const qm = q.get('model');
    if (qm && pick(MODELS, qm)) start0.model = qm;
    else if (qm && isFinite(parseFloat(qm))) { start0.model = 'size'; start0.size = Math.max(HANDLE.minB, Math.min(HANDLE.maxB, parseFloat(qm))); }
    const record = q.get('record') === '1', startShot = /^[1-4]$/.test(q.get('shot') || '') ? q.get('shot') : null;

    // Changing the selection from code re-syncs the pills too
    const sel = new Proxy(start0, { set(o, k, v) { o[k] = v; ui.syncPills(o); return true; } });
    const curModel = () => sel.model === 'size' ? sizedModel(sel.size, HANDLE) : pick(MODELS, sel.model);

    const ANSWER_TEXT = 'Short answer: your GPU is waiting on memory, not on math. To write each token, the model reads all of its weights out of memory, every single time. A bigger model means more gigabytes to move per token, and the memory bus can only move so much per second. The GPU finishes its math in a sliver of that time, then sits idle until the next delivery arrives. That is why bandwidth, not compute, sets your writing speed. It is also why mixture-of-experts models feel fast: they read only a small slice of their weights for each token.';

    /* =========================================================
       2. THE MACHINES: built the first time they're shown
       ========================================================= */
    const stand = DSP.parts.stand('DESK SPACE PROGRAM   MISSION 01: LIFTOFF', DSP.machines[sel.machine].name);
    const built = {};
    const machineObj = id => { if (!built[id]) { built[id] = DSP.machines[id].build(); built[id].group.visible = false; } return built[id]; };
    let cur = null, CUR = null, swap = null;
    function activate(id) {
      cur = machineObj(id); CUR = pick(MACHINES, id);
      cur.group.visible = true;
      E.initLabels(cur.labels); E.setShots(cur.shots);
      E.glow.position.set(...cur.glowAt); E.heat.position.set(...cur.heatAt);
      stand.setName(DSP.machines[id].name);
      document.querySelector('.sticker').textContent = WORDS[id].sticker;
      ui.setRaceThis(id);
    }
    activate(sel.machine);

    // The old board sinks into the stand, the new one rises. The specs switch at once.
    const SINK = 16, DOWN = 0.55, UP = 0.75;
    function switchMachine(id) {
      if (id === CUR.id && !swap) return;
      sel.machine = id; CUR = pick(MACHINES, id); ui.setRaceThis(id); // the specs snap now, the board follows
      document.querySelector('.sticker').textContent = WORDS[id].sticker;
      if (E.reduceMotion) { cur.group.visible = false; activate(id); applySelection(); return; }
      swap = { from: cur, to: id, t: 0, flipped: false };
      E.showLabels(false);
      applySelection();
    }
    function stepSwap(dt) {
      swap.t += dt;
      if (!swap.flipped) {
        const k = Math.min(1, swap.t / DOWN);
        swap.from.group.position.y = -SINK * k * k;
        if (k >= 1) {
          swap.from.group.visible = false; swap.from.group.position.y = 0;
          activate(swap.to); cur.group.position.y = -SINK; swap.flipped = true; swap.t = 0;
        }
      } else {
        const k = Math.min(1, swap.t / UP), e = 1 - Math.pow(1 - k, 3);
        cur.group.position.y = -SINK * (1 - e);
        if (k >= 1) { cur.group.position.y = 0; swap = null; E.showLabels(true); }
      }
    }

    /* =========================================================
       3. SIMULATION
       ========================================================= */
    const sim = { raceDone: false, phase: 'loading', t: 0, load: 0, plan: null, others: [], tokens: 0, lastTok: 0, flash: 0, gpu: 0, bus: 0, fan: 0.5, activeSet: null };

    // keep: the size handle or crew dial moved; stay loaded instead of reloading from the SSD
    function applySelection(keep) {
      const model = curModel(), prec = pick(PRECS, sel.prec), prompt = pick(PROMPTS, sel.prompt);
      sim.plan = calc(CUR, model, prec, prompt, sel.crew);
      sim.others = MACHINES.map(m => ({ m, p: calc(m, model, prec, prompt, sel.crew) }));
      if (keep && sim.load >= 1) sim.phase = 'ready';
      else if (!keep) { sim.phase = 'loading'; sim.load = 0; }
      sim.t = 0; sim.tokens = 0; sim.lastTok = 0; sim.raceDone = false;
      cur.outP.clear(); cur.spillP.clear();
      const p = sim.plan, w = WORDS[CUR.id];
      let s = model.name + ' at ' + prec.id + '-bit takes <b' + (p.fits ? '' : ' class="over"') + '>' + fmtGB(p.weightsGB) + ' GB</b>, plus <b>' + fmtGB(p.kvTotal) + ' GB</b> of prompt memory for ' +
        (sel.crew > 1 ? sel.crew + ' requests, each with ' : '') + prompt.name + ' (' + prompt.tokens.toLocaleString('en-US') + ' tokens). ' + w.the[0].toUpperCase() + w.the.slice(1) + ' has <b>' + p.usable + ' GB</b> free.';
      if (model.moe) s += ' Mixture of experts: only ' + fmtB(model.active) + ' of its ' + fmtB(model.total) + ' parameters work on each token, so each token reads far less.';
      if (model.table) s += ' Plus a ' + fmtB(model.table) + '-parameter lookup table (the amber cells): it takes <b>' + fmtGB(p.tableGB) + ' GB</b>, but each token reads only a few rows of it.';
      if (p.measured && p.measured.weightsGB != null) s += ' The ' + fmtGB(p.weightsGB) + ' GB is the real ' + p.measured.quant + ' file.';
      document.getElementById('payload-line').innerHTML = s;
      syncSize(); syncCrew();
      setTerm('');
      ui.renderRace(sim); updateLaunchBtn();
      const nRuns = sim.others.filter(o => o.p.fits && o.p.measured).length;
      document.getElementById('race-tag').textContent = !nRuns ? 'All estimated' : nRuns === sim.others.length ? 'All from real runs' : 'Untagged: estimated';
      if (live.enabled) syncChatModel();
      document.getElementById('race-note').textContent = 'Who finishes first? Guess, then launch.';
    }
    function updateLaunchBtn() {
      const b = document.getElementById('launch');
      b.setAttribute('aria-disabled', sim.plan.fits ? 'false' : 'true');
      b.textContent = sim.phase === 'done' ? 'Launch again' : 'Launch';
    }
    function launch() {
      if (live.on) { if (liveRunning()) return; leaveLive(); }
      if (sim.phase === 'reading' || sim.phase === 'writing') return;
      const p = sim.plan, w = WORDS[CUR.id];
      if (!p.fits) {
        const why = p.weightsGB > p.usable ? 'Try 4-bit, a smaller model or another machine.' : 'Try a smaller crew or a shorter prompt.';
        ui.toast('This needs ' + fmtGB(p.needGB) + ' GB and ' + w.the + ' has ' + p.usable + ' GB free. ' + why); return;
      }
      if (sim.phase === 'loading') sim.load = 1;
      sim.phase = 'reading'; sim.t = 0; sim.tokens = 0; sim.lastTok = 0; sim.raceDone = false; cur.outP.clear();
      setTerm(''); document.getElementById('race-note').textContent = '';
    }

    const termEl = document.getElementById('term');
    let termShown = -1;
    function setTerm(answerPart) {
      if (live.on) { liveTermKey = null; return; } // live mode writes its own
      const prompt = pick(PROMPTS, sel.prompt);
      const k = answerPart.length;
      if (k === termShown && answerPart !== '') return;
      termShown = k;
      termEl.innerHTML = '';
      const qEl = document.createElement('div'); qEl.className = 'q'; qEl.textContent = '> ' + prompt.text; termEl.appendChild(qEl);
      const a = document.createElement('div'); a.textContent = answerPart;
      const c = document.createElement('span'); c.className = 'cursor'; a.appendChild(c); termEl.appendChild(a);
    }

    // The phases and the numbers, then the machine lights up to match (machines/*.js, kit/board.js)
    let launchedForRecord = false;
    function updateSim(dt, time) {
      if (swap) stepSwap(dt);
      if (live.on) return updateLive(dt, time);
      const p = sim.plan, speed = pick(SPEEDS, sel.speed).k, model = curModel();
      if (sim.phase === 'loading') { sim.load = Math.min(1, sim.load + dt / 1.6); if (sim.load >= 1) sim.phase = 'ready'; }
      if (record && !launchedForRecord && sim.phase === 'ready' && !swap) { launchedForRecord = true; launch(); }
      if (sim.phase === 'reading' || sim.phase === 'writing' || (sim.phase === 'done' && !sim.raceDone)) sim.t += dt * speed;
      if (sim.phase === 'done' && !sim.raceDone) {
        const end = Math.max(...sim.others.filter(o => o.p.fits).map(o => o.p.totalS));
        if (sim.t >= end) { sim.raceDone = true; finishNote(); ui.renderRace(sim); }
      }
      let gpuT = 0.02, busT = 0;
      if (sim.phase === 'reading') {
        gpuT = 1; busT = p.busRead;
        if (sim.t >= p.readS) { sim.phase = 'writing'; }
      }
      if (sim.phase === 'writing') {
        sim.tokens = Math.min(ANSWER, (sim.t - p.readS) * p.writeTps);
        const whole = Math.floor(sim.tokens);
        if (whole > sim.lastTok) { const n = whole - sim.lastTok; sim.lastTok = whole; tokenFx(n, model); }
        busT = p.busWrite; gpuT = p.busyWrite;
        if (sim.tokens >= ANSWER) { sim.phase = 'done'; updateLaunchBtn(); document.getElementById('race-note').textContent = WORDS[CUR.id].short + ' is done. The race keeps going until every machine finishes.'; }
      }
      settle(gpuT, busT, dt, time, model);
    }
    function settle(gpuT, busT, dt, time, model) {
      sim.gpu += (gpuT - sim.gpu) * Math.min(1, dt * 6);
      sim.bus += (busT - sim.bus) * Math.min(1, dt * 6);
      sim.flash *= Math.exp(-dt * 16);
      sim.fan += ((0.5 + sim.gpu * 3 + sim.bus * 0.8) - sim.fan) * Math.min(1, dt * 1.5);
      cur.animate(sim, model, dt, time);
    }
    // One or more tokens were written: the flash, the MoE experts that fire, a row of the table, packets out of the ports
    function tokenFx(n, model) {
      sim.flash = 1;
      if (model.moe) {
        const nw = Math.max(1, Math.round(weightCells() * Math.min(1, model.active * sel.crew / model.total)));
        sim.activeSet = new Set(); while (sim.activeSet.size < nw) sim.activeSet.add(Math.floor(Math.random() * weightCells()));
      }
      const tc = Math.ceil(sim.live ? sim.live.tableGB : sim.plan.tableGB || 0);
      sim.tableHit = tc ? Math.floor(Math.random() * tc) : -1;
      const o = cur.out, packets = Math.min(n, 2) * Math.min(3, Math.ceil(sel.crew / 8));
      for (let i = 0; i < packets; i++) {
        const a = o.from.clone().add(new T.Vector3((Math.random() - 0.5) * o.spread[0], 0, (Math.random() - 0.5) * o.spread[1]));
        cur.outP.spawn({ life: 0.9, path: t => E.qb(a, o.mid, o.to, t) });
      }
    }
    function weightCells() {
      const L = sim.live, w = L ? L.modelGB - L.tableGB : Math.min(sim.plan.usable, sim.plan.weightsGB) - (sim.plan.tableGB || 0);
      return Math.max(1, Math.ceil(w));
    }

    /* =========================================================
       4. INTERFACE
       ========================================================= */
    const onPick = key => {
      if (key === 'speed') return;
      if (live.on && !liveRunning()) leaveLive();
      if (key === 'machine') { switchMachine(sel.machine); return; }
      applySelection();
    };
    ui.pills('pick-machine', MACHINES, sel, 'machine', onPick);
    ui.pills('pick-model', MODELS, sel, 'model', onPick); ui.pills('pick-prec', PRECS, sel, 'prec', onPick);
    ui.pills('pick-prompt', PROMPTS, sel, 'prompt', onPick); ui.pills('pick-speed', SPEEDS, sel, 'speed', onPick);
    ui.buildRace(MACHINES);
    ui.setRaceThis(CUR.id);

    // model-size handle: log scale from minB to maxB; the presets are notches, dense ones snap
    const sizeEl = document.getElementById('size'), sizeRead = document.getElementById('size-read');
    const lnMin = Math.log(HANDLE.minB), lnMax = Math.log(HANDLE.maxB);
    const toV = b => Math.round((Math.log(b) - lnMin) / (lnMax - lnMin) * 1000), toB = v => Math.exp(lnMin + v / 1000 * (lnMax - lnMin));
    ui.ticks('size-ticks', MODELS.map(m => ({ at: toV(m.total) / 10, cls: m.moe ? 'moe' : '', title: m.name })));
    function syncSize() {
      const m = curModel();
      if (document.activeElement !== sizeEl) sizeEl.value = toV(m.total);
      sizeRead.textContent = fmtB(m.total) + (m.moe ? ' MoE' : '');
      sizeEl.setAttribute('aria-valuetext', m.name);
    }
    sizeEl.addEventListener('input', () => {
      if (live.on && !liveRunning()) leaveLive();
      const v = +sizeEl.value, snap = MODELS.find(m => !m.moe && Math.abs(toV(m.total) - v) <= 12);
      if (snap) sel.model = snap.id; else { sel.model = 'size'; sel.size = toB(v); }
      applySelection(true);
    });

    // crew dial: 1 to 64 requests at once, log scale, with marks where the GPU maxes out and memory runs out
    const crewEl = document.getElementById('crew'), crewRead = document.getElementById('crew-read'), crewNote = document.getElementById('crew-note');
    const cToV = n => Math.round(Math.log(n) / Math.log(CREW_MAX) * 1000), vToC = v => Math.max(1, Math.min(CREW_MAX, Math.round(Math.exp(v / 1000 * Math.log(CREW_MAX)))));
    function syncCrew() {
      const p = sim.plan;
      if (document.activeElement !== crewEl) crewEl.value = cToV(sel.crew);
      crewRead.textContent = sel.crew;
      const marks = [], words = [];
      if (p.crewGpu <= CREW_MAX) { marks.push({ at: cToV(p.crewGpu) / 10, cls: 'gpu', title: 'GPU maxes out' }); words.push('GPU maxes out at ' + p.crewGpu); }
      if (p.weightsGB > p.usable) words.push('the model alone doesn\'t fit');
      else if (p.crewMem < CREW_MAX) { marks.push({ at: cToV(Math.max(1, p.crewMem + 1)) / 10, cls: 'mem', title: 'memory full' }); words.push('memory full past ' + p.crewMem); }
      ui.ticks('crew-ticks', marks);
      crewNote.textContent = words.length ? words.join(', ') : 'no limit before ' + CREW_MAX;
      crewNote.className = 'dial-note' + ((p.gpuMax || !p.fits) ? ' hit' : '');
    }
    crewEl.addEventListener('input', () => { if (live.on && !liveRunning()) leaveLive(); sel.crew = vToC(+crewEl.value); applySelection(true); });

    function finishNote() {
      const fits = sim.others.filter(o => o.p.fits);
      if (!fits.length) return;
      const best = fits.reduce((a, b) => a.p.totalS < b.p.totalS ? a : b);
      let s = best.m.short + ' finishes first, in ' + fmtS(best.p.totalS) + '. ';
      for (const pr of PROMPTS) {
        if (pr.id === sel.prompt) continue;
        let alt = null;
        MACHINES.forEach(m => { const p = calc(m, curModel(), pick(PRECS, sel.prec), pr, sel.crew); if (p.fits && (!alt || p.totalS < alt.p.totalS)) alt = { m, p }; });
        if (alt && alt.m.id !== best.m.id) { s += 'Switch your prompt to ' + pr.name + ' and the winner changes.'; break; }
      }
      document.getElementById('race-note').textContent = s;
    }

    // Where the speeds on the big number come from, in words
    function runLine(p, w) {
      const r = p.measured;
      if (!r) return 'Estimated for the ' + w.short + '.';
      if (r.source === 'measured') return 'Measured on the ' + w.short + ' (' + r.quant + ', llama.cpp).';
      return 'Reported for the ' + w.short + ' by ' + r.by + ' (' + r.quant + ', llama.cpp)' + (p.readSource === 'estimated' ? '; reading estimated.' : '.');
    }
    function sourceWords(p) {
      if (p.source === p.readSource) return { measured: 'Measured.', reported: 'Reported by others.', estimated: 'Estimated.' }[p.source];
      return 'Writing ' + p.source + ', reading ' + p.readSource + '.';
    }

    const statusEl = document.getElementById('status'), bigTag = document.getElementById('bigtag');
    function updateUI() {
      if (live.on) return updateLiveUI();
      const p = sim.plan, w = WORDS[CUR.id], crew = sel.crew;
      let st = '', cls = '';
      if (swap) { st = 'Switching to the ' + w.short; }
      else if (!p.fits && sim.load >= 1) { st = 'Doesn\'t fit in memory'; cls = 'bad'; }
      else if (sim.phase === 'loading') { st = (CUR.id === 'rtx5090' ? 'Loading over PCIe ' : 'Loading from the SSD ') + Math.floor(sim.load * 100) + '%'; }
      else if (sim.phase === 'ready') { st = 'Ready for launch'; cls = 'go'; }
      else if (sim.phase === 'reading') { st = 'Reading ' + (crew > 1 ? crew + ' prompts' : 'your prompt') + ', T-minus ' + fmtS(Math.max(0, p.readS - sim.t)); cls = 'hot'; }
      else if (sim.phase === 'writing') { st = sim.tokens < 3 ? 'Liftoff: first token' : 'Writing, ' + Math.floor(sim.tokens) + ' of ' + ANSWER + ' tokens'; cls = 'go'; }
      else if (sim.phase === 'done') { st = 'Done in ' + fmtS(p.totalS); cls = 'go'; }
      if (statusEl.textContent !== st) statusEl.textContent = st;
      statusEl.className = 'status ' + cls;
      if (sim.phase === 'writing' || sim.phase === 'done') setTerm(ANSWER_TEXT.slice(0, Math.round(sim.tokens / ANSWER * ANSWER_TEXT.length)));
      const g = sim.phase === 'writing' ? p.busyWrite : sim.phase === 'reading' ? 1 : 0;
      const b = sim.phase === 'writing' ? p.busWrite : sim.phase === 'reading' ? p.busRead : 0;
      document.getElementById('m-gpu').style.width = (g * 100).toFixed(1) + '%'; document.getElementById('v-gpu').textContent = pct(g);
      document.getElementById('m-bus').style.width = (b * 100).toFixed(1) + '%'; document.getElementById('v-bus').textContent = pct(b);
      const bn = document.getElementById('bignum'), bu = document.getElementById('bigunit'), sl = document.getElementById('speedline');
      let n = '-', u = 'doesn\'t fit in memory', line = p.weightsGB > p.usable ? 'Pick a smaller model, 4-bit, or another machine.' : 'The prompts don\'t fit. Pick a smaller crew or a shorter prompt.';
      if (p.fits) {
        if (sim.phase === 'reading') { n = fmtT(p.readTps); u = 'tokens per second, reading ' + (crew > 1 ? crew + ' prompts' : 'your prompt'); line = 'The GPU is flat out. Reading takes ' + fmtS(p.readS) + '.'; }
        else if (crew > 1) { n = fmtT(p.totalTps); u = 'tokens per second, ' + crew + ' answers at once'; line = 'Each answer gets ' + fmtT(p.writeTps) + ' tokens per second.' + (p.gpuMax ? ' The GPU is maxed out.' : '') + (p.scaledFrom ? ' Estimated from one ' + p.scaledFrom.source + ' request on the ' + w.short + '.' : ' Estimated for the ' + w.short + '.'); }
        else { n = fmtT(p.writeTps); u = 'tokens per second, writing the answer'; line = sim.phase === 'done' ? 'Reading took ' + fmtS(p.readS) + ', writing took ' + fmtS(p.writeS) + '. ' + sourceWords(p) : runLine(p, w); }
      }
      if (bn.textContent !== n) bn.textContent = n;
      if (bu.textContent !== u) bu.textContent = u;
      const src = sim.phase === 'reading' ? p.readSource : p.source;        // the big number is the reading speed while reading
      const tag = p.fits && crew === 1 && src !== 'estimated' ? src : '';
      bigTag.hidden = !tag;
      if (tag && bigTag.textContent !== tag) { bigTag.textContent = tag; bigTag.classList.toggle('rep', tag === 'reported'); }
      if (sl.textContent !== line) sl.textContent = line;
      // labels
      const used = Math.min(p.needGB, p.usable);
      E.setLab('mem', p.fits ? cur.chips + ', ' + fmtGB(used) + ' of ' + p.usable + ' GB used' : 'Too small: needs ' + fmtGB(p.needGB) + ' GB', p.fits ? 'go' : 'bad');
      E.setLab('bus', cur.busBits.toLocaleString('en-US') + '-bit, ' + CUR.bw.toLocaleString('en-US') + ' GB/s, ' + pct(b) + ' busy', b > 0.9 ? 'go' : '');
      E.setLab('gpu', sim.phase === 'writing' ? (p.gpuMax ? 'maxed out: the math is the limit now' : 'math used ' + pct(p.busyWrite) + ', waiting on memory') : sim.phase === 'reading' ? 'full power, reading the prompt' : 'idle',
        sim.phase === 'reading' || (sim.phase === 'writing' && p.gpuMax) ? 'hot' : '');
      Object.keys(cur.notes).forEach(id => E.setLab(id, cur.notes[id], id === cur.loadingLabel && sim.phase === 'loading' ? 'go' : ''));
      ui.renderRace(sim, crew);
    }

    DSP.actions.launch = launch;
    DSP.actions.nextMachine = () => switchMachine(MACHINES[(MACHINES.indexOf(CUR) + 1) % MACHINES.length].id);
    document.getElementById('launch').addEventListener('click', launch);

    /* =========================================================
       6. LIVE MODE: on when live/bridge.mjs serves this page (it sets window.DSP_LIVE). A question typed into
          the Answer panel runs on the Spark through llama-server: the wait for the first token is the reading,
          every token that arrives is one pulse and one piece of typing, tokens per second is counted from the
          tokens, and the memory cells, power and temperature come from the machine. All of it tagged measured.
       ========================================================= */
    const live = { enabled: !!window.DSP_LIVE, on: false, stats: null, peakW: 0, run: null, models: [], loadedId: null };
    const GiB = 1e9 / 2 ** 30; // the bridge reports file sizes in GB; the cells count GiB like /proc/meminfo
    const liveRunning = () => !!(live.run && ['loading', 'reading', 'writing'].includes(live.run.phase));
    const chatEl = document.getElementById('chat'), chatModel = document.getElementById('chat-model'), chatInput = document.getElementById('chat-input');
    const benchBtn = document.getElementById('bench-btn'), benchNote = document.getElementById('bench-note');

    function enterLive() {
      if (live.on) return;
      live.on = true; document.body.classList.add('live-on');
      document.getElementById('l-gpu').textContent = 'GPU power draw';
      document.getElementById('l-bus').textContent = 'Memory in use';
      document.getElementById('meter-temp').hidden = false; document.getElementById('meters-cap').hidden = false;
      if (sim.phase === 'loading' || sim.load < 1) { sim.load = 1; sim.phase = 'ready'; }
    }
    function leaveLive() {
      if (!live.on) return;
      live.on = false; sim.live = null; document.body.classList.remove('live-on');
      document.getElementById('l-gpu').textContent = 'GPU math used';
      document.getElementById('l-bus').textContent = 'Memory bus busy';
      document.getElementById('meter-temp').hidden = true; document.getElementById('meters-cap').hidden = true;
      termShown = -1; applySelection(true);
    }
    function syncChatModel() {
      const m = live.models.find(x => x.id === sel.model && x.installed);
      if (m && !liveRunning()) chatModel.value = m.id;
    }
    function modelGiB(id) { const m = live.models.find(x => x.id === id); return m && m.weightsGB ? { w: m.weightsGB * GiB, t: (m.tableGB || 0) * GiB } : { w: 0, t: 0 }; }

    function updateLive(dt, time) {
      const r = live.run, s = live.stats, p = sim.plan, model = curModel();
      const loaded = live.loadedId && (!r || r.phase !== 'loading') ? modelGiB(live.loadedId) : r && r.phase === 'loading' ? modelGiB(r.model) : { w: 0, t: 0 };
      if (s) sim.live = { totalGB: s.totalGB, usedGB: s.usedGB, modelGB: loaded.w, tableGB: loaded.t };
      let gpuT = 0.02, busT = 0;
      if (sim.phase === 'loading' && r && s) sim.load = Math.max(0, Math.min(0.97, (s.usedGB - r.usedBefore) / Math.max(1, loaded.w - loaded.t)));
      if (sim.phase === 'reading') { gpuT = 1; busT = p.busRead; sim.t += dt; }
      if (sim.phase === 'writing' && r) {
        const since = (performance.now() - r.tLast) / 1000;
        sim.tokens = r.n + Math.min(0.95, since * (r.tps || 10));
        gpuT = p.busyWrite; busT = p.busWrite;
      }
      settle(gpuT, busT, dt, time, model);
    }

    let liveTermKey = '';
    function setTermLive(r) {
      const key = r ? r.prompt.length + ':' + r.text.length + ':' + r.thought.length : '';
      if (key === liveTermKey) return; liveTermKey = key;
      termEl.innerHTML = '';
      const qEl = document.createElement('div'); qEl.className = 'q'; qEl.textContent = '> ' + (r ? r.prompt : 'Ask the Spark something below. It runs for real.'); termEl.appendChild(qEl);
      const a = document.createElement('div');
      if (r && r.thought) { const th = document.createElement('span'); th.className = 'think'; th.textContent = r.thought + ' '; a.appendChild(th); }
      a.appendChild(document.createTextNode(r ? r.text : ''));
      const c = document.createElement('span'); c.className = 'cursor'; a.appendChild(c); termEl.appendChild(a);
    }
    function setText(id, v) { const el = document.getElementById(id); if (el.textContent !== v) el.textContent = v; }

    function updateLiveUI() {
      const r = live.run, s = live.stats, w = WORDS[CUR.id], M = curModel();
      const ph = r ? r.phase : 'idle', now = performance.now();
      let st = 'Live: ask the Spark', cls = 'go';
      if (swap) { st = 'Switching to the ' + w.short; cls = ''; }
      else if (ph === 'loading') { st = 'Loading ' + M.short + ' from the SSD'; cls = ''; }
      else if (ph === 'reading') { st = 'Reading your prompt, ' + fmtS((now - r.t0) / 1000); cls = 'hot'; }
      else if (ph === 'writing') { st = 'Writing, ' + r.n + ' tokens'; }
      else if (ph === 'done' && r.final) { st = 'Done in ' + fmtS(r.final.wallS); }
      else if (ph === 'error') { st = 'Stopped'; cls = 'bad'; }
      if (statusEl.textContent !== st) statusEl.textContent = st;
      statusEl.className = 'status ' + cls;
      setTermLive(r);

      let n = '-', u = 'tokens per second: ask something below', line = 'Runs on this DGX Spark with llama.cpp, ' + (M.short || 'the model') + ' at 4-bit.', tag = false;
      if (ph === 'loading') { n = '-'; u = 'loading the model into memory'; line = fmtGB(modelGiB(r.model).w) + ' GiB to load. The cells fill as the memory in use grows.'; }
      else if (ph === 'reading') { n = fmtS((now - r.t0) / 1000); u = 'reading your prompt: the wait for the first token'; line = 'The GPU is flat out.'; tag = true; }
      else if (ph === 'writing') { n = r.tps ? fmtT(r.tps) : '-'; u = 'tokens per second, counted as they arrive'; line = 'First token after ' + fmtS(r.ttft) + '.'; tag = true; }
      else if (ph === 'done' && r.final) {
        const f = r.final; tag = true;
        n = fmtT(f.tgTps || r.tps || 0); u = 'tokens per second, writing (llama-server\'s count)';
        line = 'First token after ' + fmtS(f.ttftS) + ' (' + f.promptN + ' prompt tokens read at ' + fmtT(f.ppTps) + ' per second), then ' + f.genN + ' tokens in ' + fmtS(f.genMs / 1000) + '.';
      }
      setText('bignum', n); setText('bigunit', u); setText('speedline', line); bigTag.hidden = !tag;
      const lm = live.models.find(m => m.id === ((r && r.model) || sel.model));
      if (lm && lm.installed && s) {
        const hint = M.name + ', ' + lm.quant + ' file: <b>' + fmtGB(lm.weightsGB) + ' GB</b>' + (lm.tableGB ? ', of which <b>' + fmtGB(lm.tableGB) + ' GB</b> is the lookup table, kept in CPU memory and mapped from the SSD' : '') +
          '. Linux sees <b>' + fmtGB(s.totalGB) + ' GiB</b> of the 128; <b>' + Math.round(s.usedGB) + ' GiB</b> is in use right now, by ' + (live.loadedId ? 'this model and ' : '') + 'everything else running (measured).';
        const pl = document.getElementById('payload-line'); if (pl.innerHTML !== hint) pl.innerHTML = hint;
      }

      // the meters: power, memory, temperature, straight from the machine
      const W = s && s.powerW != null ? s.powerW : null, C = s && s.tempC != null ? s.tempC : null;
      live.peakW = Math.max(live.peakW, W || 0);
      const wScale = Math.max(100, live.peakW);
      document.getElementById('m-gpu').style.width = (W ? Math.min(100, W / wScale * 100) : 0).toFixed(1) + '%'; setText('v-gpu', W == null ? 'n/a' : Math.round(W) + ' W');
      document.getElementById('m-bus').style.width = (s ? s.usedGB / s.totalGB * 100 : 0).toFixed(1) + '%'; setText('v-bus', s ? Math.round(s.usedGB) + ' GB' : '-');
      document.getElementById('m-temp').style.width = (C ? Math.min(100, C) : 0).toFixed(1) + '%'; setText('v-temp', C == null ? 'n/a' : Math.round(C) + '°C');

      E.setLab('mem', s ? cur.chips + ', ' + fmtGB(s.usedGB) + ' of ' + fmtGB(s.totalGB) + ' GiB in use (measured)' : cur.chips, 'go');
      E.setLab('bus', cur.busBits.toLocaleString('en-US') + '-bit, ' + CUR.bw.toLocaleString('en-US') + ' GB/s', ph === 'writing' ? 'go' : '');
      E.setLab('gpu', ph === 'reading' ? 'full power, reading the prompt' : (W == null ? '' : 'drawing ' + Math.round(W) + ' W' + (ph === 'writing' ? ' while it writes' : '') + ' (measured)'), ph === 'reading' ? 'hot' : '');
      Object.keys(cur.notes).forEach(id => E.setLab(id, cur.notes[id], id === cur.loadingLabel && ph === 'loading' ? 'go' : ''));
      ui.renderRace(Object.assign({}, sim, { phase: 'ready', t: 0 }), sel.crew);
    }

    // One live request (chat) or the benchmark: POST, then read the server-sent events as they arrive.
    async function startLive(kind, modelId, prompt) {
      if (liveRunning() || (live.run && live.run.kind === 'bench' && live.run.phase !== 'done' && live.run.phase !== 'error')) return;
      if (sel.machine !== 'spark') switchMachine('spark');
      enterLive();
      if (modelId && pick(MODELS, modelId)) sel.model = modelId;
      sel.prec = '4'; sel.crew = 1; if (kind === 'chat') sel.prompt = 'q';
      applySelection(true);
      live.run = { kind, model: modelId, prompt: prompt || '', text: '', thought: '', phase: 'starting', n: 0, final: null };
      chatEl.querySelector('button').disabled = benchBtn.disabled = true;
      try {
        const res = await fetch(kind === 'chat' ? '/api/chat' : '/api/bench', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'chat' ? { model: modelId, prompt } : {}) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || res.status); }
        const reader = res.body.getReader(), dec = new TextDecoder(); let rest = '';
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          const parts = (rest + dec.decode(value, { stream: true })).split('\n\n'); rest = parts.pop();
          for (const part of parts) { const line = part.split('\n').find(l => l.startsWith('data:')); if (line) onLiveEvent(JSON.parse(line.slice(5))); }
        }
      } catch (e) { ui.toast('Live: ' + e.message); if (live.run) live.run.phase = 'error'; sim.phase = 'ready'; }
      finally {
        if (live.run && live.run.phase !== 'done') { if (live.run.phase !== 'error') live.run.phase = 'done'; }
        chatEl.querySelector('button').disabled = benchBtn.disabled = false;
        refreshState();
      }
    }
    function onLiveEvent(e) {
      const r = live.run; if (!r) return;
      const now = performance.now();
      switch (e.type) {
        case 'model':
          r.model = e.id; if (e.loaded) live.loadedId = e.id;
          if (sel.model !== e.id && pick(MODELS, e.id)) { sel.model = e.id; applySelection(true); }
          break;
        case 'loading': r.phase = 'loading'; live.loadedId = null; r.usedBefore = live.stats ? live.stats.usedGB : 0; sim.phase = 'loading'; sim.load = 0; break;
        case 'loaded': live.loadedId = e.id; r.loadS = e.loadS; sim.load = 1; sim.phase = 'ready'; break;
        case 'reading': Object.assign(r, { phase: 'reading', t0: now, n: 0, text: '', thought: '', final: null, tps: null }); sim.phase = 'reading'; sim.t = 0; sim.tokens = 0; cur.outP.clear(); break;
        case 'token':
          if (!r.n) { r.tFirst = now; r.ttft = (now - r.t0) / 1000; r.phase = 'writing'; sim.phase = 'writing'; }
          r.n++; if (e.thought) r.thought += e.text; else r.text += e.text;
          r.tLast = now; if (r.n > 1) r.tps = (r.n - 1) / ((r.tLast - r.tFirst) / 1000);
          if (live.on) tokenFx(1, curModel());
          break;
        case 'done': r.final = e; r.phase = 'done'; sim.phase = 'done'; sim.tokens = r.n; break;
        case 'error': ui.toast(e.message); r.phase = 'error'; sim.phase = 'ready'; break;
        case 'bench': onBench(e); break;
      }
    }
    function onBench(e) {
      const r = live.run;
      if (e.step === 'model') { benchNote.textContent = 'Model ' + e.i + ' of ' + e.of + ': ' + e.name + '.'; if (pick(MODELS, e.id)) { sel.model = e.id; applySelection(true); } }
      else if (e.step === 'run') { r.prompt = '[benchmark] ' + e.prompt.toLocaleString('en-US') + '-token prompt, ' + ANSWER + ' tokens out, run ' + e.rep + ' of ' + e.of; if (sel.prompt !== (e.prompt > 1000 ? 'doc' : 'q')) { sel.prompt = e.prompt > 1000 ? 'doc' : 'q'; applySelection(true); } }
      else if (e.step === 'result') { benchNote.textContent = e.run.name + ', ' + e.run.prompt.toLocaleString('en-US') + ' tokens: reads ' + fmtT(e.run.ppTps) + '/s, writes ' + fmtT(e.run.tgTps) + '/s.'; }
      else if (e.step === 'note') { benchNote.textContent = e.text; }
      else if (e.step === 'saved') {
        benchNote.textContent = 'Saved ' + e.runs + ' results to ' + e.file + '. The lab uses them now.' + (e.failed && e.failed.length ? ' Failed: ' + e.failed.map(f => f.model).join(', ') + '.' : '');
        fetch('/api/measured').then(x => x.json()).then(f => { DSP.model.setMeasured(f); realText(); applySelection(true); });
      }
    }

    // What's real: say exactly which numbers are measured
    function realText() {
      const f = DSP.model.measuredFor('spark'), runs = (f && f.runs) || [], li = document.getElementById('real-measured');
      if (!runs.length) { li.textContent = 'Nothing is measured yet: every speed here is an estimate.'; return; }
      const names = [...new Set(runs.map(r => r.name + ' (' + r.quant + ')'))];
      const clk = Math.max(...runs.map(r => r.gpuClockMaxMHz || 0));
      li.textContent = 'Measured speeds replace the estimates where they exist: the DGX Spark running ' + names.join(', ') + ' with llama.cpp\'s llama-server, ' +
        'the question (300 tokens) and document (8,000 tokens) prompts, 150 tokens out, one request, the middle of three runs (' + runs.map(r => r.date).sort().pop() + (clk ? ', GPU clock at most ' + clk.toLocaleString('en-US') + ' MHz' : '') + '). ' +
        'Reported speeds stand in for the Strix Halo: someone else\'s published llama.cpp runs on a Ryzen AI Max+ 395 with 128 GB (' + reportedNames('strix') + '; the sources are linked in data/reported/strix.json). ' +
        'Everything else is estimated: the RTX 5090 and the Mac Studio, 8- and 16-bit, the codebase prompt, crews of two or more, Qwen3.8-Max, and the GPU math used.';
    }
    function reportedNames(id) {
      const f = DSP.model.measuredFor(id), runs = (f && f.runs) || [];
      return [...new Set(runs.map(r => r.name + (r.ppTps == null ? ' (writing only)' : '')))].join(', ');
    }
    realText();

    async function refreshState() {
      try {
        const st = await (await fetch('/api/state')).json();
        live.models = st.models;
        const l = st.models.find(m => m.status === 'loaded'); live.loadedId = l ? l.id : null;
        const keep = chatModel.value; chatModel.innerHTML = '';
        st.models.forEach(m => {
          const o = document.createElement('option'); o.value = m.id; o.disabled = !m.installed;
          o.textContent = m.name + (m.installed ? ' (' + m.quant + ', ' + fmtGB(m.weightsGB) + ' GB' + (m.status === 'loaded' ? ', loaded' : '') + ')' : m.quant ? ' (not downloaded)' : ' (estimate only)');
          chatModel.appendChild(o);
        });
        const want = [keep, live.loadedId, sel.model, 'q27'].find(id => st.models.some(m => m.id === id && m.installed)) || (st.models.find(m => m.installed) || {}).id;
        if (want) chatModel.value = want;
        benchBtn.disabled = liveRunning() || !st.models.some(m => m.installed);
      } catch (e) { console.warn('live state', e); }
    }

    if (live.enabled) {
      document.body.classList.add('live');
      chatEl.hidden = false; document.getElementById('bench').hidden = false; document.getElementById('real-live').hidden = false;
      const es = new EventSource('/api/stats');
      es.onmessage = ev => {
        live.stats = JSON.parse(ev.data);
        const b = live.stats.busy === 'benchmark';
        if (b !== live.benchPause) { live.benchPause = b; E.pause(b); document.body.classList.toggle('bench-pause', b); if (b) ui.toast('Benchmark running: the lab stops drawing the machine so it doesn\'t take GPU time from the model.'); }
      };
      chatEl.addEventListener('submit', ev => {
        ev.preventDefault();
        const q = chatInput.value.trim(); if (!q || !chatModel.value) return;
        startLive('chat', chatModel.value, q);
      });
      chatModel.addEventListener('change', () => { if (!liveRunning() && pick(MODELS, chatModel.value)) { if (!live.on) enterLive(); sel.model = chatModel.value; applySelection(true); } });
      benchBtn.addEventListener('click', () => { if (confirm('Run the benchmark? It loads every downloaded model in turn and takes a few minutes. The chat box waits until it is done.')) startLive('bench'); });
      refreshState().then(() => { if (!record && !q.has('model')) { enterLive(); if (live.loadedId) { sel.model = live.loadedId; applySelection(true); } } });
      // typing in the chat box must not trigger the lab's keys (Space launches, M switches machines, ...)
      chatInput.addEventListener('keydown', ev => ev.stopPropagation());
    }

    /* =========================================================
       5. GO
       ========================================================= */
    if (record) document.body.classList.add('hide-ui');
    E.resize();
    E.camera.position.set(...E.SHOTS['1'].pos);
    applySelection();
    if (startShot) E.goShot(startShot, true);
    E.run(updateSim, updateUI);
    window.__lab = { launch, sim, sel, applySelection, switchMachine, busy: () => !!swap, goShot: E.goShot, live, startLive };
  }
})(window.DSP = window.DSP || {});
