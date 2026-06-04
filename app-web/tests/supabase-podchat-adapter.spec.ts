import { expect, test } from "@playwright/test";
import {
  savePodchatMemory,
  type SavePodchatMemoryInput,
} from "../src/app/lib/storage/supabase-podchat-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const validMockInput: SavePodchatMemoryInput = {
  ownerId: "clerk_user_123",
  clientId: "client-uuid-999",
  provider: "Gemini",
  topic: "Economics",
  difficulty: "Intermediate",
  articleContext: {
    articleTitle: "Economics of Scale",
    articleBrief: "A brief about scale economies.",
    mainIdea: "Bigger can be cheaper.",
    keyPoints: ["Key point 1", "Key point 2"],
    speakingTaskTitle: "Speaking Task 1",
    speakingTaskInstruction: "Speak about scale economies.",
    targetStructure: ["Structure 1"],
    sourceDomain: "Economics Domain",
  },
  durationSeconds: 120,
  elapsedSeconds: 115,
  turns: [
    { speaker: "host", text: "Welcome to podchat. What is scale economies?" },
    { speaker: "learner", text: "It is about producing more at a lower unit cost." },
  ],
  evaluation: {
    summary: "Good understanding of Economics of Scale.",
    corrections: [
      {
        original: "It about producing more.",
        improved: "It is about producing more.",
        explanation: "Missing verb 'is'.",
      },
    ],
    betterSentences: ["It is about producing more at a lower unit cost."],
    vocabularySuggestions: [
      {
        originalOrBasic: "producing more",
        suggestion: "scaling up production",
        example: "Scaling up production helps decrease unit costs.",
      },
    ],
    recurringErrors: [
      {
        label: "Grammar mistake",
        evidence: "It about producing more.",
        practiceFocus: "Remember to use auxiliary verbs.",
      },
    ],
    nextPracticeFocus: "Focus on using advanced vocabulary.",
  },
};

function createMockSupabaseClient(options?: {
  sessionResult?: { data: { id: string } | null; error: Record<string, unknown> | null };
  turnsError?: Record<string, unknown> | null;
  errorsError?: Record<string, unknown> | null;
}) {
  const calls: string[] = [];
  const insertedData: Record<string, unknown[]> = {};

  const queryBuilder = {
    insert(rowOrRows: unknown) {
      calls.push("insert");
      const table = calls[calls.length - 2]?.split(":")[1] || "";
      if (table) {
        insertedData[table] = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      }
      return queryBuilder;
    },
    select(columns?: string) {
      calls.push(`select:${columns || "*"}`);
      return queryBuilder;
    },
    single() {
      calls.push("single");
      if (options?.sessionResult?.error) {
        return Promise.resolve({ data: null, error: options.sessionResult.error });
      }
      return Promise.resolve({
        data: options?.sessionResult?.data || { id: "mocked-podchat-session-uuid" },
        error: null,
      });
    },
    delete() {
      calls.push("delete");
      return queryBuilder;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return Promise.resolve({ error: null });
    },
  };

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      if (table === "podchat_turns") {
        return {
          insert(rows: unknown[]) {
            calls.push("insert_turns");
            insertedData[table] = rows;
            return Promise.resolve({ error: options?.turnsError || null });
          },
        };
      }
      if (table === "learner_error_patterns") {
        return {
          insert(rows: unknown[]) {
            calls.push("insert_error_patterns");
            insertedData[table] = rows;
            return Promise.resolve({ error: options?.errorsError || null });
          },
        };
      }
      return queryBuilder;
    },
  } as unknown as FonetikSupabaseClient;

  return { client, calls, insertedData };
}

