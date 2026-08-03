import assert from 'node:assert/strict';
import test from 'node:test';
import { wrappedFocusTargetIndex } from '../components/ui/dialog-focus';

test('focus navigation wraps only after the final dialog control', () => {
  assert.equal(wrappedFocusTargetIndex(0, 3, false), null);
  assert.equal(wrappedFocusTargetIndex(1, 3, false), null);
  assert.equal(wrappedFocusTargetIndex(2, 3, false), 0);
});

test('reverse focus navigation wraps only before the first dialog control', () => {
  assert.equal(wrappedFocusTargetIndex(2, 3, true), null);
  assert.equal(wrappedFocusTargetIndex(1, 3, true), null);
  assert.equal(wrappedFocusTargetIndex(0, 3, true), 2);
});

test('focus navigation enters the dialog at the appropriate edge', () => {
  assert.equal(wrappedFocusTargetIndex(-1, 3, false), 0);
  assert.equal(wrappedFocusTargetIndex(-1, 3, true), 2);
  assert.equal(wrappedFocusTargetIndex(0, 0, false), null);
});
