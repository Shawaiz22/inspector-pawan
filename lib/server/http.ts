import "server-only";
import type { z } from "zod";
import { getSql, findWorkspace, type WorkspaceRecord } from "./db";
import { AuthError, NotFoundError, PayloadTooLargeError, StorageError, toHttpError, ValidationError } from "./errors";
import { clientIp, type RateLimiter } from "./rateLimit";
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
 * Loads a workspace and checks the x-workspace-token header in constant time.
 * @throws StorageError without a database, AuthError on a bad token
 */
export async function authorizeWorkspace(request: Request, workspaceId: string): Promise<WorkspaceRecord> {
  const sql = getSql();
  if (!sql) throw new StorageError();
  const token = request.headers.get("x-workspace-token");
  if (!token) throw new AuthError();
  const workspace = await findWorkspace(sql, workspaceId);
  if (!workspace) throw new NotFoundError("This workspace does not exist.");
  if (!tokenMatches(token, workspace.token_hash)) throw new AuthError();
  return workspace;
}
