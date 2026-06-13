import { expect, test } from "@playwright/test";
import {
  writeVocabularyChangesToCloud,
  loadVocabularyFromCloud,
} from "../src/app/lib/storage/vocab-cloud-runtime";
import type { VocabItem, VocabUserSentence, VocabSentenceCorrection } from "../src/app/lib/vocabulary";
import type { SessionCloudAuthState } from "../src/app/lib/storage/session-cloud-runtime";
import type { FonetikSupabaseClient, CreateBrowserSupabaseClientOptions } from "../src/app/lib/supabase";

const testItem: VocabItem = {
  version: 1,
  id: "vocab-1",
  word: "test",
  meaning: "Test meaning",
  partOfSpeech: "noun",
  source: "manual",
  level: "Intermediate",
  status: "new",
  example: "An example",
  collocations: [],
  userSentences: [],
  reuseCount: 0,
  correctUseCount: 0,
  lastPracticedAt: null,
  createdAt: "2026-05-27T00:00:00Z",
  updatedAt: "2026-05-27T00:00:00Z",
};

const testSentence: VocabUserSentence = {
  id: "sentence-1",
  sentence: "This contains test.",
  containsWord: true,
  createdAt: "2026-05-27T00:00:00Z",
  correction: {
    status: "natural",
    explanation: "Natural sentence",
    correctedSentence: "This contains test.",
    collocationTip: "None",
    retryInstruction: "None",
    warnings: [],
    providerUsed: "Gemini",
    checkedAt: "2026-05-27T00:00:00Z",
  },
};

const testItemWithSentence: VocabItem = {
  ...testItem,
  id: "vocab-2",
  userSentences: [testSentence],
};

const signedInAuth: SessionCloudAuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: "user_clerk_123",
  getToken: async () => "clerk-token",
};

function createMocks() {
  const deletedIds: string[] = [];
  const upsertedItems: VocabItem[] = [];
  let upsertSentencesCall: { vocabItemId: string; sentences: VocabUserSentence[] } | null = null;
  let upsertCorrectionCall: { sentenceId: string; correction: VocabSentenceCorrection } | null = null;

  return {
    deletedIds,
    upsertedItems,
    getUpsertSentencesCall: () => upsertSentencesCall,
    getUpsertCorrectionCall: () => upsertCorrectionCall,
    upsertItem: async (ownerId: string, item: VocabItem) => {
      upsertedItems.push(item);
      return `db-vocab-${item.id}`;
    },
    upsertSentences: async (ownerId: string, vocabItemId: string, sentences: VocabUserSentence[]) => {
      upsertSentencesCall = { vocabItemId, sentences };
      const mapping: Record<string, string> = {};
      for (const s of sentences) {
        mapping[s.id] = `db-sentence-${s.id}`;
      }
      return mapping;
    },
    upsertCorrection: async (ownerId: string, sentenceId: string, correction: VocabSentenceCorrection) => {
      upsertCorrectionCall = { sentenceId, correction };
    },
    deleteItem: async (ownerId: string, clientId: string) => {
      deletedIds.push(clientId);
    },
  };
}

test.describe("Vocabulary Cloud Runtime skip checks", () => {
  test("skips when auth loading", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: { isLoaded: false, isSignedIn: false, userId: null, getToken: null },
      previous: [],
      next: [testItem],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "auth-loading" });
    expect(mocks.upsertedItems).toHaveLength(0);
  });

  test("skips when signed out", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: { isLoaded: true, isSignedIn: false, userId: null, getToken: null },
      previous: [],
      next: [testItem],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "signed-out" });
    expect(mocks.upsertedItems).toHaveLength(0);
  });

  test("skips when supabase is not configured", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [],
      next: [testItem],
      isConfigured: () => false,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "supabase-not-configured" });
    expect(mocks.upsertedItems).toHaveLength(0);
  });
});

test.describe("Vocabulary Cloud Runtime difference writes", () => {
  test("detects new items and upserts them", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [],
      next: [testItem],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedItems).toEqual([testItem]);
    expect(mocks.deletedIds).toHaveLength(0);
  });

  test("detects deleted items and deletes them", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [testItem],
      next: [],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.deletedIds).toEqual(["vocab-1"]);
    expect(mocks.upsertedItems).toHaveLength(0);
  });

  test("detects modified items and upserts them", async () => {
    const mocks = createMocks();
    const modifiedItem = { ...testItem, word: "modified-word" };
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [testItem],
      next: [modifiedItem],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedItems).toEqual([modifiedItem]);
    expect(mocks.deletedIds).toHaveLength(0);
  });

  test("chains nested sentences and corrections correctly", async () => {
    const mocks = createMocks();
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [],
      next: [testItemWithSentence],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedItems).toEqual([testItemWithSentence]);
    expect(mocks.getUpsertSentencesCall()).toEqual({
      vocabItemId: "db-vocab-vocab-2",
      sentences: [testSentence],
    });
    expect(mocks.getUpsertCorrectionCall()).toEqual({
      sentenceId: "db-sentence-sentence-1",
      correction: testSentence.correction,
    });
  });

  test("returns failed status without throwing when a write fails", async () => {
    const mocks = createMocks();
    const failingUpsert = async () => {
      throw new Error("db error");
    };
    const result = await writeVocabularyChangesToCloud({
      auth: signedInAuth,
      previous: [],
      next: [testItem],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
      upsertItem: failingUpsert,
    });

    expect(result).toEqual({ status: "failed", reason: "write-failed" });
  });
});

test.describe("Vocabulary Cloud Runtime load checks", () => {
  test("loads signed-in vocabulary from Supabase when available", async () => {
    const loadCalls: Array<{
      ownerId: string;
      client: FonetikSupabaseClient;
    }> = [];

    const dummyClient = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;
    let createClientOptions: CreateBrowserSupabaseClientOptions | null = null;

    const result = await loadVocabularyFromCloud({
      auth: signedInAuth,
      isConfigured: () => true,
      createClient: (options) => {
        createClientOptions = options;
        return dummyClient;
      },
      loadVocabulary: async (ownerId, supabaseClient) => {
        loadCalls.push({ ownerId, client: supabaseClient });
        return [testItem];
      },
    });

    expect(result).toEqual({
      status: "loaded",
      vocabulary: [testItem],
    });
    expect(loadCalls).toEqual([
      {
        ownerId: "user_clerk_123",
        client: dummyClient,
      },
    ]);
    const token = await (createClientOptions as CreateBrowserSupabaseClientOptions | null)?.accessToken?.();
    expect(token).toBe("clerk-token");
  });

  test("does not create a Supabase client when loading signed-out vocabulary", async () => {
    let loadCallsCount = 0;

    const result = await loadVocabularyFromCloud({
      auth: {
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        getToken: null,
      },
      isConfigured: () => true,
      createClient: () => {
        throw new Error("client should not be created");
      },
      loadVocabulary: async () => {
        loadCallsCount++;
        return [];
      },
    });

    expect(result).toEqual({ status: "skipped", reason: "signed-out" });
    expect(loadCallsCount).toBe(0);
  });

  test("returns failed status without throwing when a read fails", async () => {
    const dummyClient = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;

    const result = await loadVocabularyFromCloud({
      auth: signedInAuth,
      isConfigured: () => true,
      createClient: () => dummyClient,
      loadVocabulary: async () => {
        throw new Error("read failed");
      },
    });

    expect(result).toEqual({ status: "failed", reason: "read-failed" });
  });
});
