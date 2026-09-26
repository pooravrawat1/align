import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

for (const width of [1440, 390]) {
  test('event browse, details and join are responsive at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const env = await workspace(page);
    try {
      await page.goto(origin + '/#/events');
      await expect(page.getByRole('heading', { name: 'Find your next event.' })).toBeVisible();
      const input = page.getByRole('textbox', { name: 'Event code' });
      expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(input).toHaveCSS('border-radius', '999px');
      await page.goto(origin + '/#/events?event=spatial');
      await expect(page.getByRole('heading', { level: 1, name: 'Spatial Sessions' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Preview event state' })).toHaveCount(0);
      expect((await env.api('bootstrap')).session.activeEventId).toBe('demo');
      await page.getByRole('button', { name: 'Join event', exact: true }).click();
      await expect(page).toHaveURL(/#\/home$/);
      await expect(page.getByRole('heading', { name: 'Spatial Sessions', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enter room' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: '.impeccable/review/workspace-home-' + width + '.png', fullPage: true });
    } finally { await env.close(); }
  });
}

test('event code errors retain input and existing active event', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.goto(origin + '/#/events?join=1');
    await page.getByRole('textbox', { name: 'Event code' }).fill('UNKNOWN');
    await page.getByRole('button', { name: 'Join event', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Event code' })).toHaveValue('UNKNOWN');
    expect((await env.api('bootstrap')).session.activeEventId).toBe('demo');
  } finally { await env.close(); }
});

test('event calendar uses event timestamps and unknown event is recoverable', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.goto(origin + '/#/events?event=spatial');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    expect((await download).suggestedFilename()).toBe('spatial.ics');
    await page.goto(origin + '/#/events?event=missing');
    await expect(page.getByRole('heading', { name: 'Event unavailable' })).toBeVisible();
    await page.getByRole('button', { name: 'Explore events' }).click();
    await expect(page.getByRole('heading', { name: 'Find your next event.' })).toBeVisible();
  } finally { await env.close(); }
});
