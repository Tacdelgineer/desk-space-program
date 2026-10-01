/* =========================================================
   MACHINE: Mac Studio, M3 Ultra, 256 GB, a recipe for kit/recipe.js. A 197 mm aluminium case with rounded corners.
   The chip package carries everything: two dies joined into one chip (GPU and CPU cores on both) and 8 memory
   packages of 32 GB on the package itself, four 32-bit lanes each: a 1,024-bit bus of 32 very short lanes.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.recipe) return;
  const PZ = -0.6, SUB_Y = 1.1 + 0.22, CZ = PZ - 2.6;      // the package centre (x = 0), its top, the heatsink set back
  DSP.recipe.machine({
    id: 'mac', name: 'MAC STUDIO', mm: 197, width: 16.6, y0: 1.1,
    case: { type: 'cutaway', material: 'alu', corner: 2.2, back: 'perforated' },
    board: {
      w: 14.4, d: 14.4, color: '#0c1116', random: [240, 460], traces: { n: 3, spread: 0.1, width: 2.5, to: 1.5 },
      art(h) {
        h.box(0, PZ, 10.2, 9.2); h.box(-1.4, 5.6, 8.3, 2.5);
        h.text('U1  M3 ULTRA', -4.9, PZ - 4.8); h.text('J1  SSD', -6.6, 4.1);
        h.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', -6.7, 6.95, 34); h.text('DESK SPACE PROGRAM  MISSION 01', 1.0, 6.95, 34);
      }
    },
    chip: {
      at: [0, PZ], substrate: [9.8, 8.8, 0.22, 0.08], dies: [[-2.2, PZ, 4.2, 3.3], [2.2, PZ, 4.2, 3.3]], bridge: [0, PZ, 0.34, 2.6],
      // per die: 40 GPU cores on the outer side, 16 CPU cores next to the bridge
      blocks: [
        { kind: 'gpu', at: [-3.15, PZ], grid: [5, 8], tile: [0.34, 0.28], pitch: [0.4, 0.37] },
        { kind: 'gpu', at: [3.15, PZ], grid: [5, 8], tile: [0.34, 0.28], pitch: [0.4, 0.37] },
        { kind: 'cpu', at: [-0.95, PZ], grid: [2, 8], tile: [0.46, 0.28], pitch: [0.54, 0.37] },
        { kind: 'cpu', at: [0.95, PZ], grid: [2, 8], tile: [0.46, 0.28], pitch: [0.54, 0.37] }
      ],
      marker: [0, PZ, 8.9, 3.55]
    },
    memory: { layout: 'package', chips: 8, pitch: 2.3, dist: 2.95, lanePitch: 0.58, inset: 0.9,
      chip: { w: 2.2, d: 1.8, h: 0.13, cols: 8, rows: 4, cw: 0.2, cd: 0.34, px: 0.25, pz: 0.4 } },
    bus: { bits: 1024, width: 0.44, per: 10, size: 0.11 },
    power: {
      inductors: [[-6.25, -4.6, 1, 7, 0, 0.95], [6.25, -4.6, 1, 7, 0, 0.95]], caps: [[-5.35, -3.9, 1, 5, 0, 1.0], [5.35, -3.9, 1, 5, 0, 1.0]],
      mlcc: [{ ring: [0, PZ], sides: 'tb', n: 30, pitch: 0.31, d: 4.65, from: -4.5 }],
      resistors: [[3.2, 4.3, 10, 4, 0.22, 0.3]]
    },
    parts: [{ part: 'ssd', at: [-1.4, 5.6], lines: ['SSD module', 'removable, Apple', 'where models wait'] }, { part: 'ports', offset: [0.4, 0.2] }],
    // lifted off and back, so it doesn't hide the chip: one big copper heatsink, two blowers behind it
    cooler: { type: 'heatsink', y: 7.0, at: [0, CZ], plate: [8.2, 5.6], fins: { n: 42, from: -3.9, pitch: 0.19, dy: 0.8, size: [0.05, 1.3, 5.3] },
      fans: [[-3.4, 9.1, -6.4], [3.4, 9.1, -6.4]], fanK: 1.05, seat: -5.25, guides: { half: [3.8, 2.6], from: [0, CZ], to: [0, PZ], scale: [1.2, 1.6], dy: 0 } },
    shell: {
      type: 'box', outline: ['rounded', 2.45], h: 8.2, bevel: 0.42, material: { from: 'alu', color: 0xb4b9c3 }, seam: 1.6,
      ventRings: [[[1.3, 8], [2.2, 14], [3.1, 20]], -1.2], light: { color: 'teal', bar: [2.6, 0.07], glow: 1.2, at: [0, 1.1, 8.57] }, hint: [1.5, 8.2, 6.0]
    },
    plate: { w: 5.4, h: 3.1, face: 'front', at: [0, 4.6, 8.58] },
    mug: [13.9, -3.6],
    load: [-1.4, 'ssd+.3', 5.6],
    labels: [
      ['mem', [3.45, 'cell', PZ - 2.95], 'Memory, on the chip: the fuel tank'],
      ['bus', [2.6, 'sub+.05', PZ + 1.9], 'Memory bus: the fuel line'],
      ['gpu', [3.15, 'tile', PZ + 0.6], 'GPU cores: the engine'],
      ['bridge', [0, 'die+.12', PZ + 0.8], 'UltraFusion'],
      ['ssd', [-1.8, 'ssd+.2', 5.6], 'SSD'],
      ['fan', [3.4, 'fan+.25', -6.4], 'Cooler, lifted off']
    ],
    chipsText: '8 packages', loadingLabel: 'ssd',
    notes: { bridge: 'two chips joined into one, 32 CPU cores', ssd: 'where models wait', fan: 'spins up under load' },
    out: { from: [3.15, 'tile+.05', PZ], spread: [2, 2], mid: [1.0, 4.4, -4.6], to: [-0.7, 'board+1.1', -7.7] },
    glowAt: [0, 3, PZ], heatAt: [0, 2.4, PZ],
    shots: {
      '2': { pos: [2.3 + 7.0, 8.4, PZ + 2.95 + 7.2], tgt: [2.3, SUB_Y + 0.2, PZ + 2.95] },
      '3': { pos: [3.1 + 5.6, 5.0, PZ + 8.4], tgt: [2.6, SUB_Y + 0.2, PZ] },
      '4': { pos: [-1.8 - 5.3, 7.5, 5.4 + 8.6], tgt: [-1.8, 1.1 + 0.3, 5.4] }
    }
  });
})(window.DSP = window.DSP || {});
