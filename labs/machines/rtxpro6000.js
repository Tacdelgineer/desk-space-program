/* =========================================================
   MACHINE: RTX Pro 6000 Blackwell Workstation Edition, 96 GB, a recipe for kit/recipe.js. A 304 mm double
   flow-through card lying flat: a compact main board in the middle, a fin stack and a fan at each end, the PCIe
   fingers on their own small board, the display outputs on another, on a gunmetal frame with a silver edge. The
   5090's GB202 chip with 188 of its 192 SMs on. 16 memory positions, a 3 GB chip on top of the board and another
   under it (32 chips, 6 cells a position), one 32-bit lane each: a 512-bit bus, as wide as the 5090's.
   ========================================================= */
(function (DSP) {
  'use strict';
  if (!DSP.recipe) return;
  const BZ = 2.5, GX = 0.2, GZ = BZ;                 // the card's centre line, the GPU
  const LX = -4.3, RX = 4.7, BD = 7.0;               // the main board: x from LX to RX, BD deep
  const FL = -6.0, FR = 6.45;                        // the two fin stacks
  const PB = { x: -5.9, z: BZ + 3.45 }, pbY = 0.47;  // the PCIe board
  DSP.recipe.machine({
    id: 'pro6000', name: 'PRO 6000', mm: 304, width: 16.2, y0: 0.7,
    case: { type: 'card', material: 'gunmetal', plate: [16.2, 0.4, 7.6, 0.14], at: [0, BZ], edges: true, opening: [FR, 1.45], standoffs: [LX, RX, BD] },
    board: {
      w: RX - LX, d: BD, at: [(LX + RX) / 2, BZ], color: '#07080b', random: [130, 260], traces: { spread: 0.07 },
      art(h, m) {
        h.box(GX, GZ, 4.4, 4.4);
        m.chips.forEach(ch => h.box(ch.x, ch.z, ch.rot ? 1.05 : 1.15, ch.rot ? 1.15 : 1.05));
        h.text('U1  GB202', GX + 0.9, BZ - 2.2, 26);
        h.text('32 X 3 GB: 16 ON TOP, 16 UNDERNEATH', LX + 0.3, BZ + 3.35, 22);
        h.text('ILLUSTRATIVE LAYOUT', RX - 2.9, BZ - 3.2, 26);
      }
    },
    chip: {
      at: [GX, GZ], substrate: [4.2, 4.2, 0.2], dies: [[GX, GZ, 3.2, 3.4]],
      // 188 SMs lit by the simulation, the 4 corner ones switched off
      blocks: [
        { kind: 'gpu', at: [GX, GZ], grid: [12, 16], tile: [0.2, 0.15], pitch: [0.25, 0.2], skip: 'corners' },
        { kind: 'off', at: [GX, GZ], grid: [12, 16], tile: [0.2, 0.15], pitch: [0.25, 0.2], color: [0.06, 0.06, 0.07], skip: 'not-corners' }
      ],
      marker: [GX, GZ, 3.45, 3.65]
    },
    // the chips under the board sit on the frame
    memory: { layout: 'ring', chips: 16, sides: [5, 3], pitch: 1.1, dist: 2.85, sidePitch: 1.1, sideDist: 3.05, inset: 0.45, fan: 0.6, under: 0.47,
      chip: { w: 1.0, d: 0.9, h: 0.12, cols: 3, rows: 2, cw: 0.24, cd: 0.33, px: 0.29, pz: 0.39 } },
    bus: { bits: 512, width: 0.6, per: 20 },
    power: {
      inductors: [[LX + 0.55, BZ - 2.4, 1, 6, 0, 0.95], [RX - 0.55, BZ - 1.8, 1, 5, 0, 0.95]], caps: [[LX + 1.35, BZ - 2.95, 1, 2, 0, 5.9]],
      connector: [RX - 1.0, BZ - 3.05],
      mlcc: [{ ring: [GX, GZ], n: 12, pitch: 0.3, d: 2.25 }],
      resistors: [[RX - 1.65, BZ + 2.6, 8, 3, 0.2, 0.28], [LX + 0.15, BZ - 3.3, 5, 2, 0.2, 0.25]]
    },
    parts: [
      { part: 'pcieBoard', at: [PB.x, PB.z], y: pbY, ribbon: [LX - 0.45, BZ + 2.8], outside: true },
      { part: 'subBoard', size: [1.1, 6.6], at: [-7.35, BZ], y: pbY, color: 0x07080b, outside: true },
      { part: 'portRow', y: pbY + 0.06, list: [-2.4, -0.8, 0.8, 2.4].map(dz => ({ kind: 'dp', x: -7.35, z: BZ + dz })), outside: true },
      { part: 'bracket', at: [-8.1, BZ], outside: true }
    ],
    cooler: { type: 'flow', y: 6.2, ends: [FL, FR], fanK: 0.95, seat: -5.03, guides: { half: [2.2, 2.2], from: [GX, GZ], to: [GX, GZ], scale: [0.72, 0.76] } },
    shell: {
      type: 'cover', x: [-8.05, 8.15], z: [BZ - 3.85, BZ + 3.4], y: [0.42, 3.75], round: 0.55, bevel: 0.14, color: 0x3b3f48, rough: 0.36, metal: 0.75,
      fans: [[FL, BZ, 1.66, 1.67, 0.06, 56], [FR, BZ, 1.66, 1.67, 0.06, 56]], lines: { color: 'teal', w: FR - FL - 4.0, x: (FL + FR) / 2 },
      hint: [(FL + FR) / 2, 3.75, BZ + 3.4 - 0.6]
    },
    plate: { w: 5.2, h: 3.0, face: 'top', at: [(FL + FR) / 2, 3.75 + 0.01, BZ - 0.2] },
    mug: [11.25, BZ - 2],
    load: [PB.x, pbY + 0.1, PB.z + 0.3],
    labels: [
      ['mem', [GX + 2.2, 'cell', GZ - 2.85], 'GDDR7 memory: the fuel tank'],
      ['bus', [GX + 2.2, 'board+.05', GZ + 1.1], 'Memory bus: the fuel line'],
      ['gpu', [GX + 0.4, 'tile', GZ + 0.6], 'Blackwell GPU: the engine'],
      ['pcie', [PB.x - 0.4, pbY + 0.07, PB.z + 0.3], 'PCIe slot: the loading dock'],
      ['power', [RX - 1.0, 'board+.62', BZ - 3.05], '16-pin power'],
      ['fan', [FR, 'fan+.25', BZ], 'Cooler, lifted off']
    ],
    chipsText: '32 chips, 16 underneath', loadingLabel: 'pcie',
    notes: { pcie: 'models load from the PC\'s SSD', power: 'up to 600 W', fan: 'two fans, the air flows through' },
    // answers go back out through the slot to the PC
    out: { from: [GX, 'tile+.05', GZ], spread: [2, 2], mid: [-3.4, 3.2, BZ + 2.8], to: [PB.x, pbY + 0.1, PB.z + 0.3] },
    glowAt: [GX, 3, GZ], heatAt: [GX, 2.0, GZ],
    shots: {
      '2': { pos: [GX + 2.2 + 7.0, 7.4, GZ - 1.2 + 7.2], tgt: [GX + 2.2, 0.7 + 0.2, GZ - 1.2] },
      '3': { pos: [GX + 5.4, 4.6, GZ + 8.2], tgt: [GX, 0.7 + 0.4, GZ] },
      '4': { pos: [PB.x - 4.6, 6.8, PB.z + 8.8], tgt: [PB.x, pbY + 0.1, PB.z] }
    }
  });
})(window.DSP = window.DSP || {});
