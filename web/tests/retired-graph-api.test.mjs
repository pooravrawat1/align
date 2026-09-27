import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from '../server/index.mjs';

test('removed graph endpoint no longer exposes profile or connection topology', async () => {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${origin}/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profileId: 'alex' }),
    }).then(response => response.json());
    for (const { headers, status } of [
      { headers: {}, status: 401 },
      { headers: { 'x-session-id': login.session.id }, status: 404 },
    ]) {
      const response = await fetch(`${origin}/api/graph?hubs=&eventId=demo`, { headers });
      assert.equal(response.status, status);
      const result = await response.json();
      assert.equal(result.nodes, undefined);
      assert.equal(result.links, undefined);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
