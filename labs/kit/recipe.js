/* =========================================================
   RECIPE: draws a machine from a short recipe (labs/machines/*.js). A recipe says what the machine is made of:
   the case (type and material), the board, the chip package and its dies, the memory chips (how many, where), the
   bus width, the power parts, the other parts (SSD, ports, ...), the cooler type, the shell and its spec plate.
   This file knows how each of those is built, from kit/parts.js and kit/shell.js; the recipe only holds numbers.
     DSP.recipe.machine(R)  registers DSP.machines[R.id] = { build, name, recipe }
     build(R)               the machine the mission shows (the contract at the end of build())
     shellOnly(R)           just the closed outside: the lid, its plate and what shows beside it (the showroom)
   Coordinates are scene units on the board plane (x right, z towards the viewer), y0 is the top of the board.
   A point in a label, a load point or an answer path is [x, y, z] where y may name a height: 'board', 'die', 'sub',
   'tile', 'cell', 'ssd', 'fan', with an offset ('ssd+.3').
   The build order is fixed (case, board, chip, memory, bus, power, parts, cooler, shell, mug) because the board
   texture, the bus particles and the SSD sticker draw from Math.random in that order.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts || !DSP.shell || !DSP.board) return;
  const E = DSP.engine, P = DSP.parts, S = DSP.shell, T = E.T, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
  // [x0, z0, nx, nz, dx, dz] -> points at height y
  const grid = (g, y, rot) => { const out = []; for (let a = 0; a < g[2]; a++) for (let b = 0; b < g[3]; b++) out.push([g[0] + a * g[4], y, g[1] + b * g[5], rot || 0]); return out; };
  const centred = (n, pitch) => i => (i - (n - 1) / 2) * pitch;
  const COLOR = { teal: 0x27f2d2, red: 0xff3a2c, yellow: 0xf2c230 };

  // case and shell materials by name; the coloured ones are made fresh for each machine
  function material(name) {
    if (typeof name === 'object') { const m = material(name.from).clone(); if (name.color != null) m.color.setHex(name.color); m.userData.envTuned = true; return m; }
    switch (name) {
      case 'gold': return M.gold; case 'alu': return M.alu; case 'dark': return M.dark; case 'foam': return M.foam; case 'black': return M.black;
      case 'graphite': { const m = M.alu.clone(); m.color.setHex(0x444955); m.userData.envTuned = true; return m; }
      case 'gunmetal': { const m = M.alu.clone(); m.color.setHex(0x4b505b); m.userData.envTuned = true; return m; }
      case 'red': return std(0xc4262b, 0.38, 0.3);
    }
    throw new Error('recipe: no material "' + name + '"');
  }

  /* ---------- memory placement: where the chips sit, their bus lanes, the traces under the lanes ----------
     columns: two columns either side of the package (DGX Spark), lanes dog-leg in to its edge
     ring:    rows above and below the GPU and columns at its sides (graphics cards), straight lanes into the die
     rows:    a row in front of and a row behind the package (Strix Halo), lanes fanning in to the I/O die
     package: on the chip package itself, above and below the dies (M3 Ultra), several short lanes per chip */
  const LAYOUTS = {
    columns(L, pkg, perChip) {
      const per = L.chips / 2, z = centred(per, L.pitch), chips = [];
      [-L.x, L.x].forEach(dx => { for (let i = 0; i < per; i++) chips.push({ x: pkg.x + dx, z: pkg.z + z(i) }); });
      const lanes = chips.map(ch => { const s = sgn(ch.x - pkg.x); return { ch, s: [ch.x - s * L.inset, ch.z], e: [pkg.x + s * L.to, pkg.z + (ch.z - pkg.z) * L.squeeze] }; });
      const traces = (h, t) => lanes.forEach(({ ch, s, e }) => {
        const k = sgn(ch.x - pkg.x), mx = (s[0] + e[0]) / 2, o = centred(t.n, t.spread);
        for (let i = 0; i < t.n; i++) h.trace([[s[0] + k * t.under, ch.z + o(i)], [mx + k * t.bend, ch.z + o(i)], [mx - k * t.bend, e[1] + o(i)], [e[0], e[1] + o(i)]], t.width);
      });
      const mlcc = (n, pitch, d) => chips.flatMap(ch => Array.from({ length: n }, (_, i) => [ch.x + sgn(ch.x - pkg.x) * d, 0, ch.z + centred(n, pitch)(i), Math.PI / 2]));
      return { chips, lanes, traces, mlcc };
    },
    ring(L, pkg, perChip, die) {
      const [nRow, nSide] = L.sides, row = centred(nRow, L.pitch), side = centred(nSide, L.sidePitch), chips = [];
      for (let i = 0; i < nRow; i++) chips.push({ x: pkg.x - row(i), z: pkg.z - L.dist, side: 't' });
      for (let i = 0; i < nSide; i++) chips.push({ x: pkg.x - L.sideDist, z: pkg.z + side(i), rot: true, side: 'l' });
      for (let i = 0; i < nRow; i++) chips.push({ x: pkg.x + row(i), z: pkg.z + L.dist, side: 'b' });
      for (let i = 0; i < nSide; i++) chips.push({ x: pkg.x + L.sideDist, z: pkg.z - side(i), rot: true, side: 'r' });
      const [dw, dd] = die, clampX = v => Math.max(pkg.x - dw / 2 + 0.3, Math.min(pkg.x + dw / 2 - 0.3, v));
      const lanes = chips.map(ch => {
        if (ch.side === 't') return { ch, s: [ch.x, ch.z + L.inset], e: [clampX(pkg.x + (ch.x - pkg.x) * L.fan), pkg.z - dd / 2] };
        if (ch.side === 'b') return { ch, s: [ch.x, ch.z - L.inset], e: [clampX(pkg.x + (ch.x - pkg.x) * L.fan), pkg.z + dd / 2] };
        if (ch.side === 'r') return { ch, s: [ch.x - L.inset, ch.z], e: [pkg.x + dw / 2, ch.z] };
        return { ch, s: [ch.x + L.inset, ch.z], e: [pkg.x - dw / 2, ch.z] };
      });
      const traces = (h, t) => lanes.forEach(({ ch, s, e }) => {
        const horiz = ch.side === 'l' || ch.side === 'r', o = centred(t.n, t.spread);
        for (let i = 0; i < t.n; i++) h.trace(horiz ? [[s[0], s[1] + o(i)], [e[0], e[1] + o(i)]] : [[s[0] + o(i), s[1]], [e[0] + o(i), e[1]]], t.width);
      });
      return { chips, lanes, traces, mlcc: () => [] };
    },
    rows(L, pkg) {
      const per = L.chips / 2, x = centred(per, L.pitch), cx = L.at != null ? L.at : pkg.x, chips = [];
      [1, -1].forEach(row => { for (let i = 0; i < per; i++) chips.push({ x: cx + x(i), z: pkg.z + row * L.dist, row }); });
      const lanes = chips.map(ch => ({ ch, s: [ch.x, ch.z - ch.row * L.inset], e: [cx + (ch.x - cx) * L.fan, pkg.z + ch.row * L.to] }));
      const traces = (h, t) => lanes.forEach(({ s, e }) => { const o = centred(t.n, t.spread); for (let i = 0; i < t.n; i++) h.trace([[s[0] + o(i), s[1]], [e[0] + o(i) * t.taper, e[1]]], t.width); });
      const mlcc = (n, pitch, d) => chips.flatMap(ch => Array.from({ length: n }, (_, i) => [ch.x + centred(n, pitch)(i), 0, ch.z + ch.row * d, 0]));
      return { chips, lanes, traces, mlcc };
    },
    package(L, pkg, perChip, die) {
      const per = L.chips / 2, x = centred(per, L.pitch), chips = [];
      [-L.dist, L.dist].forEach(dz => { for (let i = 0; i < per; i++) chips.push({ x: pkg.x + x(i), z: pkg.z + dz }); });
      const lx = centred(perChip, L.lanePitch), lanes = [];
      chips.forEach(ch => { const dir = sgn(pkg.z - ch.z); for (let k = 0; k < perChip; k++) lanes.push({ ch, s: [ch.x + lx(k), ch.z + dir * L.inset], e: [ch.x + lx(k), pkg.z - dir * die[1] / 2] }); });
      const traces = (h, t) => lanes.forEach(({ ch, s }) => { const o = centred(t.n, t.spread); for (let i = 0; i < t.n; i++) h.trace([[s[0] + o(i), ch.z], [s[0] + o(i), pkg.z + sgn(ch.z - pkg.z) * t.to]], t.width); });
      return { chips, lanes, traces, mlcc: () => [] };
    }
  };

  /* ---------- the case: what the open machine stands in ---------- */
  function buildCase(C, x) {
    if (C.type === 'card') {
      const m = x.mat.body = material(C.material);
      const [w, h, d, r] = C.plate, [cx, cz] = C.at;
      mesh(rbox(w, h, d, r), m, cx, h / 2, cz);
      if (C.edges) {                                               // a silver edge round the frame
        [-1, 1].forEach(s => mesh(new T.BoxGeometry(w, 0.05, 0.1), M.alu, cx, h + 0.025, cz + s * (d / 2 - 0.06), { noCast: true }));
        [-1, 1].forEach(s => mesh(new T.BoxGeometry(0.1, 0.05, d - 0.2), M.alu, cx + s * (w / 2 - 0.06), h + 0.025, cz, { noCast: true }));
      }
      if (C.opening) {                                             // the flow-through opening the air leaves by
        const [ox, or] = C.opening;
        mesh(new T.CylinderGeometry(or, or, 0.02, 40), M.black, ox, h + 0.015, cz, { noCast: true });
        const ring = new T.Mesh(new T.TorusGeometry(or + 0.03, 0.04, 8, 48), std(0x9aa0ac, 0.3, 1)); ring.rotation.x = Math.PI / 2; ring.position.set(ox, h + 0.03, cz); E.add(ring);
      }
      if (C.standoffs) {                                           // under the corners of a board [x0, x1, depth]
        const [x0, x1, bd] = C.standoffs;
        [[x0 + 0.25, -bd / 2 + 0.25], [x1 - 0.25, -bd / 2 + 0.25], [x0 + 0.25, bd / 2 - 0.25], [x1 - 0.25, bd / 2 - 0.25]].forEach(([sx, dz]) => mesh(new T.CylinderGeometry(0.12, 0.12, 0.14, 12), M.gold, sx, h + 0.07, cz + dz));
      }
      return;
    }
    // cutaway: a tray, the back and left walls kept, the other two cut away; corner > 0 rounds the tray and the corner
    // between the walls. back: foam | perforated | hex (a perforated sheet in a frame) | solid
    const W = C.w || 16.6, half = W / 2, body = x.mat.body = material(C.material);
    const red = C.trim === 'red', trim = x.mat.trim = red ? material('red') : M.dark;
    const [th, tt, ty] = red ? [0.07, 0.52, 5.34] : [0.06, 0.5, 5.31];
    if (C.corner) {
      const r = C.corner, round2 = body.clone(); round2.side = T.DoubleSide;
      const trayG = new T.ExtrudeGeometry(P.rrShape(W, W, r), { depth: 0.5, bevelEnabled: false, curveSegments: 12 });
      trayG.rotateX(-Math.PI / 2); mesh(trayG, body, 0, 0, 0);
      const back = backWall(C.back, body), len = W - 2 * r, off = 0.1, wx = -(half - 0.2), cc = -(half - r - 0.1);
      mesh(rbox(len, 4.8, 0.4, 0.12), back, off, 2.9, wx);
      mesh(rbox(0.4, 4.8, len, 0.12), body, wx, 2.9, off);
      mesh(new T.CylinderGeometry(r, r, 4.8, 20, 1, true, Math.PI, Math.PI / 2), round2, cc, 2.9, cc);
      mesh(new T.BoxGeometry(len, 0.06, 0.4), trim, off, 5.31, wx);
      mesh(new T.BoxGeometry(0.4, 0.06, len), trim, wx, 5.31, off);
      return;
    }
    mesh(rbox(W, 0.5, W, 0.2), body, 0, 0.25, 0);
    const wx = -(half - 0.25);
    if (C.back === 'hex') {
      const hex = E.canvasTex(2048, 512, (c, w, h) => {
        c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000';
        const k = w / 15.6, pitch = 0.62 * k, R = pitch / Math.sqrt(3) * 0.8, rowH = pitch * Math.sqrt(3) / 2;
        for (let r = 0, y = 0.45 * k; y < h - 0.4 * k; r++, y += rowH) {
          for (let cx = 0.45 * k + (r % 2 ? pitch / 2 : 0); cx < w - 0.4 * k; cx += pitch) {
            c.beginPath();
            for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(cx + R * Math.cos(a), y + R * Math.sin(a)); }
            c.fill();
          }
        }
      }, false);
      const sheetM = body.clone(); sheetM.alphaMap = hex; sheetM.alphaTest = 0.5; sheetM.side = T.DoubleSide; sheetM.userData.envTuned = true;
      const sheet = mesh(new T.PlaneGeometry(W - 1, 3.9), sheetM, 0.1, 2.95, wx);
      sheet.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaMap: hex, alphaTest: 0.5 });
      mesh(rbox(W, 0.5, 0.5, 0.1), body, 0, 0.75, wx);
      mesh(rbox(W, 0.42, 0.5, 0.1), body, 0, 5.1, wx);
      mesh(rbox(0.5, 4.8, 0.5, 0.1), body, -wx, 2.9, wx);
    } else mesh(rbox(W, 4.8, 0.5, 0.14), backWall(C.back, body), 0, 2.9, wx);
    mesh(rbox(0.5, 4.8, W, 0.14), body, wx, 2.9, 0);
    mesh(new T.BoxGeometry(W, th, tt), trim, 0, ty, wx);
    mesh(new T.BoxGeometry(tt, th, W), trim, wx, ty, 0);
    if (C.floorLine) {                                             // a coloured line along the open edges
      mesh(new T.BoxGeometry(W - 0.4, 0.05, 0.1), trim, 0, 0.52, half - 0.1, { noCast: true });
      mesh(new T.BoxGeometry(0.1, 0.05, W - 0.4), trim, half - 0.1, 0.52, 0, { noCast: true });
    }
  }
  function backWall(kind, body) {
    if (kind === 'foam') return M.foam;
    if (kind !== 'perforated') return body;
    const perf = E.canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#b0b0b0'; x.fillRect(0, 0, w, h); x.fillStyle = '#202020';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 9, 0, 7); x.fill(); }
    }, false);
    perf.wrapS = perf.wrapT = T.RepeatWrapping; perf.repeat.set(6, 2.4);
    return std(0x9aa0ac, 0.4, 1, { bumpMap: perf, bumpScale: 0.03, roughnessMap: perf, envMapIntensity: 0.5 });
  }

  /* ---------- the board: texture (random traces, the bus traces, copper pours, silkscreen), the slab, a card's edge ---------- */
  function boardTexture(B, x) {
    const [bx, bz] = B.at || [0, 0];
    const wrap = h => ({                                          // the recipe's art takes absolute scene coordinates
      ctx: h.ctx, px: v => h.px(v - bx), pz: v => h.pz(v - bz),
      trace: (pts, w) => h.trace(pts.map(([a, b]) => [a - bx, b - bz]), w), dot: (a, b, r, hole) => h.dot(a - bx, b - bz, r, hole),
      box: (a, b, w, d) => h.silk.box(a - bx, b - bz, w, d), text: (t, a, b, size) => h.silk.text(t, a - bx, b - bz, size)
    });
    const pours = h => { if (!B.pours) return; h.ctx.fillStyle = B.pours.color; B.pours.rects.forEach(([a, b, w, d]) => h.ctx.fillRect(h.px(a), h.pz(b), h.px(a + w) - h.px(a), h.pz(b + d) - h.pz(b))); };
    const t = Object.assign({ n: 9, spread: 0.085, width: 3, under: 0.2, bend: 0.25, taper: 0.8, to: 1.5 }, B.traces);
    const lanes = h => x.layout.traces(h, t);
    const holes = h => { if (!B.holes) return; const [at, r, hole] = B.holes; [[-at, -at], [at, -at], [-at, at], [at, at]].forEach(([a, b]) => h.dot(bx + a, bz + b, r, hole)); };
    const art = h => { if (B.art) B.art(h, x); };
    return P.pcb(B.w, B.d, h => { const H = wrap(h); if (!B.under) { pours(H); lanes(H); } if (B.under) holes(H); art(H); if (!B.under) holes(H); },
      { base: B.color || '#0b1220', gold: B.gold, traces: B.random[0], vias: B.random[1], under: B.under ? h => { const H = wrap(h); pours(H); lanes(H); } : null });
  }
  function boardSlab(B, y0, tex) {
    const [bx, bz] = B.at || [0, 0], color = parseInt((B.color || '#0b1220').slice(1), 16);
    if (tex) P.board(B.w, B.d, y0, tex, bx, bz, B.color ? color : undefined);
    else mesh(new T.BoxGeometry(B.w, 0.16, B.d), std(color, 0.6, 0.1), bx, y0 - 0.08, bz);
    if (B.edge) {                                                  // a graphics card's PCIe tab and gold fingers
      const [tx, tz, tw, td] = B.edge.tab, f = B.edge.fingers, list = [];
      mesh(new T.BoxGeometry(tw, 0.16, td), std(color, 0.6, 0.1), tx, y0 - 0.08, tz);
      for (let i = 0; i < f.n; i++) if (i !== f.skip) list.push([f.x + i * f.pitch, y0 + 0.004, f.z]);
      scatter(new T.BoxGeometry(f.size[0], 0.012, f.size[1]), M.gold, list);
    }
  }

  /* ---------- the chip package: substrate, dies, a bridge, strips, blocks of cores, tiny parts on the edge ---------- */
  function buildChip(C, x) {
    const [cx, cz] = C.at, [sw, sd, sh = 0.22, sr = 0.06] = C.substrate, y0 = x.y0;
    mesh(rbox(sw, sh, sd, sr), M.substrate, cx, y0 + sh / 2, cz);
    const dieY = x.dieY = y0 + sh, tileTop = x.tileTop = dieY + 0.126;
    C.dies.forEach(([dx, dz, w, d]) => mesh(rbox(w, 0.12, d, 0.03), M.die, dx, dieY + 0.06, dz));
    if (C.bridge) { const [bx, bz, w, d] = C.bridge; mesh(new T.BoxGeometry(w, 0.1, d), M.gold, bx, dieY + 0.07, bz); }
    if (C.strips) { const m = std(C.strips.color, 0.35, 0.8); C.strips.list.forEach(([a, b, w, d]) => mesh(new T.BoxGeometry(w, 0.014, d), m, a, tileTop - 0.002, b)); }
    const gpu = [], cpu = [];
    const corner = (B, a, b) => (a === 0 || a === B.grid[0] - 1) && (b === 0 || b === B.grid[1] - 1);
    C.blocks.forEach(B => {
      const color = B.color ? new T.Color(...B.color) : B.kind === 'cpu' ? new T.Color(0.05, 0.06, 0.12) : null;
      const skip = B.skip === 'corners' ? (a, b) => corner(B, a, b) : B.skip === 'not-corners' ? (a, b) => !corner(B, a, b) : undefined;
      const im = P.tiles(B.at[0], B.at[1], B.grid[0], B.grid[1], B.tile[0], B.tile[1], B.pitch[0], B.pitch[1], tileTop, color, skip);
      if (B.kind === 'gpu') gpu.push(im); else if (B.kind === 'cpu') cpu.push(im);
    });
    if (C.smalls) {
      const s = C.smalls, list = [];
      for (let i = 0; i < s.n; i++) { list.push([cx + s.from + i * s.pitch, dieY + 0.03, cz + s.edge]); list.push([cx + s.from + i * s.pitch, dieY + 0.03, cz - s.edge]); }
      scatter(new T.BoxGeometry(0.16, 0.06, 0.1), std(0xb9a27a, 0.35, 0.7), list);
    }
    x.gpu = gpu; x.cpu = cpu;
  }

  /* ---------- power: inductors, polymer caps, the power connector, ceramic caps, resistors ---------- */
  function buildPower(Pw, x) {
    const y0 = x.y0;
    P.inductors((Pw.inductors || []).flatMap(g => grid(g, y0 + 0.3)), y0);
    if (Pw.caps) P.polymerCaps(Pw.caps.flatMap(g => grid(g, y0 + 0.31)), y0);
    if (Pw.connector) {                                            // 12V-2x6 / 16-pin
      const [px, pz] = Pw.connector, pins = [];
      mesh(rbox(1.5, 0.62, 0.8, 0.05), M.black, px, y0 + 0.31, pz);
      for (let a = 0; a < 6; a++) for (let b = 0; b < 2; b++) pins.push([px - 0.45 + a * 0.18, y0 + 0.63, pz - 0.15 + b * 0.3]);
      scatter(new T.BoxGeometry(0.1, 0.02, 0.18), M.epoxy, pins);
    }
    const mlcc = [];
    (Pw.mlcc || []).forEach(m => {
      if (m.grid) mlcc.push(...grid(m.grid, y0 + 0.05, m.rot));
      else if (m.perChip) x.layout.mlcc(m.perChip, m.pitch, m.d).forEach(p => mlcc.push([p[0], y0 + 0.05, p[2], p[3]]));
      else if (m.ring) {                                           // rows of caps along the sides of a rectangle round [x, z]
        const [rx, rz] = m.ring, sides = m.sides || 'tblr', from = m.from != null ? m.from : -(m.n - 1) / 2 * m.pitch;
        for (const side of sides) for (let row = 0; row < (m.rows || 1); row++) for (let i = 0; i < m.n; i++) {
          const t = from + i * m.pitch, d = m.d + row * (m.rowPitch || 0);
          const p = { t: [t, d], b: [t, -d], r: [d, t], l: [-d, t] }[side];
          mlcc.push([rx + p[0], y0 + 0.05, rz + p[1], side === 'l' || side === 'r' ? Math.PI / 2 : 0]);
        }
      }
    });
    if (mlcc.length) P.ceramicCaps(mlcc);
    if (Pw.resistors) P.resistors(Pw.resistors.flatMap(g => grid(g, y0 + 0.03)));
  }

  /* ---------- other parts: { part, ... } in the recipe's order; outside: true ones show beside a closed shell ---------- */
  const PARTS = {
    ssd(p, x) {                                                    // an M.2 SSD with its sticker; turn: runs front to back
      const o = p.turn ? { x: 0, z: 0 } : { x: p.at[0], z: p.at[1] }; if (p.lines) o.lines = p.lines;
      if (!p.turn) { x.ssdY = P.ssd(x.y0, o).SSD_Y; return; }
      const g = new T.Group(); x.group.add(g); E.setParent(g);
      x.ssdY = P.ssd(x.y0, o).SSD_Y;
      E.setParent(x.parent); g.position.set(p.at[0], 0, p.at[1]); g.rotation.y = Math.PI / 2;
    },
    nic(p, x) { P.nic(x.y0, p.at[0], p.at[1]); },
    ports(p, x) { P.ports(x.y0, p.offset ? p.offset[0] : 0, p.offset ? p.offset[1] : 0); },
    portRow(p, x) { P.portRow(p.y != null ? p.y : x.y0, p.list); },
    ic(p, x) { const [w, h, d] = p.size; mesh(rbox(w, h, d, p.r || 0.03), M.epoxy, p.at[0], x.y0 + h / 2, p.at[1]); },
    coin(p, x) {
      mesh(new T.CylinderGeometry(0.62, 0.62, 0.1, 28), M.black, p.at[0], x.y0 + 0.05, p.at[1]);
      mesh(new T.CylinderGeometry(0.55, 0.55, 0.12, 28), M.alu, p.at[0], x.y0 + 0.14, p.at[1]);
    },
    wifi(p, x) {                                                   // an M.2 2230 Wi-Fi card, its shield, antenna pads, the slot
      const [a, b] = p.at, y0 = x.y0;
      mesh(rbox(2.6, 0.08, 1.7, 0.03), M.ssd, a, y0 + 0.3, b);
      mesh(rbox(1.3, 0.12, 1.1, 0.03), M.alu, a - 0.2, y0 + 0.4, b);
      [-0.1, 0.3].forEach(dx => mesh(new T.CylinderGeometry(0.1, 0.1, 0.08, 12), M.gold, a + 0.9 + dx, y0 + 0.38, b - 0.45));
      mesh(new T.BoxGeometry(0.4, 0.3, 1.9), M.black, a - 1.45, y0 + 0.15, b);
    },
    boxes(p, x) { const [w, h, d] = p.size; p.list.forEach(([a, b]) => mesh(new T.BoxGeometry(w, h, d), material(p.material || 'alu'), a, x.y0 + p.y, b)); },
    bracket(p) { mesh(rbox(0.12, 2.6, 7.8, 0.04), M.alu, p.at[0], 1.3, p.at[1]); },
    subBoard(p) { mesh(rbox(p.size[0], 0.12, p.size[1], 0.03), std(p.color, 0.6, 0.1), p.at[0], p.y, p.at[1]); },
    pcieBoard(p) {                                                 // PCIe fingers on their own small board, a ribbon cable to the main board
      const [a, b] = p.at, y = p.y, fingers = [];
      mesh(rbox(3.4, 0.12, 0.9, 0.03), std(0x07080b, 0.6, 0.1), a, y, b);
      for (let i = 0; i < 26; i++) fingers.push([a - 1.55 + i * 0.124, y + 0.065, b + 0.3]);
      scatter(new T.BoxGeometry(0.08, 0.012, 0.3), M.gold, fingers);
      const rib = new T.Mesh(new T.BoxGeometry(1.6, 0.03, 0.7), std(0x8a8f99, 0.6, 0.2)); rib.position.set(p.ribbon[0], 0.56, p.ribbon[1]); rib.rotation.set(0, 0.5, 0.18); rib.castShadow = true; E.add(rib);
    }
  };

  /* ---------- coolers, lifted off in the exploded view; rig() seats them on the chip while the machine is closed ---------- */
  const COOLERS = {
    // a copper plate, three heat pipes back to a fin stack, one fan on top (DGX Spark)
    tower(C, x) {
      const g = sub(x); P.cooler(C.y); const fan = P.fan(V(...C.fan)); E.setParent(x.parent);
      return { fans: [fan], parts: [{ g, seat: [0, C.seat, 0] }] };
    },
    // one big copper heatsink, two blowers behind it (M3 Ultra)
    heatsink(C, x) {
      const g = sub(x), [hx, hz] = C.at, [w, d] = C.plate, f = C.fins;
      mesh(rbox(w, 0.36, d, 0.08), M.copper, hx, C.y, hz);
      const fins = []; for (let i = 0; i < f.n; i++) fins.push([f.from + i * f.pitch, C.y + f.dy, hz]);
      scatter(new T.BoxGeometry(...f.size), M.copper, fins, true);
      const fans = C.fans.map(p => P.fan(V(...p), C.fanK));
      E.setParent(x.parent);
      return { fans, parts: [{ g, seat: [0, C.seat, 0] }] };
    },
    // a vapour chamber, a stack of flat fins, four heat pipes up the sides, one big fan (Strix Halo)
    stack(C, x) {
      const g = sub(x), [fx, fz] = C.at, y = C.y;
      mesh(rbox(5.4, 0.3, 4.4, 0.08), M.copper, fx, y, fz);
      const fins = []; for (let i = 0; i < 16; i++) fins.push([fx, y + 0.38 + i * 0.1, fz]);
      scatter(new T.BoxGeometry(6.4, 0.035, 5.0), M.alu, fins, true);
      [-1, 1].forEach(s => [-1.3, 1.3].forEach(dz => P.heatPipe([[fx + s * 1.8, y + 0.1, fz + dz], [fx + s * 3.0, y + 0.12, fz + dz], [fx + s * 3.42, y + 0.6, fz + dz], [fx + s * 3.42, y + 1.9, fz + dz]])));
      const fan = P.fan(V(fx, y + 2.3, fz), C.fanK);
      E.setParent(x.parent);
      return { fans: [fan], parts: [{ g, seat: [0, C.seat, 0] }] };
    },
    // a graphics card's cooler in two pieces: the plate over the die and the fin block with its fans, heat pipes laid
    // again between them as they move (RTX 5090)
    split(C, x) {
      const [gx, gz] = x.R.chip.at, y = C.y, fz = C.finZ;
      const plateG = sub(x); mesh(rbox(4.6, 0.32, 4.6, 0.08), M.copper, gx, y, gz);
      const finG = sub(x), fins = [];
      for (let i = 0; i < 56; i++) fins.push([-7.15 + i * 0.26, 6.9, fz]);
      scatter(new T.BoxGeometry(0.05, 1.8, 5.2), M.alu, fins, true);
      const fans = C.fans.map(fx => P.fan(V(fx, 8.1, fz), C.fanK));
      E.setParent(x.parent);
      const DX = [-1.2, -0.4, 0.4, 1.2], pipes = DX.map(() => mesh(new T.BufferGeometry(), M.copper, 0, 0, 0));
      function layPipes() {
        const a = plateG.position, b = finG.position;
        DX.forEach((dx, k) => {
          const pts = [[gx + dx, y + 0.22 + a.y, gz + 1.6 + a.z], [gx + dx, y + 0.22 + a.y, gz - 1.6 + a.z], [gx + dx * 2.6, 6.2 + 0.25 * k + b.y, -2.0 + b.z], [gx + dx * 3.4, 6.2 + 0.25 * k + b.y, -7.4 + b.z]];
          pipes[k].geometry.dispose();
          pipes[k].geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => V(...q))), 60, 0.17, 12);
        });
      }
      return { fans, parts: [{ g: plateG, seat: [0, C.seat[0], 0], y: [0.3, 0.85] }, { g: finG, seat: [0, C.seat[1], C.seat[2]], y: [0.3, 0.72], z: [0.5, 1] }], pipes: layPipes };
    },
    // a double flow-through card: a vapour chamber, heat pipes out to a fin stack and a fan at each end (RTX Pro 6000)
    flow(C, x) {
      const g = sub(x), [gx, gz] = x.R.chip.at, y = C.y;
      mesh(rbox(4.6, 0.3, 4.6, 0.08), M.copper, gx, y, gz);
      [-1.2, -0.4, 0.4, 1.2].forEach(dz => C.ends.forEach(fx => P.heatPipe([[gx + Math.sign(fx) * 1.4, y + 0.2, gz + dz], [gx + Math.sign(fx) * 2.9, y + 0.4, gz + dz], [fx - Math.sign(fx) * 1.2, y + 0.8, gz + dz], [fx + Math.sign(fx) * 1.3, y + 0.85, gz + dz]], 0.15)));
      const fins = []; C.ends.forEach(fx => { for (let i = 0; i < 26; i++) fins.push([fx - 1.55 + i * 0.124, y + 0.85, gz]); });
      scatter(new T.BoxGeometry(0.04, 1.7, 6.6), M.alu, fins, true);
      const fans = C.ends.map(fx => P.fan(V(fx, y + 2.05, gz), C.fanK));
      E.setParent(x.parent);
      return { fans, parts: [{ g, seat: [0, C.seat, 0] }] };
    }
  };
  function sub(x) { const g = new T.Group(); x.group.add(g); E.setParent(g); return g; }
  // dashed exploded-view lines from the cooler's corners down to the chip
  function guides(G, x) {
    const m = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    const [hx, hz] = G.half, [fx, fz] = G.from, [tx, tz] = G.to, [sx, sz] = G.scale, y0 = x.R.cooler.y - 0.2, y1 = x.dieY + (G.dy != null ? G.dy : 0.02);
    [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].forEach(([a, b]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([V(fx + a, y0, fz + b), V(tx + a * sx, y1, tz + b * sz)]), m);
      l.computeLineDistances(); E.add(l);
    });
    return m;
  }

  /* ---------- the shell: a lid over a desktop box, or a fan cover over a card. Stylized: no logos ---------- */
  function buildShell(Sh, x) {
    const lid = x.lid = new T.Group(); x.group.add(lid); E.setParent(lid);
    const glow = [];
    let grab;
    if (Sh.type === 'cover') {
      const m = std(Sh.color, Sh.rough, Sh.metal, { envMapIntensity: 0.8 }); m.userData.envTuned = true; glow.push(m);
      const [x0, x1] = Sh.x, [z0, z1] = Sh.z, [y0, top] = Sh.y, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      grab = mesh(S.block(S.rounded(Sh.round), x1 - x0, z1 - z0, y0, top, Sh.bevel, Sh.fans.map(([fx, fz, r]) => [fx - cx, fz - cz, r])), m, cx, 0, cz);
      Sh.fans.forEach(([fx, fz, r, rr, rt, seg]) => { const ring = mesh(new T.TorusGeometry(rr, rt, 10, seg), M.alu, fx, top, fz); ring.rotation.x = Math.PI / 2; });
      if (Sh.stripe) { const s = std(0xf2c230, 0.5, 0.1); s.userData.envTuned = true; glow.push(s); mesh(new T.BoxGeometry(x1 - x0 - 1.4, 0.03, 0.32), s, cx, top + 0.005, z1 - 0.55, { noCast: true }); }
      if (Sh.lines) {
        const lm = new T.MeshBasicMaterial({ color: new T.Color(COLOR[Sh.lines.color]).multiplyScalar(0.9) });
        [z0 + 0.45, z1 - 0.45].forEach(z => mesh(new T.BoxGeometry(Sh.lines.w, 0.02, 0.1), lm, Sh.lines.x, top + 0.005, z, { noCast: true }));
      }
      x.shellTop = top;
    } else {
      // a box lid: outline rounded or chamfered, 17.1 across, h tall
      const SZ = Sh.size || 17.1, H = Sh.h, [kind, r] = Sh.outline, outline = k => kind === 'rounded' ? S.rounded(k) : S.chamfered(k);
      let darkM = null; const dark = () => darkM || (darkM = std(0x15161b, 0.6, 0.3));
      if (Sh.perf || Sh.grille) dark();                            // made first, as the hand-built Spark did
      const shellM = material(Sh.material); glow.push(shellM);
      let insetM = null;
      if (Sh.inset) { insetM = std(0x7d6440, 0.42, 0.85, { roughnessMap: M.gold.roughnessMap, envMapIntensity: 0.45 }); insetM.userData.envTuned = true; glow.push(insetM); }
      grab = mesh(S.block(outline(r), SZ, SZ, 0.02, H, Sh.bevel), shellM, 0, 0, 0);
      if (Sh.inset) mesh(rbox(Sh.inset, 0.06, Sh.inset, 0.4), insetM, 0, H + 0.01, 0);
      if (Sh.perf) { const [nx, nz, x0, z0, pitch, pr] = Sh.perf, pts = []; for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) pts.push([x0 + a * pitch, H + 0.045, z0 + b * pitch]); scatter(new T.CylinderGeometry(pr, pr, 0.02, 10), dark(), pts, false); }
      if (Sh.grille) {                                             // a dark front grille with slats: { at, size, slats: [n, first y, pitch] }
        const G = Sh.grille, [gx, gy] = G.at, [gw, gh] = G.size, [n, s0, sp] = G.slats, slats = [];
        mesh(new T.BoxGeometry(gw, gh, 0.08), dark(), gx, gy, SZ / 2 + 0.01, { noCast: true });
        for (let i = 0; i < n; i++) slats.push([gx, s0 + i * sp, SZ / 2 + 0.07]);
        scatter(new T.BoxGeometry(gw - 0.3, 0.13, 0.1), insetM, slats, false);
      }
      if (Sh.seam) { const m = std(0x121318, 0.6, 0.3); x.seamM = m; mesh(S.band(outline(r + 0.02), SZ + 0.04, SZ + 0.04, 0.12, 0.08), m, 0, Sh.seam, 0, { noCast: true }); }
      if (Sh.ventRings) {
        const [rings, dz] = Sh.ventRings, holes = [];
        rings.forEach(([rr, n]) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rr; holes.push([Math.cos(a) * rr, H + 0.005, Math.sin(a) * rr + dz]); } });
        scatter(new T.CylinderGeometry(0.14, 0.14, 0.02, 12), x.seamM, holes, false);
      }
      if (Sh.trim) { const tm = x.mat.trim.clone(); glow.push(tm); mesh(S.band(outline(r + 0.03), SZ + 0.06, SZ + 0.06, 0.1, 0.12), tm, 0, H - Sh.trim, 0, { noCast: true }); }
      if (Sh.hexVent) {
        const [size, vx, vz] = Sh.hexVent;
        const vent = E.canvasTex(1024, 1024, (c, w, h) => {
          c.fillStyle = '#4a4f5b'; c.fillRect(0, 0, w, h); c.fillStyle = '#0c0d10';
          const pitch = w / 22, R = pitch / Math.sqrt(3) * 0.78, rowH = pitch * Math.sqrt(3) / 2;
          for (let rr = 0, y = pitch * 0.6; y < h - pitch * 0.4; rr++, y += rowH) for (let cx = pitch * 0.6 + (rr % 2 ? pitch / 2 : 0); cx < w - pitch * 0.4; cx += pitch) {
            c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(cx + R * Math.cos(a), y + R * Math.sin(a)); } c.fill();
          }
        }, true);
        const vm = std(0xffffff, 0.55, 0.6, { map: vent, envMapIntensity: 0.4 }); vm.userData.envTuned = true;
        const vp = mesh(new T.PlaneGeometry(size, size), vm, vx, H + 0.006, vz, { noCast: true }); vp.rotation.x = -Math.PI / 2;
      }
      x.shellTop = H;
    }
    if (Sh.light) {                                                // a status light: a round dot or a bar
      const L = Sh.light, lm = new T.MeshBasicMaterial({ color: new T.Color(COLOR[L.color]).multiplyScalar(L.glow || 1.3) });
      if (L.dot) mesh(new T.CylinderGeometry(L.dot, L.dot, 0.06, 16), lm, ...L.at, { noCast: true }).rotation.x = Math.PI / 2;
      else mesh(new T.BoxGeometry(L.bar[0], L.bar[1], 0.05), lm, ...L.at, { noCast: true });
    }
    const plate = S.plate(x.R.plate);
    E.setParent(x.parent);
    return { lid, grab, glow, plate };
  }

  /* ---------- heights by name in a recipe's points ---------- */
  function at(p, x) {
    const y = p[1];
    if (typeof y === 'number') return V(p[0], y, p[2]);
    const m = /^(\w+)([+-][\d.]+)?$/.exec(y), base = { board: x.y0, die: x.dieY, sub: x.dieY, tile: x.tileTop, cell: x.mem && x.mem.CELL_Y, ssd: x.ssdY, fan: x.fanY }[m[1]];
    return V(p[0], base + (m[2] ? parseFloat(m[2]) : 0), p[2]);
  }

  function context(R, group) {
    const L = R.memory, perChip = R.bus.bits / 32 / L.chips;
    const die = R.chip.dies[0] ? [R.chip.dies[0][2], R.chip.dies[0][3]] : [0, 0];
    const pkg = { x: R.chip.at[0], z: R.chip.at[1] };
    const layout = LAYOUTS[L.layout](L, pkg, perChip, die);
    if (L.layout !== 'package' && perChip !== 1) console.warn('recipe ' + R.id + ': ' + R.bus.bits + '-bit bus over ' + L.chips + ' chips is not one lane per chip');
    return { R, group, parent: group, y0: R.y0, layout, mat: {}, chips: layout.chips };
  }

  /* ---------- the whole machine ---------- */
  function build(R) {
    const group = new T.Group(); E.scene.add(group); E.setParent(group);
    const x = context(R, group), y0 = R.y0;
    buildCase(R.case, x);
    boardSlab(R.board, y0, boardTexture(R.board, x));
    buildChip(R.chip, x);
    const memY = R.memory.layout === 'package' ? x.dieY : y0;
    const mem = x.mem = P.memory(x.chips, memY, R.memory.chip);
    if (R.memory.under) x.chips.forEach(ch => { const c = Object.assign({ w: 1.5, d: 1.85 }, R.memory.chip); mesh(rbox(ch.rot ? c.d : c.w, 0.12, ch.rot ? c.w : c.d, 0.03), M.epoxy, ch.x, R.memory.under, ch.z, { noCast: true }); });
    const busOpts = Object.assign({}, R.bus); delete busOpts.bits;
    const bus = DSP.board.bus(x.layout.lanes.map(L => ({ s: V(L.s[0], memY + 0.02, L.s[1]), e: V(L.e[0], memY + 0.02, L.e[1]) })), memY, busOpts);
    buildPower(R.power, x);
    (R.parts || []).forEach(p => PARTS[p.part](p, x));
    const cool = COOLERS[R.cooler.type](R.cooler, x);
    x.fanY = cool.fans[0].fan.position.y - 0.22;
    const dashM = guides(R.cooler.guides, x);
    const sh = buildShell(R.shell, x);
    const mug = S.mug(R.width / R.mm, R.mug[0], R.mug[1], -Math.PI / 4);
    const rig = S.rig({ lid: sh.lid, parts: cool.parts, guides: dashM, glow: sh.glow, pipes: cool.pipes });

    P.tuneEnv();

    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const labels = R.labels.map(([id, p, title]) => ({ id, at: at(p, x), title }));
    const [mx, mz, mw, md] = R.chip.marker;
    const animate = DSP.board.lightUp({ mem, gpu: x.gpu.length === 1 ? x.gpu[0] : x.gpu, cpu: x.cpu.length ? (x.cpu.length === 1 ? x.cpu[0] : x.cpu) : null, bus, fans: cool.fans, gpuBox: [mx, mz, mw, md, x.dieY + 0.14], loadFrom: at(R.load, x), loadP, outP, spillP });
    E.setParent(null);

    const o = R.out;
    return {
      group, animate, labels, outP, spillP, mug, lid: sh.lid,
      shell: { rig, grab: [sh.grab], plate: sh.plate, hint: at(R.shell.hint, x), what: R.shell.type === 'cover' ? 'cover' : 'lid' },
      chips: R.chipsText, busBits: R.bus.bits,
      notes: R.notes, loadingLabel: R.loadingLabel || 'ssd',
      out: { from: at(o.from, x), spread: o.spread, mid: at(o.mid, x), to: at(o.to, x) },
      glowAt: R.glowAt, heatAt: R.heatAt,
      shots: R.shots
    };
  }

  // The closed outside only, for a machine that stays shut (the showroom): the lid and its plate, and for a card the
  // case, a plain board and the parts marked outside. No textures but the plate's, no cooler, no mug.
  function shellOnly(R) {
    const group = new T.Group(); E.scene.add(group); E.setParent(group);
    const x = context(R, group);
    if (R.case.type === 'card') {
      buildCase(R.case, x); boardSlab(R.board, R.y0, null);
      (R.parts || []).filter(p => p.outside).forEach(p => PARTS[p.part](p, x));
    } else if (R.case.trim === 'red') x.mat.trim = material('red');
    x.y0 = R.y0; x.dieY = R.y0 + 0.22; x.tileTop = x.dieY + 0.126;
    const sh = buildShell(R.shell, x);
    P.tuneEnv();
    E.setParent(null);
    return { group, plate: sh.plate, grab: [sh.grab], lid: sh.lid, top: x.shellTop };
  }

  function machine(R) {
    DSP.machines = DSP.machines || {};
    DSP.machines[R.id] = { build: () => build(R), shellOnly: () => shellOnly(R), name: R.name, recipe: R };
  }

  DSP.recipe = { build, shellOnly, machine, LAYOUTS, COOLERS, PARTS };
})(window.DSP = window.DSP || {});
