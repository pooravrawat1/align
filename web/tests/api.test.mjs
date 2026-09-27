import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';

import { createServer } from '../server/index.mjs';

const seed = JSON.parse(
  await readFile(new URL('../shared/demo-data.json', import.meta.url), 'utf8'),
);
const fixtureReason =
  'You both attended Build Together in 2025. What stayed with each of you from it?';
const defaultVisibility = {
  bio: true,
  interests: true,
  skills: true,
  lookingFor: true,
  goals: true,
  domains: true,
  experiences: true,
  contact: false,
  linkedin: false,
  website: false,
  email: false,
  previousConnections: true,
  activeInEvent: true,
};
const seededProfiles = seed.profiles.map((profile) => ({
  ...profile,
  goals: profile.goals ?? [],
  domains: profile.domains ?? [],
  experiences: profile.experiences ?? [],
  contact: profile.contact ?? '',
  linkedin: profile.linkedin ?? '',
  website: profile.website ?? '',
  email: profile.email ?? '',
  visibility: defaultVisibility,
}));
const seededConnections = seed.connections.map((connection) => ({
  ...connection,
  userA: [connection.userA, connection.userB].sort()[0],
  userB: [connection.userA, connection.userB].sort()[1],
  ownerId: connection.userA,
  participantId: connection.userB,
  notes: connection.notes ?? '',
  followUp: connection.followUp ?? 'needed',
  reminderDate: connection.reminderDate ?? '',
  sharedExperiences: connection.sharedExperiences ?? [],
  saved: true,
}));

let server;
let baseUrl;

beforeEach(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function api(path, { method = 'GET', body, sessionId } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (sessionId !== undefined) headers['x-session-id'] = sessionId;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  return { status: response.status, value };
}

async function login(body = {}) {
  const result = await api('/api/login', { method: 'POST', body });
  assert.equal(result.status, 200);
  return result.value;
}

async function joinRoom(sessionId, code = 'DEMO', create = false) {
  const result = await api('/api/room', {
    method: 'POST',
    sessionId,
    body: create ? { code, create: true } : { code },
  });
  assert.equal(result.status, 200);
  return result.value;
}

function currentProfile(bootstrap) {
  return bootstrap.profiles.find((profile) => profile.id === bootstrap.session.userId);
}

function pairCount(connections, firstId, secondId) {
  const ids = [firstId, secondId].sort();
  return connections.filter(
    (connection) => connection.userA === ids[0] && connection.userB === ids[1],
  ).length;
}

test('health and public bootstrap expose a session-free demo seed', async () => {
  const health = await api('/api/health');
  assert.deepEqual(health, { status: 200, value: { ok: true, demo: true } });

  const bootstrap = await api('/api/bootstrap');
  assert.equal(bootstrap.status, 200);
  assert.deepEqual(bootstrap.value.profiles, seededProfiles);
  assert.deepEqual(bootstrap.value.events, seed.events);
  assert.deepEqual(bootstrap.value.connections, seededConnections);
  assert.deepEqual(bootstrap.value.matches, []);
  assert.equal('connectionRequests' in bootstrap.value, false);
  assert.equal(bootstrap.value.session, null);

  const badSession = await api('/api/bootstrap', { sessionId: 'not-a-session' });
  assert.equal(badSession.status, 401);
  assert.deepEqual(Object.keys(badSession.value), ['error']);
});

test('Maya has a populated private people list while Alex remains owner-scoped', async () => {
  const maya = await login({ profileId: 'maya' });
  assert.deepEqual(maya.connections.map(connection => connection.participantId).sort(), ['elena', 'leo', 'priya', 'theo']);
  assert.ok(maya.connections.every(connection => connection.ownerId === 'maya' && connection.notes.length > 0));
  assert.ok(maya.connections.some(connection => connection.followUp === 'contacted'));
  assert.ok(maya.connections.some(connection => connection.reminderDate));
  const alex = await login();
  assert.ok(alex.connections.every(connection => connection.ownerId === 'alex'));
  assert.equal(alex.connections.some(connection => connection.participantId === 'maya'), false);
  assert.equal(maya.profiles.find(profile => profile.id === 'alex').email, '');
});

test('the removed connection-request API is no longer exposed', async () => {
  const loggedIn = await login();
  const response = await api('/api/connection-requests', {
    method: 'POST',
    sessionId: loggedIn.session.id,
    body: { participantId: 'maya', eventId: 'demo' },
  });
  assert.equal(response.status, 404);
  assert.equal('connectionRequests' in loggedIn, false);
});

test('logins have unique sessions and share the latest profile identity', async () => {
  const first = await login();
  const second = await login();
  assert.notEqual(first.session.id, second.session.id);
  assert.equal(first.session.userId, 'alex');

  const changed = await api('/api/profile', {
    method: 'PATCH',
    sessionId: first.session.id,
    body: { name: 'First Alex' },
  });
  assert.equal(changed.status, 200);
  assert.equal(currentProfile(changed.value).name, 'First Alex');

  const resumed = await api('/api/bootstrap', { sessionId: second.session.id });
  assert.equal(currentProfile(resumed.value).name, 'First Alex');
});

test('profile validation is atomic and edits invalidate cached matches', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  await joinRoom(sessionId);
  const initialMatches = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true },
  });
  const fixture = initialMatches.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'maya',
  );
  assert.equal(fixture.source, 'rules');
  assert.equal(fixture.score, 1);
  assert.equal(fixture.reason, fixtureReason);

  const invalid = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { name: '   ', bio: 'would be an accidental partial update' },
  });
  assert.equal(invalid.status, 400);
  const unchanged = await api('/api/bootstrap', { sessionId });
  assert.equal(currentProfile(unchanged.value).bio, seed.profiles[0].bio);
  assert.equal(unchanged.value.matches.length, initialMatches.value.matches.length);

  const edited = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { bio: 'Updated from the profile editor.' },
  });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.value.matches, []);

  const recalculated = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true },
  });
  const safeFixture = recalculated.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'maya',
  );
  assert.equal(safeFixture.source, 'rules');
  assert.equal(safeFixture.reason, fixtureReason); // Editing bio does not change supplied past experience.
  assert.ok(safeFixture.reason.trim().split(/\s+/u).length < 30);
});

