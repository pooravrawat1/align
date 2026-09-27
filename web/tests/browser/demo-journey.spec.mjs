import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

for (const persona of ['alex', 'maya']) {
  test(`${persona} can browse attendees without joining or extra demo-navigation UI`, async ({ page }) => {
    const env = await workspace(page, { join: false, profileId: persona });
    try {
      await page.goto(origin + '/#/login');
      await expect(page.getByRole('button', { name: /Explore demo as/ })).toHaveCount(0);
      await expect(page.getByText(/Use the prepared fictional profile/)).toHaveCount(0);
      await page.goto(origin + '/#/home');
      await expect(page.getByRole('link', { name: 'View example recap', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Meet people', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'People at this event', exact: true })).toBeVisible();
      expect((await env.api('bootstrap')).session.code).toBeNull();
      await page.goto(origin + '/#/events?event=spatial');
      await page.getByRole('button', { name: 'People', exact: true }).click();
      await expect(page.getByRole('button', { name: "View Elena Petrova's profile", exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: "View Nina Patel's profile", exact: true })).toHaveCount(0);
      expect((await env.api('bootstrap')).session.code).toBeNull();
      await expect(page.getByRole('link', { name: 'View example recap', exact: true })).toHaveCount(0);
      await page.goto(origin + '/#/network');
      await expect(page.getByRole('link', { name: 'View example recap', exact: true })).toHaveCount(0);
      await page.goto(origin + '/#/events');
      await page.getByRole('link', { name: 'Try a completed-conference demo', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`recap-demo\\?persona=${persona}$`));
    } finally { await env.close(); }
  });
}

test('profile surfaces show concrete project, offered skills, and sought expertise', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.goto(origin + '/#/events?event=demo&tab=people');
    await page.getByRole('button', { name: "View Maya Chen's profile", exact: true }).click();
    const profile = page.getByRole('dialog', { name: 'Maya Chen — full profile' });
    await expect(profile.getByRole('heading', { name: 'What Maya is working on', exact: true })).toBeVisible();
    await expect(profile.locator('.np-project')).toContainText('visual-assistance demo');
    await profile.getByText('More about Maya', { exact: true }).click();
    await expect(profile.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();
    await expect(profile.getByRole('heading', { name: 'Looking for', exact: true })).toBeVisible();
    const details = profile.locator('.np-more-profile');
    await expect(details).toContainText('Computer vision');
    await expect(details).toContainText('Embedded systems');
  } finally { await env.close(); }
});
