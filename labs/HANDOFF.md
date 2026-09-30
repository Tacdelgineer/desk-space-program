# Desk Space Program: lab handoff

Mission 01, "Liftoff": an opened-up DGX Spark on a display stand. The model lives in the
memory chips; for every token the whole model crosses the memory bus while the GPU mostly
waits. Built in claude.ai chat as one HTML file (about 80 KB). Session A split it into the kit
(see `labs/kit/README.md` for the files as they are now); the original file is kept in
`labs/_baseline/` with the screenshots the split was checked against.
Everything below was learned the hard way. Read it before touching the code.

## What's in the file today

- **Scene:** plinth, gold case with two walls cut away, metal-foam back wall, PCB with drawn
  gold traces and silkscreen, GB10 (Blackwell GPU die with 48 glowing blocks, Grace CPU die
  with 20), 8 memory chips with 16 cells each (1 cell = 1 GB), memory-bus ribbons with flowing
  particles, power parts, SSD with label, network chip, back ports, cooler lifted off (copper
  plate, heat pipes, fins, spinning fan), dashed exploded-view guide lines.
- **Mechanism:** load (SSD arcs fill the cells) → reading the prompt (GPU blocks blaze, bus
  partly busy) → writing (bus 100%, GPU nearly dark, a sweep runs through the memory cells
  each token, answer types out at the estimated speed) → done. MoE models flash only a few
  cells per token. Too-big models overflow in magenta.
- **UI:** retro screenprint theme (one CSS block marked `THEME: retro screenprint`), answer
  panel with a big red speed number, side race against the other three machines (bars with the
  status written in them, a measured or reported tag per row), controls bar at the bottom, part
  labels with leader lines, dialogs for What's real and Keys.
- **Machines (switcher, M):** DGX Spark, RTX 5090, Mac Studio M3 Ultra, AMD Strix Halo (Ryzen AI
  Max+ 395, 128 GB, AMD's own 150 x 150 mm mini PC: the Spark's rival with about the same memory
  speed and half the GPU math, drawn as a GPU block half the size; graphite case, hex back wall,
  cooler lifted straight up), RTX Pro 6000 (96 GB, the 5090's chip with 188 of 192 SMs, the same
  1,792 GB/s; a double flow-through card on a gunmetal frame, 32 memory chips, 16 under the board).
- **Keys:** Space launch, 1–4 camera shots, M next machine, C orbit, H hide UI, F fullscreen.

## Stack and why

- three.js **r147** UMD build plus `examples/js` add-ons (EffectComposer, ShaderPass,
  RenderPass, UnrealBloomPass, OrbitControls, RoomEnvironment, CopyShader,
  LuminosityHighPassShader), all from `cdn.jsdelivr.net/npm/three@0.147.0/`. r147 is the last
  release that ships browser-global add-ons. claude.ai published pages only allow scripts
  from a few CDN hosts and no ES-module imports from other hosts. For gh-pages you may move
  to modern three with import maps later, but it isn't needed.
- `node labs/build.mjs` inlines the local scripts, CSS and data files into one page per mission
  in `dist/` (repo root, gitignored). three.js stays on the CDN.

## Gotchas (each one cost a render cycle)

1. **Colors:** set `THREE.ColorManagement.legacyMode = false` before creating any color, or
   every material renders far too bright and the dark stage turns lavender.
2. **Render chain:** RenderPass → UnrealBloom (0.55, 0.45, threshold 0.82) → custom tilt-shift
   horizontal + vertical (focus band, not the stock linear shader) → grade pass that does
   linear→sRGB itself, plus vignette and grain. Render target: HalfFloat with MSAA 4. The
   renderer's own output encoding stays linear because the grade pass converts.
3. **Tone mapping:** ACES, exposure 0.86. Key light warm 3.2 with soft shadows (2048 map),
   cool rim light, hemisphere 0.3.
4. **Environment map** (RoomEnvironment through PMREM) makes metals look real but lights up
   dark surfaces. Keep envMapIntensity tiny on dark things: floor 0.02, plinth 0.12; other
   non-metals were scaled by 0.55.
5. **The background is never seen** from the default angles. The floor texture carries the
   studio light pool (radial gradient, faint grid, fading to black).
6. **Framing:** the camera uses `setViewOffset` so the machine centres in the space left
   between the title, the right-hand panels and the bottom bar, and the distance is computed
   from that free area. Recompute on resize and when panels change size.
7. **Labels** are HTML cards plus an SVG leader line. Each tries several offsets and skips
   any spot that hits a panel or another label, otherwise hides.
