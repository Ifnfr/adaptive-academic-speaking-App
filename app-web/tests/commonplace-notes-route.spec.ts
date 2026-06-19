import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import { DELETE, GET, PATCH, POST } from "../src/app/api/commonplace/notes/route";
import { testHooks } from "../src/app/api/commonplace/notes/route-test-hooks";
import type { CommonplaceNoteRow } from "../src/app/lib/storage/supabase-commonplace-adapter";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const baseRow: CommonplaceNoteRow = {
  id: "note-db-1",
  owner_id: "server-user-123",
  client_id: null,
  shortcode: "#wn1",
  source_book: "Why Nations Fail",
  source_page: null,
  title: null,
  quote: null,
  insight: "Institutions shape incentives.",
  tags: [],
  connections: [],
  relevance: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

type MockOptions = {
  counterRow?: { owner_id: string; prefix: string; last_value: number } | null;
  counterReadError?: Error | null;
  counterWriteError?: Error | null;
  noteInsertError?: Error | null;
  noteListError?: Error | null;
  noteRows?: CommonplaceNoteRow[];
};

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  let counterReadUsed = false;

  function buildQuery(table: string) {
    let operation = "";
    let payload: unknown = null;
    const filters: Array<{ column: string; value: string }> = [];

    const query = {
      insert(row: unknown) {
        operation = "insert";
        payload = row;
        calls.push(`insert:${table}`);
        inserted[table] = Array.isArray(row) ? row : [row];
        return query;
      },
      update(row: unknown) {
        operation = "update";
        payload = row;
        calls.push(`update:${table}`);
        updated[table] = [row];
        return query;
      },
      delete() {
        operation = "delete";
        calls.push(`delete:${table}`);
        return query;
      },
      select(columns: string) {
        calls.push(`select:${table}:${columns}`);
        return query;
      },
      eq(column: string, value: string) {
        calls.push(`eq:${table}:${column}:${value}`);
        filters.push({ column, value });
        return query;
      },
      order(column: string, orderOptions: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${orderOptions.ascending ? "asc" : "desc"}`);
        if (table === "commonplace_notes" && operation === "") {
          const rows = (options.noteRows ?? [baseRow]).filter((row) =>
            filters.every(
              (filter) =>
                (row as unknown as Record<string, unknown>)[filter.column] ===
                filter.value,
            ),
          );
          return Promise.resolve({
            data: rows,
            error: options.noteListError ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_shortcode_counters") {
          counterReadUsed = true;
          return Promise.resolve({
            data: options.counterRow ?? null,
            error: options.counterReadError ?? null,
          });
        }

        if (table === "commonplace_notes" && operation === "update") {
          return Promise.resolve({
            data: payload ? { ...baseRow, ...(payload as Record<string, unknown>) } : null,
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      },
      single() {
        calls.push(`single:${table}`);
        if (table === "commonplace_notes" && operation === "insert") {
          return Promise.resolve({
            data:
              options.noteInsertError || !payload
                ? null
                : { ...baseRow, ...(payload as Record<string, unknown>) },
            error: options.noteInsertError ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        if (
          table === "commonplace_shortcode_counters" &&
          (operation === "insert" || operation === "update")
        ) {
          return Promise.resolve({
            data: null,
            error: options.counterWriteError ?? null,
          }).then(onfulfilled);
        }
        return Promise.resolve({ data: null, error: null }).then(onfulfilled);
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

  return { client, calls, inserted, updated, get counterReadUsed() { return counterReadUsed; } };
}

test.describe("Commonplace notes route", () => {
  test.afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }

    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated note save returns safe auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    let clientCreated = false;
    testHooks.getSupabaseClient = () => {
      clientCreated = true;
      return {};
    };

    const response = await POST(buildRequest({ insight: "Idea." }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "auth_required" });
    expect(clientCreated).toBe(false);
  });

  test("unauthenticated note list returns safe auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    let clientCreated = false;
    testHooks.getSupabaseClient = () => {
      clientCreated = true;
      return {};
    };

    const response = await GET();
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "auth_required" });
    expect(clientCreated).toBe(false);
  });

  test("missing required fields returns safe invalid_note_fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(buildRequest({ sourceBook: "Why Nations Fail" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "invalid_note_fields" });
    expect(mock.calls).toEqual([]);
  });

  test("GET returns owner-scoped notes", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const otherUserRow: CommonplaceNoteRow = {
      ...baseRow,
      id: "note-other-user",
      owner_id: "other-user-456",
      shortcode: "#ou1",
      source_book: "Other Source",
      insight: "This should not be returned.",
    };
    const mock = createMockSupabaseClient({
      noteRows: [baseRow, otherUserRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET();
    const data = (await response.json()) as {
      notes: Array<{ id: string; ownerId: string; shortcode: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0]).toMatchObject({
      id: "note-db-1",
      ownerId: "server-user-123",
      shortcode: "#wn1",
    });
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:server-user-123");
    expect(JSON.stringify(data)).not.toContain("other-user-456");
  });

  test("GET read failure returns safe note_save_failed without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      noteListError: new Error("raw Supabase read failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET();
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "note_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase read failure");
  });

  test("valid note save derives ownerId from Clerk auth and ignores request owner_id", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest({
        owner_id: "attacker-user",
        ownerId: "attacker-user",
        sourceBook: "Why Nations Fail",
        insight: "Institutions shape incentives.",
      }),
    );
    const data = (await response.json()) as { note: { ownerId: string; shortcode: string } };

    expect(response.status).toBe(201);
    expect(data.note.ownerId).toBe("server-user-123");
    expect(data.note.shortcode).toBe("#wn1");
    expect(mock.inserted.commonplace_notes[0]).toMatchObject({
      owner_id: "server-user-123",
      shortcode: "#wn1",
    });
    expect(JSON.stringify(mock.inserted.commonplace_notes[0])).not.toContain(
      "attacker-user",
    );
  });

  test("shortcode reservation increments existing counter", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      counterRow: { owner_id: "server-user-123", prefix: "wn", last_value: 2 },
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest({
        sourceBook: "Why Nations Fail",
        insight: "New idea.",
      }),
    );
    const data = (await response.json()) as { note: { shortcode: string } };

    expect(response.status).toBe(201);
    expect(mock.counterReadUsed).toBe(true);
    expect(mock.updated.commonplace_shortcode_counters[0]).toEqual({
      last_value: 3,
    });
    expect(data.note.shortcode).toBe("#wn3");
  });

  test("valid note update derives ownerId from Clerk auth and ignores request owner_id", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildRequest({
        owner_id: "attacker-user",
        ownerId: "attacker-user",
        noteId: "note-db-1",
        sourceBook: "Why Nations Fail",
        title: "Updated Institutions",
        insight: "Updated incentive idea.",
      }),
    );
    const data = (await response.json()) as { note: { ownerId: string; title: string } };

    expect(response.status).toBe(200);
    expect(data.note.ownerId).toBe("server-user-123");
    expect(data.note.title).toBe("Updated Institutions");
    expect(mock.updated.commonplace_notes[0]).toMatchObject({
      source_book: "Why Nations Fail",
      title: "Updated Institutions",
      insight: "Updated incentive idea.",
    });
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:server-user-123");
    expect(JSON.stringify(mock.updated.commonplace_notes[0])).not.toContain(
      "attacker-user",
    );
  });

  test("valid note delete derives ownerId from Clerk auth", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(buildRequest({ noteId: "note-db-1" }));
    const data = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mock.calls).toContain("delete:commonplace_notes");
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_notes:id:note-db-1");
  });

  test("Supabase failure returns safe note_save_failed without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      noteInsertError: new Error("raw Supabase relation failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest({
        sourceBook: "Why Nations Fail",
        insight: "New idea.",
      }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "note_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase relation failure");
  });

  test("route source does not expose service role key to client paths", () => {
    const routeSource = readFileSync(
      "src/app/api/commonplace/notes/route.ts",
      "utf8",
    );
    const componentSource = readFileSync(
      "src/app/components/CommonplaceView.tsx",
      "utf8",
    );

    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(componentSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(componentSource).toContain("/api/commonplace/notes");
    expect(componentSource).toContain('credentials: "same-origin"');
  });
});
