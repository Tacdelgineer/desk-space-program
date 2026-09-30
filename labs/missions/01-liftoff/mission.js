/* =========================================================
   MISSION 01, LIFTOFF: the choices, the words, and the simulation that
   goes load -> reading -> writing -> done. Ties the kit together.
   Three machines (switcher), a model-size handle, a crew dial, and URL presets for filming:
     ?machine=spark|rtx5090|mac &model=l70 (a preset id) or model=45 (billions, dense)
     &bits=4|8|16 &prompt=q|doc|code &crew=1..64 &shot=1..4 &speed=1|5 &record=1
   record=1 hides the interface and launches as soon as the model has loaded.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.machines || !DSP.machines.spark || !DSP.board) return; // the 3D engine didn't load; the fallback message is showing
  const E = DSP.engine, ui = DSP.ui, T = E.T;
  const { ANSWER, pick, calc, sizedModel, fmtS, fmtT, fmtGB, pct, plain } = DSP.model;

  DSP.model.loadData(['data-machines', 'data-models']).then(([machinesFile, modelsFile]) => start(machinesFile, modelsFile)).catch(err => {
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
      mac: { short: 'Mac Studio', the: 'the Mac', sticker: 'Inside a Mac Studio M3 Ultra, the memory sits on the chip package itself, one short hop from the GPU cores. Count the lanes: four times as many as the Spark\'s.' }
    };
    const MACHINES = machinesFile.machines.map(plain).map(m => Object.assign(m, { short: WORDS[m.id].short }));
    const MODELS = modelsFile.models.map(plain);
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
      machine: alias(q.get('machine'), { spark: 'spark', dgx: 'spark', rtx5090: 'rtx5090', '5090': 'rtx5090', rtx: 'rtx5090', mac: 'mac', m3ultra: 'mac', studio: 'mac' }) || 'spark',
      prec: alias(q.get('bits'), { 4: '4', 8: '8', 16: '16' }) || '4',
      prompt: alias(q.get('prompt'), { q: 'q', question: 'q', doc: 'doc', document: 'doc', code: 'code', codebase: 'code' }) || 'q',
      speed: alias(q.get('speed'), { 1: '1', 5: '5' }) || '1',
      crew: Math.max(1, Math.min(CREW_MAX, Math.round(+q.get('crew')) || 1)),
      model: 'l70', size: null
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
      if (model.moe) s += ' Mixture of experts: only ' + model.active + 'B of its ' + model.total + 'B parameters work on each token, so each token reads far less.';
      document.getElementById('payload-line').innerHTML = s;
      syncSize(); syncCrew();
      setTerm('');
      ui.renderRace(sim); updateLaunchBtn();
      document.getElementById('race-note').textContent = 'Who finishes first? Guess, then launch.';
    }
    function updateLaunchBtn() {
      const b = document.getElementById('launch');
      b.setAttribute('aria-disabled', sim.plan.fits ? 'false' : 'true');
      b.textContent = sim.phase === 'done' ? 'Launch again' : 'Launch';
    }
    function launch() {
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
        if (whole > sim.lastTok) {
          const n = whole - sim.lastTok; sim.lastTok = whole; sim.flash = 1;
          if (model.moe) {
            const nw = Math.max(1, Math.round(weightCells() * Math.min(1, model.active * sel.crew / model.total)));
            sim.activeSet = new Set(); while (sim.activeSet.size < nw) sim.activeSet.add(Math.floor(Math.random() * weightCells()));
          }
          const o = cur.out, packets = Math.min(n, 2) * Math.min(3, Math.ceil(sel.crew / 8));
          for (let i = 0; i < packets; i++) {
            const a = o.from.clone().add(new T.Vector3((Math.random() - 0.5) * o.spread[0], 0, (Math.random() - 0.5) * o.spread[1]));
            cur.outP.spawn({ life: 0.9, path: t => E.qb(a, o.mid, o.to, t) });
          }
        }
        busT = p.busWrite; gpuT = p.busyWrite;
        if (sim.tokens >= ANSWER) { sim.phase = 'done'; updateLaunchBtn(); document.getElementById('race-note').textContent = WORDS[CUR.id].short + ' is done. The race keeps going until every machine finishes.'; }
      }
      sim.gpu += (gpuT - sim.gpu) * Math.min(1, dt * 6);
      sim.bus += (busT - sim.bus) * Math.min(1, dt * 6);
      sim.flash *= Math.exp(-dt * 16);
      sim.fan += ((0.5 + sim.gpu * 3 + sim.bus * 0.8) - sim.fan) * Math.min(1, dt * 1.5);
      cur.animate(sim, model, dt, time);
    }
    function weightCells() { return Math.max(1, Math.ceil(Math.min(sim.plan.usable, sim.plan.weightsGB))); }

    /* =========================================================
       4. INTERFACE
       ========================================================= */
    const onPick = key => {
      if (key === 'speed') return;
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
      sizeRead.textContent = m.total + 'B' + (m.moe ? ' MoE' : '');
      sizeEl.setAttribute('aria-valuetext', m.name);
    }
    sizeEl.addEventListener('input', () => {
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
    crewEl.addEventListener('input', () => { sel.crew = vToC(+crewEl.value); applySelection(true); });

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

    const statusEl = document.getElementById('status');
    function updateUI() {
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
        else if (crew > 1) { n = fmtT(p.totalTps); u = 'tokens per second, ' + crew + ' answers at once'; line = 'Each answer gets ' + fmtT(p.writeTps) + ' tokens per second.' + (p.gpuMax ? ' The GPU is maxed out.' : '') + ' Estimated for the ' + w.short + '.'; }
        else { n = fmtT(p.writeTps); u = 'tokens per second, writing the answer'; line = sim.phase === 'done' ? 'Reading took ' + fmtS(p.readS) + ', writing took ' + fmtS(p.writeS) + '. Estimated.' : 'Estimated for the ' + w.short + '.'; }
      }
      if (bn.textContent !== n) bn.textContent = n;
      if (bu.textContent !== u) bu.textContent = u;
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
       5. GO
       ========================================================= */
    if (record) document.body.classList.add('hide-ui');
    E.resize();
    E.camera.position.set(...E.SHOTS['1'].pos);
    applySelection();
    if (startShot) E.goShot(startShot, true);
    E.run(updateSim, updateUI);
    window.__lab = { launch, sim, sel, applySelection, switchMachine, busy: () => !!swap, goShot: E.goShot };
  }
})(window.DSP = window.DSP || {});
