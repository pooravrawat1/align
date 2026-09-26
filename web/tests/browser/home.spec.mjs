import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

for (const width of [1440, 390]) {
  test('Home event workspace shares full profiles and preserves navigation at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const env = await workspace(page);
    try {
      await page.goto(origin + '/#/home');
      await expect(page.getByRole('heading', { name: 'Good to see you, Alex.' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'The Builders Room', exact: true })).toBeVisible();
      await expect(page.getByText('Assessing fit…')).toHaveCount(0);
      await page.screenshot({ path: '.impeccable/review/workspace-home-' + width + '.png', fullPage: true });
      await page.getByRole('button', { name: 'Find collaborators', exact: true }).click();
      await expect(page).toHaveURL(/home\?tab=people/);
      const search = page.getByRole('textbox', { name: /Search/ });
      await search.fill('Maya');
      const row = page.getByRole('button', { name: "View Maya Chen's profile" });
      await row.click();
      await expect(page.getByRole('dialog', { name: 'Maya Chen — full profile' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Save (connection|person|to)/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(search).toHaveValue('Maya');
      await expect(row).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: '.impeccable/review/workspace-people-' + width + '.png', fullPage: true });
    } finally { await env.close(); }
  });
}

for (const width of [1440, 390]) {
  test('fresh demo Home restores the event hero and joins on Enter room at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const env = await workspace(page, { join: false });
    try {
      await page.goto(origin + '/#/home');
      await expect(page.getByRole('heading', { name: 'The Builders Room', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your focus' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recent connections' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Other events' })).toBeVisible();
      await expect(page.getByText('Choose an event', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('group', { name: 'Event workspace' })).toHaveCount(0);
      expect((await env.api('bootstrap')).session.code).toBeNull();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: '.impeccable/review/home-restored-' + width + '.png', fullPage: true });
      await page.getByRole('button', { name: 'Enter room', exact: true }).click();
      await expect(page).toHaveURL(/#\/spatial$/);
      expect((await env.api('bootstrap')).session.code).toBe('DEMO');
    } finally { await env.close(); }
  });
}

test('event people exclude another event roster and saving keeps its event provenance', async ({ page }) => {
  const env = await workspace(page, { code: 'SPATIAL' });
  try {
    await page.goto(origin + '/#/home?tab=people');
    await expect(page.getByRole('button', { name: "View Maya Chen's profile" })).toBeVisible();
    await expect(page.getByRole('button', { name: "View Nina Patel's profile" })).toHaveCount(0);
    await page.getByRole('button', { name: "View Maya Chen's profile" }).click();
    await page.getByRole('button', { name: /Save (connection|person|to)/ }).click();
    await expect(page.getByRole('button', { name: 'Unsave connection' })).toBeVisible();
    const saved = await env.api('bootstrap');
    expect(saved.connections.find(item => item.participantId === 'maya')?.eventId).toBe('spatial');
    await page.keyboard.press('Escape');
    await page.goto(origin + '/#/network');
    await expect(page.getByRole('button', { name: "View Maya Chen's profile" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discover', exact: true })).toHaveCount(0);
  } finally { await env.close(); }
});

test('leaving spatial presence preserves selected event workspace and direct profile links', async ({ page }) => {
  const env = await workspace(page);
  try {
    await env.api('leave', {});
    await page.goto(origin + '/#/home?tab=people&person=maya&event=demo');
    await expect(page.getByRole('dialog', { name: 'Maya Chen — full profile' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'The Builders Room', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/home\?tab=people/);
  } finally { await env.close(); }
});

test('leaving preserves spatial re-entry and selected-event clearing', async ({ page }) => {
  const env = await workspace(page, { code: 'SPATIAL' });
  try {
    await env.api('connections', { participantId: 'maya', eventId: 'spatial' });
    await env.api('leave', {});
    await page.goto(origin + '/#/spatial');
    await expect(page.getByRole('textbox')).toHaveValue('SPATIAL');
    await page.goto(origin + '/#/profile?section=settings');
    await page.getByRole('button', { name: 'Clear event data', exact: true }).click();
    await expect.poll(async () => (await env.api('bootstrap')).connections.some(item => item.participantId === 'maya')).toBe(false);
    const result = await env.api('bootstrap');
    expect(result.connections.some(item => item.participantId === 'leo')).toBe(true);
    expect(result.session.activeEventId).toBe('spatial');
  } finally { await env.close(); }
});

test('prefetched compatibility settles after effect replay and explicit retry reaches the service', async ({ page }) => {
  const env = await workspace(page);
  const requests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/compatibility') requests.push(request.postDataJSON());
  });
  try {
    await page.goto(origin + '/#/home');
    await page.getByRole('button', { name: "View Leo Park's profile" }).click();
    const retry = page.getByRole('button', { name: 'Try compatibility again' });
    await expect(retry).toBeVisible();
    await expect(page.getByText('Finding the strongest reason for you to talk…')).toHaveCount(0);
    await retry.click();
    await expect.poll(() => requests.some(request => request.participantId === 'leo' && request.retry === true)).toBe(true);
    await expect(retry).toBeVisible();
  } finally { await env.close(); }
});
