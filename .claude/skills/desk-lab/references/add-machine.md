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

## 3. The machine file (`labs/machines/<id>.js`)

Copy the closest machine: `spark.js` (a desktop box), `strixhalo.js` (a mini PC with chiplets), `m3ultra.js` (memory
on the package), `rtx5090.js` (a graphics card), `rtxpro6000.js` (a flow-through card). Rules:

- Size: the box or card is about 16-17 scene units across. The mug takes `units per mm` = that width / the real
  width in mm (`S.mug(16.6 / 150, ...)` for a 150 mm box).
- Memory: `P.memory(chips, Y0, opts)`, cells per chip = GB per chip (or per position for chips on both sides).
  Order the chips so a model that overflows spills where the memory close-up (shot 2) looks.
- Bus: `DSP.board.bus(lanes, Y0)`: one lane per 32 bits; `busBits` in the return value.
- GPU: `P.tiles(...)` in proportion to the math (the Spark's 48 blocks for 125 TFLOPS is the reference area).
- Shell: a `DSP.shell.block` lid (rounded or chamfered outline, round fan holes), a printed `S.plate`, no logos.
  Everything inside goes into groups so the machine can sink and rise; the cooler sits in its own group that `rig`
  seats on the chip while closed.
- Return `{ group, animate, labels, outP, spillP, shell: { rig, grab, plate, hint, what }, chips, busBits, notes,
  loadingLabel, out, glowAt, heatAt, shots }` (see the end of any machine file) and register
  `DSP.machines[id] = { build, name }` with the plate's display name.

## 4. Register it on the page

- `labs/missions/01-liftoff/index.html`: the machine's `<script>` before `mission.js`; the What's real dialog gets
  a sentence with its published specs.
- `mission.js`: `WORDS[id]` (`short`, `the`, `sticker`), the URL alias list in `start0.machine`, the What if short
  name in `tourLab.whatIf`. The switcher pills, the race rows, the console pads and M (next machine) come from
  `data/machines.json` order.
- `labs/tools/report.mjs`: add the id to `order`.

## 5. Check and document

- Pictures: `SHOOT_GPU=1 node labs/tools/shoot.mjs "dist/01-liftoff/index.html?machine=<id>" out/m 1,2,3,4`, and
  with `SHOOT_CASE=closed` and `SHOOT_CASE=open`. Look at every one: labels on the rails, nothing cut off, the
  shell reads as the machine, the mug at the right size.
- `node scripts/check.mjs`.
- `labs/kit/README.md` (machines list), `labs/HANDOFF.md` (machines and speed-model numbers), `EPISODES.md` (Mission
  Report columns, one episode idea where it wins or loses in a surprising way).
