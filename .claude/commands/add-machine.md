---
description: Add a machine to the Desk Space Program lab, end to end (specs with sources, published runs, the 3D machine, checks, docs, commit)
argument-hint: <machine name, e.g. "RTX 4090">
---

Add **$ARGUMENTS** to the lab as the next machine. Use the `desk-lab` skill and follow
`.claude/skills/desk-lab/references/add-machine.md` step by step. CLAUDE.md's rules apply throughout.

1. **Specs.** Find the maker's spec sheet. Fill `labs/data/machines.json`: memory, bandwidth, reserve, math, plus
   what the drawing needs (bus width, memory chip count and size, GPU units, ports, power, size in mm). Every number
   gets `source` and a `link`; anything you work out yourself is `"estimated"` with a `note` saying how.
2. **Published runs.** Search for llama.cpp (or MLX) runs of the lab's models on this machine (`labs/data/models.json`:
   Qwen3.8 27B, Qwen3.6 35B-A3B, Qwen3.8-Flash-Next, Gemma 4 E4B) at 4-bit. Only runs with a link, no speculative
   decoding. Put them in `labs/data/reported/<id>.json` and on the page. None found: say so; the lab estimates.
3. **The machine.** Build it the way the reference describes, with its real bus width (one lane per 32 bits), its
   real memory chip count (one cell per GB), GPU blocks in proportion to its math, a stylized shell with no logos, the
   spec plate and the mug at its real scale. New parts in `kit/parts.js` only if nothing fits.
4. **Register** it (script tag, `WORDS`, URL aliases, What if name, `report.mjs` order, What's real sentence).
5. **Look at it.** Shots 1-4 open, plus closed and opening, at 1920x1080 and 1080x1920 (`SHOOT_GPU=1`,
   `SHOOT_SIZE`, `SHOOT_CASE`). Read every picture. Fix anything cramped, cut off or unreadable (three rounds at
   most). Then `node scripts/check.mjs` and look at the contact sheet.
6. **Docs.** `labs/kit/README.md`, `labs/HANDOFF.md`, `EPISODES.md` (add an episode idea where this machine wins or
   loses in a surprising way, with numbers from `node labs/tools/report.mjs`).
7. **Commit and push**, confirm the Pages deploy.

Report in under 200 words: the specs with their sources, which numbers are reported and which estimated, one
sentence on what looks different inside, and the episode idea.
