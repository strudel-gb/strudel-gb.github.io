import { test, expect } from '@playwright/test';
import { openRepl, capture } from './helpers/audio-probe.js';

// The noise channel is an LFSR: assertions here check that the output is
// broadband (low pitch clarity) rather than tonal, and that the hardware
// parameters measurably change the sound.
test.describe('Noise Channel Test Suite (NS-01 to NS-12)', () => {
  test.beforeEach(async ({ page }) => {
    await openRepl(page);
  });

  test('[NS-01] Volume steps change output level', async ({ page }) => {
    const quiet = await capture(page, 'note("C4").s("gb").channel("noise").volume(3)');
    const loud = await capture(page, 'note("C4").s("gb").channel("noise").volume(15)');
    expect(quiet.noteCount).toBeGreaterThan(0);
    expect(loud.notes[0].rmsHead).toBeGreaterThan(quiet.notes[0].rmsHead * 1.5);
  });

  test('[NS-02] Speed modifier produces more hits', async ({ page }) => {
    const slow = await capture(page, 'note("C4").s("gb").channel("noise").envelope({initial:15,direction:-1,pace:1})');
    const fast = await capture(page, 'note("C4").s("gb").channel("noise").envelope({initial:15,direction:-1,pace:1}).fast(4)');
    expect(fast.noteCount).toBeGreaterThan(slow.noteCount * 1.5);
  });

  test('[NS-03] Panning routes to the correct hardware side', async ({ page }) => {
    const left = await capture(page, 'note("C4").s("gb").channel("noise").pan(-1)');
    const right = await capture(page, 'note("C4").s("gb").channel("noise").pan(1)');
    expect(left.rmsLeft).toBeGreaterThan(0.0005);
    expect(left.rmsRight).toBeLessThan(left.rmsLeft * 0.05);
    expect(right.rmsRight).toBeGreaterThan(0.0005);
    expect(right.rmsLeft).toBeLessThan(right.rmsRight * 0.05);
  });

  test('[NS-04] Output is noise, not a tone', async ({ page }) => {
    const noise = await capture(page, 'note("C4").s("gb").channel("noise")');
    const tone = await capture(page, 'note("C4").s("gb").channel("pulse1")');
    expect(noise.noteCount).toBeGreaterThan(0);
    expect(noise.notes[0].clarity, 'noise must not be periodic').toBeLessThan(0.5);
    expect(tone.notes[0].clarity, 'pulse must be periodic, for contrast').toBeGreaterThan(0.8);
  });

  test('[NS-05] 7-bit and 15-bit LFSR modes differ', async ({ page }) => {
    // The 7-bit LFSR repeats every 127 steps, giving an audibly tonal buzz;
    // 15-bit is much closer to white noise.
    const short = await capture(page, 'note("C4").s("gb").channel("noise").lfsr(7).frequency({shift:4,dividing:1})');
    const long = await capture(page, 'note("C4").s("gb").channel("noise").lfsr(15).frequency({shift:4,dividing:1})');
    expect(short.noteCount).toBeGreaterThan(0);
    expect(long.noteCount).toBeGreaterThan(0);
    expect(short.notes[0].clarity, '7-bit LFSR should be more periodic than 15-bit')
      .toBeGreaterThan(long.notes[0].clarity);
  });

  test('[NS-06] Polynomial clock changes the noise colour', async ({ page }) => {
    const bright = await capture(page, 'note("C4").s("gb").channel("noise").frequency({ shift: 1, dividing: 0 })');
    const dark = await capture(page, 'note("C4").s("gb").channel("noise").frequency({ shift: 10, dividing: 7 })');
    expect(bright.noteCount).toBeGreaterThan(0);
    expect(dark.noteCount).toBeGreaterThan(0);
    // A slower clock steps the LFSR less often: fewer transitions per second.
    const rate = (a) => a.notes[0].track.filter((t) => t.hz > 0).length;
    expect(rate(bright)).not.toEqual(rate(dark));
  });

  test('[NS-07] Decay envelope makes the hit quieter over time', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("noise").envelope({ initial: 15, direction: -1, pace: 2 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeLessThan(a.notes[0].rmsHead * 0.8);
  });

  test('[NS-08] Swell envelope makes the hit louder over time', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("noise").envelope({ initial: 0, direction: 1, pace: 3 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeGreaterThan(a.notes[0].rmsHead * 1.2);
  });

  test('[NS-09] Hardware length counter shortens the hit', async ({ page }) => {
    const short = await capture(page, 'note("C4").s("gb").channel("noise").length(5)');
    const long = await capture(page, 'note("C4").s("gb").channel("noise").length(60)');
    expect(short.noteCount).toBeGreaterThan(0);
    expect(long.noteCount).toBeGreaterThan(0);
    expect(short.notes[0].durationMs).toBeLessThan(long.notes[0].durationMs);
  });

  test('[NS-10] Drum presets sound and decay', async ({ page }) => {
    for (const preset of ['gb.kick', 'gb.snare', 'gb.hihat', 'gb.cymbal']) {
      const a = await capture(page, `note("C4").s("${preset}")`);
      expect(a.noteCount, `${preset} must sound`).toBeGreaterThan(0);
      expect(a.notes[0].rmsTail, `${preset} must decay`).toBeLessThan(a.notes[0].rmsHead);
    }
  });

  test('[NS-11] Drum presets are distinguishable from each other', async ({ page }) => {
    const kick = await capture(page, 'note("C4").s("gb.kick")');
    const hihat = await capture(page, 'note("C4").s("gb.hihat")');
    expect(Math.abs(kick.notes[0].durationMs - hihat.notes[0].durationMs) > 15 ||
      Math.abs(kick.notes[0].rms - hihat.notes[0].rms) > 0.005,
    'kick and hihat must not be identical').toBeTruthy();
  });

  test('[NS-12] Mute silences the channel', async ({ page }) => {
    const unmuted = await capture(page, 'note("C4").s("gb").channel("noise").mute(false)');
    const muted = await capture(page, 'note("C4").s("gb").channel("noise").mute(true)');
    expect(unmuted.peak).toBeGreaterThan(0.002);
    expect(muted.peak).toBeLessThan(unmuted.peak * 0.1);
  });
});
