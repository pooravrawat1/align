import type { Profile } from './types';

export type FollowUpPerson = {
  id: string;
  profile: Profile;
  relationship: 'connected' | 'saved';
  sharedInterests: string[];
  notes: string;
  contacted: boolean;
  withdrawn: boolean;
  contacts: { kind: string; label: string; href: string }[];
};
export type FollowUpResult = { source: 'gemini'; summary: string; nextStep: string; message: string; evidence: string[] };
export type FollowUpDraft = { message: string; context: string; source: 'prepared' | 'gemini' | 'edited'; summary?: string; nextStep?: string };

export function followUpContext(person: FollowUpPerson, eventName: string, senderName: string) {
  return JSON.stringify([eventName, senderName, person.profile.name, person.relationship, person.sharedInterests, person.notes, person.withdrawn]);
}

export function preparedFollowUp(person: FollowUpPerson, eventName: string) {
  const firstName = person.profile.name.trim().split(/\s+/u)[0];
  const greeting = person.relationship === 'connected'
    ? `Hi ${firstName}, glad we connected through ${eventName}!`
    : `Hi ${firstName}, I came across your profile at ${eventName}.`;
  const common = person.sharedInterests.length ? ` We share an interest in ${person.sharedInterests.slice(0, 2).join(' and ')}.` : '';
  return `${greeting}${common} I'd love to hear more about what you're working on and explore a way to collaborate.`;
}

export function draftStorageKey(owner: string, eventId: string, personId: string) {
  return `catalyst-follow-up:v1:${encodeURIComponent(owner)}:${encodeURIComponent(eventId)}:${encodeURIComponent(personId)}`;
}

export function readDraft(storage: Pick<Storage, 'getItem'>, key: string): FollowUpDraft | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null');
    if (!value || typeof value.message !== 'string' || value.message.length > 3000 || typeof value.context !== 'string'
      || !['prepared', 'gemini', 'edited'].includes(value.source)) return null;
    return { message: value.message, context: value.context, source: value.source,
      summary: typeof value.summary === 'string' ? value.summary.slice(0, 400) : undefined,
      nextStep: typeof value.nextStep === 'string' ? value.nextStep.slice(0, 300) : undefined };
  } catch { return null; }
}
