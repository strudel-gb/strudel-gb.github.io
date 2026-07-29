import { test, expect } from '@playwright/test';

test.describe('strudel-gb Phase 6 Developer & Debugging Tools', () => {
  test('should display visualizer bars and channel activity grid in playground.html', async ({ page }) => {
    await page.goto('/playground.html');
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    await page.locator('.piano-key[data-note="C4"]').dispatchEvent('mousedown');

    const activityGrid = page.locator('#realtimeChannelActivity');
    await expect(activityGrid).toContainText('P1');
    await expect(activityGrid).toContainText('C4');

    await page.locator('.piano-key[data-note="C4"]').dispatchEvent('mouseup');
  });

  test('should show visualizer grid and strict console warnings in repl.html', async ({ page }) => {
    await page.goto('/repl.html');
    
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });

    await page.evaluate(() => {
      const ed = document.querySelector('strudel-editor').editor;
      ed.setCode(`// Invalid pattern to trigger strict warnings
note("C4").s("gb").pan(0.5).freq(20)`);
    });

    await page.locator('#btnPlay').click();

    const activityGrid = page.locator('#realtimeChannelActivity');
    await expect(activityGrid).toContainText('P1', { timeout: 10000 });

    const log = page.locator('#diagnosticLog');
    await expect(log).toContainText('STRICT WARNING', { timeout: 10000 });
    await expect(log).toContainText('out of bounds', { timeout: 10000 });
  });

  test('should support polyphony count changes in repl.html and automatically set strict mode', async ({ page }) => {
    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 15000 });

    const polyphonySelect = page.locator('#polyphonySelect');
    await expect(polyphonySelect).toHaveValue('1');

    await page.evaluate(() => {
      const ed = document.querySelector('strudel-editor').editor;
      ed.setCode(`// Invalid pattern to trigger strict warnings when polyphony=1
note("C4").s("gb").pan(0.5).freq(20)`);
    });
    await page.locator('#btnPlay').click();
    
    const log = page.locator('#diagnosticLog');
    await expect(log).toContainText('STRICT WARNING', { timeout: 10000 });
    
    await page.locator('#btnStop').click();
    await page.waitForTimeout(500);

    await polyphonySelect.selectOption('3');
    
    const nodeState = await page.evaluate(() => ({
      size: window.gbNode.size,
      strictMode: window.gbNode.strictMode
    }));
    expect(nodeState.size).toBe(3);
    expect(nodeState.strictMode).toBe(false);

    await page.evaluate(() => {
      document.getElementById('diagnosticLog').innerHTML = 'Cleared';
    });

    await page.locator('#btnPlay').click();
    await page.waitForTimeout(1000);
    const logContent = await log.textContent();
    expect(logContent).not.toContain('STRICT WARNING');
  });
});
