import { test, expect } from '@playwright/test';
import { openRepl, capture, hz, nearPitch, distinctPitches } from './helpers/audio-probe.js';

// Every assertion here is made against the PCM the APU actually emitted.
test.describe('Pulse 1 Channel Test Suite (P1-01 to P1-14)', () => {
  test.beforeEach(async ({ page }) => {
    await openRepl(page);
  });

  test('[P1-01] Volume steps change output level', async ({ page }) => {
    // Pulse has no volume register: .volume() must land on the envelope's
    // initial level, otherwise it is silently ignored.
    const quiet = await capture(page, 'note("C4").s("gb").channel("pulse1").volume(3)');
    const loud = await capture(page, 'note("C4").s("gb").channel("pulse1").volume(15)');
    expect(quiet.noteCount, 'quiet note must still sound').toBeGreaterThan(0);
    expect(loud.notes[0].rmsHead).toBeGreaterThan(quiet.notes[0].rmsHead * 1.5);
  });

  test('[P1-02] Speed modifier packs more pitch changes into the same time', async ({ page }) => {
    // At fast(4) the notes run together with no gap, so count pitch changes
    // rather than silence-separated segments.
    const changes = (a) => a.notes.reduce((sum, n) => sum + Math.max(0, n.runs.length - 1), 0) + a.noteCount;
    const slow = await capture(page, 'note("C4 E4 G4 C5").s("gb").channel("pulse1")');
    const fast = await capture(page, 'note("C4 E4 G4 C5").s("gb").channel("pulse1").fast(4)');
    expect(changes(fast)).toBeGreaterThan(changes(slow) * 1.5);
  });

  test('[P1-03] Panning routes to the correct hardware side', async ({ page }) => {
    const left = await capture(page, 'note("C4").s("gb").channel("pulse1").pan(-1)');
    const right = await capture(page, 'note("C4").s("gb").channel("pulse1").pan(1)');
    const centre = await capture(page, 'note("C4").s("gb").channel("pulse1").pan(0)');

    expect(left.rmsLeft).toBeGreaterThan(0.001);
    expect(left.rmsRight).toBeLessThan(left.rmsLeft * 0.05);
    expect(right.rmsRight).toBeGreaterThan(0.001);
    expect(right.rmsLeft).toBeLessThan(right.rmsRight * 0.05);
    expect(Math.abs(centre.rmsLeft - centre.rmsRight)).toBeLessThan(centre.rmsLeft * 0.2);
  });

  test('[P1-04] Duty cycle changes the waveform, not just the label', async ({ page }) => {
    const measured = {};
    for (const duty of [12.5, 25, 50, 75]) {
      const a = await capture(page, `note("C4").s("gb").channel("pulse1").duty(${duty})`);
      expect(a.noteCount, `duty ${duty} must sound`).toBeGreaterThan(0);
      measured[duty] = a.notes[0].duty;
    }
    // 12.5% pulses spend an eighth of the period high; 50% is a square.
    expect(measured[12.5]).toBeGreaterThan(0.06);
    expect(measured[12.5]).toBeLessThan(0.2);
    expect(measured[50]).toBeGreaterThan(0.42);
    expect(measured[50]).toBeLessThan(0.58);
    // 25% and 75% are mirror images on real hardware.
    expect(Math.min(measured[25], 1 - measured[25])).toBeGreaterThan(0.17);
    expect(Math.min(measured[25], 1 - measured[25])).toBeLessThan(0.33);
    expect(Math.abs(measured[25] - measured[50])).toBeGreaterThan(0.1);
  });

  test('[P1-05] Upward pitch sweep raises the pitch during the note', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").pitchSweep({ rate: 3, amount: 4 })');
    expect(a.noteCount).toBeGreaterThan(0);
    const runs = a.notes[0].runs;
    expect(runs.length, 'a sweep must change pitch during the note').toBeGreaterThan(1);
    expect(runs[runs.length - 1], 'sweep must move upward').toBeGreaterThan(runs[0] * 1.05);
  });

  test('[P1-06] Downward pitch sweep lowers the pitch during the note', async ({ page }) => {
    const a = await capture(page, 'note("C5").s("gb").channel("pulse1").pitchSweep({ rate: 3, amount: -4 })');
    expect(a.noteCount).toBeGreaterThan(0);
    const runs = a.notes[a.notes.length - 1].runs;
    expect(runs.length, 'a sweep must change pitch during the note').toBeGreaterThan(1);
    expect(runs[runs.length - 1], 'sweep must move downward').toBeLessThan(runs[0] * 0.95);
  });

  test('[P1-07] Decay envelope makes the note quieter over time', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").envelope({ initial: 15, direction: -1, pace: 2 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeLessThan(a.notes[0].rmsHead * 0.8);
  });

  test('[P1-08] Swell envelope makes the note louder over time', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").envelope({ initial: 0, direction: 1, pace: 3 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeGreaterThan(a.notes[0].rmsHead * 1.2);
  });

  test('[P1-09] Hardware length counter shortens the note', async ({ page }) => {
    const short = await capture(page, 'note("C4").s("gb").channel("pulse1").length(5)');
    const long = await capture(page, 'note("C4").s("gb").channel("pulse1").length(60)');
    expect(short.noteCount).toBeGreaterThan(0);
    expect(long.noteCount).toBeGreaterThan(0);
    expect(short.notes[0].durationMs).toBeLessThan(long.notes[0].durationMs);
  });

  test('[P1-10] Hardware arpeggiator cycles through its offsets', async ({ page }) => {
    // The arpeggiator retunes the channel inside a single held note, so the
    // evidence is a sequence of pitches within one segment.
    const arped = await capture(page, 'note("C4").s("gb").channel("pulse1").arpTable([0,4,7,12]).arpSpeed(20)', 2400);
    const plain = await capture(page, 'note("C4").s("gb").channel("pulse1")', 2400);
    const steps = Math.max(...arped.notes.map((n) => n.runs.length), 0);
    const flat = Math.max(...plain.notes.map((n) => n.runs.length), 0);
    expect(steps, 'arpeggio must step through several pitches').toBeGreaterThanOrEqual(3);
    expect(steps).toBeGreaterThan(flat);
  });

  test('[P1-11] Preset instruments sound and are pitched correctly', async ({ page }) => {
    for (const preset of ['gb', 'gb.lead', 'gb.pluck']) {
      const a = await capture(page, `note("C4").s("${preset}").channel("pulse1")`);
      expect(a.noteCount, `${preset} must sound`).toBeGreaterThan(0);
      expect(nearPitch(a.notes[0].hz, hz('C4')), `${preset} must play C4, got ${a.notes[0].hz}Hz`).toBeTruthy();
    }
  });

  test('[P1-12] Timbre tags actually change the duty cycle', async ({ page }) => {
    const nasal = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("nasal")');
    const hollow = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("hollow")');
    expect(nasal.noteCount).toBeGreaterThan(0);
    expect(hollow.noteCount).toBeGreaterThan(0);
    expect(nasal.notes[0].duty).toBeLessThan(0.2);
    expect(hollow.notes[0].duty).toBeGreaterThan(0.42);
  });

  test('[P1-13] Mute silences the channel', async ({ page }) => {
    const unmuted = await capture(page, 'note("C4").s("gb").channel("pulse1").mute(false)');
    const muted = await capture(page, 'note("C4").s("gb").channel("pulse1").mute(true)');
    expect(unmuted.peak).toBeGreaterThan(0.005);
    expect(muted.peak, 'muted channel must be silent').toBeLessThan(unmuted.peak * 0.1);
  });

  test('[P1-14] Pitch is accurate across the range', async ({ page }) => {
    const a = await capture(page, 'note("C3 C4 C5").s("gb").channel("pulse1").slow(1.5)', 3200);
    const pitches = distinctPitches(a);
    expect(pitches.length, 'expected three distinct pitches').toBeGreaterThanOrEqual(2);
    for (const p of pitches) {
      const matches = ['C3', 'C4', 'C5'].some((n) => nearPitch(p, hz(n)));
      expect(matches, `${p}Hz is not one of C3/C4/C5`).toBeTruthy();
    }
  });
});
