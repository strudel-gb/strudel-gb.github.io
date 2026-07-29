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

* `gb-processor.js`: The `AudioWorkletProcessor` running on the audio thread. Hosts the WASM APU and schedules register writes with sub-block accuracy.
* `strudel-gb-plugin.js`: Main-thread plugin that integrates with Strudel's pattern scheduler and registers the `'gb'` synth family.
* `build.js`: Bundling script that compiles the WASM binary and templates single-file JS assets.
* `index.html`, `playground.html`, `repl.html`, `guide.html`: Web application portals.
* `REFERENCE.md`: Complete API documentation of register parameters, presets, and composition recipes.

---

## Quick Start (Local Development)

1. Ensure you have [Node.js](https://nodejs.org) installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:8080` in your web browser.

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

## Documentation & References

* **[REFERENCE.md](REFERENCE.md)**: Full API parameters, channel definitions, and preset list.
* **[GameBoy APU Instrument Presets.md](GameBoy%20APU%20Instrument%20Presets.md)**: Hardware register specs and sound synthesis references.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** - see the [LICENSE](LICENSE) file for details.

Designed & Developed by **Aurélien Drouet** © 2026.
