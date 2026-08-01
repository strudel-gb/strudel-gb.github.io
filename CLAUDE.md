# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`strudel-gb` is a Game Boy APU synthesis plugin for [Strudel](https://strudel.cc/), plus the
static site that hosts it (`strudel-gb.github.io`). A WebAssembly Game Boy APU core runs inside
an `AudioWorkletProcessor`; a main-thread plugin registers `gb.*` sounds with Strudel's pattern
scheduler and posts sample-accurate register writes to the worklet.

There is no bundler and no `dist/`. The repo root **is** the deployed site: every `.html`, `.js`
and `.css` file is served as-is from GitHub Pages.

## The single most important rule: generated files

`gb-processor.js` and `strudel-gb-plugin.js` are **auto-generated and committed**. Never edit them
directly — `npm run build` overwrites both.

Edit `build.js` instead:

| Region of `build.js` | Generates | Notes |
| --- | --- | --- |
| `processorTemplate`, ~lines 31–775 | `gb-processor.js` | Audio-thread code: `GBProcessor`, register writes, arpeggiator, envelope simulation, visualizer state |
| `pluginTemplate`, ~lines 780–end | `strudel-gb-plugin.js` | Main thread: `GBNodePool`, `DEFAULTS`, `INSTRUMENTS`, `TAGS`, `initGBPlugin()` |

The processor source is inlined into the plugin as a template string and loaded via a Blob URL, so
the plugin works from `file://` and sandboxed origins with no extra fetch. Because of that
inlining, `build.js` escapes backslashes, backticks and `${` before embedding. **Inside the
template literals in `build.js`, escape sequences must be written for the template, not the output**
— e.g. `split(/[\\s,]+/)` in `build.js` produces `split(/[\s,]+/)` in the generated file.

`eslint.config.js` ignores both generated files, so lint will not catch mistakes in them; a syntax
error only shows up at runtime in the browser.

Build requires `node_modules/apu/dist/apu.mjs` — the base64 WASM binary is extracted from the `apu`
npm package by regex. Run `npm install` before `npm run build`.

## Commands

```bash
npm install          # required before build (build reads node_modules/apu)
npm run build        # regenerate gb-processor.js + strudel-gb-plugin.js from build.js
npm run dev          # live-server on http://localhost:8080 (alias: npm start)
npm run lint         # eslint (skips the two generated files)
npm test             # playwright, chromium only; starts npm run dev automatically
npm run test:ui      # playwright UI mode
```

Typical loop after touching `build.js`: `npm run build && npm test`.

## Architecture

**Main thread — `strudel-gb-plugin.js` (from `build.js`)**

- `GBNodePool` wraps 1–16 `AudioWorkletNode`s and exposes a single `port`-like façade
  (`postMessage`, `addEventListener`) so callers treat the pool as one node.
- Polyphony: each `noteOn` carries a `voiceId`; the pool round-robins nodes and maps
  `voiceId → node` so the matching `noteOff` reaches the same node.
- Strict mode is enabled automatically when pool size is 1 (`init()`), i.e. true Game Boy
  monophony-per-channel; it is disabled for larger pools.
- `initGBPlugin(audioCtx)` adds the Blob module, creates the pool, and returns it.
- `DEFAULTS`, `INSTRUMENTS` (~65 `gb.*` presets), `TAGS` are exported from here.

**Audio thread — `gb-processor.js` (from `build.js`)**

- Registered as `'gb-processor'`. Accepts two message types: `{type:'schedule', action:'noteOn'|'noteOff', time, freq, ...}`
  and `{type:'setStrictMode', value}`.
- Events are kept in a time-sorted queue and drained inside `process()` for the current 128-sample
  block (~2.9 ms at 44.1 kHz), which is where the timing accuracy comes from.
- Writes real APU registers through the WASM export `gb_sound_w` (NR10–NR44, wave RAM, NR51 for
  per-channel stereo routing / immediate mute).
- Mirrors hardware state in JS (`this.channels`) to drive the arpeggiator, an envelope *simulation*
  for the UI meters, and throttled `visualizerState` messages (~30 ms).
- Strict mode posts `strictWarning` messages for polyphony overlaps and out-of-range frequencies —
  it warns, it does not block.

**Pages** — `index.html` (portal), `playground.html` (hardware register UI), `repl.html` (live
coding editor, loads `@strudel/repl` from unpkg), `guide.html` (preset catalog). `shared.js` and
`shared.css` hold cross-page helpers (instrument categorisation, formatting, visualizers).

## Known duplication — keep in sync

`repl.html` and `playground.html` each contain their **own copy** of the `resolveParams` /
`registerGBSound` logic rather than calling into the plugin's version. A change to parameter
resolution, the tag merge order, or the schedule message shape in `build.js` usually needs the same
change applied by hand in those HTML files. Check `repl.html` (~lines 240–330) when editing that
logic.

`shared.js` also hardcodes preset-name lists (`pulsePresets`, `sfxPresets`) for categorisation —
new presets added to `INSTRUMENTS` may need adding there too, or they fall into the wrong category
in the UI.

