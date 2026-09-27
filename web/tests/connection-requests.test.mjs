import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createServer } from '../server/index.mjs';
import { readFileSync } from 'node:fs';

const servers = [];
async function harness(options) {
  const server = createServer(options);
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, { sessionId, body, method = body === undefined ? 'GET' : 'POST' } = {}) => {
    const response = await fetch(`${origin}${path}`, { method, headers: { ...(sessionId ? { 'x-session-id': sessionId } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  };
  const login = async (profileId) => (await api('/api/login', { body: { profileId } })).value;
  return { api, login };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))); });

test('seeded demo requests can be accepted or declined without creating private bookmarks', async () => {
  const seed = JSON.parse(readFileSync(new URL('../shared/demo-data.json', import.meta.url), 'utf8'));
  const { api, login } = await harness({ seedConnectionRequests: seed.demoRequests });
  const alex = await login('alex');
  const incoming = alex.connectionRequests.find(request => request.senderId === 'priya');
  assert.equal(incoming.recipientId, 'alex');
  assert.equal(incoming.status, 'pending');
  const accepted = await api(`/api/connection-requests/${incoming.id}`, { method: 'PATCH', sessionId: alex.session.id, body: { action: 'accept' } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.value.connections.find(connection => connection.participantId === 'priya').saved, false);
  const maya = await login('maya');
  const jordan = maya.connectionRequests.find(request => request.senderId === 'jordan');
  const declined = await api(`/api/connection-requests/${jordan.id}`, { method: 'PATCH', sessionId: maya.session.id, body: { action: 'decline' } });
  assert.equal(declined.status, 200);
  assert.equal(declined.value.connections.some(connection => connection.participantId === 'jordan'), false);
  assert.equal((await login('maya')).connectionRequests.find(request => request.id === jordan.id).status, 'declined');
});

test('send, receive, and accept expose one mutual network relation without sharing bookmarks', async () => {
  const { api, login } = await harness();
  const alex = await login('alex');
  const maya = await login('maya');
  const sent = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  assert.equal(sent.status, 200);
  assert.equal(sent.value.connectionRequests.length, 1);
  const request = sent.value.connectionRequests[0];
  assert.deepEqual(request, { id: request.id, senderId: 'alex', recipientId: 'maya', eventId: 'demo', status: 'pending', createdAt: request.createdAt, updatedAt: request.updatedAt });
  assert.equal(sent.value.connections.some((connection) => connection.participantId === 'maya'), false);

  const incoming = await api('/api/bootstrap', { sessionId: maya.session.id });
  assert.equal(incoming.value.connectionRequests[0].id, request.id);
  const accepted = await api(`/api/connection-requests/${request.id}`, { method: 'PATCH', sessionId: maya.session.id, body: { action: 'accept' } });
  assert.equal(accepted.status, 200);
  const mayaRelation = accepted.value.connections.find((connection) => connection.participantId === 'alex');
  assert.equal(mayaRelation.requestId, request.id);
  assert.equal(mayaRelation.saved, false);
  assert.equal(mayaRelation.followUp, 'needed');

  const sender = await api('/api/bootstrap', { sessionId: alex.session.id });
  const alexRelation = sender.value.connections.find((connection) => connection.participantId === 'maya');
  assert.equal(sender.value.connectionRequests[0].status, 'accepted');
  assert.equal(alexRelation.requestId, request.id);
  assert.equal(alexRelation.saved, false);
});

test('request actions enforce roles and duplicate or crossed sends reuse the pending request', async () => {
  const { api, login } = await harness();
  const alex = await login('alex');
  const maya = await login('maya');
  const first = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  const id = first.value.connectionRequests[0].id;
  const duplicate = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  const crossed = await api('/api/connection-requests', { sessionId: maya.session.id, body: { participantId: 'alex', eventId: 'demo' } });
  const anotherEvent = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'spatial' } });
  assert.equal(duplicate.value.connectionRequests[0].id, id);
  assert.equal(crossed.value.connectionRequests[0].id, id);
  assert.equal(crossed.value.connectionRequests.length, 1);
  assert.equal(anotherEvent.value.connectionRequests[0].id, id);
  assert.equal((await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: alex.session.id, body: { action: 'accept' } })).status, 403);
  assert.equal((await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: maya.session.id, body: { action: 'cancel' } })).status, 403);
  const cancelled = await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: alex.session.id, body: { action: 'cancel' } });
  assert.equal(cancelled.value.connectionRequests[0].status, 'cancelled');
  const repeated = await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: alex.session.id, body: { action: 'cancel' } });
  assert.equal(repeated.status, 200);
});

