# Desk Space Program

Interactive three.js missions about running AI on a machine. Mission 01 (Liftoff) opens up five machines on a
display stand. Plain browser scripts, no framework, no packages; `node labs/build.mjs` writes `dist/`, GitHub Pages
publishes it on every push to `main`. The project skill `desk-lab` (`.claude/skills/desk-lab/`) has the file map and
the workflows; the slash commands in `.claude/commands/` run them.

## Standing rules

1. **Scope: this repo only.** Don't touch other projects on this machine.
2. **Don't stop or restart any service you didn't start.** This machine runs other people's long-lived services.
   A busy port belongs to somebody: never kill a process found by port number. Throwaway servers bind 127.0.0.1 on
   port 0 and are stopped by the PID you started. No `pkill -f`.
3. **Nothing private in the public build.** No hostnames, IP addresses, ports, local paths, user names or tokens in
   anything committed or in `dist/`. `live/` stays untracked: it names this machine's ports and firewall rule
   (this clone excludes it in `.git/info/exclude`; never `git add -f` it).
   `node scripts/check.mjs` scans `dist/` and is the pre-push hook (`git config core.hooksPath .githooks`).
4. **Numbers only from `labs/data/`, always tagged** *measured* (our Spark, `data/measured/`), *reported* (someone
   else's published run or spec sheet, with a link, `data/reported/`, `data/machines.json`) or *estimated* (the
   formula in `kit/model.js`; *est. from meas.* / *est. from rep.* when scaled from a run). Never type a number into
   words: tours use `{metric}` placeholders, Mission Reports come from `node labs/tools/report.mjs` or the lab's
   metrics. No hand-typed ratios either ("twice", "a third"): put both numbers in as placeholders.
5. **The screenprint theme** (`labs/kit/themes/screenprint.css`): four inks on cream stock. Cream `#EFE5CF`, ink
   `#1B1712`, red `#DF3A2C`, yellow `#F2C230`, teal `#1F8783`; Anton for display, Archivo Narrow for text, IBM Plex
   Mono for labels; thick ink borders and hard offset shadows, no soft blur. Use the theme's tokens. Machine shells
   are stylized: no real logos, brand marks or exact product shapes. Original art only.
6. **Commit per part.** When a session prompt has parts, commit and push after each one, then confirm the Pages
   deploy (`curl -s "https://api.github.com/repos/Tacdelgineer/desk-space-program/actions/runs?head_sha=<sha>"`).
   Push over the existing `origin` (SSH alias for the Tacdelgineer account); `gh` here is a different account.
7. **Reports under 200 words, in plain English** (unless the prompt sets another limit): what changed, what was
   checked and how, what is left. Say plainly when something failed or was skipped.

## Before you commit

- `node scripts/check.mjs`: build, contact sheet of the key states (`out/check/contact-sheet.png`, look at it),
  privacy scan. Needs `npm i --no-save playwright` once.
- After a change to the engine, parts or a machine: `node labs/tools/shoot.mjs dist/01-liftoff/index.html <dir>`
  and `--compare labs/_baseline <dir>` (software render against the software baseline; `SHOOT_GPU=1` is faster but
  compare GPU only against GPU).
- Keep `labs/kit/README.md` (file map), `EPISODES.md` and `labs/HANDOFF.md` in step with the code.
