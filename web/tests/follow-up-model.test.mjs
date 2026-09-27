import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFollowUpDrafts, draftStorageKey, readDraft, preparedFollowUp, followUpContext } from '../src/followUpModel.ts';
const person = { id: 'maya', profile: { name: 'Maya Chen' }, relationship: 'met', sharedInterests: ['Robotics'], notes: '', withdrawn: false };
test('prepared starters remember a real meeting without inventing its details', () => {
  assert.match(preparedFollowUp(person, 'Builders'), /great meeting you at Builders/);
  assert.doesNotMatch(preparedFollowUp(person, 'Builders'), /discussed|promised|agreed/);
});
test('draft keys separate owners, events and people; context includes notes and visibility', () => {
  const base = draftStorageKey('owner', 'event', 'maya');
  assert.notEqual(base, draftStorageKey('other', 'event', 'maya'));
  assert.notEqual(base, draftStorageKey('owner', 'other', 'maya'));
  assert.notEqual(base, draftStorageKey('owner', 'event', 'leo'));
  const context = followUpContext(person, 'Builders', 'Alex');
  assert.notEqual(context, followUpContext({ ...person, notes: 'New note' }, 'Builders', 'Alex'));
  assert.notEqual(context, followUpContext({ ...person, withdrawn: true }, 'Builders', 'Alex'));
});
test('prepared demo draft keys separate fixture versions and personas', () => {
  const alex = draftStorageKey('completed-demo:v2:alex', 'demo', 'leo');
  assert.notEqual(alex, draftStorageKey('completed-demo:v2:maya', 'demo', 'leo'));
  assert.notEqual(alex, draftStorageKey('completed-demo:v3:alex', 'demo', 'leo'));
});
test('corrupt or unavailable browser storage never prevents opening a report', () => {
  assert.equal(readDraft({ getItem: () => '{broken' }, 'x'), null);
  assert.equal(readDraft({ getItem: () => { throw new Error('blocked'); } }, 'x'), null);
  assert.equal(readDraft({ getItem: () => JSON.stringify({ message: 'hello', context: 'x', source: 'gemini' }) }, 'x').message, 'hello');
});

test('cleanup respects session, event and person boundaries and leaves the public demo alone', () => {
  const keys = [draftStorageKey('session:alex', 'demo', 'leo'), draftStorageKey('session:alex', 'spatial', 'leo'), draftStorageKey('other:alex', 'demo', 'leo'), draftStorageKey('completed-demo', 'demo', 'leo')];
  const entries = new Map(keys.map(key => [key, 'private draft']));
  const storage = { get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null, removeItem: key => entries.delete(key) };
  clearFollowUpDrafts('session', 'demo', undefined, storage);
  assert.equal(entries.has(keys[0]), false);
  assert.equal(entries.has(keys[1]), true);
  clearFollowUpDrafts('session', undefined, undefined, storage);
  assert.deepEqual([...entries.keys()], keys.slice(2));
});
