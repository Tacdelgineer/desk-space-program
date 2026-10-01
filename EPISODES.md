# Episodes

One row per Short. The preset link opens the lab in the exact state to film
(record mode hides the interface). Report numbers come from `labs/data/`, never by hand:
`node labs/tools/report.mjs "model=q27&prompt=q&crew=1"` prints them with the source of every input,
marked (meas.), (rep.), (est. from meas.), (est. from rep.) or (est.).
Status: idea → ready (preset works, numbers filled) → filmed → posted.

| # | Mission | Hook (0–1 s) | Setup | Close-up | Status |
|---|---|---|---|---|---|
| 1 | 01 Liftoff | My AI box waits 99% of the time | Spark, Qwen3.8 27B, 4-bit, question | GPU (3) while writing | ready |
| 2 | 01 Liftoff | The fastest gaming GPU can't run this | 5090, Qwen3.8-Flash-Next, 4-bit | memory (2), overflow | ready |
| 3 | 01 Liftoff | The bigger model writes 5x faster | Spark, Qwen3.8 27B vs Qwen3.6 35B MoE, 4-bit | memory (2), cells flashing | ready |
| 4 | 01 Liftoff | The Mac beats my Spark, until I paste a document | Spark vs Mac, Qwen3.8 27B, 4-bit, question then document | memory (2), then GPU (3) while reading | ready |
| 5 | 03 Skylab | I gave my idle GPU 32 jobs | Spark, Qwen3.8 27B, crew 1 → 32 | GPU (3) lighting up | ready (filmed in the 01 lab, which has the crew dial) |
| 6 | 01 Liftoff | Inside a 5090 vs inside a Spark | switch machines, Qwen3.6 35B MoE | overview (1) | ready |
| 7 | 01 Liftoff | No desk can hold this model | Mac, Qwen3.8-Max, 4-bit | memory (2), overflow | ready |
| 8 | 01 Liftoff | 51 billion parameters it barely touches | Spark, Qwen3.8-Flash-Next, 4-bit | memory (2), amber table cells | ready |
| 9 | 01 Liftoff | It writes as fast as a DGX Spark, then loses by 15 seconds | Strix Halo vs Spark, Qwen3.8 27B, 4-bit, question then document | GPU (3) while reading | ready |
| 10 | 01 Liftoff | This mini PC runs a model the RTX 5090 can't load | Strix Halo, Qwen3.8-Flash-Next, 4-bit (then the 5090) | overview (1), all 8 packages fill | ready |
| 11 | 01 Liftoff | A 111 GB model on a 96 GB card | RTX Pro 6000, Qwen3.8-Flash-Next, 4-bit, codebase | overview (1), no amber cells on the card | ready |
| 12 | 01 Liftoff | Same chip as an RTX 5090, three times the room | RTX Pro 6000 vs 5090, Qwen3.8 27B, 4-bit then 16-bit | memory (2), the 5090 spills | ready |

For each episode that turns "ready", fill in underneath:

```
### Episode N
Preset link:
Guess card options: A / B / C
Mission Report:  subtitle | FITS? | TOKENS/S | DONE IN (Spark, 5090, Mac; from episode 9 on also Strix Halo, from 11 on RTX Pro 6000) | the lesson | next mission
Source of each number: file + field, measured or estimated
Shot list: 1) ... 2) ... 3) ...
```

