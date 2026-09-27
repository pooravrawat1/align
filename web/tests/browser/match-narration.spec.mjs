import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';

// Real browser decoding/playback without a paid provider request or audible speech.
function silentWav() {
  const sampleRate = 16000;
  const bytes = sampleRate * 2 * 10;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
  return wav;
}

async function enter(page) {
  await page.goto(origin + '/#/spatial');
  await page.getByRole('button', { name: 'Enter preview', exact: true }).click();
}

test('a new match reads its shared introduction once, repeated refreshes stay quiet, and mute stops speech', async ({ page }) => {
  const env = await workspace(page);
  const requested = [];
  await page.route('**/api/narration', async route => {
    requested.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() });
  });
  try {
    await enter(page);
    await expect(page.getByText('Reading your shared introduction', { exact: true })).toBeVisible();
    expect(requested).toEqual([{ participantId: 'maya' }]);
    await page.getByRole('button', { name: 'Preview controls', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh matches', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh matches', exact: true })).toBeEnabled();
    expect(requested).toHaveLength(1);
    await page.getByRole('button', { name: 'Mute match narration', exact: true }).click();
    await expect(page.getByText('Reading your shared introduction', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable match narration', exact: true })).toBeVisible();
    await page.screenshot({ path: '/private/tmp/catalyst-narration-browser.png' });
  } finally { await env.close(); }
});

test('audio failure leaves matching usable and can be retried', async ({ page }) => {
  const env = await workspace(page);
  let calls = 0;
  await page.route('**/api/narration', async route => {
    calls++;
    await route.fulfill(calls === 1
      ? { status: 503, json: { error: 'Narration unavailable' } }
      : { status: 200, contentType: 'audio/wav', body: silentWav() });
  });
  try {
    await enter(page);
    await expect(page.getByText('Match audio unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByText('Green means a reason to meet', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Retry audio', exact: true }).click();
    await expect(page.getByText('Reading your shared introduction', { exact: true })).toBeVisible();
    expect(calls).toBe(2);
    await page.getByRole('button', { name: 'Back to event', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Spatial preview' })).toHaveCount(0);
    await expect(page.getByText('Reading your shared introduction', { exact: true })).toHaveCount(0);
  } finally { await env.close(); }
});
