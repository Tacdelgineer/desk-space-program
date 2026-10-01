/* =========================================================
   DECK: the Mission Control console in front of the machine. A 1960s launch console crossed with a DJ controller,
   in the screenprint inks: five pads pick the machine, a long fader sets the model size (detents at the preset models),
   a jog wheel sets the crew (1-64, one lit block per request), a chunky lever sets the compression (16, 8, 4-bit),
   three switches pick the prompt, and the launch switch sits under a flip-up safety cover. On the meter bridge: needle
   gauges for GPU math used and the memory bus, a 7-segment tokens/s display and the LID key switch (open / closed).
   Every printed label has its own strip in front of or beside its control, never behind a tall one, so no switch,
   lamp, knob or cover covers it from the overview camera. The words are printed on their own layer, lifted a little
   off the paper (no flicker against it).
   Every control is grabbed through the engine's pointer layer (mouse, touch, pen), glows on hover and snaps with a
   spring. The deck knows nothing about the simulation: build(o) takes the lists and the handlers, set() shows a
   selection, show() the live numbers, drive() takes a MIDI message.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, rbox = P.rbox, std = E.std;
  const INK = '#1b1712', PAPER = '#efe5cf', SOFT = '#5a5144', RED = '#df3a2c', YEL = '#f2c230', TEAL = '#1f8783';
  const DISPLAY = '"Anton","Oswald","Impact","Arial Narrow",sans-serif', MONO = '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace', SANS = '"Archivo Narrow","Arial Narrow","Roboto Condensed",sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // A damped spring (x, v) pulled toward a target: stiff with a little overshoot, the thunk of a detent.
  function spring(s, target, dt, k, d) {
    k = k || 320; d = d || 22;
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * d) * h; s.x += s.v * h; }
    return s.x;
  }
  function seeded(n) { let s = n >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, E.renderer.capabilities.getMaxAnisotropy());
    const redraw = arg => { const x = c.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h, arg); t.needsUpdate = true; };
    redraw();
    return { t, redraw };
  }
  function paper(x, w, h, seed) {
    const rnd = seeded(seed);
    x.fillStyle = PAPER; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 70; i++) { x.fillStyle = 'rgba(27,23,18,' + (rnd() * 0.06).toFixed(3) + ')'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }
  function halftone(x, cx, cy, R, color, step) {
    x.fillStyle = color;
    for (let yy = cy - R; yy < cy + R; yy += step) for (let xx = cx - R; xx < cx + R; xx += step) {
      const d = Math.hypot(xx - cx, yy - cy) / R; if (d >= 1) continue;
      x.beginPath(); x.arc(xx, yy, step * 0.45 * (1 - d), 0, 7); x.fill();
    }
  }
  // Printed words on a canvas, in scene units: shrinks the type until the words fit maxW (the fallback fonts run wide).
  function printer(x, PXU, px, pz) {
    return (s, X, Z, size, font, color, align, base, maxW) => {
      let n = Math.round(size * PXU); x.font = font.replace('#', n + 'px');
      while (maxW && n > 8 && x.measureText(s).width > maxW * PXU) { n--; x.font = font.replace('#', n + 'px'); }
      x.fillStyle = color || INK; x.textAlign = align || 'left'; x.textBaseline = base || 'alphabetic';
      x.fillText(s, px(X), pz(Z));
      return x.measureText(s).width / PXU;
    };
  }
  // The words sit on their own transparent layer, lifted off the paper: the same ink-on-cream multiply as the paper,
  // drawn after it and nudged toward the camera, so the two never fight over the same depth.
  function inkMat(map, color) {
    const m = new T.MeshStandardMaterial({ map, color, roughness: 0.85, metalness: 0, envMapIntensity: 0.15, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    m.userData.envTuned = true; return m;
  }

  /* ---------- 7-segment digits: polygons in a 1 x 1.8 cell, slanted a little ---------- */
  const SEGS = (() => {
    const w = 1, h = 1.8, t = 0.18, g = 0.035, m = h / 2;
    const hz = y => [[t / 2 + g, y], [t + g, y - t / 2], [w - t - g, y - t / 2], [w - t / 2 - g, y], [w - t - g, y + t / 2], [t + g, y + t / 2]];
    const vt = (x, y0, y1) => [[x, y0 + t / 2 + g], [x + t / 2, y0 + t + g], [x + t / 2, y1 - t - g], [x, y1 - t / 2 - g], [x - t / 2, y1 - t - g], [x - t / 2, y0 + t + g]];
    return { a: hz(t / 2), g: hz(m), d: hz(h - t / 2), f: vt(t / 2, 0, m), b: vt(w - t / 2, 0, m), e: vt(t / 2, m, h), c: vt(w - t / 2, m, h) };
  })();
  const DIGITS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  // a number as 5 cells, right-aligned, with the decimal point on one digit: 13.2 -> "  132" + point after the 4th
  function cells(v) {
    if (v == null || !isFinite(v)) return { d: ' ----', dp: -1 };
    v = Math.min(99999, Math.max(0, v));
    const s = v < 100 ? v.toFixed(1) : String(Math.round(v)), i = s.indexOf('.');
    const digits = s.replace('.', ''), pad = 5 - digits.length;
    return { d: ' '.repeat(Math.max(0, pad)) + digits, dp: i < 0 ? -1 : pad + i - 1 };
  }

  function build(o) {
    // The layout, in deck units (x across, z toward the viewer). The overview camera looks down at about 50 degrees to
    // the deck and a little from the right, so anything tall hides the deck behind it and a little to its left: about
    // 0.8 of its height back. Every label is placed in front of, or right of, the controls near it.
    const L = {
      W: 30.4, D: 10.4, tilt: 0.175,
      box: {
        bits: [-14.95, -4.95, -12.25, 4.95], size: [-12.05, -4.95, 4.75, -0.35], mach: [-12.05, -0.15, -2.25, 4.95],
        prompt: [-2.05, -0.15, 4.75, 4.95], crew: [4.95, -4.95, 11.95, 4.95], launch: [12.15, -4.95, 14.95, 4.95]
      },
      lever: { x: -13.95, z: -0.3, arm: 2.55, at: [-0.62, 0, 0.62] },
      pads: { z: 2.1, pitch: 1.9, s: 1.55 },
      fader: { z: -2.7, x0: -10.45, x1: 3.35 },
      sw: { z: 2.3, pitch: 2.2 },
      jog: { x: 8.45, z: 0.45, r: 2.15, ring: 2.5, bezel: 2.75, num: 3.15, a0: 15 * Math.PI / 180, span: 330 * Math.PI / 180 },
      launch: { x: 13.55, hinge: -2.0 },
      armed: { x: 12.95, z: 1.95 }
    };
    const mid = b => (b[0] + b[2]) / 2;
    const padX = i => mid(L.box.mach) + (i - (o.machines.length - 1) / 2) * L.pads.pitch;
    const swX = i => mid(L.box.prompt) + (i - (o.prompts.length - 1) / 2) * L.sw.pitch;
    const PXU = 80, crewMax = o.crewMax || 64;
    const root = new T.Group(); root.position.set(...o.at); root.scale.setScalar(o.scale || 1); E.scene.add(root);
    const blockers = [], ctl = {}, order = [];
    const put = (parent, geo, mat, x, y, z, cast) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = cast !== false; m.receiveShadow = true; parent.add(m); return m; };
    const hitM = new T.MeshBasicMaterial({ visible: false });
    const proxy = (parent, w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), hitM); m.position.set(x, y, z); parent.add(m); return m; };

    /* ---------- materials: ink-black body, red cheeks, chrome, the four inks ---------- */
    const M = {
      body: std(0x221d18, 0.5, 0.25, { envMapIntensity: 0.5 }),
      kick: std(0x0d0c0b, 0.7, 0.1),
      cheek: new T.MeshPhysicalMaterial({ color: 0xc2302a, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      black: std(0x121110, 0.55, 0.2),
      chrome: std(0xdfe3ea, 0.16, 1, { envMapIntensity: 1.1 }),
      rubber: std(0x0b0b0b, 0.85, 0),
      // glossy plastics without clearcoat: a clearcoat mirrors the studio's bright ceiling and turns them white from above
      // darker than the inks they stand for: the key light is tuned for dark boards and would print them near white
      red: std(0x8e1a14, 0.5, 0.05, { envMapIntensity: 0.3 }),
      yellow: std(0xa47208, 0.5, 0.05, { envMapIntensity: 0.3 }),
      brass: std(0x5e4512, 0.4, 0.85, { envMapIntensity: 0.45 }),
      gun: std(0x2c2c30, 0.38, 0.8, { envMapIntensity: 0.35 })
    };
    [M.chrome, M.red, M.yellow, M.brass, M.gun].forEach(m => { m.userData.envTuned = true; });
    // the body's top sits right under the printed plate: cast shadows from its back faces, or the plate gets striped
    [M.body, M.kick].forEach(m => { m.shadowSide = T.BackSide; });

    /* ---------- body: a wedge desk with red end cheeks, a black kick plate, a chrome lip, and the meter bridge ---------- */
    const cosT = Math.cos(L.tilt), sinT = Math.sin(L.tilt);
    const zc = 0.9, yc = 1.84, halfD = L.D / 2;
    const front = { z: zc + halfD * cosT, y: yc - halfD * sinT }, back = { z: zc - halfD * cosT, y: yc + halfD * sinT };
    const profile = (pts, depth, bevel) => {
      const s = new T.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y)); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: depth - 2 * (bevel || 0), bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 3 });
      g.rotateY(-Math.PI / 2); g.translate(depth / 2 - (bevel || 0), 0, 0); return g;   // shape x -> world z, extrusion -> world -x, centred
    };
    const wedge = put(root, profile([[front.z, 0.35], [front.z, front.y - 0.03], [back.z, back.y - 0.03], [back.z, 0.35]], L.W, 0), M.body, 0, 0, 0);
    const kick = put(root, new T.BoxGeometry(L.W + 0.4, 0.36, front.z - back.z - 0.5), M.kick, 0, 0.18, (front.z + back.z) / 2 - 0.1);
    const cheekPts = [[front.z + 0.2, 0], [front.z + 0.2, front.y + 0.28], [back.z - 0.15, back.y + 0.32], [back.z - 0.15, 0]];
    const cheeks = [-1, 1].map(s => put(root, profile(cheekPts, 0.6, 0.1), M.cheek, s * (L.W / 2 + 0.3), 0, 0));
    const lip = put(root, new T.CylinderGeometry(0.07, 0.07, L.W, 12), M.chrome, 0, front.y - 0.02, front.z);
    lip.rotation.z = Math.PI / 2;
    // meter bridge: a face at 52 degrees, facing the camera
    const BR = { w: 26, h: 4.6, ang: 52 * Math.PI / 180, z0: back.z, y0: back.y - 0.08 };
    const bTop = { z: BR.z0 - BR.h * Math.cos(BR.ang), y: BR.y0 + BR.h * Math.sin(BR.ang) };
    const bridgeBody = put(root, profile([[BR.z0, 0.35], [BR.z0, BR.y0], [bTop.z, bTop.y], [bTop.z - 0.7, bTop.y], [bTop.z - 0.7, 0.35]], BR.w, 0.08), M.body, 0, 0, 0);
    const bridgeKick = put(root, new T.BoxGeometry(BR.w, 0.36, BR.z0 - bTop.z + 0.5), M.kick, 0, 0.18, (BR.z0 + bTop.z - 0.7) / 2);
    blockers.push(wedge, kick, bridgeBody, bridgeKick, lip, ...cheeks);
    const bridge = new T.Group();
    bridge.position.set(0, (BR.y0 + bTop.y) / 2, (BR.z0 + bTop.z) / 2).addScaledVector(new T.Vector3(0, Math.cos(BR.ang), Math.sin(BR.ang)), 0.1);   // in front of the body's bevel
    bridge.rotation.x = -(Math.PI / 2 - BR.ang); root.add(bridge);

    // the deck surface frame: x across, z toward the viewer, y out of the surface
    const deck = new T.Group(); deck.position.set(0, yc, zc); deck.rotation.x = L.tilt; root.add(deck);
    const deckPlane = () => new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new T.Quaternion())), deck.getWorldPosition(new T.Vector3()));

    /* ---------- the printed deck plate: paper and halftones on the plate, the ink (boxes, scales, words) on the layer above ---------- */
    const px = x => (x + L.W / 2) * PXU, pz = z => (z + L.D / 2) * PXU;
    const fadeT = t => L.fader.x0 + t * (L.fader.x1 - L.fader.x0);
    const jogAngle = n => L.jog.a0 + (n - 1) / (crewMax - 1) * L.jog.span;   // clockwise from the back, seen from above
    const TITLE = '400 # ' + DISPLAY, NAME = '700 # ' + SANS, NUM = '500 # ' + MONO;
    const box = (x, b, lw) => { x.lineWidth = lw || 4; x.strokeStyle = INK; x.strokeRect(px(b[0]), pz(b[1]), px(b[2]) - px(b[0]), pz(b[3]) - pz(b[1])); };
    const hz = [L.launch.x - 1.15, L.launch.hinge - 0.15, L.launch.x + 1.15, L.launch.hinge + 3.25];   // the hazard field under the cover
    const deckPaper = canvasTexture(Math.round(L.W * PXU), Math.round(L.D * PXU), (x, w, h) => {
      paper(x, w, h, 3);
      halftone(x, w - 40, 40, 300, 'rgba(31,135,131,.55)', 14);
      halftone(x, 40, h - 30, 230, 'rgba(242,194,48,.8)', 14);
      x.fillStyle = YEL; x.fillRect(px(hz[0]), pz(hz[1]), px(hz[2]) - px(hz[0]), pz(hz[3]) - pz(hz[1]));
    });
    const deckInk = canvasTexture(Math.round(L.W * PXU), Math.round(L.D * PXU), (x, w, h) => {
      const text = printer(x, PXU, px, pz);
      x.lineWidth = 7; x.strokeStyle = INK; x.strokeRect(10, 10, w - 20, h - 20);
      Object.values(L.box).forEach(b => box(x, b));
      // BITS: 16, 8 and 4 to the right of the lever's slot (the knob hides the deck to its left), the title in front
      const B = L.box.bits;
      L.lever.at.forEach((a, i) => {
        const z = L.lever.z + L.lever.arm * Math.sin(a);
        x.fillStyle = INK; x.fillRect(px(L.lever.x + 0.58), pz(z) - 3, px(L.lever.x + 0.82) - px(L.lever.x + 0.58), 6);
        text(['16', '8', '4'][i], L.lever.x + 0.95, z, 0.5, TITLE, INK, 'left', 'middle');
      });
      text('BITS', mid(B), B[3] - 0.5, 0.55, TITLE, INK, 'center');
      // MODEL SIZE: the title row at the back clears the cap's shadow; every name sits in front of the track,
      // dense models (and the 1B / 3T ends) in the first row, mixture-of-experts ones in teal in the second
      const S = L.box.size, zf = L.fader.z;
      const tw = text('MODEL SIZE', S[0] + 0.2, S[1] + 0.62, 0.5, TITLE);
      text('BILLIONS OF PARAMETERS', S[0] + 0.55 + tw, S[1] + 0.62, 0.36, NUM, SOFT);
      x.fillStyle = 'rgba(27,23,18,.35)'; x.fillRect(px(L.fader.x0), pz(zf) - 2, px(L.fader.x1) - px(L.fader.x0), 4);
      for (let i = 0; i <= 40; i++) { const X = fadeT(i / 40); x.fillStyle = INK; x.fillRect(px(X) - 1.5, pz(zf + 0.82), 3, (i % 5 ? 0.12 : 0.22) * PXU); }
      const rowA = zf + 1.5, rowB = zf + 2.05, NS = 0.42;
      const moe = o.models.filter(m => m.moe), dense = o.models.filter(m => !m.moe);
      // the teal row: each name centred under its detent, then pushed apart until none touch; a slanted leader finds it
      x.font = NAME.replace('#', Math.round(NS * PXU) + 'px');
      const tags = moe.map(m => ({ m, X: fadeT(m.t), c: fadeT(m.t), w: Math.min(2.6, x.measureText(m.label).width / PXU) })).sort((a, b) => a.X - b.X);
      for (let it = 0; it < 20; it++) for (let i = 1; i < tags.length; i++) {
        const a = tags[i - 1], b = tags[i], over = (a.c + a.w / 2 + 0.3) - (b.c - b.w / 2);
        if (over > 0) { a.c -= over / 2; b.c += over / 2; }
      }
      tags.forEach(t => {
        x.strokeStyle = TEAL; x.lineWidth = 5; x.beginPath(); x.moveTo(px(t.X), pz(zf + 0.82)); x.lineTo(px(t.X), pz(rowA - 0.2)); x.lineTo(px(t.c), pz(rowB - NS * 0.8)); x.stroke();
        text(t.m.label, t.c, rowB, NS, NAME, TEAL, 'center', 'alphabetic', 2.6);
      });
      const rowAItems = dense.map(m => ({ s: m.label, X: fadeT(m.t), lead: true })).concat([{ s: '1B', X: L.fader.x0 }, { s: '3T', X: L.fader.x1 }]);
      rowAItems.forEach(it => {
        x.font = NAME.replace('#', Math.round(NS * PXU) + 'px');
        const w2 = Math.min(2.6, x.measureText(it.s).width / PXU) / 2;
        let c = it.X;
        moe.forEach(m => { const lx = fadeT(m.t); if (Math.abs(lx - c) < w2 + 0.16) c = lx > c ? lx - w2 - 0.16 : lx + w2 + 0.16; });   // clear the teal leaders
        if (it.lead) { x.fillStyle = INK; x.fillRect(px(it.X) - 2.5, pz(zf + 0.82), 5, (rowA - NS * 0.75 - zf - 0.9) * PXU); }
        text(it.s, c, rowA, it.lead ? NS : 0.38, it.lead ? NAME : NUM, it.lead ? INK : SOFT, 'center', 'alphabetic', 2.6);
      });
      // MACHINE: the title clears the pads' shadow; each name in two lines under its pad
      const Mb = L.box.mach;
      text('MACHINE', Mb[0] + 0.2, Mb[1] + 0.65, 0.5, TITLE);
      o.machines.forEach((m, i) => {
        const s = m.short.toUpperCase(), cut = s.lastIndexOf(' '), lines = cut > 0 ? [s.slice(0, cut), s.slice(cut + 1)] : [s];
        lines.forEach((ln, j) => text(ln, padX(i), L.pads.z + 1.72 + j * 0.52, 0.42, NAME, INK, 'center', 'alphabetic', L.pads.pitch - 0.2));
      });
      // PROMPT: the switches stand far enough forward that the title behind them stays clear; name and length in front of each lamp
      const Pb = L.box.prompt;
      text('PROMPT', Pb[0] + 0.2, Pb[1] + 0.65, 0.5, TITLE);
      o.prompts.forEach((p, i) => {
        text(p.short.toUpperCase(), swX(i), L.sw.z + 1.85, 0.42, NAME, INK, 'center', 'alphabetic', L.sw.pitch - 0.2);
        text(p.tokens.toLocaleString('en-US') + ' TOK', swX(i), L.sw.z + 2.38, 0.36, NUM, SOFT, 'center', 'alphabetic', L.sw.pitch - 0.2);
      });
      // CREW: numbers in a ring outside the wheel, inside the box (the launch cover's shadow ends left of it)
      const C = L.box.crew;
      text('CREW', C[0] + 0.2, C[1] + 0.65, 0.5, TITLE);
      text('REQUESTS', C[2] - 0.2, C[1] + 0.45, 0.36, NUM, SOFT, 'right');
      text('AT ONCE', C[2] - 0.2, C[1] + 0.9, 0.36, NUM, SOFT, 'right');
      [1, 8, 16, 24, 32, 40, 48, 56, 64].forEach(n => {
        const a = jogAngle(n), r = L.jog.num;
        text(String(n), L.jog.x + Math.sin(a) * r, L.jog.z - Math.cos(a) * r, 0.4, NUM, INK, 'center', 'middle');
      });
      // LAUNCH: hazard stripes under the cover; the ARMED lamp, the title and the how-to all in front of it
      const Lb = L.box.launch;
      x.save(); x.beginPath(); x.rect(px(hz[0]), pz(hz[1]), px(hz[2]) - px(hz[0]), pz(hz[3]) - pz(hz[1])); x.clip();
      x.fillStyle = INK; for (let i = -20; i < 40; i++) { const x0 = px(hz[0]) + i * 26; x.beginPath(); x.moveTo(x0, pz(hz[1])); x.lineTo(x0 + 13, pz(hz[1])); x.lineTo(x0 + 13 + 320, pz(hz[3])); x.lineTo(x0 + 320, pz(hz[3])); x.fill(); }
      x.restore();
      text('ARMED', L.armed.x + 0.42, L.armed.z, 0.36, NUM, INK, 'left', 'middle', 1.5);
      text('LAUNCH', mid(Lb), L.armed.z + 1.35, 0.6, TITLE, RED, 'center', 'alphabetic', 2.5);
      text('LIFT COVER', mid(Lb), L.armed.z + 1.95, 0.35, NUM, SOFT, 'center', 'alphabetic', 2.5);
      text('THEN FLIP', mid(Lb), L.armed.z + 2.42, 0.35, NUM, SOFT, 'center', 'alphabetic', 2.5);
    });
    // printed paper under the stage's strong key light: a darker ink-on-cream albedo keeps it cream on screen, not white
    const plateM = new T.MeshStandardMaterial({ map: deckPaper.t, color: 0x6e6a62, roughness: 0.85, metalness: 0, envMapIntensity: 0.15 });
    plateM.userData.envTuned = true;
    const plateMesh = put(deck, new T.PlaneGeometry(L.W, L.D), plateM, 0, 0.01, 0, false); plateMesh.rotation.x = -Math.PI / 2;
    const inkMesh = put(deck, new T.PlaneGeometry(L.W, L.D), inkMat(deckInk.t, 0x6e6a62), 0, 0.035, 0, false); inkMesh.rotation.x = -Math.PI / 2;
    blockers.push(plateMesh);

    // the bridge face: gauges and the display in a row, every label in one strip along the bottom, the LID key at the right end
    const BL = { y: 0.4, strip: -1.72, gauge: 6.6, key: 10.4 };
    const bpx = X => (X + BR.w / 2) * PXU, bpy = Y => (BR.h / 2 - Y) * PXU;
    const bridgePaper = canvasTexture(Math.round(BR.w * PXU), Math.round(BR.h * PXU), (x, w, h) => {
      paper(x, w, h, 9);
      halftone(x, w - 30, 30, 200, 'rgba(223,58,44,.45)', 13);
      halftone(x, 30, h - 30, 170, 'rgba(31,135,131,.4)', 13);
    });
    const bridgeInk = canvasTexture(Math.round(BR.w * PXU), Math.round(BR.h * PXU), (x, w, h) => {
      const text = printer(x, PXU, bpx, bpy);
      x.lineWidth = 7; x.strokeStyle = INK; x.strokeRect(10, 10, w - 20, h - 20);
      x.lineWidth = 3; x.strokeRect(22, 22, w - 44, h - 44);
      text('GPU MATH USED', -BL.gauge, BL.strip, 0.48, TITLE, INK, 'center', 'alphabetic', 3.4);
      text('TOKENS PER SECOND', 0, BL.strip, 0.46, NUM, INK, 'center', 'alphabetic', 7);
      text('MEMORY BUS BUSY', BL.gauge, BL.strip, 0.48, TITLE, INK, 'center', 'alphabetic', 3.4);
      text('LID', BL.key, BL.strip, 0.5, TITLE, INK, 'center');
      text('CLOSED', BL.key - 0.6, BL.y + 1.22, 0.4, NUM, INK, 'right', 'alphabetic', 1.55);
      text('OPEN', BL.key + 0.6, BL.y + 1.22, 0.4, NUM, INK, 'left', 'alphabetic', 1.55);
      x.strokeStyle = INK; x.lineWidth = 5;
      [-1, 1].forEach(s => { const a = s * KEY_A; x.beginPath(); x.moveTo(bpx(BL.key - Math.sin(a) * 0.72), bpy(BL.y + Math.cos(a) * 0.72)); x.lineTo(bpx(BL.key - Math.sin(a) * 0.95), bpy(BL.y + Math.cos(a) * 0.95)); x.stroke(); });
      text('DESK SPACE PROGRAM', -10.4, BL.y + 0.15, 0.3, NUM, SOFT, 'center', 'alphabetic', 3.6);
      text('MISSION CONTROL', -10.4, BL.y - 0.55, 0.62, TITLE, RED, 'center', 'alphabetic', 3.6);
    });
    const bridgeM = new T.MeshStandardMaterial({ map: bridgePaper.t, color: 0x7a766e, roughness: 0.85, metalness: 0, envMapIntensity: 0.15 });
    bridgeM.userData.envTuned = true;
    const bridgeFace = put(bridge, new T.PlaneGeometry(BR.w, BR.h), bridgeM, 0, 0, 0, false);
    put(bridge, new T.PlaneGeometry(BR.w, BR.h), inkMat(bridgeInk.t, 0x7a766e), 0, 0, 0.025, false);
    blockers.push(bridgeFace);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const b = put(bridge, new T.CylinderGeometry(0.12, 0.12, 0.08, 12), M.chrome, sx * (BR.w / 2 - 0.35), sy * (BR.h / 2 - 0.35), 0.04); b.rotation.x = Math.PI / 2; });

    /* ---------- a control: glow on hover, pulse in MIDI learn, the materials that show it ---------- */
    let learnOn = false, learnPicked = null;
    function control(id, name, meshes, mats, h) {
      const c = Object.assign({ id, name, glow: { x: 0, v: 0 }, hot: false, mats, base: mats.map(m => (m.emissive ? m.emissive.clone() : new T.Color(0x000000))) }, h);
      E.grab({
        meshes, cursor: h.cursor || 'pointer',
        enabled: () => root.visible && (!c.enabled || c.enabled()),
        hover: on => { c.hot = on; },
        down: p => { if (learnOn) { learnPicked = id; if (o.on.learnPick) o.on.learnPick(id, name); return; } if (c.down) c.down(p); },
        move: p => { if (!learnOn && c.move) c.move(p); },
        up: p => { if (!learnOn && c.up) c.up(p); },
        wheel: dir => { if (!learnOn && c.wheel) c.wheel(dir); }
      });
      c.meshes = meshes; ctl[id] = c; order.push(c); return c;
    }
    const HOT = new T.Color(0.8, 0.6, 0.14), LEARN = new T.Color(0.1, 0.55, 0.5), tmpC = new T.Color();
    const screen = p => E.toScreen(p, null, root);   // where a point on the console is on the screen (the console may have its own camera)

    /* ---------- machine pads ---------- */
    const padsSel = { i: 0 };
    o.machines.forEach((m, i) => {
      const x = padX(i);
      put(deck, rbox(L.pads.s + 0.24, 0.14, L.pads.s + 0.24, 0.12), M.black, x, 0.07, L.pads.z);
      const g = new T.Group(); g.position.set(x, 0.12, L.pads.z); deck.add(g);
      const mat = std(0x2e2c2a, 0.72, 0.05); mat.emissive = new T.Color(0x000000);
      const pad = put(g, rbox(L.pads.s, 0.34, L.pads.s, 0.15), mat, 0, 0.17, 0);
      const press = { x: 0, v: 0 };
      const c = control('pad' + i, m.short, [pad], [mat], {
        down: () => { c.pressed = true; o.on.machine(m.id); },
        up: () => { c.pressed = false; },
        tap: () => { c.tapT = 0.14; },
        tick(dt) {
          if (c.tapT > 0) c.tapT -= dt;
          g.position.y = 0.12 - 0.13 * spring(press, c.pressed || c.tapT > 0 ? 1 : 0, dt, 700, 30);
          const lit = padsSel.i === i;
          c.base[0].setRGB(lit ? 0.62 : 0, lit ? 0.38 : 0, lit ? 0.02 : 0);
          mat.color.setHex(lit ? 0x9a6a06 : 0x2e2c2a);
        }
      });
    });

    /* ---------- model-size fader: a yellow cap on a long track; detents at the presets pull the cap in ---------- */
    const fader = { t: 0.4, shown: { x: 0.4, v: 0 }, drag: false, grabDx: 0, detent: null };
    put(deck, new T.BoxGeometry(L.fader.x1 - L.fader.x0 + 0.7, 0.05, 0.36), M.rubber, (L.fader.x0 + L.fader.x1) / 2, 0.02, L.fader.z, false);
    [-0.24, 0.24].forEach(dz => put(deck, new T.BoxGeometry(L.fader.x1 - L.fader.x0 + 0.7, 0.04, 0.05), M.chrome, (L.fader.x0 + L.fader.x1) / 2, 0.03, L.fader.z + dz, false));
    const capG = new T.Group(); capG.position.set(fadeT(0.4), 0, L.fader.z); deck.add(capG);
    const capM = M.yellow.clone(); capM.emissive = new T.Color(0x000000);
    const cap = put(capG, rbox(1.0, 0.62, 1.5, 0.14), capM, 0, 0.42, 0);
    put(capG, new T.BoxGeometry(0.2, 0.2, 0.3), M.black, 0, 0.1, 0);
    put(capG, new T.BoxGeometry(1.02, 0.05, 0.13), M.black, 0, 0.72, 0, false);
    [-0.34, 0.34].forEach(dz => put(capG, new T.BoxGeometry(1.02, 0.035, 0.07), M.black, 0, 0.72, dz, false));
    const faderHit = proxy(deck, L.fader.x1 - L.fader.x0 + 1.4, 1.2, 1.9, (L.fader.x0 + L.fader.x1) / 2, 0.5, L.fader.z);
    const detents = o.models.map(m => ({ t: m.t, id: m.id }));
    const snapT = t => { const d = detents.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a); return Math.abs(d.t - t) < 0.018 ? d : null; };
    const tAtPointer = p => {
      const a = screen(deck.localToWorld(new T.Vector3(L.fader.x0, 0.4, L.fader.z))), b = screen(deck.localToWorld(new T.Vector3(L.fader.x1, 0.4, L.fader.z)));
      const dx = b.x - a.x, dy = b.y - a.y;
      return ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    };
    function faderTo(t, final) {
      const d = snapT(t);
      fader.t = d ? d.t : clamp(t, 0, 1);
      if (d !== fader.detent || !d || final) { fader.detent = d; o.on.size(fader.t, d ? d.id : null, !!final); }
    }
    const cFader = control('fader', 'Model size', [cap, faderHit], [capM], {
      cursor: 'grab',
      down: p => { fader.drag = true; const t = tAtPointer(p); fader.grabDx = p.hit && p.hit.object === cap ? fader.t - t : 0; faderTo(t + fader.grabDx); },
      move: p => { faderTo(tAtPointer(p) + fader.grabDx); },
      up: () => { fader.drag = false; faderTo(fader.t, true); },
      wheel: dir => { const next = dir > 0 ? detents.filter(d => d.t > fader.t + 0.002).sort((a, b) => a.t - b.t)[0] : detents.filter(d => d.t < fader.t - 0.002).sort((a, b) => b.t - a.t)[0]; if (next) faderTo(next.t, true); },
      tick(dt) { capG.position.x = fadeT(spring(fader.shown, fader.t, dt, fader.drag ? 2400 : 500, fader.drag ? 90 : 34)); capG.position.y = fader.drag ? -0.04 : 0; }
    });

    /* ---------- crew jog wheel: one lit block per request, 1 at the top left, 64 at the top right ---------- */
    const jog = { n: 1, cont: 1, shown: { x: 1, v: 0 }, drag: false, lastA: 0, gpu: Infinity, mem: Infinity };
    const jg = new T.Group(); jg.position.set(L.jog.x, 0, L.jog.z); deck.add(jg);
    put(jg, new T.CylinderGeometry(L.jog.bezel, L.jog.bezel + 0.08, 0.18, 72), M.black, 0, 0.09, 0);
    const leds = new T.InstancedMesh(new T.BoxGeometry(0.1, 0.05, 0.26), new T.MeshBasicMaterial({ color: 0xffffff }), crewMax);
    const ob = new T.Object3D();
    for (let n = 1; n <= crewMax; n++) {
      const a = jogAngle(n); ob.position.set(Math.sin(a) * L.jog.ring, 0.19, -Math.cos(a) * L.jog.ring); ob.rotation.set(0, -a, 0); ob.updateMatrix();
      leds.setMatrixAt(n - 1, ob.matrix); leds.setColorAt(n - 1, new T.Color(0.05, 0.05, 0.05));
    }
    jg.add(leds);
    const platterG = new T.Group(); platterG.position.y = 0.2; jg.add(platterG);
    const vinyl = canvasTexture(512, 512, (x, w) => {
      x.fillStyle = '#121212'; x.fillRect(0, 0, w, w);
      for (let r = 60; r < 250; r += 5) { x.strokeStyle = 'rgba(255,255,255,' + (r % 25 ? 0.035 : 0.09) + ')'; x.lineWidth = 1.6; x.beginPath(); x.arc(w / 2, w / 2, r, 0, 7); x.stroke(); }
      x.fillStyle = '#e6dcc4'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; x.beginPath(); x.arc(w / 2 + Math.cos(a) * 238, w / 2 + Math.sin(a) * 238, 4.5, 0, 7); x.fill(); }
    });
    const platterM = std(0xffffff, 0.35, 0.3, { map: vinyl.t }); platterM.emissive = new T.Color(0x000000);
    const platter = put(platterG, new T.CylinderGeometry(L.jog.r, L.jog.r, 0.3, 72), [std(0x1a1a1a, 0.4, 0.6), platterM, M.black], 0, 0.15, 0);
    const marker = put(platterG, new T.CylinderGeometry(0.2, 0.2, 0.06, 20), M.yellow, 0, 0.33, -(L.jog.r - 0.38));
    const capTex = canvasTexture(256, 256, (x, w, h, n) => {
      x.fillStyle = '#1b1712'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c9bea6'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = '500 34px ' + MONO; x.fillText('CREW', w / 2, 74);
      x.fillStyle = YEL; x.font = '400 118px ' + DISPLAY; x.fillText(String(n || 1), w / 2, 198);
    });
    put(jg, new T.CylinderGeometry(0.95, 0.95, 0.1, 48), M.black, 0, 0.56, 0);
    const capFace = put(jg, new T.CircleGeometry(0.88, 48), new T.MeshBasicMaterial({ map: capTex.t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 0, 0.635, 0, false); capFace.rotation.x = -Math.PI / 2;
    const jogHit = new T.Mesh(new T.CylinderGeometry(L.jog.bezel + 0.2, L.jog.bezel + 0.2, 0.9, 32), hitM); jogHit.position.y = 0.4; jg.add(jogHit);
    const angleAt = p => { const w = E.hitPlane(p.ray, deckPlane()); if (!w) return null; const l = jg.worldToLocal(w); return Math.atan2(l.x, -l.z); };
    function crewTo(v, final) {
      jog.cont = clamp(v, 1, crewMax);
      const n = Math.round(jog.cont);
      if (n !== jog.n || final) { jog.n = n; o.on.crew(n, !!final); capTex.redraw(n); }
    }
    control('jog', 'Crew', [platter, marker, capFace, jogHit], [platterM], {
      cursor: 'grab',
      down: p => { jog.drag = true; jog.lastA = angleAt(p); },
      move: p => {
        const a = angleAt(p); if (a == null || jog.lastA == null) { jog.lastA = a; return; }
        let d = a - jog.lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        jog.lastA = a; crewTo(jog.cont + d / L.jog.span * (crewMax - 1));
      },
      up: () => { jog.drag = false; crewTo(Math.round(jog.cont), true); },
      wheel: dir => crewTo(jog.n + dir, true),
      tick(dt) {
        const n = jog.drag ? jog.cont : spring(jog.shown, jog.n, dt, 420, 26);
        if (jog.drag) { jog.shown.x = jog.cont; jog.shown.v = 0; }
        platterG.rotation.y = -jogAngle(n);
      }
    });
    const ledCol = new T.Color();
    function paintLeds() {
      for (let n = 1; n <= crewMax; n++) {
        const lit = n <= jog.n, over = n > jog.mem, maxed = n >= jog.gpu;
        if (lit) ledCol.setRGB(...(over ? [1.4, 0.1, 0.55] : maxed ? [1.7, 0.42, 0.12] : [0.12, 1.25, 1.05]));
        else ledCol.setRGB(...(over ? [0.22, 0.02, 0.09] : n === Math.ceil(jog.gpu) ? [0.5, 0.12, 0.05] : [0.06, 0.06, 0.06]));
        leds.setColorAt(n - 1, ledCol);
      }
      leds.instanceColor.needsUpdate = true;
    }

    /* ---------- compression lever: 16-bit leaning back, 8 upright, 4 toward you, with a notch at each ---------- */
    const lever = { i: 2, a: { x: L.lever.at[2], v: 0 }, drag: false, target: L.lever.at[2] };
    put(deck, rbox(1.05, 0.26, 5.6, 0.1), M.black, L.lever.x, 0.13, L.lever.z);
    put(deck, new T.BoxGeometry(0.24, 0.02, 4.8), M.rubber, L.lever.x, 0.27, L.lever.z, false);
    L.lever.at.forEach(a => put(deck, new T.BoxGeometry(0.62, 0.05, 0.1), M.chrome, L.lever.x, 0.28, L.lever.z + Math.sin(a) * L.lever.arm, false));
    const pivot = new T.Group(); pivot.position.set(L.lever.x, 0.34, L.lever.z); deck.add(pivot);
    const hub = put(pivot, new T.CylinderGeometry(0.34, 0.34, 0.86, 24), M.black, 0, 0, 0, false); hub.rotation.z = Math.PI / 2;
    // the arm and the knob cast no shadow: the key light comes from the front left and would lay it across the 16, 8 and 4
    const leverArm = put(pivot, new T.CylinderGeometry(0.11, 0.13, L.lever.arm - 0.3, 16), M.chrome, 0, (L.lever.arm - 0.3) / 2 + 0.1, 0, false);
    put(pivot, new T.CylinderGeometry(0.19, 0.19, 0.3, 16), M.rubber, 0, L.lever.arm - 0.35, 0, false);
    const knobM = M.red.clone(); knobM.emissive = new T.Color(0x000000);
    const knob = put(pivot, new T.SphereGeometry(0.5, 32, 20), knobM, 0, L.lever.arm, 0, false);
    const leverHit = proxy(pivot, 1.3, L.lever.arm + 0.8, 1.3, 0, (L.lever.arm + 0.8) / 2, 0);
    const leverPath = p => {
      // the knob's path on screen, sampled; the closest point to the pointer gives the angle
      let best = null;
      for (let i = 0; i <= 34; i++) {
        const a = -0.85 + i / 34 * 1.7;
        const w = deck.localToWorld(new T.Vector3(L.lever.x, 0.34 + Math.cos(a) * L.lever.arm, L.lever.z + Math.sin(a) * L.lever.arm)), s = screen(w);
        const d = Math.hypot(s.x - p.x, s.y - p.y); if (!best || d < best.d) best = { d, a };
      }
      return best.a;
    };
    function leverTo(i, final) { i = clamp(i, 0, 2); if (i !== lever.i || final) { lever.i = i; o.on.prec(o.precs[i].id); } lever.target = L.lever.at[i]; }
    control('lever', 'Compression', [knob, leverArm, leverHit], [knobM], {
      cursor: 'grab',
      down: p => { lever.drag = true; lever.down = lever.i; },
      move: p => {
        let a = leverPath(p);
        const near = L.lever.at.reduce((b, x, i) => Math.abs(x - a) < Math.abs(L.lever.at[b] - a) ? i : b, 0);
        if (Math.abs(L.lever.at[near] - a) < 0.12) a = L.lever.at[near];   // the notch pulls the lever in
        lever.target = a; if (near !== lever.i) leverTo(near);
      },
      up: p => { lever.drag = false; if (!p.moved) leverTo((lever.down + 1) % 3, true); else leverTo(lever.i, true); },
      wheel: dir => leverTo(lever.i + (dir > 0 ? -1 : 1), true),
      tick(dt) { pivot.rotation.x = lever.drag ? (lever.a.x = lever.target, lever.a.v = 0, lever.target) : spring(lever.a, lever.target, dt, 380, 16); }
    });

    /* ---------- prompt switches: short bat-handle toggles, one on at a time, a jewel lamp in front of each ---------- */
    const sws = o.prompts.map((pr, i) => {
      const x = swX(i), z = L.sw.z;
      put(deck, rbox(1.1, 0.08, 1.1, 0.08), M.black, x, 0.04, z);
      put(deck, new T.CylinderGeometry(0.32, 0.32, 0.2, 6), M.chrome, x, 0.16, z);
      const bat = new T.Group(); bat.position.set(x, 0.24, z); deck.add(bat);
      const batM = M.chrome.clone(); batM.emissive = new T.Color(0x000000);
      put(bat, new T.CylinderGeometry(0.11, 0.17, 0.95, 18), batM, 0, 0.475, 0);
      put(bat, new T.SphereGeometry(0.21, 20, 14), batM, 0, 0.97, 0);
      put(deck, new T.CylinderGeometry(0.34, 0.34, 0.08, 24), M.chrome, x, 0.04, z + 1.0);
      const lampM = new T.MeshBasicMaterial({ color: 0xffffff });
      const lamp = put(deck, new T.SphereGeometry(0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampM, x, 0.08, z + 1.0, false);
      const hit = proxy(deck, 1.6, 1.6, 2.2, x, 0.7, z + 0.2);
      const s = { on: false, a: { x: 0.5, v: 0 }, lamp: lampM };
      control('sw' + i, pr.short, [hit, lamp], [batM], {
        down: () => { o.on.prompt(pr.id); },
        tick(dt) { bat.rotation.x = spring(s.a, s.on ? -0.5 : 0.5, dt, 520, 18); lampM.color.setRGB(...(s.on ? [0.15, 1.45, 1.25] : [0.05, 0.13, 0.12])); }
      });
      return s;
    });

    /* ---------- launch: a toggle under a red flip-up cover, the ARMED lamp in front of it ---------- */
    const LX = L.launch.x, LH = L.launch.hinge, LS = LH + 1.6;   // the switch sits 1.6 in front of the cover's hinge
    put(deck, rbox(2.1, 0.18, 3.6, 0.08), M.black, LX, 0.09, LH + 1.5);
    put(deck, new T.CylinderGeometry(0.3, 0.3, 0.18, 6), M.chrome, LX, 0.24, LS);
    const lbat = new T.Group(); lbat.position.set(LX, 0.3, LS); deck.add(lbat);
    const lbatM = M.chrome.clone(); lbatM.emissive = new T.Color(0x000000);
    put(lbat, new T.CylinderGeometry(0.09, 0.15, 1.2, 16), lbatM, 0, 0.6, 0);
    put(lbat, new T.CylinderGeometry(0.2, 0.2, 0.36, 18), M.red, 0, 1.2, 0);
    const hinge = new T.Group(); hinge.position.set(LX, 0.26, LH); deck.add(hinge);
    const hingeBar = put(deck, new T.CylinderGeometry(0.1, 0.1, 1.9, 12), M.chrome, LX, 0.26, LH); hingeBar.rotation.z = Math.PI / 2;
    const coverM = M.red.clone(); coverM.emissive = new T.Color(0x000000);
    const CW = 1.8, CH = 1.75, CD = 3.1;
    const cover = [
      put(hinge, new T.BoxGeometry(CW, 0.09, CD), coverM, 0, CH, CD / 2),
      put(hinge, new T.BoxGeometry(0.09, CH, CD), coverM, -CW / 2 + 0.045, CH / 2, CD / 2),
      put(hinge, new T.BoxGeometry(0.09, CH, CD), coverM, CW / 2 - 0.045, CH / 2, CD / 2),
      put(hinge, new T.BoxGeometry(CW, CH, 0.09), coverM, 0, CH / 2, CD - 0.045)
    ];
    const coverPrint = canvasTexture(256, 440, (x, w, h) => {
      x.fillStyle = '#d8332a'; x.fillRect(0, 0, w, h);
      x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2);
      x.fillStyle = PAPER; x.font = '400 92px ' + DISPLAY; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LAUNCH', 0, 4);
      x.restore();
      x.strokeStyle = PAPER; x.lineWidth = 8; x.strokeRect(16, 16, w - 32, h - 32);
    });
    const coverTopM = new T.MeshStandardMaterial({ map: coverPrint.t, color: 0x6a6a6a, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); coverTopM.emissive = new T.Color(0x000000); coverTopM.userData.envTuned = true;
    const coverTop = put(hinge, new T.PlaneGeometry(CW - 0.2, CD - 0.25), coverTopM, 0, CH + 0.07, CD / 2, false); coverTop.rotation.x = -Math.PI / 2;
    cover.push(coverTop);
    const armedM = new T.MeshBasicMaterial({ color: 0x220806 });
    put(deck, new T.CylinderGeometry(0.3, 0.3, 0.08, 24), M.chrome, L.armed.x, 0.04, L.armed.z);
    put(deck, new T.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), armedM, L.armed.x, 0.08, L.armed.z, false);
    const launch = { open: false, on: false, cov: { x: 0, v: 0 }, sw: { x: 0.55, v: 0 }, refuse: 0, closeT: 0, blink: 0 };
    const COVER_OPEN = -1.95;
    const coverHit = proxy(hinge, CW + 0.3, CH + 0.3, CD + 0.3, 0, CH / 2, CD / 2);
    const switchHit = proxy(deck, 1.6, 1.8, 2.2, LX, 0.9, LS + 0.05);
    function flip() {
      if (launch.on) return;
      launch.on = true; launch.closeT = 0;
      const ok = o.on.launch();
      if (ok === false) { launch.refuse = 0.6; }
    }
    control('cover', 'Safety cover', [...cover, coverHit], [coverM, coverTopM], {
      down: p => { launch.coverDown = { y: p.y }; },
      move: p => { if (!launch.open && launch.coverDown && launch.coverDown.y - p.y > 14) { launch.open = true; launch.coverDown = null; } },
      up: p => { if (launch.coverDown) { launch.open = !launch.open; if (!launch.open) launch.on = false; } launch.coverDown = null; },
      tick(dt) { hinge.rotation.x = spring(launch.cov, launch.open ? COVER_OPEN : 0, dt, 260, 17); }
    });
    control('launch', 'Launch switch', [switchHit], [lbatM], {
      enabled: () => launch.cov.x < -1.2,
      down: () => flip(),
      tick(dt) {
        if (launch.refuse > 0) { launch.refuse -= dt; if (launch.refuse <= 0) launch.on = false; }
        lbat.rotation.x = spring(launch.sw, launch.on ? -0.55 : 0.55, dt, 600, 20);
        launch.blink += dt;
        const armed = launch.open && !launch.on, running = launch.on && launch.refuse <= 0;
        armedM.color.setRGB(...(launch.refuse > 0 ? [1.8, 0.2, 0.1] : running ? [1.6, 0.25, 0.12] : armed ? (Math.sin(launch.blink * 9) > 0 ? [1.5, 0.2, 0.1] : [0.2, 0.04, 0.03]) : [0.14, 0.03, 0.02]));
        if (launch.closeT > 0) { launch.closeT -= dt; if (launch.closeT <= 0) launch.open = false; }
      }
    });

    /* ---------- meter bridge: two needle gauges and the 7-segment display ---------- */
    function gauge(xc) {
      const g = new T.Group(); g.position.set(xc, BL.y, 0); g.scale.setScalar(0.9); bridge.add(g);
      const housing = put(g, new T.CylinderGeometry(1.62, 1.66, 0.34, 56), M.black, 0, 0, 0.17); housing.rotation.x = Math.PI / 2;
      const face = canvasTexture(512, 512, (x, w) => {
        const c = w / 2;
        x.fillStyle = PAPER; x.fillRect(0, 0, w, w);
        const rnd = seeded(21); for (let i = 0; i < 2600; i++) { x.fillStyle = 'rgba(27,23,18,' + (rnd() * 0.06).toFixed(3) + ')'; x.fillRect(rnd() * w, rnd() * w, 2, 2); }
        const at = v => (v - 0.5) * 2 * 2.18;
        x.lineCap = 'butt';
        x.strokeStyle = RED; x.lineWidth = 22; x.beginPath(); x.arc(c, c, 196, at(0.9) - Math.PI / 2, at(1) - Math.PI / 2); x.stroke();
        for (let i = 0; i <= 20; i++) {
          const a = at(i / 20), big = i % 5 === 0, r0 = big ? 168 : 184;
          x.strokeStyle = INK; x.lineWidth = big ? 8 : 3.5;
          x.beginPath(); x.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); x.lineTo(c + Math.sin(a) * 208, c - Math.cos(a) * 208); x.stroke();
          if (i % 10 === 0) { x.fillStyle = INK; x.font = '500 50px ' + MONO; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i * 5), c + Math.sin(a) * 128, c - Math.cos(a) * 128 + (i === 10 ? 4 : -6)); }
        }
        x.fillStyle = SOFT; x.font = '500 38px ' + MONO; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText('%', c, c + 104);
      });
      // printed paper, lit like the deck: no glow of its own
      const faceM = new T.MeshStandardMaterial({ map: face.t, color: 0x8a867e, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      faceM.userData.envTuned = true;
      put(g, new T.CircleGeometry(1.44, 56), faceM, 0, 0, 0.36, false);
      const bezel = put(g, new T.TorusGeometry(1.5, 0.1, 12, 56), M.chrome, 0, 0, 0.36);
      const needleG = new T.Group(); needleG.position.z = 0.43; g.add(needleG);
      put(needleG, new T.BoxGeometry(0.07, 1.3, 0.03), new T.MeshBasicMaterial({ color: new T.Color(0xe8402f).multiplyScalar(1.15) }), 0, 0.5, 0, false);
      const hubC = put(g, new T.CylinderGeometry(0.15, 0.15, 0.1, 18), M.black, 0, 0, 0.46); hubC.rotation.x = Math.PI / 2;
      return { needleG, s: { x: 0, v: 0 }, face, bezel };
    }
    const gauges = { gpu: gauge(-BL.gauge), bus: gauge(BL.gauge) };
    put(bridge, new T.BoxGeometry(8.2, 1.72, 0.16), M.black, 0, BL.y, 0.08);
    const seg = canvasTexture(1024, 180, (x, w, h, val) => {
      x.fillStyle = '#0b0908'; x.fillRect(0, 0, w, h);
      const c = cells(val), cw = w / 5, sc = (h - 30) / 1.8, ox = (cw - sc) / 2 - 6;
      for (let i = 0; i < 5; i++) {
        const on = DIGITS[c.d[i]] || '';
        Object.keys(SEGS).forEach(k => {
          x.fillStyle = on.includes(k) ? '#ff5b3e' : '#2a100b';
          x.beginPath(); SEGS[k].forEach(([sx, sy], j) => { const X = i * cw + ox + (sx + (1.8 - sy) * 0.1) * sc, Y = 15 + sy * sc; if (j) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.fill();
        });
        x.fillStyle = c.dp === i ? '#ff5b3e' : '#2a100b'; x.beginPath(); x.arc(i * cw + ox + sc * 1.12, 15 + sc * 1.72, sc * 0.1, 0, 7); x.fill();
      }
    });
    const segM = new T.MeshBasicMaterial({ map: seg.t }); segM.color.setScalar(1.6);
    put(bridge, new T.PlaneGeometry(7.9, 1.44), segM, 0, BL.y, 0.17, false);

    /* ---------- the LID key switch: a brass key in a chrome bezel; turned left the machine is closed, right it is open ---------- */
    const keyG = new T.Group(); keyG.position.set(BL.key, BL.y, 0); bridge.add(keyG);
    const kb = put(keyG, new T.CylinderGeometry(0.62, 0.66, 0.16, 40), M.gun, 0, 0, 0.08); kb.rotation.x = Math.PI / 2;   // gunmetal: chrome facing the camera mirrors the bright ceiling
    const kf = put(keyG, new T.CylinderGeometry(0.46, 0.46, 0.2, 32), M.black, 0, 0, 0.1); kf.rotation.x = Math.PI / 2;
    const keyTurn = new T.Group(); keyTurn.position.z = 0.2; keyG.add(keyTurn);
    const keyM = M.brass.clone(); keyM.emissive = new T.Color(0x000000);
    const plug = put(keyTurn, new T.CylinderGeometry(0.24, 0.24, 0.1, 24), keyM, 0, 0, 0.05); plug.rotation.x = Math.PI / 2;
    const bow = put(keyTurn, rbox(0.16, 0.92, 0.38, 0.05), keyM, 0, 0.12, 0.24);
    const head = put(keyTurn, new T.CylinderGeometry(0.24, 0.24, 0.16, 24), keyM, 0, 0.56, 0.24); head.rotation.z = Math.PI / 2;
    const keyHit = proxy(keyG, 1.5, 1.5, 0.9, 0, 0, 0.4);
    const lid = { open: false, a: { x: KEY_A, v: 0 }, down: null };
    function lidTo(open) { if (open === lid.open) return; lid.open = open; if (o.on.lid) o.on.lid(open); }
    control('lid', 'Lid key', [bow, head, plug, keyHit], [keyM], {
      cursor: 'grab',
      down: p => { lid.down = { x: p.x, done: false }; },
      move: p => { if (lid.down && !lid.down.done && Math.abs(p.x - lid.down.x) > 14) { lidTo(p.x > lid.down.x); lid.down.done = true; } },
      up: p => { if (lid.down && !lid.down.done && !p.moved) lidTo(!lid.open); lid.down = null; },
      wheel: dir => lidTo(dir > 0),
      tick(dt) { keyTurn.rotation.z = spring(lid.a, lid.open ? -KEY_A : KEY_A, dt, 420, 20); }
    });

    E.block(blockers);
    P.tuneEnv();

    /* ---------- state in, numbers in, the frame loop ---------- */
    let shownTps = undefined;
    function set(st) {
      padsSel.i = Math.max(0, o.machines.findIndex(m => m.id === st.machine));
      if (!fader.drag) { fader.t = st.t; fader.detent = snapT(st.t); }
      if (!jog.drag && st.crew !== jog.n) { jog.n = st.crew; jog.cont = st.crew; capTex.redraw(st.crew); }
      jog.gpu = st.crewGpu; jog.mem = st.crewMem; paintLeds();
      const li = o.precs.findIndex(p => p.id === st.prec);
      if (!lever.drag && li >= 0) { lever.i = li; lever.target = L.lever.at[li]; }
      o.prompts.forEach((pr, i) => { sws[i].on = pr.id === st.prompt; });
      if (st.lid != null) lid.open = !!st.lid;
    }
    // the key follows the machine (opened by its lid, O or a launch)
    function setLid(open) { lid.open = !!open; }
    function show(v) {
      gauges.gpu.target = v.gpu; gauges.bus.target = v.bus;
      const tps = v.tps == null ? null : Math.round(v.tps * 10) / 10;
      if (tps !== shownTps) { shownTps = tps; seg.redraw(tps); }
    }
    // arm(true): open the cover and throw the switch (a launch from the keyboard or a preset); arm(false): the run is
    // over, the switch drops back and the cover closes a moment later
    function arm(on) {
      if (on) { if (!launch.open) { launch.open = true; launch.armDelay = 0.28; } else if (!launch.on) { launch.on = true; } launch.closeT = 0; }
      else if (launch.on || launch.open) { launch.on = false; launch.armDelay = 0; launch.closeT = launch.open ? 1.1 : 0; }
    }
    function refuse() { launch.on = true; launch.refuse = 0.6; }
    let pulse = 0;
    function update(dt) {
      if (!root.visible) return;
      if (launch.armDelay > 0) { launch.armDelay -= dt; if (launch.armDelay <= 0) launch.on = true; }
      pulse += dt;
      order.forEach(c => {
        if (c.tick) c.tick(dt);
        const learnGlow = learnOn ? (learnPicked === c.id ? 1 : 0.35 + 0.35 * Math.sin(pulse * 5)) : 0;
        const g = spring(c.glow, c.hot || (c === cFader && fader.drag) ? 1 : 0, dt, 180, 22);
        c.mats.forEach((m, i) => { if (m.emissive) m.emissive.copy(c.base[i]).add(tmpC.copy(HOT).multiplyScalar(clamp(g, 0, 1.2))).add(tmpC.copy(LEARN).multiplyScalar(learnGlow)); });
      });
      ['gpu', 'bus'].forEach(k => { const G = gauges[k]; G.needleG.rotation.z = -(spring(G.s, clamp(G.target || 0, 0, 1.02), dt, 90, 9) - 0.5) * 2 * 2.18; });
    }

    // MIDI and other outside inputs: msg = { v: 0..1 } for a knob or fader, { delta } from an endless encoder, { press } for a pad or key
    function drive(id, msg) {
      const c = ctl[id]; if (!c) return;
      if (/^pad\d$/.test(id)) { if (msg.press || msg.v > 0.5) { const m = o.machines[+id.slice(3)]; o.on.machine(m.id); c.tap(); } return; }
      if (/^sw\d$/.test(id)) { if (msg.press || msg.v > 0.5) o.on.prompt(o.prompts[+id.slice(2)].id); return; }
      if (id === 'fader') { if (msg.delta) faderTo(fader.t + msg.delta * 0.01, true); else if (msg.v != null && !msg.press) faderTo(msg.v, true); return; }
      if (id === 'jog') { if (msg.delta) crewTo(jog.n + msg.delta, true); else if (msg.v != null && !msg.press) crewTo(1 + msg.v * (crewMax - 1), true); return; }
      if (id === 'lever') { if (msg.press) leverTo((lever.i + 1) % 3, true); else if (msg.delta) leverTo(lever.i + (msg.delta > 0 ? 1 : -1), true); else if (msg.v != null) leverTo(Math.round(msg.v * 2), true); return; }
      if (id === 'lid') { if (msg.press) lidTo(!lid.open); else if (msg.delta) lidTo(msg.delta > 0); else if (msg.v != null) lidTo(msg.v > 0.5); return; }
      if (id === 'cover') { if (msg.press || msg.v > 0.5) launch.open = !launch.open; return; }
      if (id === 'launch') { if (msg.press || msg.v > 0.5) { if (!launch.open) { launch.open = true; launch.armDelay = 0.28; o.on.launch(); } else flip(); } }
    }
    function learn(on) { learnOn = !!on; learnPicked = null; }
    // for screenshots: hover a control, hold the fader, lift the cover
    function pose(p) {
      order.forEach(c => { c.hot = p.hover === c.id; });
      if (p.hold === 'fader') fader.drag = true;
      if (p.cover != null) launch.open = !!p.cover;
    }

    const bounds = new T.Box3().setFromObject(root);
    return { root, box: bounds, set, setLid, show, arm, refuse, update, drive, learn, pose, redraw() { deckPaper.redraw(); deckInk.redraw(); bridgePaper.redraw(); bridgeInk.redraw(); gauges.gpu.face.redraw(); gauges.bus.face.redraw(); coverPrint.redraw(); capTex.redraw(jog.n); }, ids: () => order.map(c => ({ id: c.id, name: c.name })),
      // where a control is on the screen (tests, and anything that wants to point at it)
      where(id) { const c = ctl[id]; return c ? screen(c.meshes[0].getWorldPosition(new T.Vector3())) : null; } };
  }
  const KEY_A = 0.8;   // the LID key turns this far either side of upright

  DSP.deck = { build };
})(window.DSP = window.DSP || {});
