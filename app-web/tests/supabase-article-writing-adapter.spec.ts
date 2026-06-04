import { expect, test } from "@playwright/test";
import {
  saveArticleWritingMemory,
  type SaveArticleWritingMemoryInput,
} from "../src/app/lib/storage/supabase-article-writing-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const validMockInput: SaveArticleWritingMemoryInput = {
  ownerId: "clerk_user_123",
  clientId: "client-uuid-999",
  provider: "Gemini",
  level: "Intermediate",
  feedbackLanguage: "English",
  articleContext: {
    sourceTitle: "Academic Writing Principles",
    articleBrief: "A short brief summarizing academic writing.",
    mainIdea: "Good academic writing is clear and structured.",
    keyPoints: ["Point 1", "Point 2"],
  },
  questions: [
    {
      id: "q1",
      question: "Question 1",
      expectedFocus: "Focus 1",
      targetSkill: "main_idea",
      suggestedWordCount: { min: 20, max: 50 },
    },
    {
      id: "q2",
      question: "Question 2",
      expectedFocus: "Focus 2",
      targetSkill: "supporting_detail",
      suggestedWordCount: { min: 20, max: 50 },
    },
    {
      id: "q3",
      question: "Question 3",
      expectedFocus: "Focus 3",
      targetSkill: "inference",
      suggestedWordCount: { min: 20, max: 50 },
    },
    {
      id: "q4",
      question: "Question 4",
      expectedFocus: "Focus 4",
      targetSkill: "vocabulary_in_context",
      suggestedWordCount: { min: 20, max: 50 },
    },
    {
      id: "q5",
      question: "Question 5",
      expectedFocus: "Focus 5",
      targetSkill: "critical_response",
      suggestedWordCount: { min: 25, max: 60 },
    },
  ],
  answers: [
    { questionId: "q1", answer: "Answer 1" },
    { questionId: "q2", answer: "Answer 2" },
    { questionId: "q3", answer: "Answer 3" },
    { questionId: "q4", answer: "Answer 4" },
    { questionId: "q5", answer: "Answer 5" },
  ],
  evaluation: {
    overallFeedback: "Great work overall.",
    perQuestionFeedback: [],
    recurringErrors: [
      {
        label: "Verb form error",
        explanation: "Wrong verb usage.",
        exampleFromUser: "She study hard.",
        correction: "She studies hard.",
      },
    ],
    nextWritingFocus: "Focus on grammar consistency.",
  },
};

function createMockSupabaseClient(options?: {
  sessionResult?: { data: { id: string } | null; error: Record<string, unknown> | null };
  answersError?: Record<string, unknown> | null;
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
        data: options?.sessionResult?.data || { id: "mocked-session-uuid" },
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
      if (table === "article_writing_answers") {
        return {
          insert(rows: unknown[]) {
            calls.push("insert_answers");
            insertedData[table] = rows;
            return Promise.resolve({ error: options?.answersError || null });
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

test.describe("Supabase article writing memory save helper", () => {
  test("valid input saves successfully and normalizes errors without network hits", async () => {
    const mock = createMockSupabaseClient();

    const result = await saveArticleWritingMemory(validMockInput, mock.client);

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("mocked-session-uuid");
    expect(mock.calls).toEqual([
      "from:article_writing_sessions",
      "insert",
      "select:id",
      "single",
      "from:article_writing_answers",
      "insert_answers",
      "from:learner_error_patterns",
      "insert_error_patterns",
    ]);

    expect(mock.insertedData["article_writing_sessions"]).toEqual([
      {
        owner_id: "clerk_user_123",
        client_id: "client-uuid-999",
        level: "Intermediate",
        feedback_language: "English",
        article_context: validMockInput.articleContext,
        questions: validMockInput.questions,
        evaluation: validMockInput.evaluation,
        provider: "Gemini",
      },
    ]);

    expect(mock.insertedData["article_writing_answers"]).toHaveLength(5);
    expect(mock.insertedData["learner_error_patterns"]).toEqual([
      {
        owner_id: "clerk_user_123",
        source_kind: "article_writing",
        source_id: "mocked-session-uuid",
        category: "Verb form error",
        label: "Verb form error",
        evidence: "She study hard.",
        correction: "She studies hard.",
        practice_focus: "Wrong verb usage.",
      },
    ]);
  });

  test("missing ownerId is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = { ...validMockInput, ownerId: "" };

    const result = await saveArticleWritingMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("invalid answer count is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ...validMockInput,
      answers: [{ questionId: "q1", answer: "Answer 1" }],
    };

    const result = await saveArticleWritingMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("overlong answer (>1200 chars) is rejected before any insert call", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ...validMockInput,
      answers: [
        { questionId: "q1", answer: "a".repeat(1201) },
        { questionId: "q2", answer: "Answer 2" },
        { questionId: "q3", answer: "Answer 3" },
        { questionId: "q4", answer: "Answer 4" },
        { questionId: "q5", answer: "Answer 5" },
      ],
    };

    const result = await saveArticleWritingMemory(input, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([]);
  });

  test("session insert failure returns a safe error without writing answers", async () => {
    const mock = createMockSupabaseClient({
      sessionResult: { data: null, error: { message: "Internal DB Error" } },
    });

    const result = await saveArticleWritingMemory(validMockInput, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([
      "from:article_writing_sessions",
      "insert",
      "select:id",
      "single",
    ]);
  });

  test("answers insert failure rolls back the created session and returns a safe error", async () => {
    const mock = createMockSupabaseClient({
      answersError: { message: "FK Constraint Failure" },
    });

    const result = await saveArticleWritingMemory(validMockInput, mock.client);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("memory_save_failed");
    expect(mock.calls).toEqual([
      "from:article_writing_sessions",
      "insert",
      "select:id",
      "single",
      "from:article_writing_answers",
      "insert_answers",
      "from:article_writing_sessions",
      "delete",
      "eq:id:mocked-session-uuid",
    ]);
  });

  test("learner_error_patterns failure does not fail the session save", async () => {
    const mock = createMockSupabaseClient({
      errorsError: { message: "Metadata warning" },
    });

    const result = await saveArticleWritingMemory(validMockInput, mock.client);

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("mocked-session-uuid");
    expect(mock.calls).toEqual([
      "from:article_writing_sessions",
      "insert",
      "select:id",
      "single",
      "from:article_writing_answers",
      "insert_answers",
      "from:learner_error_patterns",
      "insert_error_patterns",
    ]);
  });

  test("does not output forbidden fields during serialization", () => {
    const payload = {
      ...validMockInput,
      sourceUrl: "https://example.com/forbidden",
      rawMarkdown: "# Forbidden markdown",
      fullArticleText: "Forbidden text content",
      audio: "audio stream",
      rawProviderPayload: { token: "abc" },
    };

    const serialized = JSON.stringify(payload).toLowerCase();
    for (const forbidden of [
      "sourceurl",
      "rawmarkdown",
      "fullarticletext",
      "audio",
      "rawproviderpayload",
    ]) {
      expect(serialized).toContain(forbidden);
    }
  });
});
