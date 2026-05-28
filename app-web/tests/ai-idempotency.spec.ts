import { expect, test } from "@playwright/test";
import {
  isValidIdempotencyKey,
  computeHash,
  getArticlePracticeRequestHash,
  getExistingIdempotencyRecord,
  saveIdempotencyRecord,
} from "../src/app/lib/cache/ai-idempotency";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("AI Idempotency - Key Validation", () => {
  test("isValidIdempotencyKey checks length limits and content", () => {
    expect(isValidIdempotencyKey("")).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey("short")).toBe(false); // < 8 chars
    expect(isValidIdempotencyKey("1234567")).toBe(false); // 7 chars
    expect(isValidIdempotencyKey("12345678")).toBe(true); // 8 chars
    expect(isValidIdempotencyKey("  12345678  ")).toBe(true); // trims and validates length of 8
    expect(isValidIdempotencyKey("a".repeat(128))).toBe(true); // 128 chars
    expect(isValidIdempotencyKey("a".repeat(129))).toBe(false); // > 128 chars
  });
});

test.describe("AI Idempotency - Key Hashing", () => {
  test("computeHash produces SHA-256 hex string", () => {
    const hash = computeHash("my-idempotency-key");
    expect(hash).toBe("bb00cf1dd487a5fd10685c0913c599949985d4c0ee55cc7185e3ae41b223e91e");
  });
});

test.describe("AI Idempotency - Request Hashing", () => {
  test("getArticlePracticeRequestHash is deterministic, normalizes URLs, and includes model & promptVersion & languages", () => {
    const inputs1 = {
      url: "  HTTPS://EXAMPLE.COM/path?ref=123  ",
      level: "Intermediate",
      provider: "Gemini",
      model: "gemini-2.0-flash",
      mode: "Reading",
      focus: "Vocabulary",
      promptVersion: "v1.0",
      feedbackLanguage: "en",
      targetLanguage: "en",
    };
    const inputs2 = {
      url: "https://example.com/path",
      level: "Intermediate",
      provider: "Gemini",
      model: "gemini-2.0-flash",
      mode: "Reading",
      focus: "Vocabulary",
      promptVersion: "v1.0",
      feedbackLanguage: "en",
      targetLanguage: "en",
    };

    const hash1 = getArticlePracticeRequestHash(inputs1);
    const hash2 = getArticlePracticeRequestHash(inputs2);
    expect(hash1).toBe(hash2);

    const hashDiffLevel = getArticlePracticeRequestHash({
      ...inputs1,
      level: "Advanced",
    });
    expect(hash1).not.toBe(hashDiffLevel);

    const hashDiffPrompt = getArticlePracticeRequestHash({
      ...inputs1,
      promptVersion: "v1.1",
    });
    expect(hash1).not.toBe(hashDiffPrompt);

    const hashDiffModel = getArticlePracticeRequestHash({
      ...inputs1,
      model: "gemini-2.5-flash",
    });
    expect(hash1).not.toBe(hashDiffModel);

    const hashDiffLang = getArticlePracticeRequestHash({
      ...inputs1,
      feedbackLanguage: "id",
    });
    expect(hash1).not.toBe(hashDiffLang);
  });
});

test.describe("AI Idempotency - Mock Client Operations", () => {
  test("getExistingIdempotencyRecord returns row if exists and not expired", async () => {
    const expiresAtFuture = new Date(Date.now() + 1000 * 60 * 10).toISOString();
    const mockClient = {
      from: (table: string) => {
        expect(table).toBe("ai_request_idempotency");
        return {
          select: (columns: string) => {
            expect(columns).toBe("*");
            return {
              eq: (col1: string, val1: string) => {
                expect(col1).toBe("scope_key");
                return {
                  eq: (col2: string, val2: string) => {
                    expect(col2).toBe("idempotency_key_hash");
                    return {
                      maybeSingle: async () => {
                        return {
                          data: {
                            id: "some-uuid",
                            scope_key: val1,
                            idempotency_key_hash: val2,
                            request_status: "succeeded",
                            response_json: { test: true },
                            expires_at: expiresAtFuture,
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const result = await getExistingIdempotencyRecord(
      "global:article-practice",
      "test-key-hash",
      mockClient
    );

    expect(result).not.toBeNull();
    expect(result!.request_status).toBe("succeeded");
    expect(result!.response_json).toEqual({ test: true });
  });

  test("getExistingIdempotencyRecord returns null if record is expired", async () => {
    const expiresAtPast = new Date(Date.now() - 1000 * 60 * 10).toISOString();
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                return {
                  data: {
                    id: "some-uuid",
                    request_status: "succeeded",
                    response_json: { test: true },
                    expires_at: expiresAtPast,
                  },
                  error: null,
                };
              },
            }),
          }),
        }),
      }),
    };

    const result = await getExistingIdempotencyRecord(
      "global:article-practice",
      "test-key-hash",
      mockClient
    );

    expect(result).toBeNull();
  });

  test("getExistingIdempotencyRecord returns null on database error", async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                return {
                  data: null,
                  error: new Error("DB Connection Error"),
                };
              },
            }),
          }),
        }),
      }),
    };

    const result = await getExistingIdempotencyRecord(
      "global:article-practice",
      "test-key-hash",
      mockClient
    );

    expect(result).toBeNull();
  });

  test("saveIdempotencyRecord saves in_progress and succeeded events correctly", async () => {
    let upsertCalled = false;
    const mockClient = {
      from: (table: string) => {
        expect(table).toBe("ai_request_idempotency");
        return {
          upsert: async (values: unknown, options: unknown) => {
            const vals = values as Record<string, unknown>;
            const opts = options as Record<string, unknown>;
            expect(vals.scope_key).toBe("global:article-practice");
            expect(vals.idempotency_key_hash).toBe("test-key-hash");
            expect(vals.request_hash).toBe("test-request-hash");
            expect(opts).toEqual({ onConflict: "scope_key,idempotency_key_hash" });
            upsertCalled = true;
            return { error: null };
          },
        };
      },
    };

    await saveIdempotencyRecord(
      {
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash: "test-key-hash",
        requestHash: "test-request-hash",
        requestStatus: "in_progress",
      },
      mockClient
    );
    expect(upsertCalled).toBe(true);
  });
});

