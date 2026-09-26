import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

const generated = { source: 'gemini', summary: 'You discussed testing a wearable prototype.', nextStep: 'Suggest a testing session.', message: 'Hi Maya, following up on our prototype discussion. Would you like to plan a testing session?', evidence: ['prototype'] };
for (const width of [1440, 390]) {
  test(`completed-conference journey is usable and persistent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/bootstrap', route => route.abort());
    let input;
    await page.route('**/api/follow-up-demo', async route => { input = route.request().postDataJSON(); await route.fulfill({ json: generated }); });
    await page.goto(origin + '/#/recap-demo');
    await expect(page.getByRole('heading', { name: 'Your event recap' })).toBeVisible();
    await expect(page.getByText('4 connected · 1 saved privately', { exact: true })).toBeVisible();
    const maya = page.locator('.recap-report-person').filter({ hasText: 'Maya Chen' });
    await maya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await maya.getByLabel('Your meeting note').fill('Discussed my prototype. Send a demo and arrange a test.');
    await maya.getByRole('button', { name: 'Generate with Gemini' }).click();
    await expect(maya.getByText('Gemini draft', { exact: true })).toBeVisible();
    expect(input.notes).toContain('arrange a test');
    await expect(maya.getByLabel('Your follow-up message')).toHaveValue(generated.message);
    await maya.getByLabel('Your follow-up message').fill('My edited message for Maya.');
    await page.reload();
    await maya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await expect(maya.getByLabel('Your follow-up message')).toHaveValue('My edited message for Maya.');
    await expect(maya.getByLabel('Your meeting note')).toHaveValue('Discussed my prototype. Send a demo and arrange a test.');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await maya.getByRole('button', { name: 'Copy message' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('My edited message for Maya.');
    await expect(maya.getByRole('button', { name: 'Mark contacted', exact: true })).toBeVisible();
    await maya.getByRole('button', { name: 'Mark contacted', exact: true }).click();
    await expect(maya.getByRole('button', { name: 'Mark to follow up' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.impeccable/review/conference-recap-${width}.png`, fullPage: true });
    await page.reload();
    await expect(maya.getByRole('button', { name: 'Mark to follow up' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await expect(maya.getByRole('button', { name: 'Mark contacted', exact: true })).toBeVisible();
    await maya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await expect(maya.getByLabel('Your follow-up message')).not.toHaveValue('My edited message for Maya.');
  });
}

test('Gemini failure keeps an editable prepared draft; another visitor starts fresh', async ({ page, browser }) => {
  await page.route('**/api/bootstrap', route => route.abort());
  await page.route('**/api/follow-up-demo', route => route.fulfill({ status: 503, json: { error: 'Follow-up generation is unavailable.' } }));
  await page.goto(origin + '/#/recap-demo');
  const priya = page.locator('.recap-report-person').filter({ hasText: 'Priya Shah' });
  await priya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  const starter = await priya.getByLabel('Your follow-up message').inputValue();
  expect(starter).toContain('came across your profile');
  expect(starter).not.toMatch(/met|discussed/);
  await priya.getByRole('button', { name: 'Generate with Gemini' }).click();
  await expect(priya.getByRole('alert')).toBeVisible();
  await expect(priya.getByLabel('Your follow-up message')).toHaveValue(starter);
  await priya.getByRole('button', { name: 'Mark contacted', exact: true }).click();
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await second.goto(origin + '/#/recap-demo');
    await expect(second.locator('.recap-report-person').filter({ hasText: 'Priya Shah' }).getByRole('button', { name: 'Mark contacted', exact: true })).toBeVisible();
  } finally { await other.close(); }
});

test('Events demo entry and ordinary recap use the existing event route and owner metadata', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.goto(origin + '/#/events');
    await page.getByRole('link', { name: 'Try a completed-conference demo' }).click();
    await expect(page).toHaveURL(/#\/recap-demo$/);
    await page.getByRole('link', { name: 'Back to events' }).click();
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    const leo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
    await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await leo.getByLabel('Your meeting note').fill('Ask about the navigation experiment.');
    await leo.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(leo.getByRole('button', { name: 'Save note', exact: true })).toBeDisabled();
    expect((await env.api('bootstrap')).connections.find(item => item.participantId === 'leo').notes).toBe('Ask about the navigation experiment.');
    await leo.getByRole('button', { name: 'Mark contacted', exact: true }).click();
    await expect(leo.getByRole('button', { name: 'Mark to follow up' })).toBeVisible();
  } finally { await env.close(); }
});

