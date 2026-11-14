import { connection } from "next/server";
import { publishRequest } from "@/lib/api/schemas";
import { findNotice, getSql, insertNotice } from "@/lib/server/db";
import { NotFoundError, StorageError, ValidationError } from "@/lib/server/errors";
import { authorizeWorkspace, handle, readJson } from "@/lib/server/http";
import { RateLimiter } from "@/lib/server/rateLimit";
import { createSlug } from "@/lib/server/token";

const limiter = new RateLimiter(30, 60_000);
const SLUG_PATTERN = /^[a-z0-9]{10}$/;

/** Publishes a notice as a public page. Needs the workspace token. Returns the slug. */
export function POST(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const body = await readJson(request, publishRequest, 100_000);
    await authorizeWorkspace(request, body.workspaceId);
    const sql = getSql();
    if (!sql) throw new StorageError();
    const slug = createSlug();
    const publishedAt = await insertNotice(sql, {
      slug,
      workspaceId: body.workspaceId,
      briefId: body.briefId,
      area: body.area,
      content: body.content,
    });
    return Response.json({ slug, path: `/n/${slug}`, publishedAt }, { status: 201 });
  });
}

/** Reads a published notice by ?slug=. Public, no token. */
export function GET(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    if (!SLUG_PATTERN.test(slug)) throw new ValidationError("This notice link is not valid.");
    const sql = getSql();
    if (!sql) throw new StorageError();
    const notice = await findNotice(sql, slug);
    if (!notice) throw new NotFoundError("This notice was not found.");
    return Response.json(notice, { headers: { "Cache-Control": "public, max-age=60" } });
  });
}
