import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

async function enterPreview(page) {
  await page.goto(origin + '/#/spatial');
  await expect(page.getByRole('heading', { level: 1, name: 'Spatial preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
  await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
}

async function expectSceneGeometry(page, expectedIds = ['jordan', 'leo', 'maya']) {
  const geometry = await page.locator('.qmv2-card-field').evaluate((world) => {
    const worldRect = world.getBoundingClientRect();
    const image = world.querySelector('.qmv2-scene');
    const imageRect = image.getBoundingClientRect();
    const people = [...world.querySelectorAll('.qmv2-person-anchor')].map((anchor) => {
      const card = anchor.querySelector('.qmv2-card');
      const tether = anchor.querySelector('.qmv2-card-tether');
      const cardRect = card.getBoundingClientRect();
      const tetherRect = tether.getBoundingClientRect();
      return {
        id: anchor.dataset.personId,
        headX: (tetherRect.left + tetherRect.width / 2 - worldRect.left) / worldRect.width * 100,
        headY: (tetherRect.bottom - worldRect.top) / worldRect.height * 100,
        cardToTether: tetherRect.top - cardRect.bottom,
      };
    });
    return {
      ratio: worldRect.width / worldRect.height,
      imageDelta: {
        left: imageRect.left - worldRect.left,
        top: imageRect.top - worldRect.top,
        width: imageRect.width - worldRect.width,
        height: imageRect.height - worldRect.height,
      },
      people,
    };
  });

  expect(geometry.ratio).toBeCloseTo(1659 / 948, 2);
  for (const delta of Object.values(geometry.imageDelta)) expect(Math.abs(delta)).toBeLessThan(1);
  expect(geometry.people.map(({ id }) => id)).toEqual(expectedIds);
  const expected = { jordan: [24.5, 38], leo: [47.5, 52.4], maya: [74.7, 44.4] };
  for (const person of geometry.people) {
    expect(Math.abs(person.headX - expected[person.id][0])).toBeLessThan(0.25);
    expect(Math.abs(person.headY - expected[person.id][1])).toBeLessThan(0.25);
    expect(Math.abs(person.cardToTether)).toBeLessThan(1.1);
  }
}

test('DEMO renders the seeded people on the photographed heads and keeps them aligned while panning on mobile', async ({ page }) => {
  const env = await workspace(page);
  const matchBodies = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/matches') matchBodies.push(request.postDataJSON());
  });
  try {
    await page.goto(origin + '/#/spatial');
    const entryPhoto = page.locator('.qmv2-stage.is-setup > .qmv2-scene');
    await expect(entryPhoto).toBeVisible();
    await expect(entryPhoto).not.toHaveAttribute('src', '/assets/event-room.webp');

    await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
    const scene = page.locator('.qmv2-card-field .qmv2-scene');
    await expect(scene).toHaveAttribute('src', '/assets/event-room.webp');
    await expect.poll(() => scene.evaluate(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
    await expect.poll(() => matchBodies.length).toBe(1);
    expect(matchBodies[0]).toEqual({ demo: true });
    await expect(page.locator('.qmv2-room-status')).toContainText('Sample match');
    await expect(page.locator('.qmv2-person-anchor')).toHaveCount(3);
    await expect(page.locator('[data-person-id="jordan"] .qmv2-card')).toContainText('Jordan');
    await expect(page.locator('[data-person-id="leo"] .qmv2-card')).toContainText('Leo');
    await expect(page.locator('[data-person-id="maya"] .qmv2-card')).toContainText('Maya');
    await expectSceneGeometry(page);

    await page.setViewportSize({ width: 390, height: 844 });
    const viewport = page.locator('.qmv2-room-viewport');
    await expect(page.getByRole('navigation', { name: 'Look around the demo room' })).toBeVisible();
    const before = await viewport.evaluate(node => node.scrollLeft);
    await page.getByRole('button', { name: 'Look left' }).click();
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeLessThan(before);
    await expectSceneGeometry(page);
  } finally { await env.close(); }
});

test('changed match ranking changes material without moving a person to another photographed slot', async ({ page }) => {
  const env = await workspace(page);
  await page.route('**/api/matches', async route => {
    const state = await env.api('matches', route.request().postDataJSON());
    const jordan = state.matches.find(match => (match.userA === 'alex' && match.userB === 'jordan') || (match.userB === 'alex' && match.userA === 'jordan'));
    Object.assign(jordan, { compatible: true, score: 0.99, reason: 'Changed ranking result.', source: 'fixture' });
    state.matches = [jordan, ...state.matches.filter(match => match !== jordan).reverse()];
    await route.fulfill({ status: 200, json: state });
  });
  try {
    await enterPreview(page);
    await expectSceneGeometry(page);
    const jordan = page.locator('[data-person-id="jordan"] .qmv2-card');
    await expect(jordan).toHaveClass(/is-matched/);
    const material = await jordan.evaluate(node => getComputedStyle(node).borderColor);
    const channels = material.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)?.slice(1).map(Number);
    expect(channels).toBeTruthy();
    expect(channels[1]).toBeGreaterThan(channels[0]);
    expect(channels[1]).toBeGreaterThan(channels[2]);
  } finally { await env.close(); }
});

test('a non-DEMO rules match is green without being labelled as a sample', async ({ page }) => {
  const env = await workspace(page, { code: 'SPATIAL' });
  const matchBodies = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/matches') matchBodies.push(request.postDataJSON());
  });
  await page.route('**/api/matches', async route => {
    const state = await env.api('matches', route.request().postDataJSON());
    const jordan = state.matches.find(match => (match.userA === 'alex' && match.userB === 'jordan') || (match.userB === 'alex' && match.userA === 'jordan'));
    Object.assign(jordan, { compatible: true, score: 0.91, reason: 'Both interested in accessible products.', source: 'rules' });
    await route.fulfill({ status: 200, json: state });
  });
  try {
    await enterPreview(page);
    await expect.poll(() => matchBodies.length).toBe(1);
    expect(matchBodies[0]).toEqual({ demo: false });
    const jordan = page.locator('[data-person-id="jordan"] .qmv2-card');
    await expect(jordan).toHaveClass(/is-matched/);
    await expect(page.locator('.qmv2-room-status')).not.toContainText('Sample match');
    await jordan.click();
    const drawer = page.locator('.qmv2-person-panel');
    await expect(drawer).toContainText('Both interested in accessible products.');
    await expect(drawer).not.toContainText('Sample match');
  } finally { await env.close(); }
});

