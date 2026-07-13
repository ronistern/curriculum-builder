/**
 * Small, dependency-free helpers shared across the app. No React, no DOM state —
 * just pure functions plus the one browser download primitive.
 */

/** A state update expressed either as the next value or a reducer over the previous one. */
export type Updater<T> = T | ((prev: T) => T);

/**
 * A random id with an optional prefix. Uses `crypto.randomUUID()` when available
 * (ignoring the prefix, since UUIDs are already unique) and falls back to a
 * short prefixed random string on older browsers.
 */
export function newId(prefix = ''): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return prefix + Math.random().toString(36).slice(2);
}

/**
 * A filesystem-safe slug of `name`. Unicode letters and digits are kept (so
 * Hebrew program/student names survive rather than collapsing to the fallback),
 * every other run of characters becomes a single `_`, and an empty result falls
 * back to `fallback`.
 */
export function slugify(name: string, fallback: string): string {
  const safe = name
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return safe || fallback;
}

/** A clamped, whole-number percentage of `value` out of `total` (0 when total is 0). */
export function percentOf(value: number, total: number): number {
  return total ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

/** Pretty-printed JSON, used for both on-disk files and the working-copy caches. */
export function serializeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Trigger a browser download of a blob (fallback for browsers without File System Access). */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
