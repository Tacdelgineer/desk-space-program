/* =========================================================
   MACHINE: RTX Pro 6000 Blackwell Workstation Edition, 96 GB, lying flat with its cooler lifted off.
   The double flow-through layout: a compact main board in the middle, a fin stack and a fan at each end,
   the PCIe fingers on their own small board joined by a ribbon cable, the display outputs on another, all on
   a brushed gunmetal frame with a silver edge. The same GB202 chip as the RTX 5090, with 188 of its 192 SMs
   switched on (the 5090 has 170). 16 memory positions, each a 3 GB chip on top of the board and another
   under it (clamshell: 32 chips, 6 cells per position), one 32-bit lane each: a 512-bit bus, as wide as
   the 5090's. Models arrive through the PCIe slot; a model's lookup table stays in the PC's memory.
   The parts light up by the shared rules in kit/board.js. build() returns the machine.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.parts) return;
  const E = DSP.engine, P = DSP.parts, T = E.T, mesh = E.mesh, std = E.std, M = P.M, rbox = P.rbox, scatter = P.scatter;

  function build() {
    const Y0 = 0.7;                        // top of the main board
    const BZ = 2.5;                        // the card's centre line
    const GX = 0.2, GZ = BZ;               // GPU centre
    const DIE_W = 3.2, DIE_D = 3.4;        // GB202, the 5090's chip
    const LX = -4.3, RX = 4.7, BD = 7.0;   // the main board: x from LX to RX, BD deep
    const FL = -6.0, FR = 6.45;            // the two fin stacks' centres
    const group = new T.Group(); E.scene.add(group); E.setParent(group);

    // the frame: brushed gunmetal (the 5090's backplate is matte black), a silver edge, standoffs under the main board
    const frameM = M.alu.clone(); frameM.color.setHex(0x4b505b); frameM.userData.envTuned = true;
    mesh(rbox(16.2, 0.4, 7.6, 0.14), frameM, 0, 0.2, BZ);
    [-1, 1].forEach(s => mesh(new T.BoxGeometry(16.2, 0.05, 0.1), M.alu, 0, 0.425, BZ + s * 3.74, { noCast: true }));
    [-1, 1].forEach(s => mesh(new T.BoxGeometry(0.1, 0.05, 7.4), M.alu, s * 8.04, 0.425, BZ, { noCast: true }));
    // the flow-through opening at the far end: air leaves the card through here
    mesh(new T.CylinderGeometry(1.45, 1.45, 0.02, 40), M.black, FR, 0.415, BZ, { noCast: true });
    const ringM = std(0x9aa0ac, 0.3, 1); const ring = new T.Mesh(new T.TorusGeometry(1.48, 0.04, 8, 48), ringM); ring.rotation.x = Math.PI / 2; ring.position.set(FR, 0.43, BZ); E.add(ring);
    [[LX + 0.25, -BD / 2 + 0.25], [RX - 0.25, -BD / 2 + 0.25], [LX + 0.25, BD / 2 - 0.25], [RX - 0.25, BD / 2 - 0.25]].forEach(([x, dz]) => mesh(new T.CylinderGeometry(0.12, 0.12, 0.14, 12), M.gold, x, 0.47, BZ + dz));

    // memory: 16 positions around the GPU, in order around the ring: top row right to left, left side, bottom row,
    // the right side last, so a model that overflows spills where the memory close-up (shot 2) looks
    const CHIPS = [];
    [2.2, 1.1, 0, -1.1, -2.2].forEach(dx => CHIPS.push({ x: GX + dx, z: GZ - 2.85, side: 't' }));
    [-1.1, 0, 1.1].forEach(dz => CHIPS.push({ x: GX - 3.05, z: GZ + dz, rot: true, side: 'l' }));
    [-2.2, -1.1, 0, 1.1, 2.2].forEach(dx => CHIPS.push({ x: GX + dx, z: GZ + 2.85, side: 'b' }));
    [1.1, 0, -1.1].forEach(dz => CHIPS.push({ x: GX + 3.05, z: GZ + dz, rot: true, side: 'r' }));
    const laneOf = ch => {
      const clampX = v => Math.max(GX - DIE_W / 2 + 0.3, Math.min(GX + DIE_W / 2 - 0.3, v));
      if (ch.side === 't') return { s: [ch.x, ch.z + 0.45], e: [clampX(GX + (ch.x - GX) * 0.6), GZ - DIE_D / 2] };
      if (ch.side === 'b') return { s: [ch.x, ch.z - 0.45], e: [clampX(GX + (ch.x - GX) * 0.6), GZ + DIE_D / 2] };
      if (ch.side === 'r') return { s: [ch.x - 0.45, ch.z], e: [GX + DIE_W / 2, ch.z] };
      return { s: [ch.x + 0.45, ch.z], e: [GX - DIE_W / 2, ch.z] };
    };

    // the main board, black, with the bus traces and the silkscreen
    const tex = P.pcb(RX - LX, BD, h => {
      const bx = x => x - (LX + RX) / 2, bz = z => z - BZ;
      CHIPS.forEach(ch => {
        const L = laneOf(ch), horiz = ch.side === 'l' || ch.side === 'r';
        for (let i = 0; i < 9; i++) {
          const o = (i - 4) * 0.07;
          h.trace(horiz ? [[bx(L.s[0]), bz(L.s[1]) + o], [bx(L.e[0]), bz(L.e[1]) + o]] : [[bx(L.s[0]) + o, bz(L.s[1])], [bx(L.e[0]) + o, bz(L.e[1])]], 3);
        }
      });
      h.silk.box(bx(GX), 0, 4.4, 4.4);
      CHIPS.forEach(ch => h.silk.box(bx(ch.x), bz(ch.z), ch.rot ? 1.05 : 1.15, ch.rot ? 1.15 : 1.05));
      h.silk.text('U1  GB202', bx(GX) + 0.9, -2.2, 26);
      h.silk.text('32 X 3 GB: 16 ON TOP, 16 UNDERNEATH', bx(LX) + 0.3, 3.35, 22);
      h.silk.text('ILLUSTRATIVE LAYOUT', bx(RX) - 2.9, -3.2, 26);
    }, { base: '#07080b', traces: 130, vias: 260 });
    P.board(RX - LX, BD, Y0, tex, (LX + RX) / 2, BZ, 0x07080b);

    // GPU: substrate, the GB202 die, 188 SMs lit by the simulation and 4 switched off
    mesh(rbox(4.2, 0.2, 4.2, 0.06), M.substrate, GX, Y0 + 0.1, GZ);
    const DIE_Y = Y0 + 0.2;
    mesh(rbox(DIE_W, 0.12, DIE_D, 0.03), M.die, GX, DIE_Y + 0.06, GZ);
    const tileTop = DIE_Y + 0.126;
    const off = (a, b) => (a === 0 || a === 11) && (b === 0 || b === 15);
    const gpu = P.tiles(GX, GZ, 12, 16, 0.2, 0.15, 0.25, 0.2, tileTop, null, off);
    P.tiles(GX, GZ, 12, 16, 0.2, 0.15, 0.25, 0.2, tileTop, new T.Color(0.06, 0.06, 0.07), (a, b) => !off(a, b));

    // memory: 16 positions of 6 cells (3 GB on top, 3 GB underneath); the chips under the board sit on the frame
    const mem = P.memory(CHIPS, Y0, { w: 1.0, d: 0.9, h: 0.12, cols: 3, rows: 2, cw: 0.24, cd: 0.33, px: 0.29, pz: 0.39 });
    CHIPS.forEach(ch => mesh(rbox(ch.rot ? 0.9 : 1.0, 0.12, ch.rot ? 1.0 : 0.9, 0.03), M.epoxy, ch.x, 0.47, ch.z, { noCast: true }));

    // bus: one lane per position, 32 bits each, 512 bits in all
    const bus = DSP.board.bus(CHIPS.map(ch => { const L = laneOf(ch); return { s: new T.Vector3(L.s[0], Y0 + 0.02, L.s[1]), e: new T.Vector3(L.e[0], Y0 + 0.02, L.e[1]) }; }), Y0, { width: 0.6, per: 20 });

    // power delivery down both ends of the main board (600 W), the 16-pin connector at the back corner
    const ind = [], caps = [], mlcc = [], res = [];
    for (let b = 0; b < 6; b++) ind.push([LX + 0.55, Y0 + 0.3, BZ - 2.4 + b * 0.95]);
    for (let b = 0; b < 5; b++) ind.push([RX - 0.55, Y0 + 0.3, BZ - 1.8 + b * 0.95]);
    P.inductors(ind, Y0);
    [-2.95, 2.95].forEach(dz => caps.push([LX + 1.35, Y0 + 0.31, BZ + dz]));
    P.polymerCaps(caps, Y0);
    mesh(rbox(1.5, 0.62, 0.8, 0.05), M.black, RX - 1.0, Y0 + 0.31, BZ - 3.05);
    const pins = []; for (let a = 0; a < 6; a++) for (let b = 0; b < 2; b++) pins.push([RX - 1.45 + a * 0.18, Y0 + 0.63, BZ - 3.2 + b * 0.3]);
    scatter(new T.BoxGeometry(0.1, 0.02, 0.18), M.epoxy, pins);
    for (let side = 0; side < 4; side++) for (let i = 0; i < 12; i++) {
      const t = -1.65 + i * 0.3, d = 2.25;
      const p = [[t, d], [t, -d], [d, t], [-d, t]][side];
      mlcc.push([GX + p[0], Y0 + 0.05, GZ + p[1], side > 1 ? Math.PI / 2 : 0]);
    }
    for (let i = 0; i < 24; i++) res.push([RX - 1.65 + (i % 8) * 0.2, Y0 + 0.03, BZ + 2.6 + Math.floor(i / 8) * 0.28]);
    for (let i = 0; i < 10; i++) res.push([LX + 0.15 + (i % 5) * 0.2, Y0 + 0.03, BZ - 3.3 + Math.floor(i / 5) * 0.25]);
    P.ceramicCaps(mlcc);
    P.resistors(res);

    // the PCIe fingers on their own board at the front, a ribbon cable up to the main board
    const PB = { x: -5.9, z: BZ + 3.45 }, pbY = 0.47;
    mesh(rbox(3.4, 0.12, 0.9, 0.03), std(0x07080b, 0.6, 0.1), PB.x, pbY, PB.z);
    const fingers = []; for (let i = 0; i < 26; i++) fingers.push([PB.x - 1.55 + i * 0.124, pbY + 0.065, PB.z + 0.3]);
    scatter(new T.BoxGeometry(0.08, 0.012, 0.3), M.gold, fingers);
    const ribbonM = std(0x8a8f99, 0.6, 0.2);
    const rib = new T.Mesh(new T.BoxGeometry(1.6, 0.03, 0.7), ribbonM); rib.position.set(LX - 0.45, 0.56, BZ + 2.8); rib.rotation.set(0, 0.5, 0.18); rib.castShadow = true; E.add(rib);
    // display outputs on a board by the bracket, the bracket itself
    mesh(rbox(1.1, 0.12, 6.6, 0.03), std(0x07080b, 0.6, 0.1), -7.35, pbY, BZ);
    P.portRow(pbY + 0.06, [-2.4, -0.8, 0.8, 2.4].map(dz => ({ kind: 'dp', x: -7.35, z: BZ + dz })));
    mesh(rbox(0.12, 2.6, 7.8, 0.04), M.alu, -8.1, 1.3, BZ);

    // cooler, lifted off: a vapour chamber over the GPU, four heat pipes out to a fin stack at each end, a fan on each
    const COOL_Y = 6.2;
    mesh(rbox(4.6, 0.3, 4.6, 0.08), M.copper, GX, COOL_Y, GZ);
    [-1.2, -0.4, 0.4, 1.2].forEach(dz => [FL, FR].forEach(fx => P.heatPipe([[GX + Math.sign(fx) * 1.4, COOL_Y + 0.2, GZ + dz], [GX + Math.sign(fx) * 2.9, COOL_Y + 0.4, GZ + dz], [fx - Math.sign(fx) * 1.2, COOL_Y + 0.8, GZ + dz], [fx + Math.sign(fx) * 1.3, COOL_Y + 0.85, GZ + dz]], 0.15)));
    const fins = []; [FL, FR].forEach(fx => { for (let i = 0; i < 26; i++) fins.push([fx - 1.55 + i * 0.124, COOL_Y + 0.85, BZ]); });
    scatter(new T.BoxGeometry(0.04, 1.7, 6.6), M.alu, fins, true);
    const fanL = P.fan(new T.Vector3(FL, COOL_Y + 2.05, BZ), 0.95), fanR = P.fan(new T.Vector3(FR, COOL_Y + 2.05, BZ), 0.95);
    const dashM = new T.LineDashedMaterial({ color: 0x9ea4d2, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.55 });
    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(GX + x, COOL_Y - 0.2, GZ + z), new T.Vector3(GX + x * 0.72, DIE_Y + 0.02, GZ + z * 0.76)]), dashM);
      l.computeLineDistances(); E.add(l);
    });

    P.tuneEnv();

    const loadP = E.pool(160, 0x27f2d2, 0.28);
    const outP = E.pool(80, 0xffc93c, 0.34);
    const spillP = E.pool(160, 0xff3d9a, 0.22);
    const PCIE = new T.Vector3(PB.x, pbY + 0.1, PB.z + 0.3);

    const labels = [
      { id: 'mem', at: new T.Vector3(CHIPS[0].x, mem.CELL_Y, CHIPS[0].z), title: 'GDDR7 memory: the fuel tank' },
      { id: 'bus', at: new T.Vector3(GX + 2.2, Y0 + 0.05, GZ + 1.1), title: 'Memory bus: the fuel line' },
      { id: 'gpu', at: new T.Vector3(GX + 0.4, tileTop, GZ + 0.6), title: 'Blackwell GPU: the engine' },
      { id: 'pcie', at: new T.Vector3(PB.x - 0.4, pbY + 0.07, PB.z + 0.3), title: 'PCIe slot: the loading dock' },
      { id: 'power', at: new T.Vector3(RX - 1.0, Y0 + 0.62, BZ - 3.05), title: '16-pin power' },
      { id: 'fan', at: new T.Vector3(FR, COOL_Y + 2.3, BZ), title: 'Cooler, lifted off' }
    ];
    const animate = DSP.board.lightUp({ mem, gpu, cpu: null, bus, fans: [fanL, fanR], gpuBox: [GX, GZ, DIE_W + 0.25, DIE_D + 0.25, DIE_Y + 0.14], loadFrom: PCIE, loadP, outP, spillP });
    E.setParent(null);

    return {
      group, animate, labels, outP, spillP,
      chips: '32 chips, 16 underneath', busBits: 512,
      notes: { pcie: 'models load from the PC\'s SSD', power: 'up to 600 W', fan: 'two fans, the air flows through' }, loadingLabel: 'pcie',
      // answers go back out through the slot to the PC
      out: { from: new T.Vector3(GX, tileTop + 0.05, GZ), spread: [2, 2], mid: new T.Vector3(-3.4, 3.2, BZ + 2.8), to: PCIE },
      glowAt: [GX, 3, GZ], heatAt: [GX, 2.0, GZ],
      shots: {
        '2': { pos: [GX + 2.2 + 7.0, 7.4, GZ - 1.2 + 7.2], tgt: [GX + 2.2, Y0 + 0.2, GZ - 1.2] },
        '3': { pos: [GX + 5.4, 4.6, GZ + 8.2], tgt: [GX, Y0 + 0.4, GZ] },
        '4': { pos: [PB.x - 4.6, 6.8, PB.z + 8.8], tgt: [PB.x, pbY + 0.1, PB.z] }
      }
    };
  }

  DSP.machines = DSP.machines || {};
  DSP.machines.pro6000 = { build, name: 'PRO 6000' };
})(window.DSP = window.DSP || {});
