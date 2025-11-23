// ResizeObserver mock for testing environments
// This file provides a typed mock for ResizeObserver that can be used in tests

interface ResizeObserverEntry {
  readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  readonly contentBoxSize: ReadonlyArray<ResizeObserverSize>;
  readonly contentRect: DOMRectReadOnly;
  readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>;
  readonly target: Element;
}

interface ResizeObserverSize {
  readonly blockSize: number;
  readonly inlineSize: number;
}

interface ResizeObserverCallback {
  (entries: ReadonlyArray<ResizeObserverEntry>, observer: ResizeObserver): void;
}

class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe(_target: Element, _options?: ResizeObserverOptions): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
}

// Setup ResizeObserver mock if not available
if (typeof global !== 'undefined' && typeof global.ResizeObserver === 'undefined') {
  (global as typeof global & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    MockResizeObserver as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  (window as typeof window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    MockResizeObserver as typeof ResizeObserver;
}

export { MockResizeObserver };

