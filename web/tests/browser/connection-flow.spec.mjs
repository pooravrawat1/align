import { test, expect } from '@playwright/test';
import { createServer } from '../../server/index.mjs';
const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';

for (const width of [1440, 390]) test(`a person you meet becomes a private memory at ${width}px`, async ({ browser }) => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, session) => {
    const response = await fetch(`${apiOrigin}/api/${path}`, { headers: session ? { 'x-session-id': session } : {} });
    expect(response.ok).toBeTruthy();
    return response.json();
  };
  const state = await fetch(`${apiOrigin}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profileId: 'alex' }),
  }).then(response => response.json());
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(session => sessionStorage.setItem('questmatch-session', session), state.session.id);
    await context.route('**/api/**', async route => {
      const requestUrl = new URL(route.request().url());
      const response = await route.fetch({ url: apiOrigin + requestUrl.pathname + requestUrl.search });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    await page.goto(origin + '/#/home');
    await page.getByRole('button', { name: 'Meet people', exact: true }).click();
    await page.getByRole('button', { name: "View Maya Chen's profile" }).click();
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Score unavailable|Compatibility is unavailable/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Remember this person' }).click();
    await expect(page.getByRole('button', { name: 'Remove from your people' })).toContainText('Remembered');
    await page.keyboard.press('Escape');

    await page.goto(origin + '/#/network');
    await expect(page.getByRole('heading', { name: 'People you’ve met' })).toBeVisible();
    await expect(page.getByRole('button', { name: "View Maya Chen's profile" })).toBeVisible();
    await page.getByRole('button', { name: "View Maya Chen's profile" }).click();
    await expect(page.getByRole('heading', { name: 'What you share' })).toBeVisible();
    await expect(page.getByText('Met at The Builders Room', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Follow up', exact: true }).click();
    await page.getByLabel('Private notes').fill('Discuss the wearable prototype next week.');
    await page.getByRole('button', { name: 'Save follow-up', exact: true }).click();
    await expect(page.getByText('Follow-up details saved.', { exact: true })).toBeVisible();

    const latest = await api('bootstrap', state.session.id);
    const own = latest.connections.find(connection => connection.participantId === 'maya');
    expect(own.notes).toBe('Discuss the wearable prototype next week.');
    expect(own.sharedExperiences).toEqual([
      { kind: 'professional', label: 'Build Together' },
      { kind: 'activity', label: 'Appalachian Trail day hike' },
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  } finally {
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
