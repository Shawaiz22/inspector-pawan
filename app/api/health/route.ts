import { connection } from "next/server";
import { describeConfiguration, readServerEnv } from "@/lib/server/env";

/** Liveness check. Reports whether Gemini and the database are configured, never their values. */
export async function GET(): Promise<Response> {
  await connection();
  const configured = describeConfiguration(readServerEnv());
  return Response.json(
    { ok: true, ...configured },
    { headers: { "Cache-Control": "no-store" } },
  );
}
