# Strudel Game Boy Plugin Reference Guide

This reference guide explains how to use the `strudel-gb` plugin to write Game Boy music in real-time using [Strudel](https://strudel.cc/).

---

## Quick Start

To write Game Boy patterns in Strudel, you first load the plugin and then chain Game Boy specific parameters or instruments onto your patterns.

### Playing a Simple Note
```javascript
note("C4 D4 E4 G4")
  .s("gb")
```

---

## 1. Channels (`.channel()`)

The Game Boy APU contains **4 hardware channels**, each with unique sound characteristics and limitations. You can target specific channels using the `.channel(name)` parameter.

| Channel Name | Alias | Description |
| :--- | :--- | :--- |
| `"pulse1"` | `"p1"` | Pulse / Square wave with envelope and **pitch sweep** capabilities. |
| `"pulse2"` | `"p2"` | Pulse / Square wave with envelope (no sweep). |
| `"wave"` | `"w"` | Custom 4-bit wavetable channel. Great for basslines, custom waveforms, or speech/SFX. |
| `"noise"` | `"n"` | White and metallic noise generator. Used for percussion (kick, snare, hi-hat) and sound effects. |

---

## 2. High-Level Instruments & Drums (`.s()`)

Instead of configuring hardware channels manually, the plugin comes with predefined instruments and drum voices that map to specific channels and defaults:

### Synthesizer Instruments (Pulse 1 Channel - Supporting pitch sweeps)
*   **`gb`**: Default lead synth. Maps to `pulse1` with a `50%` duty cycle and moderate volume (`12`).
*   **`gb.lead`**: Piercing lead. Maps to `pulse1` with a `25%` duty cycle, full volume (`15`), and a standard decay envelope.
*   **`gb.square`**: Basic square wave. Maps to `pulse1` with a `50%` duty cycle and average envelope decay.
*   **`gb.pluck`**: Fast-decaying pluck. Maps to `pulse1` with a `12.5%` duty cycle and a very snappy envelope.
*   **`gb.siren`**: Alternating dual-tone siren sound utilizing authentic hardware pitch sweep.
*   **`gb.vibrato`**: Hardware-emulated vibrato sweep panned right.
*   **`gb.heavy-kick`**: Low-frequency punch using aggressive hardware pitch drop panned center.
*   **`gb.sci-fi-zap`**: Standard laser sweep panned left.
*   **`gb.deep-tom`**: Thick tom percussion on a 75% duty pulse wave.
*   **`gb.water-plop`**: Ascending rapid sweep imitating a bubble/water sound.
*   **`gb.slow-brass`**: A slow attack synth brass.
*   **`gb.harpsichord`**: Nasal, quick-decaying string emulation panned left.
*   **`gb.magic-chime`**: A bell chime that glides upwards panned right.

### Synthesizer Instruments (Pulse 2 Channel - No hardware pitch sweeps)
*   **`gb.pad`**: Slow, decaying background pad.
*   **`gb.soft-pad`**: Slow swelling soft pad panned left.
*   **`gb.mellow-flute`**: Soft, round flute sound.
*   **`gb.crunch-lead`**: Bright, woody lead melody instrument panned right.
*   **`gb.bell-pluck`**: Snappy bell pluck panned left.
*   **`gb.square-sub`**: Sustained square bass line.
*   **`gb.delay-trail`**: Auxiliary echo decay preset panned right.
*   **`gb.bowed-string`**: Swelling string instrument on a 75% duty cycle.
*   **`gb.arp-synth`**: Very fast decay lead suited for rapid arpeggios.
*   **`gb.pulse-organ`**: Slow-decaying chord-friendly organ/accordion panned left.
*   **`gb.drip`**: High, short droplet sound.

### Sound Effects (Pulse 1 Only)
*   **`gb.steel-drum`**: Snappy metallic steel drum pluck.
*   **`gb.alien`**: Sci-fi bubble sound (uses fast software arpeggiator).
*   **`gb.coin`**: Classic Mario coin chime (two fast notes in quick arpeggiation).
*   **`gb.jump`**: Classic Mario-like jump sound (rapid upward frequency sweep).
*   **`gb.balloon`**: Rubbery rising balloon squeak/bounce sound (uses upward sweep).
*   **`gb.bubble`**: Wet, short bubble pop sound (uses downward sweep).
*   **`gb.teleport`**: Sci-fi ascending tone sequence using the arpeggiator.
*   **`gb.powerup`**: Retro power-up arpeggio (sweeps up a major scale rapidly).
*   **`gb.death`**: Retro death fall arpeggio (sweeps down a chromatic/minor scale).
*   **`gb.laser-long`**: Sweeping pitch laser sound (longer decay).

### Custom Wave Synthesizers (Wave Channel)
*   **`gb.bass`**: Deep chiptune bass using a custom sawtooth table.
*   **`gb.sub-bass`**: Warm, deep custom sine wave bass.
*   **`gb.triangle`**: Pure, soft NES-style triangle lead panned left.
*   **`gb.organ`**: Classical drawbar organ sound using a custom harmonic wavetable.
*   **`gb.voice`**: Formant vocal "Oh" shape.
*   **`gb.saw-double`**: Two sawtooth periods inside one wave memory buffer, doubling the perceived pitch and adding aliasing grit.
*   **`gb.acid-pwm`**: A pulse-width modulation approximation creating an aggressive TB-303 style synth.
*   **`gb.slap-bass`**: Triangle wave truncated with long zero regions, simulating metal slap transient click.
*   **`gb.fuzz-guitar`**: High-distortive waveform simulating a clipping guitar fuzz pedal.

### Noise Percussion & FX Instruments (Noise Channel)
*   **`gb.kick`**: Deep white-noise thump.
*   **`gb.kick-noise`**: 7-bit metallic kick drum drone.
*   **`gb.snare`**: Classic punchy snare config.
*   **`gb.snare-tight`**: Snappy, rapid-decay snare.
*   **`gb.snare-lofi`**: Grit-rich snare drum with longer decay.
*   **`gb.hihat`**: Crisp closed hi-hat using ultra-high frequency clock setting.
*   **`gb.hihat-open`**: Long-decay open hi-hat.
*   **`gb.cymbal`**: Metallic 7-bit LFSR crash cymbals with long decay panned left.
*   **`gb.clap`**: Crisp hand clap burst.
*   **`gb.cowbell`**: Metallic 7-bit LFSR cowbell ring.
*   **`gb.rimshot`**: Short, clicky rimshot.
*   **`gb.shaker`**: Light noise-based shaker shimmer.
*   **`gb.tom`**: Noise-based tom thump.
*   **`gb.explosion`**: Slow-decaying deep explosion rumble.
*   **`gb.laser`**: Rapid metallic laser sweep.
*   **`gb.rumble`**: Deep, continuous low-frequency noise.
*   **`gb.engine`**: Persistent running engine noise.
*   **`gb.wind`**: Swelling background wind noise.

### Additional Chiptune Drums (Auto-routed)
*   **`gb.pulse-kick`**: Deep square wave kick with a pitch sweep (routes to `pulse1`).
*   **`gb.pulse-tom`**: Pitch-swept square tom drum (routes to `pulse1`).
*   **`gb.pulse-snare`**: Tight pitched square snare (routes to `pulse1`).
*   **`gb.wave-kick`**: Deep sine wave kick (routes to `wave`).

---

## 3. High-Level Tags (`.tags()`)

Tags are shortcuts to apply pre-configured parameters. They can be combined as comma-separated or space-separated strings, or arrays.

```javascript
// A snappy, nasal pulse lead
note("C4 E4 G4 C5").s("gb").tags("nasal, staccato")
```

Here is a full breakdown of the tags and what parameters they override:

### Pulse Timbre Tags (Duty Cycle)
*   **`nasal`**: Sets duty cycle to `12.5%` (very thin, reedy sound).
*   **`chiptune`** or **`bright`**: Sets duty cycle to `25%` (bright, classic NES/Game Boy sound).
*   **`hollow`** or **`warm`**: Sets duty cycle to `50%` (hollow, clarinet-like woodwind sound).
*   **`biting`**: Sets duty cycle to `75%` (inverted 25% duty cycle, biting texture).

### Pitch Sweep Modulation (Pulse 1 Only)
*   **`gliss-up`**: Sweeps pitch upwards dynamically.
*   **`gliss-down`**: Sweeps pitch downwards dynamically.
*   **`blip`**: Fast pitch drop at the start of the note (ideal for drum kicks or laser-like hits).
*   **`retro`**: Triggers a fast pitch sweep down and runs a basic major chord arpeggiator `[0, 4, 7, 12]`.

### Wavetable Timbre Tags (Wave Channel Only)
*   **`sine-smooth`**: Swaps the wavetable to a smooth **Sine** wave.
*   **`tri-soft`**: Swaps the wavetable to a soft **Triangle** wave (default).
*   **`saw-bright`**: Swaps the wavetable to a bright **Sawtooth** wave.
*   **`pulse-wave`**: Swaps the wavetable to a **Square** wave.
*   **`digi-buzzy`**: Swaps the wavetable to a custom digital buzzy wave shape (`FF00FF00FF00FF00FF00FF00FF00FF00`).
*   **`sub-octave`**: A quiet Sine wave (`volume: 4`) perfect for sub-bass.



### Envelope / Dynamic Tags (Shared)
*   **`staccato`**: Set note duration to be very short with a fast decay.
*   **`sustain`**: Set note duration to be long with a slow decay.
*   **`swell`**: Fades the volume in from zero (crescendo / attack swell).
*   **`ghost`**: Play very quietly with a quick decay.

---

## 4. Hardware Parameters Reference

For ultimate control, you can bypass instruments and tags and directly write raw hardware parameters to recreate authentic Game Boy effects.

### Pulse Parameters

*   **`duty(val)`**
    *   Set duty cycle percentage. Supported values: `12.5` (or `0.125`), `25` (or `0.25`), `50` (or `0.5`), `75` (or `0.75`).
*   **`pitchSweep(object)`** (Pulse 1 Only)
    *   Expressed as an object: `{ rate: R, amount: A }`.
    *   `rate` (0 to 7): Time between sweep steps (0 = disabled, 1 = fastest, 7 = slowest).
    *   `amount` (integer): Pitch shift amount. Positive numbers sweep up, negative numbers sweep down. Capped at +/- 7.

### Wave Parameters

*   **`waveTable(val)`** / **`wave(val)`**
    *   Set the active wavetable. Supported values:
        *   Predefined string: `"triangle"`, `"sawtooth"`, `"square"`, `"sine"`.
        *   Hex string: A 32-character hexadecimal string where each digit represents a sample value from `0` (lowest) to `F` (highest). Example: `"0123456789ABCDEFFEDCBA9876543210"`.
        *   Array: An array of 32 integers ranging from `0` to `15`.

### Noise Parameters

*   **`lfsr(val)`**
    *   Sets the shift register width.
    *   `15`: Standard white noise (ideal for drums, explosions, and wind).
    *   `7`: Tonal, metallic ringing noise (ideal for steel drums, robotic sounds, and lasers).
*   **`frequency(val)`**
    *   Sets the clock rate for the noise generator. Can be a raw byte integer or an object: `{ shift: S, dividing: D }`.
    *   `shift` (0 to 15): Frequency divider exponent (higher shift = lower pitch).
    *   `dividing` (0 to 7): Dividing ratio.

### Shared & Common Parameters

*   **`volume(val)`**
    *   Pulse & Noise: `0` (muted) to `15` (maximum volume).
    *   Wave Channel: `0` (muted), `1` (100%), `2` (50%), `3` (25%).
*   **`envelope(object)`**
    *   Direct control of the volume envelope. Expressed as: `{ initial: I, direction: D, pace: P }`.
    *   `initial` (0 to 15): Starting volume.
    *   `direction`: `"down"` / `-1` / `0` for decay; `"up"` / `1` for swell.
    *   `pace` (0 to 7): Time per envelope step (0 = disabled/infinite hold, 1 = fastest, 7 = slowest).
*   **`length(val)`**
    *   Sound length duration.
    *   Pulse/Noise: `0` to `63`.
    *   Wave: `0` to `255`.
*   **`pan(val)`**
    *   Pan position from `-1` (left) to `1` (right).
    *   `pan < -0.2`: Hard Left.
    *   `pan > 0.2`: Hard Right.
    *   `-0.2 <= pan <= 0.2`: Centered (Stereo).
*   **`mute(bool)`** / **`solo(bool)`**
    *   Set `mute(true)` to silence a channel, or `solo(true)` to mute all other channels.

---

## 5. Built-in Arpeggiator (`.arp()`, `.arpSpeed()`)

To simulate chords on a single-channel monophonic hardware voice, the plugin includes a built-in arpeggiator that runs directly on the audio thread.

*   **`arp(val)`**: Accepts an array of semitone offsets (e.g. `[0, 4, 7]`), a space/comma-separated string (e.g., `"0 3 7 10"`), or a single number (e.g. `12`).
*   **`arpSpeed(val)`**: Steps per second. Defaults to `18`.

```javascript
// Classic arpeggiated chiptune major triad chord
note("C4")
  .s("gb")
  .tags("chiptune")
  .arp([0, 4, 7])
  .arpSpeed(20)
```

---

## 6. Smart Channel Routing (`.autoChannels()`)

The plugin supports dynamic, smart voice allocation. By appending `.autoChannels()` to your pattern or stack, the plugin automatically routes notes to the appropriate Game Boy hardware channels:
*   **Noise Channel (`noise`):** Any drum instruments (like `gb.kick`, `gb.snare`, `gb.hihat`) or notes containing drum tags are routed here.
*   **Wave Channel (`wave`):** Low-pitched bass notes (below MIDI 57 / A3) are automatically routed to the Wave channel for clean sub-bass.
*   **Pulse Channels (`pulse1` & `pulse2`):** Melody and harmony notes are distributed to the two Pulse channels. If Pulse 1 is busy playing a note, the plugin automatically plays the next note on Pulse 2, enabling seamless **2-voice polyphony** (chords) on square waves. If both are busy, it performs voice stealing on Pulse 1.

```javascript
stack(
  // Melody (high notes) -> dynamically shared between Pulse 1 & Pulse 2
  note("C5 E5 G5 A5").s("gb.lead").fast(2),
  note("E4 G4 C5 G4").s("gb.pluck").fast(3),
  
  // Bassline (low notes) -> automatically routes to Wave
  note("C2 G2").s("gb.bass"),
  
  // Drums -> automatically route to Noise
  note("C4").s("gb.kick")
)
.autoChannels()
```

---

## 7. Advanced Composition Examples

### 1. Dual-Pulse Stereo Counterpoint
Run two independent pulse waves panned opposite ways to create a rich stereo space:
```javascript
stack(
  note("C4 E4 G4 B4").s("gb.lead").pan(-0.8),
  note("E3 G3 B3 D4").s("gb.pad").pan(0.8).tags("nasal")
)
```

### 2. Custom Wavetable Bassline
Define a custom, gritty waveform for the wave channel:
```javascript
note("C2 C3 G2 Bb2")
  .s("gb.bass")
  .wave("00112233445566778899AABBCCDDEEFF")
  .volume(12) // 100% volume
```

### 3. Game Boy Drum Loop
Synthesize chiptune drums by stacking drum instruments (which automatically route to the correct noise, pulse, and wave channels):
```javascript
stack(
  // Kick on 1 and 3, Snare on 2 and 4
  note("C4").s("gb.kick").struct("1 0 0 0 0 0 0 0"),
  note("C4").s("gb.snare").struct("0 0 0 0 1 0 0 0"),
  // Constant closed high-hats
  note("C4").s("gb.hihat").struct("1 1 1 1 1 1 1 1")
)
```

---

## 8. Developer & Debugging Tools

The plugin features built-in developer tools designed to visualize the real-time state of the Game Boy APU and audit patterns for hardware authenticity.

### Real-Time Visualizer
Both the APU Hardware Playground and the Local REPL feature a real-time visualizer dashboard that displays:
*   **Active Channels:** Highlights which of the 4 hardware channels (`P1`, `P2`, `WV`, `NS`) are currently generating sound.
*   **Active Frequencies & Note Names:** Identifies the precise note (e.g. `C4`, `F#2`) and the current frequency in Hertz.
*   **Volume Meters:** Renders green LCD volume progress bars indicating envelope decay and current amplitude (0–15).
*   **Timbres:** Shows duty cycle percentages, active wavetable types, or Noise divider settings.

### Strict Game Boy Mode
An toggle option that enforces authentic physical hardware limitations. When enabled, the plugin checks all incoming trigger parameters and logs colorful diagnostic warnings if the pattern violates Game Boy hardware constraints:

1.  **Polyphony Violation:** Warns when multiple notes overlap on a single monophonic channel.
2.  **Out-of-Bounds Frequency:** Warns when frequency is outside authentic ranges:
    *   Pulse Channels: $64\text{ Hz} \le f \le 131,072\text{ Hz}$
    *   Wave Channel: $32\text{ Hz} \le f \le 65,536\text{ Hz}$
3.  **Intermediate Panning:** Warns if panning values are between discrete values (only hard-left, hard-right, center, or off are supported).
4.  **Unsupported Duty Cycles:** Warns if a duty cycle is not exactly $12.5\%$, $25\%$, $50\%$, or $75\%$.
5.  **Continuous Wave Volumes:** Warns if the Wave volume is continuous (only $0\%$, $25\%$, $50\%$, $100\%$ are supported).
6.  **Invalid LFSR widths:** Warns if the Noise channel width is not $7\text{-bit}$ or $15\text{-bit}$.

