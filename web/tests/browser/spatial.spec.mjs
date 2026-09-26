import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

async function openSpatialEntry(page) {
  await page.goto(origin + '/#/spatial');
  await expect(page.getByRole('heading', { level: 1, name: 'Spatial preview' })).toBeVisible();
}

async function enterJoinedPreview(page) {
  await openSpatialEntry(page);
  await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
  await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
}

async function openMaya(page) {
  await page.getByRole('button', { name: /^People/ }).click();
  const people = page.getByRole('complementary', { name: 'People in this room' });
  await people.getByRole('button').filter({ hasText: 'Maya Chen' }).click();
  const drawer = page.locator('.qmv2-person-panel');
  await expect(drawer.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Save connection', exact: true })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Start conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Finish conversation', exact: true }).click();
  await expect(drawer.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Save connection', exact: true })).toBeVisible();
  return drawer;
}

test('a joined event enters the preview directly without calibration', async ({ page }) => {
  const env = await workspace(page);
  const requests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      requests.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  });
  try {
    await openSpatialEntry(page);
    await expect(page.getByRole('button', { name: 'Enter preview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join and enter', exact: true })).toHaveCount(0);
    await expect(page.getByText(/calibrat/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Enter preview', exact: true }).click();

    await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
    expect(requests.filter(request => request.path === '/api/calibrate')).toEqual([]);
    expect(requests.filter(request => request.path === '/api/room')).toEqual([]);
    expect((await env.api('bootstrap')).session.code).toBe('DEMO');
  } finally { await env.close(); }
});

test('an unjoined entry retains an invalid code, then joins DEMO and enters', async ({ page }) => {
  const env = await workspace(page, { join: false });
  const calibrationRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/calibrate') calibrationRequests.push(request.method());
  });
  try {
    await openSpatialEntry(page);
    const code = page.getByRole('textbox', { name: 'Event code' });
    await expect(page.getByRole('button', { name: 'Join and enter', exact: true })).toBeVisible();

    await code.fill('UNKNOWN');
    await page.getByRole('button', { name: 'Join and enter', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Room not found');
    await expect(code).toHaveValue('UNKNOWN');
    await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toHaveCount(0);

    await code.fill('DEMO');
    await page.getByRole('button', { name: 'Join and enter', exact: true }).click();
    await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
    expect(calibrationRequests).toEqual([]);
    const state = await env.api('bootstrap');
    expect(state.session.code).toBe('DEMO');
    expect(state.session.activeEventId).toBe('demo');
  } finally { await env.close(); }
});

test('saving a selected person submits once and confirms only after success', async ({ page }) => {
  const env = await workspace(page);
  const saves = [];
  let releaseSave = () => {};
  const saveResponse = new Promise(resolve => { releaseSave = resolve; });
  await page.route('**/api/connections', async route => {
    await saveResponse;
    await route.fallback();
  });
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/connections') {
      saves.push(request.postDataJSON());
    }
  });
  try {
    await enterJoinedPreview(page);
    const drawer = await openMaya(page);
    await expect(drawer.getByText('Saved to your network', { exact: true })).toHaveCount(0);

    const save = drawer.getByRole('button', { name: 'Save connection', exact: true });
    await save.evaluate(button => { button.click(); button.click(); });

    await expect.poll(() => saves.length).toBe(1);
    await expect(drawer.getByText('Saved to your network', { exact: true })).toHaveCount(0);
    releaseSave();
    await expect(drawer.getByText('Saved to your network', { exact: true })).toBeVisible();
    expect(saves).toEqual([{ participantId: 'maya' }]);
    const state = await env.api('bootstrap');
    expect(state.connections.filter(connection => connection.ownerId === 'alex' && connection.participantId === 'maya')).toHaveLength(1);
  } finally { releaseSave(); await env.close(); }
});