Live lab: https://tacdelgineer.github.io/desk-space-program/01-liftoff/ . The main guided tour, "The life of one answer"
(about 30 s, interface on, a plain screen recording is the video): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?tour=life&autoplay=1
in a 16:9 window, the same link in a tall window (1080 x 1920) for the 9:16 layout. Preset parameters: `machine` (spark, rtx5090,
mac, strix, pro6000), `model` (g4, q36, q27, flash, max, or a size in billions for a dense model), `bits` (4, 8, 16), `prompt` (q, doc, code),
`crew` (1–64), `shot` (1–4), `speed` (1, 5), `record=1` (interface hidden, the console stays in the picture; the machine
starts closed, opens at 0.7 s, and launches once the model has loaded and the lid is off; in a tall 9:16 window the machine
fills the width at the top and the console fills it along the bottom), `open=1` (start open; `shot=2`–`4`
do too, since they look inside).
In record mode: keys 1–4 move the camera, Space launches again (the console's cover lifts and its switch flips), O closes or
opens the machine (so does the console's LID key, or dragging the lid that hangs above the open machine back down), M switches
to the next machine (Spark, 5090, Mac, Strix Halo, RTX Pro 6000, round again; the old one closes its lid and sinks, the new one
comes up closed, then opens), H brings the interface back.
The public page shows the measured numbers once `labs/data/measured/spark.json` is pushed.

**Measured and estimated.** The DGX Spark column is **measured** for the four downloaded models at 4-bit with the
question (300 tokens) and document (8,000 tokens) prompts, one request: `labs/data/measured/spark.json` (the live
benchmark, llama.cpp llama-server 2a53ace, 4-bit GGUFs from Unsloth, middle of three runs, 2026-09-30, GPU clock
capped at about 1,990 MHz). Print "meas." for those. Crews of 2 or more on the Spark are estimated from the measured
single request ("est. from meas."). The RTX 5090 and Mac Studio columns are **reported** where a published run exists
(Session G, 2026-09-30): the 5090's llama-bench runs of Qwen3.8 27B (Q4_K_M) and Qwen3.6 35B MoE (UD-Q4_K_M, the
Spark's own file) from witcheer's rtx-5090-benchmarks, `labs/data/reported/rtx5090.json`; the Mac's MLX runs of
Qwen3.8 27B and Flash-Next from Rapid-MLX's M3 Ultra methods page and of Qwen3.6 35B MoE (document only) from an oMLX
community benchmark, `labs/data/reported/mac.json`; none with speculative decoding, each linked. The 5090's document
numbers read at the reported speed and write at a speed scaled from its question run. Gemma 4 E4B on the 5090 and the
Mac stays estimated. The Strix Halo column (episodes 9 on) is **reported**: other people's published llama.cpp runs
on a Ryzen AI Max+ 395 with 128 GB, `labs/data/reported/strix.json`, each with its link (Qwen3.8 27B, Qwen3.6 35B MoE and
Flash-Next reading and writing, Gemma 4 E4B writing only; 4-bit, question and document, one request). Print "rep." for
those; their quants differ a little from the Spark's and their prompts were 2,048 tokens long (the file says how each
maps to the lab's prompts). The RTX Pro 6000 column (episodes 11 on) has one reported run, Flash-Next with a
22,695-token prompt, which stands for the codebase prompt (`labs/data/reported/pro6000.json`). Where a machine has a run
for the same model at another prompt length or compression, the lab scales it to the setup you picked: print "est. from
meas." or "est. from rep." for those (the report tool says which). The rest (Gemma 4 E4B off the Spark and the Strix
Halo, the Pro 6000 apart from Flash-Next, Qwen3.8-Max, sized models) and "GPU math used" are **estimated**: print "est.".
Since Session G the formula for mixture-of-experts models is fitted to the measured Spark and the reported 5090 running the
same Qwen3.6 file: 0.46 of the bandwidth plus 1.7 ms a step (it used to be 0.5 and no fixed time, which put the 5090 at
513 tokens/s against the reported 271).

**Sources, the same for every episode.** Machines: `labs/data/machines.json`, fields `memGB`, `reserveGB`, `bw`,
`tflops` of `spark`, `rtx5090`, `mac`: `memGB` and `bw` `"reported"` with links (NVIDIA's DGX Spark page, NVIDIA's RTX
Blackwell architecture paper, Apple's Mac Studio (2025) specs), `reserveGB` and `tflops` `"estimated"`; of `strix`, `"reported"` with a link (AMD's spec pages and
a Strix Halo setup guide for the 120 GB the GPU may use on Linux) except `tflops`, `"estimated"` from AMD's compute-unit
count and clock; of `pro6000`, `"reported"` from NVIDIA's datasheet and its RTX Blackwell PRO architecture paper except
`reserveGB`, `"estimated"` from the 97,887 MiB nvidia-smi shows. `tableOnHost` on the 5090 and the Pro 6000: a graphics
card leaves a model's lookup table in the PC's memory, so only the rest must fit on the card. Models: `labs/data/models.json`, fields `total`, `active`,
`table` and `arch` (from each model's config and checkpoint, `"config"`), and `bpp` of the precision (`"estimated"`).
Spark measurements: `labs/data/measured/spark.json`, fields `tgTps` (writing), `ppTps` (reading), `weightsGB` (the real
file). Prompt length: `labs/data/models.json` `prompts[].tokens` (`"chosen"`). Answer length 150 tokens:
`labs/kit/model.js` `ANSWER`. Speed rules: `labs/kit/model.js` `calc()`. TOKENS/S is the writing speed; DONE IN is
reading the prompt plus writing the answer.

### Episode 1
Tour (record it as it plays, about 16 s): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?tour=ep1&autoplay=1
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=3&record=1
Guess card options: While it writes, the GPU's math is busy... A) 99% of the time / B) half the time / C) 1% of the time
Mission Report: M01 LIFTOFF   QWEN3.8 27B, 4-BIT | FITS? YES / YES / YES | TOKENS/S 12.8 (meas.) / 79 / 31 (rep.) | DONE IN 12 s (meas.) / 2.0 s / 5.8 s (rep.) | The GPU does 1% math, then waits for memory | NEXT: the fastest gaming GPU tries a bigger one
Changed (Session G): the 5090 and Mac columns are now reported (were 85 / 39 tokens/s and 1.9 / 5.0 s, estimated). The hook stands: the 1% is the Spark's.
Source of each number: the lists above. 5090: 78.94 tokens/s writing, 3,881 reading (`tgTps`, `ppTps` of q27 in `reported/rtx5090.json`, Q4_K_M); Mac: 30.71 writing, 325.3 reading (MLX 4-bit, `reported/mac.json`). "1%" is the lab's GPU math used for the Spark (`calc().busyWrite` = 1.05%, estimated from the measured 12.8 tokens/s and the `tflops` placeholder). Supporting measurement for the voiceover: the GPU draws 44 W while it reads the document and 28 W while it writes (`powerReadW`, `powerWriteW` of q27, 8,000 tokens).
Shot list: 1) key 1, the Spark loading (arcs from the SSD into the memory cells). 2) Space, key 3: every GPU block blazes while it reads the prompt (half a second). 3) key 3, hold 6 s while writing: one block of 48 flickers, the rest wait. 4) key 2: the bus lanes run at 100%, a sweep crosses the memory for every token. 5) key 3 again to loop back to the hook.

