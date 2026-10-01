# Tours and episodes

## A tour (`labs/tours/<id>.json`)

A story in acts, slowed down, so a plain screen recording of the page is a finished video. `kit/tour.js` plays it;
`mission.js` section 7 is the lab it drives and computes every number.

```json
{
  "about": "what this tour is, for the next person",
  "id": "ep4", "title": "can hold {metric} placeholders", "autoplayS": 20,
  "base": { "machine": "spark", "model": "q27", "bits": "4", "prompt": "q", "crew": 1 },
  "acts": [{ "id": "read", "title": "Read" }],
  "steps": [{
    "act": "read", "title": "...", "cam": "3", "trip": ["gpu"],
    "state": { "t": 0.25, "slow": 100, "machine": "mac", "prompt": "doc" },
    "text": ["3-4 short sentences"], "metaphor": "Think of it as ...",
    "chips": [{ "k": "readTps", "label": "reading" }, { "k": "doneS", "m": "mac", "label": "Mac Studio" }],
    "big": 0, "breakIt": { "label": "paste a document", "set": { "prompt": "doc" }, "caption": "..." },
    "caption": "12 words at most", "weight": 1, "report": false
  }],
  "short": { "hook": "...", "key": 1, "lesson": "...", "next": "..." }
}
```

- `state.t`: seconds since you hit enter (negative while loading); `slow`: how many times slowed down. Pick `t` with
  `report.mjs` so the step sits in the right phase (reading ends at `read`, writing at `read + write`).
- `cam`: shot 1 overview, 2 memory, 3 GPU, 4 the SSD or PCIe slot. `trip`: stops lit on the trip map (`ssd`,
  `memory`, `bus`, `gpu`, `port`, `you`).
- `big`: the chip shown big in autoplay (default 0). Autoplay shows only the title, that number and the caption.
- `report: true`: the five-machine table (the Mission Report). `weight`: share of the autoplay time.
- `short` (for Shorts): `hook` (the 1-second card), `key` (step index of the punch-in), `lesson`, `next`.

**Placeholders.** `{k}` the metric for the step's setup, `{k:machine}` or `{k:model}` for another one, `{the}`,
`{The}` ("the Spark"), `{model}` (its name). A chip is `{ k, label }` plus overrides `m`, `model`, `bits`, `prompt`,
`crew`. Metrics (`metric()` in `mission.js`): `weightsGB cells loadS usableGB bw totalB activeB promptTokens
answerTokens readTps readS ttftS gpuRead powerReadW powerWriteW gpuClock writeTps totalTps msPerToken perTokenGB
busMs busWrite busyWrite idleWrite kvKB kvGB writeS doneS moeX`. Need another? Add a case to `metric()` with its tag.
Never type a number or a ratio into the words.

**Register** with one tag in `labs/missions/01-liftoff/index.html`:
`<script type="application/json" id="tour-<id>" src="../../tours/<id>.json"></script>` (the mission finds every
`tour-*` script). Open it with `?tour=<id>`; `&autoplay=1` plays it through.

**Proofread**: `node labs/tools/tour-text.mjs <id>` prints every step with its numbers filled in and tagged, and
each step's place in the autoplay. Look for "(not measured)" or "—" (no number for that setup), captions over 12
words, and words that stop being true when a number changes. Then picture it: `node scripts/check.mjs` covers the
main tour; for a new one, `SHOOT_UI=1 SHOOT_GPU=1` shots or `__lab.tour.go(i)` in a headless page.

## An episode (`EPISODES.md`)

One row per Short: `| # | Mission | Hook (0-1 s) | Setup | Close-up | Status |`, status idea -> ready -> filmed -> posted.
For a ready episode, a block underneath:

```
### Episode N
Tour (record it as it plays, about N s): <live link>?tour=epN&autoplay=1
Preset link: <live link>?machine=..&model=..&bits=..&prompt=..&crew=..&shot=..&record=1
Guess card options: A / B / C
Mission Report: M01 LIFTOFF   MODEL, BITS | FITS? .. | TOKENS/S .. | DONE IN .. | the lesson | NEXT: ..
Source of each number: file + field, measured / reported / estimated
Shot list: 1) ... 2) ... 3) ...
```

1. Find the surprise with `node labs/tools/report.mjs "model=..&bits=..&prompt=..&crew=.."` (every number tagged
   meas., rep., est. from meas., est. from rep. or est.). The hook must stay true against all five machines, or name
   the two it compares.
2. Report columns: DGX Spark, RTX 5090, Mac Studio; a fourth (Strix Halo) from episode 9, a fifth (RTX Pro 6000)
   from 11. Copy the numbers and tags exactly as report.mjs prints them.
3. Write its tour `labs/tours/ep<N>.json` (4-5 steps, `autoplayS` 16-20, a report step last, a `short` block) and
   proofread it with `tour-text.mjs`.
4. Preset links for each shot, a guess card with three options (one right), a shot list of 3-5 shots with the
   camera key for each.
