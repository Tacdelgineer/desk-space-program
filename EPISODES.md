# Episodes

One row per Short. The preset link opens the lab in the exact state to film
(record mode hides the interface). Report numbers come from `labs/data/`, never by hand:
`node labs/tools/report.mjs "model=q27&prompt=q&crew=1"` prints them with the source of every input,
marked (meas.), (est. from meas.) or (est.).
Status: idea → ready (preset works, numbers filled) → filmed → posted.

| # | Mission | Hook (0–1 s) | Setup | Close-up | Status |
|---|---|---|---|---|---|
| 1 | 01 Liftoff | My AI box waits 99% of the time | Spark, Qwen3.8 27B, 4-bit, question | GPU (3) while writing | ready |
| 2 | 01 Liftoff | The fastest gaming GPU can't run this | 5090, Qwen3.8-Flash-Next, 4-bit | memory (2), overflow | ready |
| 3 | 01 Liftoff | The bigger model writes 5x faster | Spark, Qwen3.8 27B vs Qwen3.6 35B MoE, 4-bit | memory (2), cells flashing | ready |
| 4 | 01 Liftoff | A long document flips the winner | Spark vs Mac, Qwen3.8 27B, document | overview (1) + race | idea (rework: the 5090 now wins both rounds) |
| 5 | 03 Skylab | I gave my idle GPU 32 jobs | Spark, Qwen3.8 27B, crew 1 → 32 | GPU (3) lighting up | ready (filmed in the 01 lab, which has the crew dial) |
| 6 | 01 Liftoff | Inside a 5090 vs inside a Spark | switch machines, Qwen3.6 35B MoE | overview (1) | ready |
| 7 | 01 Liftoff | No desk can hold this model | Mac, Qwen3.8-Max, 4-bit | memory (2), overflow | ready |
| 8 | 01 Liftoff | 51 billion parameters it barely touches | Spark, Qwen3.8-Flash-Next, 4-bit | memory (2), amber table cells | ready |

For each episode that turns "ready", fill in underneath:

```
### Episode N
Preset link:
Guess card options: A / B / C
Mission Report:  subtitle | FITS? | TOKENS/S | DONE IN (Spark, 5090, Mac) | the lesson | next mission
Source of each number: file + field, measured or estimated
Shot list: 1) ... 2) ... 3) ...
```

Live lab: https://tacdelgineer.github.io/desk-space-program/01-liftoff/ . Preset parameters: `machine` (spark, rtx5090,
mac), `model` (g4, q36, q27, flash, max, or a size in billions for a dense model), `bits` (4, 8, 16), `prompt` (q, doc, code),
`crew` (1–64), `shot` (1–4), `speed` (1, 5), `record=1` (interface hidden, launches once the model has loaded).
In record mode: keys 1–4 move the camera, Space launches again, M switches to the next machine, H brings the interface back.
The public page shows the measured numbers once `labs/data/measured/spark.json` is pushed.

**Measured and estimated.** The DGX Spark column is **measured** for the four downloaded models at 4-bit with the
question (300 tokens) and document (8,000 tokens) prompts, one request: `labs/data/measured/spark.json` (the live
benchmark, llama.cpp llama-server 2a53ace, 4-bit GGUFs from Unsloth, middle of three runs, 2026-09-30, GPU clock
capped at about 1,990 MHz). Print "meas." for those. Crews of 2 or more on the Spark are estimated from the measured
single request ("est."). The RTX 5090 and Mac Studio columns, 8- and 16-bit, the codebase prompt, Qwen3.8-Max and
"GPU math used" are **estimated**: print "est.".

