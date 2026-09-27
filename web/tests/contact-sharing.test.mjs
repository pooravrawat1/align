import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/index.mjs';

test('contact sharing requires a connection and access, ignoring legacy individual flags', async () => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = async (path, sessionId, body, method = body ? 'POST' : 'GET') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method, headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const alex = await api('login', null, { profileId: 'alex' });
    const maya = await api('login', null, { profileId: 'maya' });
    const contacts = { linkedin: 'https://www.linkedin.com/in/maya-contact', website: 'https://example.com/maya-contact', email: 'maya-contact@example.com', contact: 'Ask for Maya at the welcome desk' };
    await api('profile', maya.session.id, { ...contacts, visibility: { previousConnections: true, linkedin: false, website: false, email: false, contact: false } }, 'PATCH');
    const publicProfiles = (await api('bootstrap')).profiles;
    const publicMaya = publicProfiles.find(p => p.id === 'maya');
    for (const [field, value] of Object.entries(contacts)) assert.notEqual(publicMaya[field], value, `public demo does not expose edited ${field}`);
    const projected = async () => (await api('bootstrap', alex.session.id)).profiles.find(p => p.id === 'maya');
    for (const field of Object.keys(contacts)) assert.equal((await projected())[field], '', `unconnected ${field}`);
    await api('connections', alex.session.id, { participantId: 'maya', eventId: 'demo' });
    const shared = await projected();
    for (const [field, value] of Object.entries(contacts)) assert.equal(shared[field], value, `connected ${field}`);
    await api('profile', maya.session.id, { visibility: { previousConnections: false } }, 'PATCH');
    const hidden = await projected();
    for (const field of Object.keys(contacts)) assert.equal(hidden[field], '', `access off ${field}`);
    const own = (await api('bootstrap', maya.session.id)).profiles.find(p => p.id === 'maya');
    for (const [field, value] of Object.entries(contacts)) assert.equal(own[field], value, `owner retains ${field}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
