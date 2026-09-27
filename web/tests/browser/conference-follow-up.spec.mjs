import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workspace, origin } from './workspace-fixture.mjs';
const recapFixture = JSON.parse(readFileSync(new URL('../../shared/recap-demo.json', import.meta.url), 'utf8'));

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
    expect(input.ownerId).toBe('alex');
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
    await page.getByRole('button', { name: 'Reset recap' }).click();
    await expect(maya.getByRole('button', { name: 'Mark contacted', exact: true })).toBeVisible();
    await maya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await expect(maya.getByLabel('Your follow-up message')).not.toHaveValue('My edited message for Maya.');
  });
}

test('prepared Alex and Maya recaps remain reciprocal and isolated', async ({ page }) => {
  await page.goto(origin + '/#/recap-demo?persona=alex');
  await expect(page.getByRole('heading', { name: "Alex Morgan's recap" })).toBeVisible();
  const alexMaya = page.locator('.recap-report-person').filter({ hasText: 'Maya Chen' });
  await expect(alexMaya.locator('.recap-conversation-length')).toContainText('6 minutes');
  await alexMaya.getByRole('button', { name: 'Mark contacted', exact: true }).click();

  await page.getByRole('link', { name: 'Maya Chen', exact: true }).click();
  await expect(page).toHaveURL(/recap-demo\?persona=maya/);
  await expect(page.getByRole('heading', { name: "Maya Chen's recap" })).toBeVisible();
  const mayaAlex = page.locator('.recap-report-person').filter({ hasText: 'Alex Morgan' });
  await expect(mayaAlex.locator('.recap-conversation-length')).toContainText('6 minutes');
  await expect(mayaAlex.getByText(/testing my detection model on Alex’s wearable prototype/)).toBeVisible();
  await expect(mayaAlex.getByRole('button', { name: 'Mark contacted', exact: true })).toBeVisible();

  const saved = page.locator('.recap-report-person').filter({ hasText: 'Elena Petrova' });
  await expect(saved.getByText('Why you saved this profile', { exact: true })).toBeVisible();
  await expect(saved.getByText('Saved for later · No conversation recorded.')).toBeVisible();
  await expect(saved).not.toContainText('minutes');
  await saved.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await expect(saved.getByLabel('Your private note')).toBeVisible();
  await expect(saved.getByText('Why save this person? What would you like to follow up on?', { exact: true })).toBeVisible();
  await saved.getByLabel('Your private note').fill('Ask Elena about directional audio cues.');
  await saved.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByText('Private note saved.', { exact: true })).toBeVisible();
  await saved.getByRole('button', { name: 'Close draft', exact: true }).click();
  await expect(saved.getByText('Your private note', { exact: true })).toBeVisible();
  await expect(saved).not.toContainText('Your meeting note');
  await page.reload();
  await expect(saved.getByText('Your private note', { exact: true })).toBeVisible();
  await expect(saved).toContainText('Ask Elena about directional audio cues.');
  await expect(saved).not.toContainText('Your meeting note');
  await page.getByRole('button', { name: 'Reset recap' }).click();
  await page.getByRole('link', { name: 'Alex Morgan', exact: true }).click();
  await expect(alexMaya.getByRole('button', { name: 'Mark to follow up' })).toBeVisible();
});

test('persona switch owns overlapping notes and discards late generation results', async ({ page }) => {
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/api/follow-up-demo', async route => {
    began();
    await hold;
    try { await route.fulfill({ json: { ...generated, message: 'Late Alex-only result.' } }); }
    catch { /* Switching persona aborts the old editor request. */ }
  });
  await page.goto(origin + '/#/recap-demo?persona=alex');
  const alexLeo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
  await alexLeo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await alexLeo.getByLabel('Your meeting note').fill('Alex-only note for Leo.');
  await alexLeo.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(alexLeo.getByRole('button', { name: 'Save note', exact: true })).toBeDisabled();

  const alexMaya = page.locator('.recap-report-person').filter({ hasText: 'Maya Chen' });
  await alexMaya.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await alexMaya.getByRole('button', { name: 'Generate with Gemini' }).click();
  await started;
  await page.getByRole('link', { name: 'Maya Chen', exact: true }).click();
  const mayaLeo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
  await expect(mayaLeo.getByText(/Compared obstacle-detection approaches/)).toBeVisible();
  await expect(mayaLeo).not.toContainText('Alex-only note for Leo.');
  await mayaLeo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await mayaLeo.getByLabel('Your meeting note').fill('Maya-only note for Leo.');
  await mayaLeo.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(mayaLeo.getByRole('button', { name: 'Save note', exact: true })).toBeDisabled();
  release();
  const mayaAlex = page.locator('.recap-report-person').filter({ hasText: 'Alex Morgan' });
  await expect(mayaAlex).not.toContainText('Late Alex-only result.');
  await expect(page.getByText('Gemini draft', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Alex Morgan', exact: true }).click();
  await expect(alexLeo).toContainText('Alex-only note for Leo.');
  await expect(alexLeo).not.toContainText('Maya-only note for Leo.');
  await alexLeo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await expect(alexLeo.getByLabel('Your meeting note')).toHaveValue('Alex-only note for Leo.');
});

test('stored progress cannot override the prepared identity or relationship', async ({ page }) => {
  await page.addInitScript(version => {
    localStorage.setItem(`catalyst-conference-demo:${version}:maya`, JSON.stringify({
      elena: { notes: 'A private note to keep.', contacted: false, id: 'wrong-person',
        profile: { name: 'Injected identity', interests: [] }, relationship: 'connected',
        sharedInterests: ['Injected common ground'], withdrawn: true },
    }));
  }, recapFixture.version);
  await page.goto(origin + '/#/recap-demo?persona=maya');
  const elena = page.locator('.recap-report-person').filter({ hasText: 'Elena Petrova' });
  await expect(elena).toContainText('Saved privately');
  await expect(elena).toContainText('Your private note');
  await expect(elena).toContainText('A private note to keep.');
  await expect(elena.locator('.recap-conversation-length')).toHaveCount(0);
  await expect(page.getByText('Injected identity', { exact: true })).toHaveCount(0);
  await elena.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await expect(elena.getByLabel('Your private note')).toHaveValue('A private note to keep.');
});

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
    await expect(page).toHaveURL(/#\/recap-demo\?persona=alex$/);
    await page.getByRole('link', { name: 'Back to events' }).click();
    await page.goto(origin + '/#/events?event=demo&tab=recap');
    const leo = page.locator('.recap-report-person').filter({ hasText: 'Leo Park' });
    await leo.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
    await leo.getByLabel('Your private note').fill('Ask about the navigation experiment.');
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
