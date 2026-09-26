import { test, expect } from '@playwright/test';
import { createServer } from '../../server/index.mjs';

const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
const draftKey = 'align-entry-v1';
const sessionKey = 'questmatch-session';

test.use({ screenshot: 'off', video: 'off', trace: 'off' });

let server;
let apiOrigin;

test.beforeAll(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  apiOrigin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

// Proxy browser traffic to a fresh in-memory API while rendering the real Vite app.
async function openEntry(page, path = 'login') {
  const traffic = {
    requests: [],
    sessionId: null,
    failProfile: false,
    failRoom: false,
    profileDelayMs: 0,
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const rawBody = request.postData();
    const body = rawBody ? JSON.parse(rawBody) : null;
    traffic.requests.push({ path: pathname, method: request.method(), body });

    if (pathname === '/api/profile' && request.method() === 'PATCH' && traffic.profileDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, traffic.profileDelayMs));
    }

    if (pathname === '/api/profile' && request.method() === 'PATCH' && traffic.failProfile) {
      await route.fulfill({ status: 503, json: { error: 'Profile save unavailable. Try again.' } });
      return;
    }
    if (pathname === '/api/room' && request.method() === 'POST' && traffic.failRoom) {
      await route.fulfill({ status: 503, json: { error: 'Room join unavailable. Try again.' } });
      return;
    }

    const headers = { 'content-type': 'application/json' };
    const sessionId = request.headers()['x-session-id'];
    if (sessionId) headers['x-session-id'] = sessionId;
    const response = await fetch(`${apiOrigin}${pathname}`, {
      method: request.method(),
      headers,
      ...(rawBody ? { body: rawBody } : {}),
    });
    const result = await response.json();
    if (result.session) traffic.sessionId = result.session.id;
    await route.fulfill({ status: response.status, json: result });
  });

  await page.goto(`${origin}/#/${path}`);
  await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
  return traffic;
}

