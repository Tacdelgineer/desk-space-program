# Desk Space Program: lab handoff

Mission 01, "Liftoff": an opened-up DGX Spark on a display stand. The model lives in the
memory chips; for every token the whole model crosses the memory bus while the GPU mostly
waits. Built in claude.ai chat as one HTML file (`desk-space-program.html`, about 80 KB).
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
  panel with a big red speed number, side race against RTX 5090 and Mac Studio (bars only),
  controls bar at the bottom, part labels with leader lines, dialogs for What's real, Keys,
  Missions.
- **Keys:** Space launch, 1–4 camera shots, C orbit, H hide UI, L hide labels, F fullscreen, R reset.

## Stack and why

- three.js **r147** UMD build plus `examples/js` add-ons (EffectComposer, ShaderPass,
  RenderPass, UnrealBloomPass, OrbitControls, RoomEnvironment, CopyShader,
  LuminosityHighPassShader), all from `cdn.jsdelivr.net/npm/three@0.147.0/`. r147 is the last
  release that ships browser-global add-ons. claude.ai published pages only allow scripts
  from a few CDN hosts and no ES-module imports from other hosts. For gh-pages you may move
  to modern three with import maps later, but it isn't needed.
- No build step for the page itself. `build_single.mjs` from the tacdel-video skill can inline
  local scripts and bake a data JSON in as `window.__RUN__`.

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
    and needs `--use-angle=swiftshader --enable-unsafe-swiftshader`. Route the CDN URLs to
    local copies (`npm pack three@0.147.0`, `@fontsource/anton`, `@fontsource/archivo-narrow`,
    `@fontsource/ibm-plex-mono`). With a real GPU it's far faster.

## Speed model (estimates, placeholders until measured)

```
weightsGB  = totalParams(B) * bytesPerParam      (16-bit 2.0, 8-bit 1.06, 4-bit 0.57)
kvGB       = kvMBperToken * (promptTokens + answerTokens) / 1024
fits       = weightsGB + kvGB <= memGB - reserveGB
writeTps   = eff * bandwidthGBs / (activeParams * bytesPerParam + avgKvGB)   eff 0.7 dense, 0.5 MoE
readTps    = 0.5 * TFLOPS * 1e12 / (2 * activeParams * 1e9)
busyWrite  = (2 * activeParams * 1e9 / (0.5 * TFLOPS * 1e12)) * writeTps
answer     = 150 tokens; prompts 300 / 8,000 / 32,000 tokens
```

Machines: Spark 128 GB, reserve 8, 273 GB/s, 125 TFLOPS placeholder. RTX 5090 32 GB, reserve
1.5, 1,792 GB/s, 210 placeholder. Mac Studio M3 Ultra 96 GB in the page today (change to the
256 GB config the creator owned), 819 GB/s, 28 placeholder.

`llama-bench` (llama.cpp) reports exactly the two speeds the lab uses: `pp` = reading the
prompt, `tg` = writing. Measured numbers replace the estimates and get tagged `measured`.

## Known issues to fix

- **"GPU busy" is misleading.** It means the share of the GPU's math capacity in use.
  `nvidia-smi` would show 90%+ during writing because memory-bound kernels still count as busy,
  and viewers will call it wrong. Rename to "GPU math used" and explain it in What's real.
- Pills don't re-sync when the selection changes from code.
- Labels still crowd each other when zoomed in; side rails would fix it.
- The claude.ai published link is a snapshot. The home is now GitHub Pages (see below).

## The kit (target layout)

```
labs/
  kit/engine.js        renderer, post chain, lights, floor, camera shots, keys, labels
  kit/parts.js         rounded box, chip, memory package, inductor, cap, heat pipe, fan, SSD, ports
  kit/model.js         speed model above, plus the crew (batching) model
  kit/ui.js            panels, pills, race, dialogs
  kit/themes/screenprint.css
  machines/spark.js    layout: where each part sits
  machines/rtx5090.js
  machines/m3ultra.js
  data/machines.json   specs with a measured/estimated tag per number
  data/models.json
  missions/01-liftoff/index.html  pulls the pieces together
  dist/                build_single output, one file per mission
```

Rule: the split must render the same as today before any new feature goes in.

## Next features (agreed)

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

Not now: drag-to-load crates, pulling the cooler off by hand, sound, live data, share links.

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
  Report with three columns (DGX Spark, RTX 5090, Mac Studio) and rows FITS?, TOKENS/S,
  DONE IN. Those numbers must come from the data files, never typed by hand.
- **`EPISODES.md`** is the list of Shorts. Each one has a preset link that opens the lab in the
  exact state to film. Keep it in step with the missions.