**Sources, the same for every episode.** Machines: `labs/data/machines.json`, fields `memGB`, `reserveGB`, `bw`,
`tflops` of `spark`, `rtx5090`, `mac`, all `"estimated"`. Models: `labs/data/models.json`, fields `total`, `active`,
`table` and `arch` (from each model's config and checkpoint, `"config"`), and `bpp` of the precision (`"estimated"`).
Spark measurements: `labs/data/measured/spark.json`, fields `tgTps` (writing), `ppTps` (reading), `weightsGB` (the real
file). Prompt length: `labs/data/models.json` `prompts[].tokens` (`"chosen"`). Answer length 150 tokens:
`labs/kit/model.js` `ANSWER`. Speed rules: `labs/kit/model.js` `calc()`. TOKENS/S is the writing speed; DONE IN is
reading the prompt plus writing the answer.

### Episode 1
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=3&record=1
Guess card options: While it writes, the GPU's math is busy... A) 99% of the time / B) half the time / C) 1% of the time
Mission Report: M01 LIFTOFF   QWEN3.8 27B, 4-BIT | FITS? YES / YES / YES | TOKENS/S 12.8 (meas.) / 85 / 39 (est.) | DONE IN 12 s (meas.) / 1.9 s / 5.0 s (est.) | The GPU does 1% math, then waits for memory | NEXT: the fastest gaming GPU tries a bigger one
Source of each number: the lists above. "1%" is the lab's GPU math used for the Spark (`calc().busyWrite` = 1.05%, estimated from the measured 12.8 tokens/s and the `tflops` placeholder). Supporting measurement for the voiceover: the GPU draws 44 W while it reads the document and 28 W while it writes (`powerReadW`, `powerWriteW` of q27, 8,000 tokens).
Shot list: 1) key 1, the Spark loading (arcs from the SSD into the memory cells). 2) Space, key 3: every GPU block blazes while it reads the prompt (half a second). 3) key 3, hold 6 s while writing: one block of 48 flickers, the rest wait. 4) key 2: the bus lanes run at 100%, a sweep crosses the memory for every token. 5) key 3 again to loop back to the hook.

### Episode 2
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=flash&bits=4&prompt=q&crew=1&shot=2&record=1
  (the fix, for the end: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q36&bits=4&prompt=q&crew=1&shot=2&record=1 )
Guess card options: Qwen3.8-Flash-Next on an RTX 5090 writes at... A) 200 tokens/s / B) 50 tokens/s / C) it can't run it
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT | FITS? YES / NO / YES | TOKENS/S 24 (meas.) / NO / 104 (est.) | DONE IN 6.8 s (meas.) / NO / 1.7 s (est.) | 101 GB of model, 30.5 GB of room: speed means nothing if it doesn't fit | NEXT: the bigger model that writes 5x faster
Source of each number: the lists above. 101 GB = weights and table plus prompt memory at 4-bit (estimated for the 5090); the real file the Spark runs is 111 GB (`weightsGB`). 30.5 GB = `memGB` 32 minus `reserveGB` 1.5 of `rtx5090`.
Shot list: 1) key 1, the 5090 loading over the PCIe slot. 2) key 2: the 16 chips fill up, the last ones turn magenta and spill. 3) key 4: the PCIe slot, where there's no more room to send. 4) M twice (to the Spark): the same model fits, with 9 GB to spare. 5) the fix link: Qwen3.6 35B MoE fits the 5090 (est. 513 tokens/s).

### Episode 3
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=2&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q36&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: A 27B model and a 35B model. Which writes faster? A) the 27B / B) the 35B / C) the same
Mission Report: M01 LIFTOFF   QWEN3.6 35B MOE, 4-BIT | FITS? YES / YES / YES | TOKENS/S 67 (meas.) / 513 / 234 (est.) | DONE IN 2.4 s (meas.) / 0.3 s / 0.8 s (est.) | Each token reads 2.9B of its 34.7B parameters: 5.2x faster than the dense 27B | NEXT: a long document flips the winner
Source of each number: the lists above. The dense Qwen3.8 27B on the Spark: 12.8 tokens/s, done in 12 s (measured). 5.2x = 66.9 / 12.8 (`tgTps` of q36 and q27, 300 tokens, both measured). 2.9B and 34.7B: `active` and `total` of q36.
Shot list: 1) first link, key 2: the Qwen3.8 27B cells, a sweep through all of them for every token. 2) key 3: 12.8 tokens/s, the GPU mostly dark. 3) second link, key 2: only a few cells flash per token. 4) key 1 overview while the answer races out of the ports.

### Episode 4
Status: needs a rework. With the new lineup the flip still happens between the Spark and the Mac (Qwen3.8 27B, question: Spark 12 s measured, Mac 5.0 s est.; document: Spark 23 s measured, Mac 33 s est.), but the 5090 fits this model and wins both rounds (1.9 s, 5.7 s est.), so the race panel never says "the winner changes". Qwen3.8-Flash-Next keeps the 5090 out but doesn't flip (document: Spark 19 s measured, Mac 9.1 s est.). Options: film it as Spark vs Mac only with the race panel hidden, or wait until the Mac is measured (its reading speed is a placeholder, and the Spark read 2-20x slower than its own placeholder said).
Preset links (Spark vs Mac, for reference): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=1&speed=5 and https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=doc&crew=1&shot=1&speed=5

