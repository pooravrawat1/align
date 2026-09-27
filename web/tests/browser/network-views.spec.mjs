import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

for (const width of [1280, 390]) {
  test(`network remembers people and shared context at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const env = await workspace(page);
    const assessments = [];
    await page.route('**/api/compatibility', route => {
      assessments.push(route.request().postDataJSON());
      return route.continue();
    });
    try {
      await page.goto(origin + '/#/network');
      await expect(page.getByRole('heading', { name: 'People you’ve met', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Connection requests' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveCount(0);
      const rows = page.locator('.nx-person-row');
      await expect(rows).toHaveCount(3);
      for (const row of await rows.all()) {
        await expect(row.locator('.avatar')).toBeVisible();
        await expect(row.locator('.nx-view-profile')).toHaveText('View profile');
        await expect(row.locator('.nx-fit')).toHaveCount(0);
      }
      await expect(page.getByText('Saw Khruangbin at Shaky Knees', { exact: true })).toBeVisible();
      expect(assessments).toHaveLength(0);
      await page.screenshot({ path: testInfo.outputPath('people-you-met.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await env.close(); }
  });
}

test('profile shows shared context without scores or request actions', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.goto(origin + '/#/network');
    await page.getByRole('button', { name: "View Nina Patel's profile" }).click();
    await expect(page.getByRole('heading', { name: 'What you share' })).toBeVisible();
    await expect(page.getByText('Saw Khruangbin at Shaky Knees', { exact: true })).toBeVisible();
    await expect(page.getByText(/Score unavailable|Compatibility is unavailable/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
  } finally { await env.close(); }
});