test.describe("Supabase podchat memory save helper", () => {
  test("valid input saves successfully and normalizes errors without network hits", async () => {
    const mock = createMockSupabaseClient();

    const result = await savePodchatMemory(validMockInput, mock.client);

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("mocked-podchat-session-uuid");
    expect(mock.calls).toEqual([
      "from:podchat_sessions",
      "insert",
      "select:id",
      "single",
      "from:podchat_turns",
      "insert_turns",
      "from:learner_error_patterns",
      "insert_error_patterns",
    ]);

    expect(mock.insertedData["podchat_sessions"]).toEqual([
      {
        owner_id: "clerk_user_123",
        client_id: "client-uuid-999",
        topic: "Economics",
        difficulty: "Intermediate",
        article_context: {
          articleTitle: "Economics of Scale",
          articleBrief: "A brief about scale economies.",
          mainIdea: "Bigger can be cheaper.",
          keyPoints: ["Key point 1", "Key point 2"],
          speakingTaskTitle: "Speaking Task 1",
          speakingTaskInstruction: "Speak about scale economies.",
          targetStructure: ["Structure 1"],
          sourceDomain: "Economics Domain",
        },
        duration_seconds: 120,
        elapsed_seconds: 115,
        evaluation: {
          summary: "Good understanding of Economics of Scale.",
          corrections: [
            {
              original: "It about producing more.",
              improved: "It is about producing more.",
              explanation: "Missing verb 'is'.",
            },
          ],
          betterSentences: ["It is about producing more at a lower unit cost."],
          vocabularySuggestions: [
            {
              originalOrBasic: "producing more",
              suggestion: "scaling up production",
              example: "Scaling up production helps decrease unit costs.",
            },
          ],
          recurringErrors: [
            {
              label: "Grammar mistake",
              evidence: "It about producing more.",
              practiceFocus: "Remember to use auxiliary verbs.",
            },
          ],
          nextPracticeFocus: "Focus on using advanced vocabulary.",
        },
        provider: "Gemini",
      },
    ]);

    expect(mock.insertedData["podchat_turns"]).toEqual([
      {
        session_id: "mocked-podchat-session-uuid",
        owner_id: "clerk_user_123",
        turn_index: 0,
        speaker: "host",
        text: "Welcome to podchat. What is scale economies?",
      },
      {
        session_id: "mocked-podchat-session-uuid",
        owner_id: "clerk_user_123",
        turn_index: 1,
        speaker: "learner",
        text: "It is about producing more at a lower unit cost.",
      },
    ]);

    expect(mock.insertedData["learner_error_patterns"]).toEqual([
      {
        owner_id: "clerk_user_123",
        source_kind: "podchat",
        source_id: "mocked-podchat-session-uuid",
        category: "Grammar mistake",
        label: "Grammar mistake",
        evidence: "It about producing more.",
        correction: null,
        practice_focus: "Remember to use auxiliary verbs.",
      },
    ]);
  });

  test("missing ownerId is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = { ...validMockInput, ownerId: "" };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("invalid topic is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = { ...validMockInput, topic: "History" as unknown as "Economics" };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("invalid difficulty is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = { ...validMockInput, difficulty: "Expert" as unknown as "Beginner" };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("missing learner turn is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ...validMockInput,
      turns: [{ speaker: "host" as const, text: "Hello" }],
    };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("missing host turn is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ...validMockInput,
      turns: [{ speaker: "learner" as const, text: "Hello" }],
    };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("empty turn text is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ...validMockInput,
      turns: [
        { speaker: "host" as const, text: "   " },
        { speaker: "learner" as const, text: "Hi" },
      ],
    };

    const result = await savePodchatMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("session insert failure returns a safe error without writing turns", async () => {
    const mock = createMockSupabaseClient({
      sessionResult: { data: null, error: { message: "Internal DB Error" } },
    });

    const result = await savePodchatMemory(validMockInput, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([
      "from:podchat_sessions",
      "insert",
      "select:id",
      "single",
    ]);
  });

  test("turns insert failure rolls back the created session and returns a safe error", async () => {
    const mock = createMockSupabaseClient({
      turnsError: { message: "FK Constraint Failure" },
    });

    const result = await savePodchatMemory(validMockInput, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([
      "from:podchat_sessions",
      "insert",
      "select:id",
      "single",
      "from:podchat_turns",
      "insert_turns",
      "from:podchat_sessions",
      "delete",
      "eq:id:mocked-podchat-session-uuid",
    ]);
  });

  test("learner_error_patterns failure does not fail the session save", async () => {
    const mock = createMockSupabaseClient({
      errorsError: { message: "Metadata warning" },
    });

    const result = await savePodchatMemory(validMockInput, mock.client);

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("mocked-podchat-session-uuid");
    expect(mock.calls).toEqual([
      "from:podchat_sessions",
      "insert",
      "select:id",
      "single",
      "from:podchat_turns",
      "insert_turns",
      "from:learner_error_patterns",
      "insert_error_patterns",
    ]);
  });

  test("does not store forbidden fields", async () => {
    const payload = {
      ...validMockInput,
      audio: "audio data",
      recordingUrl: "https://example.com/audio.wav",
      sourceUrl: "https://example.com",
      rawMarkdown: "# markdown",
      fullArticleText: "full text",
      rawProviderPayload: {},
      phonemes: [],
    } as unknown as SavePodchatMemoryInput;

    const mock = createMockSupabaseClient();
    const result = await savePodchatMemory(payload, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.insertedData["podchat_sessions"]).toBeDefined();
    
    const insertedSession = mock.insertedData["podchat_sessions"][0] as Record<string, unknown>;
    
    // Explicitly verify the inserted fields in podchat_sessions
    expect(insertedSession.audio).toBeUndefined();
    expect(insertedSession.recordingUrl).toBeUndefined();
    expect(insertedSession.sourceUrl).toBeUndefined();
    expect(insertedSession.rawMarkdown).toBeUndefined();
    expect(insertedSession.fullArticleText).toBeUndefined();
    expect(insertedSession.rawProviderPayload).toBeUndefined();
    expect(insertedSession.phonemes).toBeUndefined();
  });
});
