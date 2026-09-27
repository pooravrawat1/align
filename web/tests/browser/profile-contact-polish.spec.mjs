import { test, expect } from '@playwright/test';
import { origin, workspace } from './workspace-fixture.mjs';

for (const width of [1440, 390]) test(`contact editor and audience preview at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const demo = await workspace(page, { join: false });
  try {
    await page.goto(`${origin}/#/profile?section=contact`);
    await expect(page.getByRole('textbox', { name: 'Other contact', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /saved connections/ })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Other contact', exact: true }).fill('Ask at the welcome desk');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile preview' });
    await expect(dialog.getByRole('button', { name: 'Saved connection', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByText('Ask at the welcome desk', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Website for Alex Morgan' })).toBeVisible();
    await dialog.getByRole('button', { name: 'In a room', exact: true }).click();
    await expect(dialog.getByText('Ask at the welcome desk', { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: 'Website for Alex Morgan' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Preview full profile', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Save changes', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    await expect(page.locator('.pe-save-status')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
    await page.screenshot({ path: `/tmp/align-contact-polish-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Manage access', exact: true }).click();
    await page.getByRole('switch', { name: 'Access for saved connections' }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    await expect(page.locator('.pe-save-status')).toBeFocused();
    await page.getByRole('tab', { name: 'Contact', exact: true }).click();
    await expect(page.getByText(/Your contact details are hidden from saved connections/)).toBeVisible();
    await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expect(dialog.getByText('Ask at the welcome desk', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await demo.close(); }
});
