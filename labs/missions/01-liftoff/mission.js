/* =========================================================
   MISSION 01, LIFTOFF: the choices, the words, and the simulation that
   goes load -> reading -> writing -> done. Ties the kit together.
   Five machines (switcher), a model-size handle, a crew dial, and URL presets for filming:
     ?machine=spark|rtx5090|mac|strix|pro6000 &model=q27 (a preset id) or model=45 (billions, dense)
     &bits=4|8|16 &prompt=q|doc|code &crew=1..64 &shot=1..4 &speed=1|5 &record=1 &open=0|1
   Every machine starts closed and opens when you drag its lid off, press O or launch; shot=2..4 (a close-up inside)
   starts it open, and open=1 or open=0 says so outright.
   record=1 hides the interface (the console stays: it is part of the show), opens the machine and launches as soon
   as the model has loaded.
   The console in front of the machine (kit/deck.js) and the controls bar drive the same handlers (section 4), so they
   stay in step; a MIDI controller can drive the console too (kit/midi.js).
   Live mode (section 6) switches on when live/bridge.mjs serves the page: a chat box that runs a real model
   on the Spark, real memory, power and temperature, and the Benchmark button.
   The showroom (section 8, showroom.js): ?showroom=1 (&focus=<machine>), V; the desk-corner room (kit/room.js): ?room=1, R.
   The guided tour (section 7, kit/tour.js, labs/tours/*.json): ?tour=life|ep1|ep3|ep4, &autoplay=1 to play it through
   for a recording; the console slides away while it runs and comes back for free play.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.machines || !DSP.machines.spark || !DSP.board) return; // the 3D engine didn't load; the fallback message is showing
  const E = DSP.engine, ui = DSP.ui, T = E.T;
  const { ANSWER, pick, calc, sizedModel, fmtS, fmtT, fmtGB, pct, plain, archModel } = DSP.model;
  const fmtB = b => b >= 1000 ? (b / 1000).toFixed(1) + 'T' : (b < 10 ? (Math.round(b * 10) / 10) : Math.round(b)) + 'B';

  DSP.model.loadData(['data-machines', 'data-models', 'data-measured', 'data-reported-strix', 'data-reported-pro6000', 'data-reported-rtx5090', 'data-reported-mac']).then(([machinesFile, modelsFile, ...runFiles]) => {
    DSP.model.setRuns(...runFiles);
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
      strix: { short: 'Strix Halo', the: 'the Strix Halo', sticker: 'Inside a Strix Halo mini PC (AMD Ryzen AI Max+ 395), the model sits in 8 memory packages around one big chip. Count the lanes: 8, like the Spark, so it writes about as fast. Its GPU has half the math, so it reads slower.' },
      pro6000: { short: 'RTX Pro 6000', the: 'the Pro 6000', sticker: 'Inside an RTX Pro 6000, the 5090\'s GPU chip sits between two fin stacks, ringed by 32 memory chips, 16 on each side of the board. The same 16 lanes as the 5090, so it writes as fast, and three times the room.' }
    };
    const MACHINES = machinesFile.machines.map(plain).map(m => Object.assign(m, { short: WORDS[m.id].short }));
    const MODELS = modelsFile.models.map(archModel);
    const PRECS = modelsFile.precisions.map(plain);
    DSP.model.setPrecisions(PRECS);
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
      machine: alias(q.get('machine'), { spark: 'spark', dgx: 'spark', rtx5090: 'rtx5090', '5090': 'rtx5090', rtx: 'rtx5090', mac: 'mac', m3ultra: 'mac', studio: 'mac', strix: 'strix', strixhalo: 'strix', halo: 'strix', amd: 'strix', ryzen: 'strix', '395': 'strix', pro6000: 'pro6000', rtxpro6000: 'pro6000', rtxpro: 'pro6000', pro: 'pro6000', '6000': 'pro6000' }) || 'spark',
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
    const startOpen = q.get('open') === '1' || (q.get('open') !== '0' && !!startShot && startShot !== '1');

    // Changing the selection from code re-syncs the pills too
    const sel = new Proxy(start0, { set(o, k, v) { o[k] = v; ui.syncPills(o); return true; } });
    let show = null;                                   // the showroom (section 8), once it exists
    const curModel = () => sel.model === 'size' ? sizedModel(sel.size, HANDLE) : pick(MODELS, sel.model);

    const ANSWER_TEXT = 'Short answer: your GPU is waiting on memory, not on math. To write each token, the model reads all of its weights out of memory, every single time. A bigger model means more gigabytes to move per token, and the memory bus can only move so much per second. The GPU finishes its math in a sliver of that time, then sits idle until the next delivery arrives. That is why bandwidth, not compute, sets your writing speed. It is also why mixture-of-experts models feel fast: they read only a small slice of their weights for each token.';

    /* =========================================================
       2. THE MACHINES: built the first time they're shown. Each starts closed in its shell; dragging the lid off,
          O, or a launch opens it (kit/shell.js rig), and the labels switch from the lid's hint to the parts inside.
       ========================================================= */
    // the plinth runs wider on the right for the mug; the console stands on the floor in front, so no placard
    const stand = DSP.parts.stand('DESK SPACE PROGRAM   MISSION 01: LIFTOFF', DSP.machines[sel.machine].name, { w: 35, d: 23.5, cx: 4.5, cz: -1.3, placard: false });
    const built = {};
    const plateSpec = id => { const m = pick(MACHINES, id); return { name: WORDS[id].short, mem: m.memGB + ' GB', bw: m.bw.toLocaleString('en-US') + ' GB/s' }; };
    let cur = null, CUR = null, swap = null;
    function machineObj(id) {
      if (built[id]) return built[id];
      const b = built[id] = DSP.machines[id].build();
      b.id = id; b.group.visible = false;
      b.shell.plate.print(plateSpec(id));
      E.grab({ meshes: b.shell.grab, cursor: 'grab', enabled: () => cur === b && !swap && !(show && show.on()), hover: on => { b.lidHot = on; }, down: lidDown, move: lidMove, up: lidUp });
      return b;
    }

    // the case: k goes 0 (closed) to 1 (open); to is where it is heading. pending: a launch waits for the case to open.
    // The open lid hangs above the machine (kit/shell.js rig): drag it up to open, back down to close; a tap, O or the
    // console's LID key opens a closed machine and closes an open one.
    const box = { k: startOpen ? 1 : 0, to: startOpen ? 1 : 0, drag: null, pending: false, openIn: 0 };
    const OPEN_S = E.reduceMotion ? 0.01 : 1.4, CLOSE_S = E.reduceMotion ? 0.01 : 1.0, SWAP_CLOSE_S = E.reduceMotion ? 0.01 : 0.6;
    const touchy = window.matchMedia && window.matchMedia('(hover: none)').matches;
    const openCase = on => { box.to = on === false ? 0 : 1; box.openIn = 0; if (!box.to) box.pending = false; };
    function lidDown() { box.drag = { k0: box.k }; }
    function lidMove(p) {
      const dy = p.y0 - p.y, d = dy + 0.5 * Math.abs(p.x - p.x0) * (dy < 0 ? -1 : 1);   // up opens, down closes, sideways helps a little
      box.k = box.to = Math.max(0, Math.min(1, box.drag.k0 + d / (E.view().h * 0.5)));
    }
    function lidUp(p) {
      const d = box.drag; box.drag = null; if (!d) return;
      if (!p.moved) { openCase(d.k0 < 0.5); return; }
      openCase(box.k > d.k0 + 0.05 ? true : box.k < d.k0 - 0.1 ? false : d.k0 >= 0.5);
    }
    let caseLabels = '', lidShown = null;
    function stepCase(dt) {
      if (box.openIn > 0) { box.openIn -= dt; if (box.openIn <= 0) openCase(true); }
      if (!box.drag && box.k !== box.to) box.k = box.to > box.k ? Math.min(box.to, box.k + dt / OPEN_S) : Math.max(box.to, box.k - dt / (swap ? SWAP_CLOSE_S : CLOSE_S));
      cur.shell.rig.set(box.k);
      // a close-up looks inside, and a 16:9 tour has its card where the lid would hang: the lid lifts right out of the frame
      const tourWide = tourOn && !document.body.classList.contains('tour-tall');
      cur.shell.rig.away((E.shotNow() !== '1' || tourWide) && !box.drag ? 1 : 0, dt);
      cur.shell.rig.glow(!!cur.lidHot, dt);
      const lidOpen = box.to >= 1 || box.openIn > 0;
      if (lidOpen !== lidShown) { lidShown = lidOpen; deck.setLid(lidOpen); }
      const want = swap ? '' : box.k >= 1 ? 'open' : box.k <= 0 ? 'closed' : '';
      if (want && want !== caseLabels) { caseLabels = want; E.initLabels(want === 'open' ? cur.labels : [{ id: 'lid', at: cur.shell.hint, title: 'Drag the ' + cur.shell.what + ' off' }]); }
      E.showLabels(!!want);
      if (box.pending && box.k >= 1 && !swap) { box.pending = false; launch(); }
    }

    function activate(id) {
      cur = machineObj(id); CUR = pick(MACHINES, id);
      cur.group.visible = true; caseLabels = '';
      cur.shell.rig.set(box.k);
      E.setShots(cur.shots);
      E.glow.position.set(...cur.glowAt); E.heat.position.set(...cur.heatAt);
      stand.setName(DSP.machines[id].name);
      document.querySelector('.sticker').textContent = WORDS[id].sticker;
      ui.setRaceThis(id);
    }
    activate(sel.machine);

    // The old machine closes its lid, then sinks into the stand, and the new one rises closed and opens (if the old one
    // was open). The specs switch at once.
    const SINK = 16, DOWN = 0.55, UP = 0.75;
    function switchMachine(id) {
      if (show && show.on()) { show.focus(id); return; }
      if (id === CUR.id && !swap) return;
      sel.machine = id; CUR = pick(MACHINES, id); ui.setRaceThis(id); // the specs snap now, the board follows
      document.querySelector('.sticker').textContent = WORDS[id].sticker;
      if (E.reduceMotion) { const re = box.to >= 1 || box.pending; cur.group.visible = false; box.k = box.to = 0; activate(id); if (re) box.openIn = 0.01; applySelection(); return; }
      if (swap && swap.stage !== 'up') swap.to = id;               // still on its way down: the new pick takes its place
      else {
        const reopen = swap ? swap.reopen : box.to >= 1 || box.pending || box.openIn > 0;
        swap = { from: cur, to: id, t: 0, stage: box.k > 0 ? 'close' : 'down', reopen };
        box.to = 0; box.openIn = 0; box.drag = null;
      }
      applySelection();
    }
    function stepSwap(dt) {
      if (swap.stage === 'close') { box.to = 0; if (box.k <= 0) { swap.stage = 'down'; swap.t = 0; } return; }   // the lid comes back down first
      swap.t += dt;
      if (swap.stage === 'down') {
        const k = Math.min(1, swap.t / DOWN);
        swap.from.group.position.y = -SINK * k * k;
        if (k >= 1) {
          swap.from.group.visible = false; swap.from.group.position.y = 0;
          box.k = box.to = 0;                                       // the new machine comes up closed
          activate(swap.to); cur.group.position.y = -SINK; swap.stage = 'up'; swap.t = 0;
        }
      } else {
        const k = Math.min(1, swap.t / UP), e = 1 - Math.pow(1 - k, 3);
        cur.group.position.y = -SINK * (1 - e);
        if (k >= 1) { cur.group.position.y = 0; if (swap.reopen || box.pending) box.openIn = 0.35; swap = null; }
      }
    }

    /* =========================================================
       3. SIMULATION
       ========================================================= */
    const sim = { raceDone: false, phase: 'loading', t: 0, load: 0, plan: null, others: [], tokens: 0, lastTok: 0, flash: 0, gpu: 0, bus: 0, fan: 0.5, activeSet: null, preview: 0 };

    // keep: the size handle or crew dial moved; stay loaded instead of reloading from the SSD
    function applySelection(keep) {
      if (show && show.on()) { show.select(keep); return; }
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
      if (model.table && p.hostTableGB) s += ' Plus a ' + fmtB(model.table) + '-parameter lookup table: <b>' + fmtGB(p.hostTableGB) + ' GB</b> that stays in the PC\'s own memory, since each token reads only a few rows of it.';
      else if (model.table) s += ' Plus a ' + fmtB(model.table) + '-parameter lookup table (the amber cells): it takes <b>' + fmtGB(p.tableGB) + ' GB</b>, but each token reads only a few rows of it.';
      if (p.measured && p.measured.weightsGB != null) s += p.hostTableGB ? ' Together that is the real ' + p.measured.quant + ' file, ' + fmtGB(p.measured.weightsGB) + ' GB.' : ' The ' + fmtGB(p.weightsGB) + ' GB is the real ' + p.measured.quant + ' file.';
      document.getElementById('payload-line').innerHTML = s;
      syncSize(); syncCrew(); syncDeck();
      if (armed && !box.pending) disarm();
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
    // Launch from anywhere (the console's switch, Space, the bar's button, a preset): refused when the model doesn't fit,
    // and a closed machine opens first, then launches. Returns false when refused.
    let armed = false;
    const disarm = () => { armed = false; deck.arm(false); };
    function launch() {
      if (show && show.on()) return show.launch();
      if (live.on) { if (liveRunning()) return true; leaveLive(); }
      if (sim.phase === 'reading' || sim.phase === 'writing') return true;
      const p = sim.plan, w = WORDS[CUR.id];
      if (!p.fits) {
        const why = p.weightsGB > p.usable ? 'Try 4-bit, a smaller model or another machine.' : 'Try a smaller crew or a shorter prompt.';
        ui.toast('This needs ' + fmtGB(p.needGB) + ' GB and ' + w.the + ' has ' + p.usable + ' GB free. ' + why);
        deck.refuse(); return false;
      }
      armed = true; deck.arm(true);
      if (box.k < 1 || swap) { box.pending = true; openCase(true); return true; }
      if (sim.phase === 'loading') sim.load = 1;
      sim.phase = 'reading'; sim.t = 0; sim.tokens = 0; sim.lastTok = 0; sim.raceDone = false; cur.outP.clear();
      setTerm(''); document.getElementById('race-note').textContent = '';
      return true;
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
    let launchedForRecord = false, openedForRecord = false;
    function updateSim(dt, time) {
      if (show && show.on()) return show.update(dt, time);
      if (swap) stepSwap(dt);
      stepCase(dt);
      slideDeck(dt);
      deck.update(dt);
      if (tourOn) return tourSim(dt, time);
      if (record && !openedForRecord && time > 0.7) { openedForRecord = true; openCase(true); }
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
        if (sim.tokens >= ANSWER) { sim.phase = 'done'; updateLaunchBtn(); disarm(); document.getElementById('race-note').textContent = WORDS[CUR.id].short + ' is done. The race keeps going until every machine finishes.'; }
      }
      settle(gpuT, busT, dt, time, model);
    }
    function settle(gpuT, busT, dt, time, model) {
      sim.gpu += (gpuT - sim.gpu) * Math.min(1, dt * 6);
      sim.bus += (busT - sim.bus) * Math.min(1, dt * 6);
      sim.flash *= Math.exp(-dt * 16);
      sim.preview = Math.max(0, sim.preview - dt * 0.7);
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
    // the console calls these too
    const pickMachine = id => { if (live.on && !liveRunning()) leaveLive(); switchMachine(id); };
    const pickPrec = id => { if (sel.prec !== id) { sel.prec = id; onPick('prec'); } };
    const pickPrompt = id => { if (sel.prompt !== id) { sel.prompt = id; onPick('prompt'); } };
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
    // v on the handle's 0-1000 scale; id: a preset the console's fader has settled in (its detents include the MoE ones)
    function pickSize(v, id) {
      if (live.on && !liveRunning()) leaveLive();
      const snap = id ? pick(MODELS, id) : MODELS.find(m => !m.moe && Math.abs(toV(m.total) - v) <= 12);
      if (snap) sel.model = snap.id; else { sel.model = 'size'; sel.size = toB(v); }
      applySelection(true);
    }
    sizeEl.addEventListener('input', () => pickSize(+sizeEl.value));

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
    function pickCrew(n) {
      if (live.on && !liveRunning()) leaveLive();
      if (n === sel.crew) return;
      sel.crew = n; if (sim.phase !== 'reading' && sim.phase !== 'writing') sim.preview = 1;   // the GPU blocks show what this crew would use
      applySelection(true);
    }
    crewEl.addEventListener('input', () => pickCrew(vToC(+crewEl.value)));

    /* ---------- the console (kit/deck.js): same handlers as the bar ---------- */
    const DECK_NAMES = { g4: 'GEMMA E4B', q36: '35B MoE', q27: '27B', flash: 'FLASH-NEXT', max: 'MAX' };
    const deck = DSP.deck.build({
      at: [5.2, -3, 17.7], scale: 0.9,
      machines: MACHINES.map(m => ({ id: m.id, short: WORDS[m.id].short })),
      models: MODELS.filter(m => m.total <= HANDLE.maxB).map(m => ({ id: m.id, t: toV(m.total) / 1000, moe: m.moe, label: DECK_NAMES[m.id] || m.short })),
      prompts: PROMPTS, precs: PRECS, crewMax: CREW_MAX,
      on: {
        machine: pickMachine, prec: pickPrec, prompt: pickPrompt, launch,
        lid: open => { if (!swap) openCase(open); },
        size: (t, id) => pickSize(t * 1000, id),
        crew: n => pickCrew(n),
        learnPick: (id, name) => midi.pick(id, name)
      }
    });
    function syncDeck() {
      const p = sim.plan;
      deck.set({ machine: sel.machine, t: toV(curModel().total) / 1000, crew: sel.crew, crewGpu: p.crewGpu, crewMem: p.crewMem, prec: sel.prec, prompt: sel.prompt });
    }
    const midi = DSP.midi.attach({ button: document.getElementById('midi-btn'), deck, toast: ui.toast });
    // the camera fits the machine, its mug and the console (wide), the machine above the console in a 9:16 recording
    // (stacked: each fills the width, the console drawn by its own camera), or the machine alone (a phone, where the
    // controls bar stands in for the console)
    const B3 = (a, b) => new T.Box3(new T.Vector3(...a), new T.Vector3(...b));
    const MACHINE_BOX = B3([-8.8, -0.2, -8.8], [8.8, 10.2, 8.8]), MUG_BOX = B3([10.5, 0, -8.6], [21.4, 10.6, 2.2]);
    // the console hides on a phone and slides away (down and toward the camera, under the floor) while a tour has the screen
    const deckHome = deck.root.position.clone(), slide = { k: 0, want: 0, hidden: false };
    E.onLayout(mode => {
      slide.hidden = mode === 'small'; slide.want = mode === 'focus' ? 1 : 0;
      if (slide.hidden || E.reduceMotion) slide.k = slide.want;
      deck.root.visible = !slide.hidden && slide.k < 1 && !(show && show.on());
    });
    function slideDeck(dt) {
      if (slide.k !== slide.want) slide.k = slide.want > slide.k ? Math.min(1, slide.k + dt / 0.7) : Math.max(0, slide.k - dt / 0.7);
      const e = slide.k * slide.k * (3 - 2 * slide.k);
      deck.root.position.set(deckHome.x, deckHome.y - 9 * e, deckHome.z + 14 * e);
      deck.root.visible = !slide.hidden && slide.k < 1;
    }
    E.setAvoid(deck.root);

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
      const r = p.measured, how = x => x.quant + ', ' + (x.eng || 'llama.cpp'), s = p.scaledFrom;
      if (!r || p.source === 'estimated') {
        const est = s ? 'Estimated from the ' + s.source + ' ' + (s.promptTokens || s.prompt).toLocaleString('en-US') + '-token' + (s.bits !== sel.prec ? ' ' + s.bits + '-bit' : '') + ' run on the ' + w.short : 'Estimated for the ' + w.short;
        return est + (r && p.readSource !== 'estimated' ? '; reading ' + r.source + ' (' + how(r) + ').' : '.');
      }
      if (r.source === 'measured') return 'Measured on the ' + w.short + ' (' + how(r) + ').';
      return 'Reported for the ' + w.short + ' by ' + r.by + ' (' + how(r) + ')' + (p.readSource === 'estimated' ? '; reading estimated.' : '.');
    }
    function sourceWords(p) {
      if (p.source === p.readSource) return { measured: 'Measured.', reported: 'Reported by others.', estimated: 'Estimated.' }[p.source];
      return 'Writing ' + p.source + ', reading ' + p.readSource + '.';
    }

    const statusEl = document.getElementById('status'), bigTag = document.getElementById('bigtag');
    function updateUI() {
      if (show && show.on()) return show.ui();
      if (live.on) return updateLiveUI();
      const p = sim.plan, w = WORDS[CUR.id], crew = sel.crew;
      let st = '', cls = '';
      if (swap) { st = 'Switching to the ' + w.short; }
      else if (!p.fits && sim.load >= 1) { st = 'Doesn\'t fit in memory'; cls = 'bad'; }
      else if (box.pending) { st = 'Opening the ' + cur.shell.what; cls = 'go'; }
      else if (sim.phase === 'loading') { st = (cur.loadingLabel === 'pcie' ? 'Loading over PCIe ' : 'Loading from the SSD ') + Math.floor(sim.load * 100) + '%'; }
      else if (sim.phase === 'ready') { st = box.k === 0 && touchy && window.innerWidth <= 900 ? 'Ready: tap the ' + cur.shell.what + ' or launch' : 'Ready for launch'; cls = 'go'; }
      else if (sim.phase === 'reading') { st = 'Reading ' + (crew > 1 ? crew + ' prompts' : 'your prompt') + ', T-minus ' + fmtS(Math.max(0, p.readS - sim.t)); cls = 'hot'; }
      else if (sim.phase === 'writing') { st = sim.tokens < 3 ? 'Liftoff: first token' : 'Writing, ' + Math.floor(sim.tokens) + ' of ' + ANSWER + ' tokens'; cls = 'go'; }
      else if (sim.phase === 'done') { st = 'Done in ' + fmtS(p.totalS); cls = 'go'; }
      if (statusEl.textContent !== st) statusEl.textContent = st;
      statusEl.className = 'status ' + cls;
      if (sim.phase === 'writing' || sim.phase === 'done') setTerm(ANSWER_TEXT.slice(0, Math.round(sim.tokens / ANSWER * ANSWER_TEXT.length)));
      if (DSP.room && DSP.room.on()) DSP.room.terminal([{ text: '> ' + pick(PROMPTS, sel.prompt).text, color: 'prompt' }, { text: ANSWER_TEXT.slice(0, Math.round(sim.tokens / ANSWER * ANSWER_TEXT.length)) }]);
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
      const tpsNow = !p.fits ? null : sim.phase === 'reading' ? p.readTps : sim.phase === 'writing' || sim.phase === 'done' ? (crew > 1 ? p.totalTps : p.writeTps) : null;
      deck.show({ gpu: g, bus: b, tps: tpsNow });
      // labels
      E.setLab('lid', touchy ? 'or tap it' : 'or press O', 'go');
      const used = Math.min(p.needGB, p.usable);
      E.setLab('mem', p.fits ? cur.chips + ', ' + fmtGB(used) + ' of ' + p.usable + ' GB used' : 'Too small: needs ' + fmtGB(p.needGB) + ' GB', p.fits ? 'go' : 'bad');
      E.setLab('bus', cur.busBits.toLocaleString('en-US') + '-bit, ' + CUR.bw.toLocaleString('en-US') + ' GB/s, ' + pct(b) + ' busy', b > 0.9 ? 'go' : '');
      E.setLab('gpu', sim.phase === 'writing' ? (p.gpuMax ? 'maxed out: the math is the limit now' : 'math used ' + pct(p.busyWrite) + ', waiting on memory') : sim.phase === 'reading' ? 'full power, reading the prompt' : 'idle',
        sim.phase === 'reading' || (sim.phase === 'writing' && p.gpuMax) ? 'hot' : '');
      Object.keys(cur.notes).forEach(id => E.setLab(id, cur.notes[id], id === cur.loadingLabel && sim.phase === 'loading' ? 'go' : ''));
      ui.renderRace(sim, crew);
    }

    DSP.actions.launch = launch;
    DSP.actions.nextMachine = () => show && show.on() ? show.next() : switchMachine(MACHINES[(MACHINES.indexOf(CUR) + 1) % MACHINES.length].id);
    DSP.actions.toggleCase = () => { if (show && show.on()) show.toggleLid(); else if (!swap) openCase(box.to < 1); };
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
      deck.show({ gpu: ph === 'reading' ? 1 : ph === 'writing' ? sim.plan.busyWrite : 0, bus: ph === 'writing' ? sim.plan.busWrite : ph === 'reading' ? sim.plan.busRead : 0, tps: ph === 'writing' || ph === 'done' ? (r.final && r.final.tgTps) || r.tps : null });
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
      openCase(true); armed = true; deck.arm(true);
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
      } catch (e) { ui.toast('Live: ' + e.message); if (live.run) live.run.phase = 'error'; sim.phase = 'ready'; disarm(); }
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
        case 'done': r.final = e; r.phase = 'done'; sim.phase = 'done'; sim.tokens = r.n; disarm(); break;
        case 'error': ui.toast(e.message); r.phase = 'error'; sim.phase = 'ready'; disarm(); break;
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
        'Reported speeds come from other people\'s published runs, each linked in its file: the Strix Halo\'s llama.cpp runs on a Ryzen AI Max+ 395 with 128 GB (' + reportedNames('strix') + '; data/reported/strix.json), ' +
        'the RTX 5090\'s llama-bench runs (' + reportedNames('rtx5090') + '; data/reported/rtx5090.json), the Mac Studio M3 Ultra\'s MLX runs, the fast engine on a Mac (' + reportedNames('mac') + '; data/reported/mac.json), ' +
        'and one for the RTX Pro 6000: ' + reportedNames('pro6000') + ' with a 22,695-token prompt, which stands for the codebase prompt (data/reported/pro6000.json). None of them uses speculative decoding. ' +
        'Where a machine has a run for the same model at another prompt length or compression, or for one request when a crew runs, that run sets the scale for the estimate. ' +
        'Everything else is estimated: Gemma 4 E4B on the 5090, the Mac and the Pro 6000, most 8- and 16-bit numbers, Qwen3.8-Max, and the GPU math used. Estimates for mixture-of-experts models use a rule fitted to the measured Spark and the reported 5090 running the same Qwen3.6 file.';
    }
    function reportedNames(id) {
      const f = DSP.model.measuredFor(id), runs = (f && f.runs) || [];
      return [...new Set(runs.map(r => r.name + (r.ppTps == null ? ' (writing only)' : '') + (r.tgTps == null && !runs.some(x => x.model === r.model && x.tgTps != null) ? ' (reading only)' : '')))].join(', ');
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
       7. GUIDED TOUR: kit/tour.js runs the story, this is the lab it drives. The tour owns the clock: seek(t) puts the
          simulation at t seconds since you hit enter (negative while the model loads), so the clock on screen and the
          machine always agree. Every number it shows comes from calc() and the data files, tagged by where it came from.
       ========================================================= */
    let tourOn = false;
    const TAG = src => src === 'measured' ? 'measured' : src === 'reported' || src === 'config' ? 'reported' : 'estimated';
    const runsOn = id => ((DSP.model.measuredFor(id) || {}).runs) || [];
    // a chip's own overrides: m (a machine), model, bits, prompt, crew; at: a machine or a model id from the words
    const stOf = (st, c) => Object.assign({}, st, c && c.at ? (pick(MODELS, c.at) ? { model: c.at } : { machine: c.at }) : {}, c && c.m ? { machine: c.m } : {}, c && c.model ? { model: c.model } : {}, c && c.bits ? { bits: c.bits } : {}, c && c.prompt ? { prompt: c.prompt } : {}, c && c.crew ? { crew: c.crew } : {});
    function planOf(st) {
      const m = pick(MACHINES, st.machine), model = pick(MODELS, st.model), prec = pick(PRECS, st.bits), prompt = pick(PROMPTS, st.prompt);
      return { m, model, prec, prompt, p: calc(m, model, prec, prompt, st.crew || 1) };
    }
    // the run behind a setup's file and time to load: the same machine, model and compression, measured or reported
    const fileRun = (x, k) => runsOn(x.m.id).find(r => r.model === x.model.id && r.bits === x.prec.id && r[k] != null) || null;
    // the Spark's measured load rate stands in where nobody measured a load (estimated)
    function loadOf(x) {
      const r = fileRun(x, 'loadS'); if (r) return { s: r.loadS, tag: TAG(r.source) };
      const sp = runsOn('spark').filter(r => r.loadS && r.weightsGB), rate = sp.length ? sp.reduce((a, r) => a + r.weightsGB / r.loadS, 0) / sp.length : 1;
      return { s: (x.p.weightsGB + x.p.hostTableGB) / rate, tag: 'estimated' };
    }
    const NO = { text: '—', unit: '', tag: 'estimated' };
    const pctS = f => f < 0.01 && f > 0 ? { text: '<1', unit: '%' } : { text: String(Math.round(f * 100)), unit: '%' };
    const secs = s => s < 60 ? { text: s < 10 ? s.toFixed(1) : s.toFixed(0), unit: 's' } : { text: fmtS(s), unit: '' };
    function metric(c, st) {
      const x = planOf(stOf(st, c)), p = x.p, crew = x.p.crew;
      const run = p.measured, wSrc = TAG(p.source), rSrc = TAG(p.readSource);
      const speed = (v, unit, tag) => p.fits ? Object.assign({ text: fmtT(v), unit }, { tag }) : { text: 'no fit', unit: '', tag: 'estimated' };
      const file = fileRun(x, 'weightsGB'), fileTag = file ? TAG(file.source) : 'estimated';
      const ex = model => calc(x.m, pick(MODELS, model), x.prec, x.prompt, 1);
      switch (c.k) {
        case 'weightsGB': return { text: fmtGB(p.weightsGB + p.hostTableGB), unit: 'GB', tag: fileTag };
        case 'cells': return { text: String(Math.ceil(Math.min(p.usable, p.weightsGB))), unit: 'cells', tag: fileTag };
        case 'loadS': { if (!p.fits) return NO; const l = loadOf(x); return Object.assign(secs(l.s), { tag: l.tag }); }
        case 'usableGB': return { text: String(p.usable), unit: 'GB', tag: 'estimated' };
        case 'bw': return { text: x.m.bw.toLocaleString('en-US'), unit: 'GB/s', tag: TAG(x.m.sources.bw) };
        case 'totalB': return { text: fmtB(x.model.total), unit: '', tag: TAG(x.model.sources.total) };
        case 'activeB': return { text: fmtB(x.model.active), unit: '', tag: TAG(x.model.sources.active) };
        case 'promptTokens': return { text: (run && run.promptTokens || x.prompt.tokens).toLocaleString('en-US'), unit: 'tokens', tag: run && run.promptTokens ? TAG(run.source) : 'estimated' };
        case 'answerTokens': return { text: String(ANSWER), unit: 'words', tag: run && run.genTokens === ANSWER ? TAG(run.source) : 'estimated' };
        case 'readTps': return speed(p.readTps, 'tokens/s', rSrc);
        case 'readS': return p.fits ? Object.assign(secs(p.readS), { tag: rSrc }) : NO;
        case 'ttftS': return p.fits ? Object.assign(secs(run && run.ttftS != null && crew === 1 ? run.ttftS : p.readS), { tag: run && run.ttftS != null && crew === 1 ? TAG(run.source) : rSrc }) : NO;
        case 'gpuRead': return { text: '100', unit: '%', tag: 'estimated' };
        case 'powerReadW': case 'powerWriteW': { const r = fileRun(x, c.k); return r && crew === 1 ? { text: String(Math.round(r[c.k])), unit: 'W', tag: TAG(r.source) } : NO; }
        case 'gpuClock': { const r = fileRun(x, 'gpuClockMaxMHz'); return r ? { text: r.gpuClockMaxMHz.toLocaleString('en-US'), unit: 'MHz', tag: TAG(r.source) } : NO; }
        case 'writeTps': return speed(p.writeTps, 'tokens/s', crew > 1 ? 'estimated' : wSrc);
        case 'totalTps': return speed(p.totalTps, 'tokens/s', crew > 1 ? 'estimated' : wSrc);
        case 'msPerToken': return p.fits ? { text: (1000 / p.writeTps).toFixed(0), unit: 'ms', tag: crew > 1 ? 'estimated' : wSrc } : NO;
        case 'perTokenGB': return x.model.moe ? { text: fmtGB(x.model.active * x.prec.bpp), unit: 'GB', tag: 'estimated' } : { text: fmtGB(p.weightsGB - p.tableGB), unit: 'GB', tag: fileTag };
        case 'busMs': { const gb = x.model.moe ? x.model.active * x.prec.bpp : p.weightsGB - p.tableGB; return { text: (gb / x.m.bw * 1000).toFixed(0), unit: 'ms', tag: 'estimated' }; }
        case 'busWrite': return Object.assign(pctS(p.busWrite), { tag: 'estimated' });
        case 'busyWrite': return Object.assign(pctS(p.busyWrite), { tag: 'estimated' });
        case 'idleWrite': return Object.assign(pctS(1 - p.busyWrite), { tag: 'estimated' });
        case 'kvKB': return { text: String(Math.round(x.model.kvMB * 1024)), unit: 'KB', tag: TAG(x.model.sources.kvMB) };
        case 'kvGB': return { text: fmtGB(p.kvTotal), unit: 'GB', tag: 'estimated' };
        case 'writeS': return p.fits ? Object.assign(secs(p.writeS), { tag: crew > 1 ? 'estimated' : wSrc }) : NO;
        case 'doneS': return p.fits ? Object.assign(secs(p.totalS), { tag: crew > 1 || wSrc !== rSrc ? 'estimated' : wSrc }) : NO;
        case 'moeX': { const a = ex(MOE_PAIR[1]), b = ex(MOE_PAIR[0]); if (!a.fits || !b.fits) return NO; const both = a.source === b.source && a.source !== 'estimated'; return { text: (a.writeTps / b.writeTps).toFixed(1), unit: '×', tag: both ? TAG(a.source) : 'estimated' }; }
      }
      return NO;
    }
    const MOE_PAIR = ['q27', 'q36'];
    function tourWords(k, st) {
      const w = WORDS[st.machine];
      if (k === 'the') return w.the; if (k === 'The') return w.the[0].toUpperCase() + w.the.slice(1);
      if (k === 'model') return pick(MODELS, st.model).name;
      return null;
    }
    function realLine(st) {
      const x = planOf(st), p = x.p, r = p.measured && p.source !== 'estimated' ? p.measured : p.scaledFrom || p.readFrom, w = WORDS[x.m.id].short;
      if (!r) return 'Real data: none behind this one. Every number here is the lab\'s formula (estimated).';
      const what = r.name + ' (' + r.quant + ') on the ' + w + ', ' + (r.engine || r.server || 'llama.cpp') + ', a ' + (r.promptTokens || r.prompt).toLocaleString('en-US') + '-token prompt';
      const scaled = r !== p.measured || p.source === 'estimated';
      if (r.source === 'measured') return 'Real data: ' + (scaled ? 'scaled from ' : '') + what + ', ' + (r.genTokens || ANSWER) + ' tokens out, the middle of ' + (r.reps || 3) + ' runs, measured ' + r.date + '.';
      return 'Real data: ' + (scaled ? 'scaled from ' : '') + what + ', reported by ' + r.by + ' (' + r.date + '). Links in data/reported/' + x.m.id + '.json.';
    }
    function report(st) {
      return MACHINES.map(m => {
        const x = planOf(Object.assign({}, st, { machine: m.id })), p = x.p, tag = p.crew > 1 ? 'estimated' : TAG(p.source);
        return { name: WORDS[m.id].short, text: p.fits ? fmtT(p.crew > 1 ? p.totalTps : p.writeTps) + ' tokens/s · ' + fmtS(p.totalS) : 'doesn\'t fit: needs ' + fmtGB(p.needGB) + ' GB', tag: p.fits ? tag : '', done: p.fits };
      });
    }
    // where the simulation is at t seconds since enter
    function tourSeek(t, jump) {
      const p = sim.plan, model = curModel();
      if (!p.fits) { sim.phase = 'ready'; sim.load = 1; sim.t = 0; sim.tokens = 0; }
      else if (t < 0) { sim.phase = 'loading'; sim.load = Math.max(0, Math.min(1, 1 + t / tourTimeline().loadS)); sim.t = 0; sim.tokens = 0; }
      else {
        sim.load = 1; sim.t = t;
        if (t < p.readS) { sim.phase = 'reading'; sim.tokens = 0; }
        else if (t < p.totalS) { sim.phase = 'writing'; sim.tokens = Math.min(ANSWER, (t - p.readS) * p.writeTps); }
        else { sim.phase = 'done'; sim.tokens = ANSWER; }
      }
      const whole = Math.floor(sim.tokens);
      if (jump || whole < sim.lastTok) { sim.lastTok = whole; cur.outP.clear(); }
      else if (whole > sim.lastTok) { tokenFx(Math.min(3, whole - sim.lastTok), model); sim.lastTok = whole; }
    }
    function tourTimeline() {
      const p = sim.plan, x = { m: CUR, model: curModel(), prec: pick(PRECS, sel.prec), p };
      return { loadS: loadOf(x).s, readS: p.readS, totalS: p.totalS, fits: p.fits };
    }
    function tourApply(st) {
      if (live.on && !liveRunning()) leaveLive();
      let changed = false;
      [['model', st.model], ['prec', st.bits], ['prompt', st.prompt], ['crew', st.crew || 1]].forEach(([k, v]) => { if (sel[k] !== v) { sel[k] = v; changed = true; } });
      if (st.machine !== sel.machine) switchMachine(st.machine);
      else if (changed) applySelection(true);
      if (box.to < 1) openCase(true);
    }
    function tourSim(dt, time) {
      DSP.tour.tick(dt);
      const p = sim.plan;
      let gpuT = 0.02, busT = 0;
      if (sim.phase === 'reading') { gpuT = 1; busT = p.busRead; }
      else if (sim.phase === 'writing') { gpuT = p.busyWrite; busT = p.busWrite; }
      settle(gpuT, busT, dt, time, curModel());
    }
    const tourLab = {
      whatIf: { machines: MACHINES.map(m => ({ id: m.id, short: { spark: 'Spark', rtx5090: '5090', mac: 'Mac', strix: 'Strix', pro6000: 'Pro 6000' }[m.id] || WORDS[m.id].short })), dense: MOE_PAIR[0], moe: MOE_PAIR[1], isMoe: id => !!(pick(MODELS, id) || {}).moe },
      apply: tourApply, seek: tourSeek, timeline: tourTimeline, metric, words: tourWords, realLine, report,
      begin(areaFn) { tourOn = true; disarm(); box.pending = false; E.setArea(areaFn); },
      end() { tourOn = false; E.setArea(null); applySelection(true); E.goShot('1'); },
      layout() { E.resize(); },
      shot(k) { E.goShot(k); }
    };
    // every <script type="application/json" id="tour-<id>"> on the page is a tour: ?tour=<id>
    const TOURS = {}; document.querySelectorAll('script[id^="tour-"]').forEach(s => { TOURS[s.id.slice(5)] = s.id; });
    function startTour(id, autoplay) {
      if (show && show.on()) show.leave();
      return DSP.model.loadData([TOURS[id] || TOURS.life]).then(([data]) => DSP.tour.start(data, tourLab, { autoplay }));
    }
    const tourBtn = document.getElementById('tour-btn');
    if (tourBtn) tourBtn.addEventListener('click', () => startTour('life', false));

    /* =========================================================
       8. SHOWROOM AND ROOM: all five machines on one long stand (showroom.js, V), and the desk corner round the stand
          (kit/room.js, R). The single machine, its stand and the console step aside while the showroom is on.
       ========================================================= */
    const SINGLE_FOOT = { x0: 4.5 - 17.5, x1: 4.5 + 17.5, z0: -1.3 - 11.75, z1: -1.3 + 11.75 };   // the stand made in section 2
    const singleFrames = () => ({ wide: [MACHINE_BOX, MUG_BOX, deck.box], tall: [MACHINE_BOX], small: [MACHINE_BOX], focus: [MACHINE_BOX], stack: { bottom: [deck.box], object: deck.root } });
    const SHOWROOM_WORDS = 'All five machines on one stand, at their real sizes, with the same mug. One question runs on all five at once: launch and watch the tickers. Click a machine to open it up.';
    if (DSP.showroom) show = DSP.showroom.create({
      E, ui, MACHINES, WORDS, sel, curModel, PRECS, PROMPTS, SPEEDS, calc, pick, ANSWER, ANSWER_TEXT, fmtT, fmtS, fmtGB, TAG, plateSpec,
      full: id => machineObj(id), autoLaunch: record,
      single(on) {                                     // the one-machine view steps aside, or comes back
        stand.group.visible = on; cur.group.visible = on;
        deck.root.visible = on && !slide.hidden && slide.k < 1;
        document.querySelector('.sticker').textContent = on ? WORDS[CUR.id].sticker : SHOWROOM_WORDS;
        const b = document.getElementById('show-btn'); if (b) { b.textContent = on ? 'Showroom' : 'One machine'; b.setAttribute('aria-pressed', on ? 'false' : 'true'); }
        if (!on) return;
        sel.machine = CUR.id; ui.setRaceThis(CUR.id);
        caseLabels = ''; E.setAvoid(deck.root); E.setShots(cur.shots);
        E.glow.position.set(...cur.glowAt); E.heat.position.set(...cur.heatAt);
        if (DSP.room) DSP.room.place(SINGLE_FOOT);
        E.setFrame(singleFrames()); applySelection(true); E.goShot('1');
      }
    });
    function toggleRoom(on) {
      if (!DSP.room) return;
      DSP.room.set(on == null ? !DSP.room.on() : on);
      if (show && show.on()) show.frame(false);
      else { E.setFrame(singleFrames()); if (E.shotNow() === '1') E.goShot('1'); }
    }
    DSP.actions.toggleShowroom = () => { if (!show) return; if (show.on()) show.leave(); else { if (DSP.tour && DSP.tour.active()) DSP.tour.stop(); show.enter(); } };
    DSP.actions.toggleRoom = () => toggleRoom();
    DSP.actions.escape = () => { if (show && show.on()) show.escape(); };
    const showBtn = document.getElementById('show-btn'), roomBtn = document.getElementById('room-btn');
    if (showBtn) showBtn.addEventListener('click', () => DSP.actions.toggleShowroom());
    if (roomBtn) roomBtn.addEventListener('click', () => { toggleRoom(); roomBtn.setAttribute('aria-pressed', DSP.room.on() ? 'true' : 'false'); });
    if (DSP.room) DSP.room.place(SINGLE_FOOT);

    /* =========================================================
       5. GO
       ========================================================= */
    if (record) document.body.classList.add('hide-ui');
    E.setFrame(singleFrames());
    E.camera.position.set(...E.SHOTS['1'].pos); E.controls.target.set(...E.SHOTS['1'].tgt);
    applySelection();
    E.goShot(startShot || '1', true);
    // canvas text was drawn with fallback fonts; print it again once the web fonts are in
    if (document.fonts && document.fonts.load) {
      Promise.all(['40px Anton', '500 20px "IBM Plex Mono"', '700 20px "Archivo Narrow"'].map(f => document.fonts.load(f))).then(r => {
        if (!r.some(x => x && x.length)) return;
        deck.redraw(); Object.keys(built).forEach(id => built[id].shell.plate.print(plateSpec(id)));
      }, () => {});
    }
    E.run(updateSim, updateUI);
    if (q.get('room') === '1') toggleRoom(true);
    const tourQ = q.get('tour');
    if (tourQ && DSP.tour) startTour(TOURS[tourQ] ? tourQ : 'life', q.get('autoplay') === '1').catch(e => console.error('tour', e));
    else if (q.get('showroom') === '1' && show) show.enter({ focus: alias(q.get('focus'), { spark: 'spark', rtx5090: 'rtx5090', '5090': 'rtx5090', mac: 'mac', strix: 'strix', pro6000: 'pro6000' }) });
    window.__lab = { launch, sim, sel, applySelection, switchMachine, busy: () => !!swap, goShot: E.goShot, live, startLive, deck, box, openCase, cur: () => cur, startTour, tour: DSP.tour, metric, report, show, room: DSP.room, toggleRoom };
  }
})(window.DSP = window.DSP || {});
