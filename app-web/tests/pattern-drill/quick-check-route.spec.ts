import { test, expect } from "@playwright/test";
import { testHooks, POST } from "../../src/app/api/pattern-drill/quick-check/route";

// Helper to create a fresh Request for each test (bodies can only be consumed once)
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/pattern-drill/quick-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  briefId: "test-brief-001",
  responsePattern: {
    name: "CRE Structure",
    steps: ["[claim]", "because [reason]", "for example [evidence]"],
  },
  commonMistakes: ["Jumping to evidence", "Incomplete thoughts"],
  transcript: "Technology helps students learn independently because it gives them flexible access to materials.",
};

test.describe("Pattern Quick Check Route", () => {
  test.beforeEach(() => {
    // Reset hooks before each test
    testHooks.resolveCurrentUserId = null;
    testHooks.callClaude = null;
  });

  test("unauthenticated request returns 401 auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("auth_required");
  });

  test("missing briefId returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, briefId: undefined };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("empty briefId returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({ ...VALID_BODY, briefId: "  " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("missing transcript returns 400 transcript_required", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const { transcript: _, ...bodyWithoutTranscript } = VALID_BODY;
    const res = await POST(makeRequest(bodyWithoutTranscript));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("transcript_required");
  });

  test("empty transcript returns 400 transcript_required", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({ ...VALID_BODY, transcript: "   " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("transcript_required");
  });

  test("transcript over 500 chars returns 400 transcript_too_long", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const longTranscript = "a".repeat(501);
    const res = await POST(makeRequest({ ...VALID_BODY, transcript: longTranscript }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("transcript_too_long");
  });

  test("unexpected field in body returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({ ...VALID_BODY, ownerHint: "user-123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("responsePattern with 1 step (too few) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({
      ...VALID_BODY,
      responsePattern: { name: "Short", steps: ["[claim]"] },
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("responsePattern with 6 steps (too many) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({
      ...VALID_BODY,
      responsePattern: {
        name: "Long",
        steps: ["[a]", "[b]", "[c]", "[d]", "[e]", "[f]"],
      },
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("commonMistakes with 4 items (exceeds max 3) returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest({
      ...VALID_BODY,
      commonMistakes: ["a", "b", "c", "d"],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });

  test("missing CLAUDE_API_KEY returns 503 provider_not_configured", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    // callClaude is null (not set) — the route will check process.env.CLAUDE_API_KEY
    // which is not set in the test environment, so it returns 503
    testHooks.callClaude = null;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("provider_not_configured");
  });

  test("valid 'detected' provider response returns { result: 'detected', entryPhase: 3 }", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "detected" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBe("detected");
    expect(json.entryPhase).toBe(3);
  });

  test("valid 'not_detected_or_partial' provider response returns { result: 'not_detected_or_partial', entryPhase: 1 }", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "not_detected_or_partial" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBe("not_detected_or_partial");
    expect(json.entryPhase).toBe(1);
  });

  test("invalid provider JSON returns 502 invalid_provider_response", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => "This is not valid JSON at all";
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("invalid_provider_response");
  });

  test("provider returns unexpected result value returns 502 invalid_provider_response", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "unknown_value" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("invalid_provider_response");
  });

  test("provider throws returns 502 provider_unavailable", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => { throw new Error("Connection reset"); };
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("provider_unavailable");
  });

  test("response body does not expose owner_id, raw prompt, or Supabase fields", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "detected" });
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();
    // Verify only allowed fields in response
    expect(Object.keys(json)).toEqual(expect.arrayContaining(["result", "entryPhase"]));
    expect(json.owner_id).toBeUndefined();
    expect(json.briefId).toBeUndefined();
    expect(json.transcript).toBeUndefined();
    expect(json.prompt).toBeUndefined();
    expect(json.rawResponse).toBeUndefined();
  });

  test("route file does not import @supabase/supabase-js", async () => {
    // Verify the route has no Supabase dependency — read the file and check
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve(
      __dirname,
      "../../src/app/api/pattern-drill/quick-check/route.ts"
    );
    const content = fs.readFileSync(routePath, "utf8");
    expect(content).not.toContain("@supabase/supabase-js");
    expect(content).not.toContain("createClient");
  });

  test("Cache-Control is set to no-store on success", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "detected" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("empty commonMistakes array is accepted (min 0)", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => JSON.stringify({ result: "not_detected_or_partial" });
    const res = await POST(makeRequest({ ...VALID_BODY, commonMistakes: [] }));
    expect(res.status).toBe(200);
  });
});
