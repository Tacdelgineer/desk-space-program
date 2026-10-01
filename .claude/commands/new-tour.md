---
description: Write a new guided tour for the lab end to end - story in acts, numbers as data placeholders, registration, proofreading, pictures, commit
argument-hint: <the story, e.g. "why the MoE model is fast on the Spark">
---

Write a guided tour that tells this story: **$ARGUMENTS**

Use the `desk-lab` skill; the tour format, every metric and the placeholder rules are in
`.claude/skills/desk-lab/references/tours-and-episodes.md`. Read `labs/tours/life.json` (the main tour) as the model.

1. **Plan it** in acts (2-4) and steps (4-12). Pick the setup per step (machine, model, bits, prompt, crew) and a
   time `t` in the right phase: `node labs/tools/report.mjs` gives each setup's reading and writing times.
2. **Write `labs/tours/<id>.json`.** Plain sentences, 3-4 per step, one "Think of it as..." line, three chips, one
   break-it button, a caption of 12 words at most, a camera shot and the trip stops. Every number is a `{metric}`
   placeholder or a chip; never a typed number or ratio. Need a metric that doesn't exist? Add it to `metric()` in
   `labs/missions/01-liftoff/mission.js` with the right tag. Add a `short` block if it may become a Short.
3. **Register** it with one `<script type="application/json" id="tour-<id>" src="../../tours/<id>.json">` tag in
   `labs/missions/01-liftoff/index.html`.
4. **Proofread** with `node labs/tools/tour-text.mjs <id>`; fix any "(not measured)", "—", long captions or claims
   the numbers don't back.
5. **Look at it**: autoplay at 1920x1080 and 1080x1920 (the card shows the title and one big number), and the
   interactive card with its paragraphs. Read the pictures; fix overflow or a machine hidden behind the card.
6. `node scripts/check.mjs`, commit, push, confirm the Pages deploy.

Report in under 200 words: the steps in one line each, the link (`?tour=<id>&autoplay=1`), anything you added to
the metrics.
