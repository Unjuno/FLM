// Timeout management utilities

type TimeoutRef = React.MutableRefObject<{
  [key: string]: NodeJS.Timeout | undefined;
}>;

/**
 * Clears a timeout from a ref object
 */
export function clearTimeoutRef(ref: TimeoutRef, key: string): void {
  const timeout = ref.current[key];
  if (timeout) {
    clearTimeout(timeout);
    delete ref.current[key];
  }
}

/**
 * Sets a timeout and stores it in a ref object
 */
export function setTimeoutRef(
  ref: TimeoutRef,
  key: string,
  callback: () => void,
  delay: number
): void {
  // Clear existing timeout if any
  clearTimeoutRef(ref, key);

  // Set new timeout
  ref.current[key] = setTimeout(callback, delay);
}

/**
 * Clears all timeouts from a ref object
 */
export function clearAllTimeouts(ref: TimeoutRef): void {
  Object.keys(ref.current).forEach(key => {
    clearTimeoutRef(ref, key);
  });
}
