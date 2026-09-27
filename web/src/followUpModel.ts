import type { Profile } from './types';

export type FollowUpPerson = {
  id: string;
  profile: Profile;
  relationship: 'met';
  sharedInterests: string[];
  notes: string;
  contacted: boolean;
  needsFollowUp?: boolean;
  savedPrivately?: boolean;
  withdrawn: boolean;
  contacts: { kind: string; label: string; href: string }[];
  example?: { notes: string; message: string; nextStep: string; reason?: string; durationMinutes?: number | null };
};
export type FollowUpResult = { source: 'gemini'; summary: string; nextStep: string; message: string; evidence: string[] };
export type FollowUpDraft = { message: string; context: string; evidenceContext?: string; source: 'prepared' | 'gemini' | 'edited'; summary?: string; nextStep?: string };

export function followUpEvidenceContext(person: FollowUpPerson, eventName: string, senderName: string) {
  return JSON.stringify([eventName, senderName, person.profile.name, person.relationship, person.sharedInterests, person.withdrawn]);
}

export function followUpContext(person: FollowUpPerson, eventName: string, senderName: string) {
  return JSON.stringify([eventName, senderName, person.profile.name, person.relationship, person.sharedInterests, person.notes, person.withdrawn]);
}

export function preparedFollowUp(person: FollowUpPerson, eventName: string) {
  if (person.example && person.example.notes === person.notes) return person.example.message;
  const firstName = person.profile.name.trim().split(/\s+/u)[0];
  const greeting = `Hi ${firstName}, it was great meeting you at ${eventName}!`;
  const common = person.sharedInterests.length ? ` We share an interest in ${person.sharedInterests.slice(0, 2).join(' and ')}.` : '';
  return `${greeting}${common} I'd love to hear more about what you're working on and explore a way to collaborate.`;
}

export function draftStorageKey(owner: string, eventId: string, personId: string) {
  return `catalyst-follow-up:v1:${encodeURIComponent(owner)}:${encodeURIComponent(eventId)}:${encodeURIComponent(personId)}`;
}

export function clearFollowUpDrafts(sessionId: string | null, eventId?: string, personId?: string, storage?: Storage) {
  if (!sessionId) return;
  try {
    const target = storage ?? localStorage;
    const prefix = `catalyst-follow-up:v1:${encodeURIComponent(`${sessionId}:`)}`;
    for (let index = target.length - 1; index >= 0; index -= 1) {
      const key = target.key(index);
      if (!key?.startsWith(prefix)) continue;
      const fields = key.split(':');
      if (eventId !== undefined && fields[3] !== encodeURIComponent(eventId)) continue;
      if (personId !== undefined && fields[4] !== encodeURIComponent(personId)) continue;
      target.removeItem(key);
    }
  } catch { /* Inaccessible storage cannot be read by the report either. */ }
}

export function readDraft(storage: Pick<Storage, 'getItem'>, key: string): FollowUpDraft | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null');
    if (!value || typeof value.message !== 'string' || value.message.length > 3000 || typeof value.context !== 'string'
      || !['prepared', 'gemini', 'edited'].includes(value.source)) return null;
    return { message: value.message, context: value.context, source: value.source,
      evidenceContext: typeof value.evidenceContext === 'string' ? value.evidenceContext : undefined,
      summary: typeof value.summary === 'string' ? value.summary.slice(0, 400) : undefined,
      nextStep: typeof value.nextStep === 'string' ? value.nextStep.slice(0, 300) : undefined };
  } catch { return null; }
}