### Episode 5
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=3&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=32&shot=3&record=1
Guess card options: 32 jobs at once. Each job gets... A) 32x slower / B) about as fast / C) the box crashes
Mission Report: M03 SKYLAB   QWEN3.8 27B, 4-BIT, CREW 32 | FITS? YES / YES / YES | TOKENS/S 307 / 2,006 / 273 total (est.) | DONE IN 32 s / 7.1 s / 53 s (est.) | 24x the output, and each job still gets 9.6 tokens/s (12.8 alone, measured) | NEXT: when does the GPU finally max out?
Source of each number: the lists above, with `crew` 32 in `calc()`. The Spark's crew numbers are estimated from its measured single request (memory time per step scaled so crew 1 matches 12.8 tokens/s, reading at the measured 571 tokens/s). 24x = 307 / 12.8. Per job: Spark 9.6, 5090 63, Mac 8.5 tokens/s.
Shot list: 1) crew 1 link, key 3: one block flickers. 2) crew 32 link, key 3: 32 prompts read (all blocks blaze for 17 s, trim it), then more blocks light per token. 3) key 2: 32 small prompt-memory groups after the weights. 4) the big number, with the interface on (H): 307 tokens per second, 32 answers at once.

### Episode 6
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q36&bits=4&prompt=q&crew=1&shot=1&record=1
  (press M to switch to the 5090; or open it directly: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q36&bits=4&prompt=q&crew=1&shot=1&record=1 )
Guess card options: How much faster does the 5090 move memory? A) 2x / B) 6.6x / C) the same
Mission Report: M01 LIFTOFF   QWEN3.6 35B MOE, 4-BIT | FITS? YES / YES / YES | TOKENS/S 67 (meas.) / 513 / 234 (est.) | DONE IN 2.4 s (meas.) / 0.3 s / 0.8 s (est.) | Twice the lanes, each 3.3x faster: 6.6x the bandwidth, but only 32 GB | NEXT: no desk can hold this model
Source of each number: the lists above. 6.6x = `bw` 1,792 / 273. Lane counts (8 and 16, 32 bits each) are drawn in `labs/machines/spark.js` and `rtx5090.js`. The 5090's 513 is an estimate against the Spark's measured 67.
Shot list: 1) key 1, the Spark: count the 8 bus lanes. 2) M: the Spark sinks into the stand and the 5090 rises. 3) key 2 on the 5090: 16 short, fat lanes, 2 cells per chip. 4) Space: 513 tokens/s against 67. 5) M twice (past the Mac) back to the Spark for the loop.

### Episode 7
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=mac&model=max&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: Qwen3.8-Max at 4-bit needs... A) 128 GB / B) 256 GB / C) 1,380 GB
Mission Report: M01 LIFTOFF   QWEN3.8-MAX, 4-BIT | FITS? NO / NO / NO | TOKENS/S NO / NO / NO | DONE IN NO / NO / NO | 2.4 trillion parameters: 1,380 GB at 4-bit, five times the biggest Mac | NEXT: 51 billion parameters it barely touches
Source of each number: the lists above. 1,380 GB = (`total` 2,419.8B) x `bpp` 0.57 plus prompt memory (estimated; no file, nothing here can load it). 248 GB = `memGB` 256 minus `reserveGB` 8 of `mac`.
Shot list: 1) key 2 on the Mac: all 256 cells fill and turn magenta. 2) M: the Spark, overflowing even faster. 3) M: the 5090, one chip's worth. 4) the size handle dragged down from 2.4T until the first machine fits.

### Episode 8
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=flash&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: 51 billion of its parameters are read for each word... A) all of them / B) half / C) almost none
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT | FITS? YES / NO / YES | TOKENS/S 24 (meas.) / NO / 104 (est.) | DONE IN 6.8 s (meas.) / NO / 1.7 s (est.) | A 51B n-gram table sits in memory: each token reads a few rows of it | NEXT: I gave my idle GPU 32 jobs
Source of each number: the lists above. 51B = `table` of flash (51.2B, from the checkpoint). On the Spark the table is 28.8 GB of the 111 GB file (`tableGB`, `weightsGB`, measured) and stays in the file: llama.cpp reads its rows on demand (`lazyTable` in `models.json`), which is how the full model fits in 121 GiB.
Shot list: 1) key 2: the amber cells of the table next to the teal weights. 2) Space: the teal cells light by the handful every token, the amber ones only blink now and then. 3) key 1: 24 tokens/s from a 176B-parameter file.
