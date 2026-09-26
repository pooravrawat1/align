import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointGesture, nextCheckpoint, STOP_EPSILON } from '../src/checkpointGesture.ts';

test('one trackpad push and its long decay admit one chapter only', () => {
  const gesture = new CheckpointGesture();
  const deltas = [8, 14, 22, 40, 65, 80, 65, 42, 25, 12, 5, 2, 1, .5];
  const admitted = deltas.map((delta, index) => gesture.admit(delta, index * 60)).filter(Boolean);
  assert.deepEqual(admitted, [1]);
});

test('separate pushes, deliberate reversal and new acceleration each rearm', () => {
  const gesture = new CheckpointGesture();
  assert.equal(gesture.admit(60, 0), 1);
  assert.equal(gesture.admit(60, 400), 1);
  assert.equal(gesture.admit(-60, 450), -1);
  assert.equal(gesture.admit(-10, 500), 0);
  assert.equal(gesture.admit(-2, 600), 0);
  assert.equal(gesture.admit(-50, 650), -1);
});

test('small wheel notches accumulate intention; noise cannot reverse travel', () => {
  const gesture = new CheckpointGesture();
  assert.equal(gesture.admit(16, 0), 0);
  assert.equal(gesture.admit(16, 30), 0);
  assert.equal(gesture.admit(16, 60), 1);
  assert.equal(gesture.admit(-2, 80), 0);
  assert.equal(gesture.admit(12, 100), 0);
});

test('scrollbar positions and reversals choose the next stop in the intended direction', () => {
  const stops = [0, 1000, 1700, 2400, 3300];
  assert.equal(nextCheckpoint(stops, 1350, 1), 1700);
  assert.equal(nextCheckpoint(stops, 1350, -1), 1000);
  assert.equal(nextCheckpoint(stops, 999.5, 1), 1700);
  assert.equal(nextCheckpoint(stops, 3300, 1), 3300);
  assert.equal(nextCheckpoint(stops, 0, -1), 0);
});

test('checkpoint selection shares the two-pixel landing tolerance', () => {
  const stops = [0, 1000, 2000];
  assert.equal(STOP_EPSILON, 2);
  assert.equal(nextCheckpoint(stops, 1000 - STOP_EPSILON, 1), 2000);
  assert.equal(nextCheckpoint(stops, 1000 + STOP_EPSILON, -1), 0);
});