## Strudel control quirks that bite this plugin

All three of these produced *silence or wrong sound with no console error*. All
are fixed; the notes stay because the underlying Strudel behaviour has not
changed and the next control will hit the same walls.

**Strings nested in a control object become `Pattern` instances.** Strudel
patternifies control arguments, and a string inside an object
(`.envelope({direction:"down"})`) comes back as a `Pattern`, which holds
functions and cannot cross a MessagePort — `postMessage` threw `DataCloneError`
and the note silently never reached the APU. `gbSanitize()` in the plugin now
collapses Patterns to their first-cycle value(s) before posting, and
`postSchedule()` logs anything still unclonable instead of dropping it. Route
every new message through `postSchedule`.

**Control values are mini-notation.** A space-separated string becomes several
events, so it cannot carry a list: `.arpTable("0 4 7 12")` gives the note only
the first offset. Arrays (`[0,4,7,12]`) and colon strings (`"0:4:7:12"`) arrive
as a single array value — those are the forms to document and test.

**Names can be shadowed by Strudel core.** `arp` is core's chord arpeggiator, so
the plugin's control of that name was unreachable; `hwArp`/`gbArp` were listed in
`createParams` but never worked either. The hardware arpeggiator is exposed as
`arpTable`, folded into the internal `arp` key by `resolveParams`. Before adding
a control, check the name is not already a `Pattern` method.

Also note that `initGBPlugin(ctx)` is called from `repl.html` **without** `core`,
so everything in `build.js` guarded by `if (core && ...)` — the `arp`/`hwArp`
prototype overrides, `registerSynth` — never runs in the shipped app. That is the
"stand-alone mode" warning in the console.

## Hardware details worth knowing

- **Pulse and noise have no volume register.** `volume` has to be written as the
  envelope's initial level; an explicit `.envelope()` wins over `.volume()`. This
  is resolved on the main thread in `resolveParams`, which is the only place that
  can tell an explicit value from a default.
- **NRx4 bit 6 enables the length counter.** Writing the trigger bit alone loads
  the length value but never counts it down, so `.length()` does nothing. Every
  channel's trigger write must set `0x40` when a length was given.
- **Note names** are parsed by `gbNoteToMidi()`: case-insensitive, `#`/`s` sharp,
  `b`/`f` flat. Anything else warns and falls back to 440Hz.

## Adding a preset

1. Add the entry to `INSTRUMENTS` in `build.js` (channel + hardware params; see neighbours for shape).
2. `npm run build`.
3. Categorise it in `shared.js` if it is a pulse synth or SFX preset.
4. Document it in the matching section of `REFERENCE.md`.

## Tests

Playwright drives the real pages in Chromium; there are no unit tests. The channel suites assert on
**the audio the APU actually produced**, via `tests/helpers/audio-probe.js`:

- `openRepl(page)` loads `repl.html`, installs the probe and warms the graph. The warm-up matters:
  superdough boots lazily and swallows the first pattern after page load, so without it every first
  capture is silent.
- `capture(page, code, ms)` plays a pattern and returns measurements: per-note pitch (autocorrelation
  with a subharmonic guard), `duty` (fraction of the period spent high — this reads the real duty
  register), `crest` (peak/RMS, the wavetable-shape fingerprint), `clarity` (tonal vs LFSR noise),
  `rmsHead`/`rmsTail` (envelope direction), `rmsLeft`/`rmsRight` (panning), `durationMs` (length
  counter) and `runs` (pitch changes *within* a note, which is where arpeggios and sweeps live).

Assertion guidance learnt the hard way:

- Never assert on visualizer text. `P1`, `P2`, `WV`, `NS` are static labels in the markup — the old
  suites asserted `toContainText('P1')`, which passed against a completely silent APU. Assert on
  `.ch-note` / `.ch-block.active` instead.
- One pitch per note is not enough for arpeggios or sweeps; use `note.runs`.
- Dense patterns merge into one segment (no silence between notes), so count pitch movement rather
  than `noteCount`.
- Triangle and sawtooth share a crest factor mathematically; don't assert they differ.

`outputDir` points at the system temp dir on purpose: the dev server watches the project root, and a
trace written into `test-results/` would reload the page mid-test and wipe the probe.

`tests/regression.spec.js` holds one test per bug that reached a user. Add to it rather than
trusting a channel suite to cover a specific regression.

## Deployment

`.github/workflows/deploy.yml` runs on push to `main`/`master`: `npm ci` → `npm run build` → upload
the whole repo root to GitHub Pages. Since the build regenerates the two committed files, a stale
checked-in copy is silently corrected on deploy but will show up as a diff locally — commit the
regenerated files with your `build.js` change.

## Conventions

- ES modules everywhere (`"type": "module"`); no transpilation, no framework, no CSS build.
- License is GPL-3.0-or-later.
- `REFERENCE.md` is the user-facing API doc and should track any parameter, preset or tag change.
- `TASKS.md` is a pasted working transcript, not a spec — do not treat it as authoritative.