test('profile contact and visibility are validated and invalidate private matching inputs', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  assert.equal(currentProfile(loggedIn).contact, '');
  assert.deepEqual(currentProfile(loggedIn).visibility, defaultVisibility);
  await joinRoom(sessionId);

  const initial = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true },
  });
  assert.equal(
    initial.value.matches.find((match) => match.userA === 'alex' && match.userB === 'maya').source,
    'rules',
  );

  const hidden = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: {
      contact: 'alex@example.com',
      visibility: {
        contact: true,
        interests: false,
        domains: false,
        experiences: false,
        skills: false,
        lookingFor: false,
      },
    },
  });
  assert.equal(hidden.status, 200);
  assert.equal(currentProfile(hidden.value).contact, 'alex@example.com');
  assert.equal(currentProfile(hidden.value).visibility.bio, true);
  assert.equal(currentProfile(hidden.value).visibility.contact, true);
  assert.deepEqual(hidden.value.matches, []);

  const privateMatches = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: { demo: true },
  });
  assert.ok(privateMatches.value.matches.every((match) => match.compatible === false));

  const inactivePatch = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: {
      visibility: {
        interests: true,
        skills: true,
        lookingFor: true,
        activeInEvent: false,
      },
    },
  });
  assert.deepEqual(inactivePatch.value.matches, []);
  const inactiveMatches = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.ok(inactiveMatches.value.matches.every((match) => match.compatible === false));

  const invalidContact = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { contact: 'x'.repeat(161) },
  });
  assert.equal(invalidContact.status, 400);
  const invalidVisibility = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { visibility: { activeInEvent: 'yes' } },
  });
  assert.equal(invalidVisibility.status, 400);
});

