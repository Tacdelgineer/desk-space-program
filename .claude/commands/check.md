---
description: Build the lab, picture its key states on one contact sheet and scan dist/ for anything private
---

Run `/check` for the Desk Space Program:

1. `node scripts/check.mjs` (first time on this clone: `npm i --no-save playwright`). It builds `dist/`, fails on any
   hostname, IP address, port, local path, user name or token in `dist/`, checks every page has its link preview,
   and pictures the key states at 1920x1080 and 1080x1920 on `out/check/contact-sheet.png`.
2. **Read the contact sheet** (and any single picture in `out/check/` that looks wrong at full size). Look for
   machines cut off by the frame, labels or cards overlapping the machine, text that overflows, a blank or black
   picture, the wrong machine or state.
3. If the check failed: show the exact lines it printed, find the cause in the source (not in `dist/`), fix it and
   run it again. Never loosen a privacy rule to get a pass unless the hit is a real false positive; then narrow the
   rule and say so.

Report in under 200 words: pass or fail, what the pictures show, and anything you fixed.
