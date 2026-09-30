# The kit

Plain browser scripts, no framework. Each file adds one object to `window.DSP`. A mission page loads
them in this order: three.js (from a CDN), `model`, `engine`, `parts`, `board`, `ui`, the machines, the mission.
Paths below are inside `labs/` unless they start with `.github`.

## Files

**kit/** (shared by every mission)
- `kit/model.js`: speed math (`calc`, including the crew and where the crew dial runs out), prompt memory from each model's `arch` (`archModel`), real runs (`setRuns`: a matching measured or reported run replaces the estimated speeds, and the weights if it has them; `p.source` and `p.readSource` say which; without one, the nearest run for the same model and compression, another prompt length or crew 1, scales the estimate, `p.scaledFrom`), a graphics card's lookup table left in the PC's memory (`tableOnHost`, `p.hostTableGB`), sized models for the size handle, number formatting, reading the data files. Edit to change how speed is estimated.
- `kit/engine.js`: renderer, lights, post chain, floor, camera shots (a machine can bring its own 2-4), keys, labels on side rails, particles, frame loop. Edit for anything about look or camera that every machine shares.
- `kit/parts.js`: rounded box, materials, board texture, and one builder per part (tiles, memory, caps, SSD, network chip, ports or a `portRow` from a list, heat pipe, cooler, fan). Edit to add a part; builders take coordinates from the machine file.
- `kit/board.js`: what every machine does as the simulation runs: bus lanes (one per 32 bits) with flowing data, memory cells (a model's lookup table in amber; in live mode the real memory in use), one prompt-memory group per request, GPU blocks lit in proportion to the math used, the maxed-out marker. Edit to change how all machines light up.
- `kit/ui.js`: pills, race panel (one row per machine, tagged measured or reported when a real run is behind it), toast, dialogs, hide-interface. Edit for interface behaviour, not for wording.
- `kit/themes/screenprint.css`: the whole retro screenprint look, one file. Swap it to reskin.

**machines/** (where the parts sit, and how the machine lights up)
- `machines/spark.js`, `machines/rtx5090.js`, `machines/m3ultra.js`, `machines/strixhalo.js`, `machines/rtxpro6000.js`: where each machine's parts sit, its bus lanes, labels, close-up shots. Each builds into its own group (so it can sink into the stand) and hands its parts to `board.lightUp`. Copy one to start another machine, then add it to `data/machines.json`, the mission's script list and `WORDS` in `mission.js`; the switcher and the race pick it up from there. The Strix Halo (AMD Ryzen AI Max+ 395, 128 GB) builds its turned SSD in a sub-group and its case from its own materials (graphite, a hex-perforated sheet cut with an alpha map). The RTX Pro 6000 is a double flow-through card: a compact main board, fin stacks at both ends, PCIe and display boards on their own, 188 of 192 SM blocks (`tiles` with `skip`), 16 memory spots of 6 cells with the second chip of each pair under the board.

**data/** (every number is `{ "value": n, "source": "measured" | "reported" | "estimated" | "config" | "chosen" }`, with `link` and `note` where there is one)
- `data/machines.json`: memory, reserve, bandwidth, TFLOPS per machine. The Strix Halo's are reported with their links (AMD's spec pages, a Linux setup guide for the 120 GB its GPU may map) and it lists the specs its interior is drawn from (bus width, compute units, NPU, power, ports). Edit when a spec is checked or measured.
- `data/models.json`: the five models (Gemma 4 E4B, Qwen3.6 35B-A3B, Qwen3.8 27B, Qwen3.8-Flash-Next, Qwen3.8-Max): total, active and table parameters and `arch` (layers that keep a cache, KV heads, head size, sliding windows, linear-attention state), all from each model's config and checkpoint; the 4-bit GGUF the Spark benchmark runs; compression levels (bytes per parameter), the prompt lengths, and the size handle's range and scaling. The `about` field says how each number was counted.
- `data/measured/spark.json`: written by the live benchmark (`live/`), never by hand. Speeds, file sizes, power, temperature and GPU clock for each model at 4-bit with the 300- and 8,000-token prompts.
- `data/reported/pro6000.json`: the one published llama.cpp run of a lab model on the RTX Pro 6000 (Flash-Next, a 22,695-token prompt standing for the codebase prompt; `about` lists the near misses).
- `data/reported/strix.json`: other people's published llama.cpp runs on the Strix Halo, one per model and prompt, each with its link and which point of the source it takes (their prompts are 2,048 tokens: depth 0 stands for the question, depth 8,192 for the document). `about` gives the rules they were picked by. Same shape as a measured file, `source: "reported"`.
- `data/missions.json`: the list on the hub page. Set `status` to `live` and add `dir` when a mission ships.

**missions/01-liftoff/** (one folder per mission)
- `index.html`: the page markup and the words; pulls the pieces together. Edit for copy and layout.
- `mission.js`: the choices, machine switching, size handle, crew dial, URL presets (list at its top), the simulation phases and the live text. Edit for what the mission does.

**hub/**
- `hub/index.html`: template for the hub page. The build fills in the mission list.

**Build and checks**
- `build.mjs`: `node labs/build.mjs` writes `dist/` (gitignored): `dist/index.html` and `dist/<mission>/index.html`, each one file.
- `tools/shoot.mjs`: deterministic screenshots of a page or a preset (`page.html?machine=mac&crew=16`) and a pixel compare. Needs `npm i --no-save playwright` once. `SHOOT_GPU=1` (fast), `SHOOT_SIZE=1080x1920`, `SHOOT_UI=1`, `SHOOT_PHASE=reading` (halfway through reading; use `prompt=doc`), `SHOOT_PHASE=midwrite` (halfway through the answer, for fast machines).
- `tools/report.mjs`: an episode's Mission Report numbers for the five machines from the data files, with the source of every input; measured numbers are marked (meas.), reported ones (rep.).
- `../live/`: live mode on the Spark (`node live/bridge.mjs`): serves `dist/`, runs real models through llama.cpp, streams memory, power and temperature, and the benchmark. See `live/README.md`.
- `_baseline/`: the three reference screenshots (software render, the default page: Spark, Qwen3.8 27B, with the measured speeds of 2026-09-30) and the original single-file page. Regenerate them after a new benchmark: the measured speed decides how far the answer has got in each shot.
- `../.github/workflows/pages.yml`: on push to `main`, builds and deploys `dist/` to GitHub Pages.

## Everyday commands

```
node labs/build.mjs                                  # then open dist/01-liftoff/index.html
node labs/tools/shoot.mjs dist/01-liftoff/index.html /tmp/shots
node labs/tools/shoot.mjs --compare labs/_baseline /tmp/shots
```

A source page (`missions/01-liftoff/index.html`) fetches its data files, so serve `labs/` over http to open it
directly. The built page has everything inline and opens from a file.

## Gotchas

- Headless Chrome on the DGX Spark: Playwright's default headless shell only has software GL. Full Chromium (`channel: 'chromium'`) with `--use-angle=gles-egl` renders on the GB10 (`SHOOT_GPU=1`). ANGLE on Vulkan draws black there: NVIDIA's driver fails the shadow-pass pipelines, so the engine turns shadows off when it sees NVIDIA + Vulkan. The baseline stays software-rendered (about 20 s per shot).
- `shoot.mjs` blocks the web fonts on purpose: board text is drawn before they load, so it would flip between two fonts.
- The theme sets `overflow:hidden` on the body for the full-screen lab. A page that scrolls (the hub) has to undo that.