test('missing cast identities leave holes and other attendees do not inherit a photographed head', async ({ page }) => {
  const env = await workspace(page);
  const limitRoster = state => {
    state.events = state.events.map(event => event.code === 'DEMO' ? { ...event, participantIds: ['alex', 'jordan', 'maya', 'sam'] } : event);
    return state;
  };
  await page.route('**/api/bootstrap', async route => route.fulfill({ status: 200, json: limitRoster(await env.api('bootstrap')) }));
  await page.route('**/api/matches', async route => route.fulfill({ status: 200, json: limitRoster(await env.api('matches', route.request().postDataJSON())) }));
  try {
    await enterPreview(page);
    await expect(page.locator('.qmv2-person-anchor')).toHaveCount(2);
    await expect(page.locator('[data-person-id="leo"], [data-person-id="sam"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^People/ })).toContainText('3');
    await expectSceneGeometry(page, ['jordan', 'maya']);
  } finally { await env.close(); }
});

test('an event roster with no shared participants renders no spatial identities', async ({ page }) => {
  const env = await workspace(page);
  const hideRoster = state => {
    state.events = state.events.map(event => event.code === 'DEMO' ? { ...event, participantIds: ['alex'] } : event);
    return state;
  };
  await page.route('**/api/bootstrap', async route => route.fulfill({ status: 200, json: hideRoster(await env.api('bootstrap')) }));
  await page.route('**/api/matches', async route => route.fulfill({ status: 200, json: hideRoster(await env.api('matches', route.request().postDataJSON())) }));
  try {
    await page.goto(origin + '/#/spatial');
    await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No one nearby yet' })).toBeVisible();
    await expect(page.locator('.qmv2-card-field')).toHaveCount(0);
    await expect(page.locator('.qmv2-person-anchor, .qmv2-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^People/ })).toContainText('0');
  } finally { await env.close(); }
});

test('unjoined entry displays its venue before typing and keeps it stable while editing the code', async ({ page }) => {
  const env = await workspace(page, { join: false });
  const photoRequests = [];
  page.on('request', request => {
    if (/\/assets\/(home-conference|event-audience|event-stage)\.webp$/.test(new URL(request.url()).pathname)) photoRequests.push(request.url());
  });
  try {
    await page.goto(origin + '/#/spatial');
    const code = page.getByRole('textbox', { name: 'Event code' });
    await expect(code).toHaveValue('');
    const photo = page.locator('.qmv2-stage.is-setup > .qmv2-scene');
    await expect(photo).toHaveAttribute('src', '/assets/home-conference.webp');
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const original = await photo.elementHandle();
    for (const value of ['D', 'DEMO', '', 'SPATIAL', 'UNKNOWN']) {
      await code.fill(value);
      await expect(photo).toHaveAttribute('src', '/assets/home-conference.webp');
      expect(await original.evaluate(image => image.isConnected && image.complete && image.naturalWidth > 0)).toBe(true);
    }
    expect(photoRequests).toHaveLength(1);
  } finally { await env.close(); }
});

test('joined entry uses its own venue immediately', async ({ page }) => {
  const env = await workspace(page, { code: 'SPATIAL' });
  try {
    await page.goto(origin + '/#/spatial');
    const photo = page.locator('.qmv2-stage.is-setup > .qmv2-scene');
    await expect(photo).toHaveAttribute('src', '/assets/event-audience.webp');
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  } finally { await env.close(); }
});
