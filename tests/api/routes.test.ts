import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSample } from "../support/samples";

const generateJson = vi.fn();
const getSql = vi.fn();

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/ai/gemini", () => ({ generateJson: (request: unknown) => generateJson(request) }));
vi.mock("@/lib/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/db")>()),
  getSql: () => getSql(),
}));

let nextIp = 0;
function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  nextIp += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${nextIp}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const workspace = { role: "school", name: "Kolar school", roleNote: null, places: ["Govindpura Industrial Area"] };

function geminiReplies(call: string) {
  if (call === "repair") {
    return {
      columns: { location: null, date: null, time: null, datetime: null, pm25: null, pm10: null, lat: null, lng: null },
      proposals: [],
      notes: "One row per ward and time.",
    };
  }
  if (call === "brief") {
    return {
      headline: "Govindpura is the local hotspot",
      summary: "Daytime PM2.5 at Govindpura is Very Poor.",
      findings: [
        { kind: "hotspot", title: "Govindpura stands out", detail: "PM2.5 is about double the other wards at midday.", location: "Govindpura Ward 41", pollutant: "pm25", rows: [43, 44] },
        { kind: "trend", title: "Kolar rises in the evening", detail: "Cited rows belong to another ward.", location: "Kolar Ward 12", pollutant: "pm25", rows: [43] },
      ],
      actions: [
        {
          libraryId: "sc-pe-timing",
          title: "Move PE to the cleanest window",
          when: "Daily 06:00 to 08:00",
          where: "Govindpura Ward 41",
          why: "PM2.5 averages 201 ug/m3 from 12:00 to 16:00 (rows 43, 44)",
          followUp: "Check the 12:00 to 16:00 average next week",
          rows: [43, 44],
          target: { location: "Govindpura Ward 41", startHour: 12, endHour: 16, pollutant: "pm25" },
          letter: null,
        },
        {
          libraryId: "made-up-action",
          title: "Invented",
          when: "Always",
          where: "Govindpura Ward 41",
          why: "n/a",
          followUp: "n/a",
          rows: [43],
          target: { location: "Govindpura Ward 41", startHour: 12, endHour: 16, pollutant: "pm25" },
          letter: null,
        },
      ],
    };
  }
  return {
    internalNote: { title: "Note", body: "Body" },
    notice: {
      headline: "Air is poor near Govindpura",
      summary: "Limit time outdoors.",
      care: { children: "c", olderAdults: "o", sensitive: "s", everyone: "e" },
    },
  };
}

beforeEach(() => {
  generateJson.mockReset().mockImplementation(async (request: { call: string }) => geminiReplies(request.call));
  getSql.mockReset().mockReturnValue(null);
});

