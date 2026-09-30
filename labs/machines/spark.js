/* =========================================================
   MACHINE: DGX Spark. Where each part sits, the board texture, and how the
   machine lights up as the simulation runs (animate).
   build() returns { animate, labels, outP, spillP, tileTop, PORT }.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, scene = E.scene, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;
  const qb = E.qb, glow = E.glow, heat = E.heat, reduceMotion = E.reduceMotion;

  /* ---------- board texture: color, metal and roughness maps drawn together ---------- */
  const BW = 15, S = 2048;
  const px = x => (x + BW / 2) / BW * S, pz = z => (z + BW / 2) / BW * S;
  function pcb(CHIPS) {
    const cc = document.createElement('canvas'), mc = document.createElement('canvas'), rc = document.createElement('canvas');
    [cc, mc, rc].forEach(c => { c.width = c.height = S; });
    const c = cc.getContext('2d'), m = mc.getContext('2d'), r = rc.getContext('2d');
    c.fillStyle = '#0b1220'; c.fillRect(0, 0, S, S);
    m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
    r.fillStyle = 'rgb(150,150,150)'; r.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { c.fillStyle = 'rgba(120,150,210,' + (Math.random() * 0.03) + ')'; c.fillRect(Math.random() * S, Math.random() * S, 3, 3); }
    // copper pours under the mask
    c.fillStyle = 'rgba(40,62,100,.18)';
    [[-7, -7, 14, 3.2], [-7, 4.2, 6, 3], [2, 3.6, 5, 3.4]].forEach(([x, z, w, d]) => c.fillRect(px(x), pz(z), w / BW * S, d / BW * S));
    const gold = '#b8955a';
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
    // memory buses: 8 wide bundles from each chip to the main chip
    CHIPS.forEach(ch => {
      const sx = ch.x > 0 ? ch.x - 0.8 : ch.x + 0.8, ex = ch.x > 0 ? 2.35 : -2.35, ez = ch.z * 0.72;
      for (let i = 0; i < 9; i++) {
        const o = (i - 4) * 0.085, mx = (sx + ex) / 2;
        trace([[sx + (ch.x > 0 ? 0.2 : -0.2), ch.z + o], [mx + (ch.x > 0 ? 0.25 : -0.25), ch.z + o], [mx - (ch.x > 0 ? 0.25 : -0.25), ez + o], [ex, ez + o]], 3);
      }
    });
    // random routed traces
    const dirs = [[1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707]];
    for (let i = 0; i < 260; i++) {
      let x = (Math.random() - 0.5) * 14, z = (Math.random() - 0.5) * 14, d = Math.floor(Math.random() * 4) * 2;
      const pts = [[x, z]];
      for (let s = 0; s < 3 + Math.floor(Math.random() * 4); s++) {
        const L = 0.25 + Math.random() * 1.6; x += dirs[d][0] * L; z += dirs[d][1] * L; pts.push([x, z]);
        d = (d + (Math.random() < 0.5 ? 1 : 7)) % 8;
      }
      trace(pts, Math.random() < 0.15 ? 5 : 2.2);
      dot(pts[pts.length - 1][0], pts[pts.length - 1][1], 5, 2.2);
    }
    for (let i = 0; i < 500; i++) dot((Math.random() - 0.5) * 14.4, (Math.random() - 0.5) * 14.4, 4, 1.8);
    [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]].forEach(([x, z]) => dot(x, z, 26, 14));
    // silkscreen
    c.strokeStyle = 'rgba(225,230,255,.55)'; c.fillStyle = 'rgba(225,230,255,.6)'; c.lineWidth = 3;
    const box = (x, z, w, d) => c.strokeRect(px(x - w / 2), pz(z - d / 2), w / BW * S, d / BW * S);
    box(0, 0, 5.2, 5.2); CHIPS.forEach(ch => box(ch.x, ch.z, 1.85, 2.2));
    for (let i = 0; i < 10; i++) box(-4.5 + i, -5.4, 0.95, 0.95);
    box(-2.2, 5.6, 8.3, 2.5); box(4.2, 5.4, 2.2, 2.2);
    c.font = '600 30px "IBM Plex Mono", monospace';
    c.fillText('U1', px(2.7), pz(-2.8));
    CHIPS.forEach((ch, i) => c.fillText('U' + (i + 2), px(ch.x - 0.9), pz(ch.z - 1.15)));
    for (let i = 0; i < 10; i++) c.fillText('L' + (i + 1), px(-4.85 + i), pz(-6.05));
    c.fillText('J1  M.2', px(-6.3), pz(4.1)); c.fillText('U10', px(3.1), pz(4.05));
    c.font = '500 34px "IBM Plex Mono", monospace';
    c.fillText('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', px(-6.9), pz(7.15));
    c.fillText('DESK SPACE PROGRAM  MISSION 01', px(1.2), pz(7.15));
    const mk = cv => { const t = new T.CanvasTexture(cv); t.anisotropy = Math.min(8, E.renderer.capabilities.getMaxAnisotropy()); return t; };
    const map = mk(cc); map.encoding = T.sRGBEncoding;
    return { map, metal: mk(mc), rough: mk(rc) };
  }

  function build() {
    const Y0 = 1.1; // top of the board
    const CHIPS = [];
    [-4.4, 4.4].forEach(x => [-2.85, -0.95, 0.95, 2.85].forEach(z => CHIPS.push({ x, z })));

    P.stand('DESK SPACE PROGRAM   MISSION 01: LIFTOFF', 'DGX SPARK');

    // case: base tray, two walls kept (cutaway), standoffs
    mesh(rbox(16.6, 0.5, 16.6, 0.2), M.gold, 0, 0.25, 0);
    mesh(rbox(16.6, 4.8, 0.5, 0.14), M.foam, 0, 2.9, -8.05);
    mesh(rbox(0.5, 4.8, 16.6, 0.14), M.gold, -8.05, 2.9, 0);
    mesh(new T.BoxGeometry(16.6, 0.06, 0.5), M.dark, 0, 5.31, -8.05);
    mesh(new T.BoxGeometry(0.5, 0.06, 16.6), M.dark, -8.05, 5.31, 0);
    [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]].forEach(([x, z]) => mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 16), M.gold, x, 0.75, z));

    // board
    const pcbTex = pcb(CHIPS);
    mesh(new T.BoxGeometry(15, 0.16, 15), std(0x0b1220, 0.6, 0.1), 0, Y0 - 0.08, 0);
    const boardTop = new T.Mesh(new T.PlaneGeometry(15, 15), new T.MeshStandardMaterial({ map: pcbTex.map, metalnessMap: pcbTex.metal, roughnessMap: pcbTex.rough, metalness: 1, roughness: 1, envMapIntensity: 0.9 }));
    boardTop.rotation.x = -Math.PI / 2; boardTop.position.y = Y0 + 0.002; boardTop.receiveShadow = true; scene.add(boardTop);

    // main chip (GB10): substrate, GPU die, CPU die
    const { DIE_Y, tileTop, smTiles, cpuTiles } = P.gb10(Y0);

    // memory chips + 1 GB cells
    const { cells, cellPos, CELL_Y } = P.memory(CHIPS, Y0);

    // memory bus glow ribbons + flowing data
    const LANES = CHIPS.map(ch => {
      const s = new T.Vector3(ch.x > 0 ? ch.x - 0.8 : ch.x + 0.8, Y0 + 0.02, ch.z);
      const e = new T.Vector3(ch.x > 0 ? 2.35 : -2.35, Y0 + 0.02, ch.z * 0.72);
      return { s, e, dir: e.clone().sub(s).normalize() };
    });
    const laneMat = new T.MeshBasicMaterial({ color: 0x27f2d2, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false });
    LANES.forEach(L => {
      const len = L.s.distanceTo(L.e);
      const g = new T.PlaneGeometry(len, 0.8); g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, laneMat); m.position.copy(L.s).add(L.e).multiplyScalar(0.5); m.position.y = Y0 + 0.012;
      m.rotation.y = -Math.atan2(L.e.z - L.s.z, L.e.x - L.s.x); scene.add(m);
    });
    const FLOW_PER = 30, flowN = LANES.length * FLOW_PER;
    const flowPos = new Float32Array(flowN * 3), flowT = new Float32Array(flowN), flowO = new Float32Array(flowN);
    for (let i = 0; i < flowN; i++) { flowT[i] = Math.random(); flowO[i] = (Math.random() - 0.5) * 0.7; }
    const flowGeo = new T.BufferGeometry(); flowGeo.setAttribute('position', new T.BufferAttribute(flowPos, 3));
    const flowMat = new T.PointsMaterial({ color: 0x5ffbe3, size: 0.13, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const flowPts = new T.Points(flowGeo, flowMat); flowPts.frustumCulled = false; scene.add(flowPts);

    // power delivery: inductors, polymer caps, ceramic caps
    const indPos = [], capPos = [];
    for (let i = 0; i < 10; i++) indPos.push([-4.5 + i, Y0 + 0.3, -5.4]);
    for (let i = 0; i < 8; i++) capPos.push([-3.5 + i, Y0 + 0.31, -4.3]);
    P.inductors(indPos, Y0);
    P.polymerCaps(capPos, Y0);
    const mlcc = [];
    for (let side = 0; side < 4; side++) for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
      const t = -2.25 + i * 0.3, d = 2.62 + row * 0.24;
      const p = [[t, d], [t, -d], [d, t], [-d, t]][side];
      mlcc.push([p[0], Y0 + 0.05, p[1], side > 1 ? Math.PI / 2 : 0]);
    }
    CHIPS.forEach(ch => { for (let i = 0; i < 6; i++) mlcc.push([ch.x + (ch.x > 0 ? 1.05 : -1.05), Y0 + 0.05, ch.z - 0.75 + i * 0.3, Math.PI / 2]); });
    for (let i = 0; i < 22; i++) mlcc.push([-5.2 + i * 0.5, Y0 + 0.05, -4.85]);
    P.ceramicCaps(mlcc);
    const res = [];
    for (let i = 0; i < 40; i++) res.push([-6.6 + (i % 10) * 0.22, Y0 + 0.03, -3.4 + Math.floor(i / 10) * 0.3]);
    for (let i = 0; i < 30; i++) res.push([5.9 + (i % 5) * 0.22, Y0 + 0.03, -3.5 + Math.floor(i / 5) * 0.35]);
    P.resistors(res);

    const { SSD_Y } = P.ssd(Y0);
    P.nic(Y0);
    P.ports(Y0);

    // cooler, lifted off (exploded view)
    const COOL_Y = 6.4;
    P.cooler(COOL_Y);
    const FAN = new T.Vector3(0, 9.1, -4.8);
    const { fan, ringM } = P.fan(FAN);
    // exploded-view guide lines
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x + 0.1, COOL_Y - 0.2, z), new T.Vector3(x * 1.04, DIE_Y + 0.02, z * 1.04)]), dashM);
      l.computeLineDistances(); scene.add(l);
    });

    P.tuneEnv();

    // particles: loading arcs, answer packets, overflow spill
    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const SSD_C = new T.Vector3(-2.2, SSD_Y + 0.3, 5.6);
    const PORT = new T.Vector3(-1.1, Y0 + 1.1, -7.9);

    const labels = [
      { id: 'mem', at: new T.Vector3(4.4, CELL_Y, -2.85), dx: 70, dy: -120, title: 'Memory: the fuel tank' },
      { id: 'bus', at: new T.Vector3(3.0, Y0 + 0.05, -2.0), dx: 150, dy: 40, title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(0.9, tileTop, 0.6), dx: 30, dy: 150, title: 'Blackwell GPU: the engine' },
      { id: 'cpu', at: new T.Vector3(-1.5, tileTop, 1.0), dx: -210, dy: 70, title: 'Grace CPU' },
      { id: 'ssd', at: new T.Vector3(-2.6, SSD_Y + 0.2, 5.6), dx: -150, dy: 40, title: 'SSD' },
      { id: 'fan', at: new T.Vector3(1.4, FAN.y + 0.25, -4.8), dx: -30, dy: -110, title: 'Cooler, lifted off' }
    ];

    /* ---------- how the machine lights up ---------- */
    const col = new T.Color();
    const C_EMPTY = new T.Color(0.018, 0.02, 0.03), C_SYS = new T.Color(0.09, 0.1, 0.22), C_W = new T.Color(0.09, 0.95, 0.8), C_KV = new T.Color(0.85, 0.87, 1.0), C_OVER = new T.Color(1.4, 0.18, 0.55);

    // sim: the mission's state, model: the selected model, dt and time in seconds
    function animate(sim, model, dt, time) {
      const p = sim.plan;
      fan.rotation.y += sim.fan * dt * 6;
      if (reduceMotion) fan.rotation.y = 0;

      // memory cells
      const usable = p.usable, wC = Math.min(usable, p.weightsGB), kC = p.fits ? p.kvGB : Math.max(0, usable - wC);
      const shownW = wC * sim.load, shownK = kC * Math.max(0, sim.load * 1.4 - 0.4);
      const tokPhase = sim.tokens - Math.floor(sim.tokens);
      const nW = Math.ceil(wC);
      for (let i = 0; i < 128; i++) {
        if (i >= usable) { col.copy(C_SYS); }
        else if (i < shownW) {
          const part = Math.min(1, shownW - i);
          col.copy(C_W).multiplyScalar(0.28 + 0.5 * part);
          if (sim.phase === 'writing') {
            let hit = 0;
            if (model.moe) hit = sim.activeSet && sim.activeSet.has(i) ? sim.flash : 0;
            else { const d = Math.abs(i / Math.max(1, nW) - tokPhase); hit = Math.max(0, 1 - d * 9); }
            col.lerp(new T.Color(0.7, 1.6, 1.45), hit * 0.8);
          } else if (sim.phase === 'reading') col.multiplyScalar(1.15 + 0.25 * Math.sin(time * 7 + i));
        } else if (i < shownW + shownK) { col.copy(C_KV).multiplyScalar(0.5); }
        else col.copy(C_EMPTY);
        if (!p.fits && sim.load >= 1 && i < usable && i >= usable - 10) col.copy(C_OVER).multiplyScalar(0.55 + 0.45 * Math.sin(time * 9));
        cells.setColorAt(i, col);
      }
      cells.instanceColor.needsUpdate = true;
      if (!p.fits && sim.load >= 1 && Math.random() < dt * 30) {
        const c = cellPos[Math.floor(Math.random() * 112)];
        spillP.spawn({ life: 1.6, fade: true, p: c.clone().setY(c.y + 0.1), v: new T.Vector3(Math.sign(c.x) * (2 + Math.random() * 2), 3 + Math.random() * 2, (Math.random() - 0.5) * 2) });
      }
      // loading arcs from the SSD
      if (sim.phase === 'loading' && sim.load < 0.95 && Math.random() < dt * 60) {
        const target = cellPos[Math.floor(Math.random() * Math.max(1, Math.min(nW, 120)))];
        const mid = SSD_C.clone().add(target).multiplyScalar(0.5).setY(4.5);
        loadP.spawn({ life: 0.8, path: t => qb(SSD_C, mid, target, t) });
      }

      // GPU tiles: blazing while reading, brief flashes while writing
      for (let i = 0; i < 48; i++) {
        let h;
        if (sim.phase === 'reading') h = 0.75 + 0.35 * Math.random();
        else if (sim.phase === 'writing') h = sim.flash * sim.flash * (0.4 + 0.6 * Math.random()) * Math.min(1, 0.3 + p.busyWrite * 8);
        else h = 0.0;
        col.setRGB(0.012 + 1.7 * h, 0.013 + 0.75 * Math.pow(h, 1.5), 0.02 + 0.25 * h * h * h);
        smTiles.setColorAt(i, col);
      }
      smTiles.instanceColor.needsUpdate = true;
      for (let i = 0; i < 20; i++) {
        const h = (sim.phase === 'reading' ? 0.3 : sim.phase === 'writing' ? 0.12 : 0.03) * (0.6 + 0.4 * Math.sin(time * 3 + i * 1.7));
        col.setRGB(0.012 + 0.3 * h, 0.014 + 0.4 * h, 0.03 + 1.1 * h); cpuTiles.setColorAt(i, col);
      }
      cpuTiles.instanceColor.needsUpdate = true;
      heat.intensity = sim.gpu * 7 + sim.flash * 2;

      // bus flow
      laneMat.opacity = 0.02 + sim.bus * 0.16;
      flowMat.opacity = sim.phase === 'reading' || sim.phase === 'writing' ? 0.25 + 0.75 * sim.bus : 0.12;
      const flowSpeed = (0.15 + sim.bus * 2.4) * (sim.phase === 'writing' || sim.phase === 'reading' ? 1 : 0.2);
      for (let l = 0; l < LANES.length; l++) {
        const L = LANES[l];
        for (let j = 0; j < FLOW_PER; j++) {
          const i = l * FLOW_PER + j;
          flowT[i] += dt * flowSpeed * (0.8 + 0.4 * ((j * 7) % 5) / 5); if (flowT[i] > 1) flowT[i] -= 1;
          const t = flowT[i];
          flowPos[i * 3] = L.s.x + (L.e.x - L.s.x) * t - L.dir.z * flowO[i];
          flowPos[i * 3 + 1] = Y0 + 0.06;
          flowPos[i * 3 + 2] = L.s.z + (L.e.z - L.s.z) * t + L.dir.x * flowO[i];
        }
      }
      flowGeo.attributes.position.needsUpdate = true;
      glow.intensity = sim.bus * 1.1;
      ringM.color.setRGB(0.15 + 0.4 * sim.gpu, 0.5 + 0.8 * sim.gpu * 0.3 + 0.2, 0.5);

      loadP.update(dt); outP.update(dt); spillP.update(dt);
    }

    return { animate, labels, outP, spillP, tileTop, PORT };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.spark = { build };
})(window.DSP = window.DSP || {});
