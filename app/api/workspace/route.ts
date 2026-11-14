import { connection } from "next/server";
import { createWorkspaceRequest, patchWorkspaceRequest } from "@/lib/api/schemas";
import { getSql, insertWorkspace, updateWorkspace, type WorkspaceRecord } from "@/lib/server/db";
import { NotFoundError, StorageError } from "@/lib/server/errors";
import { authorizeWorkspace, handle, readJson } from "@/lib/server/http";
import { RateLimiter } from "@/lib/server/rateLimit";
import { createToken, hashToken } from "@/lib/server/token";

const limiter = new RateLimiter(30, 60_000);

function publicWorkspace(workspace: WorkspaceRecord) {
  return { id: workspace.id, role: workspace.role, name: workspace.name, roleNote: workspace.role_note, places: workspace.places };
}

/** Creates a workspace. Returns its id and a secret token shown once; only the token's hash is stored. */
export function POST(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const profile = await readJson(request, createWorkspaceRequest, 20_000);
    const sql = getSql();
    if (!sql) throw new StorageError();
    const token = createToken();
    const id = await insertWorkspace(sql, {
      tokenHash: hashToken(token),
      role: profile.role,
      name: profile.name,
      roleNote: profile.roleNote,
      places: profile.places,
    });
    return Response.json({ id, token }, { status: 201 });
  });
}

/** Reads a workspace. Needs ?id= and the x-workspace-token header. */
export function GET(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const workspace = await authorizeWorkspace(request, id);
    return Response.json(publicWorkspace(workspace));
  });
}

/** Updates a workspace. Needs ?id= and the x-workspace-token header. */
export function PATCH(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    await authorizeWorkspace(request, id);
    const changes = await readJson(request, patchWorkspaceRequest, 20_000);
    const sql = getSql();
    if (!sql) throw new StorageError();
    const updated = await updateWorkspace(sql, id, changes);
    if (!updated) throw new NotFoundError("This workspace does not exist.");
    return Response.json(publicWorkspace(updated));
  });
}
