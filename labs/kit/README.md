# The kit

Plain browser scripts, no framework. Each file adds one object to `window.DSP`. A mission page loads
them in this order: three.js (from a CDN), `model`, `engine`, `parts`, `board`, `ui`, the machines, the mission.
Paths below are inside `labs/` unless they start with `.github`.

## Files

**kit/** (shared by every mission)
- `kit/model.js`: speed math (`calc`, including the crew and where the crew dial runs out), sized models for the size handle, number formatting, reading the data files. Edit to change how speed is estimated or to prefer measured numbers.
- `kit/engine.js`: renderer, lights, post chain, floor, camera shots (a machine can bring its own 2-4), keys, labels on side rails, particles, frame loop. Edit for anything about look or camera that every machine shares.
- `kit/parts.js`: rounded box, materials, board texture, and one builder per part (tiles, memory, caps, SSD, ports, heat pipe, cooler, fan). Edit to add a part; builders take coordinates from the machine file.
- `kit/board.js`: what every machine does as the simulation runs: bus lanes (one per 32 bits) with flowing data, memory cells, one prompt-memory group per request, GPU blocks lit in proportion to the math used, the maxed-out marker. Edit to change how all machines light up.
- `kit/ui.js`: pills, race panel, toast, dialogs, hide-interface. Edit for interface behaviour, not for wording.
- `kit/themes/screenprint.css`: the whole retro screenprint look, one file. Swap it to reskin.

**machines/** (where the parts sit, and how the machine lights up)
- `machines/spark.js`, `machines/rtx5090.js`, `machines/m3ultra.js`: where each machine's parts sit, its bus lanes, labels, close-up shots. Each builds into its own group (so it can sink into the stand) and hands its parts to `board.lightUp`. Copy one to start another machine, then add it to `data/machines.json` and the mission's script list.

**data/** (every number is `{ "value": n, "source": "estimated" }`)
- `data/machines.json`: memory, reserve, bandwidth, TFLOPS per machine. Edit when a spec is checked or measured.
- `data/models.json`: model sizes, prompt memory per token, compression levels (bytes per parameter), the prompt lengths, and the size handle's range and scaling.
- `data/missions.json`: the list on the hub page. Set `status` to `live` and add `dir` when a mission ships.

**missions/01-liftoff/** (one folder per mission)
- `index.html`: the page markup and the words; pulls the pieces together. Edit for copy and layout.
- `mission.js`: the choices, machine switching, size handle, crew dial, URL presets (list at its top), the simulation phases and the live text. Edit for what the mission does.

**hub/**
- `hub/index.html`: template for the hub page. The build fills in the mission list.

**Build and checks**
- `build.mjs`: `node labs/build.mjs` writes `dist/` (gitignored): `dist/index.html` and `dist/<mission>/index.html`, each one file.
- `tools/shoot.mjs`: deterministic screenshots of a page or a preset (`page.html?machine=mac&crew=16`) and a pixel compare. Needs `npm i --no-save playwright` once. `SHOOT_GPU=1` (fast), `SHOOT_SIZE=1080x1920`, `SHOOT_UI=1`.
- `tools/report.mjs`: an episode's Mission Report numbers from the data files, with the source of every input.
- `_baseline/`: the three reference screenshots (software render, Spark, Session B look) and the original single-file page.
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
