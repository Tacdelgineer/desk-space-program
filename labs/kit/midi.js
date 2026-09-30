/* =========================================================
   MIDI: a hardware controller can drive the console, in browsers with Web MIDI (Chrome, Edge). The lab never asks
   for MIDI on its own: the MIDI button asks, or the page connects quietly when the browser already allowed it.
   Learn mode: press MIDI learn, touch a console control, then move a knob, fader or pad; each mapping is kept in this
   browser (localStorage). Without Web MIDI the button stays hidden and nothing here runs.
   ========================================================= */
(function (DSP) {
  'use strict';
  const supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  const KEY = 'dsp-midi-map-1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = map => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* private window: mappings last until reload */ } };

  // a message as { key, kind, v (0..1), raw, press, release }; key names the knob, fader or pad it came from
  function parse(d) {
    if (!d || d.length < 2) return null;
    const st = d[0] & 0xf0, ch = d[0] & 0x0f;
    if (st === 0xb0) return { key: 'cc:' + ch + ':' + d[1], kind: 'cc', raw: d[2], v: d[2] / 127 };
    if (st === 0x90 && d[2] > 0) return { key: 'note:' + ch + ':' + d[1], kind: 'note', v: d[2] / 127, press: true };
    if (st === 0x80 || st === 0x90) return { key: 'note:' + ch + ':' + d[1], kind: 'note', release: true };
    if (st === 0xe0) return { key: 'pb:' + ch, kind: 'pb', v: ((d[2] << 7) | d[1]) / 16383 };   // motor faders often send pitch bend
    return null;
  }
  // an endless encoder or jog sends small steps: 1..15 up and 127..113 down, or 65.. up and 63.. down around 64
  const isRelative = raw => raw !== 64 && (raw <= 8 || raw >= 120 || (raw >= 57 && raw <= 71));
  const step = raw => raw >= 57 && raw <= 71 ? raw - 64 : raw < 64 ? raw : raw - 128;
  const describe = m => m.kind === 'cc' ? 'knob CC ' + m.key.split(':')[2] : m.kind === 'pb' ? 'the pitch fader' : 'pad ' + m.key.split(':')[2];

  // o: { button, deck, toast }. Returns { pick(id, name) } for the console: the control touched in learn mode.
  function attach(o) {
    const btn = o.button, none = { pick() {}, supported: false };
    if (!supported || !btn) return none;
    btn.hidden = false;
    let access = null, learnOn = false, target = null;
    const map = load();
    const inputs = () => (access ? Array.from(access.inputs.values()) : []);
    function label() {
      const n = inputs().length;
      btn.textContent = !access ? 'MIDI' : !n ? 'MIDI: no controller' : learnOn ? 'MIDI learn: on' : 'MIDI learn';
      btn.setAttribute('aria-pressed', learnOn ? 'true' : 'false');
    }
    function listen() { inputs().forEach(i => { i.onmidimessage = onMessage; }); if (!inputs().length && learnOn) setLearn(false); label(); }
    function connect(quiet) {
      let p;
      try { p = navigator.requestMIDIAccess(); } catch (e) { if (!quiet) o.toast('MIDI is not available here.'); return; }
      p.then(a => {
        access = a; a.onstatechange = listen; listen();
        if (!quiet) o.toast(inputs().length ? 'MIDI connected: ' + inputs().map(i => i.name).join(', ') + '. Press MIDI learn to map its controls.' : 'No MIDI controller found. Plug one in and it shows up here.');
      }).catch(() => { if (!quiet) o.toast('The browser did not allow MIDI for this page.'); });
    }
    function setLearn(on) {
      learnOn = on; target = null; o.deck.learn(on); document.body.classList.toggle('midi-learn', on); label();
      if (on) o.toast('MIDI learn: touch a control on the console, then move a knob, fader or pad. Press MIDI learn again, or Esc, to finish.');
    }
    function onMessage(ev) {
      const m = parse(ev.data); if (!m) return;
      if (learnOn) {
        if (!target || m.release) return;
        map[m.key] = { id: target.id, rel: target.id === 'jog' && m.kind === 'cc' && isRelative(m.raw) };
        save(map); o.toast('Mapped ' + describe(m) + ' to ' + target.name + '. Touch another control, or press MIDI learn to finish.');
        target = null; return;
      }
      const hit = map[m.key]; if (!hit || m.release) return;
      if (hit.rel) o.deck.drive(hit.id, { delta: step(m.raw) });
      else o.deck.drive(hit.id, m.kind === 'note' ? { press: true, v: m.v } : { v: m.v });
    }
    btn.addEventListener('click', () => {
      if (!access) { connect(false); return; }
      if (!inputs().length) { o.toast('No MIDI controller found. Plug one in and it shows up here.'); return; }
      setLearn(!learnOn);
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && learnOn) setLearn(false); });
    // already allowed for this page: connect without asking
    try {
      if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'midi' }).then(r => { if (r.state === 'granted') connect(true); }, () => {});
    } catch (e) { /* this browser has no "midi" permission name */ }
    return { supported: true, pick(id, name) { if (!learnOn) return; target = { id, name }; o.toast('Now move a knob, fader or pad for ' + name + '.'); } };
  }

  DSP.midi = { supported, attach };
})(window.DSP = window.DSP || {});
