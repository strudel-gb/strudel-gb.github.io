# strudel-gb

A high-performance Game Boy APU synthesis plugin for **[Strudel](https://strudel.cc/)** (the JavaScript live coding environment for music). Compose, synthesize, and live-code Game Boy chiptunes in real-time.

* **Live Studio Portal**: [https://strudel-gb.github.io/](https://strudel-gb.github.io/)
* **GitHub Repository**: [https://github.com/strudel-gb/strudel-gb.github.io](https://github.com/strudel-gb/strudel-gb.github.io)

---

## Live Apps & Web Interfaces

* 🎮 **[Hardware Playground](https://strudel-gb.github.io/playground.html)** – Interactive virtual Game Boy with hardware register sliders, visualizers, and key triggers.
* ⚡ **[Live REPL Studio](https://strudel-gb.github.io/repl.html)** – In-browser Strudel editor for live-coding Game Boy chiptunes.
* 📖 **[Reference Guide](https://strudel-gb.github.io/guide.html)** – Interactive preset catalog with audio previews and parameter docs.

---

## Core Features

* **Self-Contained WASM APU**: Base64-embedded Game Boy APU WebAssembly emulator core (compiled from C) running directly inside a Web Audio `AudioWorkletProcessor`. Zero external audio thread network fetches.
* **Block-Accurate Timing**: Event scheduling precision of ~2.9ms (128 samples @ 44.1kHz), eliminating timing jitter.
* **4-Channel Hardware Emulation**: Full simulation of Pulse 1 (pitch sweep), Pulse 2, 4-bit Wavetable, and Noise LFSR (7-bit / 15-bit) channels.
* **Dynamic Polyphony Pool**: Configurable polyphony pool (1 to 8 voice nodes) with smart automatic channel allocation.
* **Rich Preset Engine**: 40+ built-in instrument & SFX presets (`gb.lead`, `gb.bass`, `gb.kick`, `gb.snare`, `gb.coin`, `gb.jump`, `gb.powerup`, etc.).

---

## Project Structure

| Path | Role |
| --- | --- |
| `build.js` | **Source of truth.** Extracts the WASM binary from the `apu` package and generates the two runtime files below from inline templates. Presets (`INSTRUMENTS`), tags (`TAGS`) and `DEFAULTS` live here. |
| `gb-processor.js` | *Generated.* The `AudioWorkletProcessor` running on the audio thread. Hosts the WASM APU and schedules register writes with sub-block accuracy. |
| `strudel-gb-plugin.js` | *Generated.* Main-thread plugin (`initGBPlugin`, `GBNodePool`) that integrates with Strudel's pattern scheduler and registers the `gb` synth family. |
| `index.html`, `playground.html`, `repl.html`, `guide.html` | Web application portals, served directly from the repo root. |
| `shared.js`, `shared.css` | Cross-page helpers: instrument categorisation, formatting, visualizers. |
| `tests/` | Playwright end-to-end suites driving the real pages in Chromium. |
| `REFERENCE.md` | Complete API documentation of register parameters, presets, and composition recipes. |

> ⚠️ `gb-processor.js` and `strudel-gb-plugin.js` are **auto-generated and committed**. Edit `build.js` and re-run `npm run build` — direct edits are overwritten.

---

## Quick Start (Local Development)

1. Ensure you have [Node.js](https://nodejs.org) installed (CI uses Node 20).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:8080` in your web browser.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` / `npm start` | Serve the site on `http://localhost:8080` with CORS enabled. |
| `npm run build` | Regenerate `gb-processor.js` and `strudel-gb-plugin.js` from `build.js`. Requires `npm install` first (the WASM core is read from `node_modules/apu`). |
| `npm run lint` / `npm run lint:fix` | ESLint over the hand-written sources (the two generated files are ignored). |
| `npm test` | Run the Playwright suites. The dev server is started automatically. |
| `npm run test:ui` | Playwright UI mode for interactive debugging. |

### Testing

End-to-end tests live in `tests/` and exercise the real pages in Chromium — channel suites for
Pulse 1, Pulse 2, Wave and Noise, plus the REPL studio, hardware playground and developer tools.
They drive the Strudel editor programmatically and assert on visualizer state and the absence of
console errors.

```bash
npm test                            # everything
npx playwright test tests/wave-suite.spec.js   # a single suite
```

### Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which installs dependencies, runs
`npm run build`, and publishes the repository root to GitHub Pages. There is no bundling step and
no `dist/` directory — what is in the repo is what is served. Commit the regenerated files
alongside any `build.js` change.

---

## Using `strudel-gb` in the Official Strudel REPL (strudel.cc)

You can load the Game Boy synth engine directly inside **[strudel.cc](https://strudel.cc/)**:

### 1. Load the Plugin
Paste the following loader code into the editor on [strudel.cc](https://strudel.cc/) and press **Run** (`Shift + Enter`):

```javascript
(async () => {
  const ctx = getAudioContext();
  
  // Load the Game Boy processor worklet module
  await ctx.audioWorklet.addModule('https://strudel-gb.github.io/gb-processor.js');
  
  // Initialize the AudioWorklet node
  const gbNode = new AudioWorkletNode(ctx, 'gb-processor', {
    outputChannelCount: [2]
  });
  gbNode.connect(ctx.destination);
  
  gbNode.port.onmessage = (e) => {
    if (e.data.type === 'ready') {
      console.log('[strudel-gb] Game Boy WASM APU is ready.');
    }
  };

  // Register the sound in Strudel's sound map
  registerSound('gb', (time, value) => {
    const freq = value.freq || 440;
    gbNode.port.postMessage({
      type: 'schedule',
      action: 'noteOn',
      time: time,
      freq: freq
    });
    
    const dummy = new GainNode(ctx, { gain: 0 });
    return { node: dummy, stop: () => {} };
  });

  console.log('[strudel-gb] Game Boy plugin successfully loaded!');
})();
```

*(Note: For local development, replace `https://strudel-gb.github.io/gb-processor.js` with `http://localhost:8080/gb-processor.js`.)*

### 2. Compose Chiptune Patterns
Replace the editor text with any Strudel pattern and play:

```javascript
// Melodic Lead
note("C4 D4 E4 G4 A4 C5")
  .s("gb")
  .fast(2)
```

```javascript
// Multi-channel Chiptune Stack
stack(
  note("C2 G2 C3 Eb3").s("gb.bass"),
  note("C4 Eb4 G4 Bb4").s("gb.lead").fast(2),
  note("C4").s("gb.kick").struct("1 0 0 0 1 0 0 0"),
  note("C4").s("gb.snare").struct("0 0 1 0 0 0 1 0")
)
```

---

## How It Works

```
Strudel pattern  ──►  strudel-gb-plugin.js        ──►  gb-processor.js        ──►  WASM APU
(main thread)         GBNodePool: 1–16 worklet         AudioWorkletProcessor:      gb_sound_w()
                      nodes, voiceId routing,          time-sorted event queue,    NR10–NR44,
                      preset/tag resolution            drained per 128-sample      Wave RAM,
                                                       block (~2.9 ms)             NR51 panning
```

* **Presets and tags** (`INSTRUMENTS`, `TAGS`, `DEFAULTS`) are resolved on the main thread into a flat set of hardware parameters, then sent as a scheduled message with a `voiceId`.
* **Polyphony** is emulated by pooling worklet nodes; each note is routed round-robin and its `noteOff` is delivered back to the same node.
* **Strict Game Boy mode** is enabled automatically for a pool size of 1 and reports polyphony and frequency-range violations as console warnings, without altering playback.
* The processor also mirrors hardware state in JavaScript to drive the built-in arpeggiator and the real-time channel visualizers.

---

## Contributing

1. Make changes in `build.js` (audio/plugin behaviour, presets, tags) or in the HTML/CSS/`shared.js` for UI work.
2. Run `npm run build` if you touched `build.js`, then `npm run lint` and `npm test`.
3. Update `REFERENCE.md` for any new or changed parameter, preset, or tag.
4. Commit the regenerated `gb-processor.js` / `strudel-gb-plugin.js` together with your `build.js` change.

Note that `repl.html` and `playground.html` carry their own copies of the parameter-resolution logic; changes to that logic in `build.js` generally need to be mirrored there.

---

## Documentation & References

* **[REFERENCE.md](REFERENCE.md)**: Full API parameters, channel definitions, and preset list.
* **[CLAUDE.md](CLAUDE.md)**: Repository guide for AI coding assistants — build pipeline, architecture, and gotchas.
* **[Interactive Reference Guide](https://strudel-gb.github.io/guide.html)**: Preset catalog with audio previews.
* **[Pan Docs — Game Boy Sound Controller](https://gbdev.io/pandocs/Audio.html)**: Hardware register specifications used by this emulation.

---

## License & Terms

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** - see the [LICENSE](LICENSE) file for details.

Use of the website and software is additionally covered by the **[Terms of Use](https://strudel-gb.github.io/terms.html)** ([source](terms.html)), which set out the no-warranty and liability disclaimers, the volume/hearing warning, and the trademark position.

> **Not affiliated with Nintendo.** "Game Boy" and "Nintendo" are trademarks of their respective owners and are used here only descriptively, to identify the audio hardware whose behaviour this software emulates. This project contains no copyrighted ROM, BIOS, firmware or game assets.

Designed & Developed by **Aurélien Drouet** © 2026.
