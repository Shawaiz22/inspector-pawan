import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppLoader } from "@/components/AppLoader";

const GATE_COOKIE = "pawan_access";
const DEFAULT_CODE = "PAWAN2026";

function getExpectedAccessCode(): string {
  const code = process.env.APP_ACCESS_CODE || process.env.ACCESS_CODE || DEFAULT_CODE;
  return code.trim();
}

function computeToken(code: string): string {
  return crypto.createHmac("sha256", "pawan-salt-gate-2026").update(code).digest("hex");
}

function isAuthorized(token: string | undefined): boolean {
  if (!token) return false;
  const expectedToken = computeToken(getExpectedAccessCode());
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

async function unlock(code: string): Promise<{ success: boolean; error?: string }> {
  "use server";
  const expected = getExpectedAccessCode();
  const candidate = code.trim();

  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);

  const matches =
    candidateBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(candidateBuf, expectedBuf);

  if (!matches) {
    return { success: false, error: "Incorrect access code. Access denied." };
  }

  const sessionToken = computeToken(expected);
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
        <AccessGate onUnlock={unlock} />
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
