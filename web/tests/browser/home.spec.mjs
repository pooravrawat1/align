import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { createServer } from '../../server/index.mjs';

// The UI uses Vite, while API mutations and clipboard operations stay isolated.
const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const seed = JSON.parse(await readFile(new URL('../../shared/demo-data.json', import.meta.url), 'utf8'));

async function openHome(page, { userId = 'alex', privateInterests = false, sharedLinks = false, withdrawn = false, customize = () => {} } = {}) {
  const state = structuredClone(seed);
  state.session = { id: 'home-test', userId, code: 'DEMO', calibrated: false };
  state.matches = [];
  state.demo = true;
  state.connections = state.connections.map(connection => ({ ...connection, followUp: 'needed' }));
  const leo = state.profiles.find(person => person.id === 'leo');
  leo.linkedin = 'https://www.linkedin.com/in/align-test-person';
  leo.website = 'https://example.com/leo';
  leo.email = 'leo@example.com';
  leo.visibility = { interests: !privateInterests, previousConnections: !withdrawn, linkedin: sharedLinks, website: sharedLinks, email: sharedLinks };
  customize(state);
  await page.route('**/api/**', route => route.fulfill({ json: state }));
  await page.addInitScript(() => {
    window.testCopiedMessage = null;
    window.testCopyFails = false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => {
        if (window.testCopyFails) throw new Error('Clipboard unavailable');
        window.testCopiedMessage = text;
      },
    } });
  });
  await page.goto(`${origin}/#/home`);
  await expect(page.getByRole('heading', { name: 'Recent connections' })).toBeVisible();
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`Home opens full Network profiles with editable drafts at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page, { sharedLinks: true });
    await expect(page.getByLabel('Message draft', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Follow-up needed', { exact: true })).toHaveCount(0);
    await expect(page.locator('.home-connection-profile .avatar').first()).toHaveCSS('width', '52px');
    await expect(page.getByRole('link', { name: 'LinkedIn for Leo Park' })).toHaveAttribute('href', 'https://www.linkedin.com/in/align-test-person');
    await expect(page.getByRole('link', { name: 'Email for Leo Park' })).toHaveAttribute('href', 'mailto:leo%40example.com');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const nina = page.getByRole('link', { name: 'View connection with Nina Patel' });
    await nina.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/network\?person=nina$/);
    await expect(page.getByRole('dialog', { name: 'Nina Patel — full profile' })).toBeVisible();
    const draft = page.getByLabel('Message draft', { exact: true });
    await expect(draft).not.toBeVisible();
    await page.getByText('Your follow-up', { exact: true }).click();
    await page.getByText('Draft a message', { exact: true }).click();
    await expect(draft).toHaveValue("Hi Nina—I'd love to compare notes on Open source.");
    await draft.fill('Hi Nina—let’s exchange notes next week.');
    await page.getByRole('button', { name: 'Copy message' }).click();
    await expect.poll(() => page.evaluate(() => window.testCopiedMessage)).toBe('Hi Nina—let’s exchange notes next week.');
    await page.evaluate(() => { window.testCopyFails = true; });
    await page.getByRole('button', { name: 'Copy message' }).click();
    await expect(page.getByText('Couldn’t copy. Select the message and copy it manually.')).toBeVisible();
    await draft.fill('   ');
    await expect(page.getByRole('button', { name: 'Copy message' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`${origin}/#/network?person=jordan`);
    await expect(page.getByRole('dialog', { name: 'Jordan Lee — full profile' })).toBeVisible();
    await page.getByText('Your follow-up', { exact: true }).click();
    await page.getByText('Draft a message', { exact: true }).click();
    await expect(draft).toHaveValue("Hi Jordan—I'd love to compare notes on Open source.");
    await page.getByRole('button', { name: 'Back to network' }).click();
    await expect(page).toHaveURL(/#\/network$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Draft a message', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: "View Jordan Lee's profile" }).click();
    await expect(page.getByRole('dialog', { name: 'Jordan Lee — full profile' })).toBeVisible();
    await expect(page).toHaveURL(/#\/network\?person=jordan$/);
  });
}

