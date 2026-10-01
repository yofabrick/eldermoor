/**
 * Small typed helpers that make strict index and boolean checks ergonomic
 * without non-null assertions in gameplay code.
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

/** Index into a non-empty list. Throws when the slot is missing. */
export function pick<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Index ${index} out of range (length ${items.length})`);
  }
  return item;
}

/** Non-empty string. Empty and nullish values are absent. */
export function hasText(value: string | null | undefined): value is string {
  return value != null && value !== '';
}

/** Present, non-zero, non-NaN number. Matches a truthy number check. */
export function nonzero(value: number | null | undefined): value is number {
  return typeof value === 'number' && value !== 0 && !Number.isNaN(value);
}

/** DOM node that the page shell is required to contain. */
export function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el == null) {
    throw new Error(`Missing DOM node #${id}`);
  }
  return el;
}

/** Child element created by a widget's own markup. */
export function requireChild(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Missing element ${selector}`);
  }
  return el;
}

/** 2D canvas context. Throws when the browser refuses the context. */
export function requireCanvas2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('2D canvas context unavailable');
  }
  return ctx;
}
