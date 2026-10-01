/* =========================================================
   MACHINE: AMD Strix Halo (Ryzen AI Max+ 395, 128 GB), a recipe for kit/recipe.js. AMD's 150 mm developer mini PC:
   a graphite case with a hex-perforated back wall and a red trim, a green board. One package with three dies: two
   CPU chiplets (8 Zen 5 cores each) and the I/O die with the Radeon 8060S (40 compute units, about half the Spark's
   GPU area, like its math), the NPU and the memory controllers. 8 LPDDR5X packages of 16 GB in a row in front and
   a row behind, one 32-bit lane each: a 256-bit bus, the Spark's count. The cooler lifts straight up.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.recipe) return;
  const PX = -0.8, PZ = -0.3;                       // the package centre
  const IX = PX + 0.75, IW = 3.7, ID = 3.4;         // the I/O die: centre x, width, depth
  const CX = PX - 2.1;                              // the two CPU chiplets' centre x
  const GX = IX + 0.4, GZ = PZ - 0.75;              // the GPU block on the I/O die
  const NX = IX - 0.95, NZ = PZ + 0.95;             // the NPU block
  const SX = -5.7, SZ = 0.6;                        // the SSD, turned to run front to back
  DSP.recipe.machine({
    id: 'strix', name: 'STRIX HALO', mm: 150, width: 16.6, y0: 1.1,
    case: { type: 'cutaway', material: 'graphite', back: 'hex', trim: 'red', floorLine: true },
    board: {
      w: 14.4, d: 14.4, color: '#0a1710', gold: '#c09a55', random: [240, 460], holes: [6.8, 24, 13],
      pours: { color: 'rgba(60,110,70,.16)', rects: [[-7.2, -7.2, 14.4, 1.7], [3.7, -4.2, 3.5, 6.6], [-7.2, 5.3, 14.4, 1.9]] },
      art(h, m) {
        h.box(PX, PZ, 6.2, 4.8); m.chips.forEach(ch => h.box(ch.x, ch.z, 1.75, 2.1)); h.box(SX, SZ, 2.5, 8.3);
        for (let a = 0; a < 2; a++) for (let b = 0; b < 6; b++) h.box(4.35 + a * 0.95, -3.3 + b * 0.95, 0.9, 0.9);
        h.text('U1  RYZEN AI MAX+ 395', PX - 2.9, PZ - 2.55);
        m.chips.forEach((ch, i) => h.text('U' + (i + 2), ch.x - 0.85, ch.z + (ch.row > 0 ? 1.3 : -1.15), 24));
        h.text('J1  M.2', SX - 1.2, SZ - 4.35);
        h.text('10GBE', -5.4, -5.9, 24); h.text('HDMI', -3.3, -6.3, 24); h.text('USB4', -1.1, -6.4, 24); h.text('PD IN', 4.3, -6.4, 24);
        h.text('TACDEL LAB  /  ILLUSTRATIVE LAYOUT', -6.9, 7.0, 34); h.text('DESK SPACE PROGRAM  MISSION 01', 1.3, 7.0, 34);
      }
    },
    chip: {
      at: [PX, PZ], substrate: [5.8, 4.4], dies: [[IX, PZ, IW, ID], [CX, PZ - 0.85, 1.15, 1.5], [CX, PZ + 0.85, 1.15, 1.5]],
      // the memory controllers along the I/O die's long edges, where the lanes arrive
      strips: { color: 0x6e5c3c, list: [[IX, PZ - (ID / 2 - 0.13), IW - 0.4, 0.13], [IX, PZ + (ID / 2 - 0.13), IW - 0.4, 0.13]] },
      blocks: [
        { kind: 'media', at: [IX + 1.0, NZ], grid: [3, 2], tile: [0.34, 0.24], pitch: [0.4, 0.3], color: [0.03, 0.045, 0.07] },
        { kind: 'gpu', at: [GX, GZ], grid: [8, 5], tile: [0.25, 0.25], pitch: [0.31, 0.31] },
        { kind: 'cpu', at: [CX, PZ - 0.85], grid: [2, 4], tile: [0.4, 0.26], pitch: [0.48, 0.33] },
        { kind: 'cpu', at: [CX, PZ + 0.85], grid: [2, 4], tile: [0.4, 0.26], pitch: [0.48, 0.33] },
        // the NPU stays dark: llama.cpp runs on the GPU
        { kind: 'npu', at: [NX, NZ], grid: [8, 4], tile: [0.13, 0.13], pitch: [0.18, 0.18], color: [0.08, 0.035, 0.13] }
      ],
      smalls: { n: 17, from: -2.55, pitch: 0.32, edge: 2.02 }, marker: [GX, GZ, 2.62, 1.69]
    },
    // the front row first, so a small model fills where the camera looks
    memory: { layout: 'rows', chips: 8, at: IX, pitch: 1.8, dist: 4.4, inset: 0.95, to: 2.2, fan: 0.7 },
    bus: { bits: 256 },
    power: {
      inductors: [[4.35, -3.3, 2, 6, 0.95, 0.95]], caps: [[6.3, -2.9, 1, 6, 0, 0.95]],
      mlcc: [{ ring: [PX, PZ], sides: 'lr', n: 12, pitch: 0.3, d: 3.15, rows: 2, rowPitch: 0.24 }, { perChip: 5, pitch: 0.3, d: 1.15 }, { grid: [3.95, 2.35, 7, 2, 0.4, 0.3] }],
      resistors: [[5.3, 3.3, 6, 5, 0.22, 0.3], [-4.25, 5.5, 4, 6, 0.22, 0.26]]
    },
    parts: [
      { part: 'ic', at: [4.4, 3.9], size: [1.0, 0.12, 1.0] },                 // the embedded controller
      { part: 'ic', at: [6.2, 2.6], size: [0.55, 0.1, 0.7], r: 0.02 },        // the firmware chip
      { part: 'coin', at: [2.0, 6.2] },
      { part: 'ssd', at: [SX, SZ], turn: true, lines: ['2 TB NVMe SSD', 'M.2 2280   PCIe 4.0', 'where models wait'] },
      { part: 'wifi', at: [-0.7, 6.2] },
      { part: 'nic', at: [4.9, 6.0] },
      { part: 'portRow', list: [
        { kind: 'rj45', x: -4.9, z: -7.05 }, { kind: 'hdmi', x: -2.9, z: -7.2 },
        { kind: 'usbc', x: -1.3, z: -7.3 }, { kind: 'usbc', x: -0.2, z: -7.3 }, { kind: 'usbc', x: 0.9, z: -7.3 },
        { kind: 'usbc', x: 4.6, z: -7.3 }
      ] }
    ],
    cooler: { type: 'stack', y: 8.2, at: [PX, PZ], fanK: 1.4, seat: -6.6, guides: { half: [2.5, 1.95], from: [PX, PZ], to: [PX, PZ], scale: [1.1, 1.05] } },
    shell: {
      type: 'box', outline: ['chamfered', 1.9], h: 5.7, bevel: 0.14, material: { from: 'graphite', color: 0x3e434e }, trim: 0.5,
      hexVent: [11.5, -0.4, -0.6], light: { color: 'red', bar: [3.4, 0.08], at: [-4.6, 1.15, 8.57] }, hint: [1.0, 5.7, 6.2]
    },
    plate: { w: 4.5, h: 2.9, face: 'front', at: [4.9, 2.85, 8.57] },
    mug: [15.2, -4.0],
    load: [SX, 'ssd+.3', SZ],
    labels: [
      ['mem', [IX + 2.7, 'cell', PZ + 4.4], 'LPDDR5X memory: the fuel tank'],
      ['bus', [IX + 0.9, 'board+.05', PZ + 4.4 - 1.4], 'Memory bus: the fuel line'],
      ['gpu', [GX + 0.6, 'tile', GZ + 0.3], 'Radeon 8060S: the engine'],
      ['cpu', [CX, 'tile', PZ + 0.85], 'Two CPU chiplets'],
      ['npu', [NX, 'tile', NZ], 'NPU'],
      ['ssd', [SX, 'ssd+.2', SZ + 1.2], 'SSD'],
      ['fan', [PX + 1.7, 'fan+.25', PZ], 'Cooler, lifted off']
    ],
    chipsText: '8 packages', loadingLabel: 'ssd',
    notes: { cpu: '16 Zen 5 cores', npu: '50 TOPS, idle: llama.cpp uses the GPU', ssd: '2 TB, where models wait', fan: '120 W, spins up under load' },
    // answer packets leave the GPU for the 10 GbE port
    out: { from: [GX, 'tile+.05', GZ], spread: [2, 1.2], mid: [-2.4, 4.4, -5.0], to: [-4.9, 'board+1.0', -7.7] },
    glowAt: [IX, 3, PZ], heatAt: [GX, 2.4, GZ],
    shots: {
      '2': { pos: [IX - 1.8 + 6.6, 8.0, PZ + 4.4 + 7.2], tgt: [IX - 1.8, 1.1 + 0.2, PZ + 4.4] },
      '3': { pos: [GX + 5.4, 5.0, GZ + 8.2], tgt: [GX - 0.4, 1.1 + 0.4, GZ + 0.3] },
      '4': { pos: [SX + 4.6, 7.2, SZ + 9.4], tgt: [SX, 1.1 + 0.3, SZ + 0.6] }
    }
  });
})(window.DSP = window.DSP || {});
