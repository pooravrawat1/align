import { createHash } from 'node:crypto';
import { InputError } from './profiles.mjs';

// Sarah: a female voice. Override with a voice available in your ElevenLabs account.
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_MS = 30 * 60 * 1000;

export function matchNarrationText(match) {
  if (match?.compatible !== true) throw new InputError('A compatible match is required for narration', 403);
  const reason = typeof match.reason === 'string' ? match.reason.trim() : '';
  if (!reason) throw new InputError('This match has no shared introduction to read', 404);
  if (reason.length > 1000) throw new InputError('The match introduction exceeds the narration limit');
  return reason;
}

export function sendNarration(response, audio) {
  response.writeHead(200, {
    'content-type': 'audio/mpeg',
    'content-length': audio.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(audio);
}

export function createMatchNarrator({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const apiKey = env.ELEVENLABS_API_KEY?.trim() || '';
  const voiceId = env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_flash_v2_5';
  const timeoutMs = Math.max(1, Math.min(30000, Number(env.ELEVENLABS_TIMEOUT_MS) || 15000));
  const cache = new Map();
  const inFlight = new Map();
  let failure = null;

  async function generate(text) {
    const controller = new AbortController();
    let timer;
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new InputError('Match narration timed out. Try again shortly.', 504));
        }, timeoutMs);
      });
      const request = (async () => {
        const response = await fetchImpl(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
            body: JSON.stringify({ text, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
            signal: controller.signal,
          },
        );
        // Never forward provider error bodies, which may contain credentials or profile text.
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
          await response.body?.cancel();
          throw new InputError('Match narration is unavailable. Check the server voice configuration and quota.', 502);
        }
        const reader = response.body.getReader();
        const chunks = [];
        let bytes = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_AUDIO_BYTES) {
            await reader.cancel();
            throw new InputError('Match narration returned too much audio', 502);
          }
          chunks.push(Buffer.from(value));
        }
        if (!bytes) throw new InputError('Match narration returned empty audio', 502);
        return Buffer.concat(chunks);
      })();
      return await Promise.race([request, deadline]);
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError('Match narration is temporarily unavailable', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    health: () => ({ enabled: Boolean(apiKey), voiceId, modelId, content: 'match-reason' }),
    async narrate(match) {
      const text = matchNarrationText(match);
      if (!apiKey) throw new InputError('Match narration is not configured on the server', 503);
      const key = createHash('sha256').update(JSON.stringify([voiceId, modelId, text])).digest('hex');
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now()) return cached.audio;
      cache.delete(key);
      if (inFlight.has(key)) return inFlight.get(key);
      if (failure?.expiresAt > now()) throw failure.error;
      if (inFlight.size >= 4) throw new InputError('Match narration is busy. Try again shortly.', 429);
      const pending = generate(text).then(audio => {
        if (cache.size >= 32) cache.delete(cache.keys().next().value);
        cache.set(key, { audio, expiresAt: now() + CACHE_TTL_MS });
        return audio;
      }).catch(error => {
        failure = { error, expiresAt: now() + 30000 };
        throw error;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
      return pending;
    },
  };
}
