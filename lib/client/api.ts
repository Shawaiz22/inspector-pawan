/** Raised when the server answers with an error. The message is safe to show. */
export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

/** Options for a JSON request. */
export interface RequestOptions {
  token?: string;
  signal?: AbortSignal;
}

/**
 * POSTs JSON and returns the parsed reply.
 * @throws ApiFailure with the server's message on any non-2xx reply
 */
export async function postJson<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(options.token ? { "x-workspace-token": options.token } : {}) },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message;
    throw new ApiFailure(message ?? "Something went wrong. Please try again.", response.status);
  }
  return data as T;
}