test('a failed save stays unsaved and a retry can succeed', async ({ page }) => {
  const env = await workspace(page);
  let attempts = 0;
  await page.route('**/api/connections', async route => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Save unavailable' }) });
      return;
    }
    await route.fallback();
  });
  try {
    await enterJoinedPreview(page);
    const drawer = await openMaya(page);
    await drawer.getByRole('button', { name: 'Save connection', exact: true }).click();

    await expect(drawer.getByRole('alert')).toHaveText('Couldn’t save this connection. Try again.');
    await expect(drawer.getByText('Saved to your network', { exact: true })).toHaveCount(0);
    expect((await env.api('bootstrap')).connections.some(connection => connection.ownerId === 'alex' && connection.participantId === 'maya')).toBe(false);

    await drawer.getByRole('button', { name: 'Try saving again', exact: true }).click();
    await expect(drawer.getByText('Saved to your network', { exact: true })).toBeVisible();
    expect(attempts).toBe(2);
    expect((await env.api('bootstrap')).connections.filter(connection => connection.ownerId === 'alex' && connection.participantId === 'maya')).toHaveLength(1);
  } finally { await env.close(); }
});

test('an accepted but unsaved person still offers Save connection', async ({ page }) => {
  const env = await workspace(page);
  await page.route('**/api/bootstrap', async route => {
    const state = await env.api('bootstrap');
    state.connections.push({
      userA: 'alex',
      userB: 'maya',
      ownerId: 'alex',
      participantId: 'maya',
      eventId: 'demo',
      createdAt: '2026-09-26T12:00:00Z',
      notes: '',
      followUp: 'needed',
      reminderDate: '',
      saved: false,
    });
    await route.fulfill({ status: 200, json: state });
  });
  try {
    await enterJoinedPreview(page);
    const drawer = await openMaya(page);
    await expect(drawer.getByText('Saved to your network', { exact: true })).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(drawer.getByText('Saved to your network', { exact: true })).toBeVisible();
    const saved = (await env.api('bootstrap')).connections.find(connection => connection.ownerId === 'alex' && connection.participantId === 'maya');
    expect(saved?.saved).toBe(true);
  } finally { await env.close(); }
});

test('a partial match result keeps its compatible person highlighted', async ({ page }) => {
  const env = await workspace(page);
  await page.route('**/api/matches', async route => {
    const state = await env.api('matches', route.request().postDataJSON());
    state.matches = state.matches.map(match => match.userA === 'maya' || match.userB === 'maya'
      ? { ...match, compatible: true, score: 0.92, reason: 'You both build assistive technology.', source: 'gemini' }
      : { ...match, compatible: false, score: 0, reason: '', source: 'unavailable' });
    await route.fulfill({ status: 200, json: state });
  });
  try {
    await enterJoinedPreview(page);
    await expect(page.locator('.qmv2-room-status')).toContainText('Green means a reason to meet');
    await expect(page.getByText('Matching unavailable. You can still explore people.', { exact: true })).toHaveCount(0);
    const maya = page.getByRole('button', { name: 'Open Maya Chen', exact: true });
    await expect(maya).toBeVisible();
    await expect(maya).toHaveClass(/is-matched/);
    await maya.click();
    await expect(page.locator('.qmv2-person-panel')).toContainText('You both build assistive technology.');
  } finally { await env.close(); }
});

test('Back to event leaves presence while retaining the event, profile, and saved person', async ({ page }) => {
  const env = await workspace(page);
  const leaves = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/leave') leaves.push(request.postDataJSON());
  });
  try {
    await enterJoinedPreview(page);
    const drawer = await openMaya(page);
    await drawer.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(drawer.getByText('Saved to your network', { exact: true })).toBeVisible();
    const before = await env.api('bootstrap');
    const profileBefore = before.profiles.find(profile => profile.id === 'alex');
    const savedBefore = before.connections.find(connection => connection.ownerId === 'alex' && connection.participantId === 'maya');

    await page.getByRole('button', { name: 'Back to event', exact: true }).click();

    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.getByRole('heading', { name: 'The Builders Room', exact: true })).toBeVisible();
    expect(leaves).toEqual([{}]);
    const after = await env.api('bootstrap');
    expect(after.session.code).toBeNull();
    expect(after.session.activeEventId).toBe('demo');
    expect(after.profiles.find(profile => profile.id === 'alex')).toEqual(profileBefore);
    expect(after.connections.find(connection => connection.ownerId === 'alex' && connection.participantId === 'maya')).toEqual(savedBefore);
  } finally { await env.close(); }
});

