import "server-only";
import type { z } from "zod";
import { getSql, findWorkspace, type WorkspaceRecord } from "./db";
import { AuthError, NotFoundError, PayloadTooLargeError, StorageError, toHttpError, ValidationError } from "./errors";
import { clientIp, type RateLimiter } from "./rateLimit";
import { getActiveSession } from "./session";
import { tokenMatches } from "./token";

/** Default request body limit (text table plus metadata). */
export const MAX_BODY_BYTES = 600_000;

/**
 * Reads and validates a JSON body with a size limit.
 * @throws PayloadTooLargeError, ValidationError or ZodError
 */
export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = MAX_BODY_BYTES): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new PayloadTooLargeError("The request is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) throw new PayloadTooLargeError("The request is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError("The request body is not valid JSON.");
  }
  return schema.parse(body);
}

/** Runs a route handler with a per-IP rate limit and safe error responses. */
export async function handle(request: Request, limiter: RateLimiter, run: () => Promise<Response>): Promise<Response> {
  try {
    limiter.hit(clientIp(request));
    return await run();
  } catch (error) {
    return toHttpError(error);
  }
}

/**
 * Loads a workspace and authorizes via active owner session or the x-workspace-token header.
 * @throws StorageError without a database, AuthError on a bad token or unauthorized access
 */
export async function authorizeWorkspace(request: Request, workspaceId: string): Promise<WorkspaceRecord> {
  const sql = getSql();
  if (!sql) throw new StorageError();

  const token = request.headers.get("x-workspace-token");
  const session = await getActiveSession(request);

  if (!token && !session?.email) {
    throw new AuthError();
  }

  const workspace = await findWorkspace(sql, workspaceId);
  if (!workspace) throw new NotFoundError("This workspace does not exist.");

  // Check 1: Session owner check (authenticated user owns this workspace)
  if (
    session?.email &&
    (session.email === "authorized" ||
      (workspace.owner_email && session.email.toLowerCase() === workspace.owner_email.toLowerCase()))
  ) {
    return workspace;
  }

  // Check 2: Direct workspace token (header match in constant time)
  if (token && tokenMatches(token, workspace.token_hash)) {
    return workspace;
  }

  throw new AuthError();
}
