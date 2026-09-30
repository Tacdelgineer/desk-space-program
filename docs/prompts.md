# Claude Code prompts

Each block is one fresh session. Paste it as-is.
Cloud (Claude Code on the web) is fine for A, B, D and E. C must run on the DGX Spark.

---

## A. Kit split, hub page, GitHub Pages (Sonnet)

```
Fresh session. Scope: this repo only. Don't change how the lab looks or behaves.

1. Read labs/HANDOFF.md fully and docs/shorts-template.md. Skim labs/desk-space-program.html;
   later, open only the section you're editing.
2. Baseline: screenshot the current page at 1920x1080 for camera shots 1, 2 and 3 with the UI
   hidden, during the writing phase (HANDOFF gotcha 10 and "Headless browser in the cloud").
   Save to labs/_baseline/. If no browser can run here, say so and skip steps 2 and 6.
3. Simplification pass: list every part of the page. Mark anything that looks unnecessary and
   say why, but remove nothing. Put the list at the top of your report.
4. Split into the kit layout in HANDOFF ("The kit"). Move code, don't rewrite it. Specs and
   models go into labs/data/machines.json and labs/data/models.json with "source": "estimated"
   on every number. Mac Studio becomes the 256 GB config.
5. Build script (node, no packages): inline the local scripts and data into one file per
   mission at dist/01-liftoff/index.html, plus dist/index.html, a plain hub page in the
   screenprint theme listing the missions (only 01 is live; the rest say "coming").
6. Test: screenshot the built page as in step 2. It must match the baseline apart from grain.
   If not, fix the split, not the baseline.
7. Small fixes: rename "GPU busy" to "GPU math used" with one line in What's real explaining why
   nvidia-smi shows more; make the pills re-sync when the selection changes from code.
8. Add .github/workflows/pages.yml: on push to main, run the build and deploy dist/ to GitHub
   Pages with actions/upload-pages-artifact and actions/deploy-pages.
9. Write labs/kit/README.md: one line per file, what it does and when to edit it. Under 60 lines.
10. REPORT (under 300 words, plain English): the simplification list, file sizes, whether the
    screenshots matched, and anything I must click on GitHub.
```

---

## B. Three machines, two dials, episode presets (Opus)

```
Fresh session. Scope: this repo only.

1. Read labs/HANDOFF.md ("Next features" and "Home, cloud sessions and the Shorts"),
   labs/kit/README.md and EPISODES.md. Open only the files you need.
2. Build the RTX 5090 and Mac Studio M3 Ultra interiors in labs/machines/ from kit/parts.js.
   Same size on screen as the Spark. The bus must be countable: Spark 256-bit, 5090 512-bit,
   M3 Ultra 1,024-bit.
3. Machine switcher: three notches in the controls bar; the old board lowers, the new one
   rises, specs snap. The side race stays.
4. Model-size handle (1B–200B, live, presets as notches). Keep the Launch button.
5. Crew dial (1–64) with the crew model in HANDOFF, shown on the board: GPU blocks light in
   proportion, one prompt-memory group per request, and a marker when the GPU maxes out or
   memory overflows.
6. Labels on side rails, sorted by height, leader lines never crossing.
7. Episode presets: URL parameters for machine, model, bits, prompt, crew, camera shot and
   record=1 (UI hidden, launches automatically). A tall 9:16 window must frame the machine
   well. Fill the "Preset link" for every episode in EPISODES.md that is now possible.
8. Self-check: screenshot each machine at shots 1–3 and crew 1, 16 and 64 (skip if no browser
   runs here). Fix anything cramped or unreadable. At most three rounds.
9. REPORT (under 300 words): what each machine looks like, where the crew dial's limit lands
   for Llama 70B on each machine (estimated), which episodes are now "ready", what you'd cut.
```

---

## C. Measure the Spark (local session on the DGX Spark)

```
Fresh session. Run llama-bench (llama.cpp) for each model in labs/data/models.json at 4-bit,
prompt sizes 300, 8000 and 32000, 128 generated tokens. Write pp and tg to
labs/data/measured/spark.json with the llama.cpp version, model file names and date. Make the
lab prefer measured numbers and tag them "measured". REPORT: a table of the numbers, what
failed, and how far each one is from the old estimate.
```

---

## D. Add a machine (repeat per GPU)

```
Fresh session. Add [MACHINE, e.g. RTX 4090] to the lab.

1. Read labs/kit/README.md. Specs go in labs/data/machines.json with a source link for each
   number and "source": "estimated".
2. Build its interior in labs/machines/ from kit/parts.js, same size on screen as the others,
   with its real bus width and memory chip count. New parts only if nothing fits.
3. Add it to the switcher and the side race. Screenshot shots 1–3 and fix issues.
4. REPORT (under 200 words): specs with sources, one sentence on what's visually different,
   and one episode idea where this machine wins or loses in a surprising way.
```

---

## E. Prep an episode (repeat per Short)

```
Fresh session. Prep episode [N] from EPISODES.md.

1. Make its preset link work and add it to EPISODES.md.
2. Fill its Mission Report numbers from labs/data/ only, with the file and field for each,
   and say which are measured and which are estimated.
3. Write a shot list of 3–5 shots with the camera key for each, and the three guess-card options.
4. Set the status to "ready". REPORT: paste the filled episode block.
```
