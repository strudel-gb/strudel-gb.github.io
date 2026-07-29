import { test, expect } from '@playwright/test';

test.describe('strudel-gb POC UI and Audio Context', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground.html');
  });

  test('should display initial offline state', async ({ page }) => {
    await expect(page).toHaveTitle('strudel-gb — APU Hardware Playground');
    await expect(page.locator('header h1')).toHaveText('strudel-gb');
    await expect(page.locator('#badgeStatus')).toHaveText('Offline');
    await expect(page.locator('#screenStatus')).toHaveText('OFFLINE');
    await expect(page.locator('#screenDisplay')).toContainText('Game Boy Core Powered Off');
    await expect(page.locator('#activeNote')).toHaveText('FREQ: --- Hz');
  });

  test('should boot the APU and transition to ready state', async ({ page }) => {
    const bootOverlay = page.locator('#bootOverlay');
    const badgeStatus = page.locator('#badgeStatus');
    const screenStatus = page.locator('#screenStatus');
    const screenDisplay = page.locator('#screenDisplay');
    const btnBoot = page.locator('#btnBoot');

    await btnBoot.click();

    await expect(bootOverlay).toHaveClass(/hidden/);
    await expect(badgeStatus).toHaveText('Online');
    await expect(badgeStatus).toHaveClass(/online/);
    await expect(screenStatus).toHaveText('ONLINE');
    await expect(screenDisplay).toContainText('System Ready');
  });

  test('should update screen and log when playing a key', async ({ page }) => {
    await page.locator('#btnBoot').click();

    const keyC4 = page.locator('.piano-key[data-note="C4"]');
    await keyC4.click();

    await expect(page.locator('#screenDisplay')).toContainText('PLAYING');
    await expect(page.locator('#screenDisplay')).toContainText('C4');
    await expect(page.locator('#activeNote')).toContainText('261.63 Hz');

    const log = page.locator('#diagnosticLog');
    await expect(log).toContainText('Game Boy APU Worklet booted successfully');
  });

  test('should scroll the octave and update key notes', async ({ page }) => {
    await page.locator('#btnBoot').click();

    await page.locator('#btnOctaveUp').click();
    await expect(page.locator('#octaveDisplay')).toHaveText('Octaves: 5 & 6');

    const keyC5 = page.locator('.piano-key[data-note="C5"]');
    await keyC5.click();
    await expect(page.locator('#activeNote')).toContainText('523.25 Hz');
  });

  test('should switch channels and apply configuration', async ({ page }) => {
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    const tabWave = page.locator('.tab-btn[data-channel="wave"]');
    await tabWave.click();
    await expect(tabWave).toHaveClass(/active/);
    await expect(page.locator('#pane-wave')).toHaveClass(/active/);

    const keyC4 = page.locator('.piano-key[data-note="C4"]');
    await keyC4.click();
    await expect(page.locator('#screenDisplay')).toContainText('WAVE');
  });

  test('should select base instrument and update setting controls with visual indicators', async ({ page }) => {
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    const btnLead = page.locator('.inst-btn[data-inst="gb.lead"]');
    await btnLead.click();

    await expect(btnLead).toHaveClass(/active/);

    const tabPulse1 = page.locator('.tab-btn[data-channel="pulse1"]');
    await expect(tabPulse1).toHaveClass(/active/);

    const dutyGroup = page.locator('#p1-duty').locator('..');
    await expect(dutyGroup).toHaveClass(/from-instrument/);
    await expect(page.locator('#presetSourceIndicator')).toHaveText('Preset: lead');

    const duty25Btn = page.locator('#p1-duty .select-btn[data-value="25"]');
    await expect(duty25Btn).toHaveClass(/active/);
  });

  test('should alert the user and clear active presets when modifying settings directly', async ({ page }) => {
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    const btnPluck = page.locator('.inst-btn[data-inst="gb.pluck"]');
    await btnPluck.click();

    const dutyGroup = page.locator('#p1-duty').locator('..');
    await expect(dutyGroup).toHaveClass(/from-instrument/);

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Modifying hardware settings directly');
      await dialog.accept();
    });

    const volSlider = page.locator('#p1-vol');
    await volSlider.fill('10');

    await expect(page.locator('.inst-btn[data-inst="gb"]')).toHaveClass(/active/);
    await expect(page.locator('.inst-btn[data-inst="gb.pluck"]')).not.toHaveClass(/active/);
    await expect(dutyGroup).not.toHaveClass(/from-instrument/);
  });

  test('should display channel-specific tags in the available tags pool', async ({ page }) => {
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    const pool = page.locator('#available-tags-pool');
    await expect(pool.locator('.tag-chip[data-tag="chiptune"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="nasal"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="sine-smooth"]')).not.toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="noise-kick"]')).not.toBeVisible();

    await page.locator('.tab-btn[data-channel="wave"]').click();
    await expect(pool.locator('.tag-chip[data-tag="sine-smooth"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="tri-soft"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="chiptune"]')).not.toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="noise-kick"]')).not.toBeVisible();

    await page.locator('.tab-btn[data-channel="noise"]').click();
    await expect(pool.locator('.tag-chip[data-tag="noise-kick"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="noise-snare"]')).toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="sine-smooth"]')).not.toBeVisible();
    await expect(pool.locator('.tag-chip[data-tag="chiptune"]')).not.toBeVisible();
  });

  test('should restore baseline defaults when tags are deleted from active dropzone', async ({ page }) => {
    await page.locator('#btnBoot').click();
    await expect(page.locator('#screenStatus')).toContainText('ONLINE');

    await page.evaluate(() => {
      const source = document.querySelector('.tag-chip[data-tag="staccato"]');
      const target = document.getElementById('active-tags-dropzone');
      
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      });
      
      const dataTransfer = {
        data: {},
        setData(format, val) { this.data[format] = val; },
        getData(format) { return this.data[format] || ''; },
        effectAllowed: 'copy'
      };
      
      Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
      source.dispatchEvent(dragStartEvent);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
      target.dispatchEvent(dropEvent);
    });

    const paceGroup = page.locator('#p1-envpace').locator('..');
    await expect(paceGroup).toHaveClass(/from-tag/);
    await expect(page.locator('#presetSourceIndicator')).toHaveText('Tags: staccato');

    const envpaceInput = page.locator('#p1-envpace');
    await expect(envpaceInput).toHaveValue('1');

    const dropzone = page.locator('#active-tags-dropzone');
    const deleteBtn = dropzone.locator('.active-tag-chip[data-tag="staccato"]').locator('.delete-btn');
    await deleteBtn.click();

    await expect(paceGroup).not.toHaveClass(/from-tag/);
    await expect(paceGroup).not.toHaveClass(/from-instrument/);

    await expect(envpaceInput).toHaveValue('3');
  });
});
