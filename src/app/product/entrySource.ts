/** Only the route identifies attribution. No URL values or identifiers are retained. */
export type EntrySource = 'direct' | 'shared_result' | 'unknown';
export const APP_ENTRY_URI = 'intoss://boxing-talent-test';
export const SHARED_ENTRY_URI = `${APP_ENTRY_URI}/shared`;

export function entrySourceValue(value: unknown): EntrySource {
  return value === 'direct' || value === 'shared_result' ? value : 'unknown';
}

/** Avoid URL/searchParams dependencies in Hermes; match the documented scheme exactly. */
export function parseEntrySource(uri: unknown): EntrySource {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 4096 || /[\s\\\u0000-\u001f]/.test(uri)) return 'unknown';
  try { decodeURI(uri); } catch { return 'unknown'; }
  const match = /^intoss:\/\/boxing-talent-test(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/.exec(uri);
  if (!match) return 'unknown';
  const path = match[1] ?? '';
  if (path === '' || path === '/') return 'direct';
  return path === '/shared' || path === '/shared/' ? 'shared_result' : 'unknown';
}

export function readEntrySource(readUri: () => unknown): EntrySource {
  try { return parseEntrySource(readUri()); } catch { return 'unknown'; }
}
