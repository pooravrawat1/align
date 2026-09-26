import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveJourneyMotion } from '../src/journeyMotion.ts';

const stops = [0, 1000, 1800, 3000, 3600, 4000];

test('each authored journey leg has its forward and reverse travel time', () => {
  const forward = [1.8, 1.35, 1.9, 1.35, .45];
  const reverse = [1.2, 1.1, 1.35, 1.1, .45];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const outward = resolveJourneyMotion({ from: stops[index], to: stops[index + 1], checkpoint: true, stops });
    const inward = resolveJourneyMotion({ from: stops[index + 1], to: stops[index], checkpoint: true, stops });
    assert.equal(outward.duration, forward[index]);
    assert.equal(typeof outward.ease, 'function');
    assert.equal(outward.ease(0), 0);
    assert.ok(Math.abs(outward.ease(.35) - .35) < 1e-12);
    assert.equal(outward.ease(1), 1);
    assert.equal(inward.duration, reverse[index]);
    assert.equal(inward.ease, 'sine.inOut');
  }
});

test('checkpoint reversals use the live bracketing leg and scale partial travel', () => {
  const forward = resolveJourneyMotion({ from: 1500, to: 1800, checkpoint: true, stops });
  const reverse = resolveJourneyMotion({ from: 1500, to: 1000, checkpoint: true, stops });
  const interruptedTarget = resolveJourneyMotion({ from: 1500, to: 3000, checkpoint: true, stops });
  assert.ok(Math.abs(forward.duration - 1.35 * Math.sqrt(300 / 800)) < 1e-12);
  assert.ok(Math.abs(reverse.duration - 1.1 * Math.sqrt(500 / 800)) < 1e-12);
  assert.equal(interruptedTarget.duration, 1.35);
  assert.equal(typeof forward.ease, 'function');
  assert.equal(reverse.ease, 'sine.inOut');

  const shortLanding = resolveJourneyMotion({ from: 3997.9, to: 4000, checkpoint: true, stops });
  assert.equal(shortLanding.duration, .25);
});

test('direct adjacent-stop navigation uses authored timing', () => {
  assert.equal(resolveJourneyMotion({ from: 1000, to: 1800, checkpoint: false, stops }).duration, 1.35);
  assert.equal(resolveJourneyMotion({ from: 1800, to: 1000, checkpoint: false, stops }).duration, 1.1);
});

test('non-adjacent direct navigation keeps the distance duration and cap', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 1000 });
  try {
    assert.equal(resolveJourneyMotion({ from: 0, to: 3000, checkpoint: false, stops }).duration, 1.21);
    assert.equal(resolveJourneyMotion({ from: 0, to: 10000, checkpoint: false, stops }).duration, 1.6);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'innerHeight', descriptor);
    else delete globalThis.innerHeight;
  }
});