### Episode 2
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=flash&bits=4&prompt=q&crew=1&shot=2&record=1
  (the fix, for the end: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q36&bits=4&prompt=q&crew=1&shot=2&record=1 )
Guess card options: Qwen3.8-Flash-Next on an RTX 5090 writes at... A) 200 tokens/s / B) 50 tokens/s / C) it can't run it
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT | FITS? YES / NO / YES | TOKENS/S 24 (meas.) / NO / 25 (rep.) | DONE IN 6.8 s (meas.) / NO / 6.3 s (rep.) | 72 GB on the card even with its lookup table left in the PC, 30.5 GB of room: speed means nothing if it doesn't fit | NEXT: the bigger model that writes 5x faster
Changed (Session G): the Mac writes 25 tokens/s (reported, MLX), not 104 (estimated): about the Spark's speed, not 4x it. The fix at the end is 271 tokens/s on the 5090 (reported), not 513. The hook stands.
Source of each number: the lists above. 72 GB = the weights without the 29 GB lookup table, plus prompt memory, at 4-bit (estimated for the 5090; a graphics card leaves the table in the PC's memory, `tableOnHost` in `machines.json`, so the whole model would be 101 GB); the real file the Spark runs is 111 GB (`weightsGB`). 30.5 GB = `memGB` 32 minus `reserveGB` 1.5 of `rtx5090`.
Shot list: 1) key 1, the 5090 loading over the PCIe slot. 2) key 2: the 16 chips fill up, the last ones turn magenta and spill. 3) key 4: the PCIe slot, where there's no more room to send. 4) the Spark (its machine button, or M four times round: Mac, Strix Halo, Pro 6000, Spark): the same model fits, with 9 GB to spare. 5) the fix link: Qwen3.6 35B MoE fits the 5090 (271 tokens/s, reported).