test('peer projection redacts hidden fields and sending requires active roster visibility', async () => {
  const { api, login } = await harness();
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/profile', { method: 'PATCH', sessionId: alex.session.id, body: { bio: 'Private launch details', email: 'private@example.com', visibility: { bio: false, email: false } } });
  await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  const recipient = await api('/api/bootstrap', { sessionId: maya.session.id });
  const projected = recipient.value.profiles.find((profile) => profile.id === 'alex');
  assert.equal(projected.bio, '');
  assert.equal(projected.email, '');
  assert.ok(!JSON.stringify(recipient.value).includes('Private launch details'));
  assert.ok(!JSON.stringify(recipient.value).includes('private@example.com'));

  await api('/api/profile', { method: 'PATCH', sessionId: alex.session.id, body: { visibility: { activeInEvent: false } } });
  const denied = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'sam', eventId: 'demo' } });
  assert.equal(denied.status, 403);
  const outsideRoster = await api('/api/connection-requests', { sessionId: maya.session.id, body: { participantId: 'leo', eventId: 'prototype' } });
  assert.equal(outsideRoster.status, 403);
});

test('accepted synthetic relations support private metadata and bookmark state without leaking it', async () => {
  const { api, login } = await harness();
  const alex = await login('alex');
  const maya = await login('maya');
  const sent = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  const id = sent.value.connectionRequests[0].id;
  await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: maya.session.id, body: { action: 'accept' } });
  const annotated = await api('/api/connections/alex', { method: 'PATCH', sessionId: maya.session.id, body: { notes: 'My private note', followUp: 'contacted', reminderDate: '2026-10-01' } });
  const own = annotated.value.connections.find((connection) => connection.participantId === 'alex');
  assert.equal(own.notes, 'My private note');
  assert.equal(own.saved, false);
  const other = await api('/api/bootstrap', { sessionId: alex.session.id });
  assert.ok(!JSON.stringify(other.value).includes('My private note'));

  const bookmarked = await api('/api/connections', { sessionId: maya.session.id, body: { participantId: 'alex', eventId: 'demo' } });
  assert.equal(bookmarked.value.connections.find((connection) => connection.participantId === 'alex').saved, true);
  const removed = await api('/api/connections/alex', { method: 'DELETE', sessionId: maya.session.id });
  const relation = removed.value.connections.find((connection) => connection.participantId === 'alex');
  assert.equal(relation.requestId, id);
  assert.equal(relation.saved, false);
  assert.equal(relation.notes, 'My private note');
  assert.equal(relation.followUp, 'contacted');
  assert.equal(relation.reminderDate, '2026-10-01');
  const mutual = await api('/api/bootstrap', { sessionId: alex.session.id });
  assert.equal(mutual.value.connections.find((connection) => connection.participantId === 'maya').requestId, id);
  assert.ok(!JSON.stringify(mutual.value).includes('My private note'));
});

test('accepted unbookmarked peers can use network compatibility with the latest redacted profile', async () => {
  const assessed = [];
  const assessmentService = {
    async assess(current, participant) {
      assessed.push({ current, participant });
      return { status: 'partial', score: null, reason: '', commonGround: [], contributions: [], starter: '', categories: [], source: 'unavailable' };
    },
  };
  const { api, login } = await harness({ assessmentService });
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/profile', { method: 'PATCH', sessionId: maya.session.id, body: {
    bio: 'Current public focus',
    email: 'private@example.com',
    visibility: { bio: true, email: false },
  } });
  const sent = await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  const id = sent.value.connectionRequests[0].id;
  await api(`/api/connection-requests/${id}`, { method: 'PATCH', sessionId: maya.session.id, body: { action: 'accept' } });

  const result = await api('/api/compatibility', { sessionId: alex.session.id, body: { participantId: 'maya', audience: 'network' } });
  assert.equal(result.status, 200);
  assert.equal(assessed.length, 1);
  assert.equal(assessed[0].participant.bio, 'Current public focus');
  assert.equal(assessed[0].participant.email, '');
});

test('event clear and reset remove shared request state while logout preserves it', async () => {
  const { api, login } = await harness();
  const alex = await login('alex');
  const maya = await login('maya');
  await api('/api/connection-requests', { sessionId: alex.session.id, body: { participantId: 'maya', eventId: 'demo' } });
  await api('/api/logout', { sessionId: alex.session.id, body: {} });
  assert.equal((await api('/api/bootstrap', { sessionId: maya.session.id })).value.connectionRequests.length, 1);
  const alexAgain = await login('alex');
  await api('/api/room', { sessionId: alexAgain.session.id, body: { code: 'DEMO' } });
  await api('/api/event-data/clear', { sessionId: alexAgain.session.id, body: {} });
  assert.equal((await api('/api/bootstrap', { sessionId: maya.session.id })).value.connectionRequests.length, 0);
  await api('/api/connection-requests', { sessionId: maya.session.id, body: { participantId: 'alex', eventId: 'demo' } });
  await api('/api/reset', { sessionId: maya.session.id, body: {} });
  assert.equal((await api('/api/bootstrap', { sessionId: alexAgain.session.id })).value.connectionRequests.length, 0);
});