async function isolatedApi(path, { method = 'GET', body, sessionId } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (sessionId) headers['x-session-id'] = sessionId;
  const response = await fetch(`${apiOrigin}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, value: await response.json() };
}

async function savedState(traffic) {
  return (await isolatedApi('/api/bootstrap', { sessionId: traffic.sessionId })).value;
}

async function continueToWork(page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
}

async function continueToMeet(page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
}

const journeySteps = [
  { number: 1, name: 'Step 1: Introduce yourself', heading: 'Create your profile' },
  { number: 2, name: 'Step 2: Share what you bring', heading: 'What are you working on?' },
  { number: 3, name: 'Step 3: Find common ground', heading: 'Who would you love to meet?' },
];

function stepButton(page, number) {
  return page.getByRole('button', { name: journeySteps[number - 1].name, exact: true });
}

async function expectJourneyControls(page, currentStep) {
  const items = page.locator('.login-steps > li');
  await expect(items).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  for (const step of journeySteps) {
    const button = stepButton(page, step.number);
    await expect(button).toBeVisible();
    await expect(button.locator('.login-step-number')).toHaveText(String(step.number));
    if (step.number === currentStep) await expect(button).toHaveAttribute('aria-current', 'step');
    else await expect(button).not.toHaveAttribute('aria-current', 'step');
    const [itemBox, buttonBox] = await Promise.all([
      items.nth(step.number - 1).boundingBox(),
      button.boundingBox(),
    ]);
    expect(buttonBox).toEqual(itemBox);
  }
}

async function expectFormAlignment(page, heading) {
  const form = page.getByRole('form', { name: heading, exact: true });
  const title = page.getByRole('heading', { name: heading, exact: true });
  const description = page.locator('.login-form > div > p').first();
  const firstField = form.locator('label').first();
  const fieldset = form.locator('.login-fields');
  const [titleBox, formBox, fieldBox, titleStyle, fieldsetGap] = await Promise.all([
    title.boundingBox(),
    form.boundingBox(),
    firstField.boundingBox(),
    title.evaluate((element) => ({
      fontSize: getComputedStyle(element).fontSize,
      textAlign: getComputedStyle(element).textAlign,
    })),
    fieldset.evaluate((element) => getComputedStyle(element).rowGap),
  ]);
  const descriptionBox = await description.count() ? await description.boundingBox() : null;
  expect(titleStyle).toEqual({ fontSize: '36px', textAlign: 'left' });
  if (heading === 'Create your profile') {
    const lineHeight = await title.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight));
    expect(Math.abs(titleBox.height - lineHeight)).toBeLessThan(1);
  }
  expect(titleBox.x).toBe(formBox.x);
  if (descriptionBox) {
    expect(await description.evaluate((element) => getComputedStyle(element).textAlign)).toBe('left');
    expect(descriptionBox.x).toBe(formBox.x);
  }
  expect(fieldBox.x).toBe(formBox.x);
  expect(formBox.width).toBeLessThanOrEqual(384);
  const headerBottom = descriptionBox ? descriptionBox.y + descriptionBox.height : titleBox.y + titleBox.height;
  expect(Math.round(formBox.y - headerBottom)).toBe(32);
  expect(fieldsetGap).toBe('24px');
  for (const group of await form.locator('.entry-field-group').all()) {
    expect(await group.evaluate((element) => getComputedStyle(element).rowGap)).toBe('8px');
  }
  return { title: titleBox, description: descriptionBox, form: formBox };
}

async function expectDesktopStepWithinViewport(page, heading, primaryAction) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width <= 760) return;
  const shell = page.locator('.login-page');
  const panel = page.locator('.login-form');
  const form = page.getByRole('form', { name: heading, exact: true });
  const action = form.getByRole('button', { name: primaryAction, exact: true });
  await action.scrollIntoViewIfNeeded();
  const [shellBox, panelBox, actionBox, overflowY] = await Promise.all([
    shell.boundingBox(),
    panel.boundingBox(),
    action.boundingBox(),
    panel.evaluate((element) => getComputedStyle(element).overflowY),
  ]);
  expect(shellBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(overflowY).toBe('auto');
  expect(shellBox.x).toBeGreaterThanOrEqual(0);
  expect(shellBox.y).toBeGreaterThanOrEqual(0);
  expect(shellBox.x + shellBox.width).toBeLessThanOrEqual(viewport.width);
  expect(shellBox.y + shellBox.height).toBeLessThanOrEqual(viewport.height);
  expect(actionBox.y).toBeGreaterThanOrEqual(panelBox.y);
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
}

async function onboardingGeometry(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Math.round(bounds[key] * 100) / 100]));
    };
    const shell = document.querySelector('.login-page');
    const visual = document.querySelector('.login-visual');
    const panel = document.querySelector('.login-form');
    return {
      shell: rect(shell),
      visual: rect(visual),
      steps: [...document.querySelectorAll('.login-steps li')].map(rect),
      panel: {
        ...rect(panel),
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
        scrollTop: panel.scrollTop,
        overflowY: getComputedStyle(panel).overflowY,
      },
      pageScrollY: window.scrollY,
      documentScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    };
  });
}

function expectStableOnboardingShell(actual, initial) {
  expect(actual.shell).toEqual(initial.shell);
  expect(actual.visual).toEqual(initial.visual);
  expect(actual.steps).toEqual(initial.steps);
}

function expectStepsInsideVisual(geometry) {
  for (const step of geometry.steps) {
    expect(step.x).toBeGreaterThanOrEqual(geometry.visual.x);
    expect(step.y).toBeGreaterThanOrEqual(geometry.visual.y);
    expect(step.x + step.width).toBeLessThanOrEqual(geometry.visual.x + geometry.visual.width);
    expect(step.y + step.height).toBeLessThanOrEqual(geometry.visual.y + geometry.visual.height);
  }
}

function chipGroup(page, name) {
  return page.getByRole('group', { name, exact: true });
}

function bioField(page) {
  return page.getByRole('textbox', { name: 'Current focus', exact: true });
}

async function expectChips(page, groupName, values) {
  const group = chipGroup(page, groupName);
  for (const value of values) {
    await expect(group.getByRole('button', { name: `Remove ${value}`, exact: true })).toBeVisible();
  }
  await expect(group.getByRole('button', { name: /^Remove / })).toHaveCount(values.length);
}

async function replaceChips(page, groupName, inputName, values) {
  const group = chipGroup(page, groupName);
  while (await group.getByRole('button', { name: /^Remove / }).count()) {
    await group.getByRole('button', { name: /^Remove / }).first().click();
  }
  const input = group.getByRole('textbox', { name: inputName, exact: true });
  for (const value of values) {
    await input.fill(value);
    await input.press('Enter');
  }
  await expectChips(page, groupName, values);
}

async function expectPillChip(page, groupName, value) {
  const group = chipGroup(page, groupName);
  const tag = group.getByRole('button', { name: `Remove ${value}`, exact: true }).locator('..');
  const radius = await tag.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius));
  expect(radius).toBeGreaterThanOrEqual(999);
  await expect(tag).toHaveClass(/chip--editable/);
}

const viewports = [
  { name: 'desktop', width: 1291, height: 822 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of [
  { name: 'short desktop', width: 1100, height: 740 },
  { name: 'standard desktop', width: 1291, height: 822 },
]) {
  test(`keeps the desktop shell fixed while only the right form scrolls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openEntry(page);
    const initial = await onboardingGeometry(page);
    expect(initial.panel.overflowY).toBe('auto');
    expectStepsInsideVisual(initial);
    await expectJourneyControls(page, 1);
    const initialAlignment = await expectFormAlignment(page, 'Create your profile');
    expect(initial.shell.x).toBeGreaterThanOrEqual(0);
    expect(initial.shell.y).toBeGreaterThanOrEqual(0);
    expect(initial.shell.x + initial.shell.width).toBeLessThanOrEqual(viewport.width);
    expect(initial.shell.y + initial.shell.height).toBeLessThanOrEqual(viewport.height);

    await continueToWork(page);
    const work = await onboardingGeometry(page);
    expectStableOnboardingShell(work, initial);
    expectStepsInsideVisual(work);
    await expectJourneyControls(page, 2);
    const workAlignment = await expectFormAlignment(page, 'What are you working on?');
    expect(workAlignment.title.x).toBe(initialAlignment.title.x);
    expect(workAlignment.title.y).toBe(initialAlignment.title.y);
    expect(workAlignment.description).toBeNull();
    expect(workAlignment.form.x).toBe(initialAlignment.form.x);
    expect(work.panel.overflowY).toBe('auto');
    expect(work.panel.scrollTop).toBe(0);
    expect(work.panel.scrollHeight).toBeLessThanOrEqual(work.panel.clientHeight);

    const panel = page.locator('.login-form');
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    const [presetPanelBox, presetContinueBox] = await Promise.all([panel.boundingBox(), continueButton.boundingBox()]);
    expect(presetContinueBox.y).toBeGreaterThanOrEqual(presetPanelBox.y);
    expect(presetContinueBox.y + presetContinueBox.height).toBeLessThanOrEqual(presetPanelBox.y + presetPanelBox.height);

    await bioField(page).evaluate((element) => { element.style.height = '400px'; });
    expect((await onboardingGeometry(page)).panel.scrollHeight).toBeGreaterThan(work.panel.clientHeight);
    await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const scrolledWork = await onboardingGeometry(page);
    expectStableOnboardingShell(scrolledWork, initial);
    expect(scrolledWork.panel.scrollTop).toBeGreaterThan(0);
    expect(scrolledWork.pageScrollY).toBe(initial.pageScrollY);
    expect(scrolledWork.documentScrollTop).toBe(initial.documentScrollTop);
    expect(scrolledWork.bodyScrollTop).toBe(initial.bodyScrollTop);

    await continueButton.scrollIntoViewIfNeeded();
    const [panelBox, continueBox] = await Promise.all([panel.boundingBox(), continueButton.boundingBox()]);
    expect(continueBox.y).toBeGreaterThanOrEqual(panelBox.y);
    expect(continueBox.y + continueBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
    await bioField(page).evaluate((element) => { element.style.height = ''; });
    await continueToMeet(page);

    const meet = await onboardingGeometry(page);
    expectStableOnboardingShell(meet, initial);
    expectStepsInsideVisual(meet);
    await expectJourneyControls(page, 3);
    const meetAlignment = await expectFormAlignment(page, 'Who would you love to meet?');
    expect(meetAlignment.title.x).toBe(initialAlignment.title.x);
    expect(meetAlignment.title.y).toBe(initialAlignment.title.y);
    expect(meetAlignment.description.x).toBe(initialAlignment.description.x);
    expect(meetAlignment.form.x).toBe(initialAlignment.form.x);
    expect(meet.panel.scrollTop).toBe(0);

    await stepButton(page, 2).click();
    await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
    expect((await onboardingGeometry(page)).panel.scrollTop).toBe(0);
  });
}

