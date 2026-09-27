import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { matchingProfile, createAssessmentService } from '../server/assessment.mjs';
import { demoFixtures } from '../../matcher/src/service.mjs';
import { validateProfile } from '../../matcher/src/profiles.mjs';

const seed = JSON.parse(readFileSync(new URL('../shared/demo-data.json', import.meta.url), 'utf8'));
const person = id => seed.profiles.find(profile => profile.id === id);

test('web demo profiles project exactly to the Quest matcher fixtures', () => {
  for (const id of ['alex', 'maya', 'sam']) {
    assert.deepEqual(validateProfile(matchingProfile(person(id), 'event')), validateProfile(demoFixtures.profiles[id]));
  }
});

test('either wearer gets the same prepared match; switching to Sam and back retains fixture provenance', async () => {
  const service = createAssessmentService({ env: {} });
  const context = { audience: 'event', eventId: 'demo', fixture: true };
  for (const [viewer, remote, compatible] of [['alex', 'maya', true], ['maya', 'alex', true], ['alex', 'sam', false], ['maya', 'sam', false], ['alex', 'maya', true]]) {
    const result = await service.assess(person(viewer), person(remote), context);
    assert.equal(result.source, 'fixture');
    assert.equal(result.compatible, compatible);
    assert.equal(result.score, compatible ? 100 : 0);
    if (compatible) {
      assert.equal(result.reason, demoFixtures.offlineResults[0].reason);
      assert.ok(result.reason.split(/\s+/u).length <= 30);
    }
  }
});
