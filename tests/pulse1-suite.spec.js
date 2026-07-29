import { test, expect } from '@playwright/test';

test.describe('Pulse 1 Channel Test Suite (P1-01 to P1-14)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });
  });

  const testCases = [
    { id: 'P1-01', name: 'Volume Step Test', code: 'note("C4 C4 C4 C4").s("gb").channel("pulse1").volume("3 7 11 15")' },
    { id: 'P1-02', name: 'Speed Modifier Test', code: 'note("C4 E4 G4 C5").s("gb").channel("pulse1").fast(4)' },
    { id: 'P1-03', name: 'Stereo Panning Test', code: 'note("C4 E4 G4").s("gb").channel("pulse1").pan("-1 0 1")' },
    { id: 'P1-04', name: 'Duty Cycle Timbre Test', code: 'note("C4 C4 C4 C4").s("gb").channel("pulse1").duty("12.5 25 50 75")' },
    { id: 'P1-05', name: 'Upward Pitch Sweep Test', code: 'note("C4 G4 C5").s("gb").channel("pulse1").pitchSweep({ rate: 2, amount: 4 }).fast(2)' },
    { id: 'P1-06', name: 'Downward Pitch Sweep Test', code: 'note("C4 G4 C5").s("gb").channel("pulse1").pitchSweep({ rate: 2, amount: -4 }).fast(2)' },
    { id: 'P1-07', name: 'Snappy Decay Envelope Test', code: 'note("C4 E4 G4 C5").s("gb").channel("pulse1").envelope({ initial: 15, direction: "down", pace: 2 })' },
    { id: 'P1-08', name: 'Volume Swell Envelope Test', code: 'note("C4 E4 G4 C5").s("gb").channel("pulse1").envelope({ initial: 0, direction: "up", pace: 4 })' },
    { id: 'P1-09', name: 'Hardware Sound Length Test', code: 'note("C4 E4 G4 C5").s("gb").channel("pulse1").length("5 15 30 50")' },
    { id: 'P1-10', name: 'Built-in Arpeggiator Test', code: 'note("C4").s("gb").channel("pulse1").arp("0 4 7 12").arpSpeed(20)' },
    { id: 'P1-11', name: 'Preset Instruments Test', code: 'note("C4 E4 G4").s("gb gb.lead gb.pluck").channel("pulse1").fast(2)' },
    { id: 'P1-12', name: 'Timbre & Envelope Preset Tags Test', code: 'note("C4 E4").s("gb").channel("pulse1").tags("nasal staccato, hollow sustain").fast(1)' },
    { id: 'P1-13', name: 'Mute & Solo Test', code: 'note("C4 E4").s("gb").channel("pulse1").mute("false true")' },
    { id: 'P1-14', name: 'Voice Priority Test', code: 'note("C4 E4").s("gb").channel("pulse1").priority("1 10")' }
  ];

  for (const tc of testCases) {
    test(`[${tc.id}] ${tc.name}`, async ({ page }) => {
      await page.evaluate((code) => {
        const ed = document.querySelector('strudel-editor').editor;
        ed.setCode(code);
      }, tc.code);

      await page.locator('#btnPlay').click();

      const activityGrid = page.locator('#realtimeChannelActivity');
      await expect(activityGrid).toContainText('P1', { timeout: 10000 });

      await page.locator('#btnStop').click();
    });
  }
});
