/** Reads JSON from localStorage. Returns the fallback when storage is blocked or empty. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? fallback : (JSON.parse(text) as T);
  } catch {
    return fallback;
  }
}

/** Writes JSON to localStorage. Silently does nothing when storage is blocked. */
export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the app keeps working for this session.
  }
}