### Episode 3
Tour (record it as it plays, about 16 s): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?tour=ep3&autoplay=1
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=2&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q36&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: A 27B model and a 35B model. Which writes faster? A) the 27B / B) the 35B / C) the same
Mission Report: M01 LIFTOFF   QWEN3.6 35B MOE, 4-BIT | FITS? YES / YES / YES | TOKENS/S 67 (meas.) / 271 (rep.) / 104 (est. from rep.) | DONE IN 2.4 s (meas.) / 0.6 s (rep.) / 1.6 s (est. from rep.) | Each token reads 2.9B of its 34.7B parameters: 5.2x faster than the dense 27B | NEXT: I gave my idle GPU 32 jobs
Changed (Session G): 5090 271 (was 513 est.), Mac 104 scaled from its reported document run (was 234 est.). The hook stands on the Spark (measured 5.2x); on the 5090 and the Mac the MoE is 3.4x faster than the 27B, so say "on this box". NEXT pointed at episode 4, which is dropped.
Source of each number: the lists above. The dense Qwen3.8 27B on the Spark: 12.8 tokens/s, done in 12 s (measured). 5.2x = 66.9 / 12.8 (`tgTps` of q36 and q27, 300 tokens, both measured). 2.9B and 34.7B: `active` and `total` of q36.
Shot list: 1) first link, key 2: the Qwen3.8 27B cells, a sweep through all of them for every token. 2) key 3: 12.8 tokens/s, the GPU mostly dark. 3) second link, key 2: only a few cells flash per token. 4) key 1 overview while the answer races out of the ports.

### Episode 4
Tour (record it as it plays, about 20 s): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?tour=ep4&autoplay=1
Preset links: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=mac&model=q27&bits=4&prompt=q&crew=1&shot=2&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=2&record=1
  then the document: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=doc&crew=1&shot=3&record=1
  and: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=mac&model=q27&bits=4&prompt=doc&crew=1&shot=3&record=1
Guess card options: The Mac answers a question first. Paste a 30-page document and... A) the Mac wins by more / B) the Spark wins / C) a tie
Mission Report: M01 LIFTOFF   QWEN3.8 27B, 4-BIT, DOCUMENT | FITS? YES / YES / YES | TOKENS/S 12 (meas.) / 80 (est. from rep.) / 25 (rep.) | DONE IN 23 s (meas.) / 4.0 s (rep. reading, writing est. from rep.) / 31 s (rep.) | Writing is memory, reading is math: the Mac writes faster, the Spark reads faster | NEXT: I gave my idle GPU 32 jobs
Changed (Session H, 2026-09-30): un-dropped, filmed as Spark vs Mac only. The hook names the two machines because the 5090 wins both rounds (question 2.0 s rep., document 4.0 s); the race panel stays hidden (the tour hides it, and so does record mode). The tour's Mission Report shows all five machines.
Source of each number: the lists above. The question: Mac 5.8 s (rep.; 30.71 tokens/s writing, 325.3 reading, `reported/mac.json`, MLX) against the Spark's 12 s (meas.; 12.84 writing, 571.3 reading, `measured/spark.json`). The document: Spark 23 s (meas.; reads 753.1 tokens/s, 11 s, writes 12.48) against the Mac's 31 s (rep.; reads 325.8, 25 s, writes 24.58). Bus: `bw` 273 against 819 GB/s (reported). The Spark reads the document 2.3x faster (753.1 / 325.8), the Mac writes 2.0x faster (24.58 / 12.48).
Shot list: 1) first link, key 2: the Mac's 32 lanes, the answer types out in 5.8 s. 2) second link, key 2: the Spark's 8 lanes, 12 s. 3) third link, key 3: all 48 GPU blocks blaze for 11 s while the Spark reads the document (trim it). 4) fourth link, key 3: the Mac's GPU cores read for 25 s (trim harder). 5) key 1 on the Spark for the loop.

