import { expect, test } from "@playwright/test";
import {
  mapStoredVocabToSupabaseInsert,
  mapStoredSentenceToSupabaseInsert,
  mapStoredCorrectionToSupabaseInsert,
  mapSupabaseRowToStoredVocab,
  mapSupabaseRowToStoredSentence,
  mapSupabaseRowToStoredCorrection,
  upsertVocabItemRow,
  upsertSentenceRows,
  upsertCorrectionRow,
  deleteVocabItemRow,
  type SupabaseVocabItemRow,
  type SupabaseVocabSentenceRow,
  type SupabaseVocabCorrectionRow,
} from "../src/app/lib/storage/supabase-vocab-adapter";
import type { VocabItem, VocabUserSentence, VocabSentenceCorrection } from "../src/app/lib/vocabulary";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const testCorrection: VocabSentenceCorrection = {
  status: "natural",
  explanation: "Correct and natural phrasing.",
  correctedSentence: "This is a correct test sentence.",
  collocationTip: "Try using it with other words.",
  retryInstruction: "Repeat this sentence twice.",
  targetUsageRole: "subject",
  warnings: ["warning 1", "warning 2"],
  checkedAt: "2026-05-27T01:00:00Z",
  providerUsed: "Gemini",
};

const testSentence: VocabUserSentence = {
  id: "sentence-123",
  sentence: "This is a test sentence containing the word target.",
  containsWord: true,
  createdAt: "2026-05-27T00:30:00Z",
  correction: testCorrection,
};

const testItem: VocabItem = {
  version: 1,
  id: "vocab-456",
  word: "target",
  meaning: "An objective or result to be achieved.",
  partOfSpeech: "noun",
  source: "feedback",
  level: "Advanced",
  status: "practicing",
  example: "Our marketing campaign hit its target.",
  collocations: ["achieve a target", "hit a target"],
  userSentences: [testSentence],
  reuseCount: 1,
  correctUseCount: 1,
  lastPracticedAt: "2026-05-27T00:30:00Z",
  createdAt: "2026-05-27T00:00:00Z",
  updatedAt: "2026-05-27T00:30:00Z",
};

