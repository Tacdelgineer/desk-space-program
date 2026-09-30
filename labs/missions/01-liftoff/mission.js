/* =========================================================
   MISSION 01, LIFTOFF: the choices, the words, and the simulation that
   goes load -> reading -> writing -> done. Ties the kit together.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.machines || !DSP.machines.spark) return; // the 3D engine didn't load; the fallback message is showing
  const E = DSP.engine, ui = DSP.ui, T = E.T;
  const { ANSWER, pick, calc, fmtS, fmtT, fmtGB, pct, plain } = DSP.model;

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
    const MACHINES = machinesFile.machines.map(plain);
    const SPARK = MACHINES.find(m => m.id === 'spark');
    const MODELS = modelsFile.models.map(plain);
    const PRECS = modelsFile.precisions.map(plain);
    const PROMPTS = [
      { id: 'q', short: 'Question', name: 'a quick question', tokens: 300, text: 'Why does my GPU feel slow?' },
      { id: 'doc', short: 'Document', name: 'a long document', tokens: 8000, text: '[a 30-page report] Summarize this and tell me why my GPU feels slow.' },
      { id: 'code', short: 'Codebase', name: 'a whole codebase', tokens: 32000, text: '[an entire codebase] Review this, then tell me why my GPU feels slow.' }];
    const SPEEDS = [{ id: '1', short: 'Real time', name: 'Real time', k: 1 }, { id: '5', short: '5x', name: '5x faster', k: 5 }];
    // Changing the selection from code re-syncs the pills too
    const sel = new Proxy({ model: 'l70', prec: '4', prompt: 'q', speed: '1' }, { set(o, k, v) { o[k] = v; ui.syncPills(o); return true; } });

    const ANSWER_TEXT = 'Short answer: your GPU is waiting on memory, not on math. To write each token, the model reads all of its weights out of memory, every single time. A bigger model means more gigabytes to move per token, and the memory bus can only move so much per second. The GPU finishes its math in a sliver of that time, then sits idle until the next delivery arrives. That is why bandwidth, not compute, sets your writing speed. It is also why mixture-of-experts models feel fast: they read only a small slice of their weights for each token.';

    /* =========================================================
       2. THE MACHINE
       ========================================================= */
    const machine = DSP.machines.spark.build();
    const { outP, spillP, tileTop, PORT } = machine;
    E.initLabels(machine.labels);

    /* =========================================================
       3. SIMULATION
       ========================================================= */
    const sim = { raceDone: false, phase: 'loading', t: 0, load: 0, plan: null, others: [], tokens: 0, lastTok: 0, flash: 0, gpu: 0, bus: 0, fan: 0.5, winnerId: null, activeSet: null };

    function applySelection() {
      const model = pick(MODELS, sel.model), prec = pick(PRECS, sel.prec), prompt = pick(PROMPTS, sel.prompt);
      sim.plan = calc(SPARK, model, prec, prompt);
      sim.others = MACHINES.map(m => ({ m, p: calc(m, model, prec, prompt) }));
      sim.phase = 'loading'; sim.t = 0; sim.load = 0; sim.tokens = 0; sim.lastTok = 0; sim.winnerId = null; sim.raceDone = false;
      outP.clear(); spillP.clear();
      const p = sim.plan;
      let s = model.name + ' at ' + prec.id + '-bit takes <b' + (p.fits ? '' : ' class="over"') + '>' + fmtGB(p.weightsGB) + ' GB</b>, plus <b>' + fmtGB(p.kvGB) + ' GB</b> of prompt memory for ' + prompt.name + ' (' + prompt.tokens.toLocaleString('en-US') + ' tokens). The Spark has <b>' + p.usable + ' GB</b> free.';
      if (model.moe) s += ' Mixture of experts: only ' + model.active + 'B of its ' + model.total + 'B parameters work on each token, so each token reads far less.';
      document.getElementById('payload-line').innerHTML = s;
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
      if (!sim.plan.fits) { ui.toast('This model needs ' + fmtGB(sim.plan.needGB) + ' GB and the Spark has ' + sim.plan.usable + ' GB free. Try 4-bit or a smaller model.'); return; }
      if (sim.phase === 'loading') sim.load = 1;
      sim.phase = 'reading'; sim.t = 0; sim.tokens = 0; sim.lastTok = 0; sim.winnerId = null; sim.raceDone = false; outP.clear();
      setTerm(''); document.getElementById('race-note').textContent = '';
    }
    function reset() { applySelection(); }

    const termEl = document.getElementById('term');
    let termShown = -1;
    function setTerm(answerPart) {
      const prompt = pick(PROMPTS, sel.prompt);
      const k = answerPart.length;
      if (k === termShown && answerPart !== '') return;
      termShown = k;
      termEl.innerHTML = '';
      const q = document.createElement('div'); q.className = 'q'; q.textContent = '> ' + prompt.text; termEl.appendChild(q);
      const a = document.createElement('div'); a.textContent = answerPart;
      const cur = document.createElement('span'); cur.className = 'cursor'; a.appendChild(cur); termEl.appendChild(a);
    }

    // The phases and the numbers, then the machine lights up to match (machines/spark.js)
    function updateSim(dt, time) {
      const p = sim.plan, speed = pick(SPEEDS, sel.speed).k;
      if (sim.phase === 'loading') { sim.load = Math.min(1, sim.load + dt / 1.6); if (sim.load >= 1) sim.phase = 'ready'; }
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
          const model = pick(MODELS, sel.model);
          if (model.moe) { const nw = Math.max(1, Math.round(weightCells() * model.active / model.total)); sim.activeSet = new Set(); while (sim.activeSet.size < nw) sim.activeSet.add(Math.floor(Math.random() * weightCells())); }
          for (let i = 0; i < Math.min(n, 2); i++) {
            const a = new T.Vector3(0.6 + (Math.random() - 0.5), tileTop + 0.05, (Math.random() - 0.5) * 2), mid = new T.Vector3(-0.3, 4.2, -4.2);
            outP.spawn({ life: 0.9, path: t => E.qb(a, mid, PORT, t) });
          }
        }
        busT = 1; gpuT = p.busyWrite;
        if (sim.tokens >= ANSWER) { sim.phase = 'done'; updateLaunchBtn(); document.getElementById('race-note').textContent = 'The Spark is done. The race keeps going until every machine finishes.'; }
      }
      sim.gpu += (gpuT - sim.gpu) * Math.min(1, dt * 6);
      sim.bus += (busT - sim.bus) * Math.min(1, dt * 6);
      sim.flash *= Math.exp(-dt * 16);
      sim.fan += ((0.5 + sim.gpu * 3 + sim.bus * 0.8) - sim.fan) * Math.min(1, dt * 1.5);
      machine.animate(sim, pick(MODELS, sel.model), dt, time);
    }
    function weightCells() { return Math.max(1, Math.ceil(Math.min(sim.plan.usable, sim.plan.weightsGB))); }

    /* =========================================================
       4. INTERFACE
       ========================================================= */
    const onPick = key => { if (key !== 'speed') applySelection(); };
    ui.pills('pick-model', MODELS, sel, 'model', onPick); ui.pills('pick-prec', PRECS, sel, 'prec', onPick);
    ui.pills('pick-prompt', PROMPTS, sel, 'prompt', onPick); ui.pills('pick-speed', SPEEDS, sel, 'speed', onPick);
    ui.buildRace(MACHINES);

    function finishNote() {
      const fits = sim.others.filter(o => o.p.fits);
      if (!fits.length) return;
      const best = fits.reduce((a, b) => a.p.totalS < b.p.totalS ? a : b);
      let s = best.m.name + ' finishes first, in ' + fmtS(best.p.totalS) + '. ';
      for (const pr of PROMPTS) {
        if (pr.id === sel.prompt) continue;
        let alt = null;
        MACHINES.forEach(m => { const p = calc(m, pick(MODELS, sel.model), pick(PRECS, sel.prec), pr); if (p.fits && (!alt || p.totalS < alt.p.totalS)) alt = { m, p }; });
        if (alt && alt.m.id !== best.m.id) { s += 'Switch your prompt to ' + pr.name + ' and the winner changes.'; break; }
      }
      document.getElementById('race-note').textContent = s;
    }

    const statusEl = document.getElementById('status');
    function updateUI() {
      const p = sim.plan;
      let st = '', cls = '';
      if (!p.fits && sim.load >= 1) { st = 'Doesn\'t fit in memory'; cls = 'bad'; }
      else if (sim.phase === 'loading') { st = 'Loading from the SSD ' + Math.floor(sim.load * 100) + '%'; }
      else if (sim.phase === 'ready') { st = 'Ready for launch'; cls = 'go'; }
      else if (sim.phase === 'reading') { st = 'Reading your prompt, T-minus ' + fmtS(Math.max(0, p.readS - sim.t)); cls = 'hot'; }
      else if (sim.phase === 'writing') { st = sim.tokens < 3 ? 'Liftoff: first token' : 'Writing, ' + Math.floor(sim.tokens) + ' of ' + ANSWER + ' tokens'; cls = 'go'; }
      else if (sim.phase === 'done') { st = 'Done in ' + fmtS(p.totalS); cls = 'go'; }
      if (statusEl.textContent !== st) statusEl.textContent = st;
      statusEl.className = 'status ' + cls;
      if (sim.phase === 'writing' || sim.phase === 'done') setTerm(ANSWER_TEXT.slice(0, Math.round(sim.tokens / ANSWER * ANSWER_TEXT.length)));
      const g = sim.phase === 'writing' ? p.busyWrite : sim.phase === 'reading' ? 1 : 0;
      const b = sim.phase === 'writing' ? 1 : sim.phase === 'reading' ? p.busRead : 0;
      document.getElementById('m-gpu').style.width = (g * 100).toFixed(1) + '%'; document.getElementById('v-gpu').textContent = pct(g);
      document.getElementById('m-bus').style.width = (b * 100).toFixed(1) + '%'; document.getElementById('v-bus').textContent = pct(b);
      const bn = document.getElementById('bignum'), bu = document.getElementById('bigunit'), sl = document.getElementById('speedline');
      let n = '-', u = 'doesn\'t fit in memory', line = 'Pick a smaller model or 4-bit.';
      if (p.fits) {
        if (sim.phase === 'reading') { n = fmtT(p.readTps); u = 'tokens per second, reading your prompt'; line = 'The GPU is flat out. Reading takes ' + fmtS(p.readS) + '.'; }
        else { n = fmtT(p.writeTps); u = 'tokens per second, writing the answer'; line = sim.phase === 'done' ? 'Reading took ' + fmtS(p.readS) + ', writing took ' + fmtS(p.writeS) + '. Estimated.' : 'Estimated for the DGX Spark.'; }
      }
      if (bn.textContent !== n) bn.textContent = n;
      if (bu.textContent !== u) bu.textContent = u;
      if (sl.textContent !== line) sl.textContent = line;
      // labels
      const used = Math.min(p.needGB, p.usable);
      E.setLab('mem', p.fits ? '8 chips, ' + fmtGB(used) + ' of ' + p.usable + ' GB used' : 'Too small: needs ' + fmtGB(p.needGB) + ' GB', p.fits ? 'go' : 'bad');
      E.setLab('bus', SPARK.bw + ' GB/s, ' + pct(b) + ' busy', b > 0.9 ? 'go' : '');
      E.setLab('gpu', sim.phase === 'writing' ? 'math used ' + pct(p.busyWrite) + ', waiting on memory' : sim.phase === 'reading' ? 'full power, reading the prompt' : 'idle', sim.phase === 'reading' ? 'hot' : '');
      E.setLab('cpu', '20 Arm cores', '');
      E.setLab('ssd', '4 TB, where models wait', sim.phase === 'loading' ? 'go' : '');
      E.setLab('fan', 'spins up under load', '');
      ui.renderRace(sim);
    }

    DSP.actions.launch = launch;
    DSP.actions.reset = reset;
    document.getElementById('launch').addEventListener('click', launch);
    document.getElementById('reset').addEventListener('click', reset);

    /* =========================================================
       5. GO
       ========================================================= */
    E.resize();
    E.camera.position.set(...E.SHOTS['1'].pos);
    applySelection();
    E.run(updateSim, updateUI);
    window.__lab = { launch, sim, sel, applySelection, goShot: E.goShot };
  }
})(window.DSP = window.DSP || {});
