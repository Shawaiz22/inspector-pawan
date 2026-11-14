import { advisoryRequest } from "@/lib/api/schemas";
import { generateJson } from "@/lib/ai/gemini";
import { advisoryPrompt } from "@/lib/ai/prompts";
import { advisoryResponse } from "@/lib/ai/schemas";
import { handle, readJson } from "@/lib/server/http";
import { RateLimiter } from "@/lib/server/rateLimit";

export const maxDuration = 180;

const limiter = new RateLimiter(20, 60_000);

/** Writes the internal note and the citizen notice for one language and reading level. */
export function POST(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    const input = await readJson(request, advisoryRequest);
    const written = await generateJson({
      call: "advisory",
      prompt: advisoryPrompt(input),
      schema: advisoryResponse,
      temperature: 0.4,
    });
    return Response.json({
      language: input.language,
      level: input.level,
      internalNote: written.internalNote,
      notice: {
        headline: written.notice.headline,
        summary: written.notice.summary,
        care: written.notice.care,
      },
    });
  });
}
