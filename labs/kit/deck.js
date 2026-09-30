/* =========================================================
   DECK: the Mission Control console in front of the machine. A 1960s launch console crossed with a DJ controller,
   in the screenprint inks: five pads pick the machine, a long fader sets the model size (detents at the preset models),
   a jog wheel sets the crew (1-64, one lit block per request), a chunky lever sets the compression (16, 8, 4-bit),
   three switches pick the prompt, and the launch switch sits under a flip-up safety cover. On the meter bridge: needle
   gauges for GPU math used and the memory bus, a 7-segment tokens/s display and a status line.
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
    const redraw = arg => { draw(c.getContext('2d'), w, h, arg); t.needsUpdate = true; };
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
    const L = {
      W: 30.4, D: 9.1, tilt: 0.175,
      lever: { x: -13.55, z: 0.2, arm: 2.55, at: [-0.62, 0, 0.62] },
      pads: { z: 2.3, x0: -10.65, pitch: 2.0, s: 1.66 },
      fader: { z: -2.15, x0: -11.0, x1: 4.4 },
      sw: { z: 1.95, xs: [1.05, 2.8, 4.55] },
      jog: { x: 8.7, z: 0.05, r: 2.5, ring: 2.92, bezel: 3.2, a0: 15 * Math.PI / 180, span: 330 * Math.PI / 180 },
      launch: { x: 13.5, z: 0.95 }
    };
    const PXU = 80, crewMax = o.crewMax || 64;
    const root = new T.Group(); root.position.set(...o.at); root.scale.setScalar(o.scale || 1); E.scene.add(root);
    const blockers = [], ctl = {}, order = [];
    const put = (parent, geo, mat, x, y, z, cast) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = cast !== false; m.receiveShadow = true; parent.add(m); return m; };
    const hitM = new T.MeshBasicMaterial({ visible: false });
    const proxy = (parent, w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), hitM); m.position.set(x, y, z); parent.add(m); return m; };

    /* ---------- materials: ink-black body, red cheeks, chrome, cream print, the four inks ---------- */
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
      yellow: std(0xa47208, 0.5, 0.05, { envMapIntensity: 0.3 })
    };
    [M.chrome, M.red, M.yellow].forEach(m => { m.userData.envTuned = true; });
    // the body's top sits right under the printed plate: cast shadows from its back faces, or the plate gets striped
    [M.body, M.kick].forEach(m => { m.shadowSide = T.BackSide; });

    /* ---------- body: a wedge desk with red end cheeks, a black kick plate, a chrome lip, and the meter bridge ---------- */
    const TAN = Math.tan(L.tilt), cosT = Math.cos(L.tilt), sinT = Math.sin(L.tilt);
    const zc = 0.9, yc = 1.84, halfD = L.D / 2;
    const front = { z: zc + halfD * cosT, y: yc - halfD * sinT }, back = { z: zc - halfD * cosT, y: yc + halfD * sinT };
    const profile = (pts, depth, bevel) => {
      const s = new T.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y)); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: depth - 2 * (bevel || 0), bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 3 });
      g.rotateY(-Math.PI / 2); g.translate(depth / 2 - (bevel || 0), 0, 0); return g;   // shape x -> world z, extrusion -> world -x, centred
    };
    const wedge = put(root, profile([[front.z, 0.35], [front.z, front.y - 0.01], [back.z, back.y - 0.01], [back.z, 0.35]], L.W, 0), M.body, 0, 0, 0);
    const kick = put(root, new T.BoxGeometry(L.W + 0.4, 0.36, front.z - back.z - 0.5), M.kick, 0, 0.18, (front.z + back.z) / 2 - 0.1);
    const cheekPts = [[front.z + 0.2, 0], [front.z + 0.2, front.y + 0.28], [back.z - 0.15, back.y + 0.32], [back.z - 0.15, 0]];
    const cheeks = [-1, 1].map(s => put(root, profile(cheekPts, 0.6, 0.1), M.cheek, s * (L.W / 2 + 0.3), 0, 0));
    const lip = put(root, new T.CylinderGeometry(0.07, 0.07, L.W, 12), M.chrome, 0, front.y - 0.02, front.z);
    lip.rotation.z = Math.PI / 2;
    // meter bridge: a face at 52 degrees, facing the camera
    const BR = { w: 21.6, h: 3.9, ang: 52 * Math.PI / 180, z0: back.z, y0: back.y - 0.08 };
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

    /* ---------- the printed deck plate: section boxes, titles, scales and labels, all in one canvas ---------- */
    const px = x => (x + L.W / 2) * PXU, pz = z => (z + L.D / 2) * PXU;
    const fadeT = t => L.fader.x0 + t * (L.fader.x1 - L.fader.x0);
    const jogAngle = n => L.jog.a0 + (n - 1) / (crewMax - 1) * L.jog.span;   // clockwise from the back, seen from above
    const text = (x, s, X, Z, size, font, color, align, base) => { x.font = font.replace('#', Math.round(size * PXU) + 'px'); x.fillStyle = color || INK; x.textAlign = align || 'left'; x.textBaseline = base || 'alphabetic'; x.fillText(s, px(X), pz(Z)); };
    const box = (x, x0, z0, x1, z1, lw) => { x.lineWidth = lw || 4; x.strokeStyle = INK; x.strokeRect(px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0)); };
    const printDeck = canvasTexture(Math.round(L.W * PXU), Math.round(L.D * PXU), (x, w, h) => {
      paper(x, w, h, 3);
      halftone(x, w - 40, 40, 300, 'rgba(31,135,131,.55)', 14);
      halftone(x, 40, h - 30, 230, 'rgba(242,194,48,.8)', 14);
      x.lineWidth = 7; x.strokeStyle = INK; x.strokeRect(10, 10, w - 20, h - 20);
      const title = (s, X, Z, col) => text(x, s, X, Z, 0.46, '400 # ' + DISPLAY, col || INK);
      // lever
      box(x, -14.95, -4.3, -12.05, 4.3); title('BITS', -14.75, -3.62);
      L.lever.at.forEach((a, i) => {
        const z = L.lever.z + L.lever.arm * Math.sin(a);
        x.fillStyle = INK; x.fillRect(px(-13.05), pz(z) - 3, px(-12.8) - px(-13.05), 6);
        text(x, ['16', '8', '4'][i], -12.72, z, 0.42, '400 # ' + DISPLAY, INK, 'left', 'middle');
      });
      text(x, 'COMPRESSION', -14.75, 3.95, 0.26, '500 # ' + MONO, SOFT);
      // pads
      box(x, -11.85, 0.35, -1.45, 4.3); title('MACHINE', -11.65, 1.02);
      o.machines.forEach((m, i) => text(x, m.short.toUpperCase(), L.pads.x0 + i * L.pads.pitch, 3.78, 0.28, '700 # ' + SANS, INK, 'center'));
      // fader: dense presets named above the track, mixture-of-experts ones in teal below it
      box(x, -11.85, -4.3, 5.35, 0.15); title('MODEL SIZE', -11.65, -3.62); text(x, 'BILLIONS OF PARAMETERS', -8.2, -3.66, 0.22, '500 # ' + MONO, SOFT);
      x.fillStyle = 'rgba(27,23,18,.35)'; x.fillRect(px(L.fader.x0), pz(L.fader.z) - 26, px(L.fader.x1) - px(L.fader.x0), 3);
      for (let i = 0; i <= 40; i++) { const X = fadeT(i / 40); x.fillStyle = INK; x.fillRect(px(X) - 1.5, pz(L.fader.z) + (i % 5 ? 20 : 16), 3, i % 5 ? 8 : 14); }
      text(x, '1B', L.fader.x0, L.fader.z - 0.5, 0.24, '500 # ' + MONO, SOFT, 'center');
      text(x, '3T', L.fader.x1, L.fader.z - 0.5, 0.24, '500 # ' + MONO, SOFT, 'center');
      o.models.forEach(m => {
        const X = fadeT(m.t), up = !m.moe;
        x.fillStyle = up ? INK : TEAL;
        x.fillRect(px(X) - 2.5, up ? pz(L.fader.z - 0.78) : pz(L.fader.z + 0.4), 5, 0.38 * PXU);
        text(x, m.label, X, up ? L.fader.z - 0.86 : L.fader.z + 1.12, 0.32, '700 # ' + SANS, up ? INK : TEAL, 'center');
      });
      // prompt switches
      box(x, -1.25, 0.35, 5.35, 4.3); title('PROMPT', -1.05, 1.02);
      o.prompts.forEach((p, i) => {
        text(x, p.short.toUpperCase(), L.sw.xs[i], 3.72, 0.3, '700 # ' + SANS, INK, 'center');
        text(x, p.tokens.toLocaleString('en-US') + ' TOK', L.sw.xs[i], 4.1, 0.2, '500 # ' + MONO, SOFT, 'center');
      });
      // crew
      box(x, 5.55, -4.3, 11.85, 4.3); title('CREW', 5.75, -3.62);
      text(x, 'REQUESTS', 11.65, -3.9, 0.22, '500 # ' + MONO, SOFT, 'right');
      text(x, 'AT ONCE', 11.65, -3.58, 0.22, '500 # ' + MONO, SOFT, 'right');
      [1, 8, 16, 24, 32, 40, 48, 56, 64].forEach(n => {
        const a = jogAngle(n), r = L.jog.bezel + 0.36;
        text(x, String(n), L.jog.x + Math.sin(a) * r, L.jog.z - Math.cos(a) * r, 0.27, '500 # ' + MONO, INK, 'center', 'middle');
      });
      // launch: hazard frame round the switch base
      box(x, 12.05, -4.3, 14.95, 4.3); text(x, 'LAUNCH', 13.5, 3.62, 0.5, '400 # ' + DISPLAY, RED, 'center');
      text(x, 'LIFT COVER, FLIP', 13.5, 4.02, 0.2, '500 # ' + MONO, SOFT, 'center');
      const hz = [12.35, -1.25, 14.65, 2.95];
      x.save(); x.beginPath(); x.rect(px(hz[0]), pz(hz[1]), px(hz[2]) - px(hz[0]), pz(hz[3]) - pz(hz[1])); x.clip();
      x.fillStyle = YEL; x.fillRect(px(hz[0]), pz(hz[1]), px(hz[2]) - px(hz[0]), pz(hz[3]) - pz(hz[1]));
      x.fillStyle = INK; for (let i = -20; i < 40; i++) { const x0 = px(hz[0]) + i * 26; x.beginPath(); x.moveTo(x0, pz(hz[1])); x.lineTo(x0 + 13, pz(hz[1])); x.lineTo(x0 + 13 + 320, pz(hz[3])); x.lineTo(x0 + 320, pz(hz[3])); x.fill(); }
      x.restore();
      text(x, 'ARMED', 13.5, -1.85, 0.22, '500 # ' + MONO, SOFT, 'center');
    });
    // printed paper under the stage's strong key light: a darker ink-on-cream albedo keeps it cream on screen, not white
    const plateM = new T.MeshStandardMaterial({ map: printDeck.t, color: 0x6e6a62, roughness: 0.85, metalness: 0, envMapIntensity: 0.15 });
    plateM.userData.envTuned = true;
    const plateMesh = put(deck, new T.PlaneGeometry(L.W, L.D), plateM, 0, 0.004, 0, false); plateMesh.rotation.x = -Math.PI / 2;
    blockers.push(plateMesh);

    const printBridge = canvasTexture(Math.round(BR.w * PXU), Math.round(BR.h * PXU), (x, w, h) => {
      paper(x, w, h, 9);
      halftone(x, w - 30, 30, 200, 'rgba(223,58,44,.45)', 13);
      x.lineWidth = 7; x.strokeStyle = INK; x.strokeRect(10, 10, w - 20, h - 20);
      x.lineWidth = 3; x.strokeRect(22, 22, w - 44, h - 44);
      x.textBaseline = 'alphabetic';
      x.font = '500 ' + Math.round(0.22 * PXU) + 'px ' + MONO; x.fillStyle = SOFT; x.textAlign = 'center';
      x.fillText('TOKENS PER SECOND', w / 2, (BR.h / 2 + 0.32) * PXU);
    });
    const bridgeM = new T.MeshStandardMaterial({ map: printBridge.t, color: 0x7a766e, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: printBridge.t, emissiveIntensity: 0.05, envMapIntensity: 0.15 });
    bridgeM.userData.envTuned = true;
    const bridgeFace = put(bridge, new T.PlaneGeometry(BR.w, BR.h), bridgeM, 0, 0, 0, false);
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

    /* ---------- machine pads ---------- */
    const padsSel = { i: 0 };
    o.machines.forEach((m, i) => {
      const x = L.pads.x0 + i * L.pads.pitch;
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
      const a = E.toScreen(deck.localToWorld(new T.Vector3(L.fader.x0, 0.4, L.fader.z))), b = E.toScreen(deck.localToWorld(new T.Vector3(L.fader.x1, 0.4, L.fader.z)));
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
    const leds = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.05, 0.3), new T.MeshBasicMaterial({ color: 0xffffff }), crewMax);
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
    const marker = put(platterG, new T.CylinderGeometry(0.22, 0.22, 0.06, 20), M.yellow, 0, 0.33, -(L.jog.r - 0.42));
    const capTex = canvasTexture(256, 256, (x, w, h, n) => {
      x.fillStyle = '#1b1712'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c9bea6'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = '500 30px ' + MONO; x.fillText('CREW', w / 2, 70);
      x.fillStyle = YEL; x.font = '400 118px ' + DISPLAY; x.fillText(String(n || 1), w / 2, 196);
    });
    put(jg, new T.CylinderGeometry(1.02, 1.02, 0.1, 48), M.black, 0, 0.56, 0);
    const capFace = put(jg, new T.CircleGeometry(0.95, 48), new T.MeshBasicMaterial({ map: capTex.t }), 0, 0.615, 0, false); capFace.rotation.x = -Math.PI / 2;
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
    const hub = put(pivot, new T.CylinderGeometry(0.34, 0.34, 0.86, 24), M.black, 0, 0, 0); hub.rotation.z = Math.PI / 2;
    const leverArm = put(pivot, new T.CylinderGeometry(0.11, 0.13, L.lever.arm - 0.3, 16), M.chrome, 0, (L.lever.arm - 0.3) / 2 + 0.1, 0);
    put(pivot, new T.CylinderGeometry(0.19, 0.19, 0.3, 16), M.rubber, 0, L.lever.arm - 0.35, 0);
    const knobM = M.red.clone(); knobM.emissive = new T.Color(0x000000);
    const knob = put(pivot, new T.SphereGeometry(0.5, 32, 20), knobM, 0, L.lever.arm, 0);
    const leverHit = proxy(pivot, 1.3, L.lever.arm + 0.8, 1.3, 0, (L.lever.arm + 0.8) / 2, 0);
    const leverPath = p => {
      // the knob's path on screen, sampled; the closest point to the pointer gives the angle
      let best = null;
      for (let i = 0; i <= 34; i++) {
        const a = -0.85 + i / 34 * 1.7;
        const w = deck.localToWorld(new T.Vector3(L.lever.x, 0.34 + Math.cos(a) * L.lever.arm, L.lever.z + Math.sin(a) * L.lever.arm)), s = E.toScreen(w);
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

    /* ---------- prompt switches: bat-handle toggles, one on at a time, a jewel lamp above each ---------- */
    const sws = o.prompts.map((pr, i) => {
      const x = L.sw.xs[i], z = L.sw.z;
      put(deck, rbox(1.2, 0.08, 1.2, 0.08), M.black, x, 0.04, z);
      put(deck, new T.CylinderGeometry(0.34, 0.34, 0.2, 6), M.chrome, x, 0.16, z);
      const bat = new T.Group(); bat.position.set(x, 0.24, z); deck.add(bat);
      const batM = M.chrome.clone(); batM.emissive = new T.Color(0x000000);
      put(bat, new T.CylinderGeometry(0.12, 0.19, 1.2, 18), batM, 0, 0.6, 0);
      put(bat, new T.SphereGeometry(0.24, 20, 14), batM, 0, 1.22, 0);
      put(deck, new T.CylinderGeometry(0.36, 0.36, 0.08, 24), M.chrome, x, 0.04, z + 1.3);
      const lampM = new T.MeshBasicMaterial({ color: 0xffffff });
      const lamp = put(deck, new T.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampM, x, 0.08, z + 1.3, false);
      const hit = proxy(deck, 1.6, 1.9, 2.4, x, 0.8, z + 0.1);
      const s = { on: false, a: { x: 0.5, v: 0 }, lamp: lampM };
      control('sw' + i, pr.short, [hit, lamp], [batM], {
        down: () => { o.on.prompt(pr.id); },
        tick(dt) { bat.rotation.x = spring(s.a, s.on ? -0.5 : 0.5, dt, 520, 18); lampM.color.setRGB(...(s.on ? [0.15, 1.45, 1.25] : [0.05, 0.13, 0.12])); }
      });
      return s;
    });

    /* ---------- launch: a toggle under a red flip-up cover, an ARMED lamp behind it ---------- */
    const LX = L.launch.x, LZ = L.launch.z;
    put(deck, rbox(2.1, 0.18, 3.6, 0.08), M.black, LX, 0.09, LZ + 0.25);
    put(deck, new T.CylinderGeometry(0.3, 0.3, 0.18, 6), M.chrome, LX, 0.24, LZ + 0.55);
    const lbat = new T.Group(); lbat.position.set(LX, 0.3, LZ + 0.55); deck.add(lbat);
    const lbatM = M.chrome.clone(); lbatM.emissive = new T.Color(0x000000);
    put(lbat, new T.CylinderGeometry(0.09, 0.15, 1.2, 16), lbatM, 0, 0.6, 0);
    put(lbat, new T.CylinderGeometry(0.2, 0.2, 0.36, 18), M.red, 0, 1.2, 0);
    const hinge = new T.Group(); hinge.position.set(LX, 0.26, LZ - 1.05); deck.add(hinge);
    const hingeBar = put(deck, new T.CylinderGeometry(0.1, 0.1, 1.9, 12), M.chrome, LX, 0.26, LZ - 1.05); hingeBar.rotation.z = Math.PI / 2;
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
    const coverTopM = new T.MeshStandardMaterial({ map: coverPrint.t, color: 0x6a6a6a, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.3 }); coverTopM.emissive = new T.Color(0x000000); coverTopM.userData.envTuned = true;
    const coverTop = put(hinge, new T.PlaneGeometry(CW - 0.2, CD - 0.25), coverTopM, 0, CH + 0.05, CD / 2, false); coverTop.rotation.x = -Math.PI / 2;
    cover.push(coverTop);
    const armedM = new T.MeshBasicMaterial({ color: 0x220806 });
    put(deck, new T.CylinderGeometry(0.3, 0.3, 0.08, 24), M.chrome, LX, 0.04, LZ - 2.25);
    const armedLamp = put(deck, new T.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), armedM, LX, 0.08, LZ - 2.25, false);
    const launch = { open: false, on: false, cov: { x: 0, v: 0 }, sw: { x: 0.55, v: 0 }, refuse: 0, closeT: 0, blink: 0 };
    const COVER_OPEN = -1.95;
    const coverHit = proxy(hinge, CW + 0.3, CH + 0.3, CD + 0.3, 0, CH / 2, CD / 2);
    const switchHit = proxy(deck, 1.6, 1.8, 2.2, LX, 0.9, LZ + 0.6);
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

    /* ---------- meter bridge: two needle gauges, the 7-segment display, the status line ---------- */
    function gauge(xc, title, sub) {
      const g = new T.Group(); g.position.set(xc, 0.05, 0); bridge.add(g);
      const housing = put(g, new T.CylinderGeometry(1.62, 1.66, 0.34, 56), M.black, 0, 0, 0.17); housing.rotation.x = Math.PI / 2;
      const face = canvasTexture(512, 512, (x, w) => {
        const c = w / 2;
        x.fillStyle = PAPER; x.fillRect(0, 0, w, w);
        const rnd = seeded(21); for (let i = 0; i < 2600; i++) { x.fillStyle = 'rgba(27,23,18,' + (rnd() * 0.06).toFixed(3) + ')'; x.fillRect(rnd() * w, rnd() * w, 2, 2); }
        const at = v => (v - 0.5) * 2 * 2.18;
        x.lineCap = 'butt';
        x.strokeStyle = RED; x.lineWidth = 22; x.beginPath(); x.arc(c, c, 196, at(0.9) - Math.PI / 2, at(1) - Math.PI / 2); x.stroke();
        for (let i = 0; i <= 20; i++) {
          const a = at(i / 20), big = i % 5 === 0, r0 = big ? 170 : 184;
          x.strokeStyle = INK; x.lineWidth = big ? 7 : 3.5;
          x.beginPath(); x.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); x.lineTo(c + Math.sin(a) * 208, c - Math.cos(a) * 208); x.stroke();
          if (big && i % 20) { x.fillStyle = INK; x.font = '500 38px ' + MONO; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i * 5), c + Math.sin(a) * 138, c - Math.cos(a) * 138); }
        }
        x.fillStyle = INK; x.font = '400 46px ' + DISPLAY; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillText(title, c, c + 100);
        x.fillStyle = SOFT; x.font = '500 26px ' + MONO; x.fillText(sub, c, c + 136);
      });
      const faceM = new T.MeshStandardMaterial({ map: face.t, color: 0x8a867e, roughness: 0.6, emissive: 0xfff2d8, emissiveMap: face.t, emissiveIntensity: 0.14 });
      faceM.userData.envTuned = true;
      put(g, new T.CircleGeometry(1.44, 56), faceM, 0, 0, 0.35, false);
      const bezel = put(g, new T.TorusGeometry(1.5, 0.1, 12, 56), M.chrome, 0, 0, 0.36);
      const needleG = new T.Group(); needleG.position.z = 0.42; g.add(needleG);
      put(needleG, new T.BoxGeometry(0.07, 1.3, 0.03), new T.MeshBasicMaterial({ color: new T.Color(0xe8402f).multiplyScalar(1.15) }), 0, 0.5, 0, false);
      const hubC = put(g, new T.CylinderGeometry(0.15, 0.15, 0.1, 18), M.black, 0, 0, 0.45); hubC.rotation.x = Math.PI / 2;
      return { needleG, s: { x: 0, v: 0 }, face, bezel };
    }
    const gauges = { gpu: gauge(-7.15, 'GPU MATH', 'USED, %'), bus: gauge(7.15, 'MEMORY BUS', 'BUSY, %') };
    put(bridge, new T.BoxGeometry(8.5, 1.72, 0.16), M.black, 0, 0.72, 0.08);
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
    put(bridge, new T.PlaneGeometry(8.2, 1.44), segM, 0, 0.72, 0.17, false);
    put(bridge, new T.BoxGeometry(10.6, 0.78, 0.12), M.black, 0, -1.2, 0.06);
    const lcd = canvasTexture(1400, 96, (x, w, h, s) => {
      x.fillStyle = '#15120d'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(242,194,48,.06)'; for (let i = 0; i < w; i += 7) x.fillRect(i, 0, 1, h);
      x.fillStyle = YEL; x.textBaseline = 'middle'; x.textAlign = 'left';
      let size = 50; x.font = '500 ' + size + 'px ' + MONO;
      const t = String(s || '').toUpperCase();
      while (size > 26 && x.measureText(t).width > w - 40) { size -= 2; x.font = '500 ' + size + 'px ' + MONO; }
      x.fillText(t, 20, h / 2 + 2);
    });
    const lcdM = new T.MeshBasicMaterial({ map: lcd.t }); lcdM.color.setScalar(1.25);
    put(bridge, new T.PlaneGeometry(10.4, 0.62), lcdM, 0, -1.2, 0.125, false);

    E.block(blockers);
    P.tuneEnv();

    /* ---------- state in, numbers in, the frame loop ---------- */
    let shownTps = undefined, shownLcd = null;
    function set(st) {
      padsSel.i = Math.max(0, o.machines.findIndex(m => m.id === st.machine));
      if (!fader.drag) { fader.t = st.t; fader.detent = snapT(st.t); }
      if (!jog.drag && st.crew !== jog.n) { jog.n = st.crew; jog.cont = st.crew; capTex.redraw(st.crew); }
      jog.gpu = st.crewGpu; jog.mem = st.crewMem; paintLeds();
      const li = o.precs.findIndex(p => p.id === st.prec);
      if (!lever.drag && li >= 0) { lever.i = li; lever.target = L.lever.at[li]; }
      o.prompts.forEach((pr, i) => { sws[i].on = pr.id === st.prompt; });
    }
    function show(v) {
      gauges.gpu.target = v.gpu; gauges.bus.target = v.bus;
      const tps = v.tps == null ? null : Math.round(v.tps * 10) / 10;
      if (tps !== shownTps) { shownTps = tps; seg.redraw(tps); }
      if (v.lcd !== shownLcd) { shownLcd = v.lcd; lcd.redraw(v.lcd); }
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
    return { root, box: bounds, set, show, arm, refuse, update, drive, learn, pose, redraw() { printDeck.redraw(); printBridge.redraw(); gauges.gpu.face.redraw(); gauges.bus.face.redraw(); coverPrint.redraw(); capTex.redraw(jog.n); lcd.redraw(shownLcd); }, ids: () => order.map(c => ({ id: c.id, name: c.name })),
      // where a control is on the screen (tests, and anything that wants to point at it)
      where(id) { const c = ctl[id]; return c ? E.toScreen(c.meshes[0].getWorldPosition(new T.Vector3())) : null; } };
  }

  DSP.deck = { build };
})(window.DSP = window.DSP || {});
