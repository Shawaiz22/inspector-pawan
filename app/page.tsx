import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { AccessGate } from "@/components/AccessGate";
import { AppLoader } from "@/components/AppLoader";
import { findActiveAccessCode, getSql, insertAccessCode, touchAccessCode } from "@/lib/server/db";
import { sendAccessCodeEmail } from "@/lib/server/email";
import { RateLimiter } from "@/lib/server/rateLimit";

const GATE_COOKIE = "pawan_access";
const DEFAULT_CODE = "PAWAN2026";
const requestLimiter = new RateLimiter(5, 10 * 60 * 1000);
const memoryCodes = new Map<string, { email: string; createdAt: number }>();

function getExpectedMasterCode(): string {
  const code = process.env.APP_ACCESS_CODE || process.env.ACCESS_CODE || DEFAULT_CODE;
  return code.trim().toUpperCase();
}

function computeSessionToken(): string {
  const secret = process.env.APP_ACCESS_CODE || process.env.ACCESS_CODE || "pawan-salt-gate-2026";
  return crypto.createHmac("sha256", secret).update("pawan-access-granted").digest("hex");
}

function isAuthorized(token: string | undefined): boolean {
  if (!token) return false;
  const expectedToken = computeSessionToken();
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

function generateAccessCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(8);
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) p1 += chars[bytes[i] % chars.length];
  for (let i = 4; i < 8; i++) p2 += chars[bytes[i] % chars.length];
  return `PAWAN-${p1}-${p2}`;
}

async function unlock(code: string): Promise<{ success: boolean; error?: string }> {
  "use server";
  const candidate = code.trim().toUpperCase();
  const master = getExpectedMasterCode();

  let valid = false;

  // 1. Check against master deployment access code
  const candidateBuf = Buffer.from(candidate);
  const masterBuf = Buffer.from(master);
  if (candidateBuf.length === masterBuf.length && crypto.timingSafeEqual(candidateBuf, masterBuf)) {
    valid = true;
  }

  // 2. Check active codes in database or in-memory fallback
  if (!valid) {
    const codeHash = crypto.createHash("sha256").update(candidate).digest("hex");
    const sql = getSql();
    if (sql) {
      try {
        const record = await findActiveAccessCode(sql, codeHash);
        if (record) {
          valid = true;
          await touchAccessCode(sql, record.id).catch(() => undefined);
        }
      } catch {
        // Fall back to memory map if DB is temporarily unreachable
        if (memoryCodes.has(codeHash)) valid = true;
      }
    } else if (memoryCodes.has(codeHash)) {
      valid = true;
    }
  }

  if (!valid) {
    return { success: false, error: "Incorrect or inactive access code. Please request a new one." };
  }

  const sessionToken = computeSessionToken();
  const store = await cookies();
  store.set(GATE_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath("/");
  return { success: true };
}

async function requestAccessCode(
  rawEmail: string,
): Promise<{ success: boolean; error?: string; devMode?: boolean; codePreview?: string }> {
  "use server";
  const parsed = z.string().trim().email().max(254).safeParse(rawEmail);
  if (!parsed.success) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const email = parsed.data.toLowerCase();

  try {
    requestLimiter.hit(email);
  } catch {
    return { success: false, error: "Too many code requests. Please wait a few minutes." };
  }

  const code = generateAccessCode();
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  // Keep in memory fallback cache
  memoryCodes.set(codeHash, { email, createdAt: Date.now() });

  // Persist in Neon database if configured
  const sql = getSql();
  if (sql) {
    try {
      await insertAccessCode(sql, {
        email,
        codeHash,
        codePrefix: code.slice(0, 10),
        metadata: { requestedAt: new Date().toISOString() },
      });
    } catch {
      // Continue even if database insert fails so user receives email
    }
  }

  const sendResult = await sendAccessCodeEmail(email, code);
  if (!sendResult.sent) {
    return { success: false, error: sendResult.error || "Unable to send email right now." };
  }

  return {
    success: true,
    devMode: Boolean(sendResult.devMode),
    codePreview: sendResult.devMode ? code : undefined,
  };
}

async function lock(): Promise<void> {
  "use server";
  const store = await cookies();
  store.delete(GATE_COOKIE);
  revalidatePath("/");
}

async function GatedContent() {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(GATE_COOKIE)?.value;
  const authorized = isAuthorized(token);

  if (!authorized) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <AccessGate onUnlock={unlock} onRequestCode={requestAccessCode} />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <AppLoader onLock={lock} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <p className="text-muted">Loading Inspector Pawan…</p>
        </main>
      }
    >
      <GatedContent />
    </Suspense>
  );
}
