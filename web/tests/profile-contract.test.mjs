import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';

import { createServer } from '../server/index.mjs';

const contract = JSON.parse(
  await readFile(new URL('../shared/profile-contract.json', import.meta.url), 'utf8'),
);

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function api(path, { method = 'GET', body, sessionId } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(sessionId === undefined ? {} : { 'x-session-id': sessionId }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, value: await response.json() };
}

function currentProfile(bootstrap) {
  return bootstrap.profiles.find((profile) => profile.id === bootstrap.session.userId);
}

function valueOfLength(field, length) {
  if (field === 'linkedin') {
    const prefix = 'https://linkedin.com/in/';
    return `${prefix}${'x'.repeat(length - prefix.length)}`;
  }
  if (field === 'website') {
    const prefix = 'https://example.com/';
    return `${prefix}${'x'.repeat(length - prefix.length)}`;
  }
  if (field === 'email') {
    const suffix = '@b.co';
    return `${'x'.repeat(length - suffix.length)}${suffix}`;
  }
  return 'x'.repeat(length);
}

test('shared profile contract has the approved bounded shape', () => {
  assert.deepEqual(contract, {
    stringLimits: {
      name: 80,
      role: 120,
      bio: 500,
      location: 120,
      contact: 160,
      linkedin: 512,
      website: 512,
      email: 254,
    },
    topicLimit: 20,
    topicItemLimit: 80,
    photo: {
      maxSourceBytes: 10485760,
      maxBytes: 262144,
      size: 512,
      mimeType: 'image/jpeg',
    },
    defaultVisibility: {
      bio: true,
      interests: true,
      skills: true,
      lookingFor: true,
      contact: false,
      linkedin: false,
      website: false,
      email: false,
      previousConnections: true,
      activeInEvent: true,
    },
  });
});

function jpegDataUrl({
  width = contract.photo.size,
  height = contract.photo.size,
  byteLength = 64,
} = {}) {
  assert.ok(byteLength >= 23);
  const bytes = Buffer.alloc(byteLength);
  Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff,
    width >> 8, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
  ]).copy(bytes);
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return `data:${contract.photo.mimeType};base64,${bytes.toString('base64')}`;
}

test('profile API accepts, persists, and removes a bounded JPEG avatar', async () => {
  const login = await api('/api/login', { method: 'POST', body: {} });
  const sessionId = login.value.session.id;
  const avatar = jpegDataUrl({ byteLength: contract.photo.maxBytes });

  const saved = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { avatar },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(currentProfile(saved.value).avatar, avatar);

  const persisted = await api('/api/bootstrap', { sessionId });
  assert.equal(currentProfile(persisted.value).avatar, avatar);

  const removed = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { avatar: '' },
  });
  assert.equal(removed.status, 200);
  assert.equal(currentProfile(removed.value).avatar, '');
});

test('profile API rejects invalid avatar writes atomically', async () => {
  const login = await api('/api/login', { method: 'POST', body: {} });
  const sessionId = login.value.session.id;
  const initial = currentProfile(login.value);
  const invalidAvatars = [
    '/assets/replacement.jpg',
    'https://example.com/avatar.jpg',
    'data:image/png;base64,iVBORw0KGgo=',
    `data:${contract.photo.mimeType};base64,!!!!`,
    `data:${contract.photo.mimeType};base64,${Buffer.from('not a jpeg').toString('base64')}`,
    jpegDataUrl({ width: contract.photo.size + 1 }),
    jpegDataUrl({ height: contract.photo.size + 1 }),
    jpegDataUrl({ byteLength: contract.photo.maxBytes + 1 }),
  ];

  for (const avatar of invalidAvatars) {
    const rejected = await api('/api/profile', {
      method: 'PATCH',
      sessionId,
      body: { avatar, bio: 'must not save' },
    });
    assert.equal(rejected.status, 400, avatar.slice(0, 80));
  }

  const unchanged = await api('/api/bootstrap', { sessionId });
  assert.equal(currentProfile(unchanged.value).avatar, initial.avatar);
  assert.equal(currentProfile(unchanged.value).bio, initial.bio);
});

test('avatar-only patches preserve matches and seed fixture matching', async () => {
  const login = await api('/api/login', { method: 'POST', body: {} });
  const sessionId = login.value.session.id;
  const joined = await api('/api/room', {
    method: 'POST',
    sessionId,
    body: { code: 'DEMO' },
  });
  assert.equal(joined.status, 200);

  const matched = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true },
  });
  assert.equal(matched.status, 200);
  const fixture = matched.value.matches.find(match => match.userA === 'alex' && match.userB === 'maya');
  assert.equal(fixture.source, 'precomputed');

  const avatarSaved = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { avatar: jpegDataUrl() },
  });
  assert.equal(avatarSaved.status, 200);
  assert.deepEqual(avatarSaved.value.matches, matched.value.matches);

  const forced = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true, force: true },
  });
  assert.equal(forced.status, 200);
  assert.equal(
    forced.value.matches.find(match => match.userA === 'alex' && match.userB === 'maya').source,
    'precomputed',
  );
});

test('profile API enforces shared string limits and keeps rejected patches atomic', async () => {
  const login = await api('/api/login', { method: 'POST', body: {} });
  assert.equal(login.status, 200);
  const sessionId = login.value.session.id;
  assert.deepEqual(currentProfile(login.value).visibility, contract.defaultVisibility);

  for (const [field, limit] of Object.entries(contract.stringLimits)) {
    const acceptedValue = valueOfLength(field, limit);
    const accepted = await api('/api/profile', {
      method: 'PATCH',
      sessionId,
      body: { [field]: acceptedValue },
    });
    assert.equal(accepted.status, 200, `${field} should accept ${limit} characters`);
    assert.equal(currentProfile(accepted.value)[field], acceptedValue);

    const rejected = await api('/api/profile', {
      method: 'PATCH',
      sessionId,
      body: {
        [field]: valueOfLength(field, limit + 1),
        ...(field === 'bio' ? {} : { bio: 'must not save' }),
      },
    });
    assert.equal(rejected.status, 400, `${field} should reject ${limit + 1} characters`);

    const unchanged = await api('/api/bootstrap', { sessionId });
    assert.equal(currentProfile(unchanged.value)[field], acceptedValue);
    if (field !== 'bio') assert.notEqual(currentProfile(unchanged.value).bio, 'must not save');
  }
});

test('profile API enforces shared topic count and item limits', async () => {
  const login = await api('/api/login', { method: 'POST', body: {} });
  const sessionId = login.value.session.id;
  const topics = Array.from({ length: contract.topicLimit }, (_, index) => `topic-${index}`);

  const acceptedCount = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { interests: topics },
  });
  assert.equal(acceptedCount.status, 200);

  const rejectedCount = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { interests: [...topics, 'one-too-many'] },
  });
  assert.equal(rejectedCount.status, 400);

  const acceptedItem = 'x'.repeat(contract.topicItemLimit);
  const acceptedLength = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { skills: [acceptedItem] },
  });
  assert.equal(acceptedLength.status, 200);

  const rejectedLength = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { skills: [`${acceptedItem}x`] },
  });
  assert.equal(rejectedLength.status, 400);

  const unchanged = await api('/api/bootstrap', { sessionId });
  assert.deepEqual(currentProfile(unchanged.value).interests, topics);
  assert.deepEqual(currentProfile(unchanged.value).skills, [acceptedItem]);
});