### Episode 5
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=1&shot=3&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=q&crew=32&shot=3&record=1
Guess card options: 32 jobs at once. Each job gets... A) 32x slower / B) about as fast / C) the box crashes
Mission Report: M03 SKYLAB   QWEN3.8 27B, 4-BIT, CREW 32 | FITS? YES / YES / YES | TOKENS/S 307 (est. from meas.) / 1,940 / 273 total (est. from rep.) | DONE IN 32 s (est. from meas.) / 4.9 s / 47 s (est. from rep.) | 24x the output, and each job still gets 9.6 tokens/s (12.8 alone, measured) | NEXT: when does the GPU finally max out?
Changed (Session G): the 5090 and Mac columns are now scaled from reported single requests (were 2,006 / 273 total and 7.1 / 53 s). The hook stands.
Source of each number: the lists above, with `crew` 32 in `calc()`. The Spark's crew numbers are estimated from its measured single request (memory time per step scaled so crew 1 matches 12.8 tokens/s, reading at the measured 571 tokens/s). 24x = 307 / 12.8. Per job: Spark 9.6, 5090 61, Mac 8.5 tokens/s.
Shot list: 1) crew 1 link, key 3: one block flickers. 2) crew 32 link, key 3: 32 prompts read (all blocks blaze for 17 s, trim it), then more blocks light per token. 3) key 2: 32 small prompt-memory groups after the weights. 4) the big number, with the interface on (H): 307 tokens per second, 32 answers at once.

### Episode 6
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q36&bits=4&prompt=q&crew=1&shot=1&record=1
  (press M to switch to the 5090; or open it directly: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q36&bits=4&prompt=q&crew=1&shot=1&record=1 )
Guess card options: How much faster does the 5090 move memory? A) 2x / B) 6.6x / C) the same
Mission Report: M01 LIFTOFF   QWEN3.6 35B MOE, 4-BIT | FITS? YES / YES / YES | TOKENS/S 67 (meas.) / 271 (rep.) / 104 (est. from rep.) | DONE IN 2.4 s (meas.) / 0.6 s (rep.) / 1.6 s (est. from rep.) | Twice the lanes, each 3.3x faster: 6.6x the bandwidth, 4x the speed, but only 32 GB | NEXT: no desk can hold this model
Changed (Session G): the 5090 writes 271 tokens/s (reported), not 513: 4x the Spark, not 6.6x. The hook stands, but the payoff shot and the lesson changed: a mixture-of-experts step doesn't speed up in step with the bus.
Source of each number: the lists above. 6.6x = `bw` 1,792 / 273. Lane counts (8 and 16, 32 bits each) are drawn in `labs/machines/spark.js` and `rtx5090.js`. The 5090's 271 is a published llama-bench run of the Spark's own UD-Q4_K_M file (`reported/rtx5090.json`); 4x = 270.97 / 66.89.
Shot list: 1) key 1, the Spark: count the 8 bus lanes. 2) M: the Spark sinks into the stand and the 5090 rises. 3) key 2 on the 5090: 16 short, fat lanes, 2 cells per chip. 4) Space: 271 tokens/s against 67. 5) M four times (past the Mac, the Strix Halo and the Pro 6000) back to the Spark for the loop.

