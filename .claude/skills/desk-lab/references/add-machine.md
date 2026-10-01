# Add a machine

The lab draws every machine at about the same size on screen (equal treatment) and puts the same coffee mug beside
it at the machine's real scale, so the size difference still shows. Counting is the lesson: one memory cell is one
gigabyte, one bus lane is 32 bits, GPU blocks are drawn in proportion to the chip's math.

## 1. Specs (`labs/data/machines.json`)

Add `{ id, name, memGB, reserveGB, bw, tflops }`, each `{ value, source, link, note }`:

- `memGB`, `bw`: from the maker's spec sheet, `"reported"` with the link.
- `reserveGB`: memory the system keeps (8 for unified-memory boxes, about 1.5 for a graphics card), `"estimated"`
  unless measured (nvidia-smi's total).
- `tflops`: dense 16-bit math with 32-bit adding. `"reported"` only if the maker states exactly that figure,
  otherwise `"estimated"` and say how in `note` (units x clock x ops per clock).
- `tableOnHost: true` for a graphics card: llama.cpp leaves a model's lookup table in the PC's memory.
- Also list the specs the drawing uses (bus width, chip count, cores) with links, as the Strix Halo entry does.

## 2. Published runs (`labs/data/reported/<id>.json`)

Copy the shape of `reported/strix.json`: `machine`, `about` (the rules the runs were picked by), and `runs` with
`model`, `bits`, `quant`, `prompt` (300 / 8000 / 32000 stand-ins), `ppTps`, `tgTps`, `promptTokens`, `engine`, `by`,
`date`, `link`, `point` (which point of the source stands for which prompt), `source: "reported"`. Only runs you can
link. No speculative decoding. Then add the file to the page: a `<script type="application/json"
id="data-reported-<id>" src="../../data/reported/<id>.json">` tag in `labs/missions/01-liftoff/index.html` and its
id in the `loadData([...])` list at the top of `mission.js`. Check with `node labs/tools/report.mjs "model=q27"`.

## 3. The recipe (`labs/machines/<id>.js`)

A machine is a recipe that `kit/recipe.js` draws. Copy the closest one and change the numbers:
`spark.js` (a desktop box, memory in two columns), `strixhalo.js` (a mini PC, chiplets, memory in two rows),
`m3ultra.js` (memory on the package), `rtx5090.js` (a graphics card, memory in a ring), `rtxpro6000.js` (a
flow-through card with chips under the board).

```js
DSP.recipe.machine({
  id: 'rtx4090', name: 'RTX 4090', mm: 304, width: 16.2, y0: 0.7,   // real length in mm, the same in scene units
  case:   { type: 'card', material: 'dark', plate: [16.2, 0.46, 8.2, 0.12], at: [0, BZ] },
  board:  { w, d, at, color, random: [traces, vias], traces: { spread }, edge: { tab, fingers }, art(h, m) { /* silkscreen */ } },
  chip:   { at, substrate: [w, d, h], dies: [[x, z, w, d]], blocks: [{ kind: 'gpu', at, grid, tile, pitch }], marker },
  memory: { layout: 'ring', chips: 12, sides: [4, 2], pitch, dist, sidePitch, sideDist, inset, fan, chip: { cols, rows, ... } },
  bus:    { bits: 384 },
  power:  { inductors: [[x0, z0, nx, nz, dx, dz]], caps, connector: [x, z], mlcc: [{ ring: [x, z], n, pitch, d }], resistors },
  parts:  [{ part: 'bracket', at, outside: true }, ...],
  cooler: { type: 'split', ... },   // tower | heatsink | stack | split | flow
  shell:  { type: 'cover', ... },   // box | cover
  plate:  { w, h, face: 'top', at }, mug: [x, z],
  load, labels, chipsText, notes, loadingLabel, out, glowAt, heatAt, shots
});
```

Rules the drawing teaches with:
- Size: the box or card is about 16-17 scene units across (`width`); the mug's scale is `width / mm`, and the
  showroom puts every machine at its real size from the same two numbers.
- Memory: one cell is one gigabyte: `cols * rows` per chip = GB per chip (or per position, for chips on both sides).
  Order the chips so an overflowing model spills where the memory close-up (shot 2) looks.
- Bus: one lane is 32 bits: `bus.bits`; lanes per chip = bits / 32 / chips (the `package` layout spreads several
  lanes over one chip; the others take one lane each).
- GPU: blocks in proportion to the math (the Spark's 48 for 125 TFLOPS is the reference area).
- Shell: stylized, no logos, no brand shapes. A card's shell is a `cover` with fan rings; a box is a `box` lid.
- Something new (a case, a part, a cooler, a shell detail): add it as a kind in `kit/recipe.js`, not as one-off
  code in the recipe. The recipe's `board.art(h, m)` is the one place for free drawing (the silkscreen).
- `shellOnly` must still look right: parts that show beside a closed card get `outside: true`.

## 4. Register it on the page

- `labs/missions/01-liftoff/index.html`: the machine's `<script>` before `mission.js`; the What's real dialog gets
  a sentence with its published specs.
- `mission.js`: `WORDS[id]` (`short`, `the`, `sticker`), the URL alias list in `start0.machine` (and in the
  showroom's `focus` alias), the What if short name in `tourLab.whatIf`. The switcher pills, the race rows, the
  console pads, the showroom's stand and M (next machine) come from `data/machines.json` order.
- `labs/tools/report.mjs`: add the id to `order`.

## 5. Check and document

- Pictures: `SHOOT_GPU=1 node labs/tools/shoot.mjs "dist/01-liftoff/index.html?machine=<id>" out/m 1,2,3,4`, and
  with `SHOOT_CASE=closed` and `SHOOT_CASE=open`. Look at every one: labels on the rails, nothing cut off, the
  shell reads as the machine, the mug at the right size. Then the showroom (`?showroom=1&focus=<id>`): its closed
  shell beside the others at its true size, and its insides when picked.
- `node scripts/check.mjs`.
- `labs/kit/README.md` (machines list), `labs/HANDOFF.md` (machines and speed-model numbers), `EPISODES.md` (Mission
  Report columns, one episode idea where it wins or loses in a surprising way).