for (const width of [1440, 390]) {
  test(`primary page titles share the display scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await openHome(page);
    for (const [route, title] of [['home', 'Good to see you, Alex.'], ['event', 'Find your room.'], ['event?event=demo', 'The Builders Room'], ['network', 'Your network'], ['profile', 'Profile']]) {
      await page.goto(`${origin}/#/${route}`);
      const heading = page.getByRole('heading', { level: 1, name: title, exact: true });
      await expect(heading).toBeVisible();
      await expect(heading).toHaveCSS('font-size', width === 390 ? '30px' : '36px');
      await expect(heading).toHaveCSS('font-weight', '500');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (route === 'profile') await expect(page.getByRole('heading', { name: 'About you', exact: true })).toHaveCSS('font-size', '20px');
      await page.screenshot({ path: `.impeccable/review/title-${route.replace(/\W/g, '-')}-${width}.png` });
    }
  });
}

test('experience map stays accessible by direct link but is absent from navigation', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('.sidebar a[href="#/map"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Spatial preview', exact: true })).toBeVisible();
  await page.goto(`${origin}/#/map`);
  await expect(page.getByRole('heading', { name: 'One experience. Three human moments.', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar a[href="#/map"]')).toHaveCount(0);
});

test('sidebar selection is heavier and navigation highlights are pill shaped', async ({ page }) => {
  await openHome(page);
  const home = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true });
  const event = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Event', exact: true });
  await expect(home).toHaveCSS('font-weight', '600');
  await expect(home).toHaveCSS('border-radius', '999px');
  await event.hover();
  await expect(event).toHaveCSS('border-radius', '999px');
  await expect(event).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const pill = page.locator('.sidebar-selection');
  const aligned = async target => {
    const mark = await pill.boundingBox(), row = await target.boundingBox();
    return Math.abs(mark.y - row.y) < 1 && Math.abs(mark.height - row.height) < 1;
  };
  await expect.poll(() => aligned(home)).toBe(true);
  const motion = await event.evaluate(async element => {
    const marker = document.querySelector('.sidebar-selection');
    const start = marker.getBoundingClientRect().y;
    const target = element.getBoundingClientRect().y;
    element.click();
    const positions = [];
    for (let frame = 0; frame < 20; frame++) {
      await new Promise(requestAnimationFrame);
      positions.push(marker.getBoundingClientRect().y);
    }
    return { start, target, positions };
  });
  expect(motion.positions.some(y => y > motion.start + 1 && y < motion.target - 1)).toBe(true);
  await expect(event).toHaveAttribute('aria-current', 'page');
  await expect(event).toHaveCSS('font-weight', '600');
  await expect(home).not.toHaveCSS('font-weight', '600');
  await expect.poll(() => aligned(event)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await home.click();
  await expect.poll(() => aligned(home)).toBe(true);
});

test('signed-in header is removed while mobile navigation remains accessible', async ({ page }) => {
  await openHome(page);
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open your profile', exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/home-no-header-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  await expect(toggle).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/home-no-header-mobile.png' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.app-header')).toHaveCount(0);
});

test('landing header matches Creo navigation type proportions', async ({ page }) => {
  await openHome(page);
  await page.goto(`${origin}/#/`);
  const navigation = page.getByRole('navigation', { name: 'Website navigation' });
  await expect(navigation.getByRole('button', { name: 'The experience' })).toHaveCSS('font-size', '14px');
  await expect(navigation.getByRole('button', { name: 'The connection' })).toHaveCSS('font-weight', '520');
  const enter = page.locator('.qv-header .qv-enter');
  await expect(enter).toHaveCSS('font-size', '14px');
  await expect(enter).toHaveCSS('font-weight', '550');
  await page.screenshot({ path: '.impeccable/review/landing-nav-type-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(enter).toHaveCSS('font-size', '14px');
  await expect(enter).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/landing-nav-type-mobile.png' });
});

test('private contact links and interests remain hidden on Home and Network', async ({ page }) => {
  await openHome(page, { privateInterests: true });
  await expect(page.locator('.contact-link')).toHaveCount(0);
  await page.getByRole('link', { name: 'View connection with Leo Park' }).click();
  await expect(page.locator('.contact-link')).toHaveCount(0);
  await page.getByText('Your follow-up', { exact: true }).click();
  await page.getByText('Draft a message', { exact: true }).click();
  await expect(page.getByLabel('Message draft', { exact: true })).toHaveValue("Hi Leo—I'd love to keep in touch.");
});

test('withdrawing previous-connection sharing hides all shared links', async ({ page }) => {
  await openHome(page, { sharedLinks: true, withdrawn: true });
  await expect(page.locator('.contact-link')).toHaveCount(0);
  await page.getByRole('link', { name: 'View connection with Leo Park' }).click();
  await expect(page.locator('.contact-link')).toHaveCount(0);
});

test('an empty profile has one invitation and no composer', async ({ page }) => {
  await openHome(page, { userId: 'jordan' });
  await expect(page.getByRole('heading', { name: 'Your network starts in the room.' })).toBeVisible();
  await expect(page.locator('.home-connections-empty').getByRole('button', { name: 'Enter room' })).toHaveCount(1);
  await expect(page.getByLabel('Message draft', { exact: true })).toHaveCount(0);
});

test('Home rows have soft rounded hover, no selection state, and no trailing action cue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openHome(page);
  const row = page.locator('.product-connection-row').nth(1);
  const link = page.getByRole('link', { name: 'View connection with Nina Patel' });
  await expect(row).toHaveCSS('border-radius', '10px');
  await link.hover();
  await expect(row).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.02)');
  await expect(page.getByText('Draft message', { exact: true })).toHaveCount(0);
  await expect(link).not.toHaveAttribute('aria-pressed');
  await page.getByRole('heading', { name: 'Recent connections' }).hover();
  await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const panelBounds = await page.locator('.product-connections-panel').boundingBox();
  const lastBounds = await page.locator('.product-connection-row').last().boundingBox();
  expect(panelBounds.y + panelBounds.height - lastBounds.y - lastBounds.height).toBeLessThanOrEqual(25.5);
});

