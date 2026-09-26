import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const seed = JSON.parse(await readFile(new URL('../../shared/demo-data.json', import.meta.url), 'utf8'));

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

test('opening a profile keeps portraits stationary and expands into a centered contained card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openNetwork(page);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const self = page.locator('.nm-self');
  const before = await self.boundingBox();
  const mapBefore = await page.locator('.nm-map').boundingBox();
  await page.getByRole('button', { name: 'View Jordan Lee, Creative technologist' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const after = await self.boundingBox();
  const mapAfter = await page.locator('.nm-map').boundingBox();
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(mapAfter.width - mapBefore.width)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Explore profile' }).click();
  const dialog = page.getByRole('dialog', { name: 'Jordan Lee — full profile' });
  const card = await dialog.boundingBox();
  expect(card.width).toBeLessThanOrEqual(940);
  expect(card.height).toBeLessThanOrEqual(820);
  expect(Math.abs(card.x + card.width / 2 - 720)).toBeLessThan(2);
  expect(Math.abs(card.y + card.height / 2 - 500)).toBeLessThan(2);
  await page.getByRole('button', { name: "Close Jordan Lee's profile" }).click();
  await expect(page.getByRole('dialog', { name: 'Jordan Lee — profile preview' })).toBeVisible();
  await page.getByRole('button', { name: "Close Jordan Lee's profile" }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(Math.abs((await self.boundingBox()).x - before.x)).toBeLessThan(1);
});

test('selecting and closing a portrait preserves a short viewport map position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await openNetwork(page);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.evaluate(() => scrollTo(0, 300));

  const self = page.locator('.nm-self');
  const beforeScroll = await page.evaluate(() => scrollY);
  const before = await self.boundingBox();
  expect(beforeScroll).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'View Jordan Lee, Creative technologist' }).click();
  await expect(page.getByRole('dialog', { name: 'Jordan Lee — profile preview' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(beforeScroll);
  const opened = await self.boundingBox();
  expect(Math.abs(opened.x - before.x)).toBeLessThan(1);
  expect(Math.abs(opened.y - before.y)).toBeLessThan(1);

  await page.getByRole('button', { name: "Close Jordan Lee's profile" }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(beforeScroll);
  const closed = await self.boundingBox();
  expect(Math.abs(closed.x - before.x)).toBeLessThan(1);
  expect(Math.abs(closed.y - before.y)).toBeLessThan(1);
});

async function openNetwork(page, { customize = () => {} } = {}) {
  const state = structuredClone(seed);
  state.session = { id: 'network-test', userId: 'alex', code: 'DEMO', calibrated: false };
  state.matches = [];
  state.demo = true;
  customize(state);
  const traffic = [];

  await page.addInitScript((sessionId) => {
    sessionStorage.setItem('questmatch-session', sessionId);
    window.testCopiedMessage = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.testCopiedMessage = text;
        },
      },
    });
  }, state.session.id);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const rawBody = request.postData();
    const body = rawBody ? JSON.parse(rawBody) : null;
    traffic.push({ path: pathname, method: request.method(), body });

    if (pathname === '/api/connections' && request.method() === 'POST') {
      const participantId = body?.participantId;
      const exists = state.connections.some((connection) =>
        (connection.ownerId ?? connection.userA) === state.session.userId &&
        (connection.participantId ?? (connection.userA === state.session.userId ? connection.userB : connection.userA)) === participantId,
      );
      if (!exists) {
        const [userA, userB] = [state.session.userId, participantId].sort();
        state.connections.push({
          userA,
          userB,
          ownerId: state.session.userId,
          participantId,
          eventId: 'demo',
          createdAt: '2026-09-26T15:00:00Z',
          notes: '',
          followUp: 'needed',
          reminderDate: '',
        });
      }
    }

    await route.fulfill({ json: structuredClone(state) });
  });

  await page.goto(`${origin}/#/network`);
  await expect(page.getByRole('heading', { name: 'Your network', level: 1 })).toBeVisible();
  return { state, traffic };
}

