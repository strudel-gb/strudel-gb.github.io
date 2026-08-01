/**
 * Audio probe for the Game Boy APU.
 *
 * The suites below assert on the *sound the APU actually produces*, not on UI
 * text. The probe taps the raw stereo output of every worklet node, records it
 * while a pattern plays, and reports measurements: note onsets, pitch, duty
 * ratio, stereo balance, envelope shape and tonal-vs-noise character.
 *
 * Why this exists: the previous suites asserted `toContainText('P1')` against
 * the visualizer, but `P1` is a static label in the markup — the assertion
 * passed even when the channel was completely silent.
 */

/** Install the recorder into the page. Call once, after the APU is ready. */
export async function installProbe(page) {
  await page.evaluate(() => {
    if (window.__gbProbe) return;
    const ctx = window.gbAudioContext;

    // ScriptProcessor gives gapless capture; an AnalyserNode only samples
    // whatever happens to be in its buffer when you poll it.
    const sp = ctx.createScriptProcessor(2048, 2, 2);
    let recording = false;
    let chunksL = [];
    let chunksR = [];

    sp.onaudioprocess = (e) => {
      if (!recording) return;
      chunksL.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      chunksR.push(new Float32Array(e.inputBuffer.getChannelData(1)));
    };

    // Keep the node pulled without adding anything audible.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    sp.connect(sink);
    sink.connect(ctx.destination);

    const connectAll = () => {
      (window.gbNode.nodes || []).forEach((n) => {
        try { n.connect(sp); } catch { /* already connected */ }
      });
    };

    const merge = (chunks) => {
      let len = 0;
      for (const c of chunks) len += c.length;
      const out = new Float32Array(len);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    };

    const rms = (buf, from, to) => {
      const a = from || 0;
      const b = to === undefined ? buf.length : to;
      if (b <= a) return 0;
      let sum = 0;
      for (let i = a; i < b; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / (b - a));
    };

    // Autocorrelation pitch detection. Returns { hz, clarity }: clarity is the
    // normalised correlation peak, which also separates tones (high) from the
    // LFSR noise channel (low).
    const pitchOf = (buf, from, to, sampleRate) => {
      const a = from || 0;
      const b = Math.min(to === undefined ? buf.length : to, a + 4096);
      const n = b - a;
      if (n < 512) return { hz: 0, clarity: 0 };

      const slice = new Float32Array(n);
      let mean = 0;
      for (let i = 0; i < n; i++) mean += buf[a + i];
      mean /= n;
      for (let i = 0; i < n; i++) slice[i] = buf[a + i] - mean;

      let zero = 0;
      for (let i = 0; i < n; i++) zero += slice[i] * slice[i];
      if (zero === 0) return { hz: 0, clarity: 0 };

      const minLag = Math.max(2, Math.floor(sampleRate / 5000));
      const maxLag = Math.min(Math.floor(sampleRate / 40), Math.floor(n / 2));
      if (maxLag <= minLag) return { hz: 0, clarity: 0 };

      const corr = new Float32Array(maxLag + 1);
      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < n - lag; i++) sum += slice[i] * slice[i + lag];
        corr[lag] = sum / (zero * (1 - lag / n) + 1e-12);
      }

      let max = -Infinity;
      for (let lag = minLag; lag <= maxLag; lag++) if (corr[lag] > max) max = corr[lag];
      if (max <= 0) return { hz: 0, clarity: 0 };

      // Take the SHORTEST lag that is a local peak within 90% of the global
      // maximum. Taking the global maximum outright reports a subharmonic
      // (a square wave correlates just as well at 2x and 3x its period).
      const threshold = max * 0.9;
      let bestLag = 0;
      for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (corr[lag] >= threshold && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
          bestLag = lag;
          break;
        }
      }
      if (!bestLag) return { hz: 0, clarity: 0 };

      const y0 = corr[bestLag - 1], y1 = corr[bestLag], y2 = corr[bestLag + 1];
      const denom = 2 * (2 * y1 - y0 - y2);
      const shift = denom !== 0 ? (y2 - y0) / denom : 0;
      const lag = bestLag + Math.max(-1, Math.min(1, shift));

      return { hz: sampleRate / lag, clarity: Math.max(0, Math.min(1, y1)) };
    };

    // Fraction of samples in the upper half of the waveform's range: for a
    // pulse wave this is the duty cycle (25% and 75% are mirror images, so
    // callers usually compare min(r, 1-r)).
    // Peak-to-RMS ratio: ~1.0 for a square, ~1.41 for a sine, ~1.73 for a
    // ramp. Distinguishes wavetable shapes, which all sit above their midpoint
    // for roughly half the period and so share the same high/low ratio.
    const crestOf = (buf, from, to) => {
      const a = from || 0;
      const b = to === undefined ? buf.length : to;
      if (b <= a) return 0;
      let peak = 0, sum = 0;
      for (let i = a; i < b; i++) {
        const v = buf[i];
        if (Math.abs(v) > peak) peak = Math.abs(v);
        sum += v * v;
      }
      const r = Math.sqrt(sum / (b - a));
      return r > 0 ? peak / r : 0;
    };

    const highRatio = (buf, from, to) => {
      const a = from || 0;
      const b = to === undefined ? buf.length : to;
      if (b <= a) return 0;
      let lo = Infinity, hi = -Infinity;
      for (let i = a; i < b; i++) { if (buf[i] < lo) lo = buf[i]; if (buf[i] > hi) hi = buf[i]; }
      if (hi - lo < 1e-6) return 0;
      const mid = (hi + lo) / 2;
      let high = 0;
      for (let i = a; i < b; i++) if (buf[i] > mid) high++;
      return high / (b - a);
    };

    // Pitch over time inside one note: an arpeggio or a pitch sweep changes
    // pitch mid-note, so a single pitch per note cannot see either.
    const trackOf = (buf, a, b, sampleRate) => {
      const step = Math.floor(sampleRate * 0.045);
      const out = [];
      for (let i = a; i + step <= b; i += step) {
        const p = pitchOf(buf, i, i + step, sampleRate);
        out.push({
          ms: Math.round(((i - a) / sampleRate) * 1000),
          hz: Math.round(p.hz),
          clarity: Math.round(p.clarity * 100) / 100,
        });
      }
      return out;
    };

    // Collapse a track into the sequence of pitches actually held, in order.
    const runsOf = (track) => {
      const runs = [];
      let lastSemi = null;
      for (const t of track) {
        if (!t.hz || t.clarity < 0.6) continue;
        const semi = Math.round(12 * Math.log2(t.hz / 440));
        if (semi !== lastSemi) { runs.push(t.hz); lastSemi = semi; }
      }
      return runs;
    };

    window.__gbProbe = {
      start() {
        chunksL = []; chunksR = [];
        connectAll();
        recording = true;
      },
      stop() { recording = false; },
      analyze(opts) {
        const o = opts || {};
        const sr = ctx.sampleRate;
        const L = merge(chunksL);
        const R = merge(chunksR);
        const n = Math.min(L.length, R.length);
        const mono = new Float32Array(n);
        for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) / 2;

        let peak = 0;
        for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));

        // Segment into notes on a short-term energy envelope.
        const win = Math.floor(sr * 0.005);
        const gate = Math.max(peak * (o.gate || 0.12), 1e-4);
        const notes = [];
        let inNote = false;
        let start = 0;
        for (let i = 0; i + win < n; i += win) {
          const loud = rms(mono, i, i + win) > gate;
          if (loud && !inNote) { inNote = true; start = i; }
          else if (!loud && inNote) {
            inNote = false;
            if (i - start > sr * 0.012) notes.push([start, i]);
          }
        }
        if (inNote && n - start > sr * 0.012) notes.push([start, n]);

        const described = notes.slice(0, 32).map(([a, b]) => {
          const len = b - a;
          const body = [a + Math.floor(len * 0.05), b - Math.floor(len * 0.05)];
          const p = pitchOf(mono, body[0], body[1], sr);
          const firstHalf = pitchOf(mono, a, a + Math.floor(len / 2), sr);
          const secondHalf = pitchOf(mono, a + Math.floor(len / 2), b, sr);
          const q = Math.floor(len / 4);
          const track = trackOf(mono, body[0], body[1], sr);
          return {
            track,
            runs: runsOf(track),
            startMs: Math.round((a / sr) * 1000),
            durationMs: Math.round((len / sr) * 1000),
            hz: Math.round(p.hz * 10) / 10,
            clarity: Math.round(p.clarity * 100) / 100,
            hzStart: Math.round(firstHalf.hz),
            hzEnd: Math.round(secondHalf.hz),
            duty: Math.round(highRatio(mono, body[0], body[1]) * 1000) / 1000,
            crest: Math.round(crestOf(mono, body[0], body[1]) * 1000) / 1000,
            rms: Math.round(rms(mono, a, b) * 10000) / 10000,
            rmsHead: Math.round(rms(mono, a, a + q) * 10000) / 10000,
            rmsTail: Math.round(rms(mono, b - q, b) * 10000) / 10000,
            rmsLeft: Math.round(rms(L, a, b) * 10000) / 10000,
            rmsRight: Math.round(rms(R, a, b) * 10000) / 10000,
          };
        });

        return {
          sampleRate: sr,
          capturedMs: Math.round((n / sr) * 1000),
          peak: Math.round(peak * 10000) / 10000,
          rmsLeft: Math.round(rms(L) * 10000) / 10000,
          rmsRight: Math.round(rms(R) * 10000) / 10000,
          noteCount: notes.length,
          notes: described,
        };
      },
    };
  });
}

