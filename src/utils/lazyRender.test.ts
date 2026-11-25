import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLazyMountState, shouldRunRenderLoop } from './lazyRender';

test('shouldRunRenderLoop runs only when card is in viewport and tab is visible', () => {
  assert.equal(shouldRunRenderLoop({ isInViewport: true, isDocumentHidden: false }), true);
  assert.equal(shouldRunRenderLoop({ isInViewport: false, isDocumentHidden: false }), false);
  assert.equal(shouldRunRenderLoop({ isInViewport: true, isDocumentHidden: true }), false);
  assert.equal(shouldRunRenderLoop({ isInViewport: false, isDocumentHidden: true }), false);
});

test('nextLazyMountState latches hasEnteredViewport true once card enters viewport', () => {
  const initial = { isInViewport: false, hasEnteredViewport: false };
  const entered = nextLazyMountState(initial, true);
  assert.deepEqual(entered, { isInViewport: true, hasEnteredViewport: true });

  const left = nextLazyMountState(entered, false);
  assert.deepEqual(left, { isInViewport: false, hasEnteredViewport: true });

  const reentered = nextLazyMountState(left, true);
  assert.deepEqual(reentered, { isInViewport: true, hasEnteredViewport: true });
});
