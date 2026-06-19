import { expect, test } from "@playwright/test";
import { POST } from "../../src/app/api/pattern-brief/generate/route";
import { testHooks } from "../../src/app/api/pattern-brief/generate/route-test-hooks";

const baseRow = {
  id: "err-123",
  owner_id: "user-123",
  source_kind: "podchat",
  source_id: "session-123",
  category: "Coherence",
  label: "sentence endings",
  evidence: "Did not finish sentence.",
  practice_focus: "Add clear sentence endings to ensure clarity.",
  created_at: "2026-06-10T12:00:00Z",
};

const validClaudeResponse = {
  title: "Because Clause Expansion",
  focus: "Add clear sentence endings to ensure clarity.",
  qualityCriteria: ["Parallel structural verbs", "Proper clause connection"],
  responsePattern: {
    name: "Claim because Reason structure",
    steps: ["[claim]", "because", "[reason]"]
  },
  miniExample: "I agree because it has positive outcomes. Illustration only — do not memorize or copy.",
  commonMistakes: ["Using simple sentences without connection", "Incomplete thoughts"],
  drillEntryConfig: {
    targetPattern: "Claim because Reason structure",
    targetSteps: ["[claim]", "because", "[reason]"],
    commonMistakes: ["Using simple sentences without connection", "Incomplete thoughts"],
    suggestedEntryPhase: 3
  }
};

