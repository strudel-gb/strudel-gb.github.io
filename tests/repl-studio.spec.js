import { test, expect } from '@playwright/test';
import { installProbe, capture } from './helpers/audio-probe.js';

const IGNORED_CONSOLE = [/net::ERR_/, /Failed to load resource/, /ScriptProcessorNode is deprecated/];

/** Collect page errors and genuine console errors. */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!IGNORED_CONSOLE.some((re) => re.test(text))) errors.push(text);
  });
  return errors;
}

test.describe('strudel-gb Local REPL Studio', () => {
  test('should load repl.html with strudel-editor component', async ({ page }) => {
    await page.goto('/repl.html');
    await expect(page).toHaveTitle('strudel-gb — Local REPL Studio');
    await expect(page.locator('.cm-editor')).toBeVisible();
  });

  test('should evaluate a pattern using every channel without console errors', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/repl.html');
    await expect(page.locator('.cm-content')).toContainText('.s("gb")', { timeout: 10000 });

    await page.evaluate(() => {
      document.querySelector('strudel-editor').editor.setCode(`stack(
  note("C4").s("gb").channel("pulse1").duty(12.5).envelope({initial:15, direction:-1, pace:3}).pitchSweep({rate:2, amount:-1}),
  note("E4").s("gb").channel("pulse2").duty(50).volume(8),
  note("G4").s("gb").channel("wave").wave("triangle").volume(15).pan(-0.5),
  note("C5").s("gb").channel("noise").lfsr(7).frequency({shift:4, dividing:2}).pan(0.5)
)`);
    });
    await page.evaluate(() => window.playCode());
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  // Loading a sample into the editor proves nothing about whether it makes a
  // sound, so each built-in demo is played and measured.
  const SAMPLES = [
    ['test_pulse1', '// PULSE 1 CHANNEL COMPREHENSIVE TEST SUITE'],
    ['test_pulse2', '// PULSE 2 CHANNEL COMPREHENSIVE TEST SUITE'],
    ['test_wave', '// WAVE CHANNEL COMPREHENSIVE TEST SUITE'],
    ['test_noise', '// NOISE CHANNEL COMPREHENSIVE TEST SUITE'],
    ['test_instruments', '// INSTRUMENT PRESET TEST SUITE'],
    ['test_tags', '// TAGS & PRECEDENCE TEST SUITE'],
    ['test_autochannels', '// SMART AUTO ROUTING TEST SUITE'],
    ['test_arp', '// HARDWARE ARPEGGIATOR TEST SUITE'],
    ['test_notes', '// NOTE PARSING & RANGE TEST SUITE'],
    ['test_values', '// PARAMETER VALUE FORM TEST SUITE'],
    ['test_polyphony', '// POLYPHONY & STRICT MODE TEST SUITE'],
    ['test_multichannel', '// MULTI-CHANNEL LAYERING TEST SUITE'],
  ];

  for (const [value, expectedText] of SAMPLES) {
    test(`built-in sample "${value}" loads, plays and produces audio`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto('/repl.html');
      const selectMenu = page.locator('#sampleSelect');
      await expect(selectMenu).toBeEnabled({ timeout: 20000 });
      await page.waitForFunction(() => !!window.gbNode && !!window.gbAudioContext, null, { timeout: 20000 });
      await installProbe(page);

      await selectMenu.selectOption(value);
      if (expectedText.startsWith('//')) {
        await expect(page.locator('.cm-content')).toContainText(expectedText);
      }

      // Warm the graph (superdough boots lazily and eats the first pattern),
      // then re-select the sample and measure it for real.
      await capture(page, 'note("C4").s("gb").channel("pulse1")', 1200);
      await selectMenu.selectOption(value);
      const code = await page.evaluate(() => document.querySelector('strudel-editor').editor.code);
      const analysis = await capture(page, code, 2600);

      expect(analysis.peak, `sample "${value}" must produce audible output`).toBeGreaterThan(0.002);
      expect(analysis.noteCount, `sample "${value}" must produce notes`).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    });
  }
});
