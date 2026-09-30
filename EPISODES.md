# Episodes

One row per Short. The preset link opens the lab in the exact state to film
(record mode hides the interface). Report numbers come from `labs/data/`, never by hand.
Status: idea → ready (preset works, numbers filled) → filmed → posted.

| # | Mission | Hook (0–1 s) | Setup | Close-up | Status |
|---|---|---|---|---|---|
| 1 | 01 Liftoff | My AI box waits 99% of the time | Spark, Llama 70B, 4-bit, question | GPU (3) while writing | idea |
| 2 | 01 Liftoff | The fastest gaming GPU can't run this | 5090, Llama 70B, 4-bit | memory (2), overflow | idea |
| 3 | 01 Liftoff | Same size model, [N]x faster | Spark, Qwen 32B vs Qwen 30B MoE, 4-bit | memory (2), cells flashing | idea |
| 4 | 01 Liftoff | A long document flips the winner | Spark vs Mac, Llama 70B, document | overview (1) + race | idea |
| 5 | 03 Skylab | I gave my idle GPU 32 jobs | Spark, Llama 70B, crew 1 → 32 | GPU (3) lighting up | needs crew dial |
| 6 | 01 Liftoff | Inside a 5090 vs inside a Spark | switch machines | overview (1) | needs interiors |

For each episode that turns "ready", fill in underneath:

```
### Episode N
Preset link:
Guess card options: A / B / C
Mission Report:  subtitle | FITS? | TOKENS/S | DONE IN (Spark, 5090, Mac) | the lesson | next mission
Source of each number: file + field, measured or estimated
Shot list: 1) ... 2) ... 3) ...
```
