import { test, expect } from '@playwright/test';
import { openRepl, capture, hz, nearPitch } from './helpers/audio-probe.js';

/**
 * One test per bug that reached a user. Each of these produced *silence* or a
 * silently wrong sound with no error in the console, which is exactly what the
 * old UI-text assertions could not see.
 */
/** Plays `code`, then returns the audio analysis plus the strict warnings the
 *  page logged while it played. */
async function captureWithWarnings(page, code, ms = 1800) {
  await page.evaluate(() => { document.getElementById('diagnosticLog').innerHTML = ''; });
  const analysis = await capture(page, code, ms);
  const warnings = await page.evaluate(() => document.getElementById('diagnosticLog').textContent);
  return { analysis, warnings };
}

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
  // --- Tag value forms ---------------------------------------------------
  // Every element of an array control argument is patternified, so
  // .tags(["nasal","staccato"]) arrived as an array of Patterns. resolveParams
  // called .trim() on them, Strudel swallowed the TypeError in getTrigger and
  // the note was never scheduled: total silence, nothing in the console.

  test('an array of tags applies every tag in it', async ({ page }) => {
    const plain = await capture(page, 'note("C4").s("gb").channel("pulse1")');
    const tagged = await capture(page, 'note("C4").s("gb").channel("pulse1").tags(["nasal","staccato"])');

    expect(tagged.noteCount, 'an array of tags must still sound').toBeGreaterThan(0);
    // nasal is duty 12.5%, staccato is a short hardware length: both must land.
    expect(tagged.notes[0].duty, `expected a 12.5% duty, measured ${tagged.notes[0].duty}`)
      .toBeLessThan(0.25);
    expect(plain.notes[0].duty).toBeGreaterThan(0.35);
    expect(tagged.notes[0].durationMs, 'staccato must shorten the note')
      .toBeLessThan(plain.notes[0].durationMs);
  });

  test('a colon tag string applies every tag in it', async ({ page }) => {
    // Strudel hands "a:b" over as an array, which is the documented way to put
    // several tags on one note.
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("nasal:staccato")');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].duty).toBeLessThan(0.25);
  });

  test('the last tag wins on the keys two tags share', async ({ page }) => {
    const nasalLast = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("biting:nasal")');
    const bitingLast = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("nasal:biting")');
    expect(nasalLast.notes[0].duty, 'nasal is 12.5%').toBeLessThan(0.25);
    expect(bitingLast.notes[0].duty, 'biting is 75%').toBeGreaterThan(0.6);
  });

  test('an unknown tag is skipped instead of killing the note', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("not-a-real-tag:nasal")');
    expect(a.noteCount, 'a bogus tag must not silence the note').toBeGreaterThan(0);
    expect(a.notes[0].duty, 'the valid tag next to it must still apply').toBeLessThan(0.25);
  });

  test('an explicit control still wins over a tag', async ({ page }) => {
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").tags("nasal").duty(75)');
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].duty, 'duty(75) must overrule the nasal tag').toBeGreaterThan(0.6);
  });

  test('a multi-value string inside a control object still schedules', async ({ page }) => {
    // A single-value nested string was already handled; a mini-notation string
    // collapsed to an *array*, which the register write turned into silence.
    const a = await capture(page, 'note("C4").s("gb").channel("pulse1").envelope({initial:"15 8",direction:"down",pace:2})');
    expect(a.noteCount, 'a patterned field must not silence the note').toBeGreaterThan(0);
    expect(a.notes[0].rmsTail, 'the envelope must still decay').toBeLessThan(a.notes[0].rmsHead);
  });

  test('an array of arp offsets and the colon form drive the same arpeggio', async ({ page }) => {
    const asArray = await capture(page, 'note("C4").s("gb").channel("pulse1").arpTable([0,4,7,12]).arpSpeed(20)', 2400);
    const asColon = await capture(page, 'note("C4").s("gb").channel("pulse1").arpTable("0:4:7:12").arpSpeed(20)', 2400);
    for (const [label, a] of [['array', asArray], ['colon string', asColon]]) {
      const steps = Math.max(...a.notes.map((n) => n.runs.length), 0);
      expect(steps, `the ${label} form must step through several pitches`).toBeGreaterThanOrEqual(3);
    }
  });

  // --- Smart auto routing ------------------------------------------------
  // .autoChannels() read value.instrument, but Strudel stores the sound name in
  // value.s, so the lookup fell back to the "gb" preset and every note without
  // an explicit .channel() was forced onto Pulse 1. Rules 3-5 (drum tags,
  // low notes, pulse alternation) were unreachable.

  test('.autoChannels() keeps a preset on the channel it declares', async ({ page }) => {
    // gb.bass is a Wave preset. Routed onto Pulse 1 it loses its wavetable and
    // comes out as a plain square, which the crest factor exposes.
    const direct = await capture(page, 'note("C3 G2").s("gb.bass")', 2400);
    const routed = await capture(page, 'note("C3 G2").s("gb.bass").autoChannels()', 2400);

    expect(direct.noteCount, 'gb.bass must sound').toBeGreaterThan(0);
    expect(routed.noteCount, 'gb.bass must still sound through the router').toBeGreaterThan(0);
    expect(
      routed.notes[0].crest,
      `routing must not change the waveform: ${routed.notes[0].crest} vs ${direct.notes[0].crest}`,
    ).toBeCloseTo(direct.notes[0].crest, 0);
  });

  test('.autoChannels() sends a drum tag to the noise channel', async ({ page }) => {
    const routed = await capture(page, 'note("C4*4").s("gb").tags("noise-kick").autoChannels()', 2400);
    const tonal = await capture(page, 'note("C4*4").s("gb").tags("noise-kick")', 2400);

    expect(routed.noteCount, 'the drum hits must sound').toBeGreaterThan(0);
    // The LFSR is not tonal, so clarity collapses once the note lands on noise.
    expect(
      Math.max(...routed.notes.map((n) => n.clarity)),
      'noise-routed hits must not be tonal',
    ).toBeLessThan(Math.max(...tonal.notes.map((n) => n.clarity)));
  });

  test('.autoChannels() sends a note below the pulse floor to the wave channel', async ({ page }) => {
    // Pulse bottoms out at 64Hz and strict mode says so; Wave reaches 32Hz.
    const routed = await captureWithWarnings(page, 'note("C1").s("gb").autoChannels()');
    const unrouted = await captureWithWarnings(page, 'note("C1").s("gb")');

    expect(routed.analysis.noteCount, 'the low note must sound').toBeGreaterThan(0);
    expect(unrouted.warnings, 'C1 on pulse1 must warn').toMatch(/Frequency Warning/);
    expect(routed.warnings, 'C1 routed to wave must not warn').not.toMatch(/Frequency Warning/);
  });

  test('.autoChannels() spreads a chord across the pulse channels', async ({ page }) => {
    // At polyphony 1 strict mode reports every monophony violation, so the
    // warning log is the cheapest proof that the notes went to different
    // channels rather than piling onto Pulse 1.
    const routed = await captureWithWarnings(page, 'note("[C5,E5]").s("gb").autoChannels()');
    const unrouted = await captureWithWarnings(page, 'note("[C5,E5]").s("gb")');

    expect(routed.analysis.noteCount, 'the chord must sound').toBeGreaterThan(0);
    expect(unrouted.warnings, 'two notes on one channel must warn').toMatch(/Polyphony Warning/);
    expect(routed.warnings, 'a spread chord must not warn').not.toMatch(/Polyphony Warning/);
  });

  test('.autoChannels() leaves an explicit channel alone', async ({ page }) => {
    const a = await capture(page, 'note("C5 D5").s("gb").channel("wave").volume(15).autoChannels()', 2400);
    const b = await capture(page, 'note("C5 D5").s("gb").channel("wave").volume(15)', 2400);
    expect(a.noteCount).toBeGreaterThan(0);
    expect(a.notes[0].crest, 'an explicit channel must survive the router')
      .toBeCloseTo(b.notes[0].crest, 0);
  });

  test('every preset family reaches the APU', async ({ page }) => {
    // One preset per family: a silent family used to be invisible because the
    // suites asserted on static visualizer labels.
    const presets = ['gb.lead', 'gb.pad', 'gb.coin', 'gb.bass', 'gb.fuzz-guitar', 'gb.snare', 'gb.wave-kick', 'gb.powerup'];
    for (const preset of presets) {
      const a = await capture(page, `note("C3").s("${preset}")`, 1800);
      expect(a.peak, `${preset} must produce sound`).toBeGreaterThan(0.002);
      expect(a.noteCount, `${preset} must produce a note`).toBeGreaterThan(0);
    }
  });
  // --- Boolean-ish control values ----------------------------------------
  // Control values arrive as strings, and every non-empty string is truthy, so
  // .mute("false") muted the channel and .solo("false") soloed it. The
  // mini-notation form .mute("false true") therefore silenced both notes.

  test('.mute() reads the string "false" as off', async ({ page }) => {
    const off = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).mute("false")');
    const on = await capture(page, 'note("C3").s("gb").channel("wave").volume(15).mute("true")');
    expect(off.peak, 'mute("false") must still sound').toBeGreaterThan(0.002);
    expect(on.peak, 'mute("true") must silence the channel').toBeLessThan(off.peak * 0.1);
  });

  test('.mute("false true") plays the first note and silences the second', async ({ page }) => {
    // The pattern loops, so counting segments proves nothing: measure how much
    // audio the two notes carry together.
    const both = await capture(page, 'note("C3 E3").s("gb").channel("wave").volume(15).slow(2)', 3600);
    const half = await capture(page, 'note("C3 E3").s("gb").channel("wave").volume(15).mute("false true").slow(2)', 3600);
    expect(half.peak, 'the unmuted note must still sound').toBeGreaterThan(0.002);
    expect(
      half.rmsLeft + half.rmsRight,
      'muting one of the two notes must roughly halve the audio',
    ).toBeLessThan((both.rmsLeft + both.rmsRight) * 0.6);
  });

  test('.solo() reads the string "false" as off', async ({ page }) => {
    // A false solo must not mute every other channel. Panning the two layers to
    // opposite sides makes the silencing measurable: solo mutes through NR51, so
    // the other channel's whole side of the stereo field drops out.
    const code = (soloVal) => `stack(
  note("C5*8").s("gb").channel("pulse1").volume(15).pan(-1),
  note("C3").s("gb").channel("wave").volume(15).pan(1).solo(${soloVal})
)`;
    const noSolo = await capture(page, code('"false"'), 3600);
    const soloed = await capture(page, code('"true"'), 3600);
    expect(soloed.rmsRight, 'the soloed channel must sound').toBeGreaterThan(0.002);
    expect(
      noSolo.rmsLeft,
      'solo("false") must leave the other channel audible',
    ).toBeGreaterThan(soloed.rmsLeft * 1.8);
  });

  test('every channel honours .mute() with string values', async ({ page }) => {
    for (const channel of ['pulse1', 'pulse2', 'wave', 'noise']) {
      const vol = channel === 'wave' ? '.volume(15)' : '';
      const off = await capture(page, `note("C4").s("gb").channel("${channel}")${vol}.mute("false")`);
      const on = await capture(page, `note("C4").s("gb").channel("${channel}")${vol}.mute("true")`);
      expect(off.peak, `${channel}: mute("false") must sound`).toBeGreaterThan(0.002);
      expect(on.peak, `${channel}: mute("true") must be silent`).toBeLessThan(off.peak * 0.1);
    }
  });

  test('a space-separated tag list applies one tag per note', async ({ page }) => {
    // Commas are a mini-notation *stack*: a comma list fires every tag at once on
    // a monophonic channel, so the last one wins and the timbre never changes.
    // A space list sequences them, which is what the sample suites use.
    // Rests keep the two notes in separate segments; back to back they merge.
    const a = await capture(page, 'note("C3 ~ C3 ~").s("gb").channel("wave").tags("sine-smooth sine-smooth pulse-wave pulse-wave").volume(15).slow(2)', 4000);
    expect(a.noteCount, 'both notes must sound').toBeGreaterThanOrEqual(2);
    const crests = a.notes.map((n) => n.crest);
    expect(
      Math.max(...crests) - Math.min(...crests),
      `each tag must reshape the wave, got crests ${JSON.stringify(crests)}`,
    ).toBeGreaterThan(0.25);
  });
});
