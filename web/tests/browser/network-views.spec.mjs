import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

for (const width of [1280, 390]) {
  test(`network is list-only with portraits and assessed scores at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const env = await workspace(page);
    const assessments = [];
    await page.route('**/api/compatibility', async route => {
      assessments.push(route.request().postDataJSON());
      await route.fulfill({ json: { status: 'ready', score: 82, compatible: true,
        reason: 'Shared project interests.', commonGround: ['Open source'], contributions: [],
        starter: '', categories: [], source: 'fixture', route: 'networking',
        routes: { networking: 82, professional: 0, personal: 0 } } });
    });
    try {
      await page.goto(origin + '/#/network');
      await expect(page.getByRole('group', { name: 'Network view', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^(Graph|Map|Show topics)$/ })).toHaveCount(0);
      await expect(page.locator('.nx-graph')).toHaveCount(0);
      const heading = page.getByRole('heading', { name: 'Your network', exact: true });
      await expect(heading).toBeVisible();
      const rows = page.locator('.nx-person-row');
      await expect(rows).toHaveCount(3);
      for (const row of await rows.all()) {
        await expect(row.locator('.avatar')).toBeVisible();
        await expect(row.locator('.nx-fit')).toContainText('82/100');
      }
      // Vite's StrictMode may abort and replay the first mount's requests.
      expect([...new Set(assessments.map(request => request.participantId))].sort()).toEqual(['jordan', 'leo', 'nina']);
      expect(assessments.length).toBeLessThanOrEqual(6);
      expect(assessments.every(request => request.audience === 'network')).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('list.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await env.close(); }
  });
}

test('network list does not invent numeric scores when an assessment is unavailable', async ({ page }) => {
  const env = await workspace(page);
  await page.route('**/api/compatibility', route => route.fulfill({ json: {
    status: 'unavailable', score: null, reason: '', commonGround: [], contributions: [],
    starter: '', categories: [], source: 'unavailable',
  } }));
  try {
    await page.goto(origin + '/#/network');
    await expect(page.locator('.nx-person-row').first().locator('.nx-fit')).toHaveText('Score unavailable');
    await expect(page.locator('.nx-fit-high')).toHaveCount(0);
  } finally { await env.close(); }
});
