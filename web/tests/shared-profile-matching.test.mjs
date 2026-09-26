import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createServer } from '../server/index.mjs';

const servers = [];

async function harness(assessmentService) {
  const server = createServer({ assessmentService });
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, { sessionId, body, method = body === undefined ? 'GET' : 'POST' } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(sessionId ? { 'x-session-id': sessionId } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, value: await response.json() };
  };
  const login = async (profileId) => (await api('/api/login', { body: { profileId } })).value;
  return { api, login };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

function readyAssessment() {
  return {
    status: 'ready', score: 80, compatible: true, reason: 'Shared work could make a useful conversation.',
    commonGround: [], contributions: [], starter: 'Shared work could make a useful conversation.',
    categories: [], source: 'rules', route: 'professional',
    routes: { networking: null, professional: 80, personal: 0 },
  };
}

test('room matching uses the latest peer visibility and does not reuse stale match output', async () => {
  const assessed = [];
  const { api, login } = await harness({
    async assess(current, participant) {
      assessed.push({ current: structuredClone(current), participant: structuredClone(participant) });
      const result = readyAssessment();
      return participant.id === 'maya'
        ? { ...result, reason: 'Maya stale match reason.', starter: 'Maya stale match reason.' }
        : result;
    },
  });
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/room', { sessionId: alex.session.id, body: { code: 'DEMO' } });
  const first = await api('/api/matches', { sessionId: alex.session.id, body: {} });
  assert.equal(first.status, 200);
  assert.equal(first.value.matches.find((match) => match.userA === 'alex' && match.userB === 'maya').score, 0.8);
  const mayaCalls = assessed.filter(({ participant }) => participant.id === 'maya').length;

  await api('/api/profile', {
    method: 'PATCH', sessionId: maya.session.id,
    body: { bio: 'WITHDRAWN PRIVATE BIO', visibility: { activeInEvent: false, bio: false } },
  });
  const staleBootstrap = await api('/api/bootstrap', { sessionId: alex.session.id });
  assert.equal(
    staleBootstrap.value.matches.some((match) => match.userA === 'alex' && match.userB === 'maya'),
    false,
  );
  assert.ok(!JSON.stringify(staleBootstrap.value.matches).includes('Maya stale match reason.'));
  const second = await api('/api/matches', { sessionId: alex.session.id, body: {} });
  assert.equal(second.status, 200);
  const withdrawn = second.value.matches.find((match) => match.userA === 'alex' && match.userB === 'maya');
  assert.equal(withdrawn.score, null);
  assert.equal(withdrawn.source, 'unavailable');
  assert.equal(assessed.filter(({ participant }) => participant.id === 'maya').length, mayaCalls);
  assert.ok(!JSON.stringify(assessed).includes('WITHDRAWN PRIVATE BIO'));
  const refreshed = await api('/api/bootstrap', { sessionId: alex.session.id });
  assert.equal(refreshed.value.profiles.find((profile) => profile.id === 'maya').bio, '');
});

test('room matching rejects a result when a peer changes during assessment', async () => {
  let releaseSlowPeer;
  let mayaFinished;
  let slowPeerStarted;
  const finished = new Promise((resolve) => { mayaFinished = resolve; });
  const started = new Promise((resolve) => { slowPeerStarted = resolve; });
  const gate = new Promise((resolve) => { releaseSlowPeer = resolve; });
  const { api, login } = await harness({
    async assess(_current, participant) {
      if (participant.id === 'maya') mayaFinished();
      if (participant.id !== 'maya') {
        slowPeerStarted();
        await gate;
      }
      return readyAssessment();
    },
  });
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/room', { sessionId: alex.session.id, body: { code: 'DEMO' } });
  const pending = api('/api/matches', { sessionId: alex.session.id, body: {} });
  await Promise.all([finished, started]);
  await api('/api/profile', {
    method: 'PATCH', sessionId: maya.session.id,
    body: { visibility: { activeInEvent: false } },
  });
  releaseSlowPeer();
  const stale = await pending;
  assert.equal(stale.status, 409);
});

