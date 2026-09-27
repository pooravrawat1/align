import { test, expect } from '@playwright/test';
import { createServer } from '../../server/index.mjs';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';

test('profile prioritizes connection context and follow-up on desktop and mobile', async ({ page }) => {
  const env = await requestWorkspace(page);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/#/home?person=leo&event=demo&audience=network');
      const profile = page.locator('.np-profile');
      await expect(profile.getByRole('heading', { name: 'Why you should connect' })).toBeVisible();
      await expect(profile.locator('.np-follow-up')).toHaveAttribute('open', '');
      await expect(profile.getByRole('button', { name: /Close .*profile/ })).toHaveCount(0);
      await expect(profile.getByText('Leo can help you with', { exact: true })).toBeVisible();
      const layout = await profile.evaluate((node) => {
        const selectors = ['.np-compatibility', '.np-project', '.np-follow-up', '.np-more-profile'];
        const positions = selectors.map(selector => node.querySelector(selector).getBoundingClientRect().top);
        return { ordered: positions.every((top, index) => index === 0 || top > positions[index - 1]), fits: node.scrollWidth <= node.clientWidth };
      });
      expect(layout).toEqual({ ordered: true, fits: true });
      await profile.locator('.np-follow-up').scrollIntoViewIfNeeded();
      await expect(profile.getByLabel('Private notes')).toBeVisible();
      await profile.getByRole('button', { name: 'Back to network' }).click();
      await expect(profile).toHaveCount(0);
      await page.goto(origin + '/#/home?person=leo&event=demo&audience=network');
      await expect(profile).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(profile).toHaveCount(0);
    }
  } finally {
    await env.close();
  }
});

async function requestWorkspace(page) {
  const server = createServer({ env: {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, sessionId, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`${apiOrigin}/api/${path}`, {
      method,
      headers: { ...(sessionId ? { 'x-session-id': sessionId } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response.json();
  };
  const alex = await api('login', null, { profileId: 'alex' });
  const maya = await api('login', null, { profileId: 'maya' });
  await api('room', alex.session.id, { code: 'DEMO' });
  await api('room', maya.session.id, { code: 'DEMO' });
  await page.addInitScript((sessionId) => sessionStorage.setItem('questmatch-session', sessionId), alex.session.id);
  await page.route('**/api/**', async (route) => {
    const response = await route.fetch({ url: apiOrigin + new URL(route.request().url()).pathname });
    await route.fulfill({ response });
  });
  return { api, alex, maya, close: async () => { await page.unrouteAll({ behavior: 'wait' }); await new Promise((resolve) => server.close(resolve)); } };
}

test('a sent request remains separate from the private saved profile', async ({ page }) => {
  const env = await requestWorkspace(page);
  try {
    await page.goto(origin + '/#/home?tab=people&person=maya&event=demo&audience=event');
    await page.getByRole('button', { name: 'Request to connect' }).click();
    await expect(page.getByRole('button', { name: 'Request sent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save connection' })).toContainText('Save profile');
    await page.getByRole('button', { name: 'Cancel request' }).click();
    await expect(page.getByRole('button', { name: 'Request to connect' })).toBeVisible();
  } finally {
    await env.close();
  }
});

test('a saved Network profile can still receive a connection request from its shared event', async ({ page }) => {
  const env = await requestWorkspace(page);
  try {
    await page.goto(origin + '/#/network');
    await page.getByRole('button', { name: "View Leo Park's profile" }).click();
    await expect(page.getByRole('button', { name: 'Request to connect' })).toBeVisible();
    await page.getByRole('button', { name: 'Request to connect' }).click();
    await expect(page.getByRole('button', { name: 'Request sent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unsave connection' })).toContainText('Saved');
  } finally {
    await env.close();
  }
});

test('incoming requests can be accepted and expose an honest follow-up action', async ({ page }) => {
  const env = await requestWorkspace(page);
  try {
    await env.api('profile', env.maya.session.id, { linkedin: 'https://www.linkedin.com/in/maya-chen', visibility: { linkedin: true } }, 'PATCH');
    await env.api('connection-requests', env.maya.session.id, { participantId: 'alex', eventId: 'demo' });
    await page.goto(origin + '/#/home?tab=people&person=maya&event=demo&audience=event');

    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByRole('button', { name: 'Connected' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save connection' })).toContainText('Save profile');
    await expect(page.getByRole('link', { name: 'LinkedIn for Maya Chen' })).toBeVisible();
    await page.getByRole('button', { name: 'Follow up' }).click();
    await page.getByText('Draft a message', { exact: true }).click();
    await expect(page.getByText('Nothing is sent from Catalyst.')).toBeVisible();
    await expect(page.getByLabel('Message draft')).toBeVisible();
  } finally {
    await env.close();
  }
});
