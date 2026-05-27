import { expect, test } from "@playwright/test";
import {
  addSupabaseSession,
  loadSupabaseSessions,
  mapStoredSessionToSupabaseInsert,
  mapSupabaseRowToStoredSession,
  saveSupabaseSessions,
  type SupabaseSpeakingSessionRow,
} from "../src/app/lib/storage/supabase-session-adapter";
import type { StoredSessionRecord } from "../src/app/lib/storage";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const csvWithEscaping = [
  "Date,Level,Mode,Main_Weakness,Evidence,Next_Target",
  '2026-05-27,Foundation,Quick Practice,"Comma, quote ""inside"", and newline',
  'kept","Evidence, with comma","Try again"',
].join("\n");

const storedSession: StoredSessionRecord = {
  id: "local-session-123",
  date: "2026-05-27",
  level: "Foundation",
  mode: "Quick Practice",
  feedbackType: "Quick Feedback",
  sessionType: "Timed",
  provider: "Claude",
  todayTarget: "Use one clear topic sentence.",
  durationSeconds: 75,
  transcript: "I want to speak with one clear topic sentence.",
  mainWeakness: "Needs clearer sentence control.",
  evidence: "The response has one incomplete idea.",
  betterPhrase: "My main point is clear because I explain one idea.",
  retryTask: "Say one sentence with because.",
  retryTranscript: "My main point is clear because I explain one idea.",
  csv: csvWithEscaping,
};

function createLoadClientMock({
  data,
  error = null,
}: {
  data: SupabaseSpeakingSessionRow[] | null;
  error?: Error | null;
}) {
  const calls: string[] = [];
  const query = {
    select(columns: string) {
      calls.push(`select:${columns}`);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push(`order:${column}:${options.ascending}`);
      return Promise.resolve({ data, error });
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return query;
      },
    } as unknown as FonetikSupabaseClient,
  };
}

function createWriteClientMock(error: Error | null = null) {
  const calls: string[] = [];
  let upsertRows: unknown = null;
  let upsertOptions: unknown = null;

  return {
    calls,
    getUpsertRows: () => upsertRows,
    getUpsertOptions: () => upsertOptions,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          upsert(rows: unknown, options: unknown) {
            calls.push("upsert");
            upsertRows = rows;
            upsertOptions = options;
            return Promise.resolve({ error });
          },
        };
      },
    } as unknown as FonetikSupabaseClient,
  };
}

test.describe("Supabase session adapter mapping", () => {
  test("maps StoredSessionRecord to Supabase insert without mutating CSV", () => {
    const insert = mapStoredSessionToSupabaseInsert(
      "user_clerk_123",
      storedSession,
    );

    expect(insert).toEqual({
      owner_id: "user_clerk_123",
      client_id: "local-session-123",
      date: "2026-05-27",
      level: "Foundation",
      mode: "Quick Practice",
      feedback_type: "Quick Feedback",
      session_type: "Timed",
      provider: "Claude",
      today_target: "Use one clear topic sentence.",
      duration_seconds: 75,
      transcript: "I want to speak with one clear topic sentence.",
      main_weakness: "Needs clearer sentence control.",
      evidence: "The response has one incomplete idea.",
      better_phrase: "My main point is clear because I explain one idea.",
      retry_task: "Say one sentence with because.",
      retry_transcript: "My main point is clear because I explain one idea.",
      csv: csvWithEscaping,
      created_at: "2026-05-27",
    });
  });

  test("maps Supabase row back to StoredSessionRecord and preserves CSV exactly", () => {
    const row: SupabaseSpeakingSessionRow = {
      id: "db-row-uuid",
      owner_id: "user_clerk_123",
      client_id: "local-session-123",
      date: "2026-05-27",
      level: "Foundation",
      mode: "Quick Practice",
      feedback_type: "Quick Feedback",
      session_type: "Timed",
      provider: "Claude",
      today_target: "Use one clear topic sentence.",
      duration_seconds: 75,
      transcript: "I want to speak with one clear topic sentence.",
      main_weakness: "Needs clearer sentence control.",
      evidence: "The response has one incomplete idea.",
      better_phrase: "My main point is clear because I explain one idea.",
      retry_task: "Say one sentence with because.",
      retry_transcript: "My main point is clear because I explain one idea.",
      csv: csvWithEscaping,
      created_at: "2026-05-27T00:00:00.000Z",
    };

    expect(mapSupabaseRowToStoredSession(row)).toEqual(storedSession);
  });

  test("handles nullable Supabase fields safely", () => {
    const row: SupabaseSpeakingSessionRow = {
      id: "db-row-uuid",
      owner_id: "user_clerk_123",
      client_id: "local-session-nullable",
      date: null,
      level: null,
      mode: null,
      feedback_type: null,
      session_type: null,
      provider: null,
      today_target: null,
      duration_seconds: null,
      transcript: null,
      main_weakness: null,
      evidence: null,
      better_phrase: null,
      retry_task: null,
      retry_transcript: null,
      csv: null,
      created_at: "2026-05-27T00:00:00.000Z",
    };

    expect(mapSupabaseRowToStoredSession(row)).toEqual({
      id: "local-session-nullable",
      date: "",
      level: "",
      mode: "",
      feedbackType: "",
      sessionType: "",
      provider: "",
      todayTarget: "",
      durationSeconds: 0,
      transcript: "",
      mainWeakness: "",
      evidence: "",
      betterPhrase: "",
      retryTask: "",
      retryTranscript: "",
      csv: "",
    });
  });
});

