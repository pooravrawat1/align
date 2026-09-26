import type { FollowUpResult } from './followUpModel';

export async function requestFollowUp(path: string, body: unknown, signal: AbortSignal, sessionId?: string): Promise<FollowUpResult> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gemini is unavailable. Your draft is kept; try again shortly.');
  if (result.source !== 'gemini' || typeof result.message !== 'string' || typeof result.summary !== 'string' || typeof result.nextStep !== 'string' || !Array.isArray(result.evidence)) {
    throw new Error('The generated message could not be read. Your draft is kept; try again.');
  }
  return result;
}
