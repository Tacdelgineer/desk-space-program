/* =========================================================
   MACHINE: AMD Strix Halo, a mini PC with the Ryzen AI Max+ 395 and 128 GB (AMD's Ryzen AI Halo developer
   platform is 150 x 150 mm, the Spark's footprint). A graphite case with a hex-perforated back wall and a red
   trim, a green board. One big chip package with three dies: two CPU chiplets (8 Zen 5 cores each) and the
   I/O die that holds the Radeon 8060S (40 compute units, drawn at about half the Spark's GPU area, like its
   math), the NPU and the memory controllers. 8 LPDDR5X packages of 16 GB in two rows, front and back, one
   32-bit lane each: a 256-bit bus, the same count as the Spark's. The SSD runs along the left edge, the
   power stages down the right, and the cooler (vapour chamber, fin stack, fan) is lifted straight up.
   The parts light up by the shared rules in kit/board.js. build() returns the machine.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;

  function build() {
    const Y0 = 1.1;                                   // top of the board
    const PX = -0.8, PZ = -0.3;                       // chip package centre
    const SUB_Y = Y0 + 0.22, DIE_Y = SUB_Y;           // top of the package substrate
    const IX = PX + 0.75, IW = 3.7, ID = 3.4;         // I/O die: centre x, width, depth (centred on PZ)
    const CX = PX - 2.1;                              // the two CPU chiplets' centre x
    const GX = IX + 0.4, GZ = PZ - 0.75;              // GPU block on the I/O die
    const NX = IX - 0.95, NZ = PZ + 0.95;             // NPU block
    const SX = -5.7, SZ = 0.6;                        // SSD centre, turned to run front to back
    const group = new T.Group(); E.scene.add(group); E.setParent(group);

    // this case's materials: graphite anodised aluminium (brushed, like the Mac's, but dark) and a red trim
    const graphite = M.alu.clone(); graphite.color.setHex(0x444955); graphite.userData.envTuned = true;
    const red = std(0xc4262b, 0.38, 0.3);

    // case: graphite tray; the back wall is a hex-perforated sheet in a frame, the left wall solid; red trim on top
    mesh(rbox(16.6, 0.5, 16.6, 0.2), graphite, 0, 0.25, 0);
    const hex = E.canvasTex(2048, 512, (x, w, h) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000';
      const k = w / 15.6, pitch = 0.62 * k, R = pitch / Math.sqrt(3) * 0.8, rowH = pitch * Math.sqrt(3) / 2;
      for (let r = 0, y = 0.45 * k; y < h - 0.4 * k; r++, y += rowH) {
        for (let cx = 0.45 * k + (r % 2 ? pitch / 2 : 0); cx < w - 0.4 * k; cx += pitch) {
          x.beginPath();
          for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(cx + R * Math.cos(a), y + R * Math.sin(a)); }
          x.fill();
        }
      }
    }, false);
    const sheetM = graphite.clone(); sheetM.alphaMap = hex; sheetM.alphaTest = 0.5; sheetM.side = T.DoubleSide; sheetM.userData.envTuned = true;
    const sheet = mesh(new T.PlaneGeometry(15.6, 3.9), sheetM, 0.1, 2.95, -8.05);
    sheet.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaMap: hex, alphaTest: 0.5 });
    mesh(rbox(16.6, 0.5, 0.5, 0.1), graphite, 0, 0.75, -8.05);
    mesh(rbox(16.6, 0.42, 0.5, 0.1), graphite, 0, 5.1, -8.05);
    mesh(rbox(0.5, 4.8, 0.5, 0.1), graphite, 8.05, 2.9, -8.05);
    mesh(rbox(0.5, 4.8, 16.6, 0.14), graphite, -8.05, 2.9, 0);
    mesh(new T.BoxGeometry(16.6, 0.07, 0.52), red, 0, 5.34, -8.05);
    mesh(new T.BoxGeometry(0.52, 0.07, 16.6), red, -8.05, 5.34, 0);
    mesh(new T.BoxGeometry(16.2, 0.05, 0.1), red, 0, 0.52, 8.2, { noCast: true });
    mesh(new T.BoxGeometry(0.1, 0.05, 16.2), red, 8.2, 0.52, 0, { noCast: true });

    // memory: 8 packages, the front row first (a small model fills where the camera looks), 16 cells of 1 GB each
    const CHIPS = [];
    [1, -1].forEach(row => [-2.7, -0.9, 0.9, 2.7].forEach(dx => CHIPS.push({ x: IX + dx, z: PZ + row * 4.4, row })));
    // each lane runs from its package to the substrate's edge, fanning in towards the I/O die
    const laneOf = ch => ({ s: [ch.x, ch.z - ch.row * 0.95], e: [IX + (ch.x - IX) * 0.7, PZ + ch.row * 2.2] });

    // board: green, with the bus traces, copper pours and silkscreen
    const tex = P.pcb(14.4, 14.4, h => {
      h.ctx.fillStyle = 'rgba(60,110,70,.16)';
      [[-7.2, -7.2, 14.4, 1.7], [3.7, -4.2, 3.5, 6.6], [-7.2, 5.3, 14.4, 1.9]].forEach(([x, z, w, d]) => h.ctx.fillRect(h.px(x), h.pz(z), h.px(x + w) - h.px(x), h.pz(z + d) - h.pz(z)));
      CHIPS.forEach(ch => {
        const L = laneOf(ch);
        for (let i = 0; i < 9; i++) { const o = (i - 4) * 0.085; h.trace([[L.s[0] + o, L.s[1]], [L.e[0] + o * 0.8, L.e[1]]], 3); }
      });
      h.silk.box(PX, PZ, 6.2, 4.8);
      CHIPS.forEach(ch => h.silk.box(ch.x, ch.z, 1.75, 2.1));
      h.silk.box(SX, SZ, 2.5, 8.3);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 6; b++) h.silk.box(4.35 + a * 0.95, -3.3 + b * 0.95, 0.9, 0.9);
      h.silk.text('U1  RYZEN AI MAX+ 395', PX - 2.9, PZ - 2.55);
      CHIPS.forEach((ch, i) => h.silk.text('U' + (i + 2), ch.x - 0.85, ch.z + (ch.row > 0 ? 1.3 : -1.15), 24));
      h.silk.text('J1  M.2', SX - 1.2, SZ - 4.35);
      h.silk.text('10GBE', -5.4, -5.9, 24); h.silk.text('HDMI', -3.3, -6.3, 24); h.silk.text('USB4', -1.1, -6.4, 24); h.silk.text('PD IN', 4.3, -6.4, 24);
      h.silk.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', -6.9, 7.0, 34);
      h.silk.text('DESK SPACE PROGRAM  MISSION 01', 1.3, 7.0, 34);
      [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]].forEach(([x, z]) => h.dot(x, z, 24, 13));
    }, { base: '#0a1710', gold: '#c09a55', traces: 240, vias: 460 });
    P.board(14.4, 14.4, Y0, tex, 0, 0, 0x0a1710);

    // the chip package: substrate, the I/O die, two CPU chiplets
    mesh(rbox(5.8, 0.22, 4.4, 0.06), M.substrate, PX, Y0 + 0.11, PZ);
    mesh(rbox(IW, 0.12, ID, 0.03), M.die, IX, DIE_Y + 0.06, PZ);
    [-0.85, 0.85].forEach(dz => mesh(rbox(1.15, 0.12, 1.5, 0.03), M.die, CX, DIE_Y + 0.06, PZ + dz));
    const tileTop = DIE_Y + 0.126;
    // on the I/O die: memory controllers along both long edges (where the lanes arrive), media and display blocks
    const phyM = std(0x6e5c3c, 0.35, 0.8);
    [-1, 1].forEach(s => mesh(new T.BoxGeometry(IW - 0.4, 0.014, 0.13), phyM, IX, tileTop - 0.002, PZ + s * (ID / 2 - 0.13)));
    P.tiles(IX + 1.0, NZ, 3, 2, 0.34, 0.24, 0.4, 0.3, tileTop, new T.Color(0.03, 0.045, 0.07));   // media and display engines
    // GPU: 40 compute units, 8 x 5 small blocks (the Spark's 48 are bigger: about twice the lit area, like its math)
    const gpu = P.tiles(GX, GZ, 8, 5, 0.25, 0.25, 0.31, 0.31, tileTop);
    // CPU: 8 cores on each chiplet
    const cpu = [-0.85, 0.85].map(dz => P.tiles(CX, PZ + dz, 2, 4, 0.4, 0.26, 0.48, 0.33, tileTop, new T.Color(0.05, 0.06, 0.12)));
    // NPU: 32 small blocks that stay dark (llama.cpp runs on the GPU)
    P.tiles(NX, NZ, 8, 4, 0.13, 0.13, 0.18, 0.18, tileTop, new T.Color(0.08, 0.035, 0.13));
    // tiny parts along the substrate's edges
    const sub = [];
    for (let i = 0; i < 17; i++) { sub.push([PX - 2.55 + i * 0.32, SUB_Y + 0.03, PZ - 2.02]); sub.push([PX - 2.55 + i * 0.32, SUB_Y + 0.03, PZ + 2.02]); }
    scatter(new T.BoxGeometry(0.16, 0.06, 0.1), std(0xb9a27a, 0.35, 0.7), sub);

    const mem = P.memory(CHIPS, Y0);

    // memory bus: one lane per package, 32 bits each, 256 bits in all
    const bus = DSP.board.bus(CHIPS.map(ch => { const L = laneOf(ch); return { s: new T.Vector3(L.s[0], Y0 + 0.02, L.s[1]), e: new T.Vector3(L.e[0], Y0 + 0.02, L.e[1]) }; }), Y0);

    // power delivery down the right edge (120 W), small parts around the package and the memory
    const ind = [], caps = [], mlcc = [], res = [];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 6; b++) ind.push([4.35 + a * 0.95, Y0 + 0.3, -3.3 + b * 0.95]);
    for (let b = 0; b < 6; b++) caps.push([6.3, Y0 + 0.31, -2.9 + b * 0.95]);
    P.inductors(ind, Y0);
    P.polymerCaps(caps, Y0);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) {
      mlcc.push([PX - 3.15 - row * 0.24, Y0 + 0.05, PZ - 1.65 + i * 0.3, Math.PI / 2]);
      mlcc.push([PX + 3.15 + row * 0.24, Y0 + 0.05, PZ - 1.65 + i * 0.3, Math.PI / 2]);
    }
    CHIPS.forEach(ch => { for (let i = 0; i < 5; i++) mlcc.push([ch.x - 0.6 + i * 0.3, Y0 + 0.05, ch.z + ch.row * 1.15, 0]); });
    for (let i = 0; i < 14; i++) mlcc.push([3.95 + (i % 7) * 0.4, Y0 + 0.05, 2.35 + Math.floor(i / 7) * 0.3, 0]);
    P.ceramicCaps(mlcc);
    for (let i = 0; i < 30; i++) res.push([5.3 + (i % 6) * 0.22, Y0 + 0.03, 3.3 + Math.floor(i / 6) * 0.3]);
    for (let i = 0; i < 24; i++) res.push([-4.25 + (i % 4) * 0.22, Y0 + 0.03, 5.5 + Math.floor(i / 4) * 0.26]);
    P.resistors(res);
    // the embedded controller and the firmware chip, a coin cell for the clock
    mesh(rbox(1.0, 0.12, 1.0, 0.03), M.epoxy, 4.4, Y0 + 0.06, 3.9);
    mesh(rbox(0.55, 0.1, 0.7, 0.02), M.epoxy, 6.2, Y0 + 0.05, 2.6);
    mesh(new T.CylinderGeometry(0.62, 0.62, 0.1, 28), M.black, 2.0, Y0 + 0.05, 6.2);
    mesh(new T.CylinderGeometry(0.55, 0.55, 0.12, 28), M.alu, 2.0, Y0 + 0.14, 6.2);

    // SSD along the left edge: the shared part, built in its own group and turned a quarter
    const ssdG = new T.Group(); group.add(ssdG); E.setParent(ssdG);
    const { SSD_Y } = P.ssd(Y0, { x: 0, z: 0, lines: ['2 TB NVMe SSD', 'M.2 2280   PCIe 4.0', 'where models wait'] });
    E.setParent(group);
    ssdG.position.set(SX, 0, SZ); ssdG.rotation.y = Math.PI / 2;

    // Wi-Fi card (M.2 2230) with its shield, 10 GbE chip, the back ports
    mesh(rbox(2.6, 0.08, 1.7, 0.03), M.ssd, -0.7, Y0 + 0.3, 6.2);
    mesh(rbox(1.3, 0.12, 1.1, 0.03), M.alu, -0.9, Y0 + 0.4, 6.2);
    [-0.1, 0.3].forEach(dx => mesh(new T.CylinderGeometry(0.1, 0.1, 0.08, 12), M.gold, 0.2 + dx, Y0 + 0.38, 5.75));
    mesh(new T.BoxGeometry(0.4, 0.3, 1.9), M.black, -2.15, Y0 + 0.15, 6.2);
    P.nic(Y0, 4.9, 6.0);
    P.portRow(Y0, [
      { kind: 'rj45', x: -4.9, z: -7.05 }, { kind: 'hdmi', x: -2.9, z: -7.2 },
      { kind: 'usbc', x: -1.3, z: -7.3 }, { kind: 'usbc', x: -0.2, z: -7.3 }, { kind: 'usbc', x: 0.9, z: -7.3 },
      { kind: 'usbc', x: 4.6, z: -7.3 }
    ]);

    // cooler, lifted straight up (exploded view): vapour chamber, a stack of flat fins, four heat pipes, one big fan
    const FX = PX, FZ = PZ, COOL_Y = 8.2;
    const coolG = new T.Group(); group.add(coolG); E.setParent(coolG);
    mesh(rbox(5.4, 0.3, 4.4, 0.08), M.copper, FX, COOL_Y, FZ);
    const fins = []; for (let i = 0; i < 16; i++) fins.push([FX, COOL_Y + 0.38 + i * 0.1, FZ]);
    scatter(new T.BoxGeometry(6.4, 0.035, 5.0), M.alu, fins, true);
    [-1, 1].forEach(s => [-1.3, 1.3].forEach(dz => P.heatPipe([[FX + s * 1.8, COOL_Y + 0.1, FZ + dz], [FX + s * 3.0, COOL_Y + 0.12, FZ + dz], [FX + s * 3.42, COOL_Y + 0.6, FZ + dz], [FX + s * 3.42, COOL_Y + 1.9, FZ + dz]])));
    const FAN = new T.Vector3(FX, COOL_Y + 2.3, FZ);
    const fan = P.fan(FAN, 1.4);
    E.setParent(group);
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-2.5, -1.95], [2.5, -1.95], [-2.5, 1.95], [2.5, 1.95]].forEach(([dx, dz]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(FX + dx, COOL_Y - 0.2, FZ + dz), new T.Vector3(PX + dx * 1.1, SUB_Y + 0.02, PZ + dz * 1.05)]), dashM);
      l.computeLineDistances(); E.add(l);
    });

    // the shell: a low graphite mini PC with cut corners, a hex-perforated vent across the top and a red trim line.
    // Stylized, not the real product: no logo, no brand marks.
    const S = DSP.shell, lid = new T.Group(); group.add(lid); E.setParent(lid);
    const H = 5.7, shellM = graphite.clone(); shellM.color.setHex(0x3e434e); shellM.userData.envTuned = true;
    const hood = mesh(S.block(S.chamfered(1.9), 17.1, 17.1, 0.02, H, 0.14), shellM, 0, 0, 0);
    const trimM = red.clone();
    mesh(S.band(S.chamfered(1.93), 17.16, 17.16, 0.1, 0.12), trimM, 0, H - 0.5, 0, { noCast: true });
    const vent = E.canvasTex(1024, 1024, (x, w, h) => {
      x.fillStyle = '#4a4f5b'; x.fillRect(0, 0, w, h); x.fillStyle = '#0c0d10';
      const pitch = w / 22, R = pitch / Math.sqrt(3) * 0.78, rowH = pitch * Math.sqrt(3) / 2;
      for (let r = 0, y = pitch * 0.6; y < h - pitch * 0.4; r++, y += rowH) for (let cx = pitch * 0.6 + (r % 2 ? pitch / 2 : 0); cx < w - pitch * 0.4; cx += pitch) {
        x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(cx + R * Math.cos(a), y + R * Math.sin(a)); } x.fill();
      }
    }, true);
    const ventM = std(0xffffff, 0.55, 0.6, { map: vent, envMapIntensity: 0.4 }); ventM.userData.envTuned = true;
    const ventP = mesh(new T.PlaneGeometry(11.5, 11.5), ventM, -0.4, H + 0.006, -0.6, { noCast: true }); ventP.rotation.x = -Math.PI / 2;
    mesh(new T.BoxGeometry(3.4, 0.08, 0.05), new T.MeshBasicMaterial({ color: new T.Color(0xff3a2c).multiplyScalar(1.3) }), -4.6, 1.15, 8.57, { noCast: true });
    const plate = S.plate({ w: 4.5, h: 2.9, face: 'front', at: [4.9, 2.85, 8.57] });
    E.setParent(group);
    // the mug, at the mini PC's scale (150 mm across)
    S.mug(16.6 / 150, 15.2, -4.0, -Math.PI / 4);
    const rig = S.rig({ lid, parts: [{ g: coolG, seat: [0, -6.6, 0] }], guides: dashM, glow: [shellM, trimM] });

    P.tuneEnv();

    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const SSD_C = new T.Vector3(SX, SSD_Y + 0.3, SZ);

    const labels = [
      { id: 'mem', at: new T.Vector3(CHIPS[3].x, mem.CELL_Y, CHIPS[3].z), title: 'LPDDR5X memory: the fuel tank' },
      { id: 'bus', at: new T.Vector3(laneOf(CHIPS[2]).s[0], Y0 + 0.05, CHIPS[2].z - 1.4), title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(GX + 0.6, tileTop, GZ + 0.3), title: 'Radeon 8060S: the engine' },
      { id: 'cpu', at: new T.Vector3(CX, tileTop, PZ + 0.85), title: 'Two CPU chiplets' },
      { id: 'npu', at: new T.Vector3(NX, tileTop, NZ), title: 'NPU' },
      { id: 'ssd', at: new T.Vector3(SX, SSD_Y + 0.2, SZ + 1.2), title: 'SSD' },
      { id: 'fan', at: new T.Vector3(FX + 1.7, FAN.y + 0.25, FZ), title: 'Cooler, lifted off' }
    ];
    const animate = DSP.board.lightUp({ mem, gpu, cpu, bus, fans: [fan], gpuBox: [GX, GZ, 2.62, 1.69, DIE_Y + 0.14], loadFrom: SSD_C, loadP, outP, spillP });
    E.setParent(null);

    return {
      group, animate, labels, outP, spillP,
      shell: { rig, grab: [hood], plate, hint: new T.Vector3(1.0, H, 6.2), what: 'lid' },
      chips: '8 packages', busBits: 256,
      notes: { cpu: '16 Zen 5 cores', npu: '50 TOPS, idle: llama.cpp uses the GPU', ssd: '2 TB, where models wait', fan: '120 W, spins up under load' }, loadingLabel: 'ssd',
      // answer packets leave the GPU for the 10 GbE port
      out: { from: new T.Vector3(GX, tileTop + 0.05, GZ), spread: [2, 1.2], mid: new T.Vector3(-2.4, 4.4, -5.0), to: new T.Vector3(-4.9, Y0 + 1.0, -7.7) },
      glowAt: [IX, 3, PZ], heatAt: [GX, 2.4, GZ],
      shots: {
        '2': { pos: [IX - 1.8 + 6.6, 8.0, PZ + 4.4 + 7.2], tgt: [IX - 1.8, Y0 + 0.2, PZ + 4.4] },
        '3': { pos: [GX + 5.4, 5.0, GZ + 8.2], tgt: [GX - 0.4, Y0 + 0.4, GZ + 0.3] },
        '4': { pos: [SX + 4.6, 7.2, SZ + 9.4], tgt: [SX, Y0 + 0.3, SZ + 0.6] }
      }
    };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.strix = { build, name: 'STRIX HALO' };
})(window.DSP = window.DSP || {});