test('room matching cannot publish after the session leaves or changes rooms', async () => {
  for (const transition of [
    (api, sessionId) => api('/api/leave', { sessionId, body: {} }),
    (api, sessionId) => api('/api/room', { sessionId, body: { code: 'SPATIAL' } }),
  ]) {
    let release;
    let started;
    const gate = new Promise((resolve) => { release = resolve; });
    const assessing = new Promise((resolve) => { started = resolve; });
    const { api, login } = await harness({
      async assess() {
        started();
        await gate;
        return readyAssessment();
      },
    });
    const alex = await login('alex');
    await api('/api/room', { sessionId: alex.session.id, body: { code: 'DEMO' } });
    const pending = api('/api/matches', { sessionId: alex.session.id, body: {} });
    await assessing;
    const moved = await transition(api, alex.session.id);
    assert.equal(moved.status, 200);
    release();
    const stale = await pending;
    assert.equal(stale.status, 409);
    assert.equal(stale.value.error, 'Event changed while compatibility was being generated');
  }
});

test('logout and re-login hydrate the canonical profile before partial edits', async () => {
  const { api, login } = await harness({ assess: async () => readyAssessment() });
  const first = await login('alex');
  await api('/api/profile', {
    method: 'PATCH', sessionId: first.session.id,
    body: {
      bio: 'Canonical private biography', skills: ['Canonical systems skill'],
      visibility: { bio: false, skills: false },
    },
  });
  await api('/api/logout', { sessionId: first.session.id, body: {} });
  const second = (await api('/api/login', {
    body: { profileId: 'alex', name: 'Canonical Alex' },
  })).value;
  const hydrated = second.profiles.find((profile) => profile.id === 'alex');
  assert.equal(hydrated.name, 'Canonical Alex');
  assert.equal(hydrated.bio, 'Canonical private biography');
  assert.deepEqual(hydrated.skills, ['Canonical systems skill']);
  assert.equal(hydrated.visibility.bio, false);
  await api('/api/profile', {
    method: 'PATCH', sessionId: second.session.id, body: { interests: ['New canonical interest'] },
  });
  const refreshed = await api('/api/bootstrap', { sessionId: second.session.id });
  const profile = refreshed.value.profiles.find((candidate) => candidate.id === 'alex');
  assert.equal(profile.bio, 'Canonical private biography');
  assert.deepEqual(profile.skills, ['Canonical systems skill']);
  assert.deepEqual(profile.interests, ['New canonical interest']);
  assert.equal(profile.visibility.skills, false);
  assert.equal(profile.name, 'Canonical Alex');
});

test('saved peers retain event sharing after withdrawing network sharing', async () => {
  const calls = [];
  const { api, login } = await harness({
    async assess(current, participant, context) {
      calls.push({ current, participant, context });
      return readyAssessment();
    },
  });
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/profile', {
    method: 'PATCH', sessionId: maya.session.id,
    body: {
      bio: 'Event-visible Maya bio', email: 'maya-private@example.com',
      visibility: { activeInEvent: true, previousConnections: false, bio: true, email: true },
    },
  });
  await api('/api/connections', {
    sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' },
  });
  const bootstrap = await api('/api/bootstrap', { sessionId: alex.session.id });
  const projected = bootstrap.value.profiles.find((profile) => profile.id === 'maya');
  assert.equal(projected.bio, 'Event-visible Maya bio');
  assert.equal(projected.email, '');
  const network = await api('/api/compatibility', {
    sessionId: alex.session.id, body: { participantId: 'maya', audience: 'network' },
  });
  assert.equal(network.status, 403);
  const event = await api('/api/compatibility', {
    sessionId: alex.session.id,
    body: { participantId: 'maya', eventId: 'demo', audience: 'event' },
  });
  assert.equal(event.status, 200);
  assert.equal(calls.at(-1).participant.bio, 'Event-visible Maya bio');
  assert.equal(calls.at(-1).participant.email, '');
});

test('canonical shared profiles do not merge private connection notes between sessions', async () => {
  const { api, login } = await harness({ assess: async () => readyAssessment() });
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/connections', {
    sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' },
  });
  await api('/api/connections/maya', {
    method: 'PATCH', sessionId: alex.session.id,
    body: { notes: 'Alex private follow-up', followUp: 'contacted' },
  });
  const mayaState = await api('/api/bootstrap', { sessionId: maya.session.id });
  assert.ok(!JSON.stringify(mayaState.value).includes('Alex private follow-up'));
  const alexState = await api('/api/bootstrap', { sessionId: alex.session.id });
  assert.equal(
    alexState.value.connections.find((connection) => connection.participantId === 'maya').notes,
    'Alex private follow-up',
  );
});
