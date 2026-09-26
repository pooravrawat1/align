import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../shared/demo-data.json' with { type: 'json' };
import { networkPerson, ownedConnection } from '../src/networkModel.ts';

function fixture() {
  const state = structuredClone({ ...seed, demo: true, session: null, matches: [] });
  return { state, user: state.profiles[0], find: id => state.profiles.find(profile => profile.id === id) };
}

test('authored compatibility has six supported categories and a consistent symmetric total', () => {
  const { state, user, find } = fixture();
  const maya = networkPerson(state, user, find('maya'));
  assert.deepEqual(maya.compatibility.categories.map(category => category.max), [30, 25, 15, 15, 10, 5]);
  assert.equal(maya.compatibility.score, 92);
  assert.equal(maya.compatibility.categories.reduce((sum, category) => sum + category.points, 0), 92);
  assert.equal(networkPerson(state, find('maya'), user).compatibility.score, 92);
  assert.deepEqual(maya.theyOffer, ['Computer vision']);
  assert.deepEqual(maya.youOffer, ['Embedded systems']);
  assert.equal(maya.sample, true);
});

test('edited profile facts invalidate authored scores and supplemental project claims', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.bio = 'Working on something entirely different.';
  const person = networkPerson(state, user, leo);
  assert.equal(person.compatibility.status, 'partial');
  assert.equal(person.compatibility.score, null);
  assert.equal(person.project, undefined);
  assert.deepEqual(person.goals, []);
  assert.ok(person.compatibility.categories.every(category => category.points === null));
});

test('hidden fields cannot become shared evidence, matching reasons, project topics, or sample scores', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.visibility = { interests: false, skills: false, lookingFor: false, bio: false };
  const person = networkPerson(state, user, leo);
  assert.deepEqual(person.sharedInterests, []);
  assert.deepEqual(person.theyOffer, []);
  assert.deepEqual(person.youOffer, []);
  assert.equal(person.project, undefined);
  assert.equal(person.compatibility.score, null);
  assert.doesNotMatch(JSON.stringify(person.compatibility), /computer vision|robots|electronics|assistive technology/i);
  user.visibility = { interests: false, lookingFor: false, skills: false, bio: false };
  const maya = networkPerson(state, user, find('maya'));
  assert.deepEqual(maya.sharedInterests, []);
  assert.deepEqual(maya.theyOffer, []);
  assert.deepEqual(maya.youOffer, []);
  assert.equal(maya.compatibility.score, null);
});

test('withdrawn saved profiles keep owned notes but no shared details or contact destinations', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.linkedin = 'https://www.linkedin.com/in/test-person';
  leo.visibility = { previousConnections: false, linkedin: true };
  const connection = ownedConnection(state, user.id, leo.id);
  connection.notes = 'My private note';
  const person = networkPerson(state, user, leo);
  assert.equal(person.withdrawn, true);
  assert.equal(person.connection.notes, 'My private note');
  assert.equal(person.profile.bio, '');
  assert.deepEqual(person.contacts, []);
  assert.deepEqual(person.sharedInterests, []);
  assert.equal(person.compatibility.status, 'unavailable');
});

test('discovery does not use saved-connection contact consent, while saved GitHub requires explicit sharing and its real domain', () => {
  const { state, user, find } = fixture();
  const maya = find('maya');
  maya.linkedin = 'https://www.linkedin.com/in/test-person';
  maya.visibility = { linkedin: true };
  assert.deepEqual(networkPerson(state, user, maya).contacts, []);
  const leo = find('leo');
  leo.github = 'https://github.com/test-person';
  assert.deepEqual(networkPerson(state, user, leo).contacts, []);
  leo.visibility = { github: true };
  assert.equal(networkPerson(state, user, leo).contacts[0].kind, 'github');
  leo.github = 'https://github.com.example.com/test-person';
  assert.deepEqual(networkPerson(state, user, leo).contacts, []);
});

test('a different owner connection is not presented as the current user having saved someone', () => {
  const { state, find } = fixture();
  assert.equal(ownedConnection(state, 'jordan', 'alex'), undefined);
  assert.equal(networkPerson(state, find('jordan'), find('alex')).connection, undefined);
});