test.describe("Supabase session adapter mocked client behavior", () => {
  test("loads sessions with owner filter and created_at descending order", async () => {
    const row: SupabaseSpeakingSessionRow = {
      id: "db-row-uuid",
      owner_id: "user_clerk_123",
      client_id: "local-session-123",
      date: "2026-05-27",
      level: "Foundation",
      mode: "Quick Practice",
      feedback_type: "Quick Feedback",
      session_type: "Timed",
      provider: "Claude",
      today_target: "Use one clear topic sentence.",
      duration_seconds: 75,
      transcript: "I want to speak with one clear topic sentence.",
      main_weakness: "Needs clearer sentence control.",
      evidence: "The response has one incomplete idea.",
      better_phrase: "My main point is clear because I explain one idea.",
      retry_task: "Say one sentence with because.",
      retry_transcript: "My main point is clear because I explain one idea.",
      csv: csvWithEscaping,
      created_at: "2026-05-27T00:00:00.000Z",
    };
    const mock = createLoadClientMock({ data: [row] });

    const sessions = await loadSupabaseSessions(
      "user_clerk_123",
      mock.client,
    );

    expect(mock.calls).toEqual([
      "from:speaking_sessions",
      "select:*",
      "eq:owner_id:user_clerk_123",
      "order:created_at:false",
    ]);
    expect(sessions).toEqual([storedSession]);
  });

  test("loads empty Supabase data as an empty session list", async () => {
    const mock = createLoadClientMock({ data: null });

    await expect(
      loadSupabaseSessions("user_clerk_123", mock.client),
    ).resolves.toEqual([]);
  });

  test("throws the Supabase error returned by load", async () => {
    const error = new Error("load failed");
    const mock = createLoadClientMock({ data: null, error });

    await expect(
      loadSupabaseSessions("user_clerk_123", mock.client),
    ).rejects.toThrow("load failed");
  });

  test("adds one session with owner_id, client_id, CSV, and upsert conflict key", async () => {
    const mock = createWriteClientMock();

    await addSupabaseSession("user_clerk_123", storedSession, mock.client);

    expect(mock.calls).toEqual(["from:speaking_sessions", "upsert"]);
    expect(mock.getUpsertOptions()).toEqual({
      onConflict: "owner_id,client_id",
    });
    expect(mock.getUpsertRows()).toEqual([
      {
        owner_id: "user_clerk_123",
        client_id: "local-session-123",
        date: "2026-05-27",
        level: "Foundation",
        mode: "Quick Practice",
        feedback_type: "Quick Feedback",
        session_type: "Timed",
        provider: "Claude",
        today_target: "Use one clear topic sentence.",
        duration_seconds: 75,
        transcript: "I want to speak with one clear topic sentence.",
        main_weakness: "Needs clearer sentence control.",
        evidence: "The response has one incomplete idea.",
        better_phrase: "My main point is clear because I explain one idea.",
        retry_task: "Say one sentence with because.",
        retry_transcript: "My main point is clear because I explain one idea.",
        csv: csvWithEscaping,
        created_at: "2026-05-27",
      },
    ]);
  });

  test("saves all sessions with owner_id on every row and exact CSV strings", async () => {
    const secondSession: StoredSessionRecord = {
      ...storedSession,
      id: "not-a-uuid-second-session",
      csv: `${csvWithEscaping}\nsecond,row`,
    };
    const mock = createWriteClientMock();

    await saveSupabaseSessions(
      "user_clerk_123",
      [storedSession, secondSession],
      mock.client,
    );

    const rows = mock.getUpsertRows();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner_id: "user_clerk_123",
          client_id: "local-session-123",
          csv: csvWithEscaping,
        }),
        expect.objectContaining({
          owner_id: "user_clerk_123",
          client_id: "not-a-uuid-second-session",
          csv: `${csvWithEscaping}\nsecond,row`,
        }),
      ]),
    );
    expect(mock.getUpsertOptions()).toEqual({
      onConflict: "owner_id,client_id",
    });
  });

  test("does not call Supabase when saving an empty session array", async () => {
    const mock = createWriteClientMock();

    await saveSupabaseSessions("user_clerk_123", [], mock.client);

    expect(mock.calls).toEqual([]);
    expect(mock.getUpsertRows()).toBeNull();
  });

  test("throws the Supabase error returned by save", async () => {
    const mock = createWriteClientMock(new Error("save failed"));

    await expect(
      saveSupabaseSessions("user_clerk_123", [storedSession], mock.client),
    ).rejects.toThrow("save failed");
  });
});
