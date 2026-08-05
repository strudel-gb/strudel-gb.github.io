import { test, expect } from '@playwright/test';
import { openRepl, capture } from './helpers/audio-probe.js';

/**
 * Catalog smoke tests: every gb.* preset and every tag, played and measured.
 * A preset that stops making sound is otherwise invisible - the channel suites
 * only cover a handful, and a silent entry in a 65-item dropdown is easy to miss.
 */
test.describe('Preset and tag catalog', () => {
  test('every gb.* preset produces audio', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    await openRepl(page);
    const presets = await page.evaluate(() => Object.keys(window.GB_INSTRUMENTS));
    expect(presets.length, 'the catalog must not shrink silently').toBeGreaterThanOrEqual(65);

    const silent = [];
    for (const name of presets) {
      const isWave = await page.evaluate((n) => window.GB_INSTRUMENTS[n].channel === 'wave', name);
      const a = await capture(page, `note("${isWave ? 'C3' : 'C4'}").s("${name}")`, 1300);
      if (a.peak < 0.002) silent.push(`${name} (peak ${a.peak})`);
    }
    expect(silent, `these presets made no sound: ${silent.join(', ')}`).toEqual([]);
  });

  test('every tag produces audio on its own channel', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    await openRepl(page);
    const tags = await page.evaluate(() => Object.entries(window.GB_TAGS).map(([name, def]) => ({
      name,
      // route each tag to the channel it was written for
      channel: def.lfsr ? 'noise' : (def.waveTable && !def.duty ? 'wave' : 'pulse1'),
    })));
    expect(tags.length).toBeGreaterThanOrEqual(27);

    const silent = [];
    for (const { name, channel } of tags) {
      const note = channel === 'wave' ? 'C3' : 'C4';
      const vol = channel === 'wave' ? '.volume(15)' : '';
      const a = await capture(page, `note("${note}").s("gb").channel("${channel}")${vol}.tags("${name}")`, 1300);
      // Peak only: segment detection misses very short, very high noise hits
      // (noise-hihat is loud but too brief to register as a note).
      if (a.peak < 0.002) silent.push(`${name} (peak ${a.peak})`);
    }
    expect(silent, `these tags made no sound: ${silent.join(', ')}`).toEqual([]);
  });

  test('the 7-bit LFSR rings and the 15-bit one does not', async ({ page }) => {
    // gb.cymbal, gb.laser, gb.engine and gb.rimshot are the lfsr:7 presets and
    // are meant to sound metallic; the 15-bit ones must stay broadband noise.
    await openRepl(page);
    const short = await capture(page, 'note("C4").s("gb").channel("noise").lfsr(7).frequency({shift:4,dividing:1})', 1800);
    const long = await capture(page, 'note("C4").s("gb").channel("noise").lfsr(15).frequency({shift:4,dividing:1})', 1800);
    expect(short.notes[0].clarity, '7-bit LFSR must be tonal')
      .toBeGreaterThan(long.notes[0].clarity);
  });
});
