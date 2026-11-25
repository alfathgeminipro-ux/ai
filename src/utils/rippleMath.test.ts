import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendRipple,
  computeLiquidRipple,
  shouldSpawnRipple,
} from './rippleMath';

test('computeLiquidRipple calculates exact local coordinates and farthest-corner diameter', () => {
  const rect = { left: 100, top: 200, width: 300, height: 200 };
  const centerRipple = computeLiquidRipple({ clientX: 250, clientY: 300 }, rect, 1);

  assert.equal(centerRipple.id, 1);
  assert.equal(centerRipple.x, 150);
  assert.equal(centerRipple.y, 100);
  // Corner distance from center of 300x200 is hypot(150, 100) ≈ 180.27 -> diameter = ceil(360.55) + 24 = 385
  assert.equal(centerRipple.diameter, Math.ceil(Math.hypot(150, 100) * 2) + 24);

  // Corner click requires larger diameter to cover opposite corner
  const cornerRipple = computeLiquidRipple({ clientX: 100, clientY: 200 }, rect, 2);
  assert.equal(cornerRipple.x, 0);
  assert.equal(cornerRipple.y, 0);
  assert.ok(cornerRipple.diameter > centerRipple.diameter);
});

test('computeLiquidRipple clamps out-of-bounds pointer coords cleanly', () => {
  const rect = { left: 50, top: 50, width: 200, height: 100 };
  const clamped = computeLiquidRipple({ clientX: 10, clientY: 400 }, rect, 3);
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 100);
});

test('shouldSpawnRipple strictly respects prefers-reduced-motion and viewport visibility', () => {
  assert.equal(shouldSpawnRipple(false, true), true);
  assert.equal(shouldSpawnRipple(true, true), false);
  assert.equal(shouldSpawnRipple(false, false), false);
  assert.equal(shouldSpawnRipple(true, false), false);
});

test('appendRipple caps concurrent ripples to preserve 60fps', () => {
  const next = appendRipple([1, 2, 3, 4], 5, 4);
  assert.deepEqual(next, [2, 3, 4, 5]);
});
