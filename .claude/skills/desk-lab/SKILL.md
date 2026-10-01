---
name: desk-lab
description: Work on the Desk Space Program lab (this repo) - the three.js missions that open up AI machines. Use for adding a machine, writing a guided tour or an episode (a YouTube Short), filming a tour, making a Short, testing with the contact sheet and privacy scan, and publishing to GitHub Pages. Also use before editing anything under labs/ or scripts/.
---

# Desk Space Program lab

Browser scripts with no framework and no packages. Each kit file adds one object to `window.DSP`. `node labs/build.mjs`
inlines everything into one page per mission in `dist/`; a push to `main` deploys it to
https://tacdelgineer.github.io/desk-space-program/ . Read `CLAUDE.md` first: its rules (privacy, tagged numbers,
the screenprint theme, commit per part) apply to everything below.

## File map

| Path | What it is | Edit it to |
|---|---|---|
| `labs/kit/model.js` | speed model: `calc()`, real runs (`setRuns`), tags | change how speed is estimated |
| `labs/kit/engine.js` | renderer, post chain, camera shots, framing (`setFrame`), pointer, keys, frame loop | change the look or camera for every machine |
| `labs/kit/parts.js` | materials and one builder per part (board, chip tiles, memory, caps, SSD, ports, cooler, fan) | add a part |
| `labs/kit/shell.js` | the closed shell, spec plate, mug at real scale, `rig` (lid opens, cooler rises) | change how machines open |
| `labs/kit/board.js` | how every machine lights up: bus lanes, memory cells, GPU blocks, particles | change the lighting rules |
| `labs/kit/deck.js`, `midi.js` | the 3D Mission Control console, Web MIDI learn | change the console |
| `labs/kit/tour.js` | guided tour player (card, trip map, caption, scrubber, What if, `outline()`) | change how tours look and play |
| `labs/kit/ui.js`, `themes/screenprint.css` | HTML panels; the whole look in one CSS file | change interface or theme |
| `labs/machines/*.js` | one file per machine: where its parts sit, its shell, close-up shots | add or change a machine |
| `labs/missions/01-liftoff/` | `index.html` (markup, words, script list), `mission.js` (choices, simulation, presets, tour lab, metrics) | change what the mission does |
| `labs/data/` | `machines.json`, `models.json`, `measured/`, `reported/`, `missions.json` | add a spec or a run |
| `labs/tours/*.json` | one tour per file; numbers only as `{metric}` placeholders | write a tour |
| `labs/tools/` | `shoot.mjs` (deterministic screenshots, pixel compare), `report.mjs` (Mission Report numbers), `tour-text.mjs` (a tour with its numbers filled in) | |
| `scripts/` | `check.mjs` (/check), `preview.mjs` (link-preview image) | |
| `EPISODES.md` | the Shorts: one row and one block per episode | plan an episode |
| `labs/HANDOFF.md`, `labs/kit/README.md` | design notes and gotchas; the detailed file map | keep in step |

Data contract: every number is `{ "value": n, "source": "measured" | "reported" | "estimated" | "config" | "chosen" }`
with `link` (required for reported) and `note`. URL presets: `machine`, `model`, `bits`, `prompt`, `crew`, `shot`,
`speed`, `record=1`, `open=0|1`, `tour=<id>`, `autoplay=1` (list at the top of `mission.js`).

## Workflows

**Add a machine** (`/add-machine <name>`): specs with links into `data/machines.json`, published runs into
`data/reported/<id>.json`, the machine file, then register it on the page. Steps, the scale rules and the return
contract: `references/add-machine.md`.

**Write a tour** (`/new-tour <story>`): a JSON file in `labs/tours/`, one `<script id="tour-<id>">` tag in the
mission's `index.html`, then proofread it with `node labs/tools/tour-text.mjs <id>`. Format, every metric, layout
rules: `references/tours-and-episodes.md`.

**Plan an episode** (`/new-episode <idea>`): numbers from `labs/tools/report.mjs`, a row and a block in
`EPISODES.md`, preset links, a guess card, a shot list, and its own tour `labs/tours/ep<N>.json`.
`references/tours-and-episodes.md`.

**Test** (`/check`): `node scripts/check.mjs` builds, puts the key states at 1920x1080 and 1080x1920 on
`out/check/contact-sheet.png` and fails on anything private in `dist/`. Look at the sheet. After engine, parts or
machine changes also compare against the baseline. `references/test-and-publish.md`.

**Publish**: commit, `git push` (the pre-push hook runs /check), then confirm the Pages deploy.
`references/test-and-publish.md`.

## Gotchas that cost the most time

- Headless Chrome on the DGX Spark: full Chromium (`channel: 'chromium'`) with `--use-angle=gles-egl` uses the GPU;
  the default headless shell is software only; ANGLE on Vulkan draws black (driver bug, shadows).
- `new THREE.Color()` is white. Cream, yellow and red albedos print near white under the key light: go darker than
  the ink. An upward clearcoat mirrors the studio ceiling.
- Canvas text is drawn before web fonts load; the mission prints plates and the console again once they arrive.
  `shoot.mjs` blocks fonts for pixel-stable compares.
- `waitForFunction` polls with rAF by default and hangs when `shoot.mjs` stubs rAF: pass `polling: 100`.
- The framing fits boxes (`E.setFrame`): a new object in the overview goes into those boxes, not into magic numbers.
- A hand-typed number in words breaks the data rule even when it is right today: the next measurement changes it.
