import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../shared/demo-data.json' with { type: 'json' };
import { graphPeople } from '../src/networkGraphModel.ts';

function fixture() {
  const state = structuredClone({ ...seed, session: { userId: 'alex', activeEventId: 'demo' }, matches: [] });
  return { state, user: state.profiles.find(p => p.id === 'alex') };
}
test('saved profiles are not represented as accepted relationships', () => {
  const { state, user } = fixture();
  assert.equal(graphPeople(state, user).find(p => p.profile.id === 'leo').kind, 'saved');
  state.connectionRequests = [{ senderId: 'alex', recipientId: 'leo', status: 'accepted', updatedAt: new Date().toISOString() }];
  assert.equal(graphPeople(state, user).find(p => p.profile.id === 'leo').kind, 'connected');
});
test('event suggestions use shared fields, not hidden skills or interests', () => {
  const { state, user } = fixture();
  const maya = state.profiles.find(p => p.id === 'maya');
  maya.visibility = { activeInEvent: true, interests: false, skills: false, lookingFor: false };
  const person = graphPeople(state, user).find(p => p.profile.id === 'maya');
  assert.deepEqual(person.sharedInterests, []);
  assert.deepEqual(person.theyOffer, []);
  assert.deepEqual(person.youOffer, []);
});
test('excludes self and profiles without event or saved access', () => {
  const { state, user } = fixture();
  const maya = state.profiles.find(p => p.id === 'maya');
  maya.visibility = { activeInEvent: false, previousConnections: false };
  assert.ok(!graphPeople(state, user).some(p => ['alex', 'maya'].includes(p.profile.id)));
  state.session.activeEventId = 'missing';
  assert.ok(graphPeople(state, user).every(p => p.audience === 'network'));
});
test('an event roster must include the viewer before showing event profiles', () => {
  const { state, user } = fixture();
  state.events.find(event => event.id === 'demo').participantIds = ['maya'];
  assert.ok(!graphPeople(state, user).some(p => p.profile.id === 'maya'));
});
test('the demo graph uses the full prepared event when no event is active', () => {
  const { state, user } = fixture();
  state.session.activeEventId = null;
  state.session.code = null;
  state.demo = true;
  assert.equal(graphPeople(state, user).length, 29);
});
