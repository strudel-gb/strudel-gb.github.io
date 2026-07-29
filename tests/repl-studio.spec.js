import { test, expect } from '@playwright/test';

test.describe('strudel-gb Local REPL Studio', () => {
  test('should load repl.html with strudel-editor component', async ({ page }) => {
    await page.goto('/repl.html');
    await expect(page).toHaveTitle('strudel-gb — Local REPL Studio');
    await expect(page.locator('.cm-editor')).toBeVisible();
  });

  test('should successfully evaluate a pattern with Phase 1 parameters (.channel, .duty, .envelope, etc.)', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    await expect(page.locator('.cm-content')).toContainText('.s("gb")', { timeout: 10000 });

    await page.evaluate(() => {
      const ed = document.querySelector('strudel-editor').editor;
      ed.setCode(`// Test all Phase 1 parameters
stack(
  note("C4").s("gb").channel("pulse1").duty(12.5).envelope({initial:15, direction:-1, pace:3}).pitchSweep({rate:2, amount:-1}),
  note("E4").s("gb").channel("pulse2").duty(50).volume(8),
  note("G4").s("gb").channel("wave").wave("triangle").volume(4).pan(-0.5),
  note("C5").s("gb").channel("noise").lfsr(7).frequency({shift:4, dividing:2}).pan(0.5)
)`);
    });

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(2000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play a multi-channel sample from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('multi_channel_demo');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// Multi-Channel Stack Demo (Phase 2)');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(2000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Phase 3 Instruments sample from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('phase3_instruments');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// Instruments Demo');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(2000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Phase 3 Tags sample from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('phase3_tags');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// Tags & Priority Demo');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(2000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Phase 3 Arpeggiator sample from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('phase3_arp');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// Hardware Arpeggiator (Faux-Chords) Demo');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(2000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Pulse 1 Channel test suite from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('test_pulse1');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// PULSE 1 CHANNEL COMPREHENSIVE TEST SUITE');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(1000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Pulse 2 Channel test suite from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('test_pulse2');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// PULSE 2 CHANNEL COMPREHENSIVE TEST SUITE');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(1000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Wave Channel test suite from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource') && !txt.includes('Failed to fetch')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('test_wave');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// WAVE CHANNEL COMPREHENSIVE TEST SUITE');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(1000);
    expect(consoleErrors).toEqual([]);
  });

  test('should load and play Noise Channel test suite from the select menu', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message || err));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('net::ERR_') && !txt.includes('Failed to load resource') && !txt.includes('Failed to fetch')) {
          consoleErrors.push(txt);
        }
      }
    });

    await page.goto('/repl.html');
    const selectMenu = page.locator('#sampleSelect');
    await expect(selectMenu).toBeEnabled({ timeout: 12000 });

    await selectMenu.selectOption('test_noise');

    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toContainText('// NOISE CHANNEL COMPREHENSIVE TEST SUITE');

    await page.evaluate(() => {
      window.playCode();
    });

    await page.waitForTimeout(1000);
    expect(consoleErrors).toEqual([]);
  });
});
