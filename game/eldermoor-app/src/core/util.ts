/**
 * Small typed helpers that make `noUncheckedIndexedAccess` ergonomic
 * without scattering non-null assertions through gameplay code.
 */

/** Read an element of a readonly array, returning undefined when out of range. */
export function at<T>(arr: readonly T[], index: number): T | undefined {
  return arr[index];
}

/**
 * Read the last element of a non-empty array.
 * Throws when the array is empty — callers must guarantee length themselves.
 */
export function last<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('last() called on empty array');
  return arr[arr.length - 1] as T;
}

/**
 * Remove and return the first element of a mutable array.
 * Returns undefined when the array is already empty.
 */
export function shift<T>(arr: T[]): T | undefined {
  return arr.shift();
}

/**
 * Run `fn` for every element of a non-empty array.
 * Throws on an empty array so callers cannot silently do nothing.
 */
export function each<T>(arr: readonly T[], fn: (item: T, index: number) => void): void {
  if (arr.length === 0) throw new Error('each() called with empty array');
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item !== undefined) fn(item, i);
  }
}