test('journey cards navigate freely by pointer and keyboard while preserving pending tags', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 740 });
  const traffic = await openEntry(page);
  await expectJourneyControls(page, 1);

  await stepButton(page, 2).click();
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  const pendingSkill = chipGroup(page, 'I can help with').getByRole('textbox', { name: 'Add a skill', exact: true });
  await pendingSkill.fill('Pending facilitation');

  await stepButton(page, 1).click();
  await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
  await expectJourneyControls(page, 1);
  await stepButton(page, 3).click();
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  await expectJourneyControls(page, 3);

  await stepButton(page, 2).focus();
  await stepButton(page, 2).press('Enter');
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  await expectJourneyControls(page, 2);
  await expect(pendingSkill).toHaveValue('Pending facilitation');
  const panel = page.locator('.login-form');
  await bioField(page).evaluate((element) => { element.style.height = '400px'; });
  expect((await onboardingGeometry(page)).panel.scrollHeight).toBeGreaterThan(
    (await onboardingGeometry(page)).panel.clientHeight,
  );
  await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect((await onboardingGeometry(page)).panel.scrollTop).toBeGreaterThan(0);

  await stepButton(page, 1).focus();
  await stepButton(page, 1).press('Space');
  await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
  await expectJourneyControls(page, 1);
  expect((await onboardingGeometry(page)).panel.scrollTop).toBe(0);
  expect(traffic.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
});

