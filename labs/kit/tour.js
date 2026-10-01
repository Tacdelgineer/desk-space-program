/* =========================================================
   TOUR: a guided story through a lab in acts, slowed down, so a plain screen recording of the page is a finished
   video. A tour is a data file (labs/tours/*.json): acts and steps; each step has an act, a title, 3-4 plain sentences,
   a "Think of it as..." line, three number chips, one "break it" button, a one-line caption (12 words at most), a
   camera shot and the lab's state (autoplayS on the tour: how long autoplay takes, 30 s by default) (machine, model, bits, prompt, crew, t: seconds since you hit enter (negative while
   the model loads), slow: how many times slowed down, trip: the stops lit on the trip map).
   On screen: the step card (left), the trip map across the top (SSD -> memory -> bus -> GPU -> port -> you) with a live
   clock, a big caption at the bottom, a scrubber with the acts, 1/2x, 1x, 2x, play/pause, the arrow keys for previous
   and next, Esc to leave, and a "What if..." panel (dense or MoE, machine, crew 1 or 32, 4- or 16-bit). A tall window
   (9:16) gets the card on top, the machine in the middle and the caption at the bottom.
   The tour knows nothing about any one mission: start(data, lab, opts) takes a lab object with
     apply(state) set the selection, seek(t) put the simulation at t, timeline() { readS, totalS, loadS, fits },
     metric(chip, state) { text, unit, tag }, report(state) [{ name, text, tag, done }], realLine(state),
     whatIf: { machines: [{ id, short }], dense, moe, isMoe(id) }, words(key, state), begin(areaFn), end(), layout(), shot(k)
   Numbers come only from the lab (its data files): a step names a metric, never a value. A chip is { k, label } plus any
   state it overrides (m: a machine, model, bits, prompt, crew); words may hold {k}, {k:machine} or {k:model} and get the metric's
   number and unit, {the} / {The} the machine ("the Spark") and {model} the model's name.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.engine) return;
  const E = DSP.engine;
  const TRIP = [['ssd', 'SSD'], ['memory', 'Memory'], ['bus', 'Bus'], ['gpu', 'GPU'], ['port', 'Port'], ['you', 'You']];
  const AUTOPLAY_S = 30, HOLD_S = 2, RATES = [0.5, 1, 2];
  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const fmtClock = s => Math.abs(s) < 10 ? Math.abs(s).toFixed(2) : Math.abs(s) < 100 ? Math.abs(s).toFixed(1) : Math.round(Math.abs(s)).toString();
  const words = s => s.split(/\s+/).filter(Boolean).length;

  let T = null, ui = null;

  function buildUI() {
    const root = el('div', 'tour'); root.setAttribute('aria-live', 'polite');
    const trip = el('div', 'tour-trip', null, root);
    const stops = TRIP.map(([id, name], i) => { if (i) el('i', 'arrow', '→', trip); const s = el('span', 'stop', name, trip); s.dataset.id = id; return s; });
    const clock = el('div', 'tour-clock', '', trip);
    const card = el('section', 'panel tour-card', null, root);
    const head = el('div', 'tour-act', '', card);
    const title = el('h2', 'tour-title', '', card);
    const body = el('div', 'tour-body', null, card);
    const meta = el('p', 'tour-meta', '', card);
    const chips = el('div', 'tour-chips', null, card);
    const report = el('div', 'tour-report', null, card);
    const breakBtn = el('button', 'btn tour-break', '', card); breakBtn.type = 'button';
    const real = el('p', 'tour-real', '', card);
    const what = el('section', 'panel tour-what', null, root);
    el('h2', null, 'What if…', what);
    const whatRows = el('div', 'tour-what-rows', null, what);
    const reset = el('button', 'linkish tour-reset', 'Back to the story', what); reset.type = 'button';
    const caption = el('div', 'tour-caption', '', root);
    const bar = el('div', 'tour-bar', null, root);
    const prev = el('button', 'tour-ctl', '◀', bar); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous step');
    const play = el('button', 'tour-ctl tour-play', '▶', bar); play.type = 'button'; play.setAttribute('aria-label', 'Play');
    const next = el('button', 'tour-ctl', '▶▶', bar); next.type = 'button'; next.setAttribute('aria-label', 'Next step');
    const scrub = el('div', 'tour-scrub', null, bar);
    const rates = el('div', 'tour-rates', null, bar);
    const rateBtns = RATES.map(r => { const b = el('button', 'tour-ctl', r === 0.5 ? '½×' : r + '×', rates); b.type = 'button'; b.dataset.r = r; return b; });
    const exit = el('button', 'tour-ctl tour-exit', 'Exit tour', bar); exit.type = 'button';
    document.body.appendChild(root);
    prev.addEventListener('click', () => go(T.i - 1));
    next.addEventListener('click', () => go(T.i + 1));
    play.addEventListener('click', () => setPlaying(!T.playing));
    rateBtns.forEach(b => b.addEventListener('click', () => { T.rate = +b.dataset.r; paintBar(); }));
    exit.addEventListener('click', () => stop());
    breakBtn.addEventListener('click', () => { T.broken = !T.broken; refreshState(); });
    reset.addEventListener('click', () => { T.over = {}; T.broken = false; refreshState(); });
    return { root, trip, stops, clock, card, head, title, body, meta, chips, report, breakBtn, real, what, whatRows, reset, caption, bar, play, scrub, rateBtns };
  }

  // The tour's own keys come first (capture): arrows step, Space plays, Esc leaves; the lab's keys stay off meanwhile
  // (apart from F for fullscreen and H, which hides the tour's panels with the rest of the interface).
  function onKey(e) {
    if (!T || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (k === 'ArrowRight') go(T.i + 1);
    else if (k === 'ArrowLeft') go(T.i - 1);
    else if (k === ' ') setPlaying(!T.playing);
    else if (k === 'Escape') stop();
    else if (k === 'f' || k === 'F' || k === 'h' || k === 'H') return;
    else return;
    e.preventDefault(); e.stopPropagation();
  }

  /* ---------- the state of the current step: the story's, plus what the viewer changed ---------- */
  const stepOf = i => T.data.steps[i];
  function stateFor(i) {
    const s = stepOf(i), st = Object.assign({}, T.data.base, s.state);
    if (T.broken && s.breakIt) Object.assign(st, s.breakIt.set);
    return Object.assign(st, T.over);
  }
  // keep the moment when the state changes under it: the same share of the same phase
  function phasePos(t, tl) { return t < 0 ? { ph: 'load', f: 1 + t / tl.loadS } : t < tl.readS ? { ph: 'read', f: t / tl.readS } : t < tl.totalS ? { ph: 'write', f: (t - tl.readS) / (tl.totalS - tl.readS) } : { ph: 'done', f: t - tl.totalS }; }
  function fromPos(p, tl) { return p.ph === 'load' ? (p.f - 1) * tl.loadS : p.ph === 'read' ? p.f * tl.readS : p.ph === 'write' ? tl.readS + p.f * (tl.totalS - tl.readS) : tl.totalS + p.f; }
  function refreshState() {
    const pos = phasePos(T.t, T.lab.timeline());
    T.state = stateFor(T.i);
    T.lab.apply(T.state);
    T.t = fromPos(pos, T.lab.timeline());
    T.lab.seek(T.t, true);
    paintCard(); paintWhat();
  }

  /* ---------- painting ---------- */
  // {k} or {k:machine} -> the metric's number and unit; {the}, {The}, {model} -> words from the lab
  function fill(str, st) {
    return String(str || '').replace(/\{(\w+)(?::(\w+))?\}/g, (all, k, m) => {
      const w = T.lab.words(k, st); if (w != null) return w;
      const v = T.lab.metric(m ? { k, at: m } : { k }, st);
      if (v.text === '—') return '(not measured)';
      return v.text + (v.unit ? (v.unit === '%' || v.unit === '×' ? '' : ' ') + v.unit : '');
    });
  }
  function paintCard() {
    const s = stepOf(T.i), st = T.state, act = T.data.acts.find(a => a.id === s.act), ai = T.data.acts.indexOf(act);
    ui.head.textContent = fill(T.data.title, st) + '\nAct ' + (ai + 1) + ' · ' + act.title + ' · step ' + (T.i + 1) + ' of ' + T.data.steps.length;
    ui.title.textContent = fill(s.title, st);
    ui.body.innerHTML = '';
    s.text.forEach(p => el('p', null, fill(p, st), ui.body));
    ui.meta.textContent = fill(s.metaphor, st);
    ui.chips.innerHTML = '';
    s.chips.forEach(c => {
      const m = T.lab.metric(c, st), d = el('div', 'tour-chip', null, ui.chips);
      el('span', 'lbl', fill(c.label, st), d);
      const v = el('b', null, m.text, d); if (m.unit) el('small', null, (m.unit === '%' || m.unit === '×' ? '' : ' ') + m.unit, v);
      el('i', 'meas' + (m.tag === 'reported' ? ' rep' : m.tag === 'estimated' ? ' est' : ''), m.tag, d);
    });
    ui.report.innerHTML = '';
    ui.report.hidden = !s.report;
    if (s.report) T.lab.report(st).forEach(r => {
      const row = el('div', 'tour-rrow' + (r.done ? '' : ' no'), null, ui.report);
      el('span', 'n', r.name, row); el('b', null, r.text, row);
      if (r.tag) el('i', 'meas' + (r.tag === 'reported' ? ' rep' : r.tag === 'estimated' ? ' est' : ''), r.tag, row); else el('i', 'meas none', '', row);
    });
    ui.breakBtn.hidden = !s.breakIt;
    if (s.breakIt) ui.breakBtn.textContent = T.broken ? 'Fix it' : 'Break it: ' + fill(s.breakIt.label, st);
    ui.breakBtn.classList.toggle('on', T.broken);
    ui.real.textContent = T.lab.realLine(st);
    ui.caption.textContent = fill(T.broken && s.breakIt && s.breakIt.caption ? s.breakIt.caption : s.caption, st);
    fitCaption();
    const lit = new Set([].concat(s.trip || []));
    ui.stops.forEach(x => x.classList.toggle('on', lit.has(x.dataset.id)));
  }
  function paintWhat() {
    const st = T.state, story = Object.assign({}, T.data.base, stepOf(T.i).state), W = T.lab.whatIf;
    ui.whatRows.innerHTML = '';
    const row = (name, opts, cur, set) => {
      const r = el('div', 'tour-what-row', null, ui.whatRows); el('span', 'lbl', name, r);
      const g = el('div', 'tour-seg', null, r);
      opts.forEach(([v, label]) => { const b = el('button', 'pill-btn' + (v === cur ? ' on' : ''), label, g); b.type = 'button'; b.setAttribute('aria-pressed', v === cur ? 'true' : 'false'); b.addEventListener('click', () => { set(v); refreshState(); }); });
    };
    const isMoe = W.isMoe(st.model);
    row('Model', [['dense', 'Dense'], ['moe', 'MoE']], isMoe ? 'moe' : 'dense', v => { T.over.model = v === 'moe' ? W.moe : W.dense; });
    row('Machine', W.machines.map(m => [m.id, m.short]), st.machine, v => { T.over.machine = v; });
    row('Crew', [[1, '1'], [32, '32']], st.crew === 32 ? 32 : st.crew === 1 ? 1 : null, v => { T.over.crew = v; });
    row('Bits', [['4', '4-bit'], ['16', '16-bit']], st.bits, v => { T.over.bits = v; });
    const changed = Object.keys(T.over).some(k => T.over[k] !== story[k]) || T.broken;
    ui.reset.hidden = !changed;
  }
  function paintBar() {
    ui.play.textContent = T.playing ? '❚❚' : '▶'; ui.play.setAttribute('aria-label', T.playing ? 'Pause' : 'Play');
    ui.rateBtns.forEach(b => b.classList.toggle('on', +b.dataset.r === T.rate));
    if (!ui.scrub.firstChild) {
      const n = T.data.steps.length;
      T.data.acts.forEach(a => {
        const idx = T.data.steps.map((s, i) => s.act === a.id ? i : -1).filter(i => i >= 0);
        const seg = el('div', 'act', null, ui.scrub); seg.style.flexGrow = idx.length;
        el('span', 'name', a.title, seg);
        const ticks = el('div', 'tour-ticks', null, seg);
        idx.forEach(i => { const t = el('button', 'tick', null, ticks); t.type = 'button'; t.dataset.i = i; t.title = T.data.steps[i].title; t.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + T.data.steps[i].title); t.addEventListener('click', () => go(i)); });
      });
      el('i', 'head', null, ui.scrub);
      ui.scrubN = n;
    }
    ui.scrub.querySelectorAll('.tick').forEach(t => { const i = +t.dataset.i; t.classList.toggle('on', i === T.i); t.classList.toggle('past', i < T.i); });
  }
  function paintClock() {
    const tl = T.lab.timeline(), slow = (T.state && T.state.slow) || 1;
    const sl = slow > 1 ? ', slowed ' + slow + '×' : ', real time';
    let txt;
    if (!tl.fits) txt = 'It doesn’t fit: nothing runs';
    else if (T.t < 0) txt = 'Loading: ' + fmtClock(T.t) + ' s before you hit enter' + sl;
    else if (T.t >= tl.totalS) txt = 'Done ' + fmtClock(tl.totalS) + ' s after you hit enter';
    else txt = fmtClock(T.t) + ' s since you hit enter' + sl;
    if (ui.clock.textContent !== txt) ui.clock.textContent = txt;
    const head = ui.scrub.querySelector('.head'), ticks = ui.scrub.querySelectorAll('.tick'), cur = ticks[T.i];
    if (head && cur) {
      const r0 = ui.scrub.getBoundingClientRect(), r = cur.getBoundingClientRect(), f = Math.min(1, T.stepT / dur(T.i));
      const nx = ticks[T.i + 1] ? ticks[T.i + 1].getBoundingClientRect().left : r0.right;
      head.style.transform = 'translateX(' + (r.left - r0.left + r.width / 2 + f * (nx - r.left - r.width / 2) * (ticks[T.i + 1] ? 1 : 0.6)).toFixed(1) + 'px)';
    }
  }

  // one line, as big as fits: start from the stylesheet's size and shrink until the words fit the width
  function fitCaption() {
    const c = ui.caption; c.style.fontSize = '';
    if (document.body.classList.contains('tour-tall')) return;            // a tall frame lets it wrap to two lines instead
    let size = parseFloat(getComputedStyle(c).fontSize);
    for (let i = 0; i < 30 && c.scrollWidth > c.clientWidth + 1 && size > 16; i++) { size -= 2; c.style.fontSize = size + 'px'; }
  }

  /* ---------- time ---------- */
  // how long a step lasts at 1x: autoplay fits the whole tour in AUTOPLAY_S; otherwise long enough to read the card
  function dur(i) {
    const s = stepOf(i);
    if (T.autoplay) { const sum = T.data.steps.reduce((a, x) => a + (x.weight || 1), 0); return (T.data.autoplayS || AUTOPLAY_S) * (s.weight || 1) / sum; }
    return Math.max(7, (words(s.text.join(' ')) + words(s.metaphor) + words(s.caption)) / 3.2);
  }
  function setPlaying(on) { T.playing = !!on; paintBar(); }
  function go(i, first) {
    if (!T) return;
    if (i < 0) i = 0;
    if (i >= T.data.steps.length) { if (T.autoplay) { T.hold = HOLD_S; T.playing = false; paintBar(); } else setPlaying(false); return; }
    const s = stepOf(i);
    T.i = i; T.stepT = 0; T.over = {}; T.broken = false;
    T.state = stateFor(i);
    T.lab.apply(T.state, first);
    T.t = s.state.t != null ? s.state.t : 0;
    T.lab.seek(T.t, true);
    paintCard(); paintWhat(); paintBar(); paintClock();
    T.lab.layout();                                      // the card's height changed: fit the machine first, then move
    T.lab.shot(s.cam || '1');
  }
  function tick(dt) {
    if (!T) return;
    if (T.hold > 0) { T.hold -= dt; if (T.hold <= 0) { stop(); return; } }
    if (T.playing) {
      T.stepT += dt * T.rate;
      T.t += dt * T.rate / ((T.state && T.state.slow) || 1);
      if (T.stepT >= dur(T.i)) { go(T.i + 1); if (!T) return; }
    }
    T.lab.seek(T.t, false);
    paintClock();
  }

  /* ---------- layout: hand the free area between the panels to the camera ---------- */
  const tall = () => window.innerHeight > window.innerWidth * 1.1;
  function area() {
    if (!T) return null;
    const W = window.innerWidth, H = window.innerHeight;
    if (document.body.classList.contains('hide-ui')) return { left: 12, right: W - 12, top: 12, bottom: H - 12 };   // H: the machine alone
    const c = ui.card.getBoundingClientRect(), cap = ui.caption.getBoundingClientRect(), trip = ui.trip.getBoundingClientRect();
    if (tall()) return { left: 12, right: W - 12, top: Math.max(c.bottom, trip.bottom) + 12, bottom: cap.top - 12 };
    const w = ui.what.getBoundingClientRect();
    return { left: c.right + 16, right: (ui.what.offsetParent ? w.left : W) - 16, top: trip.bottom + 12, bottom: cap.top - 12 };
  }

  function start(data, lab, opts) {
    if (T) stop(true);
    opts = opts || {};
    if (!ui) ui = buildUI();
    ui.scrub.innerHTML = '';
    T = { data, lab, i: 0, stepT: 0, t: 0, rate: 1, playing: !!opts.autoplay, autoplay: !!opts.autoplay, over: {}, broken: false, hold: 0, state: null };
    document.body.classList.add('tour-on');
    document.body.classList.toggle('tour-auto', T.autoplay);
    document.body.classList.toggle('tour-tall', tall());
    window.addEventListener('keydown', onKey, true);
    lab.begin(area);
    go(0, true);
    return T;
  }
  function stop(quiet) {
    if (!T) return;
    const lab = T.lab; T = null;
    window.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('tour-on', 'tour-auto', 'tour-tall');
    if (!quiet) lab.end();
  }
  window.addEventListener('resize', () => { if (T) { document.body.classList.toggle('tour-tall', tall()); fitCaption(); T.lab.layout(); } });

  DSP.tour = { start, stop, tick, go: i => go(i), active: () => !!T, state: () => T && { i: T.i, t: T.t, playing: T.playing, state: T.state, broken: T.broken, n: T.data.steps.length } };
})(window.DSP = window.DSP || {});