test('fullscreen keeps navigation and preview controls available', async ({ page }) => {
  const env = await workspace(page);
  try {
    await enterJoinedPreview(page);
    const supported = await page.evaluate(() => document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function');
    test.skip(!supported, 'Fullscreen API is unavailable in this browser');

    await page.getByRole('button', { name: 'Expand spatial preview', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);

    const fullscreen = page.locator(':fullscreen');
    await expect(fullscreen.getByRole('button', { name: 'Back to event', exact: true })).toBeVisible();
    await expect(fullscreen.getByRole('button', { name: 'Preview controls', exact: true })).toBeVisible();
    const exit = fullscreen.getByRole('button', { name: 'Exit fullscreen', exact: true });
    await expect(exit).toBeVisible();
    await exit.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  } finally { await env.close(); }
});

test('Preview controls restore alignment and recover connection loss without changing events', async ({ page }) => {
  const env = await workspace(page);
  const roomRequests = [];
  const matchRequests = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    const path = new URL(request.url()).pathname;
    if (path === '/api/room') roomRequests.push(request.postDataJSON());
    if (path === '/api/matches') matchRequests.push(request.postDataJSON());
  });
  try {
    await enterJoinedPreview(page);
    await expect.poll(() => matchRequests.length).toBe(1);
    const controlsButton = page.getByRole('button', { name: 'Preview controls', exact: true });

    await controlsButton.click();
    let controls = page.getByRole('complementary', { name: 'Preview controls' });
    const alignmentLoss = controls.getByRole('button', { name: 'Alignment loss', exact: true });
    await expect(alignmentLoss).toBeEnabled();
    await alignmentLoss.click();
    await expect(controls).toHaveCount(0);
    let interruption = page.locator('.qmv2-reliability');
    await expect(interruption.getByRole('heading', { name: 'Alignment interrupted', exact: true })).toBeVisible();
    const beforeAlignmentRestore = matchRequests.length;
    const alignmentMatch = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/matches');
    await interruption.getByRole('button', { name: 'Restore preview', exact: true }).click();
    await alignmentMatch;
    await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
    await expect.poll(() => matchRequests.length).toBe(beforeAlignmentRestore + 1);
    await expect(page.locator('.qmv2-room-status')).not.toContainText('Finding common ground');
    expect(matchRequests.length - beforeAlignmentRestore).toBe(1);
    expect(roomRequests).toEqual([]);

    await controlsButton.click();
    controls = page.getByRole('complementary', { name: 'Preview controls' });
    const connectionLoss = controls.getByRole('button', { name: 'Connection loss', exact: true });
    await expect(connectionLoss).toBeEnabled();
    await connectionLoss.click();
    await expect(controls).toHaveCount(0);
    interruption = page.locator('.qmv2-reliability');
    await expect(interruption.getByRole('heading', { name: 'Connection paused', exact: true })).toBeVisible();
    const beforeConnectionRestore = matchRequests.length;
    const connectionMatch = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/matches');
    await interruption.getByRole('button', { name: 'Restore preview', exact: true }).click();
    await connectionMatch;
    await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
    await expect.poll(() => matchRequests.length).toBe(beforeConnectionRestore + 1);
    await expect(page.locator('.qmv2-room-status')).not.toContainText('Finding common ground');
    expect(matchRequests.length - beforeConnectionRestore).toBe(1);

    expect(roomRequests).toEqual([{ code: 'DEMO' }]);
    const state = await env.api('bootstrap');
    expect(state.session.code).toBe('DEMO');
    expect(state.session.activeEventId).toBe('demo');
  } finally { await env.close(); }
});
