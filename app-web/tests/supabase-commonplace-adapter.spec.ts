import { expect, test } from "@playwright/test";
import {
  createCommonplaceNote,
  deleteCommonplaceNote,
  generateCommonplaceShortcode,
  getCommonplaceNoteById,
  getCommonplaceNoteByShortcode,
  listCommonplaceNotes,
  normalizeCommonplaceConnections,
  normalizeCommonplaceTags,
  updateCommonplaceNote,
  type CommonplaceNoteRow,
  type CreateCommonplaceNoteInput,
} from "../src/app/lib/storage/supabase-commonplace-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const baseRow: CommonplaceNoteRow = {
  id: "note-db-1",
  owner_id: "user_123",
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
  counterRows?: Array<{ owner_id: string; prefix: string; last_value: number } | null>;
  counterReadError?: Error | null;
  counterWriteError?: Error | null;
  noteInsertError?: Error | null;
  noteUpdateError?: Error | null;
  noteReadError?: Error | null;
  noteDeleteError?: Error | null;
  noteRow?: CommonplaceNoteRow | null;
  listRows?: CommonplaceNoteRow[] | null;
};

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  const counterRows = [...(options.counterRows ?? [null])];

  function buildQuery(table: string) {
    let operation = "";
    let payload: unknown = null;
    const filters: string[] = [];

    const responseForAwait = () => {
      if (table === "commonplace_shortcode_counters") {
        if (options.counterWriteError) {
          return { data: null, error: options.counterWriteError };
        }
        return { data: null, error: null };
      }

      if (operation === "delete") {
        return { data: null, error: options.noteDeleteError ?? null };
      }

      return { data: null, error: null };
    };

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
        filters.push(`${column}:${value}`);
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      order(column: string, optionsArg: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${optionsArg.ascending}`);
        return Promise.resolve({
          data: options.listRows ?? [],
          error: options.noteReadError ?? null,
        });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_shortcode_counters") {
          return Promise.resolve({
            data: counterRows.shift() ?? null,
            error: options.counterReadError ?? null,
          });
        }

        if (operation === "update") {
          return Promise.resolve({
            data:
              options.noteRow !== undefined
                ? options.noteRow
                : {
                    ...baseRow,
                    ...(payload as Record<string, unknown>),
                  },
            error: options.noteUpdateError ?? null,
          });
        }

        return Promise.resolve({
          data: options.noteRow !== undefined ? options.noteRow : baseRow,
          error: options.noteReadError ?? null,
        });
      },
      single() {
        calls.push(`single:${table}`);
        if (table === "commonplace_notes" && operation === "insert") {
          return Promise.resolve({
            data:
              options.noteRow !== undefined
                ? options.noteRow
                : {
                    ...baseRow,
                    ...(payload as Record<string, unknown>),
                  },
            error: options.noteInsertError ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        return Promise.resolve(responseForAwait()).then(onfulfilled);
      },
    };

    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return buildQuery(table);
    },
  } as unknown as FonetikSupabaseClient;

  return { client, calls, inserted, updated };
}

test.describe("Supabase Commonplace notes adapter", () => {
  test("create note with only ownerId and insight", async () => {
    const mock = createMockSupabaseClient();

    const result = await createCommonplaceNote(
      { ownerId: "user_123", insight: "A compact idea." },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.shortcode).toBe("#us1");
    expect(mock.inserted.commonplace_notes[0]).toEqual({
      owner_id: "user_123",
      client_id: null,
      source_book: "Untitled Source",
      source_page: null,
      title: null,
      quote: null,
      insight: "A compact idea.",
      tags: [],
      connections: [],
      relevance: null,
      shortcode: "#us1",
    });
  });

  test("create note with full fields", async () => {
    const mock = createMockSupabaseClient();
    const input: CreateCommonplaceNoteInput = {
      ownerId: "user_123",
      clientId: "client-note-1",
      sourceBook: "The Myth of Sisyphus",
      sourcePage: "p. 42",
      title: "Absurd freedom",
      quote: "One must imagine Sisyphus happy.",
      insight: "Meaning can be made without final certainty.",
      tags: ["Philosophy", "#Existentialism"],
      connections: ["#msm1", "bad", "#wn1"],
      relevance: "Useful for discussing resilience.",
    };

    const result = await createCommonplaceNote(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.inserted.commonplace_notes[0]).toEqual({
      owner_id: "user_123",
      client_id: "client-note-1",
      source_book: "The Myth of Sisyphus",
      source_page: "p. 42",
      title: "Absurd freedom",
      quote: "One must imagine Sisyphus happy.",
      insight: "Meaning can be made without final certainty.",
      tags: ["philosophy", "existentialism"],
      connections: ["#msm1", "#wn1"],
      relevance: "Useful for discussing resilience.",
      shortcode: "#tms1",
    });
  });

  test("blank source_book stores Untitled Source", async () => {
    const mock = createMockSupabaseClient();

    await createCommonplaceNote(
      { ownerId: "user_123", sourceBook: "   ", insight: "Keep this." },
      mock.client,
    );

    expect(mock.inserted.commonplace_notes[0]).toMatchObject({
      source_book: "Untitled Source",
      shortcode: "#us1",
    });
  });

  test("generates shortcode #wn1 from Why Nations Fail", () => {
    expect(generateCommonplaceShortcode("Why Nations Fail", 1)).toBe("#wn1");
  });

  test("generates shortcode #msm1 from Man's Search for Meaning", () => {
    expect(generateCommonplaceShortcode("Man's Search for Meaning", 1)).toBe(
      "#msm1",
    );
  });

  test("uses counter table and does not use count-existing-notes strategy", async () => {
    const mock = createMockSupabaseClient();

    await createCommonplaceNote(
      { ownerId: "user_123", sourceBook: "Why Nations Fail", insight: "Idea." },
      mock.client,
    );

    expect(mock.calls).toContain("from:commonplace_shortcode_counters");
    expect(mock.calls).toContain("insert:commonplace_shortcode_counters");
    expect(mock.calls).not.toContain("select:commonplace_notes:count");
  });

  test("next note increments shortcode from counter", async () => {
    const mock = createMockSupabaseClient({
      counterRows: [{ owner_id: "user_123", prefix: "wn", last_value: 1 }],
    });

    const result = await createCommonplaceNote(
      { ownerId: "user_123", sourceBook: "Why Nations Fail", insight: "Idea." },
      mock.client,
    );

    expect(result.ok).toBe(true);
    expect(mock.updated.commonplace_shortcode_counters[0]).toEqual({
      last_value: 2,
    });
    expect(mock.inserted.commonplace_notes[0]).toMatchObject({
      shortcode: "#wn2",
    });
  });

  test("update note does not change shortcode", async () => {
    const mock = createMockSupabaseClient({
      noteRow: { ...baseRow, insight: "Updated.", shortcode: "#wn1" },
    });

    const result = await updateCommonplaceNote(
      {
        ownerId: "user_123",
        noteId: "note-db-1",
        insight: "Updated.",
        shortcode: "#bad999",
      } as unknown as Parameters<typeof updateCommonplaceNote>[0],
      mock.client,
    );

    expect(result.ok).toBe(true);
    expect(mock.updated.commonplace_notes[0]).toEqual({ insight: "Updated." });
  });

  test("list notes filters by owner_id", async () => {
    const mock = createMockSupabaseClient({ listRows: [baseRow] });

    const result = await listCommonplaceNotes("user_123", mock.client);

    expect(result.ok).toBe(true);
    expect(mock.calls).toEqual([
      "from:commonplace_notes",
      "select:commonplace_notes:*",
      "eq:commonplace_notes:owner_id:user_123",
      "order:commonplace_notes:created_at:false",
    ]);
  });

  test("get by id filters by owner_id", async () => {
    const mock = createMockSupabaseClient();

    await getCommonplaceNoteById("user_123", "note-db-1", mock.client);

    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_notes:id:note-db-1");
  });

  test("get by shortcode filters by owner_id", async () => {
    const mock = createMockSupabaseClient();

    await getCommonplaceNoteByShortcode("user_123", "#wn1", mock.client);

    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_notes:shortcode:#wn1");
  });

  test("delete filters by owner_id", async () => {
    const mock = createMockSupabaseClient();

    const result = await deleteCommonplaceNote(
      "user_123",
      "note-db-1",
      mock.client,
    );

    expect(result).toEqual({ ok: true });
    expect(mock.calls).toEqual([
      "from:commonplace_notes",
      "delete:commonplace_notes",
      "eq:commonplace_notes:owner_id:user_123",
      "eq:commonplace_notes:id:note-db-1",
    ]);
  });

  test("missing ownerId fails before Supabase call", async () => {
    const mock = createMockSupabaseClient();

    const result = await createCommonplaceNote(
      { ownerId: " ", insight: "Idea." },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  test("blank insight fails before Supabase call", async () => {
    const mock = createMockSupabaseClient();

    const result = await createCommonplaceNote(
      { ownerId: "user_123", insight: "   " },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  test("tags normalize safely", () => {
    expect(
      normalizeCommonplaceTags([
        "  #Philosophy ",
        "PHILOSOPHY",
        "",
        "#Long".repeat(20),
        "#Learning",
      ]),
    ).toEqual(["philosophy", "learning"]);
  });

  test("connections normalize safely", () => {
    expect(
      normalizeCommonplaceConnections([
        " #wn1 ",
        "wn2",
        "#wn1",
        "#msm1",
        " ",
      ]),
    ).toEqual(["#wn1", "#msm1"]);
  });

  test("Supabase insert failure returns safe error", async () => {
    const mock = createMockSupabaseClient({
      noteInsertError: new Error("relation commonplace_notes is unavailable"),
    });

    const result = await createCommonplaceNote(
      { ownerId: "user_123", insight: "Idea." },
      mock.client,
    );

    expect(result).toEqual({ ok: false, error: "commonplace_save_failed" });
  });

  test("counter failure returns safe error", async () => {
    const mock = createMockSupabaseClient({
      counterWriteError: new Error("duplicate key conflict"),
    });

    const result = await createCommonplaceNote(
      { ownerId: "user_123", insight: "Idea." },
      mock.client,
    );

    expect(result).toEqual({ ok: false, error: "commonplace_save_failed" });
    expect(mock.calls).not.toContain("from:commonplace_notes");
  });

  test("not found returns safe not_found", async () => {
    const mock = createMockSupabaseClient({ noteRow: null });

    const result = await getCommonplaceNoteById(
      "user_123",
      "missing-note",
      mock.client,
    );

    expect(result).toEqual({ ok: false, error: "commonplace_not_found" });
  });

  test("forbidden fields are not mapped or stored", async () => {
    const mock = createMockSupabaseClient();
    const payload = {
      ownerId: "user_123",
      insight: "Allowed idea.",
      api_key: "secret",
      raw_provider_payload: {},
      audio: "audio",
      audio_blob: "blob",
      recording_url: "https://example.com/recording.wav",
      stt_payload: {},
      tts_payload: {},
      auth_metadata: {},
    } as unknown as CreateCommonplaceNoteInput;

    await createCommonplaceNote(payload, mock.client);

    const inserted = mock.inserted.commonplace_notes[0] as Record<
      string,
      unknown
    >;
    for (const forbiddenField of [
      "api_key",
      "raw_provider_payload",
      "audio",
      "audio_blob",
      "recording_url",
      "stt_payload",
      "tts_payload",
      "auth_metadata",
    ]) {
      expect(inserted[forbiddenField]).toBeUndefined();
    }
  });
});
