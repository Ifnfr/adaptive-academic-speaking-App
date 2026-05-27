import { expect, test } from "@playwright/test";
import {
  resolveProviderModel,
  estimateTokensFromText,
  estimateTokensFromJson,
  estimateAiCost,
  recordAiUsageEvent,
} from "../src/app/lib/cache/ai-usage";

// Store original environment variables
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Provider / model resolution
// ---------------------------------------------------------------------------

test.describe("AI Usage - resolveProviderModel", () => {
  test("resolves Claude model", () => {
    expect(resolveProviderModel("Claude")).toBe("claude-3-5-sonnet-latest");
  });

  test("resolves DeepSeek model", () => {
    expect(resolveProviderModel("DeepSeek")).toBe("deepseek-chat");
  });

  test("resolves Gemini model from env or default", () => {
    const original = process.env.GEMINI_MODEL;
    try {
      delete process.env.GEMINI_MODEL;
      expect(resolveProviderModel("Gemini")).toBe("gemini-2.0-flash");

      process.env.GEMINI_MODEL = "gemini-2.5-flash";
      expect(resolveProviderModel("Gemini")).toBe("gemini-2.5-flash");
    } finally {
      if (original !== undefined) {
        process.env.GEMINI_MODEL = original;
      } else {
        delete process.env.GEMINI_MODEL;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

test.describe("AI Usage - Token Estimation", () => {
  test("estimateTokensFromText returns ceil(chars / 4)", () => {
    expect(estimateTokensFromText("")).toBe(0);
    expect(estimateTokensFromText("a")).toBe(1);
    expect(estimateTokensFromText("abcd")).toBe(1);
    expect(estimateTokensFromText("abcde")).toBe(2);
    expect(estimateTokensFromText("a".repeat(100))).toBe(25);
    expect(estimateTokensFromText("a".repeat(101))).toBe(26);
  });

  test("estimateTokensFromJson serialises object then estimates", () => {
    const obj = { key: "value", nested: { a: 1 } };
    const serialised = JSON.stringify(obj);
    expect(estimateTokensFromJson(obj)).toBe(
      Math.ceil(serialised.length / 4)
    );
  });

  test("estimateTokensFromJson returns 0 for circular references", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circular: any = {};
    circular.self = circular;
    expect(estimateTokensFromJson(circular)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

test.describe("AI Usage - Cost Estimation", () => {
  test("returns computed cost for known models", () => {
    const cost = estimateAiCost({
      provider: "Gemini",
      model: "gemini-2.0-flash",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(cost).not.toBeNull();
    expect(typeof cost).toBe("number");
    // gemini-2.0-flash: (1000/1000)*0.0001 + (1000/1000)*0.0004 = 0.0005
    expect(cost).toBeCloseTo(0.0005, 8);
  });

  test("returns computed cost for Claude model", () => {
    const cost = estimateAiCost({
      provider: "Claude",
      model: "claude-3-5-sonnet-latest",
      inputTokens: 2000,
      outputTokens: 500,
    });
    expect(cost).not.toBeNull();
    // (2000/1000)*0.003 + (500/1000)*0.015 = 0.006 + 0.0075 = 0.0135
    expect(cost).toBeCloseTo(0.0135, 8);
  });

  test("returns null for unknown model", () => {
    const cost = estimateAiCost({
      provider: "Gemini",
      model: "gemini-99-turbo",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(cost).toBeNull();
  });

  test("returns 0 cost for zero tokens with known model", () => {
    const cost = estimateAiCost({
      provider: "DeepSeek",
      model: "deepseek-chat",
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(cost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recordAiUsageEvent — mock client tests
// ---------------------------------------------------------------------------

test.describe("AI Usage - recordAiUsageEvent", () => {
  test("inserts correct row shape into ai_usage_events", async () => {
    let insertedRow: Record<string, unknown> | null = null;

    const mockClient = {
      from: (table: string) => {
        expect(table).toBe("ai_usage_events");
        return {
          insert: async (row: Record<string, unknown>) => {
            insertedRow = row;
            return { error: null };
          },
        };
      },
    };

    await recordAiUsageEvent(
      {
        feature: "article-practice",
        provider: "Gemini",
        model: "gemini-2.0-flash",
        promptVersion: "v1.0",
        cached: false,
        requestStatus: "provider_success",
        estimatedInputTokens: 500,
        estimatedOutputTokens: 200,
        estimatedCostUsd: 0.00013,
      },
      mockClient
    );

    expect(insertedRow).not.toBeNull();
    expect(insertedRow!.feature).toBe("article-practice");
    expect(insertedRow!.provider).toBe("Gemini");
    expect(insertedRow!.model).toBe("gemini-2.0-flash");
    expect(insertedRow!.prompt_version).toBe("v1.0");
    expect(insertedRow!.cached).toBe(false);
    expect(insertedRow!.request_status).toBe("provider_success");
    expect(insertedRow!.estimated_input_tokens).toBe(500);
    expect(insertedRow!.estimated_output_tokens).toBe(200);
    expect(insertedRow!.estimated_cost_usd).toBeCloseTo(0.00013, 8);
    expect(insertedRow!.owner_id).toBeNull();
    expect(insertedRow!.error_code).toBeNull();
  });

  test("inserts cache_hit event with zero cost", async () => {
    let insertedRow: Record<string, unknown> | null = null;

    const mockClient = {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          insertedRow = row;
          return { error: null };
        },
      }),
    };

    await recordAiUsageEvent(
      {
        feature: "article-practice",
        provider: "Gemini",
        model: "gemini-2.0-flash",
        promptVersion: "v1.0",
        cached: true,
        requestStatus: "cache_hit",
        estimatedInputTokens: null,
        estimatedOutputTokens: 150,
        estimatedCostUsd: 0,
      },
      mockClient
    );

    expect(insertedRow).not.toBeNull();
    expect(insertedRow!.cached).toBe(true);
    expect(insertedRow!.request_status).toBe("cache_hit");
    expect(insertedRow!.estimated_cost_usd).toBe(0);
    expect(insertedRow!.estimated_input_tokens).toBeNull();
  });

  test("inserts provider_failed event with error_code", async () => {
    let insertedRow: Record<string, unknown> | null = null;

    const mockClient = {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          insertedRow = row;
          return { error: null };
        },
      }),
    };

    await recordAiUsageEvent(
      {
        feature: "article-practice",
        provider: "Claude",
        model: "claude-3-5-sonnet-latest",
        promptVersion: "v1.0",
        cached: false,
        requestStatus: "provider_failed",
        estimatedInputTokens: 800,
        errorCode: "Rate limit reached.",
      },
      mockClient
    );

    expect(insertedRow).not.toBeNull();
    expect(insertedRow!.request_status).toBe("provider_failed");
    expect(insertedRow!.error_code).toBe("Rate limit reached.");
    expect(insertedRow!.estimated_output_tokens).toBeNull();
    expect(insertedRow!.estimated_cost_usd).toBeNull();
  });

  test("does not store raw article text or transcript in row", async () => {
    let insertedRow: Record<string, unknown> | null = null;

    const mockClient = {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          insertedRow = row;
          return { error: null };
        },
      }),
    };

    await recordAiUsageEvent(
      {
        feature: "article-practice",
        provider: "Gemini",
        model: "gemini-2.0-flash",
        promptVersion: "v1.0",
        cached: false,
        requestStatus: "article_fetch_failed",
        errorCode: "Fetch error",
      },
      mockClient
    );

    expect(insertedRow).not.toBeNull();
    const keys = Object.keys(insertedRow!);
    // Assert no raw text fields exist in the inserted row
    expect(keys).not.toContain("article_text");
    expect(keys).not.toContain("raw_html");
    expect(keys).not.toContain("transcript");
    expect(keys).not.toContain("user_sentence");
    expect(keys).not.toContain("csv");
    expect(keys).not.toContain("prompt_text");
    expect(keys).not.toContain("response_text");
    // Only expected columns
    const expectedKeys = [
      "owner_id",
      "feature",
      "provider",
      "model",
      "prompt_version",
      "cached",
      "request_status",
      "estimated_input_tokens",
      "estimated_output_tokens",
      "estimated_cost_usd",
      "error_code",
    ];
    expect(keys.sort()).toEqual(expectedKeys.sort());
  });
});

// ---------------------------------------------------------------------------
// Fallback safety — missing configuration
// ---------------------------------------------------------------------------

test.describe("AI Usage - Fallback Safety", () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  test.afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  test("recordAiUsageEvent returns safely when service role is missing", async () => {
    await expect(
      recordAiUsageEvent({
        feature: "article-practice",
        provider: "Gemini",
        model: "gemini-2.0-flash",
        promptVersion: "v1.0",
        cached: false,
        requestStatus: "provider_success",
      })
    ).resolves.not.toThrow();
  });

  test("recordAiUsageEvent does not throw on database insert failure", async () => {
    const mockClient = {
      from: () => ({
        insert: async () => {
          throw new Error("DB connection failed");
        },
      }),
    };

    await expect(
      recordAiUsageEvent(
        {
          feature: "article-practice",
          provider: "Gemini",
          model: "gemini-2.0-flash",
          promptVersion: "v1.0",
          cached: false,
          requestStatus: "provider_success",
        },
        mockClient
      )
    ).resolves.not.toThrow();
  });
});