describe("POST /api/brief", () => {
  it("builds a verified brief without a database and surfaces the unverified citation", async () => {
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(post("/api/brief", { text: readSample("week1"), proposals: [], accepted: [], workspace }));
    expect(response.status).toBe(200);
    const result = await response.json();

    expect(result.briefId).toBeNull();
    expect(result.findings[0].verification.verified).toBe(true);
    expect(result.findings[0].confidence).toBe("high");
    expect(result.findings[1].verification).toEqual({ verified: false, reasons: ["Rows 43 are not from Kolar Ward 12."] });
    expect(result.findings[0]).not.toHaveProperty("audit");
    expect(result.actions.map((action: { libraryId: string }) => action.libraryId)).toEqual(["sc-pe-timing"]);
    expect(result.rejectedActions[0].libraryId).toBe("made-up-action");
    expect(result.analysis.hotspots[0].location).toBe("Govindpura Ward 41");
    expect(result.compare).toBeNull();
  });

  it("sends Gemini stats and flagged rows, not the whole table", async () => {
    const { POST } = await import("@/app/api/brief/route");
    await POST(post("/api/brief", { text: readSample("week1"), workspace }));
    const briefCall = generateJson.mock.calls.map((call) => call[0]).find((request) => request.call === "brief");
    expect(briefCall.prompt).toContain('<data name="stats">');
    expect(briefCall.prompt).not.toContain("Kolar Ward 12,08/11/2026");
    expect(briefCall.prompt.length).toBeLessThan(40_000);
  });

  it("compares with a previous brief kept in the browser", async () => {
    const { POST } = await import("@/app/api/brief/route");
    const first = await (await POST(post("/api/brief", { text: readSample("week1"), workspace }))).json();
    const second = await POST(post("/api/brief", { text: readSample("week2"), workspace, previous: first.snapshot }));
    const result = await second.json();
    expect(result.compare.status).toBe("compared");
    expect(result.compare.newLocations).toEqual(["Ashoka Garden Ward 18"]);
  });

  it("rejects an invalid body with the field name", async () => {
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(post("/api/brief", { text: "a,b\n1,2" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toContain("workspace");
  });

  it("rejects an oversize body", async () => {
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(post("/api/brief", "x".repeat(700_000)));
    expect(response.status).toBe(413);
  });

  it("returns a clear message when Gemini is unavailable", async () => {
    generateJson.mockRejectedValue(Object.assign(new Error("x"), { status: 502 }));
    const { AiError } = await import("@/lib/server/errors");
    generateJson.mockRejectedValue(new AiError());
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(post("/api/brief", { text: readSample("week1"), workspace }));
    expect(response.status).toBe(502);
  });

  it("limits requests per IP", async () => {
    const { POST } = await import("@/app/api/brief/route");
    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const request = new Request("http://localhost/api/brief", { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: "{}" });
      statuses.push((await POST(request)).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("requires the workspace token when a workspace id is given without auth", async () => {
    getSql.mockReturnValue({ query: async () => [] });
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(post("/api/brief", { text: readSample("week1"), workspace, workspaceId: "5b0e3f6a-1d2c-4e8f-9a7b-3c4d5e6f7a8b" }));
    expect(response.status).toBe(401);
  });

  it("authorizes via owner session cookie when workspace id is given", async () => {
    const { encodeSessionToken } = await import("@/lib/server/session");
    const sessionCookie = encodeSessionToken("user@example.com");
    getSql.mockReturnValue({
      query: async (text: string) => {
        if (text.includes("SELECT") && text.includes("workspaces")) {
          return [
            {
              id: "5b0e3f6a-1d2c-4e8f-9a7b-3c4d5e6f7a8b",
              token_hash: "dummyhash",
              role: "school",
              name: "Kolar school",
              role_note: null,
              places: [],
              owner_email: "user@example.com",
              created_at: new Date().toISOString(),
            },
          ];
        }
        if (text.includes("INSERT INTO briefs")) {
          return [{ id: "brief-123", created_at: new Date().toISOString() }];
        }
        return [];
      },
    });
    const { POST } = await import("@/app/api/brief/route");
    const response = await POST(
      post(
        "/api/brief",
        { text: readSample("week1"), workspace, workspaceId: "5b0e3f6a-1d2c-4e8f-9a7b-3c4d5e6f7a8b" },
        { cookie: `pawan_access=${sessionCookie}` },
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.briefId).toBe("brief-123");
  });
});

describe("POST /api/repair", () => {
  it("returns code repairs and flags for the sample, mapping columns by name", async () => {
    const { POST } = await import("@/app/api/repair/route");
    const response = await POST(post("/api/repair", { text: readSample("week1") }));
    const result = await response.json();
    expect(result.columns).toMatchObject({ location: 0, pm25: 3, pm10: 4 });
    expect(result.proposals.map((proposal: { id: string }) => proposal.id)).toEqual(["code-scale-pm25", "code-date-order"]);
    expect(result.flags.some((flag: { kind: string }) => flag.kind === "stuck")).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("keeps working with code checks when Gemini fails and headers are clear", async () => {
    generateJson.mockRejectedValue(new Error("down"));
    const { POST } = await import("@/app/api/repair/route");
    const result = await (await POST(post("/api/repair", { text: readSample("week1") }))).json();
    expect(result.notes).toContain("only code checks");
  });

  it("returns 422 for an unreadable table and 400 for a missing body field", async () => {
    const { POST } = await import("@/app/api/repair/route");
    expect((await POST(post("/api/repair", { text: "   " }))).status).toBe(422);
    expect((await POST(post("/api/repair", {}))).status).toBe(400);
  });
});

describe("POST /api/advisory", () => {
  const request = { language: "hi", level: "simple", role: "school", area: "Kolar school", headline: "h", summary: "s", findings: [], actions: [] };

  it("writes the note and notice with care sections in the chosen language", async () => {
    const { POST } = await import("@/app/api/advisory/route");
    const result = await (await POST(post("/api/advisory", request))).json();
    expect(result.language).toBe("hi");
    expect(result.notice.care).toEqual({ children: "c", olderAdults: "o", sensitive: "s", everyone: "e" });
    expect(generateJson.mock.calls[0][0].temperature).toBe(0.4);
    expect(generateJson.mock.calls[0][0].prompt).toContain("Hindi");
  });

  it("rejects Urdu and any other unsupported language", async () => {
    const { POST } = await import("@/app/api/advisory/route");
    expect((await POST(post("/api/advisory", { ...request, language: "ur" }))).status).toBe(400);
  });
});

describe("workspace and notices without a database", () => {
  it("reports storage as unavailable so the browser can fall back", async () => {
    const workspaceRoute = await import("@/app/api/workspace/route");
    const created = await workspaceRoute.POST(post("/api/workspace", { role: "school", name: "Kolar school" }));
    expect(created.status).toBe(503);
    const noticeRoute = await import("@/app/api/notices/route");
    const read = await noticeRoute.GET(new Request("http://localhost/api/notices?slug=abcdefghij"));
    expect(read.status).toBe(503);
  });

  it("validates workspace input and notice slugs", async () => {
    const workspaceRoute = await import("@/app/api/workspace/route");
    const tooLong = await workspaceRoute.POST(post("/api/workspace", { role: "other", name: "Clinic", roleNote: "x".repeat(151) }));
    expect(tooLong.status).toBe(400);
    const noticeRoute = await import("@/app/api/notices/route");
    const bad = await noticeRoute.GET(new Request("http://localhost/api/notices?slug=../etc"));
    expect(bad.status).toBe(400);
  });

  it("creates a workspace storing only the token hash", async () => {
    const query = vi.fn().mockResolvedValue([{ id: "5b0e3f6a-1d2c-4e8f-9a7b-3c4d5e6f7a8b" }]);
    getSql.mockReturnValue({ query });
    const workspaceRoute = await import("@/app/api/workspace/route");
    const response = await workspaceRoute.POST(post("/api/workspace", { role: "school", name: "Kolar school", places: ["Mill"] }));
    expect(response.status).toBe(201);
    const { id, token } = await response.json();
    expect(id).toBe("5b0e3f6a-1d2c-4e8f-9a7b-3c4d5e6f7a8b");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("$1");
    expect(params).not.toContain(token);
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});
