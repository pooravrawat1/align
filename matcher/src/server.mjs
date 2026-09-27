import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { InputError } from './profiles.mjs';
import { createRoomRelay } from './rooms.mjs';
import { createMatcher, demoFixtures } from './service.mjs';

const MAX_BODY_BYTES = 16 * 1024;

function sendJson(response, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(body);
}

async function readJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new InputError('Content-Type must be application/json', 415);
  }
  let bytes = 0;
  let tooLarge = false;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) tooLarge = true;
    if (!tooLarge) chunks.push(chunk);
  }
  if (tooLarge) throw new InputError('request body exceeds 16 KB', 413);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InputError('request body must be valid JSON');
  }
}

export function createMatchServer(matcher, roomRelay = createRoomRelay({ matcher, fixtures: demoFixtures })) {
  return createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health') {
        sendJson(response, 200, matcher.health());
        return;
      }
      if (request.method === 'POST' && path === '/match') {
        const body = await readJson(request);
        const { result, source } = await matcher.match(body);
        sendJson(response, 200, result, { 'x-align-match-source': source });
        return;
      }
      if (request.method === 'POST' && path === '/room/update') {
        const body = await readJson(request);
        const state = await roomRelay.update(body);
        sendJson(response, 200, state);
        return;
      }
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const status = error instanceof InputError ? error.status : 500;
      sendJson(response, status, {
        error: status === 500 ? 'Internal matcher error' : error.message,
      });
    }
  });
}

function start() {
  const port = Number(process.env.MATCH_PORT ?? 4323);
  const host = process.env.MATCH_HOST ?? '0.0.0.0';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MATCH_PORT must be a valid TCP port');
  }
  const matcher = createMatcher({
    mode: process.env.MATCH_MODE ?? 'auto',
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
    logger: ({ source, pair, score }) => {
      console.log(`[match] pair=${pair} source=${source} score=${score}`);
    },
  });
  const server = createMatchServer(matcher);
  server.listen(port, host, () => {
    console.log(`[matcher] listening on ${host}:${port} mode=${matcher.health().mode}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
