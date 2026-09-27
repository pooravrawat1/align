import { createServer } from '../../server/index.mjs';
export const origin = process.env.ALIGN_TEST_ORIGIN || 'http://127.0.0.1:4320';
export async function workspace(page, options = {}) {
  const server = createServer({ env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = 'http://127.0.0.1:' + server.address().port;
  const api = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(apiOrigin + '/api/' + path, { method, headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return response.json();
  };
  let sessionId;
  const login = await api('login', { profileId: options.profileId ?? 'alex' });
  sessionId = login.session.id;
  if (options.join !== false) await api('room', { code: options.code ?? 'DEMO' });
  await page.addInitScript(id => sessionStorage.setItem('questmatch-session', id), sessionId);
  await page.route('**/api/**', async route => {
    const response = await route.fetch({ url: apiOrigin + new URL(route.request().url()).pathname });
    await route.fulfill({ response });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return { api, close: async () => { await page.unrouteAll({ behavior: 'wait' }); await new Promise(resolve => server.close(resolve)); } };
}
