import { test, expect } from '@playwright/test';
import { createServer } from '../../server/index.mjs';
const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';

for (const width of [1440, 390]) test(`two people can request, accept and follow up at ${width}px`, async ({ browser }) => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, session, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`${apiOrigin}/api/${path}`, { method, headers: { 'content-type': 'application/json', ...(session ? { 'x-session-id': session } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    expect(response.ok).toBeTruthy();
    return response.json();
  };
  const contexts = [];
  try {
    const pages = [];
    for (const id of ['alex', 'maya']) {
      const state = await api('login', null, { profileId: id });
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      contexts.push(context);
      await context.addInitScript(session => sessionStorage.setItem('questmatch-session', session), state.session.id);
      await context.route('**/api/**', async route => {
        const response = await route.fetch({ url: apiOrigin + new URL(route.request().url()).pathname });
        await route.fulfill({ response });
      });
      pages.push({ page: await context.newPage(), session: state.session.id });
    }
    const [alex, maya] = pages;
    await alex.page.goto(origin + '/#/home');
    await expect(alex.page.getByRole('button', { name: 'Meet people', exact: true })).toBeVisible();
    await alex.page.screenshot({ path: `.impeccable/review/connection-home-${width}.png`, fullPage: true });
    await alex.page.getByRole('button', { name: 'Meet people', exact: true }).click();
    await alex.page.getByRole('button', { name: "View Maya Chen's profile" }).click();
    await alex.page.getByRole('button', { name: 'Request to connect' }).click();
    await expect(alex.page.getByRole('button', { name: 'Request sent' })).toBeVisible();
    await expect(alex.page.getByRole('button', { name: 'Save connection' })).toContainText('Save profile');
    await alex.page.keyboard.press('Escape');
    await alex.page.goto(origin + '/#/network');
    await expect(alex.page.getByRole('button', { name: 'Cancel request to Maya Chen' })).toBeVisible();
    await maya.page.goto(origin + '/#/network');
    await expect(maya.page.getByRole('button', { name: "Accept Alex Morgan's request" })).toBeVisible();
    await maya.page.screenshot({ path: `.impeccable/review/requests-${width}.png`, fullPage: true });
    await maya.page.getByRole('button', { name: "Accept Alex Morgan's request" }).click();
    await expect(maya.page.getByRole('button', { name: "View Alex Morgan's profile" })).toBeVisible();
    await alex.page.bringToFront();
    await alex.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(alex.page.getByRole('button', { name: "View Maya Chen's profile" })).toBeVisible();
    await alex.page.getByRole('button', { name: "View Maya Chen's profile" }).click();
    await expect(alex.page.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
    await alex.page.getByRole('button', { name: 'Follow up', exact: true }).click();
    await alex.page.getByLabel('Private notes').fill('Discuss the wearable prototype next week.');
    await alex.page.getByRole('button', { name: 'Save follow-up', exact: true }).click();
    await expect(alex.page.getByText('Connection details saved.', { exact: true })).toBeVisible();
    const alexState = await api('bootstrap', alex.session);
    const own = alexState.connections.find(connection => connection.participantId === 'maya');
    expect(own.saved).toBe(false);
    expect(own.notes).toBe('Discuss the wearable prototype next week.');
    const mayaState = await api('bootstrap', maya.session);
    expect(mayaState.connections.find(connection => connection.participantId === 'alex').notes).toBe('');
    await alex.page.screenshot({ path: `.impeccable/review/connected-profile-${width}.png`, fullPage: true });
    await alex.page.keyboard.press('Escape');
    await alex.page.goto(origin + '/#/events?event=demo&tab=recap');
    await expect(alex.page.getByText('1 connected · 3 saved privately', { exact: true })).toBeVisible();
    await expect(alex.page.getByRole('button', { name: 'Cancel request to Maya Chen' })).toHaveCount(0);
    await expect(alex.page.getByText('Discuss the wearable prototype next week.')).toBeVisible();
    await alex.page.screenshot({ path: `.impeccable/review/connection-recap-${width}.png`, fullPage: true });
    expect(await alex.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  } finally {
    await Promise.all(contexts.map(context => context.unrouteAll({ behavior: 'wait' })));
    await Promise.all(contexts.map(context => context.close()));
    await new Promise(resolve => server.close(resolve));
  }
});
