/* =========================================================
   MODEL: the speed model (HANDOFF "Speed model"), number formatting,
   and reading the data files. The math has no page and no three.js in it.
   ========================================================= */
(function (DSP) {
  'use strict';

  const ANSWER = 150;
  const pick = (list, id) => list.find(x => x.id === id);

  function calc(m, model, prec, prompt) {
    const weightsGB = model.total * prec.bpp;
    const kvGB = model.kvMB * (prompt.tokens + ANSWER) / 1024;
    const needGB = weightsGB + kvGB, usable = m.memGB - m.reserveGB, fits = needGB <= usable;
    const activeGB = model.active * prec.bpp;
    const avgKv = model.kvMB * (prompt.tokens + ANSWER / 2) / 1024;
    const writeTps = (model.moe ? 0.5 : 0.7) * m.bw / (activeGB + avgKv);
    const flops = 0.5 * m.tflops * 1e12;
    const readTps = flops / (2 * model.active * 1e9);
    const readS = prompt.tokens / readTps, writeS = ANSWER / writeTps;
    const busyWrite = Math.min(1, (2 * model.active * 1e9 / flops) * writeTps);
    const chunk = 512, readBytes = model.moe ? Math.min(weightsGB, activeGB * 8) : weightsGB;
    const busRead = Math.min(1, (readBytes / m.bw) / (2 * model.active * 1e9 * chunk / flops));
    return { weightsGB, kvGB, needGB, usable, fits, writeTps, readTps, readS, writeS, totalS: readS + writeS, busyWrite, busRead };
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

  DSP.model = { ANSWER, pick, calc, fmtS, fmtT, fmtGB, pct, plain, loadData };
})(window.DSP = window.DSP || {});
