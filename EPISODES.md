# Episodes

One row per Short. The preset link opens the lab in the exact state to film
(record mode hides the interface). Report numbers come from `labs/data/`, never by hand:
`node labs/tools/report.mjs "model=l70&prompt=q&crew=1"` prints them with the source of every input.
Status: idea → ready (preset works, numbers filled) → filmed → posted.

| # | Mission | Hook (0–1 s) | Setup | Close-up | Status |
|---|---|---|---|---|---|
| 1 | 01 Liftoff | My AI box waits 99% of the time | Spark, Llama 70B, 4-bit, question | GPU (3) while writing | ready |
| 2 | 01 Liftoff | The fastest gaming GPU can't run this | 5090, Llama 70B, 4-bit | memory (2), overflow | ready |
| 3 | 01 Liftoff | Same size model, 7x faster | Spark, Qwen 32B vs Qwen 30B MoE, 4-bit | memory (2), cells flashing | ready |
| 4 | 01 Liftoff | A long document flips the winner | Spark vs Mac, Llama 70B, document | overview (1) + race | ready |
| 5 | 03 Skylab | I gave my idle GPU 32 jobs | Spark, Llama 70B, crew 1 → 32 | GPU (3) lighting up | ready (filmed in the 01 lab, which has the crew dial) |
| 6 | 01 Liftoff | Inside a 5090 vs inside a Spark | switch machines | overview (1) | ready |

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
mac), `model` (a preset id, or a size in billions for a dense model), `bits` (4, 8, 16), `prompt` (q, doc, code),
`crew` (1–64), `shot` (1–4), `speed` (1, 5), `record=1` (interface hidden, launches once the model has loaded).
In record mode: keys 1–4 move the camera, Space launches again, M switches to the next machine, H brings the interface back.
Every number below is **estimated** (no machine is measured yet); print "est." on the report until Session C measures the Spark.

**Sources, the same for every episode.** Machines: `labs/data/machines.json`, fields `memGB`, `reserveGB`, `bw`,
`tflops` of `spark`, `rtx5090`, `mac`, all `"estimated"`. Model: `labs/data/models.json`, fields `total`, `active`,
`kvMB` of the model, and `bpp` of the precision, all `"estimated"`. Prompt length: `labs/data/models.json`
`prompts[].tokens` (`"chosen"`). Answer length 150 tokens: `labs/kit/model.js` `ANSWER`. Speed rules:
`labs/kit/model.js` `calc()`. TOKENS/S is the writing speed; DONE IN is reading the prompt plus writing the answer.

### Episode 1
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=l70&bits=4&prompt=q&crew=1&shot=3&record=1
Guess card options: While it writes, the GPU's math is busy... A) 99% of the time / B) half the time / C) 1% of the time
Mission Report: M01 LIFTOFF   LLAMA 70B, 4-BIT | FITS? YES / NO / YES | TOKENS/S 4.7 / NO / 14 (est.) | DONE IN 32 s / NO / 14 s (est.) | The GPU does 1% math, then waits for memory | NEXT: the fastest gaming GPU tries it
Source of each number: the list above. "1%" is the lab's GPU math used for the Spark (`calc().busyWrite` = 1.07%, estimated).
Shot list: 1) key 1, the Spark loading (arcs from the SSD into the memory cells). 2) Space, key 3: every GPU block blazes while it reads the prompt (under a second). 3) key 3, hold 6 s while writing: one block of 48 flickers, the rest wait. 4) key 2: the bus lanes run at 100%, a sweep crosses the memory for every token. 5) key 3 again to loop back to the hook.

### Episode 2
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=l70&bits=4&prompt=q&crew=1&shot=2&record=1
  (the fix, for the end: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q32&bits=4&prompt=q&crew=1&shot=2&record=1 )
Guess card options: Llama 70B on an RTX 5090 writes at... A) 60 tokens/s / B) 15 tokens/s / C) it can't run it
Mission Report: M01 LIFTOFF   LLAMA 70B, 4-BIT | FITS? YES / NO / YES | TOKENS/S 4.7 / NO / 14 (est.) | DONE IN 32 s / NO / 14 s (est.) | 40.4 GB of model, 30.5 GB of room: speed means nothing if it doesn't fit | NEXT: same size model, 7x faster
Source of each number: the list above. 40.4 GB = weights plus prompt memory, 30.5 GB = `memGB` 32 minus `reserveGB` 1.5 of `rtx5090`.
Shot list: 1) key 1, the 5090 loading over the PCIe slot. 2) key 2: the 16 chips fill up, the last ones turn magenta and spill. 3) key 4: the PCIe slot, where there's no more room to send. 4) M twice (to the Spark): the same model fits with room to spare. 5) the fix link: Qwen 32B fits the 5090 and writes at 67 tokens/s.

