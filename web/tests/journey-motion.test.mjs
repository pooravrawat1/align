import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveJourneyMotion } from '../src/journeyMotion.ts';

const stops = [0, 1000, 1800, 3000, 3600, 4000];

test('every section has the same forward and reverse timing', () => {
  const forward = [.9, .9, .9, .9, .9];
  const reverse = [.9, .9, .9, .9, .9];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const outward = resolveJourneyMotion({ from: stops[index], to: stops[index + 1], checkpoint: true, stops });
    const inward = resolveJourneyMotion({ from: stops[index + 1], to: stops[index], checkpoint: true, stops });
    assert.equal(outward.duration, forward[index]);
    assert.equal(outward.ease, 'sine.inOut');
    assert.equal(inward.duration, reverse[index]);
    assert.equal(inward.ease, 'sine.inOut');
  }
});

test('checkpoint reversals use the live bracketing leg and scale partial travel', () => {
  const forward = resolveJourneyMotion({ from: 1500, to: 1800, checkpoint: true, stops });
  const reverse = resolveJourneyMotion({ from: 1500, to: 1000, checkpoint: true, stops });
  const interruptedTarget = resolveJourneyMotion({ from: 1500, to: 3000, checkpoint: true, stops });
  assert.ok(Math.abs(forward.duration - .9 * Math.sqrt(300 / 800)) < 1e-12);
  assert.ok(Math.abs(reverse.duration - .9 * Math.sqrt(500 / 800)) < 1e-12);
  assert.equal(interruptedTarget.duration, .9);
  assert.equal(forward.ease, 'sine.inOut');
  assert.equal(reverse.ease, 'sine.inOut');

  const shortLanding = resolveJourneyMotion({ from: 3997.9, to: 4000, checkpoint: true, stops });
  assert.equal(shortLanding.duration, .25);
});

test('direct adjacent-stop navigation uses authored timing', () => {
  assert.equal(resolveJourneyMotion({ from: 1000, to: 1800, checkpoint: false, stops }).duration, .9);
  assert.equal(resolveJourneyMotion({ from: 1800, to: 1000, checkpoint: false, stops }).duration, .9);
});

test('direct navigation uses the same timing regardless of distance', () => {
  for (const to of [1800, 3000, 10000]) {
    const motion = resolveJourneyMotion({ from: 0, to, checkpoint: false, stops });
    assert.equal(motion.duration, .9);
    assert.equal(motion.ease, 'sine.inOut');
  }
});