### Episode 7
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=mac&model=max&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: Qwen3.8-Max at 4-bit needs... A) 128 GB / B) 256 GB / C) 1,380 GB
Mission Report: M01 LIFTOFF   QWEN3.8-MAX, 4-BIT | FITS? NO / NO / NO | TOKENS/S NO / NO / NO | DONE IN NO / NO / NO | 2.4 trillion parameters: 1,380 GB at 4-bit, five times the biggest Mac | NEXT: 51 billion parameters it barely touches
Source of each number: the lists above. 1,380 GB = (`total` 2,419.8B) x `bpp` 0.57 plus prompt memory (estimated; no file, nothing here can load it). 248 GB = `memGB` 256 minus `reserveGB` 8 of `mac`.
Shot list: 1) key 2 on the Mac: all 256 cells fill and turn magenta. 2) M, M: the Strix Halo and the RTX Pro 6000 overflow even faster. 3) M, M: the Spark, then the 5090, one chip's worth. 4) the size handle dragged down from 2.4T until the first machine fits.

### Episode 8
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=flash&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: 51 billion of its parameters are read for each word... A) all of them / B) half / C) almost none
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT | FITS? YES / NO / YES | TOKENS/S 24 (meas.) / NO / 25 (rep.) | DONE IN 6.8 s (meas.) / NO / 6.3 s (rep.) | A 51B n-gram table sits in memory: each token reads a few rows of it | NEXT: I gave my idle GPU 32 jobs
Changed (Session G): the Mac column is reported, 25 tokens/s (was 104 est.). The hook stands.
Source of each number: the lists above. 51B = `table` of flash (51.2B, from the checkpoint). On the Spark the table is 28.8 GB of the 111 GB file (`tableGB`, `weightsGB`, measured) and stays in the file: llama.cpp reads its rows on demand (`lazyTable` in `models.json`), which is how the full model fits in 121 GiB.
Shot list: 1) key 2: the amber cells of the table next to the teal weights. 2) Space: the teal cells light by the handful every token, the amber ones only blink now and then. 3) key 1: 24 tokens/s from a 177B-parameter file.

### Episode 9
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=strix&model=q27&bits=4&prompt=q&crew=1&shot=3&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=strix&model=q27&bits=4&prompt=doc&crew=1&shot=3&record=1
  (the Spark, same two prompts: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q27&bits=4&prompt=doc&crew=1&shot=3&record=1 )
Guess card options: Same memory speed as the Spark, half the GPU math. Reading a 30-page document, it... A) ties / B) wins / C) takes twice as long
Mission Report: M01 LIFTOFF   QWEN3.8 27B, 4-BIT, DOCUMENT | FITS? YES / YES / YES / YES | TOKENS/S 12 (meas.) / 80 (est. from rep.) / 25 (rep.) / 11 (rep.) | DONE IN 23 s (meas.) / 4.0 s (rep. reading, writing est. from rep.) / 31 s (rep.) / 37 s (rep.) | Writing is memory, reading is math: same bus, but the Spark reads 2.3x faster | NEXT: this mini PC runs a model the 5090 can't load
Changed (Session G): 5090 80 / 4.0 s (was 82 / 5.7 s est.), Mac 25 / 31 s (was 38 / 33 s est.). The hook (Strix Halo against the Spark) stands.
Source of each number: the lists above. Writing: the Strix Halo 11.3 tokens/s against the Spark's 12.48 (document; question 11.6 against 12.84), 90% of the Spark, like its bandwidth: 256 against 273 GB/s (`bw`), 94%. Reading the document: 331.5 against 753.1 tokens/s (`ppTps`), 2.3x, so reading takes 24 s against 11 s and all of the gap is there (writing 13 s against 12 s). "15 seconds" = 37.4 - 22.6 s. The question alone: 14 s against 12 s. Half the math = `tflops` 59.4 against 125 (both estimated; the Strix Halo's from AMD's 40 compute units at 2,900 MHz). The Strix Halo runs are local-llm-benchmarks.dev's (llama.cpp, ROCm, UD-Q4_K_XL), linked in the file; the document numbers read 2,048 tokens after 8,192, so they are a little slow for an 8,000-token document from scratch. The Spark's GPU clock was capped at about 1,990 MHz when it was measured, so an uncapped Spark reads even faster.
Shot list: 1) first link, key 3: one small block of 40 flickers per token, 12 tokens/s (the Spark: 13). 2) key 2: count the lanes, 8, the same as the Spark. 3) second link, key 3: all 40 blocks blaze for 24 s (trim it) while the Spark's 48 bigger blocks are done in 11 s. 4) H: the race panel, the Spark done in 23 s, the Strix Halo still writing until 37 s (the 5090 finishes first, in 4.0 s). 5) key 3 again to loop back.

