/**
 * Small typed helpers that make `noUncheckedIndexedAccess` ergonomic
 * without scattering non-null assertions through gameplay code.
 */

/** Read an element of any array-like, returning undefined when out of range. */
export function at<T>(arr: ArrayLike<T>, index: number): T | undefined {
  return arr[index];
}

/**
 * Remove and return the first element of a mutable array.
 * Returns undefined when the array is already empty.
 */
export function shift<T>(arr: T[]): T | undefined {
  return arr.shift();
}
