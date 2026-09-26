import type { Connection, Profile, State } from './types';

export type RecapPerson = {
  connection: Connection;
  profile: Profile;
  withdrawn: boolean;
  sharedInterests: string[];
  needsFollowUp: boolean;
  reminder: 'overdue' | 'upcoming' | 'none';
};

export type EventRecapData = {
  people: RecapPerson[];
  followUps: RecapPerson[];
  commonGround: string[];
  peopleCount: number;
  followUpCount: number;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('en-US');

function participantId(connection: Connection, userId: string) {
  const ownerId = connection.ownerId ?? connection.userA;
  if (ownerId !== userId) return null;
  return connection.participantId ?? (connection.userA === userId ? connection.userB : connection.userA);
}

function intersection(left: string[], right: string[]) {
  const other = new Set(right.map(normalize));
  const seen = new Set<string>();
  return left.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key) || !other.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function eventRecap(state: State, user: Profile, eventId: string, now = new Date()): EventRecapData {
  const userInterests = user.visibility?.interests === false ? [] : user.interests;
  const people = state.connections.flatMap((connection): RecapPerson[] => {
    if (connection.eventId !== eventId) return [];
    const id = participantId(connection, user.id);
    if (!id) return [];
    const profile = state.profiles.find((candidate) => candidate.id === id);
    if (!profile) return [];
    const withdrawn = profile.visibility?.previousConnections === false;
    const sharedInterests = withdrawn || profile.visibility?.interests === false
      ? []
      : intersection(userInterests, profile.interests);
    const needsFollowUp = (connection.followUp ?? 'needed') === 'needed';
    const reminderDate = localDate(connection.reminderDate ?? '');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminder = reminderDate === null ? 'none' : reminderDate < today ? 'overdue' : 'upcoming';
    return [{ connection, profile, withdrawn, sharedInterests, needsFollowUp, reminder }];
  }).sort((left, right) => Date.parse(right.connection.createdAt) - Date.parse(left.connection.createdAt) || left.profile.name.localeCompare(right.profile.name));

  const followUps = people.filter((person) => person.needsFollowUp).sort((left, right) => {
    const rank = (person: RecapPerson) => person.reminder === 'overdue' ? 0 : person.reminder === 'upcoming' ? 1 : 2;
    return rank(left) - rank(right)
      || (left.connection.reminderDate ?? '').localeCompare(right.connection.reminderDate ?? '')
      || Date.parse(right.connection.createdAt) - Date.parse(left.connection.createdAt)
      || left.profile.name.localeCompare(right.profile.name);
  });
  const commonGround = [...new Map(people.flatMap((person) => person.sharedInterests).map((value) => [normalize(value), value])).values()]
    .sort((left, right) => left.localeCompare(right, 'en-US', { sensitivity: 'base' }));
  return { people, followUps, commonGround, peopleCount: people.length, followUpCount: followUps.length };
}
