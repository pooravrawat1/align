import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

async function enterDemo(page) {
  await page.goto(origin + '/#/spatial');
  await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
  await expect(page.locator('.qmv2-card-field[aria-label="People nearby"]')).toBeVisible();
  await expect(page.locator('.qmv2-room-status')).toContainText('Sample match');
}

test('DEMO cards show only useful identity and shared context', async ({ page }) => {
  const env = await workspace(page);
  try {
    await enterDemo(page);
    const jordan = page.locator('[data-person-id="jordan"] .qmv2-card');
    const maya = page.locator('[data-person-id="maya"] .qmv2-card');

    await expect(jordan).toHaveClass(/qmv2-card--compact/);
    await expect(jordan).not.toHaveClass(/is-matched/);
    await expect(jordan).toHaveText('Jordan Lee');
    await expect(jordan.locator('.avatar, svg, small, .qmv2-card-indicator')).toHaveCount(0);
    await expect(jordan.locator('.qmv2-card-reason')).toHaveCount(0);

    await expect(maya).toHaveClass(/qmv2-card--expanded/);
    await expect(maya).toHaveClass(/is-matched/);
    await expect(maya).toContainText('Maya Chen');
    await expect(maya.locator('.qmv2-card-person small')).toBeVisible();
    const reason = maya.locator('.qmv2-card-reason');
    await expect(reason).toHaveText('Your embedded systems + Maya’s computer vision.');

    const dimensions = await page.evaluate(() => {
      const compact = document.querySelector('[data-person-id="jordan"] .qmv2-card').getBoundingClientRect();
      const expanded = document.querySelector('[data-person-id="maya"] .qmv2-card').getBoundingClientRect();
      const reasonStyle = getComputedStyle(document.querySelector('[data-person-id="maya"] .qmv2-card-reason'));
      return { compactWidth: compact.width, expandedWidth: expanded.width, hairline: reasonStyle.borderTopWidth };
    });
    expect(dimensions.compactWidth).toBeLessThan(dimensions.expandedWidth);
    expect(dimensions.hairline).toBe('1px');
    await expect(page.locator('.qmv2-card .avatar, .qmv2-card svg, .qmv2-card .chip, .qmv2-card .qmv2-card-indicator')).toHaveCount(0);
    expect(await page.locator('.qmv2-card').allTextContents()).toEqual(expect.not.arrayContaining([
      expect.stringMatching(/Reason to meet|Saved/),
    ]));
  } finally { await env.close(); }
});

test('conversation focus hides other labels and finishing does not remember someone until asked', async ({ page }) => {
  const env = await workspace(page);
  const connectionPosts = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/connections') connectionPosts.push(request.postDataJSON());
  });
  try {
    await enterDemo(page);
    await page.locator('[data-person-id="maya"] .qmv2-card').click();
    let drawer = page.locator('.qmv2-person-panel');
    await expect(drawer.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Remember person', exact: true })).toHaveCount(0);
    const material = await page.evaluate(() => {
      const panel = getComputedStyle(document.querySelector('.qmv2-person-panel'));
      const photo = getComputedStyle(document.querySelector('.qmv2-card-field .qmv2-scene'));
      const label = getComputedStyle(document.querySelector('.qmv2-card'));
      return { background: panel.backgroundColor, blur: panel.backdropFilter, photoOpacity: photo.opacity, labelOpacity: label.opacity };
    });
    // The shared glass token is a translucent color, not a gradient.
    expect(material.background).toMatch(/^rgba\(/);
    const alpha = Number(material.background.split(',').at(-1).replace(')', '').trim());
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
    expect(material.blur).toContain('blur(');
    expect(material.photoOpacity).toBe('1');
    expect(Number(material.labelOpacity)).toBeLessThan(1);

    await drawer.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('.qmv2-person-anchor')).toHaveCount(1);
    await expect(page.locator('[data-person-id="jordan"], [data-person-id="leo"]')).toHaveCount(0);
    const active = page.locator('[data-person-id="maya"] .qmv2-card');
    await expect(active).toHaveAttribute('aria-label', 'In conversation with Maya Chen');
    await expect(active).toHaveText('Maya Chen');
    await expect(page.getByText(/In conversation|Talking with/)).toHaveCount(0);
    const finish = page.getByRole('button', { name: 'Finish conversation', exact: true });
    await expect(finish).toBeVisible();
    expect(connectionPosts).toEqual([]);

    await finish.click();
    drawer = page.locator('.qmv2-person-panel');
    await expect(drawer.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
    const save = drawer.getByRole('button', { name: 'Remember person', exact: true });
    await expect(save).toBeVisible();
    await expect(drawer.getByText('Added to your people', { exact: true })).toHaveCount(0);
    expect(connectionPosts).toEqual([]);

    await save.click();
    await expect(drawer.getByText('Added to your people', { exact: true })).toBeVisible();
    await expect.poll(() => connectionPosts.length).toBe(1);
    expect(connectionPosts).toEqual([{ participantId: 'maya' }]);
  } finally { await env.close(); }
});

