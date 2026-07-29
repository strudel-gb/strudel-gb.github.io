import { test, expect } from '@playwright/test';

test.describe('Wave Channel Test Suite (WV-01 to WV-11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });
  });

  const testCases = [
    { id: 'WV-01', name: 'Hardware Discrete Volume Test', code: 'note("C3 C3 C3 C3").s("gb").channel("wave").volume("15 8 4 0")' },
    { id: 'WV-02', name: 'Speed Modifier Test', code: 'note("C3 E3 G3 C4").s("gb").channel("wave").fast(4)' },
    { id: 'WV-03', name: 'Stereo Panning Test', code: 'note("C3 E3 G3").s("gb").channel("wave").pan("-1 0 1")' },
    { id: 'WV-04', name: 'Standard Shape Wavetable Test', code: 'note("C3 C3 C3 C3").s("gb").channel("wave").wave("triangle sawtooth square sine").volume(8)' },
    { id: 'WV-05', name: 'Custom Hexadecimal Wavetable Test', code: 'note("C3").s("gb").channel("wave").wave("0123456789ABCDEFFEDCBA9876543210").volume(15)' },
    { id: 'WV-06', name: 'Custom Array Wavetable Test', code: 'note("C3").s("gb").channel("wave").wave([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0]).volume(8)' },
    { id: 'WV-07', name: 'Hardware Sound Length Test', code: 'note("C3 E3 G3 C4").s("gb").channel("wave").length("20 40 80 160")' },
    { id: 'WV-08', name: 'Built-in Arpeggiator Test', code: 'note("C3").s("gb").channel("wave").arp("0 3 7").arpSpeed(12).volume(8)' },
    { id: 'WV-09', name: 'Preset Instruments Test', code: 'note("C3 C3 C3 C3 C3").s("gb.bass gb.sub-bass gb.triangle gb.organ gb.voice").channel("wave").fast(2)' },
    { id: 'WV-10', name: 'Preset Tags Test', code: 'note("C3 C3 C3 C3 C3 C3").s("gb").channel("wave").tags("sine-smooth, tri-soft, saw-bright, pulse-wave, digi-buzzy, sub-octave").fast(2)' },
    { id: 'WV-11', name: 'Mute & Solo Test', code: 'note("C3 E3").s("gb").channel("wave").mute("false true")' }
  ];

  for (const tc of testCases) {
    test(`[${tc.id}] ${tc.name}`, async ({ page }) => {

      await page.evaluate((code) => {
        const ed = document.querySelector('strudel-editor').editor;
        ed.setCode(code);
      }, tc.code);

      await page.locator('#btnPlay').click();

      const activityGrid = page.locator('#realtimeChannelActivity');
      await expect(activityGrid).toContainText('WV', { timeout: 10000 });

      if (tc.id === 'WV-08') {
        await page.waitForTimeout(600);
        const debugObj = await page.evaluate(() => {
          return {
            lastMsg: window.lastScheduledNoteOn,
            lastRawValue: window.lastRawValue
          };
        });
        console.log('--- WV-08 DEBUG OBJ ---:\n', JSON.stringify(debugObj));
        expect(debugObj.lastMsg).not.toBeNull();
        expect(debugObj.lastMsg.arp).toBe('0 3 7');
      }

      await page.locator('#btnStop').click();
    });
  }
});
