import { test, expect } from '@playwright/test';

test.describe('Pulse 2 Channel Test Suite (P2-01 to P2-12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });
  });

  const testCases = [
    { id: 'P2-01', name: 'Volume Step Test', code: 'note("E4 E4 E4 E4").s("gb").channel("pulse2").volume("3 7 11 15")' },
    { id: 'P2-02', name: 'Speed Modifier Test', code: 'note("E4 G4 B4 E5").s("gb").channel("pulse2").fast(3)' },
    { id: 'P2-03', name: 'Stereo Panning Test', code: 'note("E4 G4 B4").s("gb").channel("pulse2").pan("-1 0 1")' },
    { id: 'P2-04', name: 'Duty Cycle Timbre Test', code: 'note("E4 E4 E4 E4").s("gb").channel("pulse2").duty("12.5 25 50 75")' },
    { id: 'P2-05', name: 'Snappy Decay Envelope Test', code: 'note("E4 G4 B4 E5").s("gb").channel("pulse2").envelope({ initial: 15, direction: "down", pace: 2 })' },
    { id: 'P2-06', name: 'Volume Swell Envelope Test', code: 'note("E4 G4 B4 E5").s("gb").channel("pulse2").envelope({ initial: 0, direction: "up", pace: 4 })' },
    { id: 'P2-07', name: 'Hardware Sound Length Test', code: 'note("E4 G4 B4 E5").s("gb").channel("pulse2").length("5 15 30 50")' },
    { id: 'P2-08', name: 'Built-in Arpeggiator Test', code: 'note("E4").s("gb").channel("pulse2").arp("0 3 7 12").arpSpeed(18)' },
    { id: 'P2-09', name: 'Preset Instruments Test', code: 'note("E4").s("gb.pad").channel("pulse2").envelope({ initial: 10, direction: "down", pace: 6 })' },
    { id: 'P2-10', name: 'Timbre & Envelope Preset Tags Test', code: 'note("E4 G4").s("gb").channel("pulse2").tags("hollow staccato").fast(2)' },
    { id: 'P2-11', name: 'Mute & Solo Test', code: 'note("E4 G4").s("gb").channel("pulse2").mute("false true")' },
    { id: 'P2-12', name: 'Hardware Difference / Sweep Exclusion Test', code: 'note("E4 G4").s("gb").channel("pulse2").pitchSweep({ rate: 2, amount: 4 })' }
  ];

  for (const tc of testCases) {
    test(`[${tc.id}] ${tc.name}`, async ({ page }) => {
      await page.evaluate((code) => {
        const ed = document.querySelector('strudel-editor').editor;
        ed.setCode(code);
      }, tc.code);

      await page.locator('#btnPlay').click();

      const activityGrid = page.locator('#realtimeChannelActivity');
      await expect(activityGrid).toContainText('P2', { timeout: 10000 });

      await page.locator('#btnStop').click();
    });
  }
});
