---
description: Film a tour or episode and cut it into a 9:16 YouTube Short (hook card, footage with punch-ins, captions, Mission Report end card, music if present)
argument-hint: <episode number or tour id, e.g. "1" or "life">
---

Make a Short from **$ARGUMENTS** (an episode number means the tour `ep<N>`; otherwise a tour id from `labs/tours/`).

Use the `desk-lab` skill (`references/shorts.md`). CLAUDE.md's rules apply: the numbers on screen come from the
tour and the data, tagged.

1. **Check the tour first**: `node labs/tools/tour-text.mjs <id>` must have a `short` block (hook, key, lesson,
   next) and no "(not measured)". Missing: write the block in the tour file (numbers as placeholders), proofread again.
2. **Film and cut**: `node scripts/make-short.mjs <id>`. It renders the tour at 1080x1920 30 fps on the GPU
   (`scripts/film.mjs`, render mode with a fixed-step clock), then builds the Short: the 1-second hook card, the
   footage with punch-in zooms on the key step, big captions from the tour, the Mission Report end card, and the
   music in `assets/music/` at about -18 dB if there is a file (silent otherwise). Output: `shorts/<id>.mp4`.
3. **Watch it** without trusting the script: pull frames at the hook, at each caption change, at the punch-in and
   on the end card (`ffmpeg -ss <t> -i shorts/<id>.mp4 -frames:v 1 out/short-<t>.png`) and read them. Check the
   captions sit clear of the Shorts buttons (right edge and bottom 20%), every number has its tag on the end card,
   and the length (`ffprobe`). Fix and re-run if anything is off.
4. Don't upload anything and don't commit the video: `shorts/` is gitignored. Mark the episode `filmed` in
   `EPISODES.md` only when the user says the cut is approved.

Report in under 200 words: the path, its length, the hook, and anything you'd change before posting.
