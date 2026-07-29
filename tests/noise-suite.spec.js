import { test, expect } from '@playwright/test';

test.describe('Noise Channel Test Suite (NS-01 to NS-12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });
  });

  const testCases = [
    { id: 'NS-01', name: 'Volume Step Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").volume("3 7 11 15")' },
    { id: 'NS-02', name: 'Speed Modifier Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").fast(4)' },
    { id: 'NS-03', name: 'Stereo Panning Test', code: 'note("C4 C4 C4").s("gb").channel("noise").pan("-1 0 1")' },
    { id: 'NS-04', name: 'LFSR Mode Test (7-bit vs 15-bit)', code: 'note("C4 C4").s("gb").channel("noise").lfsr("7 15")' },
    { id: 'NS-05', name: 'Polynomial Clock Frequency Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").frequency({ shift: 4, dividing: 1 })' },
    { id: 'NS-06', name: 'Snappy Decay Envelope Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").envelope({ initial: 15, direction: "down", pace: 2 })' },
    { id: 'NS-07', name: 'Volume Swell Envelope Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").envelope({ initial: 0, direction: "up", pace: 4 })' },
    { id: 'NS-08', name: 'Hardware Sound Length Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").length("5 15 30 50")' },
    { id: 'NS-09', name: 'Preset Drum Instruments Test', code: 'note("C4 C4 C4 C4").s("gb.kick gb.snare gb.hihat gb.cymbal").channel("noise").fast(2)' },
    { id: 'NS-10', name: 'Preset Drum Tags Test', code: 'note("C4 C4 C4 C4").s("gb").channel("noise").tags("noise-kick, noise-snare, noise-hihat, noise-cymbal").fast(2)' },
    { id: 'NS-11', name: 'Extended Drum Instruments Test', code: 'note("C4 C4 C4 C4").s("gb.hihat-open gb.cowbell gb.rimshot gb.shaker").channel("noise").fast(2)' },
    { id: 'NS-12', name: 'Mute & Solo Test', code: 'note("C4 C4").s("gb").channel("noise").mute("false true")' }
  ];

  for (const tc of testCases) {
    test(`[${tc.id}] ${tc.name}`, async ({ page }) => {
      await page.evaluate((code) => {
        const ed = document.querySelector('strudel-editor').editor;
        ed.setCode(code);
      }, tc.code);

      await page.locator('#btnPlay').click();

      const activityGrid = page.locator('#realtimeChannelActivity');
      await expect(activityGrid).toContainText('NS', { timeout: 10000 });

      await page.locator('#btnStop').click();
    });
  }
});
