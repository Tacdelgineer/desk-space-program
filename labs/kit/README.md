# The kit

Plain browser scripts, no framework. Each file adds one object to `window.DSP`. A mission page loads
them in this order: three.js (from a CDN), `model`, `engine`, `parts`, `ui`, a machine, the mission.
Paths below are inside `labs/` unless they start with `.github`.

## Files

**kit/** (shared by every mission)
- `kit/model.js`: speed math (`calc`), number formatting, and reading the data files. Edit to change how speed is estimated or to prefer measured numbers.
- `kit/engine.js`: renderer, lights, post chain, floor, camera shots, keys, part labels, particles, frame loop. Edit for anything about look or camera that every machine shares.
- `kit/parts.js`: rounded box, materials, and one builder per part (chip, memory, caps, SSD, ports, cooler, fan). Edit to add a part; builders take coordinates from the machine file.
- `kit/ui.js`: pills, race panel, toast, dialogs, hide-interface. Edit for interface behaviour, not for wording.
- `kit/themes/screenprint.css`: the whole retro screenprint look, one file. Swap it to reskin.

**machines/** (where the parts sit, and how the machine lights up)
- `machines/spark.js`: the DGX Spark: board texture, layout, and `animate()` for cells, GPU tiles, bus flow, fan. Copy it to start another machine.

**data/** (every number is `{ "value": n, "source": "estimated" }`)
- `data/machines.json`: memory, reserve, bandwidth, TFLOPS per machine. Edit when a spec is checked or measured.
- `data/models.json`: model sizes, prompt memory per token, and the compression levels (bytes per parameter).
- `data/missions.json`: the list on the hub page. Set `status` to `live` and add `dir` when a mission ships.

**missions/01-liftoff/** (one folder per mission)
- `index.html`: the page markup and the words; pulls the pieces together. Edit for copy and layout.
- `mission.js`: the choices, the simulation phases and the live text. Edit for what the mission does.

**hub/**
- `hub/index.html`: template for the hub page. The build fills in the mission list.

**Build and checks**
- `build.mjs`: `node labs/build.mjs` writes `dist/` (gitignored): `dist/index.html` and `dist/<mission>/index.html`, each one file.
- `tools/shoot.mjs`: deterministic 1920x1080 screenshots and a pixel compare. Needs `npm i --no-save playwright` once.
- `_baseline/`: the three reference screenshots and the original single-file page they came from.
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

- Headless Chrome on the DGX Spark draws this page black through its GPU path, so `shoot.mjs` renders in software (about 20 seconds per shot).
- `shoot.mjs` blocks the web fonts on purpose: board text is drawn before they load, so it would flip between two fonts.
- The theme sets `overflow:hidden` on the body for the full-screen lab. A page that scrolls (the hub) has to undo that.
