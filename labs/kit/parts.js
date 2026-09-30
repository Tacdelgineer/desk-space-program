/* =========================================================
   PARTS: rounded boxes, the material library, and a builder for each kind of part
   (main chip, memory package, inductor, capacitor, SSD, ports, heat pipe, fan...).
   A machine file in machines/ decides where each one sits.
   Y0 is the top of the board, x and z are on the board plane.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.engine) return;
  const E = DSP.engine, T = E.T, scene = E.scene, add = E.add, mesh = E.mesh, std = E.std, canvasTex = E.canvasTex;

  function rrShape(w, d, r) {
    const s = new T.Shape(), x = -w / 2, y = -d / 2; r = Math.max(0.0005, Math.min(r, w / 2, d / 2));
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  const geoCache = {};
  function rbox(w, h, d, r) {
    const k = [w, h, d, r].map(v => v.toFixed(3)).join('|');
    if (geoCache[k]) return geoCache[k];
    r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    const depth = Math.max(0.001, h - 2 * r);
    const g = new T.ExtrudeGeometry(rrShape(w - 2 * r, d - 2 * r, r * 0.8), { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 5 });
    g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0); g.computeVertexNormals();
    geoCache[k] = g; return g;
  }
  // instanced helper for small parts: list of [x, y, z, rotationY]
  function scatter(geo, mat, list, cast) {
    const im = new T.InstancedMesh(geo, mat, list.length); const o = new T.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3] || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = !!cast; im.receiveShadow = true; add(im); return im;
  }

  /* ---------- material library ---------- */
  const foamBump = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const cx = Math.random() * w, cy = Math.random() * h, r = 4 + Math.random() * 11;
      x.fillStyle = '#2e2e2e'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.strokeStyle = '#d2d2d2'; x.lineWidth = 1.6; x.stroke();
    }
  }, false);
  foamBump.wrapS = foamBump.wrapT = T.RepeatWrapping; foamBump.repeat.set(3, 1);
  const brushed = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#909090'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 110 + Math.random() * 60; x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; x.fillRect(0, Math.random() * h, w, 1); }
  }, false);
  brushed.wrapS = brushed.wrapT = T.RepeatWrapping;

  const M = {
    plinth: std(0x0a0b12, 0.42, 0.3, { envMapIntensity: 0.12 }),
    gold: std(0xb8914f, 0.28, 1, { roughnessMap: brushed, envMapIntensity: 0.55 }),
    foam: std(0xae8a4c, 0.6, 1, { bumpMap: foamBump, bumpScale: 0.06, envMapIntensity: 0.45 }),
    dark: std(0x1a1b22, 0.45, 0.6, { envMapIntensity: 0.6 }),
    epoxy: std(0x111217, 0.32, 0.15, { envMapIntensity: 0.9 }),
    substrate: std(0x283530, 0.5, 0.15, { envMapIntensity: 0.6 }),
    die: new T.MeshPhysicalMaterial({ color: 0x171923, roughness: 0.16, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
    ind: std(0x3d4049, 0.5, 0.35, { envMapIntensity: 0.7 }),
    indTop: std(0x26282f, 0.6, 0.2),
    capBody: std(0x1b1c23, 0.4, 0.2),
    alu: std(0x9aa0ac, 0.34, 1, { roughnessMap: brushed, envMapIntensity: 0.5 }),
    copper: std(0xb3693a, 0.26, 1, { envMapIntensity: 0.6 }),
    mlcc: std(0xa9865d, 0.5, 0.1),
    black: std(0x0c0d11, 0.5, 0.1),
    ssd: std(0x0d2621, 0.5, 0.2)
  };

  // Call once, after everything is in the scene: the environment map lights dark surfaces too much,
  // so every material except the metals and the stand gets 0.55x (HANDOFF gotcha 4).
  function tuneEnv() {
    scene.traverse(o => { const m = o.material; if (m && m.envMapIntensity !== undefined && !m.userData.envTuned && m !== M.gold && m !== M.foam && m !== M.alu && m !== M.copper && m !== M.plinth) { m.envMapIntensity *= 0.55; m.userData.envTuned = true; } });
  }

  /* ---------- the display stand: plinth, placard, glowing floor edge. Returns setName(text) for the placard ---------- */
  function stand(placardLeft, placardRight) {
    mesh(rbox(30, 3, 30, 0.5), M.plinth, 0, -1.5, 0);
    const draw = right => (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(160,168,220,.75)';
      x.font = '500 66px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      x.fillText(placardLeft, 16, h / 2);
      x.fillStyle = 'rgba(255,201,60,.8)'; x.fillText(right, w - 420, h / 2);
    };
    const map = canvasTex(2048, 154, draw(placardRight), true);
    const placard = new T.Mesh(new T.PlaneGeometry(18, 1.35), new T.MeshStandardMaterial({ map, transparent: true, roughness: 0.6, metalness: 0.3 }));
    placard.position.set(0, -1.5, 15.02); scene.add(placard);
    // thin glowing edge on the floor, front and right
    const edgeM = new T.MeshBasicMaterial({ color: new T.Color(0x27f2d2).multiplyScalar(0.9) });
    mesh(new T.BoxGeometry(31.2, 0.05, 0.08), edgeM, 0, -2.97, 15.6, { noCast: true });
    mesh(new T.BoxGeometry(0.08, 0.05, 31.2), edgeM, 15.6, -2.97, 0, { noCast: true });
    return { setName(right) { const c = map.image; draw(right)(c.getContext('2d'), c.width, c.height); map.needsUpdate = true; } };
  }

  /* ---------- a board: canvas texture with random routed traces and vias, then draw(helpers) for the machine's own
     buses and silkscreen. w x d in scene units; helpers take scene coordinates relative to the board centre. ---------- */
  function pcb(w, d, draw, o) {
    o = Object.assign({ base: '#0b1220', traces: 260, vias: 500, S: 2048 }, o);
    const SX = o.S, SZ = Math.round(o.S * d / w), k = SX / w;
    const px = x => (x + w / 2) * k, pz = z => (z + d / 2) * k;
    const cc = document.createElement('canvas'), mc = document.createElement('canvas'), rc = document.createElement('canvas');
    [cc, mc, rc].forEach(c => { c.width = SX; c.height = SZ; });
    const c = cc.getContext('2d'), m = mc.getContext('2d'), r = rc.getContext('2d');
    c.fillStyle = o.base; c.fillRect(0, 0, SX, SZ);
    m.fillStyle = '#000'; m.fillRect(0, 0, SX, SZ);
    r.fillStyle = 'rgb(150,150,150)'; r.fillRect(0, 0, SX, SZ);
    for (let i = 0; i < 9000 * SZ / SX; i++) { c.fillStyle = 'rgba(120,150,210,' + (Math.random() * 0.03) + ')'; c.fillRect(Math.random() * SX, Math.random() * SZ, 3, 3); }
    const gold = o.gold || '#b8955a';
    function trace(pts, wd) {
      [[c, gold], [m, '#fff'], [r, 'rgb(70,70,70)']].forEach(([ctx, col]) => {
        ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(px(p[0]), pz(p[1])) : ctx.moveTo(px(p[0]), pz(p[1]))); ctx.stroke();
      });
    }
    function dot(x, z, rad, hole) {
      [[c, gold], [m, '#fff'], [r, 'rgb(60,60,60)']].forEach(([ctx, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(x), pz(z), rad, 0, 7); ctx.fill(); });
      if (hole) { c.fillStyle = '#05070c'; c.beginPath(); c.arc(px(x), pz(z), hole, 0, 7); c.fill(); m.fillStyle = '#000'; m.beginPath(); m.arc(px(x), pz(z), hole, 0, 7); m.fill(); }
    }
    const dirs = [[1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707]];
    for (let i = 0; i < o.traces; i++) {
      let x = (Math.random() - 0.5) * (w - 1), z = (Math.random() - 0.5) * (d - 1), dd = Math.floor(Math.random() * 4) * 2;
      const pts = [[x, z]];
      for (let s = 0; s < 3 + Math.floor(Math.random() * 4); s++) {
        const L = 0.25 + Math.random() * 1.6; x += dirs[dd][0] * L; z += dirs[dd][1] * L; pts.push([x, z]);
        dd = (dd + (Math.random() < 0.5 ? 1 : 7)) % 8;
      }
      trace(pts, Math.random() < 0.15 ? 5 : 2.2);
      dot(pts[pts.length - 1][0], pts[pts.length - 1][1], 5, 2.2);
    }
    for (let i = 0; i < o.vias; i++) dot((Math.random() - 0.5) * (w - 0.6), (Math.random() - 0.5) * (d - 0.6), 4, 1.8);
    const silk = { box(x, z, bw, bd) { c.strokeStyle = 'rgba(225,230,255,.55)'; c.lineWidth = 3; c.strokeRect(px(x - bw / 2), pz(z - bd / 2), bw * k, bd * k); },
      text(t, x, z, size) { c.fillStyle = 'rgba(225,230,255,.6)'; c.font = (size > 32 ? '500 ' : '600 ') + (size || 30) + 'px "IBM Plex Mono", monospace'; c.fillText(t, px(x), pz(z)); } };
    if (draw) draw({ trace, dot, px, pz, ctx: c, silk });
    const mk = cv => { const t = new T.CanvasTexture(cv); t.anisotropy = Math.min(8, E.renderer.capabilities.getMaxAnisotropy()); return t; };
    const map = mk(cc); map.encoding = T.sRGBEncoding;
    return { map, metal: mk(mc), rough: mk(rc) };
  }
  // The board itself: a slab with the texture on top. Y0 is the top surface.
  function board(w, d, Y0, tex, x, z, color) {
    mesh(new T.BoxGeometry(w, 0.16, d), std(color || 0x0b1220, 0.6, 0.1), x || 0, Y0 - 0.08, z || 0);
    const top = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: tex.map, metalnessMap: tex.metal, roughnessMap: tex.rough, metalness: 1, roughness: 1, envMapIntensity: 0.9 }));
    top.rotation.x = -Math.PI / 2; top.position.set(x || 0, Y0 + 0.002, z || 0); top.receiveShadow = true; add(top);
  }

  /* ---------- a grid of glowing blocks on a die (GPU cores, CPU cores). Returns the InstancedMesh ---------- */
  function tiles(cx, cz, cols, rows, tw, td, pitchX, pitchZ, y, base) {
    const im = new T.InstancedMesh(new T.BoxGeometry(tw, 0.012, td), new T.MeshBasicMaterial({ color: 0xffffff }), cols * rows);
    let i = 0;
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      const o = new T.Object3D(); o.position.set(cx - (cols - 1) / 2 * pitchX + a * pitchX, y, cz - (rows - 1) / 2 * pitchZ + b * pitchZ); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, base || new T.Color(0.012, 0.013, 0.02)); i++;
    }
    add(im); return im;
  }

  /* ---------- main chip: substrate, GPU die with 48 tiles, CPU die with 20 tiles ---------- */
  function gb10(Y0) {
    mesh(rbox(4.6, 0.22, 4.6, 0.06), M.substrate, 0, Y0 + 0.11, 0);
    const DIE_Y = Y0 + 0.22;
    mesh(rbox(2.55, 0.12, 3.3, 0.03), M.die, 0.6, DIE_Y + 0.06, 0);
    mesh(rbox(1.25, 0.12, 3.3, 0.03), M.die, -1.5, DIE_Y + 0.06, 0);
    const tileTop = DIE_Y + 0.126;
    const smTiles = new T.InstancedMesh(new T.BoxGeometry(0.33, 0.012, 0.33), new T.MeshBasicMaterial({ color: 0xffffff }), 48);
    let idx = 0;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 8; b++) {
      const o = new T.Object3D(); o.position.set(0.6 - 0.9625 + a * 0.385, tileTop, -1.365 + b * 0.39); o.updateMatrix();
      smTiles.setMatrixAt(idx, o.matrix); smTiles.setColorAt(idx, new T.Color(0.012, 0.013, 0.02)); idx++;
    }
    add(smTiles);
    const cpuTiles = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.012, 0.24), new T.MeshBasicMaterial({ color: 0xffffff }), 20);
    idx = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 10; b++) {
      const o = new T.Object3D(); o.position.set(-1.5 - 0.27 + a * 0.54, tileTop, -1.35 + b * 0.3); o.updateMatrix();
      cpuTiles.setMatrixAt(idx, o.matrix); cpuTiles.setColorAt(idx, new T.Color(0.05, 0.06, 0.12)); idx++;
    }
    add(cpuTiles);
    // tiny parts on the substrate
    const sub = [];
    for (let i = 0; i < 14; i++) { sub.push([-2.05 + i * 0.31, DIE_Y + 0.03, 2.05]); sub.push([-2.05 + i * 0.31, DIE_Y + 0.03, -2.05]); }
    scatter(new T.BoxGeometry(0.16, 0.06, 0.1), std(0xb9a27a, 0.35, 0.7), sub);
    return { DIE_Y, tileTop, smTiles, cpuTiles };
  }

  /* ---------- memory: one package per chip, a grid of cells on each (1 cell = 1 GB).
     A chip is { x, z } plus any of the defaults below; rot: true turns it a quarter. Cells are numbered chip by chip. ---------- */
  const MEM = { w: 1.5, d: 1.85, h: 0.13, cols: 4, rows: 4, cw: 0.28, cd: 0.35, px: 0.34, pz: 0.41 };
  function memory(chips, Y0, opts) {
    const cs = chips.map(ch => Object.assign({}, MEM, opts, ch));
    cs.forEach(c => mesh(rbox(c.rot ? c.d : c.w, c.h, c.rot ? c.w : c.d, 0.04), M.epoxy, c.x, Y0 + c.h / 2, c.z));
    const CELL_Y = Y0 + cs[0].h + 0.008, n = cs.reduce((a, c) => a + c.cols * c.rows, 0);
    const cells = new T.InstancedMesh(new T.BoxGeometry(cs[0].cw, 0.014, cs[0].cd), new T.MeshBasicMaterial({ color: 0xffffff }), n);
    const cellPos = [], cellRot = [];
    let idx = 0;
    cs.forEach(ch => {
      for (let b = 0; b < ch.rows; b++) for (let a = 0; a < ch.cols; a++) {
        const lx = -(ch.cols - 1) / 2 * ch.px + a * ch.px, lz = -(ch.rows - 1) / 2 * ch.pz + b * ch.pz;
        const o = new T.Object3D(); o.position.set(ch.x + (ch.rot ? lz : lx), CELL_Y, ch.z + (ch.rot ? -lx : lz)); o.rotation.y = ch.rot ? Math.PI / 2 : 0; o.updateMatrix();
        cells.setMatrixAt(idx, o.matrix); cells.setColorAt(idx, new T.Color(0, 0, 0)); cellPos.push(o.position.clone()); cellRot.push(o.rotation.y); idx++;
      }
    });
    add(cells);
    return { cells, cellPos, cellRot, CELL_Y, n, cw: cs[0].cw, cd: cs[0].cd };
  }

  /* ---------- power delivery: lists are [x, y, z, rotationY] ---------- */
  function inductors(list, Y0) {
    scatter(rbox(0.78, 0.6, 0.78, 0.07), M.ind, list, true);
    scatter(new T.BoxGeometry(0.5, 0.02, 0.5), M.indTop, list.map(p => [p[0], Y0 + 0.605, p[2]]));
  }
  function polymerCaps(list, Y0) {
    scatter(new T.CylinderGeometry(0.27, 0.27, 0.62, 20), M.capBody, list, true);
    scatter(new T.CylinderGeometry(0.265, 0.265, 0.02, 20), M.alu, list.map(p => [p[0], Y0 + 0.63, p[2]]));
  }
  const ceramicCaps = list => scatter(new T.BoxGeometry(0.2, 0.1, 0.12), M.mlcc, list);
  const resistors = list => scatter(new T.BoxGeometry(0.16, 0.06, 0.09), M.black, list);

  /* ---------- SSD (M.2) with a label. o: { x, z } of its centre, lines: the three sticker lines ---------- */
  function ssd(Y0, o) {
    o = Object.assign({ x: -2.2, z: 5.6, lines: ['4 TB NVMe SSD', 'M.2 2280   PCIe', 'where models wait'] }, o);
    const SSD_Y = Y0 + 0.36, X = o.x, Z = o.z;
    mesh(new T.BoxGeometry(0.55, 0.36, 2.2), M.black, X - 4.15, Y0 + 0.18, Z);
    mesh(rbox(8, 0.1, 2.2, 0.04), M.ssd, X, SSD_Y, Z);
    mesh(rbox(1.3, 0.12, 1.3, 0.03), M.epoxy, X - 2.6, SSD_Y + 0.11, Z);
    mesh(rbox(1.9, 0.13, 1.6, 0.03), M.epoxy, X - 0.3, SSD_Y + 0.115, Z);
    mesh(rbox(1.9, 0.13, 1.6, 0.03), M.epoxy, X + 2.0, SSD_Y + 0.115, Z);
    const sticker = new T.Mesh(new T.PlaneGeometry(4.5, 1.8), std(0xc9ccd8, 0.7, 0, {
      map: canvasTex(1024, 410, (x, w, h) => {
        x.fillStyle = '#e9ebf2'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#12131c'; x.font = '700 66px "Archivo Narrow", "Arial Narrow", sans-serif'; x.fillText(o.lines[0], 40, 110);
        x.font = '400 34px "IBM Plex Mono", monospace'; x.fillStyle = '#4a4e66'; x.fillText(o.lines[1], 40, 170);
        x.fillText(o.lines[2], 40, 220);
        for (let i = 0; i < 60; i++) { x.fillStyle = '#12131c'; x.fillRect(560 + i * 7, 250, Math.random() < 0.5 ? 3 : 5, 110); }
        x.fillStyle = '#ffc93c'; x.fillRect(40, 300, 150, 12);
      }, true)
    }));
    sticker.rotation.x = -Math.PI / 2; sticker.position.set(X + 0.85, SSD_Y + 0.185, Z); sticker.receiveShadow = true; add(sticker);
    mesh(new T.CylinderGeometry(0.18, 0.18, 0.12, 16), M.gold, X + 3.95, SSD_Y + 0.08, Z);
    return { SSD_Y };
  }

  /* ---------- network chip with a small heatsink, centred at x, z (the Spark's spot by default) ---------- */
  function nic(Y0, x, z) {
    x = x === undefined ? 4.2 : x; z = z === undefined ? 5.4 : z;
    mesh(rbox(1.9, 0.15, 1.9, 0.04), M.epoxy, x, Y0 + 0.075, z);
    mesh(new T.BoxGeometry(1.7, 0.1, 1.7), M.alu, x, Y0 + 0.2, z);
    const nicFins = []; for (let i = 0; i < 9; i++) nicFins.push([x - 0.75 + i * 0.19, Y0 + 0.55, z]);
    scatter(new T.BoxGeometry(0.06, 0.6, 1.6), M.alu, nicFins, true);
  }

  /* ---------- back ports ---------- */
  function ports(Y0, dx, dz) {
    dx = dx || 0; dz = dz || 0;
    [-5.0, -3.1].forEach(x => mesh(new T.BoxGeometry(1.7, 1.15, 2.4), M.alu, x + dx, Y0 + 0.575, -6.85 + dz));
    mesh(new T.BoxGeometry(1.4, 1.2, 1.8), M.alu, -1.1 + dx, Y0 + 0.6, -7.05 + dz);
    [0.7, 1.8, 2.9, 4.0].forEach(x => mesh(rbox(0.9, 0.34, 1.3, 0.15), M.alu, x + dx, Y0 + 0.17, -7.3 + dz));
    mesh(new T.BoxGeometry(1.5, 0.6, 1.4), M.alu, 5.6 + dx, Y0 + 0.3, -7.2 + dz);
  }

  /* ---------- a row of ports from a list: [{ kind, x, z }], kind one of usba (a double stack), rj45, hdmi, dp, usbc ---------- */
  const PORT = { usba: [1.7, 1.15, 2.4, 0], rj45: [1.4, 1.2, 1.8, 0], hdmi: [1.5, 0.6, 1.4, 0], dp: [1.3, 0.55, 1.3, 0], usbc: [0.9, 0.34, 1.3, 0.15] };
  function portRow(Y0, list) {
    list.forEach(p => {
      const [w, h, d, r] = PORT[p.kind];
      mesh(r ? rbox(w, h, d, r) : new T.BoxGeometry(w, h, d), M.alu, p.x, Y0 + h / 2, p.z);
    });
  }

  /* ---------- heat pipe along points [[x, y, z], ...] ---------- */
  function heatPipe(pts, r) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 60, r || 0.17, 12), M.copper, 0, 0, 0); }

  /* ---------- cooler, lifted off (exploded view): copper plate, three heat pipes, fin stack ---------- */
  function cooler(COOL_Y) {
    mesh(rbox(4.4, 0.36, 4.4, 0.08), M.copper, 0.1, COOL_Y, 0);
    [-1.2, 0, 1.2].forEach((x, k) => {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(x, COOL_Y + 0.25, 1.5), new T.Vector3(x, COOL_Y + 0.25, -1.4),
        new T.Vector3(x, 7.25 + 0.42 * k, -2.9), new T.Vector3(x, 7.25 + 0.42 * k, -6.5)]);
      mesh(new T.TubeGeometry(curve, 60, 0.17, 12), M.copper, 0, 0, 0);
    });
    const fins = []; for (let i = 0; i < 22; i++) fins.push([0, 7.65, -3.3 - i * 0.14]);
    scatter(new T.BoxGeometry(6.6, 2.4, 0.05), M.alu, fins, true);
  }

  /* ---------- fan on top of the fins: housing, spinning rotor (returned as .fan), glowing ring ---------- */
  function fan(FAN, k) {
    k = k || 1;
    mesh(rbox(3.6 * k, 0.45, 3.6 * k, 0.12), M.dark, FAN.x, FAN.y - 0.05, FAN.z);
    const rotor = new T.Group(); rotor.position.copy(FAN).setY(FAN.y + 0.22); add(rotor);
    const hub = new T.Mesh(new T.CylinderGeometry(0.55 * k, 0.55 * k, 0.2, 28), std(0x2a2c36, 0.4, 0.4)); hub.castShadow = true; rotor.add(hub);
    const bladeM = std(0x30323d, 0.45, 0.3);
    for (let i = 0; i < 9; i++) {
      const piv = new T.Group(); piv.rotation.y = i / 9 * Math.PI * 2; rotor.add(piv);
      const b = new T.Mesh(new T.BoxGeometry(1.1 * k, 0.04, 0.42 * k), bladeM); b.position.x = 1.05 * k; b.rotation.x = 0.4; b.castShadow = true; piv.add(b);
    }
    const ringM = new T.MeshBasicMaterial({ color: new T.Color(0x27f2d2).multiplyScalar(0.5) });
    const ring = new T.Mesh(new T.TorusGeometry(1.7 * k, 0.03, 8, 64), ringM); ring.rotation.x = Math.PI / 2; ring.position.copy(FAN).setY(FAN.y + 0.2); add(ring);
    return { fan: rotor, ringM };
  }

  DSP.parts = { M, rrShape, rbox, scatter, tuneEnv, stand, pcb, board, tiles, gb10, memory, inductors, polymerCaps, ceramicCaps, resistors, ssd, nic, ports, portRow, heatPipe, cooler, fan };
})(window.DSP = window.DSP || {});
