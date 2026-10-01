---
description: Plan a new episode (YouTube Short) end to end - numbers from the data, EPISODES.md entry, preset links, its own tour, checks, commit
argument-hint: <the idea, e.g. "the 5090 loses to a mini PC on a long document">
---

Turn this idea into a ready episode: **$ARGUMENTS**

Use the `desk-lab` skill; the format is in `.claude/skills/desk-lab/references/tours-and-episodes.md`. CLAUDE.md's
rules apply: every number from `labs/data/`, tagged, never typed by hand.

1. **Find the surprise.** Run `node labs/tools/report.mjs "<preset>"` for the setups the idea needs (machine, model,
   bits, prompt, crew). Check the claim against all five machines. If it only holds between two, name those two in
   the hook. If the data doesn't support the idea, stop and say what it shows instead.
2. **EPISODES.md.** Next free number. Add the row (status `ready`) and the block: tour link, preset links that open
   each shot (`record=1`, the right `shot`), three guess-card options (one right), the Mission Report with the
   columns for that episode number and the tags exactly as report.mjs prints them, the source of each number
   (file and field), and a shot list of 3-5 shots with the camera key for each.
3. **Its tour.** `labs/tours/ep<N>.json`: 4-5 steps, `autoplayS` 16-20, the Mission Report step last, a `short`
   block (`hook`, `key`: the step to punch in on, `lesson`, `next`). Register it with one `<script id="tour-ep<N>">`
   tag in `labs/missions/01-liftoff/index.html`.
4. **Proofread.** `node labs/tools/tour-text.mjs ep<N>`: no "(not measured)", captions of 12 words at most, words
   that stay true if a number changes. Picture two of its steps (16:9 and 9:16) and read them.
5. `node scripts/check.mjs`, look at the contact sheet, commit, push, confirm the Pages deploy.

Report in under 200 words: the hook, the Mission Report line, which numbers are measured, reported or estimated,
and the tour link.
