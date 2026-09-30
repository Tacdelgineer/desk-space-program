/* =========================================================
   MACHINE: RTX 5090, a graphics card lying flat with its cooler lifted off.
   GPU die in the centre, 16 GDDR7 chips around it (2 GB each, 2 cells), one 32-bit lane per chip:
   a 512-bit bus of 16 short, fat lanes. Models arrive through the PCIe edge connector.
   The parts light up by the shared rules in kit/board.js. build() returns the machine.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;

  function build() {
    const Y0 = 0.7;                       // top of the board
    const BZ = 2.6;                       // the card's centre line; the cooler sits behind it
    const GX = -0.3, GZ = BZ;             // GPU centre
    const group = new T.Group(); E.scene.add(group); E.setParent(group);

    // 16 memory chips around the GPU, in order around the ring: top row right to left, left side, bottom row,
    // then the right side last, so a model that overflows spills where the memory close-up (shot 2) looks
    const CHIPS = [];
    [2.4, 1.2, 0, -1.2, -2.4].forEach(dx => CHIPS.push({ x: GX + dx, z: GZ - 3.0, side: 't' }));
    [-1.15, 0, 1.15].forEach(dz => CHIPS.push({ x: GX - 3.2, z: GZ + dz, rot: true, side: 'l' }));
    [-2.4, -1.2, 0, 1.2, 2.4].forEach(dx => CHIPS.push({ x: GX + dx, z: GZ + 3.0, side: 'b' }));
    [1.15, 0, -1.15].forEach(dz => CHIPS.push({ x: GX + 3.2, z: GZ + dz, rot: true, side: 'r' }));
    const DIE_W = 3.2, DIE_D = 3.4;
    // where each chip's lane meets the die
    const laneOf = ch => {
      const clampX = v => Math.max(GX - DIE_W / 2 + 0.3, Math.min(GX + DIE_W / 2 - 0.3, v));
      if (ch.side === 't') return { s: [ch.x, ch.z + 0.45], e: [clampX(GX + (ch.x - GX) * 0.55), GZ - DIE_D / 2] };
      if (ch.side === 'b') return { s: [ch.x, ch.z - 0.45], e: [clampX(GX + (ch.x - GX) * 0.55), GZ + DIE_D / 2] };
      if (ch.side === 'r') return { s: [ch.x - 0.45, ch.z], e: [GX + DIE_W / 2, ch.z] };
      return { s: [ch.x + 0.45, ch.z], e: [GX - DIE_W / 2, ch.z] };
    };

    // backplate, then the board with a tab for the PCIe fingers
    mesh(rbox(16.2, 0.46, 8.2, 0.12), M.dark, 0, 0.23, BZ);
    const tex = P.pcb(15.6, 7.6, h => {
      const bz = z => z - BZ;
      CHIPS.forEach(ch => {
        const L = laneOf(ch), horiz = ch.side === 'l' || ch.side === 'r';
        for (let i = 0; i < 9; i++) {
          const o = (i - 4) * 0.075;
          h.trace(horiz ? [[L.s[0], bz(L.s[1]) + o], [L.e[0], bz(L.e[1]) + o]] : [[L.s[0] + o, bz(L.s[1])], [L.e[0] + o, bz(L.e[1])]], 3);
        }
      });
      h.silk.box(GX, bz(GZ), 4.4, 4.4);
      CHIPS.forEach(ch => h.silk.box(ch.x, bz(ch.z), ch.rot ? 1.05 : 1.15, ch.rot ? 1.15 : 1.05));
      h.silk.text('U1  GB202', GX + 1.1, bz(GZ) - 2.35);
      CHIPS.forEach((ch, i) => { if (ch.side === 't') h.silk.text('M' + (5 - i), ch.x - 0.45, bz(ch.z) - 0.6, 24); });
      h.silk.text('PCIE 5.0 X16', -6.4, 3.45);
      h.silk.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', 1.2, 3.55, 34);
      h.silk.text('DESK SPACE PROGRAM  MISSION 01', -7.4, -3.3, 34);
    }, { base: '#080a0f', traces: 150, vias: 300 });
    P.board(15.6, 7.6, Y0, tex, 0, BZ, 0x080a0f);
    mesh(new T.BoxGeometry(5.2, 0.16, 0.6), std(0x080a0f, 0.6, 0.1), -4.1, Y0 - 0.08, BZ + 4.1);
    const fingers = []; for (let i = 0; i < 40; i++) if (i !== 9) fingers.push([-6.5 + i * 0.123, Y0 + 0.004, BZ + 4.12]);
    scatter(new T.BoxGeometry(0.08, 0.012, 0.44), M.gold, fingers);

    // I/O bracket standing at the end, display outputs behind it
    mesh(rbox(0.12, 2.6, 7.8, 0.04), M.alu, -8.0, 1.3, BZ);
    [-2.4, -0.8, 0.8, 2.4].forEach(dz => mesh(new T.BoxGeometry(1.1, 0.55, 0.95), M.alu, -7.35, Y0 + 0.28, BZ + dz));

    // GPU: substrate, one big die with 170 blocks (10 x 17)
    mesh(rbox(4.2, 0.2, 4.2, 0.06), M.substrate, GX, Y0 + 0.1, GZ);
    const DIE_Y = Y0 + 0.2;
    mesh(rbox(DIE_W, 0.12, DIE_D, 0.03), M.die, GX, DIE_Y + 0.06, GZ);
    const tileTop = DIE_Y + 0.126;
    const gpu = P.tiles(GX, GZ, 10, 17, 0.25, 0.15, 0.3, 0.195, tileTop);

    // memory: 16 GDDR7 chips, 2 cells each
    const mem = P.memory(CHIPS, Y0, { w: 1.0, d: 0.9, h: 0.12, cols: 2, rows: 1, cw: 0.4, cd: 0.66, px: 0.46, pz: 0 });

    // bus: one lane per chip, 32 bits each, 512 bits in all
    const bus = DSP.board.bus(CHIPS.map(ch => { const L = laneOf(ch); return { s: new T.Vector3(L.s[0], Y0 + 0.02, L.s[1]), e: new T.Vector3(L.e[0], Y0 + 0.02, L.e[1]) }; }), Y0, { width: 0.7, per: 22 });

    // power delivery: about 28 phases either side of the GPU, the 12V-2x6 connector on the top edge
    const ind = [], caps = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 6; b++) ind.push([4.7 + a * 0.95, Y0 + 0.3, BZ - 2.4 + b * 0.95]);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 5; b++) ind.push([-6.6 + a * 0.95, Y0 + 0.3, BZ - 1.9 + b * 0.95]);
    for (let b = 0; b < 6; b++) caps.push([7.45, Y0 + 0.31, BZ - 2.4 + b * 0.95]);
    for (let b = 0; b < 4; b++) caps.push([-4.85, Y0 + 0.31, BZ - 1.4 + b * 0.95]);
    P.inductors(ind, Y0);
    P.polymerCaps(caps, Y0);
    mesh(rbox(1.5, 0.62, 0.8, 0.05), M.black, 3.9, Y0 + 0.31, BZ - 3.35);
    const pins = []; for (let a = 0; a < 6; a++) for (let b = 0; b < 2; b++) pins.push([3.45 + a * 0.18, Y0 + 0.63, BZ - 3.5 + b * 0.3]);
    scatter(new T.BoxGeometry(0.1, 0.02, 0.18), M.epoxy, pins);
    const mlcc = [], res = [];
    for (let side = 0; side < 4; side++) for (let i = 0; i < 12; i++) {
      const t = -1.65 + i * 0.3, d = 2.25;
      const p = [[t, d], [t, -d], [d, t], [-d, t]][side];
      mlcc.push([GX + p[0], Y0 + 0.05, GZ + p[1], side > 1 ? Math.PI / 2 : 0]);
    }
    for (let i = 0; i < 26; i++) res.push([4.6 + (i % 13) * 0.22, Y0 + 0.03, BZ + 3.3 + Math.floor(i / 13) * 0.3]);
    for (let i = 0; i < 20; i++) mlcc.push([-6.8 + (i % 10) * 0.26, Y0 + 0.05, BZ + 2.95 + Math.floor(i / 10) * 0.3]);
    P.ceramicCaps(mlcc);
    P.resistors(res);

    // cooler, lifted off: vapour chamber over the die, four heat pipes back to a fin stack, two fans on top
    const COOL_Y = 5.6;
    mesh(rbox(4.6, 0.32, 4.6, 0.08), M.copper, GX, COOL_Y, GZ);
    [-1.2, -0.4, 0.4, 1.2].forEach((dx, k) => P.heatPipe([[GX + dx, COOL_Y + 0.22, GZ + 1.6], [GX + dx, COOL_Y + 0.22, GZ - 1.6], [GX + dx * 2.6, 6.2 + 0.25 * k, -2.0], [GX + dx * 3.4, 6.2 + 0.25 * k, -7.4]]));
    const fins = []; for (let i = 0; i < 56; i++) fins.push([-7.15 + i * 0.26, 6.9, -4.9]);
    scatter(new T.BoxGeometry(0.05, 1.8, 5.2), M.alu, fins, true);
    const fanA = P.fan(new T.Vector3(-3.6, 8.1, -4.9), 1.3), fanB = P.fan(new T.Vector3(3.6, 8.1, -4.9), 1.3);
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(GX + x, COOL_Y - 0.2, GZ + z), new T.Vector3(GX + x * 0.72, DIE_Y + 0.02, GZ + z * 0.76)]), dashM);
      l.computeLineDistances(); E.add(l);
    });

    P.tuneEnv();

    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const PCIE = new T.Vector3(-4.1, Y0 + 0.2, BZ + 4.2);

    const labels = [
      { id: 'mem', at: new T.Vector3(GX + 2.4, mem.CELL_Y, GZ - 3.0), title: 'GDDR7 memory: the fuel tank' },
      { id: 'bus', at: new T.Vector3(GX + 2.4, Y0 + 0.05, GZ + 1.15), title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(GX + 0.4, tileTop, GZ + 0.6), title: 'Blackwell GPU: the engine' },
      { id: 'pcie', at: new T.Vector3(-4.6, Y0 + 0.02, BZ + 4.2), title: 'PCIe slot: the loading dock' },
      { id: 'power', at: new T.Vector3(3.9, Y0 + 0.62, BZ - 3.35), title: '12V-2x6 power' },
      { id: 'fan', at: new T.Vector3(3.6, 8.35, -4.9), title: 'Cooler, lifted off' }
    ];
    const animate = DSP.board.lightUp({ mem, gpu, cpu: null, bus, fans: [fanA, fanB], gpuBox: [GX, GZ, DIE_W + 0.25, DIE_D + 0.25, DIE_Y + 0.14], loadFrom: PCIE, loadP, outP, spillP });
    E.setParent(null);

    return {
      group, animate, labels, outP, spillP,
      chips: '16 chips', busBits: 512,
      notes: { pcie: 'models load from the PC\'s SSD', power: 'up to 575 W', fan: 'spins up under load' }, loadingLabel: 'pcie',
      // answers go back out through the slot to the PC
      out: { from: new T.Vector3(GX, tileTop + 0.05, GZ), spread: [2, 2], mid: new T.Vector3(-2.6, 3.4, BZ + 2.4), to: PCIE },
      glowAt: [GX, 3, GZ], heatAt: [GX, 2.0, GZ],
      shots: {
        '2': { pos: [GX + 2.2 + 7.0, 7.4, GZ - 1.2 + 7.2], tgt: [GX + 2.2, Y0 + 0.2, GZ - 1.2] },
        '3': { pos: [GX + 5.4, 4.6, GZ + 8.2], tgt: [GX, Y0 + 0.4, GZ] },
        '4': { pos: [-4.1 - 5.3, 7.1, BZ + 4.0 + 8.6], tgt: [-4.1, Y0 + 0.2, BZ + 4.0] }
      }
    };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.rtx5090 = { build, name: 'RTX 5090' };
})(window.DSP = window.DSP || {});