test('profile contact channels save, clear, and toggle visibility independently', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  const initial = currentProfile(loggedIn);
  assert.equal(initial.linkedin, seed.profiles[0].linkedin);
  assert.equal(initial.website, seed.profiles[0].website);
  assert.equal(initial.email, seed.profiles[0].email);
  assert.equal(initial.visibility.linkedin, false);
  assert.equal(initial.visibility.website, false);
  assert.equal(initial.visibility.email, false);

  const saved = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: {
      linkedin: '  https://www.linkedin.com/in/alex-morgan  ',
      website: '  http://alex.example/about  ',
      email: '  alex@example.com  ',
      visibility: { linkedin: true, website: true, email: true },
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.deepEqual(
    {
      linkedin: currentProfile(saved.value).linkedin,
      website: currentProfile(saved.value).website,
      email: currentProfile(saved.value).email,
    },
    {
      linkedin: 'https://www.linkedin.com/in/alex-morgan',
      website: 'http://alex.example/about',
      email: 'alex@example.com',
    },
  );
  assert.equal(currentProfile(saved.value).visibility.linkedin, true);
  assert.equal(currentProfile(saved.value).visibility.website, true);
  assert.equal(currentProfile(saved.value).visibility.email, true);

  const cleared = await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: {
      linkedin: '  ',
      website: '',
      email: '\t',
      visibility: { linkedin: false, website: false, email: false },
    },
  });
  assert.equal(cleared.status, 200);
  assert.equal(currentProfile(cleared.value).linkedin, '');
  assert.equal(currentProfile(cleared.value).website, '');
  assert.equal(currentProfile(cleared.value).email, '');
  assert.equal(currentProfile(cleared.value).visibility.linkedin, false);
  assert.equal(currentProfile(cleared.value).visibility.website, false);
  assert.equal(currentProfile(cleared.value).visibility.email, false);
});

test('profile contact channel validation rejects unsafe values atomically', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  const invalidPatches = [
    { linkedin: 'https://example.com/in/alex' },
    { linkedin: 'https://notlinkedin.com/in/alex' },
    { linkedin: 'ftp://linkedin.com/in/alex' },
    { linkedin: 'https://user:secret@linkedin.com/in/alex' },
    { linkedin: 'https://linked\tin.com/in/alex' },
    { linkedin: 'https://linkedin.com/in/alex\nadmin' },
    { website: 'example.com' },
    { website: 'javascript:alert(1)' },
    { website: 'https://user:secret@example.com' },
    { website: 'https://example.com/about\radmin' },
    { email: 'alex example.com' },
    { email: 'alex@example.com,maya@example.com' },
    { email: 'alex@example.com\r\nBcc:maya@example.com' },
    { linkedin: `https://linkedin.com/${'x'.repeat(500)}` },
    { website: `https://example.com/${'x'.repeat(500)}` },
    { email: `${'a'.repeat(243)}@example.com` },
  ];

  for (const body of invalidPatches) {
    const result = await api('/api/profile', {
      method: 'PATCH',
      sessionId,
      body: { bio: 'must not be saved', ...body },
    });
    assert.equal(result.status, 400, JSON.stringify(body));
  }

  const unchanged = await api('/api/bootstrap', { sessionId });
  assert.equal(currentProfile(unchanged.value).bio, seed.profiles[0].bio);
  assert.equal(currentProfile(unchanged.value).linkedin, seed.profiles[0].linkedin);
  assert.equal(currentProfile(unchanged.value).website, seed.profiles[0].website);
  assert.equal(currentProfile(unchanged.value).email, seed.profiles[0].email);
});

