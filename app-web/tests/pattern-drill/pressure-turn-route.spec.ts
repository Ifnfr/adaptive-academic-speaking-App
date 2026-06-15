import { expect, test } from "@playwright/test";
import fs from "fs";
import { POST, testHooks } from "../../src/app/api/pattern-drill/pressure-turn/route";

const baseBody = {
  briefId: "brief-123",
  targetPattern: "CRE Structure",
  targetSteps: ["[claim]", "because [reason]", "for example [evidence]"],
  commonMistakes: ["incomplete", "no detail"],
  promptTopic: "Online Learning",
  transcript: "Online learning is good because it is flexible, for example I can study at night.",
  roundSeconds: 10,
  roundIndex: 0,
};

test.describe("Pressure Turn API Route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.callClaude = null;
  });

  test("unauthenticated requests return 401", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "auth_required" });
  });

  test("invalid request fields return 400", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...baseBody, invalidField: true }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
  });

  test("invalid roundSeconds returns 400", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...baseBody, roundSeconds: 12 }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
  });

  test("missing CLAUDE_API_KEY returns 503", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const originalKey = process.env.CLAUDE_API_KEY;
    delete process.env.CLAUDE_API_KEY;

    try {
      const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseBody),
      });

      const response = await POST(req);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "provider_not_configured" });
    } finally {
      process.env.CLAUDE_API_KEY = originalKey;
    }
  });

  test("valid request evaluates and returns short feedback", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => {
      return JSON.stringify({
        patternDetected: true,
        usedSteps: ["[claim]", "because", "for example"],
        missingSteps: [],
        timedOut: false,
        shortFeedback: "Good.",
      });
    };

    const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      patternDetected: true,
      usedSteps: ["[claim]", "because", "for example"],
      missingSteps: [],
      timedOut: false,
      shortFeedback: "Good.",
    });
  });

  test("invalid format returned by Claude returns 502 without leaking provider details", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.callClaude = async () => "Some raw error text that should not leak";

    const req = new Request("http://localhost/api/pattern-drill/pressure-turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseBody),
    });

    const response = await POST(req);
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toBe("provider_evaluation_failed");
    expect(data.message).toBeUndefined();
  });

  test("route code does not import or write to Supabase", async () => {
    const routeCode = fs.readFileSync("src/app/api/pattern-drill/pressure-turn/route.ts", "utf8");
    
    // It should not reference any client saving adapters
    expect(routeCode).not.toContain("supabase-pattern-drill-adapter");
    expect(routeCode).not.toContain("savePatternDrillSession");
  });
});
