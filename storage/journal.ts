// A small synchronous recovery journal closes the last-keystroke-before-refresh
// gap in asynchronous IndexedDB. Media remains exclusively in IndexedDB.
export function journalWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ielts.journal.${key}`, JSON.stringify(value));
  } catch {
    /* IndexedDB still saves; storage errors there are surfaced by SaveStatus. */
  }
}
export function journalRead<T>(key: string): T | undefined {
  if (typeof window === "undefined") return;
  try {
    const value = localStorage.getItem(`ielts.journal.${key}`);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}
export function journalClear(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`ielts.journal.${key}`);
  } catch {}
}
