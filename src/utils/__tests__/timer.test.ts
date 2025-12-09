import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearTimeoutRef,
  clearAllTimeouts,
  setTimeoutRef,
} from '../timeout';

describe('timer utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setTimeoutRef', () => {
    it('should set a timeout and store it in ref', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback = vi.fn();

      setTimeoutRef(ref, 'test-key', callback, 1000);

      expect(ref.current['test-key']).toBeDefined();
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clear existing timeout before setting new one', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setTimeoutRef(ref, 'test-key', callback1, 1000);
      const firstTimeout = ref.current['test-key'];

      setTimeoutRef(ref, 'test-key', callback2, 2000);

      expect(ref.current['test-key']).not.toBe(firstTimeout);

      vi.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple timeouts with different keys', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setTimeoutRef(ref, 'key1', callback1, 1000);
      setTimeoutRef(ref, 'key2', callback2, 2000);

      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTimeoutRef', () => {
    it('should clear a timeout from ref', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback = vi.fn();

      setTimeoutRef(ref, 'test-key', callback, 1000);
      clearTimeoutRef(ref, 'test-key');

      expect(ref.current['test-key']).toBeUndefined();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should do nothing when key does not exist', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };

      expect(() => clearTimeoutRef(ref, 'non-existent')).not.toThrow();
      expect(ref.current['non-existent']).toBeUndefined();
    });

    it('should only clear the specified timeout', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setTimeoutRef(ref, 'key1', callback1, 1000);
      setTimeoutRef(ref, 'key2', callback2, 1000);

      clearTimeoutRef(ref, 'key1');

      vi.advanceTimersByTime(1000);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all timeouts from ref', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      setTimeoutRef(ref, 'key1', callback1, 1000);
      setTimeoutRef(ref, 'key2', callback2, 2000);
      setTimeoutRef(ref, 'key3', callback3, 3000);

      clearAllTimeouts(ref);

      expect(Object.keys(ref.current)).toHaveLength(0);

      vi.advanceTimersByTime(3000);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it('should do nothing when ref is empty', () => {
      const ref = { current: {} as { [key: string]: NodeJS.Timeout | undefined } };

      expect(() => clearAllTimeouts(ref)).not.toThrow();
      expect(Object.keys(ref.current)).toHaveLength(0);
    });
  });
});