test('observed profile withdrawal discards the old draft even after sharing is restored', async ({ page }) => {
  const env = await workspace(page);
  try {
    let withdrawn = false;
    await page.route('**/api/bootstrap', async route => {
      const snapshot = await env.api('bootstrap');
      if (withdrawn) snapshot.profiles.find(profile => profile.id === 'leo').visibility.previousConnections = false;
      await route.fulfill({ json: snapshot });
    });
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    const leo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
    await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await leo.getByLabel('Your follow-up message').fill('Old private-context message.');
    await page.goto(origin + '/#/home');
    withdrawn = true;
    await page.reload();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('catalyst-follow-up:')).length)).toBe(0);
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    await expect(leo.getByText('Shared profile is private', { exact: true })).toBeVisible();
    await expect(leo.getByRole('button', { name: 'Draft follow-up', exact: true })).toHaveCount(0);
    withdrawn = false;
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    await page.reload();
    await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await expect(leo.getByLabel('Your follow-up message')).not.toHaveValue('Old private-context message.');
  } finally { await env.close(); }
});

test('Home leads to the event recap after the featured event ends', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.route('**/api/bootstrap', async route => {
      const snapshot = await env.api('bootstrap');
      snapshot.events.find(event => event.id === 'demo').endsAt = '2020-01-01T00:00:00Z';
      await route.fulfill({ json: snapshot });
    });
    await page.goto(origin + '/#/home');
    await page.getByRole('button', { name: 'View recap' }).click();
    await expect(page).toHaveURL(/#\/events\?event=demo&tab=recap$/);
    await expect(page.getByRole('heading', { name: 'Your event recap' })).toBeVisible();
  } finally { await env.close(); }
});

test('editing a meeting note cancels a stale in-flight draft', async ({ page }) => {
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/api/follow-up-demo', async route => { began(); await hold; try { await route.fulfill({ json: generated }); } catch { /* Request was aborted by the editor. */ } });
  await page.goto(origin + '/#/recap-demo');
  const maya = page.locator('.recap-report-person').filter({ hasText: 'Maya Chen' });
  await maya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  const original = await maya.getByLabel('Your follow-up message').inputValue();
  await maya.getByRole('button', { name: 'Generate with Gemini' }).click();
  await started;
  await maya.getByLabel('Your meeting note').fill('A different next step.');
  release();
  await expect(maya.getByLabel('Your follow-up message')).toBeEnabled();
  await expect(maya.getByLabel('Your follow-up message')).toHaveValue(original);
  await expect(maya.getByText('Your context changed.', { exact: false })).toBeVisible();
});

for (const action of ['Clear event data', 'Sign out']) {
  test(`${action} removes private follow-up drafts`, async ({ page }) => {
    const env = await workspace(page);
    try {
      await page.goto(origin + '/#/events?event=demo&tab=recap');
      const leo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
      await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
      await leo.getByLabel('Your follow-up message').fill('A private draft to remove.');
      expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('catalyst-follow-up:')).length)).toBe(1);
      await page.goto(origin + '/#/profile?section=settings');
      await page.getByRole('button', { name: action, exact: true }).click();
      await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('catalyst-follow-up:')).length)).toBe(0);
    } finally { await env.close(); }
  });
}

test('expired follow-up session returns to entry and clears private drafts', async ({ page }) => {
  const env = await workspace(page);
  try {
    await page.route('**/api/follow-up', route => route.fulfill({ status: 401, json: { error: 'Valid x-session-id header required' } }));
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    const leo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
    await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await leo.getByRole('button', { name: 'Generate with Gemini' }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('catalyst-follow-up:')).length)).toBe(0);
  } finally { await env.close(); }
});

test('a saved person marked no follow-up needed stays out of the follow-up queue', async ({ page }) => {
  const env = await workspace(page);
  try {
    await env.api('connections/leo', { followUp: 'none' }, 'PATCH');
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    await page.getByRole('button', { name: 'To follow up', exact: true }).click();
    await expect(page.locator('.recap-report-person').filter({ hasText: 'Leo Park' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Everyone', exact: true }).click();
    await expect(page.locator('.recap-report-person').filter({ hasText: 'Leo Park' })).toBeVisible();
  } finally { await env.close(); }
});
