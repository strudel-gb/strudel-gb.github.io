import { test, expect } from '@playwright/test';
import { openRepl, capture, hz, nearPitch, distinctPitches } from './helpers/audio-probe.js';

test.describe('Wave Channel Test Suite (WV-01 to WV-11)', () => {
  test.beforeEach(async ({ page }) => {
    await openRepl(page);
  });

  test('[WV-01] Hardware discrete volume levels', async ({ page }) => {
    // Wave volume is a 2-bit shifter: 100% / 50% / 25% / mute.
    const full = await capture(page, 'note("C3").s("gb").channel("wave").volume(15)');
    const quarter = await capture(page, 'note("C3").s("gb").channel("wave").volume(4)');
    const off = await capture(page, 'note("C3").s("gb").channel("wave").volume(0)');
    expect(full.noteCount).toBeGreaterThan(0);
    expect(full.peak).toBeGreaterThan(quarter.peak * 1.4);
    expect(off.peak, 'volume 0 must mute the wave channel').toBeLessThan(full.peak * 0.1);
  });

  test('[WV-02] Speed modifier packs more notes into the same time', async ({ page }) => {
    const changes = (a) => a.notes.reduce((s, n) => s + Math.max(0, n.runs.length - 1), 0) + a.noteCount;
    const slow = await capture(page, 'note("C3 E3 G3 C4").s("gb").channel("wave").volume(15)');
    const fast = await capture(page, 'note("C3 E3 G3 C4").s("gb").channel("wave").volume(15).fast(4)');
    expect(changes(fast)).toBeGreaterThan(changes(slow) * 1.5);
  });

  test('[WV-03] Panning routes to the correct hardware side', async ({ page }) => {
    const left = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).pan(-1)');
    const right = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).pan(1)');
    expect(left.rmsLeft).toBeGreaterThan(0.0005);
    expect(left.rmsRight).toBeLessThan(left.rmsLeft * 0.05);
    expect(right.rmsRight).toBeGreaterThan(0.0005);
    expect(right.rmsLeft).toBeLessThan(right.rmsRight * 0.05);
  });

  test('[WV-04] Standard wavetable shapes produce different waveforms', async ({ page }) => {
    const shapes = {};
    for (const shape of ['sine', 'triangle', 'sawtooth', 'square']) {
      const a = await capture(page, `note("C3").s("gb").channel("wave").wave("${shape}").volume(15)`);
      expect(a.noteCount, `${shape} must sound`).toBeGreaterThan(0);
      expect(nearPitch(a.notes[0].hz, hz('C3')), `${shape} must play C3, got ${a.notes[0].hz}Hz`).toBeTruthy();
      shapes[shape] = a.notes[0].crest;
    }
    // Crest factor (peak/RMS) is the shape fingerprint: ~1.0 square, ~1.41
    // sine, ~1.73 for any linear ramp. Triangle and sawtooth share a crest
    // factor by definition, so they are not compared against each other.
    expect(shapes.square).toBeLessThan(1.25);
    expect(shapes.sine).toBeGreaterThan(1.3);
    expect(shapes.sine).toBeLessThan(1.65);
    expect(shapes.triangle).toBeGreaterThan(1.6);
    expect(shapes.sawtooth).toBeGreaterThan(1.6);
    expect(Math.abs(shapes.square - shapes.sine), 'square and sine must differ').toBeGreaterThan(0.2);
  });

  test('[WV-05] Custom hexadecimal wavetable plays', async ({ page }) => {
    const a = await capture(page, 'note("C3").s("gb").channel("wave").wave("0123456789ABCDEFFEDCBA9876543210").volume(15)');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(nearPitch(a.notes[0].hz, hz('C3')), `expected C3, got ${a.notes[0].hz}Hz`).toBeTruthy();
  });

  test('[WV-06] Custom array wavetable plays', async ({ page }) => {
    const a = await capture(page, 'note("C3").s("gb").channel("wave").wave([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0]).volume(15)');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(nearPitch(a.notes[0].hz, hz('C3')), `expected C3, got ${a.notes[0].hz}Hz`).toBeTruthy();
  });

  test('[WV-07] Hardware length counter shortens the note', async ({ page }) => {
    const short = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).length(20)');
    const long = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).length(200)');
    expect(short.noteCount).toBeGreaterThan(0);
    expect(long.noteCount).toBeGreaterThan(0);
    expect(short.notes[0].durationMs).toBeLessThan(long.notes[0].durationMs);
  });

  test('[WV-08] Hardware arpeggiator cycles through its offsets', async ({ page }) => {
    const a = await capture(page, 'note("C3").s("gb").channel("wave").arpTable([0,3,7]).arpSpeed(12).volume(15)', 2400);
    const steps = Math.max(...a.notes.map((n) => n.runs.length), 0);
    expect(steps, 'arpeggio must step through several pitches').toBeGreaterThanOrEqual(2);
  });

  test('[WV-09] Wave presets sound and are pitched correctly', async ({ page }) => {
    for (const preset of ['gb.bass', 'gb.triangle', 'gb.organ']) {
      const a = await capture(page, `note("C3").s("${preset}").channel("wave")`);
      expect(a.noteCount, `${preset} must sound`).toBeGreaterThan(0);
      expect(nearPitch(a.notes[0].hz, hz('C3')), `${preset} must play C3, got ${a.notes[0].hz}Hz`).toBeTruthy();
    }
  });

  test('[WV-10] Wavetable tags select a wavetable', async ({ page }) => {
    const smooth = await capture(page, 'note("C3").s("gb").channel("wave").tags("sine-smooth").volume(15)');
    const buzzy = await capture(page, 'note("C3").s("gb").channel("wave").tags("digi-buzzy").volume(15)');
    expect(smooth.noteCount).toBeGreaterThan(0);
    expect(buzzy.noteCount).toBeGreaterThan(0);
    expect(Math.abs(smooth.notes[0].crest - buzzy.notes[0].crest), 'tags must change the waveform')
      .toBeGreaterThan(0.2);
  });

  test('[WV-11] Mute silences the channel', async ({ page }) => {
    const unmuted = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).mute(false)');
    const muted = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).mute(true)');
    expect(unmuted.peak).toBeGreaterThan(0.002);
    expect(muted.peak).toBeLessThan(unmuted.peak * 0.1);
  });

  test('[WV-12] Wave channel tracks pitch across octaves', async ({ page }) => {
    const a = await capture(page, 'note("C2 C3 C4").s("gb").channel("wave").volume(15).slow(1.5)', 3200);
    const pitches = distinctPitches(a);
    expect(pitches.length).toBeGreaterThanOrEqual(2);
    for (const p of pitches) {
      expect(['C2', 'C3', 'C4'].some((n) => nearPitch(p, hz(n))), `${p}Hz is not C2/C3/C4`).toBeTruthy();
    }
  });
});
