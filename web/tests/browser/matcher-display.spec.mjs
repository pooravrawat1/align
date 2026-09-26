import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const seed = JSON.parse(await readFile(new URL('../../shared/demo-data.json', import.meta.url), 'utf8'));

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

const base = {
  status: 'ready',
  reason: 'You have a concrete reason to compare notes.',
  commonGround: ['Assistive technology'],
  contributions: [
    { userId: 'alex', items: ['Embedded systems'] },
    { userId: 'leo', items: ['Computer vision'] },
  ],
  starter: 'What did each of you learn from building in this space?',
  categories: [],
  compatible: true,
};

const professionalFixture = {
  ...base,
  score: 100,
  source: 'fixture',
  route: 'professional',
  routes: { networking: null, professional: 100, personal: 0 },
};

const aiNetworking = {
  ...base,
  score: 89,
  source: 'gemini',
  route: 'networking',
  routes: { networking: 89, professional: 0, personal: 20 },
  categories: [
    { id: 'skills', label: 'Skill-to-need fit', max: 30, points: 28, evidence: 'Complementary skills were shared.' },
  ],
};

async function openProfile(page, assessment) {
  const state = structuredClone(seed);
  state.session = { id: 'matcher-display', userId: 'alex', code: 'DEMO', activeEventId: 'demo', calibrated: false };
  state.matches = [];
  state.demo = true;
  await page.addInitScript((sessionId) => sessionStorage.setItem('questmatch-session', sessionId), state.session.id);
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/compatibility') return route.fulfill({ json: assessment });
    return route.fulfill({ json: structuredClone(state) });
  });
  await page.goto(`${origin}/#/network`);
  await page.getByRole('button', { name: "View Leo Park's profile" }).click();
  const dialog = page.getByRole('dialog', { name: 'Leo Park — full profile' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('professional fixture presents its strongest route without claiming an AI or rubric total', async ({ page }) => {
  const dialog = await openProfile(page, professionalFixture);
  await expect(dialog.locator('.np-score-value')).toHaveText('100/100');
  await expect(dialog.locator('.np-score')).toHaveClass(/np-score--high/);
  await expect(dialog.getByText('Prepared example details', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/AI estimate/i)).toHaveCount(0);

  await dialog.getByText('Prepared example details', { exact: true }).click();
  const breakdown = dialog.locator('.np-breakdown');
  await expect(breakdown).toContainText('Networking fitNot assessed');
  await expect(breakdown).toContainText('Professional experience100 / 100');
  await expect(breakdown).toContainText('Strongest route');
  await expect(breakdown).not.toContainText('Networking rubric');
});

test('Gemini networking assessment is the only presentation labeled as AI', async ({ page }) => {
  const dialog = await openProfile(page, aiNetworking);
  await expect(dialog.locator('.np-score-value')).toHaveText('89/100');
  await expect(dialog.getByText('AI estimate from shared profile information', { exact: true })).toBeVisible();
  await dialog.getByText('AI estimate from shared profile information', { exact: true }).click();
  const breakdown = dialog.locator('.np-breakdown');
  await expect(breakdown).toContainText('Networking fit89 / 100');
  await expect(breakdown).toContainText('Networking rubric');
  await expect(breakdown).toContainText('Skill-to-need fit28 / 30');
});

test('the canonical 70-point threshold is green in both profile and directory', async ({ page }) => {
  const dialog = await openProfile(page, { ...aiNetworking, score: 70, routes: { networking: 70, professional: 0, personal: 0 } });
  await expect(dialog.locator('.np-score-value')).toHaveText('70/100');
  await expect(dialog.locator('.np-score')).toHaveClass(/np-score--high/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: "View Leo Park's profile" }).locator('.nx-fit')).toHaveClass(/nx-fit-high/);
});
