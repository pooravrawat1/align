import { test, expect } from '@playwright/test';
import { origin, workspace } from './workspace-fixture.mjs';

for (const width of [1440, 390]) test(`matching fields edit, validate, persist visibility, preview, and discard at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:1000});
  const demo = await workspace(page, { join: false });
  try {
    await page.goto(`${origin}/#/profile?section=focus`);

    const domain = page.getByRole('textbox', { name: 'Domains', exact: true });
    await domain.fill('Human-computer interaction');
    await domain.press('Enter');
    await page.getByRole('checkbox', { name: 'Share domains' }).uncheck();

    await page.getByRole('button', { name: 'Add experience' }).click();
    await page.getByRole('combobox', { name: 'Experience 3 category' }).selectOption('personal');
    await page.getByRole('textbox', { name: 'Experience 3 kind' }).fill('Volunteering');
    await page.getByRole('textbox', { name: 'Experience 3 label' }).fill('Community repair clinic');
    await page.getByRole('spinbutton', { name: 'Experience 3 year' }).fill(String(new Date().getFullYear() + 1));
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText(/year from 1900/)).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Experience 3 year' }).fill('2024');
    await page.getByRole('checkbox', { name: 'Share past experiences' }).uncheck();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    await page.getByRole('textbox',{name:'Domains',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`.impeccable/review/matching-fields-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

    const saved = (await demo.api('bootstrap')).profiles.find(profile => profile.id === 'alex');
    expect(saved.domains).toContain('Human-computer interaction');
    expect(saved.experiences.at(-1)).toEqual({ category: 'personal', kind: 'Volunteering', label: 'Community repair clinic', year: 2024 });
    expect(saved.visibility.domains).toBe(false);
    expect(saved.visibility.experiences).toBe(false);

    await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile preview' });
    await expect(dialog.getByRole('heading', { name: 'Domains' })).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Past experiences' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByRole('checkbox', { name: 'Share domains' }).check();
    await page.getByRole('checkbox', { name: 'Share past experiences' }).check();
    await page.getByRole('button', { name: 'Remove experience 3' }).click();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Share domains' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Remove experience 3' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Share domains' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Remove experience 3' })).toHaveCount(1);
  } finally {
    await demo.close();
  }
});
