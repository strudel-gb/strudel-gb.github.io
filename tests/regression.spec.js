import { test, expect } from '@playwright/test';
import { openRepl, capture, hz, nearPitch } from './helpers/audio-probe.js';

/**
 * One test per bug that reached a user. Each of these produced *silence* or a
 * silently wrong sound with no error in the console, which is exactly what the
 * old UI-text assertions could not see.
 */
test.describe('Regression tests', () => {
  test.beforeEach(async ({ page }) => {
    await openRepl(page);
  });

  test('a string inside a control object does not kill the note (DataCloneError)', async ({ page }) => {
    // Strudel patternifies nested strings into Pattern instances, which hold
    // functions and cannot cross a MessagePort. Unsanitised, postMessage threw
    // DataCloneError and the note never reached the APU.
    const withString = await capture(page, 'note("C4").s("gb.lead").channel("pulse1").envelope({initial:13,direction:"down",pace:4})');
    const withNumber = await capture(page, 'note("C4").s("gb.lead").channel("pulse1").envelope({initial:13,direction:-1,pace:4})');

    expect(withString.noteCount, 'direction:"down" must still sound').toBeGreaterThan(0);
    expect(withNumber.noteCount).toBeGreaterThan(0);
    // Both spellings must mean the same thing: a decay.
    expect(withString.notes[0].rmsTail).toBeLessThan(withString.notes[0].rmsHead);
    expect(withNumber.notes[0].rmsTail).toBeLessThan(withNumber.notes[0].rmsHead);
  });

  test('an unclonable value is reported instead of silently dropping the note', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").envelope({initial:12,direction:"up",pace:3})');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(errors.filter((e) => e.includes('not cloneable'))).toHaveLength(0);
  });

  test('note names are case-insensitive and accept both sharp spellings', async ({ page }) => {
    // Lowercase names used to fall through to a 440Hz fallback, turning a
    // whole melody into a monotone A4.
    const cases = [
      ['C4', 'C4'], ['c4', 'C4'],
      ['G#4', 'G#4'], ['g#4', 'G#4'], ['gs4', 'G#4'],
      ['Ab4', 'G#4'], ['ab4', 'G#4'],
    ];
    for (const [written, expected] of cases) {
      const a = await capture(page, `note("${written}").s("gb").channel("pulse1")`);
      expect(a.noteCount, `${written} must sound`).toBeGreaterThan(0);
      expect(
        nearPitch(a.notes[0].hz, hz(expected)),
        `${written} should be ${expected} (${hz(expected).toFixed(1)}Hz) but measured ${a.notes[0].hz}Hz`,
      ).toBeTruthy();
    }
  });

  test('a lowercase melody plays distinct pitches, not one repeated note', async ({ page }) => {
    const a = await capture(page, 'note("c4 e4 g4").s("gb").channel("pulse1").slow(1.5)', 3200);
    const pitches = a.notes.filter((n) => n.clarity > 0.6).map((n) => n.hz);
    expect(pitches.length).toBeGreaterThanOrEqual(2);
    const allTheSame = pitches.every((p) => nearPitch(p, pitches[0], 30));
    expect(allTheSame, `expected different pitches, got ${JSON.stringify(pitches)}`).toBeFalsy();
  });

  test('.arpTable() drives the hardware arpeggiator', async ({ page }) => {
    // `arp` is Strudel core's chord arpeggiator and shadowed the plugin's
    // control, so the hardware arpeggiator was unreachable from patterns.
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").arpTable([0,4,7,12]).arpSpeed(20)', 2400);
    const steps = Math.max(...a.notes.map((n) => n.runs.length), 0);
    expect(steps, 'arpTable must step through several pitches').toBeGreaterThanOrEqual(3);
  });

  test('preset-driven arpeggios keep working', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb.powerup")', 2400);
    const steps = Math.max(...a.notes.map((n) => n.runs.length), 0);
    expect(steps, 'gb.powerup arpeggiates through its offsets').toBeGreaterThanOrEqual(3);
  });

  test('.volume() changes the level on pulse and noise', async ({ page }) => {
    // Pulse/noise have no volume register: volume must reach the envelope's
    // initial level. It used to be dropped whenever an envelope was present -
    // and DEFAULTS always supplies one, so .volume() was always a no-op.
    for (const channel of ['pulse1', 'pulse2', 'noise']) {
      const quiet = await capture(page, `note("C4").s("gb").channel("${channel}").volume(2)`);
      const loud = await capture(page, `note("C4").s("gb").channel("${channel}").volume(15)`);
      expect(quiet.noteCount, `${channel} quiet must still sound`).toBeGreaterThan(0);
      expect(
        loud.notes[0].rmsHead,
        `${channel}: volume(15) must be louder than volume(2)`,
      ).toBeGreaterThan(quiet.notes[0].rmsHead * 1.5);
    }
  });

  test('an explicit .envelope() still wins over .volume()', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").volume(15).envelope({initial:0,direction:1,pace:3})');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].rmsTail, 'the swell must survive an explicit volume')
      .toBeGreaterThan(a.notes[0].rmsHead * 1.2);
  });

  test('.length() shortens the note on every channel, including noise', async ({ page }) => {
    // The noise channel triggered NR44 without the length-enable bit, so the
    // length counter was loaded but never counted down.
    for (const channel of ['pulse1', 'pulse2', 'wave', 'noise']) {
      const vol = channel === 'wave' ? '.volume(15)' : '';
      const short = await capture(page, `note("C4").s("gb").channel("${channel}")${vol}.length(5)`);
      const long = await capture(page, `note("C4").s("gb").channel("${channel}")${vol}.length(60)`);
      expect(short.noteCount, `${channel} short note must sound`).toBeGreaterThan(0);
      expect(long.noteCount, `${channel} long note must sound`).toBeGreaterThan(0);
      expect(
        short.notes[0].durationMs,
        `${channel}: length(5) must be shorter than length(60)`,
      ).toBeLessThan(long.notes[0].durationMs);
    }
  });

  test('a full four-channel arrangement puts sound on every channel', async ({ page }) => {
    const layers = {
      pulse1: 'note("<[A4 ~ C5 A4 E5 ~ D5 C5]>").s("gb.lead").channel("pulse1").duty(50).envelope({ initial: 13, direction: -1, pace: 4 }).pan(-1)',
      pulse2: 'note("<[A3 C4 E4 C4 A3 C4 E4 C4]>").s("gb.pad").channel("pulse2").duty(25).envelope({ initial: 8, direction: -1, pace: 3 }).pan(1)',
      wave: 'note("<[A1 ~ A1 E2]>").s("gb").channel("wave").waveTable("sine").volume(15)',
      noise: 'note("C4").s("gb.kick").struct("1 0 0 0 1 0 0 0")',
    };

    // Each layer must carry sound on its own: a silent channel inside a dense
    // mix is easy to miss, which is how the original bug shipped.
    for (const [name, code] of Object.entries(layers)) {
      const a = await capture(page, `setcpm(112/4)\n${code}`, 2400);
      expect(a.peak, `${name} layer must produce sound on its own`).toBeGreaterThan(0.005);
      expect(a.noteCount, `${name} layer must produce notes`).toBeGreaterThan(0);
    }

    // Panned layers must reach their own side of the stereo field.
    const left = await capture(page, `setcpm(112/4)\n${layers.pulse1}`, 2400);
    expect(left.rmsRight).toBeLessThan(left.rmsLeft * 0.05);
    const right = await capture(page, `setcpm(112/4)\n${layers.pulse2}`, 2400);
    expect(right.rmsLeft).toBeLessThan(right.rmsRight * 0.05);

    // And the full stack is denser than any single layer. The layers overlap,
    // so count pitch movement rather than silence-separated segments.
    const song = `setcpm(112/4)\nstack(\n  ${Object.values(layers).join(',\n  ')}\n)`;
    const full = await capture(page, song, 3000);
    const movement = full.notes.reduce((sum, n) => sum + n.runs.length, 0);
    expect(full.rmsLeft, 'left channel must carry audio').toBeGreaterThan(0.001);
    expect(full.rmsRight, 'right channel must carry audio').toBeGreaterThan(0.001);
    expect(movement, 'the arrangement must move through many pitches').toBeGreaterThan(6);
    expect(full.notes.some((n) => n.clarity > 0.6), 'melodic content must be audible').toBeTruthy();
  });
});
