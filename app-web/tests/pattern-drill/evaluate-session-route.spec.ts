import { test, expect } from "@playwright/test";
import { testHooks, POST } from "../../src/app/api/pattern-drill/evaluate-session/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/pattern-drill/evaluate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  briefId: "test-brief-001",
  targetPattern: "Claim because Reason structure",
  targetSteps: ["[claim]", "because", "[reason]"],
  commonMistakes: ["Mistake 1"],
  quickCheck: {
    status: "skipped",
  },
  phase1: {
    baselineAnswerCount: 2,
    completedPromptCount: 2,
  },
  phase2: {
    attempts: [
      {
        topic: "Topic 1",
        credit: "partial",
        missingSteps: ["[reason]"],
        usedSteps: ["[claim]", "because"],
        attemptNumber: 1,
      },
      {
        topic: "Topic 1",
        credit: "full",
        missingSteps: [],
        usedSteps: ["[claim]", "because", "[reason]"],
        attemptNumber: 2,
      },
    ],
  },
};

test.describe("Evaluate Session Route", () => {
  test.beforeEach(() => {
    testHooks.resolveCurrentUserId = null;
  });

  test("unauthenticated request returns 401 auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("auth_required");
  });

  test("unexpected field in request body returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = { ...VALID_BODY, extraField: "notAllowed" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("incomplete Phase 1 when quick check is skipped returns 400 incomplete_session", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = {
      ...VALID_BODY,
      phase1: {
        baselineAnswerCount: 1,
        completedPromptCount: 1,
      },
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("incomplete_session");
  });

  test("empty Phase 2 attempts array returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = {
      ...VALID_BODY,
      phase2: {
        attempts: [],
      },
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("invalid attempt fields returns 400 invalid_request", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const body = {
      ...VALID_BODY,
      phase2: {
        attempts: [
          {
            topic: "",
            credit: "invalidCreditValue",
            missingSteps: [],
            usedSteps: [],
            attemptNumber: 1,
          },
        ],
      },
    };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  test("valid request computes correct metrics and streak", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      phase1BaselineCompleteness: string;
      phase2Accuracy: number;
      fullCreditCount: number;
      partialCreditCount: number;
      noCreditCount: number;
      evaluatedAttemptCount: number;
      finalFullCreditStreak: number;
      mostMissedSteps: string[];
      simplifiedTopicUsed: boolean;
      improvementSignal: string;
      saved: boolean;
      phase3PressureAccuracy: null;
      pressureFailRate: null;
    };

    expect(json.phase1BaselineCompleteness).toBe("complete");
    expect(json.phase2Accuracy).toBe(50); // 1 full / 2 attempts = 50%
    expect(json.fullCreditCount).toBe(1);
    expect(json.partialCreditCount).toBe(1);
    expect(json.noCreditCount).toBe(0);
    expect(json.evaluatedAttemptCount).toBe(2);
    expect(json.finalFullCreditStreak).toBe(1); // last attempt is full
    expect(json.mostMissedSteps).toEqual(["[reason]"]);
    expect(json.simplifiedTopicUsed).toBe(false);
    expect(json.improvementSignal).toBe("emerging");
    expect(json.saved).toBe(false);
    expect(json.phase3PressureAccuracy).toBeNull();
    expect(json.pressureFailRate).toBeNull();
  });

  test("route file does not import @supabase/supabase-js", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve(__dirname, "../../src/app/api/pattern-drill/evaluate-session/route.ts");
    const fileContent = fs.readFileSync(routePath, "utf-8");
    expect(fileContent).not.toContain("@supabase/supabase-js");
    expect(fileContent).not.toContain("supabaseClient");
  });
});
