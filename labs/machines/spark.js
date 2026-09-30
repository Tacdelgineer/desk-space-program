/* =========================================================
   MACHINE: DGX Spark. Where each part sits and the board texture. The parts light up by the
   shared rules in kit/board.js. build() returns the machine (see the end of this file).
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, scene = E.scene, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;

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
    const group = new T.Group(); scene.add(group); E.setParent(group);
    const CHIPS = [];
    [-4.4, 4.4].forEach(x => [-2.85, -0.95, 0.95, 2.85].forEach(z => CHIPS.push({ x, z })));

    // case: base tray, two walls kept (cutaway)
    mesh(rbox(16.6, 0.5, 16.6, 0.2), M.gold, 0, 0.25, 0);
    mesh(rbox(16.6, 4.8, 0.5, 0.14), M.foam, 0, 2.9, -8.05);
    mesh(rbox(0.5, 4.8, 16.6, 0.14), M.gold, -8.05, 2.9, 0);
    mesh(new T.BoxGeometry(16.6, 0.06, 0.5), M.dark, 0, 5.31, -8.05);
    mesh(new T.BoxGeometry(0.5, 0.06, 16.6), M.dark, -8.05, 5.31, 0);

    // board
    P.board(15, 15, Y0, pcb(CHIPS));

    // main chip (GB10): substrate, GPU die, CPU die
    const { DIE_Y, tileTop, smTiles, cpuTiles } = P.gb10(Y0);

    // memory chips + 1 GB cells
    const mem = P.memory(CHIPS, Y0);

    // memory bus: one lane per chip, 32 bits each, 256 bits in all
    const bus = DSP.board.bus(CHIPS.map(ch => ({
      s: new T.Vector3(ch.x > 0 ? ch.x - 0.8 : ch.x + 0.8, Y0 + 0.02, ch.z),
      e: new T.Vector3(ch.x > 0 ? 2.35 : -2.35, Y0 + 0.02, ch.z * 0.72)
    })), Y0);

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

    // cooler, lifted off (exploded view); while the machine is closed it sits on the chip
    const COOL_Y = 6.4;
    const coolG = new T.Group(); group.add(coolG); E.setParent(coolG);
    P.cooler(COOL_Y);
    const FAN = new T.Vector3(0, 9.1, -4.8);
    const fan = P.fan(FAN);
    E.setParent(group);
    // exploded-view guide lines
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x + 0.1, COOL_Y - 0.2, z), new T.Vector3(x * 1.04, DIE_Y + 0.02, z * 1.04)]), dashM);
      l.computeLineDistances(); E.add(l);
    });

    // the shell: a small champagne desktop box with a slatted front and an inset top, lifted off in one piece.
    // Stylized, not the real product: no logos, no foam front.
    const S = DSP.shell, lid = new T.Group(); group.add(lid); E.setParent(lid);
    const grilleM = std(0x15161b, 0.6, 0.3), grilleM0 = () => grilleM;
    const H = 5.9, shellM = M.gold.clone(), insetM = std(0x7d6440, 0.42, 0.85, { roughnessMap: M.gold.roughnessMap, envMapIntensity: 0.45 });
    shellM.userData.envTuned = insetM.userData.envTuned = true;
    const hood = mesh(S.block(S.rounded(0.55), 17.1, 17.1, 0.02, H, 0.2), shellM, 0, 0, 0);
    mesh(rbox(15.4, 0.06, 15.4, 0.4), insetM, 0, H + 0.01, 0);
    const perf = []; for (let a = 0; a < 26; a++) for (let b = 0; b < 9; b++) perf.push([-6.25 + a * 0.5, H + 0.045, -6.4 + b * 0.5]);
    scatter(new T.CylinderGeometry(0.12, 0.12, 0.02, 10), grilleM0(), perf, false);
    mesh(new T.BoxGeometry(10.4, 3.2, 0.08), grilleM, -2.7, 2.95, 8.56, { noCast: true });
    const slats = []; for (let i = 0; i < 9; i++) slats.push([-2.7, 1.62 + i * 0.335, 8.62]);
    scatter(new T.BoxGeometry(10.1, 0.13, 0.1), insetM, slats, false);
    mesh(new T.CylinderGeometry(0.13, 0.13, 0.06, 16), new T.MeshBasicMaterial({ color: new T.Color(0x27f2d2).multiplyScalar(1.3) }), -7.3, 5.15, 8.58, { noCast: true }).rotation.x = Math.PI / 2;
    const plate = S.plate({ w: 4.5, h: 2.9, face: 'front', at: [5.55, 2.95, 8.56] });
    E.setParent(group);
    // the mug, at the Spark's scale (150 mm across)
    S.mug(16.6 / 150, 15.2, -4.0, -Math.PI / 4);
    const rig = S.rig({ lid, parts: [{ g: coolG, seat: [0, -4.78, 0] }], guides: dashM, glow: [shellM, insetM] });

    P.tuneEnv();

    // particles: loading arcs, answer packets, overflow spill
    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const SSD_C = new T.Vector3(-2.2, SSD_Y + 0.3, 5.6);

    const labels = [
      { id: 'mem', at: new T.Vector3(4.4, mem.CELL_Y, -2.85), title: 'Memory: the fuel tank' },
      { id: 'bus', at: new T.Vector3(3.0, Y0 + 0.05, -2.0), title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(0.9, tileTop, 0.6), title: 'Blackwell GPU: the engine' },
      { id: 'cpu', at: new T.Vector3(-1.5, tileTop, 1.0), title: 'Grace CPU' },
      { id: 'ssd', at: new T.Vector3(-2.6, SSD_Y + 0.2, 5.6), title: 'SSD' },
      { id: 'fan', at: new T.Vector3(1.4, FAN.y + 0.25, -4.8), title: 'Cooler, lifted off' }
    ];

    const animate = DSP.board.lightUp({ mem, gpu: smTiles, cpu: cpuTiles, bus, fans: [fan], gpuBox: [0.6, 0, 2.8, 3.55, DIE_Y + 0.14], loadFrom: SSD_C, loadP, outP, spillP });
    E.setParent(null);

    return {
      group, animate, labels, outP, spillP,
      shell: { rig, grab: [hood], plate, hint: new T.Vector3(1.5, H, 6.2), what: 'lid' },
      chips: '8 chips', busBits: 256,
      notes: { cpu: '20 Arm cores', ssd: '4 TB, where models wait', fan: 'spins up under load' }, loadingLabel: 'ssd',
      // answer packets leave the GPU for the back ports
      out: { from: new T.Vector3(0.6, tileTop + 0.05, 0), spread: [1, 2], mid: new T.Vector3(-0.3, 4.2, -4.2), to: new T.Vector3(-1.1, Y0 + 1.1, -7.9) },
      glowAt: [0, 3, 0], heatAt: [0.6, 2.4, 0]
    };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.spark = { build, name: 'DGX SPARK' };
})(window.DSP = window.DSP || {});
