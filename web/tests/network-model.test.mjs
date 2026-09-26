import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../shared/demo-data.json' with { type: 'json' };
import {
  assessmentRouteLabel,
  assessmentRoute,
  assessmentScore,
  assessmentSourceLabel,
  MATCH_THRESHOLD,
  networkPerson,
  ownedConnection,
  recommendationRank,
} from '../src/networkModel.ts';

function fixture() {
  const state = structuredClone({ ...seed, demo: true, session: null, matches: [] });
  return { state, user: state.profiles[0], find: id => state.profiles.find(profile => profile.id === id) };
}

const assessment = {
  status: 'ready', score: 92, reason: 'You can pair embedded systems with Maya’s computer vision work.',
  commonGround: ['Assistive technology'],
  contributions: [{ userId: 'alex', items: ['Embedded systems'] }, { userId: 'maya', items: ['Computer vision'] }],
  starter: 'How could embedded vision make everyday navigation clearer?',
  categories: [{ id: 'skills', label: 'Reciprocal skill fit', max: 30, points: 28, evidence: 'Complementary entered skills.' }],
  source: 'gemini',
  route: 'networking',
  routes: { networking: 92, professional: 0, personal: 0 },
  compatible: true,
};

const professionalAssessment = {
  status: 'ready', score: 100, reason: 'You both attended the same hackathon and have useful skills to exchange.',
  commonGround: ['HackGT 12'],
  contributions: [{ userId: 'alex', items: ['Embedded systems'] }, { userId: 'maya', items: ['Computer vision'] }],
  starter: 'What did each of you build at HackGT 12?',
  categories: [],
  source: 'fixture',
  route: 'professional',
  routes: { networking: null, professional: 100, personal: 0 },
  compatible: true,
};

test('uses a supplied assessment while preserving factual profile intersections', () => {
  const { state, user, find } = fixture();
  const maya = networkPerson(state, user, find('maya'), assessment, 'event');
  assert.equal(maya.compatibility.score, 92);
  assert.equal(maya.reason, assessment.reason);
  assert.deepEqual(maya.theyOffer, ['Computer vision']);
  assert.deepEqual(maya.youOffer, ['Embedded systems']);
  assert.ok(maya.topics.includes('Computer vision'));
});

test('without an assessment exposes factual context but never an authored score or project claim', () => {
  const { state, user, find } = fixture();
  const person = networkPerson(state, user, find('leo'), undefined, 'event');
  assert.equal(person.compatibility.status, 'unavailable');
  assert.equal(person.compatibility.score, null);
  assert.equal('project' in person, false);
  assert.match(person.reason, /computer vision/i);
});

test('hidden fields cannot become topics, intersections, or compatibility evidence', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.visibility = { interests: false, skills: false, lookingFor: false, bio: false, goals: false };
  const person = networkPerson(state, user, leo, undefined, 'event');
  assert.deepEqual(person.sharedInterests, []);
  assert.deepEqual(person.theyOffer, []);
  assert.deepEqual(person.youOffer, []);
  assert.deepEqual(person.topics, []);
  assert.equal(person.compatibility.score, null);
  assert.doesNotMatch(JSON.stringify(person.compatibility), /computer vision|robots|electronics|assistive technology/i);
});

test('matching-only domains and experiences follow profile consent and withdrawal boundaries', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.domains = ['Private robotics domain'];
  leo.experiences = [{ category: 'professional', kind: 'hackathon', label: 'Private Hackathon', year: 2025 }];
  leo.visibility = { ...leo.visibility, domains: false, experiences: false, activeInEvent: true };
  const hidden = networkPerson(state, user, leo, undefined, 'event');
  assert.deepEqual(hidden.profile.domains, []);
  assert.deepEqual(hidden.profile.experiences, []);

  leo.visibility = { ...leo.visibility, domains: true, experiences: true };
  const shared = networkPerson(state, user, leo, undefined, 'event');
  assert.deepEqual(shared.profile.domains, ['Private robotics domain']);
  assert.deepEqual(shared.profile.experiences, leo.experiences);

  leo.visibility.previousConnections = false;
  const withdrawn = networkPerson(state, user, leo, professionalAssessment, 'network');
  assert.deepEqual(withdrawn.profile.domains, []);
  assert.deepEqual(withdrawn.profile.experiences, []);
  assert.equal(withdrawn.compatibility.source, 'unavailable');
  assert.equal(withdrawn.compatibility.score, null);
});

test('strongest-route scores and provenance stay distinct from AI networking estimates', () => {
  assert.equal(MATCH_THRESHOLD, 70);
  assert.equal(assessmentScore(professionalAssessment), 100);
  assert.equal(professionalAssessment.routes.networking, null);
  assert.equal(professionalAssessment.routes.professional, 100);
  assert.equal(assessmentRouteLabel(professionalAssessment.route), 'Professional experience');
  assert.equal(assessmentSourceLabel(professionalAssessment), 'Prepared example');
  assert.equal(assessmentRouteLabel(assessment.route), 'Networking fit');
  assert.equal(assessmentSourceLabel(assessment), 'AI networking assessment');
  assert.equal(assessmentSourceLabel({ ...professionalAssessment, source: 'rules' }), 'Shared-experience match');
  assert.equal(assessmentRoute({ ...professionalAssessment, route: undefined }), undefined);
  assert.equal(assessmentScore({ ...professionalAssessment, score: 96 }), 96);
});

test('partial and unavailable assessments never expose a numeric display score', () => {
  assert.equal(assessmentScore({ ...assessment, status: 'partial', score: 81 }), null);
  assert.equal(assessmentScore({ ...assessment, status: 'unavailable', score: 81, source: 'unavailable' }), null);
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

test('event and network audiences apply their own visibility boundary', () => {
  const { state, user, find } = fixture();
  const leo = find('leo');
  leo.visibility = { ...leo.visibility, activeInEvent: true, previousConnections: false };
  const eventPerson = networkPerson(state, user, leo, undefined, 'event');
  const savedPerson = networkPerson(state, user, leo, undefined, 'network');
  assert.equal(eventPerson.withdrawn, false);
  assert.notEqual(eventPerson.profile.bio, '');
  assert.deepEqual(eventPerson.contacts, []);
  assert.equal(savedPerson.withdrawn, true);
  assert.equal(savedPerson.profile.bio, '');
  assert.equal(savedPerson.connection.notes, ownedConnection(state, user.id, leo.id).notes);
});

test('event discovery does not use saved contact consent, while saved GitHub requires explicit sharing and its real domain', () => {
  const { state, user, find } = fixture();
  const maya = find('maya');
  maya.linkedin = 'https://www.linkedin.com/in/test-person';
  maya.visibility = { linkedin: true };
  assert.deepEqual(networkPerson(state, user, maya, undefined, 'event').contacts, []);
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

test('recommendations prioritize reciprocal skill fit, then explicit overlap without inventing a score', () => {
  const reciprocal = { theyOffer: ['Computer vision'], youOffer: ['Electronics'], sharedInterests: [] };
  const oneWay = { theyOffer: ['Computer vision', 'Robotics'], youOffer: [], sharedInterests: ['Open source'] };
  const interestsOnly = { theyOffer: [], youOffer: [], sharedInterests: ['Open source', 'Robotics'] };
  assert.ok(recommendationRank(reciprocal) > recommendationRank(oneWay));
  assert.ok(recommendationRank(oneWay) > recommendationRank(interestsOnly));
  assert.equal('score' in reciprocal, false);
});
