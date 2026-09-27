import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const seed = JSON.parse(await readFile(new URL('../../shared/demo-data.json', import.meta.url), 'utf8'));
const assessment = {
  status: 'ready', score: 89,
  reason: 'Leo brings computer vision, which you’re looking for.',
  commonGround: ['Assistive technology', 'Robotics'],
  contributions: [{ userId: 'alex', items: ['Electronics'] }, { userId: 'leo', items: ['Computer vision'] }],
  starter: 'How could vision and embedded hardware help robots navigate around people?',
  categories: [
    { id: 'skills', label: 'Reciprocal skill fit', max: 30, points: 28, evidence: 'Complementary entered skills.' },
    { id: 'goals', label: 'Networking goals', max: 25, points: 22, evidence: 'Both want to exchange expertise.' },
  ],
  source: 'gemini',
};

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

async function openNetwork(page, { customize = () => {} } = {}) {
  const state = structuredClone(seed);
  state.session = { id: 'network-test', userId: 'alex', code: 'DEMO', activeEventId: 'demo', calibrated: false };
  state.matches = [];
  state.demo = true;
  customize(state);
  const traffic = [];
  await page.addInitScript((sessionId) => sessionStorage.setItem('questmatch-session', sessionId), state.session.id);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : null;
    traffic.push({ path: pathname, method: request.method(), body, headers: request.headers() });
    if (pathname === '/api/compatibility') return route.fulfill({ json: assessment });
    if (pathname.startsWith('/api/connections/') && request.method() === 'DELETE') {
      const id = pathname.split('/').at(-1);
      state.connections = state.connections.filter((connection) => (connection.participantId ?? connection.userB) !== id);
    }
    return route.fulfill({ json: structuredClone(state) });
  });
  await page.goto(`${origin}/#/network`);
  await expect(page.getByRole('heading', { name: 'Your network', level: 1 })).toBeVisible();
  return { state, traffic };
}

for (const width of [390, 900, 1440]) {
  test(`saved directory filters remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openNetwork(page, { customize: state => {
      state.connections[0].eventId = 'demo';
      state.connections[1].eventId = 'spatial';
    } });
    const search = page.getByRole('textbox', { name: 'Search people' });
    expect((await search.boundingBox()).width).toBeGreaterThan(220);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const eventFilter = page.getByRole('combobox', { name: 'Filter by event' });
    await eventFilter.selectOption('spatial');
    expect(await page.locator('.nx-person-row').count()).toBeGreaterThan(0);
    await eventFilter.selectOption('all');
    if (width !== 900) await page.screenshot({ path: `.impeccable/review/network-restored-${width}.png`, fullPage: true });
    await search.fill('Jordan');
    await expect(page.locator('.nx-person-row')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('profile opens in the centered shared dialog and reuses its list assessment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { traffic } = await openNetwork(page);
  const row = page.getByRole('button', { name: "View Leo Park's profile" });
  await expect(row.locator('.nx-fit')).toContainText('89/100');
  const initialRequestCount = traffic.filter(({ path }) => path === '/api/compatibility').length;
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Leo Park — full profile' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('89')).toBeVisible();
  await expect(dialog.getByText(assessment.reason)).toBeVisible();
  const box = await dialog.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 500)).toBeLessThan(2);
  expect(traffic.filter(({ path }) => path === '/api/compatibility')).toHaveLength(initialRequestCount);
  const request = traffic.find(({ path, body }) => path === '/api/compatibility' && body.participantId === 'leo');
  expect(request.body).toEqual({ participantId: 'leo', eventId: 'demo', audience: 'network' });
  expect(request.headers['x-session-id']).toBe('network-test');
  await page.goBack();
  await expect(dialog).toHaveCount(0);
});

test('network retains the list behind the profile dialog without map controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 620 });
  await openNetwork(page);
  await expect(page.getByRole('button', { name: /^(Map|Graph)$/ })).toHaveCount(0);
  await page.getByRole('button', { name: "View Jordan Lee's profile" }).click();
  await expect(page.getByRole('dialog', { name: 'Jordan Lee — full profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to network' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: "View Jordan Lee's profile" })).toBeVisible();
});

test('unsaving removes the person without exposing them as global discovery', async ({ page }) => {
  const { traffic } = await openNetwork(page);
  await page.getByRole('button', { name: "View Leo Park's profile" }).click();
  const unsave = page.getByRole('button', { name: 'Unsave connection' });
  await unsave.hover();
  await expect(unsave).toContainText('Unsave');
  await unsave.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: "View Leo Park's profile" })).toHaveCount(0);
  expect(traffic.filter(({ method }) => method === 'DELETE').map(({ path }) => path)).toEqual(['/api/connections/leo']);
  await expect(page.getByText('Discover', { exact: true })).toHaveCount(0);
});

test('a direct event profile link cannot bypass the event roster', async ({ page }) => {
  await openNetwork(page);
  await page.goto(`${origin}/#/network?person=leo&event=spatial&audience=event`);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('This profile is no longer available in this context.')).toBeVisible();
});

test('filters use the shared 44px pill geometry and can recover from zero results', async ({ page }) => {
  await openNetwork(page, { customize: state => {
    state.connections = state.connections.map((connection) => ({ ...connection, followUp: 'contacted' }));
  } });
  await page.getByRole('button', { name: 'Filters' }).click();
  const pills = page.locator('.nx-filter-pill');
  await expect(pills).toHaveCount(3);
  for (const pill of await pills.all()) {
    expect((await pill.boundingBox()).height).toBe(44);
    await expect(pill).toHaveCSS('border-radius', '999px');
  }
  await page.getByRole('checkbox', { name: 'Needs follow-up' }).check();
  await expect(page.getByRole('heading', { name: 'No people in this view' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).last().click();
  expect(await page.locator('.nx-person-row').count()).toBeGreaterThan(0);
});
