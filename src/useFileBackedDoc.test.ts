import { describe, expect, it } from 'vitest';
import {
  historyReducer,
  HISTORY_LIMIT,
  type History,
} from './useFileBackedDoc';

/** A fresh single-entry history at `present`. */
const start = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
});

describe('historyReducer', () => {
  describe('set', () => {
    it('applies a plain value and pushes the prior state onto past', () => {
      const next = historyReducer(start(1), { type: 'set', updater: 2 });
      expect(next).toEqual({ past: [1], present: 2, future: [] });
    });

    it('applies a functional updater against the current present', () => {
      const next = historyReducer(start(1), {
        type: 'set',
        updater: (n: number) => n + 10,
      });
      expect(next).toEqual({ past: [1], present: 11, future: [] });
    });

    it('clears the redo stack (future) on a fresh edit', () => {
      const state: History<number> = { past: [1], present: 2, future: [3, 4] };
      const next = historyReducer(state, { type: 'set', updater: 9 });
      expect(next).toEqual({ past: [1, 2], present: 9, future: [] });
    });

    it('is a no-op when the updater returns the same reference', () => {
      const present = { a: 1 };
      const state = start(present);
      const next = historyReducer(state, {
        type: 'set',
        updater: (p) => p,
      });
      // Same state object back: no history entry, no re-render churn.
      expect(next).toBe(state);
    });

    it('does not run a functional updater when present is null', () => {
      const state = start<number | null>(null);
      const next = historyReducer(state, {
        type: 'set',
        updater: (n) => (n ?? 0) + 1,
      });
      expect(next).toBe(state);
    });

    it('still sets a null present via a plain value', () => {
      const next = historyReducer(start<number | null>(5), {
        type: 'set',
        updater: null,
      });
      expect(next).toEqual({ past: [5], present: null, future: [] });
    });

    it('caps the past stack at HISTORY_LIMIT, dropping the oldest', () => {
      let state = start(0);
      for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
        state = historyReducer(state, { type: 'set', updater: i });
      }
      expect(state.past).toHaveLength(HISTORY_LIMIT);
      // Oldest entries (0..4) fell off; the retained window is the last 100
      // states before present, i.e. 5 .. HISTORY_LIMIT+4.
      expect(state.past[0]).toBe(5);
      expect(state.past[state.past.length - 1]).toBe(HISTORY_LIMIT + 4);
      expect(state.present).toBe(HISTORY_LIMIT + 5);
    });
  });

  describe('undo', () => {
    it('steps back one state and pushes present onto future', () => {
      const state: History<number> = { past: [1, 2], present: 3, future: [] };
      const next = historyReducer(state, { type: 'undo' });
      expect(next).toEqual({ past: [1], present: 2, future: [3] });
    });

    it('is a no-op with an empty past', () => {
      const state = start(1);
      expect(historyReducer(state, { type: 'undo' })).toBe(state);
    });

    it('round-trips with redo back to the original state', () => {
      const original: History<number> = { past: [1], present: 2, future: [] };
      const undone = historyReducer(original, { type: 'undo' });
      const redone = historyReducer(undone, { type: 'redo' });
      expect(redone).toEqual(original);
    });
  });

  describe('redo', () => {
    it('steps forward one state and pushes present onto past', () => {
      const state: History<number> = { past: [1], present: 2, future: [3, 4] };
      const next = historyReducer(state, { type: 'redo' });
      expect(next).toEqual({ past: [1, 2], present: 3, future: [4] });
    });

    it('is a no-op with an empty future', () => {
      const state = start(1);
      expect(historyReducer(state, { type: 'redo' })).toBe(state);
    });
  });

  describe('reset', () => {
    it('replaces present and clears both stacks', () => {
      const state: History<number> = { past: [1, 2], present: 3, future: [4] };
      const next = historyReducer(state, { type: 'reset', value: 99 });
      expect(next).toEqual({ past: [], present: 99, future: [] });
    });
  });

  it('supports a full edit → undo → undo → redo sequence', () => {
    let state = start('a');
    state = historyReducer(state, { type: 'set', updater: 'b' });
    state = historyReducer(state, { type: 'set', updater: 'c' });
    expect(state.present).toBe('c');

    state = historyReducer(state, { type: 'undo' });
    expect(state.present).toBe('b');

    state = historyReducer(state, { type: 'undo' });
    expect(state.present).toBe('a');
    expect(state.future).toEqual(['b', 'c']);

    state = historyReducer(state, { type: 'redo' });
    expect(state.present).toBe('b');

    // A new edit here abandons the 'c' redo branch.
    state = historyReducer(state, { type: 'set', updater: 'z' });
    expect(state).toEqual({ past: ['a', 'b'], present: 'z', future: [] });
  });
});
