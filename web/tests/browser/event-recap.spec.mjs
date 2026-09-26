import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

test('contacted saved people remain available and profile close preserves the recap tab', async ({ page }) => {
  const env = await workspace(page);
  try {
    await env.api('connections/leo', { followUp: 'contacted' }, 'PATCH');
    await page.goto(origin + '/#/home?tab=recap');

    await expect(page.getByRole('heading', { name: 'Your event recap' })).toBeVisible();
    await expect(page.getByRole('button', { name: "View Leo Park's profile" })).toBeVisible();
    await expect(page.getByRole('button', { name: "Open Leo Park's profile" })).toHaveCount(0);

    await page.getByRole('button', { name: "View Leo Park's profile" }).click();
    await expect(page).toHaveURL(/home\?tab=recap.*person=leo/);
    await expect(page.getByRole('dialog', { name: 'Leo Park — full profile' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/#\/home\?tab=recap$/);
    await expect(page.getByRole('button', { name: "View Leo Park's profile" })).toBeFocused();
  } finally {
    await env.close();
  }
});