async function expectPortraitsInsideMap(page, expectedCount) {
  const map = page.locator('.nm-map');
  const portraits = map.locator('.nm-portrait');
  await expect(portraits).toHaveCount(expectedCount);
  await expect(portraits.first()).toBeVisible();
  const mapBox = await map.boundingBox();
  expect(mapBox).not.toBeNull();
  for (const portrait of await portraits.all()) {
    const box = await portrait.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(mapBox.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(mapBox.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(mapBox.x + mapBox.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
  }
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`map selection, expansion and browser history preserve camera and draft on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openNetwork(page);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expectPortraitsInsideMap(page, 4);

    const zoom = page.getByLabel('Current zoom');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const changedZoom = await zoom.textContent();
    expect(changedZoom).not.toBe('100%');

    await page.getByRole('button', { name: 'View Jordan Lee, Creative technologist' }).click();
    await expect(page.getByRole('dialog', { name: 'Jordan Lee — profile preview' })).toBeVisible();
    await expect(zoom).toHaveText(changedZoom);

    await page.getByRole('button', { name: 'Explore profile' }).click();
    const fullProfile = page.getByRole('dialog', { name: 'Jordan Lee — full profile' });
    await expect(fullProfile).toBeVisible();
    const expandedCard = await fullProfile.boundingBox();
    expect(expandedCard.height).toBeLessThanOrEqual(viewport.height * 0.8 + 2);
    expect(Math.abs(expandedCard.x + expandedCard.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(expandedCard.y + expandedCard.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await page.getByText('Draft a message', { exact: true }).click();
    const draft = page.getByLabel('Message draft', { exact: true });
    await draft.fill('Jordan — let’s compare prototypes after the event.');
    await page.getByRole('button', { name: 'Copy message' }).click();
    await expect.poll(() => page.evaluate(() => window.testCopiedMessage)).toBe('Jordan — let’s compare prototypes after the event.');

    await page.getByRole('button', { name: 'Back to network' }).click();
    await expect(page.getByRole('dialog', { name: 'Jordan Lee — profile preview' })).toBeVisible();
    await expect(zoom).toHaveText(changedZoom);
    await page.getByRole('button', { name: 'Explore profile' }).click();
    await expect(draft).toHaveValue('Jordan — let’s compare prototypes after the event.');

    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Jordan Lee — profile preview' })).toBeVisible();
    await expect(zoom).toHaveText(changedZoom);
    await page.goBack();
    await expect(page).toHaveURL(/#\/network$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(zoom).toHaveText(changedZoom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Discover selection saves through the mock state and appears in Your network', async ({ page }) => {
  const { traffic } = await openNetwork(page);
  await page.locator('.nx-destinations > button').filter({ hasText: 'Discover' }).click();
  const maya = page.locator('.nx-discover-card').filter({ hasText: 'Maya Chen' });
  await expect(maya).toBeVisible();
  await maya.click();
  await expect(page.getByRole('dialog', { name: 'Maya Chen — profile preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled();

  const saveRequests = traffic.filter((request) => request.path === '/api/connections' && request.method === 'POST');
  expect(saveRequests).toEqual([{ path: '/api/connections', method: 'POST', body: { participantId: 'maya' } }]);

  await page.locator('.nx-destinations > button').filter({ hasText: 'Your network' }).click();
  await expect(page.getByRole('button', { name: "View Maya Chen's profile" })).toBeVisible();
  await expect(page.locator('.nx-destinations > button').filter({ hasText: 'Your network' })).toContainText('4');
});

test('arbitrary and dense networks render all 24 people and expose cluster reveals', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openNetwork(page, {
    customize: (state) => {
      const user = state.profiles.find((profile) => profile.id === 'alex');
      const topicCycle = ['Assistive technology', 'Open source', 'Robotics'];
      const template = state.profiles.find((profile) => profile.id === 'maya');
      const people = Array.from({ length: 24 }, (_, index) => ({
        ...template,
        id: `dense-${String(index + 1).padStart(2, '0')}`,
        name: `Person ${String(index + 1).padStart(2, '0')}`,
        role: `Builder ${index + 1}`,
        interests: [topicCycle[index % topicCycle.length]],
        avatar: template.avatar,
      }));
      state.profiles = [user, ...people];
      state.connections = people.map((person, index) => ({
        userA: 'alex',
        userB: person.id,
        ownerId: 'alex',
        participantId: person.id,
        eventId: index % 2 ? 'spatial' : 'demo',
        createdAt: `2026-09-26T${String(10 + (index % 10)).padStart(2, '0')}:00:00Z`,
      }));
    },
  });

  await page.getByRole('button', { name: 'Map', exact: true }).click();

  await expect(page.locator('.nm-person')).toHaveCount(25);
  await expect(page.locator('.nm-cluster')).toHaveCount(1);
  await page.locator('.nm-cluster').click();
  await expect(page.locator('button.nm-person').first()).toBeVisible();

  await page.getByLabel('Group map by').selectOption('interest');
  await expect(page.locator('.nm-person')).toHaveCount(25);
  await expect(page.locator('.nm-cluster')).toHaveCount(3);
  await page.locator('.nm-cluster').first().click();
  await expect(page.locator('button.nm-person').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('a filter with zero matches offers a clear path back to the map', async ({ page }) => {
  await openNetwork(page, {
    customize: (state) => {
      state.connections = state.connections.map((connection) => ({ ...connection, followUp: 'contacted' }));
    },
  });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Needs follow-up' }).check();
  await expect(page.getByRole('heading', { name: 'No people in this view' })).toBeVisible();
  await expect(page.locator('.nm-map')).toHaveCount(0);
  await page.getByRole('region', { name: 'Saved people' }).getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.nm-map')).toBeVisible();
  await expect(page.locator('.nm-person')).toHaveCount(4);
});

test('hidden profile fields never leak into common ground or sample AI copy', async ({ page }) => {
  const privateTokens = [
    'PRIVATE_BIO_SENTINEL',
    'PRIVATE_INTEREST_SENTINEL',
    'PRIVATE_SKILL_SENTINEL',
    'PRIVATE_GOAL_SENTINEL',
  ];
  await openNetwork(page, {
    customize: (state) => {
      const user = state.profiles.find((profile) => profile.id === 'alex');
      const leo = state.profiles.find((profile) => profile.id === 'leo');
      user.interests.push(privateTokens[1]);
      user.lookingFor.push(privateTokens[2]);
      user.skills.push(privateTokens[3]);
      leo.bio = privateTokens[0];
      leo.interests = [privateTokens[1]];
      leo.skills = [privateTokens[2]];
      leo.lookingFor = [privateTokens[3]];
      leo.visibility = {
        ...leo.visibility,
        bio: false,
        interests: false,
        skills: false,
        lookingFor: false,
        previousConnections: true,
      };
    },
  });

  await page.getByRole('button', { name: "View Leo Park's profile" }).click();
  await expect(page.locator('.np-preview-section')).toContainText('No shared interests are visible yet.');
  for (const token of privateTokens) await expect(page.getByText(token, { exact: false })).toHaveCount(0);

  await page.getByRole('button', { name: 'Explore profile' }).click();
  await expect(page.getByRole('heading', { name: 'Common ground' })).toBeVisible();
  await page.getByText('AI insight', { exact: true }).click();
  const guardedSurfaces = page.locator('.np-main, .np-compatibility');
  const renderedCopy = await guardedSurfaces.allTextContents();
  for (const token of privateTokens) expect(renderedCopy.join(' ')).not.toContain(token);
});

for (const width of [1440, 390]) {
  test(`People view uses dashboard typography and opens a profile at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openNetwork(page);
    await page.goto(`${origin}/#/home`);
    const homeSizes = await page.locator('.home-connection-profile .product-connection-copy').first().evaluate(node => ({
      name: getComputedStyle(node.querySelector('strong')).fontSize,
      role: getComputedStyle(node.querySelector('strong small')).fontSize,
      reason: getComputedStyle(node.querySelector(':scope > span')).fontSize,
    }));
    await page.goto(`${origin}/#/network`);
    await expect(page.getByRole('button', { name: 'People', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Person', { exact: true })).toHaveCount(0);
    const row = page.getByRole('button', { name: "View Leo Park's profile", exact: true });
    await expect(row).toBeVisible();
    const listSizes = await row.locator('.nx-row-identity').evaluate(node => ({
      name: getComputedStyle(node.querySelector('strong')).fontSize,
      role: getComputedStyle(node.querySelector(':scope > span')).fontSize,
      reason: getComputedStyle(node.querySelector('small')).fontSize,
    }));
    expect(listSizes).toEqual(homeSizes);
    await expect(page.locator('.nx-page')).not.toContainText(/sample|demo|interactive preview/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row.click();
    await expect(page.getByRole('dialog', { name: 'Leo Park — profile preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Explore profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Leo Park — full profile' })).toBeVisible();
  });
}
