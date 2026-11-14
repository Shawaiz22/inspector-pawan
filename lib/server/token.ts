import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A new random workspace token: 32 bytes, base64url. */
export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex of a token. Only this hash is stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Compares a presented token with a stored hash in constant time. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

/** A random URL-safe slug of the given length for public notices. */
export function createSlug(length = 10): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let slug = "";
  for (const byte of bytes) slug += alphabet[byte % alphabet.length];
  return slug;
}