test('legacy contact remains supported alongside structured contact channels', async () => {
  const loggedIn = await login();
  const updated = await api('/api/profile', {
    method: 'PATCH',
    sessionId: loggedIn.session.id,
    body: {
      contact: '  alex on Matrix  ',
      email: 'alex@example.com',
      visibility: { contact: true, email: true },
    },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  assert.equal(currentProfile(updated.value).contact, '  alex on Matrix  ');
  assert.equal(currentProfile(updated.value).email, 'alex@example.com');
  assert.equal(currentProfile(updated.value).visibility.contact, true);
  assert.equal(currentProfile(updated.value).visibility.email, true);
});

test('matching is deterministic, symmetric, canonical, cached, and deduplicated', async () => {
  const alex = await login({ profileId: 'alex' });
  const maya = await login({ profileId: 'maya' });
  await joinRoom(alex.session.id);
  await joinRoom(maya.session.id);

  const alexResult = await api('/api/matches', {
    method: 'POST',
    sessionId: alex.session.id,
    body: {},
  });
  const cached = await api('/api/matches', {
    method: 'POST',
    sessionId: alex.session.id,
    body: {},
  });
  assert.deepEqual(cached.value.matches, alexResult.value.matches);

  const mayaResult = await api('/api/matches', {
    method: 'POST',
    sessionId: maya.session.id,
    body: { force: true },
  });
  const fromAlex = alexResult.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'maya',
  );
  const fromMaya = mayaResult.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'maya',
  );
  assert.deepEqual(fromMaya, fromAlex);
  assert.equal(fromAlex.source, 'rules');
  assert.equal(fromAlex.compatible, true);
  assert.equal(fromAlex.score, 1);
  assert.equal(alexResult.value.matches.length, seed.profiles.length - 1);
  assert.equal(
    new Set(alexResult.value.matches.map((match) => `${match.userA}:${match.userB}`)).size,
    alexResult.value.matches.length,
  );
  assert.ok(alexResult.value.matches.every((match) => match.userA < match.userB));
  assert.ok(alexResult.value.matches.every((match) => match.score === null || (match.score >= 0 && match.score <= 1)));
  assert.ok(
    alexResult.value.matches
      .filter((match) => match.compatible)
      .every((match) => match.reason.split(/\s+/u).length < 30),
  );

  const neutral = alexResult.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'sam',
  );
  assert.deepEqual(neutral, {
    userA: 'alex',
    userB: 'sam',
    compatible: false,
    score: null,
    reason: '',
    source: 'unavailable',
  });
});

