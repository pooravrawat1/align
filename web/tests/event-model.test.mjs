import test from 'node:test';
import assert from 'node:assert/strict';
import { activeEvent, homeEvent, eventPhase } from '../src/eventModel.ts';
const event = { id: 'one', code: 'ONE', startsAt: '2026-09-26T14:00:00Z', endsAt: '2026-09-26T22:00:00Z' };
test('event lifecycle follows timestamps including exact boundaries', () => {
  assert.equal(eventPhase(event, Date.parse('2026-09-26T13:59:59Z')), 'upcoming');
  assert.equal(eventPhase(event, Date.parse(event.startsAt)), 'live');
  assert.equal(eventPhase(event, Date.parse(event.endsAt)), 'ended');
});
test('an unjoined user has no invented active event; browsing cannot change a joined event', () => {
  assert.equal(activeEvent({ events: [event], session: null }), undefined);
  assert.equal(activeEvent({ events: [event], session: { code: 'one' } }), event);
  assert.equal(activeEvent({ events: [event], session: { code: 'unknown' } }), undefined);
});

test('demo Home features the prepared event without inventing room presence or overriding a selection', () => {
  const demo = { id: 'demo', code: 'DEMO' };
  const state = { events: [demo, event], session: { code: null }, demo: true };
  assert.equal(homeEvent(state), demo);
  assert.equal(activeEvent(state), undefined);
  assert.equal(state.session.code, null);
  assert.equal(homeEvent({ ...state, session: { activeEventId: 'one' } }), event);
  assert.equal(homeEvent({ ...state, demo: false }), undefined);
  assert.equal(homeEvent({ ...state, events: [] }), undefined);
});