8. **`data-theme` on `:root` belongs to the claude.ai viewer** (its light/dark switch). Name
   our themes with a different attribute, e.g. `data-look`.
9. **Canvas textures** draw before web fonts load, so board text uses the fallback font. Fine.
10. **Headless tests:** Chromium with SwiftShader works but runs at about 1 frame per second
    and needs `--use-angle=swiftshader --enable-unsafe-swiftshader`. On the Spark, full Chromium
    (not the headless shell) with `--use-angle=gles-egl` uses the GB10 and is about 10x faster.
    `--use-angle=vulkan` draws black: NVIDIA's Linux Vulkan driver fails `createPipeline` in the
    shadow pass (Mesa's lavapipe runs the same page fine), so engine.js drops shadows when the
    renderer string says NVIDIA + Vulkan. Chrome's Linux default is OpenGL, so visitors don't hit it. Route the CDN URLs to
    local copies (`npm pack three@0.147.0`, `@fontsource/anton`, `@fontsource/archivo-narrow`,
    `@fontsource/ibm-plex-mono`). With a real GPU it's far faster.

## Speed model (estimates; measured Spark runs replace them where they exist)

```
weightsGB  = (totalParams + tableParams)(B) * bytesPerParam      (16-bit 2.0, 8-bit 1.06, 4-bit 0.57)
kvGB       = (kvMBperToken * (promptTokens + answerTokens) + stateMB) / 1024
             kvMBperToken and stateMB come from each model's arch (kit/model.js archModel): only layers with a
             growing cache count per token; sliding windows and linear-attention state are a fixed stateMB
fits       = weightsGB + kvGB <= memGB - reserveGB
writeTps   = eff * bandwidthGBs / (activeParams * bytesPerParam + avgKvGB)   eff 0.7 dense, 0.5 MoE
             (a lookup table takes memory but isn't read per token; Flash-Next attends to at most 2,048 tokens)
readTps    = 0.5 * TFLOPS * 1e12 / (2 * activeParams * 1e9)
busyWrite  = (2 * activeParams * 1e9 / (0.5 * TFLOPS * 1e12)) * writeTps
answer     = 150 tokens; prompts 300 / 8,000 / 32,000 tokens
```

Machines: Spark 128 GB, reserve 8, 273 GB/s, 125 TFLOPS placeholder. RTX 5090 32 GB, reserve
1.5, 1,792 GB/s, 210 placeholder. Mac Studio M3 Ultra 256 GB config (the one the creator owns;
it was 96 GB before Session A), 819 GB/s, 28 placeholder. Strix Halo 128 GB, reserve 8 (Linux
lets its GPU map about half until `ttm.pages_limit` raises it to 120 GiB), 256 GB/s, 59.4 TFLOPS
estimated from 40 CUs at 2,900 MHz. RTX Pro 6000 96 GB, reserve 1.5, 1,792 GB/s, 503.8 TFLOPS (NVIDIA's
dense 16-bit with 32-bit accumulation; GeForce cards do that at half rate, hence the 5090's 210). The numbers
live in `labs/data/machines.json` and `models.json`: the first three machines `"estimated"`, the Strix Halo
and the RTX Pro 6000 `"reported"` with links. A graphics card (`tableOnHost`) leaves a model's lookup table in
the PC's memory, as llama.cpp does, so only the rest has to fit on the card.

Three kinds of number: **measured** on the creator's Spark (`labs/data/measured/`), **reported** by
someone else with a link (`labs/data/reported/`: spec sheets, published llama.cpp runs), **estimated**
by the formulas above. A reported run stands in for the estimate like a measured one; the Strix
Halo's come from local-llm-benchmarks.dev (llama-server, 2,048-token prompts at depth 0 and 8,192)
and, for Gemma 4 E4B's writing, huppiflupp/strix-halo-llm-speeds; the Pro 6000's single run (Flash-Next)
from a post on the model's Hugging Face page. Where a machine has a run for the same model and compression
at another prompt length (or one request when a crew runs), that run scales the estimate ("est. from").

The lineup since Session C: Gemma 4 E4B, Qwen3.6 35B-A3B, Qwen3.8 27B, Qwen3.8-Flash-Next (125.7B plus a
51.2B n-gram table), Qwen3.8-Max (2.4T, estimate only). The Spark is measured by `live/` (llama.cpp
llama-server, 4-bit GGUFs from Unsloth): reading speed (prompt tokens/s) and writing speed (tokens/s) for the
300- and 8,000-token prompts go into `labs/data/measured/spark.json`, and `calc()` uses them for the Spark at
4-bit, crew 1, tagged `measured`. `llama-bench` gives higher numbers for small models (no server in the way).
Two things that change the numbers on this Spark: the GPU clock is capped (about 2,000 MHz of 3,003, recorded in
each run), and a lab page open on the Spark's own screen draws on the same GPU (Gemma 61 -> 44 tokens/s).

## Known issues to fix

- ~~"GPU busy" is misleading~~ Fixed in Session A: now "GPU math used", explained in What's real.
- ~~Pills don't re-sync when the selection changes from code~~ Fixed in Session A (`sel` is a Proxy).
- ~~Labels crowd each other when zoomed in~~ Session B: labels sit on two side rails, sorted by height, leaders never cross; a label with no room on its rail hides.
- The claude.ai published link is a snapshot. The home is now GitHub Pages (see below).

## The kit (target layout; the built parts are described in `labs/kit/README.md`)

```
labs/
  kit/engine.js        renderer, post chain, lights, floor, camera shots, keys, labels
  kit/parts.js         rounded box, chip, memory package, inductor, cap, heat pipe, fan, SSD, ports
  kit/model.js         speed model above, plus the crew (batching) model (not built yet)
  kit/ui.js            panels, pills, race, dialogs
  kit/themes/screenprint.css
  machines/spark.js    layout: where each part sits, and animate()
  machines/rtx5090.js  (Session B)
  machines/m3ultra.js  (Session B)
  machines/strixhalo.js, machines/rtxpro6000.js  (Session D)
  data/machines.json   specs with a measured/reported/estimated tag per number
  data/measured/, data/reported/   real runs: the Spark's, and published ones for the Strix Halo and the Pro 6000
  data/models.json
  missions/01-liftoff/index.html + mission.js   pulls the pieces together
dist/                  (repo root) build output, one file per mission plus the hub page
```

Rule: the split must render the same as today before any new feature goes in. Check it with
`labs/tools/shoot.mjs` against `labs/_baseline/` (Session A did; only ~30 speckle pixels differed).

## Next features (agreed; 1-4 built in Session B, 5 is Session C)

1. **Machine switcher** with three real interiors built from the parts library, same size on
   screen (equal treatment):
   - RTX 5090: a graphics card. GPU die in the centre ringed by 16 GDDR7 chips, 512-bit bus
     (16 short, fat bundles), PCIe edge connector, big cooler lifted off.
   - Mac Studio M3 Ultra: two dies joined into one chip, memory packages sitting on the chip
     package itself, 1,024-bit bus (very short, very wide), no separate GPU.
   - DGX Spark: today's board, 256-bit bus.
   The bus width is the visual lesson: count the wires.
2. **Model-size handle:** drag 1B–200B. Cells fill live, speed updates live, overflow at each
   machine's limit. Presets stay as notches.
3. **Crew dial,** 1–64 requests at once. Per step, memory traffic ≈ active weights + crew × KV;
   math ≈ crew × 2 × active params. GPU blocks light up as the crew grows, total speed climbs
   while each request stays nearly as fast, until the GPU maxes out or prompt memory
   overflows, whichever comes first.
4. **Labels on side rails.**
5. **Measured Spark numbers** from `llama-bench`.

Not now: drag-to-load crates, pulling the cooler off by hand, sound, share links. Live data is built (Session C, `live/`).

## Home, cloud sessions and the Shorts

- **Home:** this GitHub repo. GitHub Actions builds `dist/` and deploys it to GitHub Pages on
  every push to `main`: a hub page listing the missions, one page per mission.
- **Cloud sessions** (Claude Code on the web) work on a branch and open a pull request. Merge it
  and Pages redeploys. Skills only exist in the cloud if they're committed to this repo, so
  the kit's own notes live in `labs/kit/README.md`, not in a local skill folder.
- **Headless browser in the cloud:** Playwright's browser download can be blocked there. If
  it is, use Puppeteer (its Chrome comes from storage.googleapis.com), or skip the screenshot
  check and say so in the report.
- **Measurements** (`llama-bench`) only happen on the DGX Spark, in a local session.
- **The Shorts pack** is described in `docs/shorts-template.md`. Every episode ends on a Mission
  Report with three columns (DGX Spark, RTX 5090, Mac Studio; a fourth, Strix Halo, from
  episode 9 on, a fifth, RTX Pro 6000, from 11 on) and rows FITS?, TOKENS/S, DONE IN. Those numbers must come from the data files, never typed by hand.
- **`EPISODES.md`** is the list of Shorts. Each one has a preset link that opens the lab in the
  exact state to film. Keep it in step with the missions.
