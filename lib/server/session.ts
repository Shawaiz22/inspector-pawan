import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const GATE_COOKIE = "pawan_access";

function getSecret(): string {
  return process.env.APP_ACCESS_CODE || process.env.ACCESS_CODE || "pawan-salt-gate-2026";
}

/** Signs and encodes user session into a base64url.signature token. */
export function encodeSessionToken(email: string): string {
  const secret = getSecret();
  const payload = JSON.stringify({ email: email.toLowerCase().trim(), issuedAt: Date.now() });
  const base64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(base64).digest("hex");
  return `${base64}.${sig}`;
}

/** Verifies and decodes the session token from the cookie, or returns null. */
export function decodeSessionToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const secret = getSecret();

  if (token.includes(".")) {
    const [base64, sig] = token.split(".");
    if (!base64 || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", secret).update(base64).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      try {
        const parsed = JSON.parse(Buffer.from(base64, "base64url").toString("utf8"));
        if (typeof parsed?.email === "string" && parsed.email.length > 0) {
          return { email: parsed.email };
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  // Backward compatibility with legacy master-token format
  const expectedOld = crypto.createHmac("sha256", secret).update("pawan-access-granted").digest("hex");
  const tokenBuf = Buffer.from(token);
  const oldBuf = Buffer.from(expectedOld);
  if (tokenBuf.length === oldBuf.length && crypto.timingSafeEqual(tokenBuf, oldBuf)) {
    return { email: "authorized" };
  }

  return null;
}

/** Decodes session from a raw cookie header string. */
export function decodeSessionCookie(cookieHeader: string | null | undefined): { email: string } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${GATE_COOKIE}=([^;]+)`));
  if (!match || !match[1]) return null;
  return decodeSessionToken(decodeURIComponent(match[1]));
}

/** Reads the current session from incoming request cookies or the next/headers cookie store. */
export async function getActiveSession(request?: Request): Promise<{ email: string } | null> {
  if (request) {
    const fromHeader = decodeSessionCookie(request.headers.get("cookie"));
    if (fromHeader) return fromHeader;
  }
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(GATE_COOKIE)?.value;
    return decodeSessionToken(token);
  } catch {
    return null;
  }
}