### Episode 10
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=strix&model=flash&bits=4&prompt=q&crew=1&shot=1&record=1
  (the 5090, for the overflow: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=flash&bits=4&prompt=q&crew=1&shot=2&record=1 )
Guess card options: Qwen3.8-Flash-Next, 177B parameters with its table. Which one can run it? A) the RTX 5090 / B) the mini PC / C) neither
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT | FITS? YES / NO / YES / YES | TOKENS/S 24 (meas.) / NO / 25 (rep.) / 21 (rep.) | DONE IN 6.8 s (meas.) / NO / 6.3 s (rep.) / 7.9 s (rep.) | 128 GB of slow memory beats 32 GB of fast memory: a model has to fit before speed counts | NEXT: I gave my idle GPU 32 jobs
Changed (Session G): the Mac column is reported, 25 tokens/s and 6.3 s (was 104 and 1.7 s est.): the three machines that hold it now write within 20% of each other. The hook stands.
Source of each number: the lists above. 101 GB = weights and table plus prompt memory at 4-bit (estimated), 120 GB free on the Strix Halo (`memGB` 128 minus `reserveGB` 8: the usual Linux setting lets its GPU map 120 GiB; out of the box it is about half, `gpuMemLinuxDefaultGB` 62.8, and the model would not fit) against 30.5 GB on the 5090. 177B = `total` 125.7B plus `table` 51.2B of flash. 21 tokens/s: 20.6, a published llama.cpp run of the UD-IQ4_XS file (93.7 GB; the Spark runs the 111 GB UD-Q4_K_XL at 24.2), 85% of the Spark.
Shot list: 1) key 1 on the Strix Halo: arcs from the SSD fill the packages, teal weights across the front row, then the amber table in the back row, 101 of 120 GB. 2) Space, key 3: the small GPU block blazes for half a second, then a few cells flash per token, 21 tokens/s. 3) the 5090 link, key 2: its 16 chips fill in a blink and spill magenta. 4) back to the first link, key 1, for the loop.

### Episode 11
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=pro6000&model=flash&bits=4&prompt=code&crew=1&shot=1&record=1
  (the 5090, same model: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=flash&bits=4&prompt=code&crew=1&shot=2&record=1 )
