/* =========================================================
   MACHINE: Mac Studio, M3 Ultra, 256 GB. An aluminium case with rounded corners, two walls cut away.
   The chip package carries everything: two dies joined into one chip (GPU and CPU cores on both, no
   separate GPU) and 8 memory packages sitting on the package itself, 32 cells each. Each package talks
   to its die over four 32-bit lanes: a 1,024-bit bus of 32 very short, very wide lanes.
   The parts light up by the shared rules in kit/board.js. build() returns the machine.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;

  function build() {
    const Y0 = 1.1;                                   // top of the board
    const PZ = -0.6;                                  // chip package centre (x = 0)
    const SUB_Y = Y0 + 0.22;                          // top of the package substrate
    const DIE_W = 4.2, DIE_D = 3.3, DIE_X = 2.2;      // two dies at x = -2.2 and 2.2, 0.2 apart
    const group = new T.Group(); E.scene.add(group); E.setParent(group);

    // case: rounded aluminium tray, back and left walls kept, a rounded corner between them
    const alu2 = M.alu.clone(); alu2.side = T.DoubleSide;
    const trayG = new T.ExtrudeGeometry(P.rrShape(16.6, 16.6, 2.2), { depth: 0.5, bevelEnabled: false, curveSegments: 12 });
    trayG.rotateX(-Math.PI / 2); mesh(trayG, M.alu, 0, 0, 0);
    const perf = E.canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#b0b0b0'; x.fillRect(0, 0, w, h); x.fillStyle = '#202020';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 9, 0, 7); x.fill(); }
    }, false);
    perf.wrapS = perf.wrapT = T.RepeatWrapping; perf.repeat.set(6, 2.4);
    const perfM = std(0x9aa0ac, 0.4, 1, { bumpMap: perf, bumpScale: 0.03, roughnessMap: perf, envMapIntensity: 0.5 });
    mesh(rbox(12.2, 4.8, 0.4, 0.12), perfM, 0.1, 2.9, -8.1);
    mesh(rbox(0.4, 4.8, 12.2, 0.12), M.alu, -8.1, 2.9, 0.1);
    mesh(new T.CylinderGeometry(2.2, 2.2, 4.8, 20, 1, true, Math.PI, Math.PI / 2), alu2, -6.0, 2.9, -6.0);
    mesh(new T.BoxGeometry(12.2, 0.06, 0.4), M.dark, 0.1, 5.31, -8.1);
    mesh(new T.BoxGeometry(0.4, 0.06, 12.2), M.dark, -8.1, 5.31, 0.1);

    // memory packages: 4 above the dies, 4 below, 8 x 4 cells each
    const CHIPS = [];
    [-3.45, -1.15, 1.15, 3.45].forEach(x => CHIPS.push({ x, z: PZ - 2.95 }));
    [-3.45, -1.15, 1.15, 3.45].forEach(x => CHIPS.push({ x, z: PZ + 2.95 }));

    // board
    const tex = P.pcb(14.4, 14.4, h => {
      CHIPS.forEach(ch => { for (let k = 0; k < 4; k++) { const x = ch.x - 0.87 + k * 0.58; for (let i = 0; i < 3; i++) h.trace([[x - 0.1 + i * 0.1, ch.z], [x - 0.1 + i * 0.1, PZ + Math.sign(ch.z - PZ) * 1.5]], 2.5); } });
      h.silk.box(0, PZ, 10.2, 9.2);
      h.silk.box(-1.4, 5.6, 8.3, 2.5);
      h.silk.text('U1  M3 ULTRA', -4.9, PZ - 4.8);
      h.silk.text('J1  SSD', -6.6, 4.1);
      h.silk.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', -6.7, 6.95, 34);
      h.silk.text('DESK SPACE PROGRAM  MISSION 01', 1.0, 6.95, 34);
    }, { base: '#0c1116', traces: 240, vias: 460 });
    P.board(14.4, 14.4, Y0, tex, 0, 0, 0x0c1116);

    // the chip package: substrate, two dies, the UltraFusion bridge between them
    mesh(rbox(9.8, 0.22, 8.8, 0.08), M.substrate, 0, Y0 + 0.11, PZ);
    const DIE_Y = SUB_Y;
    [-DIE_X, DIE_X].forEach(x => mesh(rbox(DIE_W, 0.12, DIE_D, 0.03), M.die, x, DIE_Y + 0.06, PZ));
    mesh(new T.BoxGeometry(0.34, 0.1, 2.6), M.gold, 0, DIE_Y + 0.07, PZ);
    const tileTop = DIE_Y + 0.126;
    // per die: 40 GPU cores on the outer side (5 x 8), 16 CPU cores next to the bridge (2 x 8)
    const gpu = [-1, 1].map(s => P.tiles(s * 3.15, PZ, 5, 8, 0.34, 0.28, 0.4, 0.37, tileTop));
    const cpu = [-1, 1].map(s => P.tiles(s * 0.95, PZ, 2, 8, 0.46, 0.28, 0.54, 0.37, tileTop, new T.Color(0.05, 0.06, 0.12)));

    const mem = P.memory(CHIPS, SUB_Y, { w: 2.2, d: 1.8, h: 0.13, cols: 8, rows: 4, cw: 0.2, cd: 0.34, px: 0.25, pz: 0.4 });

    // bus: four 32-bit lanes from each package straight into its die, 1,024 bits in all
    const lanes = [];
    CHIPS.forEach(ch => {
      const dir = Math.sign(PZ - ch.z);
      for (let k = 0; k < 4; k++) {
        const x = ch.x - 0.87 + k * 0.58;
        lanes.push({ s: new T.Vector3(x, SUB_Y + 0.02, ch.z + dir * 0.9), e: new T.Vector3(x, SUB_Y + 0.02, PZ - dir * (DIE_D / 2)) });
      }
    });
    const bus = DSP.board.bus(lanes, SUB_Y, { width: 0.44, per: 10, size: 0.11 });

    // power delivery down both sides, small parts around the package
    const ind = [], caps = [], mlcc = [], res = [];
    for (let i = 0; i < 7; i++) { ind.push([-6.25, Y0 + 0.3, -4.6 + i * 0.95]); ind.push([6.25, Y0 + 0.3, -4.6 + i * 0.95]); }
    for (let i = 0; i < 5; i++) { caps.push([-5.35, Y0 + 0.31, -3.9 + i * 1.0]); caps.push([5.35, Y0 + 0.31, -3.9 + i * 1.0]); }
    P.inductors(ind, Y0);
    P.polymerCaps(caps, Y0);
    for (let i = 0; i < 30; i++) { mlcc.push([-4.5 + i * 0.31, Y0 + 0.05, PZ + 4.65]); mlcc.push([-4.5 + i * 0.31, Y0 + 0.05, PZ - 4.65]); }
    for (let i = 0; i < 40; i++) res.push([3.2 + (i % 10) * 0.22, Y0 + 0.03, 4.3 + Math.floor(i / 10) * 0.3]);
    P.ceramicCaps(mlcc);
    P.resistors(res);

    const { SSD_Y } = P.ssd(Y0, { x: -1.4, z: 5.6, lines: ['SSD module', 'removable, Apple', 'where models wait'] });
    P.ports(Y0, 0.4, 0.2);

    // cooler, lifted off and back (so it doesn't hide the chip): one big copper heatsink, two blowers behind it
    const COOL_Y = 7.0, CZ = PZ - 2.6;
    mesh(rbox(8.2, 0.36, 5.6, 0.08), M.copper, 0, COOL_Y, CZ);
    const fins = []; for (let i = 0; i < 42; i++) fins.push([-3.9 + i * 0.19, COOL_Y + 0.8, CZ]);
    scatter(new T.BoxGeometry(0.05, 1.3, 5.3), M.copper, fins, true);
    const fanA = P.fan(new T.Vector3(-3.4, 9.1, -6.4), 1.05), fanB = P.fan(new T.Vector3(3.4, 9.1, -6.4), 1.05);
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-3.8, -2.6], [3.8, -2.6], [-3.8, 2.6], [3.8, 2.6]].forEach(([x, z]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x, COOL_Y - 0.2, CZ + z), new T.Vector3(x * 1.2, SUB_Y, PZ + z * 1.6)]), dashM);
      l.computeLineDistances(); E.add(l);
    });

    P.tuneEnv();

    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const SSD_C = new T.Vector3(-1.4, SSD_Y + 0.3, 5.6);

    const labels = [
      { id: 'mem', at: new T.Vector3(3.45, mem.CELL_Y, PZ - 2.95), title: 'Memory, on the chip: the fuel tank' },
      { id: 'bus', at: new T.Vector3(2.6, SUB_Y + 0.05, PZ + 1.9), title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(3.15, tileTop, PZ + 0.6), title: 'GPU cores: the engine' },
      { id: 'bridge', at: new T.Vector3(0, DIE_Y + 0.12, PZ + 0.8), title: 'UltraFusion' },
      { id: 'ssd', at: new T.Vector3(-1.8, SSD_Y + 0.2, 5.6), title: 'SSD' },
      { id: 'fan', at: new T.Vector3(3.4, 9.35, -6.4), title: 'Cooler, lifted off' }
    ];
    const animate = DSP.board.lightUp({ mem, gpu, cpu, bus, fans: [fanA, fanB], gpuBox: [0, PZ, 2 * DIE_W + 0.5, DIE_D + 0.25, DIE_Y + 0.14], loadFrom: SSD_C, loadP, outP, spillP });
    E.setParent(null);

    return {
      group, animate, labels, outP, spillP,
      chips: '8 packages', busBits: 1024,
      notes: { bridge: 'two chips joined into one, 32 CPU cores', ssd: 'where models wait', fan: 'spins up under load' }, loadingLabel: 'ssd',
      out: { from: new T.Vector3(3.15, tileTop + 0.05, PZ), spread: [2, 2], mid: new T.Vector3(1.0, 4.4, -4.6), to: new T.Vector3(-0.7, Y0 + 1.1, -7.7) },
      glowAt: [0, 3, PZ], heatAt: [0, 2.4, PZ],
      shots: {
        '2': { pos: [2.3 + 7.0, 8.4, PZ + 2.95 + 7.2], tgt: [2.3, SUB_Y + 0.2, PZ + 2.95] },
        '3': { pos: [3.1 + 5.6, 5.0, PZ + 8.4], tgt: [2.6, SUB_Y + 0.2, PZ] },
        '4': { pos: [-1.8 - 5.3, 7.5, 5.4 + 8.6], tgt: [-1.8, Y0 + 0.3, 5.4] }
      }
    };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.mac = { build, name: 'MAC STUDIO' };
})(window.DSP = window.DSP || {});
