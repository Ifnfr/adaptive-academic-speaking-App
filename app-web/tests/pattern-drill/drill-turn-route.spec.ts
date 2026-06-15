import { test, expect } from "@playwright/test";
import { testHooks, POST } from "../../src/app/api/pattern-drill/drill-turn/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/pattern-drill/drill-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  phase: 2,
  briefId: "test-brief-001",
  targetPattern: "Claim because Reason structure",
  targetSteps: ["[claim]", "because", "[reason]"],
  commonMistakes: ["Using simple sentences", "Incomplete thoughts"],
  promptTopic: "Explain how artificial intelligence impacts job roles.",
  transcript: "AI changes jobs because it automates routine tasks.",
  attemptNumber: 1,
};

test.describe("Drill Turn Route", () => {
  test.beforeEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.callDeepSeek = null;
  });

  test("unauthenticated request returns 401 auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("auth_required");
  });

  test("unexpected field in body returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, extraField: "notAllowed" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("invalid phase (not 2) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, phase: 1 };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("missing briefId returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, briefId: undefined };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("missing transcript returns 400 transcript_required", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, transcript: undefined };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("transcript_required");
  });

  test("empty transcript returns 400 transcript_required", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, transcript: "   " };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("transcript_required");
  });

  test("transcript over 500 chars returns 400 transcript_too_long", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, transcript: "a".repeat(501) };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("transcript_too_long");
  });

  test("invalid targetSteps length (too few) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, targetSteps: ["[claim]"] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("invalid targetSteps length (too many) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, targetSteps: ["1", "2", "3", "4", "5", "6"] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("invalid commonMistakes length (too many) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, commonMistakes: ["1", "2", "3", "4"] };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("invalid attemptNumber returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, attemptNumber: 4 };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("missing DEEPSEEK_API_KEY returns 503 provider_not_configured", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const originalKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    try {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(503);
      const json = await res.json() as { error: string };
      expect(json.error).toBe("provider_not_configured");
    } finally {
      process.env.DEEPSEEK_API_KEY = originalKey;
    }
  });

  test("valid Full Credit response returns 200 with sanitized result", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callDeepSeek = async () =>
      JSON.stringify({
        credit: "full",
        missingSteps: [],
        usedSteps: ["[claim]", "because", "[reason]"],
        shortFeedback: "Good.",
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      credit: string;
      missingSteps: string[];
      usedSteps: string[];
      shortFeedback: string;
    };
    expect(json.credit).toBe("full");
    expect(json.shortFeedback).toBe("Good.");
    expect(json.missingSteps).toHaveLength(0);
    expect(json.usedSteps).toEqual(["[claim]", "because", "[reason]"]);
  });

  test("Full Credit response with long/unapproved feedback rejects with 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callDeepSeek = async () =>
      JSON.stringify({
        credit: "full",
        missingSteps: [],
        usedSteps: ["[claim]", "because", "[reason]"],
        shortFeedback: "Great job completing the full pattern successfully!",
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_provider_response");
  });

  test("Partial Credit response works correctly", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callDeepSeek = async () =>
      JSON.stringify({
        credit: "partial",
        missingSteps: ["[reason]"],
        usedSteps: ["[claim]", "because"],
        shortFeedback: "Missing slot: [reason].",
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      credit: string;
      missingSteps: string[];
      usedSteps: string[];
      shortFeedback: string;
    };
    expect(json.credit).toBe("partial");
    expect(json.shortFeedback).toBe("Missing slot: [reason].");
    expect(json.missingSteps).toEqual(["[reason]"]);
  });

  test("No Credit feedback over 150 characters rejects with 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callDeepSeek = async () =>
      JSON.stringify({
        credit: "none",
        missingSteps: ["[claim]", "because", "[reason]"],
        usedSteps: [],
        shortFeedback: "a".repeat(151),
      });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_provider_response");
  });

  test("provider throws returns 502 provider_unavailable", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callDeepSeek = async () => {
      throw new Error("Connection reset");
    };

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("provider_unavailable");
  });

  test("route file does not import @supabase/supabase-js", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve(__dirname, "../../src/app/api/pattern-drill/drill-turn/route.ts");
    const fileContent = fs.readFileSync(routePath, "utf-8");
    expect(fileContent).not.toContain("@supabase/supabase-js");
    expect(fileContent).not.toContain("supabaseClient");
  });
});