test('mobile onboarding uses natural page scroll instead of an internal form scroller', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEntry(page);
  await continueToWork(page);
  const panel = page.locator('.login-form');
  const before = await onboardingGeometry(page);
  expect(before.panel.overflowY).toBe('visible');
  expect(before.documentScrollHeight).toBeGreaterThan(before.viewportHeight);
  await panel.evaluate((element) => { element.scrollTop = 100; });
  expect((await onboardingGeometry(page)).panel.scrollTop).toBe(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect((await onboardingGeometry(page)).pageScrollY).toBeGreaterThan(0);
});

for (const viewport of viewports) {
  test(`completes all three preset steps and saves the confirmed profile on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const traffic = await openEntry(page);

    const selector = page.getByRole('group', { name: 'Autofill a demo person', exact: true });
    await expect(selector.getByRole('button', { name: 'Alex', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(selector.getByRole('button', { name: 'Maya', exact: true })).toBeVisible();
    await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Alex');
    await expect(page.getByLabel('Last name', { exact: true })).toHaveValue('Morgan');
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('alex@example.com');
    await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('Hardware engineer');
    await expect(page.getByText(/Demo mode · No account or password required\./)).toHaveCount(0);

    await continueToWork(page);
    await expect(selector).toHaveCount(0);
    await expectDesktopStepWithinViewport(page, 'What are you working on?', 'Continue');
    await expect(bioField(page)).toHaveValue(
      'Building a wearable navigation system that makes the world easier to explore.',
    );
    await expectChips(page, 'I can help with', ['Embedded systems', 'C++', 'Electronics']);
    await expectPillChip(page, 'I can help with', 'Embedded systems');
    await expect(chipGroup(page, 'I can help with').getByRole('textbox', { name: 'Add a skill', exact: true })).toBeVisible();
    await expect(page.getByLabel('LinkedIn profile', { exact: true })).toHaveValue('');
    await expect(page.getByText('A little context makes a better introduction.', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/(?:won.t|not|never).*import/i)).toHaveCount(0);
    await expect(page.getByText(/Demo mode · No account or password required\./)).toHaveCount(0);

    await continueToMeet(page);
    await expect(selector).toHaveCount(0);
    await expectDesktopStepWithinViewport(page, 'Who would you love to meet?', 'Go to Home');
    await expectChips(page, 'Interests', ['Assistive technology', 'Robotics', 'Open source']);
    await expectPillChip(page, 'Interests', 'Assistive technology');
    await expect(chipGroup(page, 'Interests').getByRole('textbox', { name: 'Add an interest', exact: true })).toBeVisible();
    await expectChips(page, "I'm looking for help with", ['Computer vision']);
    await expectPillChip(page, "I'm looking for help with", 'Computer vision');
    await expect(chipGroup(page, "I'm looking for help with").getByRole('textbox', { name: 'Add what you need', exact: true })).toBeVisible();
    const addedInterest = chipGroup(page, 'Interests').getByRole('textbox', { name: 'Add an interest', exact: true });
    await addedInterest.fill('Human factors');
    await addedInterest.press('Enter');
    await expectPillChip(page, 'Interests', 'Human factors');
    await chipGroup(page, 'Interests').getByRole('button', { name: 'Remove Human factors', exact: true }).click();
    await expect(chipGroup(page, 'Interests').getByRole('button', { name: 'Remove Human factors', exact: true })).toHaveCount(0);
    await expect(page.getByText('The Builders Room', { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo room · Code DEMO/)).toBeVisible();
    await expect(page.getByText(/Demo mode · No account or password required\./)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (viewport.name === 'desktop') traffic.profileDelayMs = 750;
    await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
    if (viewport.name === 'desktop') {
      for (const step of journeySteps) await expect(stepButton(page, step.number)).toBeDisabled();
    }
    await expect(page).toHaveURL(/#\/home$/);

    const loginRequests = traffic.requests.filter((request) => request.path === '/api/login');
    await expect(page.getByRole('heading', { name: 'Your focus', exact: true })).toBeVisible();
    const profileRequests = traffic.requests.filter((request) => request.path === '/api/profile');
    const roomRequests = traffic.requests.filter((request) => request.path === '/api/room');
    expect(loginRequests).toHaveLength(1);
    expect(profileRequests).toHaveLength(1);
    expect(profileRequests[0]).toEqual({
      path: '/api/profile',
      method: 'PATCH',
      body: {
        name: 'Alex Morgan',
        email: 'alex@example.com',
        role: 'Hardware engineer',
        bio: 'Building a wearable navigation system that makes the world easier to explore.',
        skills: ['Embedded systems', 'C++', 'Electronics'],
        interests: ['Assistive technology', 'Robotics', 'Open source'],
        lookingFor: ['Computer vision'],
        linkedin: '',
      },
    });
    expect(roomRequests).toEqual([{ path: '/api/room', method: 'POST', body: { code: 'DEMO' } }]);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
  });
}

test('edited details and chips survive step navigation and reload, then drive the real matcher', async ({ page }) => {
  const traffic = await openEntry(page);
  await page.getByLabel('First name', { exact: true }).fill('Alexandra');
  await page.getByLabel('Last name', { exact: true }).fill('Morgan');
  await page.getByLabel('Email', { exact: true }).fill('alexandra@example.com');
  await page.getByLabel('Headline', { exact: true }).fill('Wearable systems lead');
  await continueToWork(page);

  await bioField(page).fill('Prototyping accessible wearable tools.');
  await replaceChips(page, 'I can help with', 'Add a skill', ['Hardware']);
  await page.getByLabel('LinkedIn profile', { exact: true }).fill('https://www.linkedin.com/in/alexandra-morgan');
  await continueToMeet(page);
  await replaceChips(page, 'Interests', 'Add an interest', ['Wearable computing']);
  await replaceChips(page, "I'm looking for help with", 'Add what you need', ['Computer vision']);

  await stepButton(page, 2).click();
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  await expect(bioField(page)).toHaveValue('Prototyping accessible wearable tools.');
  await expectChips(page, 'I can help with', ['Hardware']);
  await stepButton(page, 1).click();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Alexandra');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('alexandra@example.com');
  await continueToWork(page);
  await continueToMeet(page);

  const storedDraft = await page.evaluate((key) => sessionStorage.getItem(key), draftKey);
  expect(storedDraft).toContain('Alexandra');
  expect(storedDraft).toContain('Wearable computing');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  await expectChips(page, 'Interests', ['Wearable computing']);
  await expectChips(page, "I'm looking for help with", ['Computer vision']);
  await stepButton(page, 2).click();
  await expect(page.getByLabel('LinkedIn profile', { exact: true })).toHaveValue(
    'https://www.linkedin.com/in/alexandra-morgan',
  );
  await expectChips(page, 'I can help with', ['Hardware']);
  await continueToMeet(page);
  const pendingNeed = chipGroup(page, "I'm looking for help with").getByRole('textbox', { name: 'Add what you need', exact: true });
  await pendingNeed.fill('Machine learning');
  await pendingNeed.press('Enter');
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);

  const state = await savedState(traffic);
  expect(state.profiles.find((profile) => profile.id === 'alex')).toMatchObject({
    name: 'Alexandra Morgan',
    email: 'alexandra@example.com',
    role: 'Wearable systems lead',
    bio: 'Prototyping accessible wearable tools.',
    skills: ['Hardware'],
    interests: ['Wearable computing'],
    lookingFor: ['Computer vision', 'Machine learning'],
    linkedin: 'https://www.linkedin.com/in/alexandra-morgan',
  });

  const matched = await isolatedApi('/api/matches', {
    method: 'POST',
    sessionId: traffic.sessionId,
    body: { force: true },
  });
  expect(matched.response.status).toBe(200);
  expect(matched.value.matches.find((match) => match.userA === 'alex' && match.userB === 'maya')).toMatchObject({
    compatible: true,
    score: 0.99,
    reason: 'Maya offers Computer vision, which Alexandra is seeking.',
    source: 'mock',
  });

  await page.goto(`${origin}/#/home`);
  const focus = page.getByRole('region', { name: 'Your focus', exact: true });
  await expect(focus).toContainText('Prototyping accessible wearable tools.');
  await expect(focus.getByText('Computer vision', { exact: true })).toBeVisible();
  await expect(focus.getByText('Machine learning', { exact: true })).toBeVisible();
});