function createMockSupabaseClient(responses: Record<string, { data: unknown; error: Error | null }>) {
  const calls: string[] = [];
  const query = {
    upsert(rows: unknown, options: unknown) {
      calls.push(`upsert:${JSON.stringify(rows)}:${JSON.stringify(options)}`);
      return query;
    },
    delete() {
      calls.push("delete");
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    select(columns: string) {
      calls.push(`select:${columns}`);
      return query;
    },
    single() {
      calls.push("single");
      const res = responses[calls[0]] || { data: null, error: null };
      return Promise.resolve(res);
    },
    then(onfulfilled: (value: { data: unknown; error: Error | null }) => unknown) {
      const res = responses[calls[0]] || { data: null, error: null };
      return Promise.resolve(res).then(onfulfilled);
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

test.describe("Supabase vocabulary mappers", () => {
  test("maps VocabItem to Supabase VocabItem Insert structure", () => {
    const insert = mapStoredVocabToSupabaseInsert("user_clerk_123", testItem);

    expect(insert).toEqual({
      owner_id: "user_clerk_123",
      client_id: "vocab-456",
      word: "target",
      meaning: "An objective or result to be achieved.",
      part_of_speech: "noun",
      source: "feedback",
      level: "Advanced",
      status: "practicing",
      example: "Our marketing campaign hit its target.",
      collocations: ["achieve a target", "hit a target"],
      reuse_count: 1,
      correct_use_count: 1,
      last_practiced_at: "2026-05-27T00:30:00Z",
      created_at: "2026-05-27T00:00:00Z",
      updated_at: "2026-05-27T00:30:00Z",
    });
  });

  test("maps VocabUserSentence to Supabase Sentence Insert structure", () => {
    const insert = mapStoredSentenceToSupabaseInsert(
      "user_clerk_123",
      "db-vocab-uuid",
      testSentence,
    );

    expect(insert).toEqual({
      owner_id: "user_clerk_123",
      vocab_item_id: "db-vocab-uuid",
      client_id: "sentence-123",
      sentence: "This is a test sentence containing the word target.",
      contains_word: true,
      created_at: "2026-05-27T00:30:00Z",
    });
  });

  test("maps VocabSentenceCorrection to Supabase Correction Insert structure", () => {
    const insert = mapStoredCorrectionToSupabaseInsert(
      "user_clerk_123",
      "db-sentence-uuid",
      testCorrection,
    );

    expect(insert).toEqual({
      owner_id: "user_clerk_123",
      sentence_id: "db-sentence-uuid",
      status: "natural",
      explanation: "Correct and natural phrasing.",
      corrected_sentence: "This is a correct test sentence.",
      collocation_tip: "Try using it with other words.",
      retry_instruction: "Repeat this sentence twice.",
      target_usage_role: "subject",
      warnings: ["warning 1", "warning 2"],
      provider_used: "Gemini",
      checked_at: "2026-05-27T01:00:00Z",
    });
  });

  test("maps Supabase rows back to stored objects", () => {
    const rowItem: SupabaseVocabItemRow = {
      id: "db-vocab-uuid",
      owner_id: "user_clerk_123",
      client_id: "vocab-456",
      word: "target",
      meaning: "An objective or result to be achieved.",
      part_of_speech: "noun",
      source: "feedback",
      level: "Advanced",
      status: "practicing",
      example: "Our marketing campaign hit its target.",
      collocations: ["achieve a target", "hit a target"],
      reuse_count: 1,
      correct_use_count: 1,
      last_practiced_at: "2026-05-27T00:30:00Z",
      created_at: "2026-05-27T00:00:00Z",
      updated_at: "2026-05-27T00:30:00Z",
    };

    const rowSentence: SupabaseVocabSentenceRow = {
      id: "db-sentence-uuid",
      owner_id: "user_clerk_123",
      vocab_item_id: "db-vocab-uuid",
      client_id: "sentence-123",
      sentence: "This is a test sentence containing the word target.",
      contains_word: true,
      created_at: "2026-05-27T00:30:00Z",
    };

    const rowCorrection: SupabaseVocabCorrectionRow = {
      id: "db-correction-uuid",
      owner_id: "user_clerk_123",
      sentence_id: "db-sentence-uuid",
      status: "natural",
      explanation: "Correct and natural phrasing.",
      corrected_sentence: "This is a correct test sentence.",
      collocation_tip: "Try using it with other words.",
      retry_instruction: "Repeat this sentence twice.",
      target_usage_role: "subject",
      warnings: ["warning 1", "warning 2"],
      provider_used: "Gemini",
      checked_at: "2026-05-27T01:00:00Z",
    };

    const correction = mapSupabaseRowToStoredCorrection(rowCorrection);
    const sentence = mapSupabaseRowToStoredSentence(rowSentence, correction);
    const item = mapSupabaseRowToStoredVocab(rowItem, [sentence]);

    expect(item).toEqual(testItem);
  });
});

test.describe("Supabase adapter operations", () => {
  test("upsertVocabItemRow executes correct queries and returns generated id", async () => {
    const mock = createMockSupabaseClient({
      "from:vocabulary_items": { data: { id: "db-vocab-uuid" }, error: null },
    });

    const dbId = await upsertVocabItemRow("user_123", testItem, mock.client);

    expect(mock.calls).toEqual([
      "from:vocabulary_items",
      `upsert:${JSON.stringify(mapStoredVocabToSupabaseInsert("user_123", testItem))}:${JSON.stringify({ onConflict: "owner_id,client_id" })}`,
      "select:id",
      "single",
    ]);
    expect(dbId).toBe("db-vocab-uuid");
  });

  test("upsertSentenceRows executes correct query and returns mapping of ids", async () => {
    const mock = createMockSupabaseClient({
      "from:vocabulary_sentences": {
        data: [{ id: "db-sentence-uuid", client_id: "sentence-123" }],
        error: null,
      },
    });

    const mapping = await upsertSentenceRows("user_123", "db-vocab-uuid", [testSentence], mock.client);

    expect(mock.calls).toEqual([
      "from:vocabulary_sentences",
      `upsert:${JSON.stringify([mapStoredSentenceToSupabaseInsert("user_123", "db-vocab-uuid", testSentence)])}:${JSON.stringify({ onConflict: "owner_id,client_id" })}`,
      "select:id, client_id",
    ]);
    expect(mapping).toEqual({
      "sentence-123": "db-sentence-uuid",
    });
  });

  test("upsertCorrectionRow executes correction insert query", async () => {
    const mock = createMockSupabaseClient({
      "from:vocabulary_corrections": { data: null, error: null },
    });

    await upsertCorrectionRow("user_123", "db-sentence-uuid", testCorrection, mock.client);

    expect(mock.calls).toEqual([
      "from:vocabulary_corrections",
      `upsert:${JSON.stringify(mapStoredCorrectionToSupabaseInsert("user_123", "db-sentence-uuid", testCorrection))}:${JSON.stringify({ onConflict: "owner_id,sentence_id" })}`,
    ]);
  });

  test("deleteVocabItemRow deletes item by owner_id and client_id", async () => {
    const mock = createMockSupabaseClient({
      "from:vocabulary_items": { data: null, error: null },
    });

    await deleteVocabItemRow("user_123", "vocab-456", mock.client);

    expect(mock.calls).toEqual([
      "from:vocabulary_items",
      "delete",
      "eq:owner_id:user_123",
      "eq:client_id:vocab-456",
    ]);
  });
});