test('connections are canonical and idempotent in each isolated session', async () => {
  const alex = await login({ profileId: 'alex' });
  const sessionId = alex.session.id;

  const first = await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'maya' },
  });
  const second = await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'maya' },
  });
  assert.equal(pairCount(first.value.connections, 'alex', 'maya'), 1);
  assert.equal(pairCount(second.value.connections, 'alex', 'maya'), 1);
  assert.equal(
    first.value.connections.find(
      (connection) => connection.userA === 'alex' && connection.userB === 'maya',
    ).eventId,
    'demo',
  );
  const fallbackContext = first.value.connections.find(
    (connection) => connection.userA === 'alex' && connection.userB === 'maya',
  );
  assert.equal(fallbackContext.ownerId, 'alex');
  assert.equal(fallbackContext.participantId, 'maya');
  assert.equal(
    fallbackContext.reason,
    'Alex and Maya share an interest in Assistive technology.',
  );
  assert.deepEqual(fallbackContext.sharedInterests, ['Assistive technology', 'Robotics']);

  const roomSession = await login({ profileId: 'alex' });
  await joinRoom(roomSession.session.id, 'SPATIAL');
  const roomMatches = await api('/api/matches', {
    method: 'POST',
    sessionId: roomSession.session.id,
    body: {},
  });
  const mayaMatch = roomMatches.value.matches.find(
    (match) => match.userA === 'alex' && match.userB === 'maya',
  );
  const spatial = await api('/api/connections', {
    method: 'POST',
    sessionId: roomSession.session.id,
    body: { participantId: 'maya' },
  });
  assert.equal(
    spatial.value.connections.find(
      (connection) => connection.userA === 'alex' && connection.userB === 'maya',
    ).eventId,
    'spatial',
  );
  const spatialConnection = spatial.value.connections.find(
    (connection) => connection.userA === 'alex' && connection.userB === 'maya',
  );
  assert.equal(spatialConnection.reason, mayaMatch.reason);
  assert.deepEqual(spatialConnection.sharedInterests, ['Assistive technology', 'Robotics']);
  assert.equal(spatialConnection.notes, '');
  assert.equal(spatialConnection.followUp, 'needed');
  assert.equal(spatialConnection.reminderDate, '');

  await joinRoom(roomSession.session.id, 'ROOM42', true);
  const custom = await api('/api/connections', {
    method: 'POST',
    sessionId: roomSession.session.id,
    body: { participantId: 'sam' },
  });
  assert.equal(
    custom.value.connections.find(
      (connection) => connection.userA === 'alex' && connection.userB === 'sam',
    ).eventId,
    'ROOM42',
  );
  const nonmatchingConnection = custom.value.connections.find(
    (connection) => connection.userA === 'alex' && connection.userB === 'sam',
  );
  assert.equal(nonmatchingConnection.ownerId, 'alex');
  assert.equal(nonmatchingConnection.participantId, 'sam');
  assert.equal(nonmatchingConnection.reason, '');
  assert.deepEqual(nonmatchingConnection.sharedInterests, []);

  const maya = await login({ profileId: 'maya' });
  const reverse = await api('/api/connections', {
    method: 'POST',
    sessionId: maya.session.id,
    body: { participantId: 'alex' },
  });
  assert.equal(pairCount(reverse.value.connections, 'alex', 'maya'), 1);
  const reverseConnection = reverse.value.connections.find(
    (connection) => connection.userA === 'alex' && connection.userB === 'maya',
  );
  assert.equal(reverseConnection.ownerId, 'maya');
  assert.equal(reverseConnection.participantId, 'alex');
  assert.equal(reverseConnection.eventId, 'demo');

  const removed = await api('/api/connections/maya', {
    method: 'DELETE',
    sessionId,
  });
  assert.equal(pairCount(removed.value.connections, 'alex', 'maya'), 0);
});

test('saved connection metadata is bounded, validated, and preserves connection context', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  const updated = await api('/api/connections/jordan', {
    method: 'PATCH',
    sessionId,
    body: {
      notes: 'Send the prototype deck.',
      followUp: 'contacted',
      reminderDate: '2026-10-05',
    },
  });
  assert.equal(updated.status, 200);
  const connection = updated.value.connections.find(
    (candidate) => candidate.userA === 'alex' && candidate.userB === 'jordan',
  );
  assert.equal(connection.notes, 'Send the prototype deck.');
  assert.equal(connection.followUp, 'contacted');
  assert.equal(connection.reminderDate, '2026-10-05');
  assert.equal(connection.eventId, 'demo');
  assert.deepEqual(connection.sharedExperiences, [
    { kind: 'professional', label: 'Joined the same Spatial Sessions workshop' },
    { kind: 'music', label: 'Caught Japanese Breakfast at The Eastern' },
  ]);

  for (const body of [
    { notes: 'x'.repeat(2001) },
    { followUp: 'later' },
    { reminderDate: '2026-02-30' },
    { eventId: 'spatial' },
  ]) {
    const invalid = await api('/api/connections/jordan', {
      method: 'PATCH',
      sessionId,
      body,
    });
    assert.equal(invalid.status, 400);
  }

  const missing = await api('/api/connections/sam', {
    method: 'PATCH',
    sessionId,
    body: { notes: 'Not saved yet.' },
  });
  assert.equal(missing.status, 404);
  const preserved = await api('/api/bootstrap', { sessionId });
  const preservedConnection = preserved.value.connections.find(
    (candidate) => candidate.userA === 'alex' && candidate.userB === 'jordan',
  );
  assert.equal(preservedConnection.notes, 'Send the prototype deck.');
  assert.equal(preservedConnection.eventId, 'demo');
  assert.deepEqual(preservedConnection.sharedExperiences, connection.sharedExperiences);

  const isolatedOwner = await login();
  const privateConnection = isolatedOwner.connections.find(
    (candidate) => candidate.userA === 'alex' && candidate.userB === 'jordan',
  );
  assert.equal(privateConnection.notes, '');
  assert.equal(privateConnection.reminderDate, '');
});