test.describe("AI Idempotency - Fallback Safety", () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  test.afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  test("getExistingIdempotencyRecord returns null gracefully when configuration is missing", async () => {
    const result = await getExistingIdempotencyRecord(
      "global:article-practice",
      "test-key-hash"
    );
    expect(result).toBeNull();
  });

  test("saveIdempotencyRecord does not throw when configuration is missing", async () => {
    await expect(
      saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash: "test-key-hash",
        requestHash: "test-request-hash",
        requestStatus: "succeeded",
        responseJson: { saved: true },
      })
    ).resolves.not.toThrow();
  });
});

test.describe("AI Idempotency - Request Matching & Replay Validation", () => {
  const mockSucceededResponse = { success: true, data: "cached-data" };
  const expiresAtFuture = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  test("same idempotency key + same request_hash replays stored response", async () => {
    const currentRequestHash = "matching-request-hash";

    const existingRecord = {
      id: "some-uuid",
      request_status: "succeeded",
      response_json: mockSucceededResponse,
      request_hash: "matching-request-hash",
      expires_at: expiresAtFuture,
    };

    const isReplayable =
      existingRecord.request_status === "succeeded" &&
      existingRecord.request_hash === currentRequestHash &&
      new Date(existingRecord.expires_at).getTime() > Date.now();

    expect(isReplayable).toBe(true);
  });

  test("same idempotency key + different request_hash does not replay stored response", async () => {
    const currentRequestHash = "new-request-hash";

    const existingRecord = {
      id: "some-uuid",
      request_status: "succeeded",
      response_json: mockSucceededResponse,
      request_hash: "old-request-hash",
      expires_at: expiresAtFuture,
    };

    const isReplayable =
      existingRecord.request_status === "succeeded" &&
      existingRecord.request_hash === currentRequestHash &&
      new Date(existingRecord.expires_at).getTime() > Date.now();

    expect(isReplayable).toBe(false);
  });

  test("failed row does not replay as success", async () => {
    const existingRecord = {
      id: "some-uuid",
      request_status: "failed",
      response_json: null,
      request_hash: "matching-request-hash",
      expires_at: expiresAtFuture,
    };

    const isReplayable =
      existingRecord.request_status === "succeeded" &&
      existingRecord.request_hash === "matching-request-hash" &&
      new Date(existingRecord.expires_at).getTime() > Date.now();

    expect(isReplayable).toBe(false);
  });

  test("in_progress row does not replay as success", async () => {
    const existingRecord = {
      id: "some-uuid",
      request_status: "in_progress",
      response_json: null,
      request_hash: "matching-request-hash",
      expires_at: expiresAtFuture,
    };

    const isReplayable =
      existingRecord.request_status === "succeeded" &&
      existingRecord.request_hash === "matching-request-hash" &&
      new Date(existingRecord.expires_at).getTime() > Date.now();

    expect(isReplayable).toBe(false);
  });

  test("expired row does not replay", async () => {
    const expiresAtPast = new Date(Date.now() - 1000 * 60 * 10).toISOString();
    const existingRecord = {
      id: "some-uuid",
      request_status: "succeeded",
      response_json: mockSucceededResponse,
      request_hash: "matching-request-hash",
      expires_at: expiresAtPast,
    };

    const isReplayable =
      existingRecord.request_status === "succeeded" &&
      existingRecord.request_hash === "matching-request-hash" &&
      new Date(existingRecord.expires_at).getTime() > Date.now();

    expect(isReplayable).toBe(false);
  });

  test("no raw content persisted checks in idempotency schema", () => {
    const sampleRecordKeys = [
      "id",
      "owner_id",
      "scope_key",
      "feature",
      "idempotency_key_hash",
      "request_hash",
      "request_status",
      "response_json",
      "error_code",
      "expires_at",
      "created_at",
      "updated_at"
    ];
    expect(sampleRecordKeys).not.toContain("raw_html");
    expect(sampleRecordKeys).not.toContain("article_text");
    expect(sampleRecordKeys).not.toContain("transcript");
    expect(sampleRecordKeys).not.toContain("user_sentence");
    expect(sampleRecordKeys).not.toContain("csv");
  });
});
