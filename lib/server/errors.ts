import "server-only";
import { ZodError } from "zod";
import { TableParseError } from "../data/parse";

/** An error with an HTTP status and a message that is safe to show users. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Request body failed validation. */
export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message, "invalid_request");
  }
}

/** Missing or wrong workspace token. */
export class AuthError extends HttpError {
  constructor(message = "This workspace link is not valid. Set up the workspace again.") {
    super(401, message, "unauthorized");
  }
}

/** Something requested does not exist. */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message, "not_found");
  }
}

/** Request body larger than allowed. */
export class PayloadTooLargeError extends HttpError {
  constructor(message: string) {
    super(413, message, "too_large");
  }
}

/** Too many requests from one client. */
export class RateLimitError extends HttpError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, `Too many requests. Try again in ${retryAfterSeconds} seconds.`, "rate_limited");
  }
}

/** Gemini failed, timed out or returned something unusable. */
export class AiError extends HttpError {
  constructor(message = "Inspector Pawan could not reach Gemini just now. Your data check and stats are ready; try again in a minute for the written brief.") {
    super(502, message, "ai_unavailable");
  }
}

/** Database needed but unavailable. */
export class StorageError extends HttpError {
  constructor(message = "Storage is not available right now. Your work is kept in this browser.") {
    super(503, message, "storage_unavailable");
  }
}

/** Maps any error to a JSON response. Never includes stacks or internal messages. */
export function toHttpError(error: unknown): Response {
  if (error instanceof RateLimitError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof TableParseError) {
    return Response.json({ error: { code: "unreadable_table", message: error.message } }, { status: 422 });
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path.join(".") || "body";
    return Response.json({ error: { code: "invalid_request", message: `${path}: ${issue?.message ?? "invalid"}` } }, { status: 400 });
  }
  return Response.json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, { status: 500 });
}
