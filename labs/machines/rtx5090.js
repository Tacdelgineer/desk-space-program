/* =========================================================
   MACHINE: RTX 5090, a recipe for kit/recipe.js. A 304 mm graphics card lying flat with its cooler lifted off.
   The GB202 die with 170 blocks in the centre, 16 GDDR7 chips of 2 GB around it, one 32-bit lane each: a 512-bit
   bus of 16 short, fat lanes. Models arrive through the PCIe edge connector.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.recipe) return;
  const BZ = 2.6, GX = -0.3, GZ = BZ, FIN_Z = -4.9;        // the card's centre line, the GPU, the fin block behind it
  DSP.recipe.machine({
    id: 'rtx5090', name: 'RTX 5090', mm: 304, width: 16.2, y0: 0.7,
    case: { type: 'card', material: 'dark', plate: [16.2, 0.46, 8.2, 0.12], at: [0, BZ] },
    board: {
      w: 15.6, d: 7.6, at: [0, BZ], color: '#080a0f', random: [150, 300], traces: { spread: 0.075 },
      edge: { tab: [-4.1, BZ + 4.1, 5.2, 0.6], fingers: { x: -6.5, z: BZ + 4.12, n: 40, skip: 9, pitch: 0.123, size: [0.08, 0.44] } },
      art(h, m) {
        h.box(GX, GZ, 4.4, 4.4);
        m.chips.forEach(ch => h.box(ch.x, ch.z, ch.rot ? 1.05 : 1.15, ch.rot ? 1.15 : 1.05));
        h.text('U1  GB202', GX + 1.1, GZ - 2.35);
        m.chips.forEach((ch, i) => { if (ch.side === 't') h.text('M' + (5 - i), ch.x - 0.45, ch.z - 0.6, 24); });
        h.text('PCIE 5.0 X16', -6.4, BZ + 3.45);
        h.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', 1.2, BZ + 3.55, 34);
        h.text('DESK SPACE PROGRAM  MISSION 01', -7.4, BZ - 3.3, 34);
      }
    },
    chip: {
      at: [GX, GZ], substrate: [4.2, 4.2, 0.2], dies: [[GX, GZ, 3.2, 3.4]],
      blocks: [{ kind: 'gpu', at: [GX, GZ], grid: [10, 17], tile: [0.25, 0.15], pitch: [0.3, 0.195] }],
      marker: [GX, GZ, 3.45, 3.65]
    },
    // in order round the ring, the right side last, so a model that overflows spills where shot 2 looks
    memory: { layout: 'ring', chips: 16, sides: [5, 3], pitch: 1.2, dist: 3.0, sidePitch: 1.15, sideDist: 3.2, inset: 0.45, fan: 0.55,
      chip: { w: 1.0, d: 0.9, h: 0.12, cols: 2, rows: 1, cw: 0.4, cd: 0.66, px: 0.46, pz: 0 } },
    bus: { bits: 512, width: 0.7, per: 22 },
    power: {
      inductors: [[4.7, BZ - 2.4, 3, 6, 0.95, 0.95], [-6.6, BZ - 1.9, 2, 5, 0.95, 0.95]],
      caps: [[7.45, BZ - 2.4, 1, 6, 0, 0.95], [-4.85, BZ - 1.4, 1, 4, 0, 0.95]],
      connector: [3.9, BZ - 3.35],
      mlcc: [{ ring: [GX, GZ], n: 12, pitch: 0.3, d: 2.25 }, { grid: [-6.8, BZ + 2.95, 10, 2, 0.26, 0.3] }],
      resistors: [[4.6, BZ + 3.3, 13, 2, 0.22, 0.3]]
    },
    parts: [
      { part: 'bracket', at: [-8.0, BZ], outside: true },
      { part: 'boxes', size: [1.1, 0.55, 0.95], y: 0.28, list: [-2.4, -0.8, 0.8, 2.4].map(dz => [-7.35, BZ + dz]), outside: true }
    ],
    cooler: { type: 'split', y: 5.6, finZ: FIN_Z, fans: [-4.3, 4.3], fanK: 1.3, seat: [-4.42, -4.55, 7.5],
      guides: { half: [2.2, 2.2], from: [GX, GZ], to: [GX, GZ], scale: [0.72, 0.76] } },
    shell: {
      type: 'cover', x: [-7.9, 8.2], z: [-1.55, 6.35], y: [0.47, 3.95], round: 0.7, bevel: 0.16, color: 0x2a2b31, rough: 0.42, metal: 0.55,
      fans: [[-4.3, FIN_Z + 7.5, 2.35, 2.36, 0.07, 64], [4.3, FIN_Z + 7.5, 2.35, 2.36, 0.07, 64]], stripe: true, hint: [0.1, 3.95, 5.4]
    },
    plate: { w: 3.3, h: 4.3, face: 'top', at: [0, 3.95 + 0.01, FIN_Z + 7.5] },
    mug: [11.3, BZ - 2],
    load: [-4.1, 'board+.2', BZ + 4.2],
    labels: [
      ['mem', [GX + 2.4, 'cell', GZ - 3.0], 'GDDR7 memory: the fuel tank'],
      ['bus', [GX + 2.4, 'board+.05', GZ + 1.15], 'Memory bus: the fuel line'],
      ['gpu', [GX + 0.4, 'tile', GZ + 0.6], 'Blackwell GPU: the engine'],
      ['pcie', [-4.6, 'board+.02', BZ + 4.2], 'PCIe slot: the loading dock'],
      ['power', [3.9, 'board+.62', BZ - 3.35], '12V-2x6 power'],
      ['fan', [4.3, 'fan+.25', FIN_Z], 'Cooler, lifted off']
    ],
    chipsText: '16 chips', loadingLabel: 'pcie',
    notes: { pcie: 'models load from the PC\'s SSD', power: 'up to 575 W', fan: 'spins up under load' },
    // answers go back out through the slot to the PC
    out: { from: [GX, 'tile+.05', GZ], spread: [2, 2], mid: [-2.6, 3.4, BZ + 2.4], to: [-4.1, 'board+.2', BZ + 4.2] },
    glowAt: [GX, 3, GZ], heatAt: [GX, 2.0, GZ],
    shots: {
      '2': { pos: [GX + 2.2 + 7.0, 7.4, GZ - 1.2 + 7.2], tgt: [GX + 2.2, 0.7 + 0.2, GZ - 1.2] },
      '3': { pos: [GX + 5.4, 4.6, GZ + 8.2], tgt: [GX, 0.7 + 0.4, GZ] },
      '4': { pos: [-4.1 - 5.3, 7.1, BZ + 4.0 + 8.6], tgt: [-4.1, 0.7 + 0.2, BZ + 4.0] }
    }
  });
})(window.DSP = window.DSP || {});