Guess card options: Flash-Next's file is 111 GB. The card holds 96 GB. It... A) won't load / B) crawls at 2 tokens/s / C) writes 60 tokens/s
Mission Report: M01 LIFTOFF   QWEN3.8-FLASH-NEXT, 4-BIT, CODEBASE | FITS? YES / NO / YES / YES / YES | TOKENS/S 23 (est. from meas.) / NO / 24 (est. from rep.) / 20 (est. from rep.) / 60 (rep.) | DONE IN 57 s (est. from meas.) / NO / 43 s (est. from rep.) / 1 min 32 s (est. from rep.) / 15 s (rep.) | The 29.5 GB lookup table waits in the PC's memory; the card keeps the 81.8 GB every token reads | NEXT: same chip as a 5090, three times the room
Changed (Session G): the Mac column is scaled from its reported runs, 24 tokens/s and 43 s (was 103 and 32 s est.). The hook stands; the Pro 6000 now writes 2.5x as fast as the Mac (before, the Mac's estimate wrote faster).
Source of each number: the lists above. The Pro 6000's run (`labs/data/reported/pro6000.json`, linked there): the Spark's own UD-Q4_K_XL file, 78,056 MiB on the card and 28,110 MiB in the PC's memory (111.3 GB together, 81.8 and 29.5 GB), writing 59.7 tokens/s, reading 2,559 tokens/s over a 22,695-token prompt, which stands for the 32,000-token codebase (reading 32,000 would be a little slower). It ran at a 450 W power limit of the card's 600 and with 8-bit prompt memory. 96 GB = `memGB` of pro6000, 94.5 GB free (`reserveGB` 1.5). The 5090 still needs 72.5 GB on its card with the table left in the PC (`tableOnHost`), against 30.5. The Spark's and the Strix Halo's codebase numbers are scaled from their 8,000-token runs. Speed against the Spark (real runs only): 59.7 against 22.92 tokens/s writing (the Spark's document run), 2.6x, with 6.6x the bandwidth (`bw` 1,792 against 273).
Shot list: 1) key 1: the card loads over the PCIe slot, the 16 memory spots fill to 83 of 94.5 GB, all teal: no amber table cells on the card. 2) Space, key 3: 188 blocks blaze for 13 s reading the codebase (trim it), then a few cells flash per token, 60 tokens/s. 3) the 5090 link, key 2: 16 chips fill and spill magenta. 4) back to the first link, key 1, for the loop.

### Episode 12
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=pro6000&model=q27&bits=4&prompt=q&crew=1&shot=2&record=1
  then 16-bit: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=pro6000&model=q27&bits=16&prompt=q&crew=1&shot=2&record=1
  (the 5090 at 16-bit, for the spill: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q27&bits=16&prompt=q&crew=1&shot=2&record=1 )
Guess card options: The RTX Pro 6000 and the RTX 5090 share one GPU chip. At 4-bit the Pro 6000 writes... A) 3x faster / B) just as fast / C) half as fast
Mission Report: M01 LIFTOFF   QWEN3.8 27B, 16-BIT | FITS? YES / NO / YES / YES / YES | TOKENS/S 3.7 (est. from meas.) / NO / 9.9 (est. from rep.) / 3.4 (est. from rep.) / 24 (est.) | DONE IN 41 s (est. from meas.) / NO / 16 s (est. from rep.) / 45 s (est. from rep.) / 6.2 s (est.) | Same chip, same 1,792 GB/s: about 80 tokens/s each at 4-bit, but only the Pro holds the 54 GB full-size model | NEXT: my AI box waits 99% of the time
Changed (Session G): 16-bit is now scaled from each machine's 4-bit run (Mac 9.9 was 11, Strix Halo 3.4 was 3.5, Spark unchanged); at 4-bit the 5090 is reported at 79 tokens/s while the Pro 6000's 85 is still the formula, so say "about 80 each". The hook stands.
Source of each number: the lists above. 4-bit, question: 79 tokens/s on the 5090 (reported, `reported/rtx5090.json`) and 85 on the Pro 6000 (est.), with `bw` 1,792 GB/s on both (reported by NVIDIA). Same chip: GB202 with 188 SMs on the Pro 6000 (`gpuSMs`, NVIDIA's architecture paper) and 170 on the 5090. 16-bit: 53.8 GB of weights (`total` 26.9B x `bpp` 2.0) plus prompt memory, 54.0 GB, against 30.5 GB free on the 5090 and 94.5 on the Pro 6000. Three times the room: `memGB` 96 against 32.
Shot list: 1) first link, key 2: the Pro 6000's memory, 15.5 of 94.5 GB, 85 tokens/s (est.). 2) M twice (past the Spark to the 5090): 79 tokens/s on its 16 chips (reported). 3) the 16-bit links, key 2 on each: the Pro 6000 fills 9 of its 16 spots, the 5090 fills all 16 and spills magenta. 4) key 1 on the Pro 6000 for the loop.