test('Alex and Maya keep independent drafts across the three steps', async ({ page }) => {
  await openEntry(page);
  await page.getByLabel('First name', { exact: true }).fill('Alex Draft');
  await continueToWork(page);
  await bioField(page).fill('Alex-only biography');
  await replaceChips(page, 'I can help with', 'Add a skill', ['Alex-only skill']);
  await stepButton(page, 1).click();

  await page.getByRole('button', { name: 'Maya', exact: true }).click();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Maya');
  await continueToWork(page);
  await expect(bioField(page)).toHaveValue(
    'Building visual assistance software. Curious about bringing intelligence into everyday objects.',
  );
  await bioField(page).fill('Maya-only biography');
  await replaceChips(page, 'I can help with', 'Add a skill', ['Maya-only skill']);
  await stepButton(page, 1).click();

  await page.getByRole('button', { name: 'Alex', exact: true }).click();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Alex Draft');
  await continueToWork(page);
  await expect(bioField(page)).toHaveValue('Alex-only biography');
  await expectChips(page, 'I can help with', ['Alex-only skill']);
});

test('final submission redirects skipped invalid fields to their owning step without API traffic', async ({ page }) => {
  const traffic = await openEntry(page);
  for (const field of [
    { label: 'First name', invalid: '   ', valid: 'Alex' },
    { label: 'Last name', invalid: '   ', valid: 'Morgan' },
    { label: 'Email', invalid: 'alex@localhost', valid: 'alex@example.com' },
    { label: 'Headline', invalid: '   ', valid: 'Hardware engineer' },
  ]) {
    await page.getByLabel(field.label, { exact: true }).fill(field.invalid);
    await stepButton(page, 3).click();
    await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
    expect(traffic.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
    await page.getByLabel(field.label, { exact: true }).fill(field.valid);
  }

  await stepButton(page, 2).click();
  await page.getByLabel('LinkedIn profile', { exact: true }).fill('https://example.com/in/alex');
  await stepButton(page, 3).click();
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  expect(traffic.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
});

test('profile and room failures retry from step 3 without losing the created session or draft', async ({ page }) => {
  const traffic = await openEntry(page, 'spatial');
  await continueToWork(page);
  await bioField(page).fill('A retry-safe draft');
  await continueToMeet(page);
  await chipGroup(page, "I'm looking for help with").getByRole('textbox', { name: 'Add what you need', exact: true }).fill('Machine learning');

  traffic.failProfile = true;
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Profile save unavailable. Try again.');
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  expect(traffic.requests.filter((request) => request.path === '/api/profile').at(-1).body.lookingFor).toEqual([
    'Computer vision',
    'Machine learning',
  ]);
  const createdSession = traffic.sessionId;
  expect(createdSession).toBeTruthy();

  traffic.failProfile = false;
  traffic.failRoom = true;
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Room join unavailable. Try again.');
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  await expectChips(page, "I'm looking for help with", ['Computer vision', 'Machine learning']);
  expect(traffic.sessionId).toBe(createdSession);

  traffic.failRoom = false;
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  expect(traffic.sessionId).toBe(createdSession);
  expect(traffic.requests.filter((request) => request.path === '/api/login')).toHaveLength(1);
  expect(traffic.requests.filter((request) => request.path === '/api/room')).toHaveLength(2);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
});

test('a failed protected-route profile save remains on step 3 after refresh', async ({ page }) => {
  const traffic = await openEntry(page, 'spatial');
  await continueToWork(page);
  await bioField(page).fill('Protected-route retry draft');
  await continueToMeet(page);
  traffic.failProfile = true;
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Profile save unavailable. Try again.');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  await expectChips(page, "I'm looking for help with", ['Computer vision']);
  await stepButton(page, 2).click();
  await expect(bioField(page)).toHaveValue('Protected-route retry draft');
});

test('an expired same-person session fails once, preserves step 3, and succeeds on retry', async ({ page }) => {
  const login = await isolatedApi('/api/login', { method: 'POST', body: { profileId: 'alex' } });
  const expiredSession = login.value.session.id;
  await page.addInitScript(({ sessionKey: key, sessionId }) => sessionStorage.setItem(key, sessionId), {
    sessionKey,
    sessionId: expiredSession,
  });
  const traffic = await openEntry(page);
  await continueToWork(page);
  await bioField(page).fill('Draft preserved across an expired session');
  await continueToMeet(page);
  await isolatedApi('/api/logout', { method: 'POST', sessionId: expiredSession, body: {} });

  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Your demo session expired. Your draft is safe—try again.');
  await expect(page.getByRole('heading', { name: 'Who would you love to meet?' })).toBeVisible();
  expect(traffic.requests.filter((request) => request.path === '/api/login')).toHaveLength(0);
  expect(traffic.requests.filter((request) => request.path === '/api/profile')).toHaveLength(1);

  await stepButton(page, 2).click();
  await expect(bioField(page)).toHaveValue('Draft preserved across an expired session');
  await continueToMeet(page);
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  expect(traffic.sessionId).not.toBe(expiredSession);
  expect(traffic.requests.filter((request) => request.path === '/api/login')).toHaveLength(1);
  expect((await savedState(traffic)).profiles.find((profile) => profile.id === 'alex').bio).toBe(
    'Draft preserved across an expired session',
  );
});

test('a valid joined session is reused without another login or room join', async ({ page }) => {
  const login = await isolatedApi('/api/login', { method: 'POST', body: { profileId: 'maya' } });
  const existingSession = login.value.session.id;
  await isolatedApi('/api/room', { method: 'POST', sessionId: existingSession, body: { code: 'DEMO' } });
  await page.addInitScript(({ sessionKey: key, sessionId }) => sessionStorage.setItem(key, sessionId), {
    sessionKey,
    sessionId: existingSession,
  });
  const traffic = await openEntry(page);
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Maya');
  await continueToWork(page);
  await continueToMeet(page);
  await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);

  expect(traffic.sessionId).toBe(existingSession);
  expect(traffic.requests.filter((request) => request.path === '/api/login')).toHaveLength(0);
  expect(traffic.requests.filter((request) => request.path === '/api/profile')).toHaveLength(1);
  expect(traffic.requests.filter((request) => request.path === '/api/room')).toHaveLength(0);

  await page.evaluate((key) => sessionStorage.setItem(key, 'logout-clears-this-draft'), draftKey);
  await page.goto(`${origin}/#/profile`);
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visibility' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
});

test('X returns to the landing page without submitting and Step inside reopens entry', async ({ page }) => {
  const traffic = await openEntry(page);
  await page.getByRole('link', { name: 'Close and return to Catalyst', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(traffic.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
  await page.getByRole('button', { name: 'Step inside', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
});

test('live Vite and API create a fresh temporary entry session and clean it up', async ({ page }) => {
  let sessionId;
  try {
    await page.addInitScript(({ draftKey: draft, sessionKey: session }) => {
      sessionStorage.removeItem(draft);
      sessionStorage.removeItem(session);
    }, { draftKey, sessionKey });
    await page.goto(`${origin}/#/login`);
    await expect(page.getByRole('heading', { name: 'Create your profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Maya', exact: true }).click();
    await page.getByLabel('Headline', { exact: true }).fill('Computer vision prototyper');
    await continueToWork(page);
    await continueToMeet(page);

    const loginResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Go to Home', exact: true }).click();
    sessionId = (await (await loginResponse).json()).session.id;
    await expect(page).toHaveURL(/#\/home$/);

    const response = await fetch(`${origin}/api/bootstrap`, { headers: { 'x-session-id': sessionId } });
    const state = await response.json();
    expect(state.session).toMatchObject({ userId: 'maya', code: 'DEMO' });
    expect(state.profiles.find((profile) => profile.id === 'maya').role).toBe('Computer vision prototyper');
  } finally {
    if (sessionId) {
      await fetch(`${origin}/api/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
        body: '{}',
      });
    }
  }
});
