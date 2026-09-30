/* =========================================================
   UI: pills, the race panel, toast, dialogs, hide-interface.
   Works on the markup in a mission's index.html. The words shown are the mission's.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.engine) return;
  const { ANSWER, fmtS, fmtT, fmtGB } = DSP.model;

  // One radio group per key. onChange(key) runs when the user picks a pill.
  function pills(host, list, sel, key, onChange) {
    const el = document.getElementById(host);
    list.forEach(item => {
      const l = document.createElement('label'); l.className = 'pill';
      const i = document.createElement('input'); i.type = 'radio'; i.name = key; i.value = item.id; i.checked = sel[key] === item.id;
      i.addEventListener('change', () => { sel[key] = item.id; onChange(key); });
      const s = document.createElement('span'); s.textContent = item.short || item.name; l.title = item.name + (item.tokens ? ', ' + item.tokens.toLocaleString('en-US') + ' tokens' : '');
      l.append(i, s); el.appendChild(l);
    });
  }
  // Make the pills show the selection again after code changed it.
  function syncPills(sel) {
    document.querySelectorAll('.pills input').forEach(i => { i.checked = sel[i.name] === i.value; });
  }

  // Marks on a slider track: [{ at: percent, cls, title }]
  function ticks(host, marks) {
    const el = document.getElementById(host); el.innerHTML = '';
    marks.forEach(m => { const i = document.createElement('i'); i.className = m.cls || ''; i.style.left = m.at.toFixed(1) + '%'; i.title = m.title || ''; el.appendChild(i); });
  }

  /* ---------- race panel: one row per machine; the one on the stand is marked "inside view". A row whose numbers
     come from a real run is tagged measured (run here) or reported (published by someone else) ---------- */
  function buildRace(machines) {
    const rrows = document.getElementById('rrows');
    machines.forEach(m => {
      const d = document.createElement('div'); d.className = 'rrow'; d.dataset.id = m.id;
      d.innerHTML = '<div class="top"><b></b><i class="meas" hidden>measured</i></div><div class="track"><i></i><span></span></div>';
      d.querySelector('b').textContent = m.name; rrows.appendChild(d); m.row = d;
    });
  }
  function setRaceThis(id) { document.querySelectorAll('.rrow').forEach(d => d.classList.toggle('this', d.dataset.id === id)); }
  function renderRace(sim, crew) {
    const running = sim.phase === 'reading' || sim.phase === 'writing' || sim.phase === 'done';
    let winner = null;
    sim.others.forEach(o => { if (o.p.fits && (!winner || o.p.totalS < winner.p.totalS)) winner = o; });
    sim.others.forEach(o => {
      const d = o.m.row, span = d.querySelector('.track span'), bar = d.querySelector('.track i');
      const p = o.p, t = sim.t;
      let txt = '', cls = '', w = 0, read = false;
      if (!p.fits) { txt = 'Doesn\'t fit: needs ' + fmtGB(p.needGB) + ' GB'; cls = 'bad'; }
      else if (!running) { txt = 'Fits, ' + fmtGB(p.needGB) + ' of ' + p.usable + ' GB'; }
      else if (t < p.readS) { txt = 'Reading ' + Math.floor(t / p.readS * 100) + '%'; w = t / p.readS; read = true; }
      else if (t < p.totalS) { const tok = (t - p.readS) * p.writeTps; txt = (crew > 1 ? fmtT(p.totalTps) + ' tok/s total, ' : fmtT(p.writeTps) + ' tok/s, ') + Math.floor(tok) + ' of ' + ANSWER; w = tok / ANSWER; }
      else { txt = 'Done in ' + fmtS(p.totalS); w = 1; cls = winner && winner.m.id === o.m.id ? 'win' : ''; if (cls) txt = 'First, ' + fmtS(p.totalS); }
      if (span.textContent !== txt) span.textContent = txt;
      span.className = cls; bar.style.width = (w * 100).toFixed(1) + '%'; bar.classList.toggle('read', read);
      const tag = d.querySelector('.top .meas'), src = p.fits && p.measured && p.source !== 'estimated' ? p.source : '';
      tag.hidden = !src;
      if (src && tag.textContent !== src) { tag.textContent = src; tag.classList.toggle('rep', src === 'reported'); }
    });
  }

  let toastT = 0;
  function toast(s) { const t = document.getElementById('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 4500); }

  /* ---------- hide interface, dialogs ---------- */
  function toggleUI() { document.body.classList.toggle('hide-ui'); DSP.engine.resize(); }
  DSP.actions.toggleUI = toggleUI;
  document.getElementById('hide-btn').addEventListener('click', toggleUI);
  document.getElementById('restore').addEventListener('click', toggleUI);
  const openDlg = d => { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); };
  document.getElementById('open-info').addEventListener('click', () => openDlg(document.getElementById('info')));
  document.getElementById('open-keys').addEventListener('click', () => openDlg(document.getElementById('keys-dlg')));

  DSP.ui = { pills, syncPills, ticks, buildRace, setRaceThis, renderRace, toast, toggleUI };
})(window.DSP = window.DSP || {});