test('rooms gate matching and calibration, isolate custom codes, and clear room-scoped matches', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;

  const calibrationWithoutRoom = await api('/api/calibrate', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(calibrationWithoutRoom.status, 409);
  const matchesWithoutRoom = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(matchesWithoutRoom.status, 409);

  const unknown = await api('/api/room', {
    method: 'POST',
    sessionId,
    body: { code: 'NEW123' },
  });
  assert.equal(unknown.status, 404);

  const malformed = await api('/api/room', {
    method: 'POST',
    sessionId,
    body: { code: 'NO-WAY' },
  });
  assert.equal(malformed.status, 400);

  await joinRoom(sessionId);
  const matched = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(matched.value.matches.length, seed.profiles.length - 1);

  const known = await joinRoom(sessionId, 'spatial');
  assert.equal(known.session.code, 'SPATIAL');
  assert.equal(known.session.calibrated, false);
  assert.deepEqual(known.matches, []);

  const calibrated = await api('/api/calibrate', { method: 'POST', sessionId, body: {} });
  assert.equal(calibrated.value.session.calibrated, true);

  const created = await joinRoom(sessionId, 'NEW123', true);
  assert.equal(created.session.code, 'NEW123');
  assert.equal(created.session.calibrated, false);
  assert.equal(created.events.find((event) => event.code === 'NEW123')?.name, 'Room NEW123');
  const createdAgain = await joinRoom(sessionId, 'NEW123', true);
  assert.equal(createdAgain.events.filter((event) => event.code === 'NEW123').length, 1);
  const customConnection = await api('/api/connections', {
    method: 'POST', sessionId, body: { participantId: 'maya' },
  });
  const customEventId = customConnection.value.connections.find((connection) => connection.participantId === 'maya').eventId;
  assert.equal(customEventId, created.events.find((event) => event.code === 'NEW123').id);
  await joinRoom(sessionId, 'DEMO');
  const rejoined = await joinRoom(sessionId, 'new123');
  assert.equal(rejoined.session.code, 'NEW123');
  assert.equal(rejoined.events.filter((event) => event.code === 'NEW123').length, 1);

  const otherSession = await login();
  assert.equal(otherSession.events.some((event) => event.code === 'NEW123'), false);
  const isolated = await api('/api/room', {
    method: 'POST',
    sessionId: otherSession.session.id,
    body: { code: 'NEW123' },
  });
  assert.equal(isolated.status, 404);
});

test('leave clears transient room state while preserving profile and owned connections', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { contact: 'alex@example.com' },
  });
  await joinRoom(sessionId, 'SPATIAL');
  await api('/api/calibrate', { method: 'POST', sessionId, body: {} });
  await api('/api/matches', { method: 'POST', sessionId, body: {} });
  await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'maya' },
  });

  const left = await api('/api/leave', { method: 'POST', sessionId, body: {} });
  assert.equal(left.status, 200);
  assert.equal(left.value.session.code, null);
  assert.equal(left.value.session.calibrated, false);
  assert.deepEqual(left.value.matches, []);
  assert.equal(left.value.session.activeEventId, 'spatial');
  assert.equal(currentProfile(left.value).contact, 'alex@example.com');
  const saved = left.value.connections.find(
    (connection) => connection.ownerId === 'alex' && connection.participantId === 'maya',
  );
  assert.equal(saved.eventId, 'spatial');

  const gated = await api('/api/matches', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(gated.status, 409);
});