test('profile contact fields save and restore sharing choices through the API', async ({ page }) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${apiOrigin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'alex' }) });
    const state = await login.json();
    await page.addInitScript(sessionId => sessionStorage.setItem('questmatch-session', sessionId), state.session.id);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const response = await route.fetch({ url: `${apiOrigin}${path}` });
      await route.fulfill({ response });
    });
    await page.goto(`${origin}/#/profile`);
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();

    await page.getByRole('tab', { name: 'Focus', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your focus' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Current focus/ }).fill('Building accessible tools with a small team.');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');

    await page.getByRole('tab', { name: 'Contact', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
    await page.getByRole('textbox', { name: /^LinkedIn/ }).fill('https://www.linkedin.com/in/align-test-person');
    await page.getByRole('textbox', { name: /^Website/ }).fill('https://example.com');
    await page.getByRole('textbox', { name: /^Email/ }).fill('alex@example.com');
    const linkedinSharing = page.getByRole('checkbox', { name: 'Share LinkedIn with saved connections', exact: true });
    await expect(linkedinSharing).not.toBeChecked();
    await linkedinSharing.click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Contact details' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^LinkedIn/ })).toHaveValue('https://www.linkedin.com/in/align-test-person');
    await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveValue('alex@example.com');
    await expect(linkedinSharing).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Share Email with saved connections', exact: true })).not.toBeChecked();
    await page.locator('summary').filter({ hasText: 'Other contact' }).click();
    await page.getByRole('textbox', { name: /^Other contact/ }).fill('Find me at the demo table');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.pe-save-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByRole('textbox', { name: /^Other contact/ })).toHaveValue('Find me at the demo table');
    await page.goto(`${origin}/#/home`);
    await expect(page.locator('.home-focus-statement')).toHaveText('Building accessible tools with a small team.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

for (const width of [1440, 390]) {
  test(`Home composition and people preview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations = [];
    page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') mutations.push(request.url()); });
    await openHome(page);
    const focus = page.locator('.home-focus-panel');
    const recent = page.locator('.product-connections-panel');
    await expect(focus).toContainText(seed.profiles[0].bio);
    await expect(page.locator('.home-space')).toHaveCount(1);
    const focusBox = await focus.boundingBox();
    const recentBox = await recent.boundingBox();
    if (width > 1000) {
      expect(Math.abs(focusBox.y - recentBox.y)).toBeLessThan(1);
      expect(focusBox.x).toBeGreaterThan(recentBox.x);
      expect((await page.locator('.home-event').boundingBox()).height).toBeLessThanOrEqual(300);
    } else {
      expect(focusBox.y).toBeLessThan(recentBox.y);
    }
    const trigger = page.getByRole('button', { name: 'Find collaborators' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'People to meet' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close people to meet' })).toBeFocused();
    await expect(dialog.locator('.home-collaborators-person')).toHaveCount(5);
    await dialog.getByRole('button', { name: /Maya Chen/ }).click();
    await expect(page.getByRole('dialog', { name: 'Maya Chen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to people' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to people' }).click();
    await expect(dialog.getByRole('button', { name: /Maya Chen/ })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await trigger.click();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    expect(mutations).toEqual([]);
  });
}

test('Focus supports expansion, targeted editing and missing content', async ({ page }) => {
  await openHome(page, { customize: state => { state.profiles[0].lookingFor = ['Computer vision', 'Design', 'Robotics', 'Open source']; } });
  await expect(page.locator('.home-focus-pills > span')).toHaveCount(2);
  await page.getByRole('button', { name: '+2 more' }).click();
  await expect(page.locator('.home-focus-pills > span')).toHaveCount(4);
  await page.getByRole('button', { name: 'Show less' }).click();
  await expect(page.locator('.home-focus-pills > span')).toHaveCount(2);
  await page.getByRole('link', { name: 'Edit focus' }).click();
  await expect(page).toHaveURL(/#\/profile\?section=focus$/);
  await expect(page.getByRole('heading', { name: 'Your focus' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Current focus/ })).toBeFocused();
  await openHome(page, { customize: state => { state.profiles[0].bio = ''; } });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Find collaborators' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Set your focus' }).click();
  await expect(page).toHaveURL(/#\/profile\?section=focus$/);
  await expect(page.getByRole('textbox', { name: /^Current focus/ })).toBeFocused();
});

test('Home event previews open the specific event without joining', async ({ page }) => {
  const mutations = [];
  page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') mutations.push(request); });
  await openHome(page);
  await page.locator('.home-space').click();
  await expect(page).toHaveURL(/#\/event\?event=spatial$/);
  await expect(page.getByRole('heading', { name: 'Spatial Sessions', exact: true, level: 1 })).toBeVisible();
  expect(mutations).toHaveLength(0);
  await page.getByRole('button', { name: 'All event spaces' }).click();
  await expect(page).toHaveURL(/#\/event$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Find your room.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore event' }).last().click();
  await expect(page).toHaveURL(/#\/event\?event=spatial$/);
  await expect(page.getByRole('heading', { name: 'Spatial Sessions', level: 1 })).toBeVisible();
  expect(mutations).toHaveLength(0);
  await page.goto(`${origin}/#/home`);
  await page.getByRole('button', { name: 'Event details', exact: true }).click();
  await expect(page).toHaveURL(/#\/event\?event=demo$/);
  await expect(page.getByRole('heading', { name: 'The Builders Room', exact: true, level: 1 })).toBeVisible();
  expect(mutations).toHaveLength(0);
});

test('Preview honors hidden fields and active visibility', async ({ page }) => {
  await openHome(page, { customize: state => {
    state.profiles.find(person => person.id === 'maya').visibility = { skills: false, interests: false, lookingFor: false, bio: false };
    state.profiles.find(person => person.id === 'leo').visibility.activeInEvent = false;
  } });
  await page.getByRole('button', { name: 'Find collaborators' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Leo Park/ })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: /Maya Chen/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Skills|About|Interests|Looking for/, exact: true })).toHaveCount(0);
  await expect(page.locator('.home-collaborators-reason')).toHaveCount(0);
});


test('Entering from the preview joins the shown room once without saving anyone', async ({ page }) => {
  const mutations = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && request.method() !== 'GET') mutations.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
  });
  await openHome(page, { customize: state => { state.session.code = null; } });
  await expect(page.getByText('Available demo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find collaborators' }).click();
  expect(mutations).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page).toHaveURL(/#\/spatial$/);
  expect(mutations).toEqual([{ path: '/api/room', body: { code: 'DEMO' } }]);
});

test('Long focus and topics wrap within the mobile page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page, { customize: state => {
    state.profiles[0].bio = 'Building a navigation system with collaborators. '.repeat(5);
    state.profiles[0].lookingFor = ['ComputerVision'.repeat(6), 'Accessible interaction design'];
  } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.home-focus-statement')).toBeVisible();
});


test('Joining by code keeps the event detail and return route consistent', async ({ page }) => {
  await openHome(page);
  await page.getByRole('link', { name: 'All events', exact: true }).click();
  await page.getByRole('textbox', { name: 'Room code', exact: true }).fill('DEMO');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page).toHaveURL(/#\/event\?event=demo$/);
  await expect(page.getByRole('heading', { name: 'The Builders Room', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'All event spaces' }).click();
  await expect(page).toHaveURL(/#\/event$/);
  await expect(page.getByRole('heading', { name: 'Find your room.' })).toBeVisible();
});
