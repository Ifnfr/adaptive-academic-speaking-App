import { expect, test } from "@playwright/test";
import {
  mapStoredSessionToSupabaseInsert,
  mapSupabaseRowToStoredSession,
  type SupabaseSpeakingSessionRow,
} from "../src/app/lib/storage/supabase-session-adapter";
import type { StoredSessionRecord } from "../src/app/lib/storage";

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
