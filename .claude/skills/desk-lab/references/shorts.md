# Filming and Shorts

## Render mode and film.mjs

`?render=30` puts the page on a fixed-step clock (`kit/engine.js`): nothing runs by itself, `DSP.engine.renderFrames(n)`
draws n frames of exactly 1/30 s, Math.random is seeded and CSS transitions are off. So a film is the same every time
and takes as long as the GPU needs, not as long as the tour.

```
node scripts/film.mjs life                     # both sizes: out/film/life-1080x1920.mp4, life-1920x1080.mp4
node scripts/film.mjs 4 --size 1920x1080       # episode 4's tour (ep4), 16:9 only
node scripts/film.mjs 1 --short                # the clean 9:16 layout make-short cuts (no caption, no controls)
```

Headless full Chromium with ANGLE on OpenGL ES (the GPU path on the DGX Spark), one JPEG screenshot per frame into
ffmpeg (H.264, crf 17). About 45 ms a frame at 1080x1920: a 30 s tour in 40 s. Beside each video, a .json with the
tour's outline (every step's words and numbers, filled in and tagged, its start and end) and where the machine, the
card and the trip map sit in each step. On a machine without full Chromium it falls back to the software renderer
(slow) and says so.

## make-short.mjs

```
node scripts/make-short.mjs 1          # shorts/ep1.mp4 + shorts/ep1.json
node scripts/make-short.mjs life       # the main tour
node scripts/make-short.mjs 1 --no-film            # reuse out/film/ep1-short-1080x1920.mp4
node scripts/make-short.mjs 1 --music path/to.mp3  # this track instead of assets/music/
```

The cut, all 1080x1920 at 30 fps:
1. **Hook card**, 1 s: the tour's `short.hook` on ink, the red and yellow plates sliding into register, the
   mission stamp. `*word*` marks the yellow word; without a mark, the first word with a digit is yellow.
2. **The footage** (film.mjs `--short`) with **punch-ins** on the key step (`short.key`): a cut in to 1.15x, then
   to 1.3x, centred on the machine; the trip map and the step card stay put on top. **Captions**: each step's own
   caption, Anton in cream with a black stroke, the number in yellow, in the lower middle, clear of the Shorts buttons
   (right edge, bottom 20%).
3. **End card**, 3.5 s: the Mission Report from the tour's report step (FITS?, TOKENS/S, DONE IN for all five, each
   number tagged meas. / rep. / est.), `short.lesson`, and `short.next` on an ink strip.
4. **Music**: the first audio file in `assets/music/` (not committed), turned down 18 dB, faded in and out. None:
   a silent track.

`shorts/<id>.json` lists what went in: the hook, the captions with their times, the punch-in times, every Mission
Report number with its tag, the music. Use it for the description.

## The tour's short block

```json
"short": { "hook": "My AI box waits *{idleWrite}* of the time", "key": 1,
           "lesson": "The GPU does {busyWrite} math, then waits for memory", "next": "Next: the fastest gaming GPU tries a bigger model" }
```

Numbers only as placeholders, as everywhere. `key` is a step index (0-based): pick the step with the moment the hook
promises. The hook must stay true against all five machines in the report, or name the two it compares.

## Review before it becomes routine

Never trust the cut without looking: pull frames at the hook, each caption change, both punch-ins and the end card
(`ffmpeg -ss <t> -i shorts/<id>.mp4 -frames:v 1 out/x.png`, times from `shorts/<id>.json`) and read them. Check the
length with `ffprobe`. Nothing in `shorts/` is committed or uploaded; the user approves each Short first.