/**
 * Open repl.html, wait for the APU, install the probe and warm the audio graph.
 *
 * Superdough initialises lazily on the first play, so the first pattern after
 * page load is swallowed. Warming up here keeps that startup quirk out of the
 * individual tests: every capture that follows starts from a live graph, and a
 * silent capture then means a real defect.
 */
export async function openRepl(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/repl.html');
  await page.waitForFunction(() => !!window.gbNode && !!window.gbAudioContext, null, { timeout: 25000 });
  await installProbe(page);

  for (let attempt = 0; attempt < 4; attempt++) {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1")', 1200);
    if (a.peak > 0.001) return errors;
  }
  throw new Error('Audio graph never produced sound during warm-up — the APU is not running');
}

/** Play `code` for `ms`, then return the analysis of what the APU emitted. */
export async function capture(page, code, ms = 1800) {
  await page.evaluate((c) => {
    document.querySelector('strudel-editor').editor.setCode(c);
  }, code);
  await page.evaluate(() => window.__gbProbe.start());
  await page.locator('#btnPlay').click();
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__gbProbe.stop());
  await page.locator('#btnStop').click();
  const result = await page.evaluate(() => window.__gbProbe.analyze());
  await page.waitForTimeout(120);
  return result;
}

/** MIDI-style helper: expected frequency of a note name, for assertions. */
export function hz(note) {
  const m = String(note).trim().match(/^([A-Ga-g])([#bsf]?)(-?\d+)$/);
  if (!m) throw new Error('bad note ' + note);
  const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let midi = offsets[m[1].toUpperCase()] + (parseInt(m[3], 10) + 1) * 12;
  if (m[2] === '#' || m[2] === 's') midi += 1;
  else if (m[2] === 'b' || m[2] === 'f') midi -= 1;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** True when `actual` is within `cents` of `expected`. */
export function nearPitch(actual, expected, cents = 60) {
  if (!actual || !expected) return false;
  return Math.abs(1200 * Math.log2(actual / expected)) <= cents;
}

/** Pitches present in a capture, deduplicated to the nearest semitone. */
export function distinctPitches(analysis, minClarity = 0.5) {
  const seen = new Map();
  for (const n of analysis.notes) {
    if (n.clarity < minClarity || !n.hz) continue;
    const semis = Math.round(12 * Math.log2(n.hz / 440));
    if (!seen.has(semis)) seen.set(semis, n.hz);
  }
  return [...seen.values()].sort((a, b) => a - b);
}
