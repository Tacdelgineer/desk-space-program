# Test and publish

## Once per clone

```
npm i --no-save playwright           # the browser for screenshots (node_modules is gitignored)
git config core.hooksPath .githooks  # /check runs before every push
```

## /check (`node scripts/check.mjs`)

1. Builds `dist/`.
2. Scans every text file in `dist/` for IP addresses, loopback hosts, host:port pairs and URLs with ports, "port
   NNNN", local paths (`/home/`, `~/`, `file://`, drive letters), private network names (`.local`, `.lan`,
   `.ts.net`, tailnet), tokens, and this machine's hostname and user name. Any hit fails the check with the file,
   line and context. Fix the source, never the scanner (unless it is a real false positive: then narrow the rule).
3. Checks that every page has the link-preview tags (`og:image`; the build adds them, `scripts/preview.mjs` makes
   the image).
4. Pictures the key states (hub; closed; open and writing; record mode close-up; tour autoplay; the tour's Mission
   Report) at 1920x1080 and 1080x1920 into `out/check/`, and puts them on `out/check/contact-sheet.png`. Page errors
   and blank pictures fail the check. **Look at the sheet** (Read the PNG): framing, labels, cut-off text.

`--no-shots` (or `CHECK_ARGS=--no-shots git push`) skips the pictures on a machine without a browser; the scan
still runs. Adding a new key state: one line in `STATES` in `scripts/check.mjs`.

## Pixel compare (after engine, parts or machine changes)

```
node labs/build.mjs
node labs/tools/shoot.mjs dist/01-liftoff/index.html out/shots          # software render, ~20 s a shot
node labs/tools/shoot.mjs --compare labs/_baseline out/shots out/diff
```

Math.random is seeded and time is stepped by hand, so the same page gives the same pixels. Compare software
against software (`SHOOT_GPU=1` is about 10x faster but its pixels differ a little). Regenerate the baseline only on
purpose (a new benchmark, a deliberate look change) and say so in the commit.

## Publish

1. `git status`: nothing from `live/`, `out/`, `shorts/` or `assets/music/` is staged.
2. Commit with a message that says what changed and why; one commit per part of a session prompt.
3. `git push` (origin is the SSH alias for the Tacdelgineer account; the hook runs /check).
4. Confirm the deploy: `curl -s "https://api.github.com/repos/Tacdelgineer/desk-space-program/actions/runs?head_sha=$(git rev-parse HEAD)"`
   until `status` is `completed` and `conclusion` is `success`, then open the live page.