### Episode 3
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q32&bits=4&prompt=q&crew=1&shot=2&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q30&bits=4&prompt=q&crew=1&shot=2&record=1
Guess card options: Two models the same size. Which writes faster? A) Qwen 32B / B) Qwen 30B MoE / C) the same
Mission Report: M01 LIFTOFF   QWEN 30B MOE, 4-BIT | FITS? YES / YES / YES | TOKENS/S 71 / 468 / 214 (est.) | DONE IN 2.1 s / 0.3 s / 0.8 s (est.) | Each token reads 3.3B of its 30.5B parameters: 7x faster than the dense 32B | NEXT: a long document flips the winner
Source of each number: the list above. The dense Qwen 32B on the Spark: 10 tokens/s, done in 15 s (est.). 7x = 71.3 / 10.2 from `calc().writeTps`.
Shot list: 1) first link, key 2: the Qwen 32B cells, a sweep through all of them for every token. 2) key 3: 10 tokens/s, the GPU mostly dark. 3) second link, key 2: only a few cells flash per token. 4) key 1 overview while the answer races out of the ports.

### Episode 4
Preset link (interface on, for the race): https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=l70&bits=4&prompt=doc&crew=1&shot=1&speed=5
  the short-question round first: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=l70&bits=4&prompt=q&crew=1&shot=1&speed=5
Guess card options: A 30-page document. Who finishes first? A) DGX Spark / B) Mac Studio / C) a tie
Mission Report: M01 LIFTOFF   LLAMA 70B, 4-BIT, DOCUMENT | FITS? YES / NO / YES | TOKENS/S 4.5 / NO / 13 (est.) | DONE IN 52 s / NO / 1 min 32 s (est.) | The Mac writes faster, the Spark reads faster: a long prompt flips the winner | NEXT: I gave my idle GPU 32 jobs
Source of each number: the list above. The question round: Spark 32 s, Mac 14 s (est.). Reading the document: Spark 18 s, Mac 1 min 21 s (`calc().readS`, from the `tflops` placeholders, estimated).
Shot list: 1) question link, Space: the Mac wins the race panel, 14 s to 32 s. 2) document link, Space: the Spark's GPU blazes while it reads. 3) the race panel: the Mac is still reading when the Spark starts writing. 4) the finish note, "Switch your prompt ... and the winner changes". Film at 5x (speed=5).

### Episode 5
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=l70&bits=4&prompt=q&crew=1&shot=3&record=1
  then: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=l70&bits=4&prompt=q&crew=32&shot=3&record=1
Guess card options: 32 jobs at once. Each job gets... A) 32x slower / B) about as fast / C) the box crashes
Mission Report: M03 SKYLAB   LLAMA 70B, 4-BIT, CREW 32 | FITS? YES / NO / YES | TOKENS/S 139 / NO / 99 total (est.) | DONE IN 56 s / NO / 2 min 25 s (est.) | 30x the output, and each job still gets 4.4 tokens/s (4.7 alone) | NEXT: when does the GPU finally max out?
Source of each number: the list above, with `crew` 32 in `calc()`. Per job: Spark 4.4, Mac 3.1 tokens/s. Where the dial runs out (`calc().crewGpu`, `crewMem`): the Mac's GPU maxes out at crew 8; the Spark's not before 127, and its memory holds 580 such jobs.
Shot list: 1) crew 1 link, key 3: one block flickers. 2) crew 32 link, key 3: 32 prompts read (all blocks blaze for 22 s, trim it), then about a third of the blocks light per token. 3) key 2: 32 small prompt-memory groups after the weights. 4) the big number, with the interface on (H): 139 tokens per second, 32 answers at once.

### Episode 6
Preset link: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=spark&model=q32&bits=4&prompt=q&crew=1&shot=1&record=1
  (press M to switch to the 5090; or open it directly: https://tacdelgineer.github.io/desk-space-program/01-liftoff/?machine=rtx5090&model=q32&bits=4&prompt=q&crew=1&shot=1&record=1 )
Guess card options: How much faster does the 5090 move memory? A) 2x / B) 6.6x / C) the same
Mission Report: M01 LIFTOFF   QWEN 32B, 4-BIT | FITS? YES / YES / YES | TOKENS/S 10 / 67 / 31 (est.) | DONE IN 15 s / 2.4 s / 6.3 s (est.) | Twice the lanes, each 3.3x faster: 6.6x the speed, but only 32 GB | NEXT: the fastest gaming GPU can't run this
Source of each number: the list above. 6.6x = `bw` 1,792 / 273. Lane counts (8 and 16, 32 bits each) are drawn in `labs/machines/spark.js` and `rtx5090.js`.
Shot list: 1) key 1, the Spark: count the 8 bus lanes. 2) M: the Spark sinks into the stand and the 5090 rises. 3) key 2 on the 5090: 16 short, fat lanes, 2 cells per chip. 4) Space: 67 tokens/s against 10. 5) M twice (past the Mac) back to the Spark for the loop.
