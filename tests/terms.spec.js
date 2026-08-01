import { test, expect } from '@playwright/test';

const PAGES = ['index.html', 'playground.html', 'repl.html', 'guide.html', 'terms.html'];

test.describe('Terms of Use', () => {
  test('terms.html loads with all its sections', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));

    await page.goto('/terms.html');
    await expect(page).toHaveTitle('strudel-gb | Terms of Use');
    await expect(page.locator('.page-title')).toHaveText('Terms of Use');

    // The clauses that carry the actual protection.
    const body = page.locator('body');
    await expect(body).toContainText('not affiliated with, endorsed by, sponsored by or associated with');
    await expect(body).toContainText('without warranty of any kind');
    await expect(body).toContainText('Limitation of liability');
    await expect(body).toContainText('Volume warning');
    await expect(body).toContainText('no copyrighted ROM, BIOS, firmware, game data or audio assets');

    await expect(page.locator('section')).toHaveCount(10);
    expect(errors).toEqual([]);
  });

  for (const p of PAGES) {
    test(`${p} footer links to the terms`, async ({ page }) => {
      await page.goto('/' + p);
      const link = page.locator('footer a[href="terms.html"]');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText('Terms of Use');
    });
  }

  test('every link on the terms page resolves', async ({ page, request }) => {
    await page.goto('/terms.html');
    const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const local = [...new Set(hrefs.filter((h) => h && !h.startsWith('http') && !h.startsWith('#')))];
    expect(local.length).toBeGreaterThan(3);
    for (const href of local) {
      const res = await request.get('/' + href);
      expect(res.status(), `${href} must resolve`).toBeLessThan(400);
    }
  });
});
