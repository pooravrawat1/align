import type { FollowUpResult } from './followUpModel';

export async function requestFollowUp(path: string, body: unknown, signal: AbortSignal, sessionId?: string, onSessionExpired?: () => void): Promise<FollowUpResult> {
  let response: Response;
  try { response = await fetch(`/api/${path}`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', ...(sessionId ? { 'x-session-id': sessionId } : {}) },
    body: JSON.stringify(body),
  }); } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Could not reach Gemini. Your draft is kept; check your connection and try again.');
  }
  if (response.status === 401) {
    onSessionExpired?.();
    throw new Error('Your session expired. Enter the app again to continue.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Gemini is temporarily unavailable. Your draft is kept; try again shortly.'); }
  if (!response.ok) throw new Error(response.status === 409 ? 'Your connection details changed. Save your current note and try again.' : 'Gemini is unavailable right now. Your draft is kept; try again shortly.');
  if (result.source !== 'gemini' || typeof result.message !== 'string' || typeof result.summary !== 'string' || typeof result.nextStep !== 'string' || !Array.isArray(result.evidence)) {
    throw new Error('The generated message could not be read. Your draft is kept; try again.');
  }
  return result;
}
