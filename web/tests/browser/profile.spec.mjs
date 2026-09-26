import { test as base, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from '../../server/index.mjs';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const test = base.extend({
  demo: async ({ page }, use) => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${apiOrigin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'alex' }) }).then(response => response.json());
    const sessionId = login.session.id;
    const requests = [];
    const controls = { fail: false, delay: 0, expired: false };
    const api = async (path, body, method = body ? 'PATCH' : 'GET') => fetch(`${apiOrigin}/api/${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId }, ...(body ? { body: JSON.stringify(body) } : {}) }).then(response => response.json());
    await page.addInitScript(id => sessionStorage.setItem('questmatch-session', id), sessionId);
    await page.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (controls.expired) return route.fulfill({ status: 401, json: { error: 'Session expired' } });
      if (request.method() === 'PATCH' && path === '/api/profile') {
        requests.push(request.postDataJSON());
        if (controls.delay) await new Promise(resolve => setTimeout(resolve, controls.delay));
        if (controls.fail) return route.fulfill({ status: 503, json: { error: 'Save unavailable. Try again.' } });
      }
      const response = await fetch(`${apiOrigin}${path}`, { method: request.method(), headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId }, ...(request.postData() ? { body: request.postData() } : {}) });
      await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    });
    try { await use({ api, requests, controls, sessionId }); } finally { await new Promise(resolve => server.close(resolve)); }
  },
});

const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const save = page => page.getByRole('button', { name: 'Save changes', exact: true });

for (const width of [1440, 390]) {
  test(`Home focus editing and saved result at ${width}px`, async ({ page, demo }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${origin}/#/home`);
    await page.getByRole('link', { name: 'Edit focus', exact: true }).click();
    await expect(tab(page, 'Focus')).toHaveAttribute('aria-selected', 'true');
    const focus = page.getByRole('textbox', { name: /^Current focus/ });
    await expect(focus).toBeFocused();
    await focus.fill('Building accessible tools with a small team.');
    await save(page).click();
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    expect(demo.requests.at(-1)).toEqual({ bio: 'Building accessible tools with a small team.' });
    await page.goto(`${origin}/#/home`);
    await expect(page.locator('.home-focus-statement')).toHaveText('Building accessible tools with a small team.');
    await page.getByRole('button', { name: 'Edit your profile', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About you', exact: true })).toBeVisible();
    await expect(page.locator('.pe-save-status')).toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir('.impeccable/review', { recursive: true });
    await page.screenshot({ path: `.impeccable/review/profile-${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
    await tab(page, 'Focus').click();
    await expect(page.getByRole('heading', { name: 'Your focus', exact: true })).toBeVisible();
    await expect(page.locator('.pe-page-heading button')).toHaveCount(0);
    if (width === 1440) {
      await expect(page.locator('.pe-preview-rail')).toHaveClass(/pe-panel/);
      const panel = page.locator('.pe-editor');
      const rail = page.locator('.pe-preview-rail');
      expect(await rail.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await panel.evaluate(element => getComputedStyle(element).backgroundColor));
      await expect(rail.locator('.pe-panel-heading')).toHaveCSS('border-bottom-width', '1px');
      await expect(rail.locator('.pe-panel-heading p')).toHaveText('Your name, headline, and shared interests at a glance.');
      await expect(page.locator('.pe-panel-heading .ds-panel-header-icon svg')).toHaveCount(2);
    }
    await page.screenshot({ path: `.impeccable/review/profile-focus-${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
    await tab(page, 'Contact').click();
    await expect(page.getByRole('heading', { name: 'Contact details', exact: true })).toBeVisible();
    await expect(page.locator('.pe-panel-heading .ds-panel-header-icon svg')).toHaveCount(1);
    await expectCenteredEditor(page);
    await page.screenshot({ path: `.impeccable/review/profile-contact-${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
    await tab(page, 'Settings').click();
    await expect(page.getByRole('heading', { name: 'Visibility', exact: true })).toBeVisible();
    await expect(page.locator('.pe-panel-heading .ds-panel-header-icon svg')).toHaveCount(3);
    await expectCenteredEditor(page);
    await page.screenshot({ path: `.impeccable/review/profile-settings-${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
  });
}

async function expectCenteredEditor(page) {
  const tabs = await page.locator('.pe-tabs').boundingBox();
  const editor = await page.locator('.pe-layout').boundingBox();
  expect(Math.abs(editor.x + editor.width / 2 - tabs.x - tabs.width / 2)).toBeLessThan(2);
  expect(Math.abs(editor.width - Math.min(960, tabs.width))).toBeLessThan(2);
  await expect(page.locator('.pe-preview-rail')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('unsaved sections survive tabs, route navigation, refresh, and isolated discard', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Alex Draft');
  await tab(page, 'Contact').click();
  await page.getByRole('textbox', { name: /^Email/ }).fill('not-an-email');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Edit your profile', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Alex Draft');
  await save(page).click();
  await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  expect(demo.requests.at(-1)).toEqual({ name: 'Alex Draft' });
  await tab(page, 'Contact').click(); await page.reload();
  await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveValue('not-an-email');
  await save(page).click();
  await expect(page.getByText('Enter one valid email address.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Email/ })).toBeFocused();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveValue('');
  expect((await demo.api('bootstrap')).profiles[0].name).toBe('Alex Draft');
});

test('failed and delayed saves retain drafts and never acknowledge later keystrokes', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile?section=focus`);
  const focus = page.getByRole('textbox', { name: /^Current focus/ });
  await focus.fill('Attempted focus'); demo.controls.fail = true;
  await save(page).click();
  await expect(page.locator('.pe-save-error')).toHaveText('Save unavailable. Try again.');
  await expect(focus).toHaveValue('Attempted focus');
  demo.controls.fail = false; demo.controls.delay = 700;
  await save(page).click();
  await focus.fill('Typed while saving');
  await expect(page.locator('.pe-save-status')).toHaveText('Unsaved changes');
  expect((await demo.api('bootstrap')).profiles[0].bio).toBe('Attempted focus');
  await expect(focus).toHaveValue('Typed while saving');
  await save(page).click(); await expect(page.locator('.pe-save-status')).toHaveText('Saved');
});

test('preview respects contextual sharing and restores focus after Escape', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile?section=contact`);
  await page.getByRole('textbox', { name: /^Website/ }).fill('https://example.com/alex');
  await page.getByRole('checkbox', { name: 'Share Website with saved connections' }).check();
  await save(page).click(); await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  await tab(page, 'About').click();
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile preview' });
  await dialog.getByRole('button', { name: 'Saved connection', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Website for Alex Morgan' })).toHaveAttribute('href', 'https://example.com/alex');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Preview full profile', exact: true })).toBeFocused();
  await tab(page, 'Settings').click();
  await page.getByRole('switch', { name: 'Access for saved connections' }).click();
  await tab(page, 'About').click();
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  await dialog.getByRole('button', { name: 'Saved connection', exact: true }).click();
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(dialog.getByText('Your focus, interests, skills, and contact links are hidden from saved connections.')).toBeVisible();
  await page.keyboard.press('Escape'); await tab(page, 'Settings').click(); await save(page).click();
  await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  expect((await demo.api('bootstrap')).profiles[0].visibility.previousConnections).toBe(false);
});

test('tab keyboard navigation, legacy settings route, and pending topic restoration', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile`);
  await tab(page, 'About').focus(); await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Focus')).toBeFocused();
  await expect(tab(page, 'Focus')).toHaveAttribute('aria-selected', 'true');
  const input = page.getByRole('textbox', { name: 'I can help with', exact: true });
  await input.fill('Accessible interfaces');
  await save(page).click(); await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  expect(demo.requests.at(-1).skills).toContain('Accessible interfaces');
  await input.fill('accessible interfaces'); await input.press('Enter');
  await expect(page.getByText('This topic is already added.')).toBeVisible();
  await tab(page, 'Contact').click();
  await expect(tab(page, 'Focus')).toHaveAttribute('aria-selected', 'true');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('accessible interfaces');
  await input.fill('');
  await page.goto(`${origin}/#/settings`);
  await expect(tab(page, 'Settings')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
});

test('hidden focus and room presence change preview without publishing the draft', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile?section=focus`);
  await page.getByRole('checkbox', { name: 'Share current focus', exact: true }).uncheck();
  await expect(page.locator('.pe-page-heading button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Current focus' })).toHaveCount(0);
  await expect(dialog.getByText('Showing your draft. Save changes to update your shared profile.')).toBeVisible();
  await page.keyboard.press('Escape'); await tab(page, 'Settings').click();
  await page.getByRole('switch', { name: 'Show me in rooms' }).click();
  await tab(page, 'About').click();
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  await expect(dialog.getByText('Your profile is hidden in rooms.')).toBeVisible();
  expect((await demo.api('bootstrap')).profiles[0].visibility.activeInEvent).toBe(true);
});

test('long profile values and topics fit a phone and narrower zoom-equivalent layout', async ({ page, demo }) => {
  await demo.api('profile', { name: 'A'.repeat(80), role: 'B'.repeat(120), bio: 'C'.repeat(500), interests: Array.from({ length: 20 }, (_, i) => `${i}-${'Topic'.repeat(18)}`) });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${origin}/#/profile?section=focus`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('session expiry erases stored drafts and cannot leak them into another session', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Expired draft');
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('align-profile-draft:')))).toBe(true);
  demo.controls.expired = true; await save(page).click();
  await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith('align-profile-draft:')))).toBe(false);
});

test('keyboard-focused fields stay above the sticky save footer on a short phone viewport', async ({ page, demo }) => {
  void demo;
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto(`${origin}/#/profile?section=focus`);
  for (const label of ['Interests', 'I can help with', 'I’m looking for help with']) {
    const input = page.getByRole('textbox', { name: label, exact: true });
    await input.focus();
    await expect.poll(async () => {
      const control = await input.boundingBox(), footer = await page.locator('.pe-save-footer').boundingBox();
      return control.y >= 0 && control.y + control.height <= Math.min(footer.y, 520);
    }).toBe(true);
  }
});

test('a pending topic is included before preview opens', async ({ page, demo }) => {
  void demo;
  await page.goto(`${origin}/#/profile?section=focus`);
  await page.getByRole('textbox', { name: 'Interests', exact: true }).fill('A new interest');
  await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('A new interest', { exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`profile drawer integrates spatial states and shared panel headers at ${width}px`, async ({ page, demo }) => {
    void demo;
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${origin}/#/profile`);
    await page.getByRole('button', { name: 'Preview full profile', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile preview' });
    const roomChip = dialog.locator('.pe-room-card .chip').first();
    await expect(roomChip).toBeVisible();
    const roomChipMaterial = await roomChip.evaluate(element => ({
      background: getComputedStyle(element).backgroundImage,
      backdrop: getComputedStyle(element).backdropFilter,
    }));
    expect(roomChipMaterial.background).toContain('linear-gradient');
    expect(roomChipMaterial.backdrop).toContain('blur(14px)');
    await expect(dialog.locator('details')).toHaveCount(0);
    const distance = dialog.getByRole('group', { name: 'Spatial distance' });
    await expect(distance).toBeVisible();
    await expect(dialog.locator('.pe-preview-section .ds-panel-header').first()).toContainText('In the room');
    await expect(dialog.locator('.pe-preview-section').first()).toHaveCSS('background-color', 'rgb(34, 36, 40)');
    await expect(dialog.locator('.pe-preview-section').first()).not.toHaveCSS('box-shadow', 'none');
    await expect(distance.getByRole('button', { name: 'Nearby', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `.impeccable/review/drawer-room-${width}.png` });
    await distance.getByRole('button', { name: 'Distant', exact: true }).click();
    await expect(dialog.locator('.pe-room-scene')).toHaveCount(1);
    await expect(dialog.locator('.pe-room-scene')).toContainText('A name marker at a distance.');
    await distance.getByRole('button', { name: 'Matched', exact: true }).click();
    await expect(dialog.locator('.pe-room-scene')).toHaveCount(1);
    await expect(dialog.getByText('Illustrative match based on eligible sample profiles and your sharing choices.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Saved connection', exact: true }).click();
    await expect(distance).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Saved connection', exact: true })).toHaveCSS('background-color', 'rgb(242, 243, 245)');
    await expect(dialog.getByRole('heading', { name: 'Saved connection', exact: true })).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/drawer-connection-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Preview full profile', exact: true })).toBeFocused();
  });
}

test('subtle profile photo control uploads a draft, saves, restores, and exports', async ({ page, demo }) => {
  await page.goto(`${origin}/#/profile`);
  await expect(page.getByText('Sample photo for this demo')).toHaveCount(0);
  await expect(page.getByText('JPG, PNG or WebP · Up to 10 MB')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(0);
  const edit = page.getByRole('button', { name: 'Upload profile photo' });
  await expect(edit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await edit.evaluate(element => getComputedStyle(element, '::before').content)).toBe('none');
  await page.screenshot({ path: '.impeccable/review/profile-photo-subtle-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(edit).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/profile-photo-subtle-mobile.png', fullPage: true });
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload profile photo' }).click();
  await (await fileChooser).setFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: await readFile('public/assets/alex.jpg') });
  await expect(page.locator('.pe-photo-wrap img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  const draftImage = await page.locator('.pe-photo-wrap img').getAttribute('src');
  expect((await demo.api('bootstrap')).profiles[0].avatar).not.toBe(draftImage);
  await page.reload();
  await expect(page.locator('.pe-photo-wrap img')).toHaveAttribute('src', draftImage);
  await save(page).click(); await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  expect((await demo.api('bootstrap')).profiles[0].avatar).toBe(draftImage);
  await page.goto(`${origin}/#/home`);
  await expect(page.locator('.home-profile-card img')).toHaveAttribute('src', draftImage);
  await page.goto(`${origin}/#/settings`);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.profile.avatar).toBe(draftImage);
});

test('invalid photo uploads preserve the previous portrait and a new photo recovers a failed image', async ({ page, demo }) => {
  await page.route('**/assets/alex.jpg', route => route.abort());
  await page.goto(`${origin}/#/profile`);
  await expect(page.locator('.pe-photo-wrap .avatar-fallback')).toBeVisible();
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'not-photo.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await expect(page.getByText('Choose a JPG, PNG, or WebP image.')).toBeVisible();
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a photo') });
  await expect(page.getByText('This image couldn’t be opened. Try another photo.')).toBeVisible();
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10485761) });
  await expect(page.getByText('Choose an image smaller than 10 MB.')).toBeVisible();
  await page.getByLabel('Choose profile photo').setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: await readFile('public/assets/alex.jpg') });
  await expect(page.locator('.pe-preview-rail img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await save(page).click(); await expect(page.locator('.pe-save-status')).toHaveText('Saved');
  expect((await demo.api('bootstrap')).profiles[0].avatar).toMatch(/^data:image\/jpeg;base64,/);
});
