import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCamera, zoomAt } from '../src/graphCamera.ts';
test('zoom preserves the world point under the cursor', () => {
  const camera = { x: 23, y: -12, scale: .8 }, cursor = { x: 180, y: 250 };
  const next = zoomAt(camera, cursor, 1.3);
  assert.ok(Math.abs((cursor.x - camera.x) / camera.scale - (cursor.x - next.x) / next.scale) < 1e-9);
  assert.ok(Math.abs((cursor.y - camera.y) / camera.scale - (cursor.y - next.y) / next.scale) < 1e-9);
});
test('fit includes displaced people and self', () => {
  const points = [{ x: -100, y: -100 }, { x: 950, y: 760 }];
  const camera = fitCamera(points, 900, 640);
  for (const p of [...points, { x: 450, y: 320 }]) {
    assert.ok(p.x * camera.scale + camera.x >= 0 && p.x * camera.scale + camera.x <= 900);
    assert.ok(p.y * camera.scale + camera.y >= 0 && p.y * camera.scale + camera.y <= 640);
  }
});
