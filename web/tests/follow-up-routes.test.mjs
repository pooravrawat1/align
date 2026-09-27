import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from '../server/index.mjs';

async function harness(t, generate) {
  const server = createServer({ env: {}, followUpService: { generate } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const api = async (path, body, sessionId, method = 'POST') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method, headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  return api;
}
const result = { source: 'gemini', summary: 'You share Open source.', nextStep: 'Ask about a project.', message: 'Hello, what are you building?', evidence: ['Open source'] };

test('public completed demo projects fixed identities and rejects arbitrary profiles and prompt fields', async t => {
  const inputs = [];
  const api = await harness(t, async input => { inputs.push(input); return result; });
  const response = await api('follow-up-demo', { participantId: 'maya', notes: 'Discussed my prototype.', style: 'standard' });
  assert.equal(response.status, 200);
  assert.equal(inputs[0].senderName, 'Alex Morgan');
  assert.equal(inputs[0].recipientName, 'Maya Chen');
  assert.deepEqual(inputs[0].sharedInterests, ['Assistive technology', 'Robotics']);
  assert.equal((await api('follow-up-demo', { participantId: 'nobody', notes: '', style: 'standard' })).status, 404);
  assert.equal((await api('follow-up-demo', { participantId: 'maya', notes: '', style: 'standard', recipientName: 'Injected' })).status, 400);
  assert.equal((await api('follow-up-demo', { participantId: 'priya', notes: '', style: 'short' })).status, 200);
  assert.equal(inputs[1].relationship, 'saved');
});

test('public completed demo isolates prepared personas and rejects cross-persona people', async t => {
  const inputs = [];
  const api = await harness(t, async input => { inputs.push(input); return result; });
  const maya = await api('follow-up-demo', { ownerId: 'maya', participantId: 'alex', notes: 'Discussed testing my detection model.', style: 'standard' });
  assert.equal(maya.status, 200);
  assert.equal(inputs[0].senderName, 'Maya Chen');
  assert.equal(inputs[0].recipientName, 'Alex Morgan');
  assert.equal((await api('follow-up-demo', { ownerId: 'maya', participantId: 'jordan', notes: '', style: 'standard' })).status, 404);
  assert.equal((await api('follow-up-demo', { ownerId: 'nobody', participantId: 'alex', notes: '', style: 'standard' })).status, 404);
});

test('ordinary generation requires session, owned event connection, and shared fields', async t => {
  const inputs = [];
  const api = await harness(t, async input => { inputs.push(input); return result; });
  const body = { participantId: 'leo', eventId: 'demo', notes: 'My private note.', style: 'standard' };
  assert.equal((await api('follow-up', body)).status, 401);
  const alex = (await api('login', { profileId: 'alex' })).data.session.id;
  assert.equal((await api('follow-up', { ...body, eventId: 'spatial' }, alex)).status, 403);
  assert.equal((await api('follow-up', { ...body, participantId: 'maya' }, alex)).status, 403);
  await api('connections/leo', { notes: body.notes }, alex, 'PATCH');
  assert.equal((await api('follow-up', body, alex)).status, 200);
  assert.equal(inputs[0].notes, body.notes);
  assert.equal(inputs[0].relationship, 'saved');
  const staleNote = await api('follow-up', { ...body, notes: 'An older private note.' }, alex);
  assert.equal(staleNote.status, 409);
  assert.equal(staleNote.data.error, 'Your note changed. Save the current note before generating again.');
  assert.equal(inputs.length, 1);
  const leo = (await api('login', { profileId: 'leo' })).data.session.id;
  assert.equal((await api('follow-up', { ...body, participantId: 'alex' }, leo)).status, 403);
  await api('profile', { visibility: { interests: false } }, leo, 'PATCH');
  assert.equal((await api('follow-up', body, alex)).status, 200);
  assert.deepEqual(inputs[1].sharedInterests, []);
  await api('profile', { visibility: { previousConnections: false } }, leo, 'PATCH');
  assert.equal((await api('follow-up', body, alex)).status, 403);
});

test('profile withdrawal during generation prevents returning stale shared facts', async t => {
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const api = await harness(t, async () => { began(); await new Promise(resolve => { release = resolve; }); return result; });
  const alex = (await api('login', { profileId: 'alex' })).data.session.id;
  const leo = (await api('login', { profileId: 'leo' })).data.session.id;
  const pending = api('follow-up', { participantId: 'leo', eventId: 'demo', notes: '', style: 'standard' }, alex);
  await started;
  await api('profile', { visibility: { previousConnections: false } }, leo, 'PATCH');
  release();
  assert.equal((await pending).status, 403);
});

test('an owner note changed during generation invalidates the response', async t => {
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const api = await harness(t, async () => { began(); await new Promise(resolve => { release = resolve; }); return result; });
  const alex = (await api('login', { profileId: 'alex' })).data.session.id;
  const pending = api('follow-up', { participantId: 'leo', eventId: 'demo', notes: '', style: 'standard' }, alex);
  await started;
  await api('connections/leo', { notes: 'A different next step.' }, alex, 'PATCH');
  release();
  assert.equal((await pending).status, 409);
});
