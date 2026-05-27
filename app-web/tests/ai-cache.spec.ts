import { expect, test } from "@playwright/test";
import {
  normalizeUrl,
  getArticlePracticeCacheKey,
  getGlobalCachedResponse,
  saveGlobalCachedResponse,
} from "../src/app/lib/cache/ai-cache";

// Store original environment variables
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

test.describe("AI Cache Utilities - URL Normalization", () => {
  test("normalizeUrl trims whitespace, hostnames, and protocols", () => {
    expect(normalizeUrl("  HTTPS://EXAMPLE.COM/path/  ")).toBe("https://example.com/path/");
    expect(normalizeUrl("HTTP://ANOTHER.COM/")).toBe("http://another.com");
  });

  test("normalizeUrl strips tracking and UTM parameters", () => {
    expect(
      normalizeUrl(
        "https://example.com/?utm_source=news&ref=123&fbclid=abc&utm_medium=email"
      )
    ).toBe("https://example.com");
  });

  test("normalizeUrl sorts query parameters deterministically", () => {
    expect(normalizeUrl("https://example.com/?z=9&a=1&m=5")).toBe(
      "https://example.com/?a=1&m=5&z=9"
    );
  });

  test("normalizeUrl handles invalid URLs gracefully by lowercasing/trimming", () => {
    expect(normalizeUrl("  NOT-A-VALID-URL  ")).toBe("not-a-valid-url");
  });
});

test.describe("AI Cache Utilities - Key Generation", () => {
  test("getArticlePracticeCacheKey is deterministic and includes prompt version", () => {
    const key1 = getArticlePracticeCacheKey(
      "https://example.com",
      "Intermediate",
      "Gemini",
      "Reading",
      "Weakness",
      "v1.0"
    );
    const key2 = getArticlePracticeCacheKey(
      "https://example.com",
      "Intermediate",
      "Gemini",
      "Reading",
      "Weakness",
      "v1.0"
    );
    const keyDiffLevel = getArticlePracticeCacheKey(
      "https://example.com",
      "Advanced",
      "Gemini",
      "Reading",
      "Weakness",
      "v1.0"
    );
    const keyDiffPrompt = getArticlePracticeCacheKey(
      "https://example.com",
      "Intermediate",
      "Gemini",
      "Reading",
      "Weakness",
      "v2.0"
    );

    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDiffLevel);
    expect(key1).not.toBe(keyDiffPrompt);
    expect(key1).toContain("global:article-practice:");
  });
});

test.describe("AI Cache Utilities - Mock Client Operations", () => {
  test("getGlobalCachedResponse returns data on successful query", async () => {
    const mockClient = {
      from: (table: string) => {
        expect(table).toBe("global_ai_response_cache");
        return {
          select: (columns: string) => {
            expect(columns).toBe("response_json");
            return {
              eq: (column: string, value: string) => {
                expect(column).toBe("cache_key");
                expect(value).toBe("test-key");
                return {
                  maybeSingle: async () => {
                    return {
                      data: { response_json: { mockData: true } },
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

    const result = await getGlobalCachedResponse("test-key", mockClient);
    expect(result).toEqual({ mockData: true });
  });

  test("getGlobalCachedResponse returns null when query fails or data missing", async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              return { data: null, error: new Error("DB Error") };
            },
          }),
        }),
      }),
    };

    const result = await getGlobalCachedResponse("test-key", mockClient);
    expect(result).toBeNull();
  });

  test("saveGlobalCachedResponse runs upsert query correctly", async () => {
    let upsertCalled = false;

    const mockClient = {
      from: (table: string) => {
        expect(table).toBe("global_ai_response_cache");
        return {
          upsert: async (values: unknown, options: unknown) => {
            expect(values).toEqual({
              cache_key: "test-key",
              feature: "test-feature",
              response_json: { saved: true },
            });
            expect(options).toEqual({ onConflict: "cache_key" });
            upsertCalled = true;
            return { error: null };
          },
        };
      },
    };

    await saveGlobalCachedResponse(
      "test-key",
      "test-feature",
      { saved: true },
      mockClient
    );
    expect(upsertCalled).toBe(true);
  });
});

test.describe("AI Cache Utilities - Fallback Safety", () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
  });

  test.afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  test("getGlobalCachedResponse safely returns null on missing configuration", async () => {
    const result = await getGlobalCachedResponse("dummy-key");
    expect(result).toBeNull();
  });

  test("getGlobalCachedResponse safely returns null on network connection failure", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invalid-supabase-host-123.abc";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    const result = await getGlobalCachedResponse("dummy-key");
    expect(result).toBeNull();
  });

  test("saveGlobalCachedResponse does not throw on missing configuration", async () => {
    await expect(
      saveGlobalCachedResponse("dummy-key", "article-practice", { test: 1 })
    ).resolves.not.toThrow();
  });

  test("saveGlobalCachedResponse does not throw on connection failure", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://invalid-supabase-host-123.abc";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-key";

    await expect(
      saveGlobalCachedResponse("dummy-key", "article-practice", { test: 1 })
    ).resolves.not.toThrow();
  });
});
