import { test, expect } from '@playwright/test';
import { openRepl, capture, hz, nearPitch } from './helpers/audio-probe.js';

test.describe('Pulse 2 Channel Test Suite (P2-01 to P2-12)', () => {
  test.beforeEach(async ({ page }) => {
    await openRepl(page);
  });

  test('[P2-01] Volume steps change output level', async ({ page }) => {
    const quiet = await capture(page, 'note("E4").s("gb").channel("pulse2").volume(3)');
    const loud = await capture(page, 'note("E4").s("gb").channel("pulse2").volume(15)');
    expect(quiet.noteCount).toBeGreaterThan(0);
    expect(loud.notes[0].rmsHead).toBeGreaterThan(quiet.notes[0].rmsHead * 1.5);
  });

  test('[P2-02] Speed modifier packs more pitch changes into the same time', async ({ page }) => {
    const changes = (a) => a.notes.reduce((s, n) => s + Math.max(0, n.runs.length - 1), 0) + a.noteCount;
    const slow = await capture(page, 'note("E4 G4 B4 E5").s("gb").channel("pulse2")');
    const fast = await capture(page, 'note("E4 G4 B4 E5").s("gb").channel("pulse2").fast(3)');
    expect(changes(fast)).toBeGreaterThan(changes(slow) * 1.5);
  });

  test('[P2-03] Panning routes to the correct hardware side', async ({ page }) => {
    const left = await capture(page, 'note("E4").s("gb").channel("pulse2").pan(-1)');
    const right = await capture(page, 'note("E4").s("gb").channel("pulse2").pan(1)');
    expect(left.rmsLeft).toBeGreaterThan(0.001);
    expect(left.rmsRight).toBeLessThan(left.rmsLeft * 0.05);
    expect(right.rmsRight).toBeGreaterThan(0.001);
    expect(right.rmsLeft).toBeLessThan(right.rmsRight * 0.05);
  });

  test('[P2-04] Duty cycle changes the waveform', async ({ page }) => {
    const thin = await capture(page, 'note("E4").s("gb").channel("pulse2").duty(12.5)');
    const square = await capture(page, 'note("E4").s("gb").channel("pulse2").duty(50)');
    expect(thin.notes[0].duty).toBeLessThan(0.2);
    expect(square.notes[0].duty).toBeGreaterThan(0.42);
    expect(square.notes[0].duty).toBeLessThan(0.58);
  });

  test('[P2-05] Decay envelope makes the note quieter over time', async ({ page }) => {
    const a = await capture(page, 'note("E4").s("gb").channel("pulse2").envelope({ initial: 15, direction: -1, pace: 2 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeLessThan(a.notes[0].rmsHead * 0.8);
  });

  test('[P2-06] Swell envelope makes the note louder over time', async ({ page }) => {
    const a = await capture(page, 'note("E4").s("gb").channel("pulse2").envelope({ initial: 0, direction: 1, pace: 3 })');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail).toBeGreaterThan(a.notes[0].rmsHead * 1.2);
  });

  test('[P2-07] Hardware length counter shortens the note', async ({ page }) => {
    const short = await capture(page, 'note("E4").s("gb").channel("pulse2").length(5)');
    const long = await capture(page, 'note("E4").s("gb").channel("pulse2").length(60)');
    expect(short.notes[0].durationMs).toBeLessThan(long.notes[0].durationMs);
  });

  test('[P2-08] Hardware arpeggiator cycles through its offsets', async ({ page }) => {
    const arped = await capture(page, 'note("E4").s("gb").channel("pulse2").arpTable([0,3,7,12]).arpSpeed(18)', 2400);
    const steps = Math.max(...arped.notes.map((n) => n.runs.length), 0);
    expect(steps, 'arpeggio must step through several pitches').toBeGreaterThanOrEqual(3);
  });

  test('[P2-09] Preset instruments sound and are pitched correctly', async ({ page }) => {
    const a = await capture(page, 'note("E4").s("gb.pad").channel("pulse2")');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(nearPitch(a.notes[0].hz, hz('E4')), `expected E4, got ${a.notes[0].hz}Hz`).toBeTruthy();
  });

  test('[P2-10] Timbre tags actually change the duty cycle', async ({ page }) => {
    const nasal = await capture(page, 'note("E4").s("gb").channel("pulse2").tags("nasal")');
    const hollow = await capture(page, 'note("E4").s("gb").channel("pulse2").tags("hollow")');
    expect(nasal.notes[0].duty).toBeLessThan(0.2);
    expect(hollow.notes[0].duty).toBeGreaterThan(0.42);
  });

  test('[P2-11] Mute silences the channel', async ({ page }) => {
    const unmuted = await capture(page, 'note("E4").s("gb").channel("pulse2").mute(false)');
    const muted = await capture(page, 'note("E4").s("gb").channel("pulse2").mute(true)');
    expect(unmuted.peak).toBeGreaterThan(0.005);
    expect(muted.peak).toBeLessThan(unmuted.peak * 0.1);
  });

  test('[P2-12] Pulse 2 has no hardware sweep, unlike Pulse 1', async ({ page }) => {
    // Real hardware wires the sweep unit to channel 1 only. Asking pulse2 to
    // sweep must still play the note, at a steady pitch.
    const p2 = await capture(page, 'note("E4").s("gb").channel("pulse2").pitchSweep({ rate: 3, amount: 4 })');
    expect(p2.noteCount, 'the note must still sound').toBeGreaterThan(0);
    expect(nearPitch(p2.notes[0].hz, hz('E4')), `pitch must stay at E4, got ${p2.notes[0].hz}Hz`).toBeTruthy();
    expect(p2.notes[0].runs.length, 'pulse2 pitch must not sweep').toBeLessThanOrEqual(1);

    const p1 = await capture(page, 'note("E4").s("gb").channel("pulse1").pitchSweep({ rate: 3, amount: 4 })');
    expect(p1.notes[0].runs.length, 'pulse1 must sweep for contrast').toBeGreaterThan(1);
  });
});
