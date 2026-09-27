import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { workspace } from './workspace-fixture.mjs';
const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const seed = JSON.parse(await readFile(new URL('../../shared/demo-data.json', import.meta.url), 'utf8'));
test('mouse movement gently sways the graph without changing selection or saved people', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const env = await workspace(page, { profileId: 'john', join: false });
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + '/#/network');
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    const stage = page.locator('.cg-stage'), scene = page.locator('.cg-scene');
    await stage.scrollIntoViewIfNeeded();
    const bounds = await stage.boundingBox();
    const readCamera = () => scene.evaluate(element => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return { x: matrix.e, y: matrix.f, scale: matrix.a };
    });
    const baseline = await readCamera();
    await page.mouse.move(bounds.x + 24, bounds.y + 24);
    await expect.poll(async () => baseline.x - (await readCamera()).x).toBeGreaterThan(5);
    const swayed = await readCamera();
    expect(Math.abs(swayed.x - baseline.x)).toBeLessThanOrEqual(10);
    expect(swayed.scale).toBe(baseline.scale);
    await expect(page.locator('.cg-node[aria-pressed="true"]')).toHaveCount(0);
    // Re-enter before the return animation finishes: do not adopt its
    // intermediate position as a new origin and accumulate camera drift.
    for (let crossing = 0; crossing < 3; crossing++) {
      await page.mouse.move(bounds.x + 20, bounds.y - 20);
      await page.mouse.move(bounds.x + 24, bounds.y + 24);
    }
    await page.mouse.move(bounds.x + bounds.width - 24, bounds.y + 24);
    await expect.poll(async () => (await readCamera()).x - baseline.x).toBeGreaterThan(5);
    await page.mouse.move(bounds.x + 20, bounds.y - 20);
    await expect.poll(async () => Math.abs((await readCamera()).x - baseline.x)).toBeLessThan(.01);
    await page.mouse.move(bounds.x + 24, bounds.y + 24);
    await expect.poll(async () => baseline.x - (await readCamera()).x).toBeGreaterThan(5);
    await page.mouse.move(bounds.x + 20, bounds.y - 20);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => Math.abs((await readCamera()).x - baseline.x)).toBeLessThan(.01);
    await page.mouse.move(bounds.x + bounds.width - 24, bounds.y + 24);
    expect(await readCamera()).toEqual(baseline);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Grabbing adopts the displayed camera; hover cannot fight a pan.
    await page.mouse.move(bounds.x + 24, bounds.y + 24);
    await page.mouse.down();
    const grabbed = await readCamera();
    await page.mouse.move(bounds.x + 84, bounds.y + 54, { steps: 6 });
    await page.mouse.up();
    const panned = await readCamera();
    expect(panned.x - grabbed.x).toBeCloseTo(60, 1);
    expect(panned.y - grabbed.y).toBeCloseTo(30, 1);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.nx-person-row')).toHaveCount(3);
  } finally { await env.close(); }
});

test('desktop graph reveals context, searches, opens profiles and retains List', async ({ page }) => {
  const state = { ...seed, session: { id: 'constellation-test', userId: 'alex', activeEventId: null, code: null }, matches: [], demo: true };
  await page.addInitScript(id => sessionStorage.setItem('questmatch-session', id), state.session.id);
  await page.route('**/api/**', route => route.fulfill({ json: state }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/#/network');
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.nx-person-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(page.locator('.cg-node')).toHaveCount(29);
  await expect(page.locator('.cg-stage')).not.toHaveClass(/is-overview/);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.locator('.cg-stage')).toHaveClass(/is-overview/);
  await expect(page.locator('.cg-node').first().locator('.avatar')).toHaveCSS('visibility', 'hidden');
  await page.getByRole('button', { name: 'Fit everyone' }).click();
  const scene = page.locator('.cg-scene');
  const initialCamera = await scene.getAttribute('style');
  await page.getByRole('button', { name: 'Explore Maya Chen', exact: true }).click();
  expect(await scene.getAttribute('style')).toBe(initialCamera);
  const detail = page.getByRole('complementary', { name: 'Graph selection' });
  await expect(detail.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
  await expect(detail.getByText('Computer vision', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await expect(page.locator('.cg-topic').first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Find a person in the graph' }).fill('Nina');
  await expect(page.locator('.cg-search-results')).toContainText('Nina Patel');
  await page.getByRole('textbox', { name: 'Find a person in the graph' }).press('Enter');
  await expect(detail.getByRole('heading', { name: 'Nina Patel' })).toBeVisible();
  await detail.getByRole('button', { name: 'View profile' }).click();
  await expect(page.locator('.np-profile h1')).toHaveText('Nina Patel');
  await page.getByRole('button', { name: 'Back to network' }).click();
  await expect(page.locator('.cg-search-results')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fit everyone' }).click();
  const stage = page.locator('.cg-stage');
  await stage.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  const oldCamera = await scene.getAttribute('style');
  await page.mouse.move(bounds.x + 18, bounds.y + 18);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 78, bounds.y + 48, { steps: 6 });
  await page.mouse.up();
  expect(await scene.getAttribute('style')).not.toBe(oldCamera);
  const panned = await scene.getAttribute('style');
  await page.mouse.wheel(0, -120);
  await expect.poll(() => scene.getAttribute('style')).not.toBe(panned);
  await page.getByRole('button', { name: 'Fit everyone' }).click();
  const node = page.getByRole('button', { name: 'Explore Maya Chen', exact: true });
  const oldPosition = await node.getAttribute('style');
  const position = await node.boundingBox();
  await page.mouse.move(position.x + position.width / 2, position.y + 20);
  await page.mouse.down();
  await page.mouse.move(position.x + position.width / 2 + 45, position.y + 55, { steps: 8 });
  await page.mouse.up();
  expect(await node.getAttribute('style')).not.toBe(oldPosition);
  await expect(page.locator('.cg-peer-link').first()).toBeAttached();
  await page.getByRole('combobox', { name: 'Graph relationship filter' }).selectOption('saved');
  await expect(page.getByRole('button', { name: 'Explore Maya Chen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your people', exact: true })).toBeVisible();
  await expect(page.locator('.nx-person-row')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

for (const [profileId, count] of [['alex', 3], ['maya', 4], ['john', 3]]) {
  test(`${profileId} keeps saved people in List and extended people in Graph`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const env = await workspace(page, { profileId, join: false });
    try {
      await page.goto(origin + '/#/network');
      await expect(page.locator('.nx-person-row')).toHaveCount(count);
      await page.getByRole('button', { name: 'Graph', exact: true }).click();
      await expect(page.locator('.cg-node, .cg-self')).toHaveCount(30);
      await expect(page.locator('.cg-node .avatar-fallback')).toHaveCount(0);
      await expect.poll(() => page.locator('.cg-node img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      await page.getByRole('button', { name: 'List', exact: true }).click();
      await expect(page.locator('.nx-person-row')).toHaveCount(count);
      if (profileId === 'john') {
        await expect(page.getByRole('button', { name: "View Bea Martin's profile", exact: true })).toBeVisible();
        await env.api('connections/bea', undefined, 'DELETE');
        await page.reload();
        await expect(page.locator('.nx-person-row')).toHaveCount(2);
      }
    } finally { await env.close(); }
  });
}