test('Escape during a conversation reopens its follow-up panel with focus inside', async ({ page }) => {
  const env = await workspace(page);
  try {
    await enterDemo(page);
    await page.locator('[data-person-id="maya"] .qmv2-card').click();
    let drawer = page.locator('.qmv2-person-panel');
    await drawer.getByRole('button', { name: 'Start conversation', exact: true }).click();
    await expect(drawer).toHaveCount(0);

    await page.keyboard.press('Escape');
    drawer = page.locator('.qmv2-person-panel');
    await expect(drawer.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Remember person', exact: true })).toBeVisible();
    await expect.poll(() => drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
  } finally { await env.close(); }
});

test('People-only attendees remain saveable while conversation is limited to the photographed cast', async ({ page }) => {
  const env = await workspace(page);
  const connectionPosts = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/connections') connectionPosts.push(request.postDataJSON());
  });
  const openFromPeople = async name => {
    await page.getByRole('button', { name: /^People/ }).click();
    const people = page.getByRole('complementary', { name: 'People in this room' });
    await people.getByRole('button').filter({ hasText: name }).click();
    const drawer = page.locator('.qmv2-person-panel');
    await expect(drawer.getByRole('heading', { name, exact: true })).toBeVisible();
    return drawer;
  };
  try {
    await enterDemo(page);
    let drawer = await openFromPeople('Sam Rivera');
    await expect(drawer.getByRole('button', { name: 'Start conversation', exact: true })).toHaveCount(0);
    const saveSam = drawer.getByRole('button', { name: 'Remember person', exact: true });
    await expect(saveSam).toBeVisible();
    await saveSam.click();
    await expect(drawer.getByText('Added to your people', { exact: true })).toBeVisible();
    expect(connectionPosts).toEqual([{ participantId: 'sam' }]);
    await drawer.getByRole('button', { name: 'Close Meet someone new' }).click();

    drawer = await openFromPeople('Amina Okafor');
    await expect(drawer.getByRole('button', { name: 'Start conversation', exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Remember person', exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close Meet someone new' }).click();

    drawer = await openFromPeople('Jordan Lee');
    await expect(drawer.getByRole('button', { name: 'Start conversation', exact: true })).toBeVisible();
  } finally { await env.close(); }
});

test('a compatible result becomes name-only when shared context fields are private', async ({ page }) => {
  const env = await workspace(page);
  const privateReason = 'PRIVATE RAW MATCH REASON';
  const hideRelationFields = state => {
    state.profiles = state.profiles.map(profile => profile.id === 'maya' ? {
      ...profile,
      interests: [],
      skills: [],
      lookingFor: [],
      visibility: { ...profile.visibility, interests: false, skills: false, lookingFor: false },
    } : profile);
    return state;
  };
  await page.route('**/api/bootstrap', async route => route.fulfill({ status: 200, json: hideRelationFields(await env.api('bootstrap')) }));
  await page.route('**/api/matches', async route => {
    const state = hideRelationFields(await env.api('matches', route.request().postDataJSON()));
    const maya = state.matches.find(match => (match.userA === 'alex' && match.userB === 'maya') || (match.userB === 'alex' && match.userA === 'maya'));
    Object.assign(maya, { compatible: true, score: 0.98, reason: privateReason, source: 'fixture' });
    await route.fulfill({ status: 200, json: state });
  });
  try {
    await enterDemo(page);
    const maya = page.locator('[data-person-id="maya"] .qmv2-card');
    await expect(maya).not.toHaveClass(/is-matched/);
    await expect(maya).toHaveText('Maya Chen');
    await expect(maya).toHaveClass(/qmv2-card--compact/);
    await expect(maya.locator('.qmv2-card-person small, .qmv2-card-reason')).toHaveCount(0);
    await expect(maya).not.toContainText(privateReason);
    expect(await maya.textContent()).not.toContain(privateReason);
    expect(await maya.locator('[title]').evaluateAll(nodes => nodes.map(node => node.getAttribute('title')))).not.toContain(privateReason);
  } finally { await env.close(); }
});

test('mobile can reach both ends of the room without clipping the focused cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const env = await workspace(page);
  const expectCardInsideViewport = async id => {
    const bounds = await page.evaluate(personId => {
      const viewport = document.querySelector('.qmv2-room-viewport').getBoundingClientRect();
      const card = document.querySelector(`[data-person-id="${personId}"] .qmv2-card`).getBoundingClientRect();
      return { viewportLeft: viewport.left, viewportRight: viewport.right, cardLeft: card.left, cardRight: card.right };
    }, id);
    expect(bounds.cardLeft).toBeGreaterThanOrEqual(bounds.viewportLeft - 1);
    expect(bounds.cardRight).toBeLessThanOrEqual(bounds.viewportRight + 1);
  };
  try {
    await enterDemo(page);
    const left = page.getByRole('button', { name: 'Look left' });
    const right = page.getByRole('button', { name: 'Look right' });
    await expect(right).toBeDisabled();
    await expectCardInsideViewport('maya');

    await left.click();
    await left.click();
    await expect(left).toBeDisabled();
    await expect(right).toBeEnabled();
    await expectCardInsideViewport('jordan');
  } finally { await env.close(); }
});
