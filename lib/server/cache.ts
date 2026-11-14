import "server-only";

/** A bounded least-recently-used cache. Oldest entries are evicted first. */
export class LruCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(private readonly maxEntries: number) {}

  /** Returns the value and marks it as recently used. */
  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  /** Stores a value, evicting the least recently used entry when full. */
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** Number of stored entries. */
  get size(): number {
    return this.entries.size;
  }
}
