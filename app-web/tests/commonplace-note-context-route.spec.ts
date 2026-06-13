import { expect, test } from "@playwright/test";
import { GET, testHooks } from "../src/app/api/commonplace/notes/context/route";

const baseNoteRow = {
  id: "note-db-1",
  owner_id: "user-123",
  client_id: "client-secret-ish",
  shortcode: "#wn1",
  source_book: "Why Nations Fail",
  source_page: "42",
  title: "Institutions and Growth",
  quote: "A quote that is not needed for Podchat preview.",
  insight: "Inclusive institutions create stronger incentives for growth.",
  tags: ["politics", "economics", "institutions", "development"],
  connections: ["other-note"],
  relevance: "Release candidate note context.",
  created_at: "2026-06-06T05:00:00.000Z",
  updated_at: "2026-06-06T05:00:00.000Z",
};

type MockOptions = {
  noteRow?: Record<string, unknown> | null;
  noteError?: Error | null;
};

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];

  function buildQuery(table: string) {
    const query = {
      select(columns: string) {
        calls.push(`select:${table}:${columns}`);
        return query;
      },
      eq(column: string, value: string) {
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_notes") {
          return Promise.resolve({
            data: options.noteRow !== undefined ? options.noteRow : baseNoteRow,
            error: options.noteError ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };
    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return buildQuery(table);
    },
  };

  return { client, calls };
}

function buildRequest(noteId?: string): Request {
  const url = new URL("http://localhost/api/commonplace/notes/context");
  if (noteId) url.searchParams.set("noteId", noteId);
  return new Request(url.toString(), {
    method: "GET",
    headers: { "content-type": "application/json" },
  });
}

test.describe("Commonplace note context route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated requests return auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    testHooks.getSupabaseClient = () => {
      throw new Error("should not create client");
    };

    const response = await GET(buildRequest("note-db-1"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "auth_required" });
  });

  test("rejects missing noteId", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const response = await GET(buildRequest());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_note_context_fields",
    });
  });

  test("returns note_not_found for missing or unowned notes", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({ noteRow: null });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("foreign-note"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "note_not_found" });

    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_notes:id:foreign-note");
  });

  test("returns sanitized bounded owner-scoped note context", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      noteRow: {
        ...baseNoteRow,
        insight: "A".repeat(1300),
        tags: [
          "one",
          "two",
          "three",
          "four",
          "five",
          "six",
          "seven",
          "eight",
          "nine",
        ],
      },
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("note-db-1"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context).toMatchObject({
      source: "commonplace",
      noteId: "note-db-1",
      shortcode: "#wn1",
      title: "Institutions and Growth",
      sourceBook: "Why Nations Fail",
    });
    expect(data.context.insight).toHaveLength(1203);
    expect(data.context.insight.endsWith("...")).toBe(true);
    expect(data.context.tags).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
    ]);

    const serialized = JSON.stringify(data.context);
    expect(serialized).not.toContain("owner");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("auth");
    expect(serialized).not.toContain("client");
    expect(serialized).not.toContain("quote");
    expect(serialized).not.toContain("connections");
    expect(serialized).not.toContain("relevance");
    expect(serialized).not.toContain("created");
    expect(serialized).not.toContain("updated");
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_notes:id:note-db-1");
  });

  test("Supabase failures return a safe route error", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      noteError: new Error("raw database failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("note-db-1"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "note_context_fetch_failed",
    });
  });
});
