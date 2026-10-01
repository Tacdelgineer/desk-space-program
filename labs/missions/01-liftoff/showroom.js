/* =========================================================
   SHOWROOM: all five machines side by side on one long stand at their true relative size (one coffee mug for
   scale), the same question running on all five at once, a small answer ticker over each. Click one to bring it
   forward and open it; only that one is built with its insides and lit up, the other four stay closed shells
   (kit/recipe.js shellOnly), so it runs on an ordinary laptop. V (or ?showroom=1) enters and leaves; Esc goes back
   from a machine to all five; &focus=<id> opens one at the start.
   create(ctx) takes the mission's pieces (mission.js section 8 passes them) and returns
     { enter, leave, on, update(dt, time), ui(), select(keep), launch(), focus(id), next(), toggleLid(), escape() }.
   ========================================================= */
(function (DSP) {
  'use strict';
  const MM = 0.06;                                   // scene units per millimetre on the long stand
  const GAP = 3.4, OPEN_S = 1.4, CLOSE_S = 1.0;

  function create(c) {
    const E = c.E, T = E.T, S = DSP.shell, P = DSP.parts, pick = c.pick;
    const st = { on: false, built: false, focus: null, group: null, runs: [], box: null, finished: 0, foot: null };
    let host = null, mug = null, keyWas = null;

    // the five shells on the stand, built the first time the showroom opens
    function build() {
      st.group = new T.Group(); E.scene.add(st.group);
      const ids = c.MACHINES.map(m => m.id);
      const parts = ids.map(id => {
        const D = DSP.machines[id], sh = D.shellOnly();
        sh.plate.print(c.plateSpec(id));
        const R = D.recipe, f = MM / (R.width / R.mm);
        const lb = new T.Box3().setFromObject(sh.group);
        return { id, D, sh, f, lb, w: (lb.max.x - lb.min.x) * f, d: (lb.max.z - lb.min.z) * f, h: (lb.max.y) * f };
      });
      const mugW = 82 * MM;
      const total = parts.reduce((a, p) => a + p.w, 0) + GAP * (parts.length - 1) + GAP + mugW;
      let x = -total / 2;
      parts.forEach(p => {
        const cx = x + p.w / 2, lc = p.lb.getCenter(new T.Vector3());
        p.sh.group.scale.setScalar(p.f);
        p.sh.group.position.set(cx - lc.x * p.f, 0, -lc.z * p.f);
        st.group.add(p.sh.group);
        const run = { id: p.id, m: pick(c.MACHINES, p.id), D: p.D, shell: p.sh, f: p.f, pos: p.sh.group.position.clone(), cx, w: p.w, d: p.d, top: p.h, k: 0, kTo: 0, full: null, sim: newSim(), plan: null, rank: 0 };
        // the hit zone: the shell's footprint, invisible, a click picks the machine
        const hit = new T.Mesh(new T.BoxGeometry(p.w + 0.6, Math.max(2, p.h) + 1.5, p.d + 0.6), new T.MeshBasicMaterial({ visible: false }));
        hit.position.set(cx, (Math.max(2, p.h) + 1.5) / 2, 0); st.group.add(hit);
        E.grab({ meshes: [hit], cursor: 'pointer', enabled: () => st.on, up: q => { if (!q.moved) focus(run.id); } });
        st.runs.push(run);
        x += p.w + GAP;
      });
      E.setParent(st.group);
      mug = S.mug(MM, x + mugW / 2, -1.2, -Math.PI / 4);
      const depth = Math.max(...parts.map(p => p.d)) + 9;
      const stand = P.stand('', '', { w: total + 7, d: depth, cx: 0, cz: 0, placard: false });
      st.group.add(stand.group);
      E.setParent(null);
      P.tuneEnv();
      st.foot = { x0: -(total + 7) / 2, x1: (total + 7) / 2, z0: -depth / 2, z1: depth / 2 };
      st.box = new T.Box3(new T.Vector3(-total / 2, -0.4, -depth / 2 + 1), new T.Vector3(total / 2, Math.max(...parts.map(p => p.h)) + 7, depth / 2 - 1));
      host = document.createElement('div'); host.className = 'showroom'; host.setAttribute('aria-live', 'off');
      st.runs.forEach(r => {
        const t = document.createElement('button'); t.type = 'button'; t.className = 'sr-tick'; t.dataset.id = r.id;
        t.innerHTML = '<span class="sr-head"><b></b><span class="sr-rank"></span></span><span class="sr-st"></span><span class="sr-num"><b></b><small></small><i class="meas"></i></span><span class="sr-line"></span>';
        t.querySelector('.sr-head b').textContent = c.WORDS[r.id].short;
        t.addEventListener('click', () => focus(r.id));
        host.appendChild(t); r.el = t;
      });
      document.body.appendChild(host);
      st.built = true;
    }
    function newSim() { return { phase: 'loading', t: 0, load: 0, plan: null, tokens: 0, lastTok: 0, flash: 0, gpu: 0, bus: 0, fan: 0.5, activeSet: null, preview: 0, raceDone: false, live: null, tableHit: -1 }; }

    /* ---------- frames: all five, or the one you picked ---------- */
    const areaFn = () => {
      const W = window.innerWidth, H = window.innerHeight;
      if (document.body.classList.contains('hide-ui')) return { left: 12, right: W - 12, top: 12, bottom: H - 12 };
      const t = document.querySelector('.title').getBoundingClientRect(), bar = document.querySelector('.controls').getBoundingClientRect();
      const small = W <= 900;
      return { left: 16, right: W - 16, top: (small ? t.bottom : Math.min(t.bottom, H * 0.34)) + 10, bottom: (bar.height && bar.top < H ? bar.top : H) - 12 };
    };
    const toWorld = (r, p) => new T.Vector3(p[0] * r.f + r.pos.x, p[1] * r.f + r.pos.y, p[2] * r.f + r.pos.z);
    const LOCAL_BOX = [[-8.8, -0.2, -8.8], [8.8, 10.2, 8.8]];
    function frame(instant) {
      const r = st.focus && run(st.focus);
      const box = r ? new T.Box3(toWorld(r, LOCAL_BOX[0]), toWorld(r, LOCAL_BOX[1])) : st.box;
      E.setFrame({ wide: [box], tall: [box], small: [box], focus: [box] });
      if (r) {
        const own = r.full.shots || {}, def = E.defaultShots(), shots = {};
        ['2', '3', '4'].forEach(k => { const s = own[k] || def[k]; shots[k] = { pos: toWorld(r, s.pos).toArray(), tgt: toWorld(r, s.tgt).toArray() }; });
        E.setShots(shots);
        E.glow.position.copy(toWorld(r, r.full.glowAt)); E.heat.position.copy(toWorld(r, r.full.heatAt));
      } else { E.glow.intensity = 0; E.heat.intensity = 0; }
      E.goShot('1', instant);
    }
    const run = id => st.runs.find(r => r.id === id);

    /* ---------- the five runs ---------- */
    function select(keep) {
      if (!st.on) return;
      const model = c.curModel(), prec = pick(c.PRECS, c.sel.prec), prompt = pick(c.PROMPTS, c.sel.prompt);
      st.finished = 0;
      st.runs.forEach(r => {
        const s = r.sim; r.plan = s.plan = c.calc(r.m, model, prec, prompt, c.sel.crew); r.rank = 0;
        if (keep && s.load >= 1) s.phase = 'ready'; else if (!keep) { s.phase = 'loading'; s.load = 0; }
        s.t = 0; s.tokens = 0; s.lastTok = 0;
        if (r.full) { r.full.outP.clear(); r.full.spillP.clear(); }
      });
      c.ui.syncPills(c.sel);
    }
    function launch() {
      st.finished = 0;
      st.runs.forEach(r => {
        const s = r.sim; r.rank = 0;
        if (!r.plan.fits) return;
        if (s.phase === 'loading') s.load = 1;
        s.phase = 'reading'; s.t = 0; s.tokens = 0; s.lastTok = 0;
        if (r.full) r.full.outP.clear();
      });
      return true;
    }
    function weightCells(r) { const p = r.plan; return Math.max(1, Math.ceil(Math.min(p.usable, p.weightsGB) - (p.tableGB || 0))); }
    function tokenFx(r, n, model) {
      const s = r.sim, b = r.full; s.flash = 1;
      if (model.moe) { const nw = Math.max(1, Math.round(weightCells(r) * Math.min(1, model.active * c.sel.crew / model.total))); s.activeSet = new Set(); while (s.activeSet.size < nw) s.activeSet.add(Math.floor(Math.random() * weightCells(r))); }
      const tc = Math.ceil(r.plan.tableGB || 0); s.tableHit = tc ? Math.floor(Math.random() * tc) : -1;
      const o = b.out, packets = Math.min(n, 2) * Math.min(3, Math.ceil(c.sel.crew / 8));
      for (let i = 0; i < packets; i++) {
        const a = o.from.clone().add(new T.Vector3((Math.random() - 0.5) * o.spread[0], 0, (Math.random() - 0.5) * o.spread[1]));
        b.outP.spawn({ life: 0.9, path: t => E.qb(a, o.mid, o.to, t) });
      }
    }

    function update(dt, time) {
      const speed = pick(c.SPEEDS, c.sel.speed).k, model = c.curModel();
      st.runs.forEach(r => {
        const s = r.sim, p = r.plan;
        if (s.phase === 'loading') { s.load = Math.min(1, s.load + dt / 1.6); if (s.load >= 1) s.phase = 'ready'; }
        if (s.phase === 'reading' || s.phase === 'writing') s.t += dt * speed;
        if (s.phase === 'reading' && s.t >= p.readS) s.phase = 'writing';
        let gpuT = 0.02, busT = 0;
        if (s.phase === 'reading') { gpuT = 1; busT = p.busRead; }
        if (s.phase === 'writing') {
          s.tokens = Math.min(c.ANSWER, (s.t - p.readS) * p.writeTps);
          const whole = Math.floor(s.tokens);
          if (whole > s.lastTok) { const n = whole - s.lastTok; s.lastTok = whole; if (r.full && r.full.group.visible) tokenFx(r, n, model); }
          gpuT = p.busyWrite; busT = p.busWrite;
          if (s.tokens >= c.ANSWER) { s.phase = 'done'; r.rank = ++st.finished; }
        }
        // the lid of the machine you picked opens; the one you left closes, then goes back to its plain shell
        if (r.k !== r.kTo) r.k = r.kTo > r.k ? Math.min(r.kTo, r.k + dt / (E.reduceMotion ? 0.01 : OPEN_S)) : Math.max(r.kTo, r.k - dt / (E.reduceMotion ? 0.01 : CLOSE_S));
        if (r.full && r.full.group.visible) {
          r.full.shell.rig.set(r.k);
          r.full.shell.rig.away(E.shotNow() !== '1' ? 1 : 0, dt);
          s.gpu += (gpuT - s.gpu) * Math.min(1, dt * 6); s.bus += (busT - s.bus) * Math.min(1, dt * 6);
          s.flash *= Math.exp(-dt * 16); s.preview = Math.max(0, s.preview - dt * 0.7);
          s.fan += ((0.5 + s.gpu * 3 + s.bus * 0.8) - s.fan) * Math.min(1, dt * 1.5);
          r.full.animate(s, model, dt, time);
          if (r.id !== st.focus && r.k <= 0) { r.full.group.visible = false; r.shell.group.visible = true; }
        }
      });
      place();
      if (c.autoLaunch && !st.launched && st.runs.every(r => r.sim.phase !== 'loading') && (!st.focus || run(st.focus).k >= 1)) { st.launched = true; launch(); }
    }

    /* ---------- the tickers: name, what it is doing, the number with its tag, the answer so far ---------- */
    // over each machine's back edge; the picked machine's ticker is pinned at the top right as its answer panel, and a
    // ticker whose machine is off the screen or under the title hides
    const pv = { x: 0, y: 0 };
    function place() {
      const W = window.innerWidth, title = document.body.classList.contains('hide-ui') ? null : document.querySelector('.title').getBoundingClientRect();
      st.runs.forEach(r => {
        if (r.id === st.focus) { r.el.style.transform = ''; r.el.hidden = false; return; }
        E.toScreen(new T.Vector3(r.cx, r.top + 3.2, -r.d / 2), pv);
        const w = r.el.offsetWidth || 200, h = r.el.offsetHeight || 90, x0 = pv.x - w / 2, y0 = pv.y - h;
        const off = pv.x < 0 || pv.x > W || (st.focus && title && x0 < title.right && y0 < title.bottom);
        r.el.hidden = !!off;
        if (!off) r.el.style.transform = 'translate(' + Math.max(8, Math.min(W - w - 8, x0)).toFixed(1) + 'px,' + y0.toFixed(1) + 'px)';
      });
    }
    function ui() {
      if (!st.on) return;
      const crew = c.sel.crew;
      st.runs.forEach(r => {
        const s = r.sim, p = r.plan, el = r.el;
        let status, num = '', unit = '', tag = '', line = '';
        if (!p.fits) { status = 'Doesn\'t fit: needs ' + c.fmtGB(p.needGB) + ' of ' + p.usable + ' GB'; }
        else if (s.phase === 'loading') status = 'Loading ' + Math.floor(s.load * 100) + '%';
        else if (s.phase === 'ready') { status = 'Ready'; num = c.fmtT(crew > 1 ? p.totalTps : p.writeTps); unit = 'tok/s'; tag = crew > 1 ? 'estimated' : c.TAG(p.source); }
        else if (s.phase === 'reading') { status = 'Reading, ' + c.fmtS(Math.max(0, p.readS - s.t)) + ' left'; num = c.fmtT(p.readTps); unit = 'tok/s reading'; tag = crew > 1 ? 'estimated' : c.TAG(p.readSource); }
        else { status = s.phase === 'done' ? 'Done in ' + c.fmtS(p.totalS) : 'Writing, ' + Math.floor(s.tokens) + ' of ' + c.ANSWER; num = c.fmtT(crew > 1 ? p.totalTps : p.writeTps); unit = 'tok/s'; tag = crew > 1 ? 'estimated' : c.TAG(p.source); }
        if (s.phase === 'writing' || s.phase === 'done') { const a = c.ANSWER_TEXT.slice(0, Math.round(s.tokens / c.ANSWER * c.ANSWER_TEXT.length)); line = r.id === st.focus ? a : a.length > 38 ? '…' + a.slice(-37) : a; }
        const set = (q, v) => { const e = el.querySelector(q); if (e.textContent !== v) e.textContent = v; };
        set('.sr-st', status); set('.sr-num b', num); set('.sr-num small', unit); set('.sr-line', line || ' ');
        const m = el.querySelector('.meas'); m.hidden = !tag; if (tag) { m.textContent = tag; m.className = 'meas' + (tag === 'reported' ? ' rep' : tag === 'estimated' ? ' est' : ''); }
        set('.sr-rank', r.rank ? ['1st', '2nd', '3rd', '4th', '5th'][r.rank - 1] : '');
        el.classList.toggle('on', r.id === st.focus); el.classList.toggle('no', !p.fits); el.classList.toggle('win', r.rank === 1);
      });
      const f = run(st.focus || 'spark'), prompt = pick(c.PROMPTS, c.sel.prompt);
      if (DSP.room) DSP.room.terminal([{ text: '> ' + prompt.text, color: 'prompt' }, { text: c.ANSWER_TEXT.slice(0, Math.round(f.sim.tokens / c.ANSWER * c.ANSWER_TEXT.length)) }]);
    }

    /* ---------- picking a machine ---------- */
    function focus(id) {
      if (!st.on) return;
      if (st.focus === id) { toggleLid(); return; }
      const old = st.focus && run(st.focus);
      if (old) old.kTo = 0;
      st.focus = id || null;
      const r = id && run(id);
      if (r) {
        if (!r.full) {
          r.full = c.full(id);
          r.full.group.scale.setScalar(r.f); r.full.group.position.copy(r.pos);
          r.full.mug.visible = false;
        }
        r.full.group.visible = true; r.shell.group.visible = false;
        r.full.shell.rig.set(r.k);
        r.kTo = 1;
        c.ui.setRaceThis(id); c.sel.machine = id;
      }
      frame(false);
      ui();
    }
    function toggleLid() { const r = st.focus && run(st.focus); if (r) r.kTo = r.kTo >= 1 ? 0 : 1; }
    function next() { const ids = st.runs.map(r => r.id); focus(ids[(ids.indexOf(st.focus) + 1) % ids.length]); }
    function escape() { if (st.focus) focus(null); else leave(); }

    function enter(opts) {
      if (st.on) return;
      opts = opts || {};
      c.single(false);
      if (!st.built) build();
      st.on = true; st.group.visible = true; host.hidden = false; st.launched = false;
      document.body.classList.add('showroom-on');
      // the key light's shadows cover the whole long stand
      const cam = E.key.shadow.camera; keyWas = [cam.left, cam.right, cam.top, cam.bottom];
      cam.left = cam.bottom = -60; cam.right = cam.top = 60; cam.updateProjectionMatrix();
      st.maxDist = E.controls.maxDistance; E.controls.maxDistance = 420;      // a tall frame backs far off to fit the long stand
      if (DSP.room) DSP.room.place(st.foot);
      E.initLabels([]); E.setAvoid(null); E.setArea(areaFn);
      select(false);
      if (opts.focus && run(opts.focus)) focus(opts.focus); else frame(true);
      E.goShot('1', true);
    }
    function leave() {
      if (!st.on) return;
      st.on = false; st.group.visible = false; host.hidden = true;
      document.body.classList.remove('showroom-on');
      st.runs.forEach(r => {
        if (r.full) { r.full.group.visible = false; r.full.group.scale.setScalar(1); r.full.group.position.set(0, 0, 0); r.full.mug.visible = true; r.full.outP.clear(); r.full.spillP.clear(); r.full = null; }
        r.shell.group.visible = true; r.k = r.kTo = 0;
      });
      st.focus = null;
      const cam = E.key.shadow.camera; [cam.left, cam.right, cam.top, cam.bottom] = keyWas; cam.updateProjectionMatrix();
      E.controls.maxDistance = st.maxDist;
      E.setArea(null);
      c.single(true);
    }
    window.addEventListener('resize', () => { if (st.on) place(); });

    return { enter, leave, on: () => st.on, update, ui, select, launch, focus, next, toggleLid, escape, focused: () => st.focus, frame };
  }

  DSP.showroom = { create };
})(window.DSP = window.DSP || {});
