# Simplification pass, Mission 01

Session A, step 3. Every part of the page, with the ones that look unnecessary marked **maybe cut**
and a reason. Nothing was removed.

## The scene

| Part | Verdict | Why |
|---|---|---|
| Display stand: plinth, placard text, glowing floor edge | keep | Frames the machine; the placard is readable in shot 1 |
| Floor light pool and faint grid | keep | The background is never seen, the floor carries the studio light (HANDOFF gotcha 5) |
| Case: base tray, two cut-away walls | keep | Gives the cutaway look |
| Four standoffs under the board | **maybe cut** | Hidden by the board from every camera shot |
| Metal-foam back wall | keep | Cosmetic, but it is the wall you see in shots 2 and 3 |
| PCB texture: routed traces, vias, silkscreen | keep | Sells "real board". Three 2048 px canvases, so it is the heaviest texture |
| GB10: substrate, GPU die (48 tiles), Grace die (20 tiles) | keep | The GPU tiles are the point of the mechanism |
| 28 tiny gold parts on the substrate | **maybe cut** | Decoration, not visible past shot 2 |
| 8 memory chips with 16 cells each | keep | The model lives here |
| Bus ribbons and flowing particles | keep | The bus is the lesson |
| 10 inductors, 8 polymer caps | keep | Read as "power", good depth cue |
| About 200 ceramic caps, 70 resistors | **maybe cut** | Tiny, unlabelled, not part of the mechanism |
| SSD with sticker and barcode | keep | Loading arcs start here |
| Network chip with heatsink | **maybe cut** | No label, nothing in the mechanism uses it |
| Back ports | keep | The answer packets fly out through them |
| Cooler lifted off: copper plate, heat pipes, fins, fan, ring, dashed guide lines | keep | Says "exploded view". The fan speed and ring colour are cosmetic |
| Lights: hemisphere, warm key, cool rim, teal bus glow, orange GPU glow | keep | The look |
| Post: bloom, two tilt-shift passes, grade, vignette, grain | keep | The look. The two tilt-shift passes are the priciest part |
| "Opening the case" loading curtain | keep | Hides the first frames |

## How it works

| Part | Verdict | Why |
|---|---|---|
| Load, read, write, done phases | keep | The mechanism |
| MoE cells flashing, overflow spill in magenta | keep | Episodes 2 and 3 |
| Real time / 5x playback | keep | A codebase prompt takes minutes to read |
| Model, Compression, Prompt pills, Launch | keep | The controls |
| Reset button and R key | **maybe cut** | "Launch again" and clicking any pill cover nearly all uses |
| Race panel, three machines | keep | Sessions B and D build on it |
| Part labels with leader lines | keep | Session B moves them to side rails |
| Toast when a model does not fit | keep | Explains the disabled Launch |

## The interface

| Part | Verdict | Why |
|---|---|---|
| Headline, sticker, mission stamp | keep | |
| What's real? and Keys dialogs | keep | |
| **All missions** dialog | **maybe cut** | The hub page now lists the missions, and the list is written out twice |
| Answer panel, big number, two meters, speed line | keep | |
| Camera shot 4 (SSD) | **maybe cut** | None of the six planned episodes closes up on the SSD |
| Keys F (fullscreen) and L (hide labels) | **maybe cut** | H already hides everything, browsers have F11 |
| Keys 1-3, C, H, Space | keep | Filming controls (shots template) |
| "Hide interface" button (touch only) | keep | Touch has no H key |
| Mobile layout at 900 px and below | keep | |
| Reduced-motion handling, safe-area padding | keep | |
| Light/dark colour switch in the theme CSS | **maybe cut** | Left over from the claude.ai viewer (gotcha 8). On Pages only the visitor's OS setting triggers it, so the paper colours differ from person to person |
| Grain and wear noise (two SVG feTurbulence filters in CSS) | **maybe cut** | Expensive to paint on phones. Pre-render to a small PNG |
| Fallback message when three.js fails | keep | |

## Dead code inside the file

- `sim.winnerId` is set in three places and never read.
- The race row has `o.m.id === 'spark' ? sim.t : sim.t` (both sides are the same).
- The floor texture loop declares `const a` and never uses it.
- Board text on canvases is drawn before the web fonts arrive, so it always uses the fallback font (known, gotcha 9).
