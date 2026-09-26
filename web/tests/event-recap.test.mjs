import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { eventRecap } from '../src/eventRecapModel.ts';

const seed = JSON.parse(await readFile(new URL('../shared/demo-data.json', import.meta.url), 'utf8'));
const profile = (id) => seed.profiles.find((person) => person.id === id);
const state = (connections) => ({ ...structuredClone(seed), connections });

test('recap includes only current owner saves from the selected event', () => {
  const data = eventRecap(state([
    { ownerId: 'alex', participantId: 'maya', userA: 'alex', userB: 'maya', eventId: 'demo', createdAt: '2026-09-26T11:00:00Z', followUp: 'needed' },
    { ownerId: 'maya', participantId: 'alex', userA: 'alex', userB: 'maya', eventId: 'demo', createdAt: '2026-09-26T12:00:00Z', followUp: 'needed' },
    { ownerId: 'alex', participantId: 'jordan', userA: 'alex', userB: 'jordan', eventId: 'spatial', createdAt: '2026-09-26T13:00:00Z', followUp: 'needed' },
  ]), profile('alex'), 'demo');
  assert.deepEqual(data.people.map((person) => person.profile.id), ['maya']);
  assert.equal(data.peopleCount, 1);
  assert.equal(data.followUpCount, 1);
});

test('common ground uses only currently visible interests and ignores historical reasons', () => {
  const next = state([{ ownerId: 'alex', participantId: 'maya', userA: 'alex', userB: 'maya', eventId: 'demo', createdAt: '2026-09-26T11:00:00Z', reason: 'Historical secret overlap', sharedInterests: ['Hidden history'] }]);
  next.profiles.find((person) => person.id === 'maya').visibility = { previousConnections: true, interests: false };
  const data = eventRecap(next, profile('alex'), 'demo');
  assert.deepEqual(data.commonGround, []);
  assert.deepEqual(data.people[0].sharedInterests, []);
});

test('withdrawn profiles expose no shared facts while preserving the owner note', () => {
  const next = state([{ ownerId: 'alex', participantId: 'maya', userA: 'alex', userB: 'maya', eventId: 'demo', createdAt: '2026-09-26T11:00:00Z', notes: 'Send my prototype notes.' }]);
  next.profiles.find((person) => person.id === 'maya').visibility = { previousConnections: false, interests: true };
  const data = eventRecap(next, profile('alex'), 'demo');
  assert.equal(data.people[0].withdrawn, true);
  assert.deepEqual(data.people[0].sharedInterests, []);
  assert.equal(data.people[0].connection.notes, 'Send my prototype notes.');
});

test('follow-ups order overdue reminders, upcoming reminders, then undated needs stably', () => {
  const data = eventRecap(state([
    { ownerId: 'alex', participantId: 'jordan', userA: 'alex', userB: 'jordan', eventId: 'demo', createdAt: '2026-09-25T10:00:00Z', followUp: 'needed' },
    { ownerId: 'alex', participantId: 'maya', userA: 'alex', userB: 'maya', eventId: 'demo', createdAt: '2026-09-24T10:00:00Z', followUp: 'needed', reminderDate: '2026-09-20' },
    { ownerId: 'alex', participantId: 'leo', userA: 'alex', userB: 'leo', eventId: 'demo', createdAt: '2026-09-26T10:00:00Z', followUp: 'needed', reminderDate: '2026-09-30' },
    { ownerId: 'alex', participantId: 'nina', userA: 'alex', userB: 'nina', eventId: 'demo', createdAt: '2026-09-27T10:00:00Z', followUp: 'contacted', reminderDate: '2026-09-18' },
  ]), profile('alex'), 'demo', new Date(2026, 8, 26, 12));
  assert.deepEqual(data.followUps.map((person) => person.profile.id), ['maya', 'leo', 'jordan']);
  assert.equal(data.followUpCount, 3);
});

test('recap invents no people or common ground for an empty event', () => {
  const data = eventRecap(state([]), profile('alex'), 'demo');
  assert.deepEqual(data, { people: [], followUps: [], commonGround: [], peopleCount: 0, followUpCount: 0 });
});