interface MockOptions {
  data?: Record<string, unknown>[] | null;
  error?: Record<string, unknown> | null;
  onCall?: (call: string) => void;
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];

  function buildQuery(table: string) {
    const query = {
      select(columns: string) {
        const callStr = `select:${table}:${columns}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      eq(column: string, value: string) {
        const callStr = `eq:${table}:${column}:${value}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      order(column: string, orderOpts: Record<string, unknown>) {
        const callStr = `order:${table}:${column}:${JSON.stringify(orderOpts)}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      limit(n: number) {
        const callStr = `limit:${table}:${n}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return {
          then(resolve: (value: { data: Record<string, unknown>[] | null; error: Record<string, unknown> | null }) => void) {
            resolve({
              data: options.data !== undefined ? options.data : [baseRow],
              error: options.error ?? null,
            });
          }
        };
      }
    };
    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      if (options.onCall) options.onCall(`from:${table}`);
      return buildQuery(table);
    },
  };

  return { client, calls };
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/pattern-brief/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test.describe("Pattern Brief Generate Route", () => {
  const originalClaudeKey = process.env.CLAUDE_API_KEY;

  test.beforeEach(() => {
    process.env.CLAUDE_API_KEY = "test-claude-key";
  });

  test.afterEach(() => {
    process.env.CLAUDE_API_KEY = originalClaudeKey;
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
    testHooks.callClaude = null;
  });

  test("unauthenticated requests return 401 and do not call provider", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    let providerCalled = false;
    testHooks.callClaude = async () => {
      providerCalled = true;
      return "{}";
    };

    const req = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Sentence endings",
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "auth_required" });
    expect(providerCalled).toBe(false);
  });

  test("rejects unsupported level expert", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const req = buildRequest({
      level: "expert",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Sentence endings",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "unsupported_level" });
  });

  test("rejects invalid request structure or extra keys", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const req = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Sentence endings",
      extra_key: "forbidden",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
  });

  test("manual source requires focus and enforces limits", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    // 1. Missing focus
    const req1 = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);
    await expect(res1.json()).resolves.toEqual({ error: "focus_required" });

    // 2. Too long focus (>200 chars)
    const req2 = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "A".repeat(201),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
    await expect(res2.json()).resolves.toEqual({ error: "focus_too_long" });
  });

  test("latest_weakness source queries server-side and scopes to owner", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const { client, calls } = createMockSupabaseClient({
      data: [
        { ...baseRow, id: "err-1", created_at: "2026-06-10T12:00:00Z" },
        { ...baseRow, id: "err-2", created_at: "2026-06-11T12:00:00Z" },
      ],
    });
    testHooks.getSupabaseClient = () => client;

    let systemPromptCaptured = "";
    let userPromptCaptured = "";
    testHooks.callClaude = async (apiKey, sys, user) => {
      systemPromptCaptured = sys;
      userPromptCaptured = user;
      return JSON.stringify(validClaudeResponse);
    };

    const req = buildRequest({
      level: "intermediate",
      mode: "structured_response",
      source: "latest_weakness",
      sourceId: "session-123",
      focus: "client-provided-ignore-me", // ensure this is completely ignored
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.briefId).toBeDefined();
    expect(json.title).toBe("Because Clause Expansion");
    expect(json.focus).toBe("Add clear sentence endings to ensure clarity.");

    // Ensure weakness description was fetched and fed to Claude
    expect(userPromptCaptured).toContain("Focus: Add clear sentence endings to ensure clarity.");
    expect(userPromptCaptured).not.toContain("client-provided-ignore-me");

    // Check DB queries and filters
    expect(calls).toContain("from:learner_error_patterns");
    expect(calls).toContain("eq:learner_error_patterns:owner_id:user-123");
    expect(calls).toContain("eq:learner_error_patterns:source_id:session-123");

    // Ensure no provider leakage of private rows or owner_id
    expect(systemPromptCaptured).not.toContain("user-123");
    expect(userPromptCaptured).not.toContain("user-123");
  });

  test("empty or insufficient latest weakness does not call provider", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const { client } = createMockSupabaseClient({ data: [] }); // Empty DB returns status empty
    testHooks.getSupabaseClient = () => client;

    let providerCalled = false;
    testHooks.callClaude = async () => {
      providerCalled = true;
      return JSON.stringify(validClaudeResponse);
    };

    const req = buildRequest({
      level: "intermediate",
      mode: "structured_response",
      source: "latest_weakness",
    });

    const response = await POST(req);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "latest_weakness_not_found" });
    expect(providerCalled).toBe(false);
  });

  test("missing provider config returns 503", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    process.env.CLAUDE_API_KEY = ""; // simulate missing key

    const req = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Hedging phrases",
    });

    const response = await POST(req);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "provider_not_configured" });
  });

  test("invalid JSON or structure from Claude returns 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => {
      return "This is not JSON text at all.";
    };

    const req = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Hedging phrases",
    });

    const response = await POST(req);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "invalid_provider_response" });
  });

  test("missing illustration warnings or bad sentence counts in miniExample returns 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    // 1. Missing warnings
    const badResp1 = {
      ...validClaudeResponse,
      miniExample: "I think technology is good." // missing "Illustration only" and "do not copy/memorize"
    };
    testHooks.callClaude = async () => JSON.stringify(badResp1);

    const req1 = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Hedging phrases",
    });

    const response1 = await POST(req1);
    expect(response1.status).toBe(502);

    // 2. Too many sentences (3 sentences)
    const badResp2 = {
      ...validClaudeResponse,
      miniExample: "Sentence one. Sentence two. Sentence three. Illustration only — do not copy."
    };
    testHooks.callClaude = async () => JSON.stringify(badResp2);

    const req2 = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Hedging phrases",
    });
    const response2 = await POST(req2);
    expect(response2.status).toBe(502);
  });

  test("mismatched drillEntryConfig targetPattern/steps returns 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const badResp = {
      ...validClaudeResponse,
      drillEntryConfig: {
        ...validClaudeResponse.drillEntryConfig,
        targetPattern: "Mismatched Pattern name" // does not match responsePattern.name
      }
    };
    testHooks.callClaude = async () => JSON.stringify(badResp);

    const req = buildRequest({
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "Hedging phrases",
    });

    const response = await POST(req);
    expect(response.status).toBe(502);
  });
});
