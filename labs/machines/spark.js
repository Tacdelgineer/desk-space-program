/* =========================================================
   MACHINE: DGX Spark, a recipe for kit/recipe.js. A 150 mm champagne desktop box. One chip package (GB10): the
   Blackwell GPU die with 48 blocks and the Grace CPU die with 20. 8 memory chips of 16 GB in two columns, one 32-bit
   lane each: a 256-bit bus. The SSD in front, the power stages behind, the cooler (copper plate, heat pipes, fins,
   one fan) lifted off above the chip.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.recipe) return;
  DSP.recipe.machine({
    id: 'spark', name: 'DGX SPARK', mm: 150, width: 16.6, y0: 1.1,
    case: { type: 'cutaway', material: 'gold', back: 'foam' },
    board: {
      w: 15, d: 15, random: [260, 500], under: true, holes: [6.8, 26, 14],
      pours: { color: 'rgba(40,62,100,.18)', rects: [[-7, -7, 14, 3.2], [-7, 4.2, 6, 3], [2, 3.6, 5, 3.4]] },
      art(h, m) {
        h.box(0, 0, 5.2, 5.2); m.chips.forEach(ch => h.box(ch.x, ch.z, 1.85, 2.2));
        for (let i = 0; i < 10; i++) h.box(-4.5 + i, -5.4, 0.95, 0.95);
        h.box(-2.2, 5.6, 8.3, 2.5); h.box(4.2, 5.4, 2.2, 2.2);
        h.text('U1', 2.7, -2.8); m.chips.forEach((ch, i) => h.text('U' + (i + 2), ch.x - 0.9, ch.z - 1.15));
        for (let i = 0; i < 10; i++) h.text('L' + (i + 1), -4.85 + i, -6.05);
        h.text('J1  M.2', -6.3, 4.1); h.text('U10', 3.1, 4.05);
        h.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', -6.9, 7.15, 34); h.text('DESK SPACE PROGRAM  MISSION 01', 1.2, 7.15, 34);
      }
    },
    chip: {
      at: [0, 0], substrate: [4.6, 4.6], dies: [[0.6, 0, 2.55, 3.3], [-1.5, 0, 1.25, 3.3]],
      blocks: [
        { kind: 'gpu', at: [0.6, 0], grid: [6, 8], tile: [0.33, 0.33], pitch: [0.385, 0.39] },
        { kind: 'cpu', at: [-1.5, 0], grid: [2, 10], tile: [0.5, 0.24], pitch: [0.54, 0.3] }
      ],
      smalls: { n: 14, from: -2.05, pitch: 0.31, edge: 2.05 }, marker: [0.6, 0, 2.8, 3.55]
    },
    memory: { layout: 'columns', chips: 8, x: 4.4, pitch: 1.9, inset: 0.8, to: 2.35, squeeze: 0.72 },
    bus: { bits: 256 },
    power: {
      inductors: [[-4.5, -5.4, 10, 1, 1, 0]], caps: [[-3.5, -4.3, 8, 1, 1, 0]],
      mlcc: [{ ring: [0, 0], n: 16, pitch: 0.3, d: 2.62, rows: 2, rowPitch: 0.24 }, { perChip: 6, pitch: 0.3, d: 1.05 }, { grid: [-5.2, -4.85, 22, 1, 0.5, 0] }],
      resistors: [[-6.6, -3.4, 10, 4, 0.22, 0.3], [5.9, -3.5, 5, 6, 0.22, 0.35]]
    },
    parts: [{ part: 'ssd', at: [-2.2, 5.6] }, { part: 'nic', at: [4.2, 5.4] }, { part: 'ports' }],
    cooler: { type: 'tower', y: 6.4, fan: [0, 9.1, -4.8], seat: -4.78, guides: { half: [2.2, 2.2], from: [0.1, 0], to: [0, 0], scale: [1.04, 1.04] } },
    shell: {
      type: 'box', outline: ['rounded', 0.55], h: 5.9, bevel: 0.2, material: { from: 'gold' }, inset: 15.4,
      perf: [26, 9, -6.25, -6.4, 0.5, 0.12], grille: { at: [-2.7, 2.95], size: [10.4, 3.2], slats: [9, 1.62, 0.335] },
      light: { color: 'teal', dot: 0.13, at: [-7.3, 5.15, 8.58] }, hint: [1.5, 5.9, 6.2]
    },
    plate: { w: 4.5, h: 2.9, face: 'front', at: [5.55, 2.95, 8.56] },
    mug: [15.2, -4.0],
    load: [-2.2, 'ssd+.3', 5.6],
    labels: [
      ['mem', [4.4, 'cell', -2.85], 'Memory: the fuel tank'],
      ['bus', [3.0, 'board+.05', -2.0], 'Memory bus: the fuel line'],
      ['gpu', [0.9, 'tile', 0.6], 'Blackwell GPU: the engine'],
      ['cpu', [-1.5, 'tile', 1.0], 'Grace CPU'],
      ['ssd', [-2.6, 'ssd+.2', 5.6], 'SSD'],
      ['fan', [1.4, 'fan+.25', -4.8], 'Cooler, lifted off']
    ],
    chipsText: '8 chips', loadingLabel: 'ssd',
    notes: { cpu: '20 Arm cores', ssd: '4 TB, where models wait', fan: 'spins up under load' },
    // answer packets leave the GPU for the back ports
    out: { from: [0.6, 'tile+.05', 0], spread: [1, 2], mid: [-0.3, 4.2, -4.2], to: [-1.1, 'board+1.1', -7.9] },
    glowAt: [0, 3, 0], heatAt: [0.6, 2.4, 0]
  });
})(window.DSP = window.DSP || {});