test('reset restores the seed clone while preserving session identity', async () => {
  const loggedIn = await login({ profileId: 'maya' });
  const sessionId = loggedIn.session.id;
  await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { name: 'Edited Maya', interests: ['Different interest'] },
  });
  await api('/api/room', { method: 'POST', sessionId, body: { code: 'DEMO' } });
  await api('/api/calibrate', { method: 'POST', sessionId, body: {} });
  await api('/api/matches', { method: 'POST', sessionId, body: { demo: true } });
  await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'sam' },
  });

  const reset = await api('/api/reset', { method: 'POST', sessionId, body: {} });
  assert.equal(reset.status, 200);
  const mayaConnections = seededConnections.filter(connection => connection.ownerId === 'maya');
  const visibleContactIds = new Set(['maya', ...mayaConnections.map(connection => connection.participantId)]);
  assert.deepEqual(reset.value.profiles, seededProfiles.map(profile => visibleContactIds.has(profile.id) ? profile : { ...profile, linkedin: '', website: '', email: '' }));
  assert.deepEqual(reset.value.connections, mayaConnections);
  assert.deepEqual(reset.value.matches, []);
  assert.deepEqual(reset.value.session, {
    id: sessionId,
    code: null,
    activeEventId: null,
    userId: 'maya',
    calibrated: false,
  });
});

test('clear event data removes only current-event owned connections unless all is explicit', async () => {
  const loggedIn = await login();
  const sessionId = loggedIn.session.id;
  await api('/api/profile', {
    method: 'PATCH',
    sessionId,
    body: { contact: 'https://example.com/alex', visibility: { contact: true } },
  });
  await joinRoom(sessionId, 'SPATIAL');
  await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'maya' },
  });
  await joinRoom(sessionId, 'ROOM42', true);
  await api('/api/calibrate', { method: 'POST', sessionId, body: {} });
  await api('/api/matches', { method: 'POST', sessionId, body: {} });
  await api('/api/connections', {
    method: 'POST',
    sessionId,
    body: { participantId: 'sam' },
  });

  const cleared = await api('/api/event-data/clear', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(cleared.status, 200);
  assert.ok(cleared.value.connections.some((connection) => connection.eventId === 'demo'));
  assert.ok(cleared.value.connections.some((connection) => connection.eventId === 'spatial'));
  assert.ok(cleared.value.connections.every((connection) => connection.eventId !== 'ROOM42'));
  assert.deepEqual(cleared.value.matches, []);
  assert.equal(cleared.value.session.code, null);
  assert.equal(cleared.value.session.calibrated, false);
  assert.equal(currentProfile(cleared.value).contact, 'https://example.com/alex');
  assert.equal(currentProfile(cleared.value).visibility.contact, true);

  const withoutRoom = await api('/api/event-data/clear', {
    method: 'POST',
    sessionId,
    body: {},
  });
  assert.equal(withoutRoom.status, 200);
  const preserved = await api('/api/bootstrap', { sessionId });
  assert.deepEqual(preserved.value.connections, cleared.value.connections);

  const clearedAll = await api('/api/event-data/clear', {
    method: 'POST',
    sessionId,
    body: { scope: 'all' },
  });
  assert.equal(clearedAll.status, 200);
  assert.deepEqual(clearedAll.value.connections, []);
  assert.equal(currentProfile(clearedAll.value).contact, 'https://example.com/alex');
});

test('writes require a session, oversized bodies fail, and logout revokes the session', async () => {
  const unauthorized = await api('/api/profile', {
    method: 'PATCH',
    body: { name: 'No session' },
  });
  assert.equal(unauthorized.status, 401);

  const loggedIn = await login();
  const oversized = await api('/api/profile', {
    method: 'PATCH',
    sessionId: loggedIn.session.id,
    body: { bio: 'x'.repeat(17 * 1024) },
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(Object.keys(oversized.value), ['error']);

  const logout = await api('/api/logout', {
    method: 'POST',
    sessionId: loggedIn.session.id,
    body: {},
  });
  assert.deepEqual(logout, { status: 200, value: { ok: true } });
  const revoked = await api('/api/bootstrap', { sessionId: loggedIn.session.id });
  assert.equal(revoked.status, 401);
});
