import "server-only";
import { RateLimitError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

/** Fixed-window rate limiter per key with bounded memory. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000,
  ) {}

  /**
   * Counts one request for the key.
   * @throws RateLimitError when the key is over its limit in the current window
   */
  hit(key: string, now = Date.now()): void {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.delete(key);
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.evict();
      return;
    }
    bucket.count += 1;
    if (bucket.count > this.limit) throw new RateLimitError(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
  }

  /** Drops the oldest windows (Map keeps insertion order) until under the key limit. */
  private evict(): void {
    for (const key of this.buckets.keys()) {
      if (this.buckets.size <= this.maxKeys) break;
      this.buckets.delete(key);
    }
  }

  /** Number of tracked keys. */
  get size(): number {
    return this.buckets.size;
  }
}

/** Client IP from proxy headers, or "unknown". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
