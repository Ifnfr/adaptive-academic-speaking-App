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

  test("valid request computes correct metrics, saves to DB, and returns saved: true with sessionId", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    let insertCalled = false;
    const mockSupabase = {
      from: (table: string) => {
        expect(table).toBe("pattern_drill_sessions");
        return {
          insert: (row: Record<string, unknown>) => {
            insertCalled = true;
            expect(row.owner_id).toBe("user-123");
            expect(row.brief_id).toBe("test-brief-001");
            expect(row.target_pattern).toBe("Claim because Reason structure");
            expect(row.saved_summary).toBeDefined();
            // Verify no raw transcript/audio/provider fields
            expect(row.raw_transcript).toBeUndefined();
            expect(row.audio).toBeUndefined();
            return {
              select: (fields: string) => {
                expect(fields).toBe("id");
                return {
                  single: async () => ({
                    data: { id: "mock-session-id-999" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };
    testHooks.getSupabaseClient = () => mockSupabase;

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      phase1BaselineCompleteness: string;
      phase2Accuracy: number;
      saved: boolean;
      sessionId: string;
    };

    expect(json.phase1BaselineCompleteness).toBe("complete");
    expect(json.phase2Accuracy).toBe(50);
    expect(json.saved).toBe(true);
    expect(json.sessionId).toBe("mock-session-id-999");
    expect(insertCalled).toBe(true);
  });

  test("returns saved: false if DB insert fails", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mockSupabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: new Error("DB insert error"),
            }),
          }),
        }),
      }),
    };
    testHooks.getSupabaseClient = () => mockSupabase;

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      phase1BaselineCompleteness: string;
      saved: boolean;
      sessionId?: string;
    };

    expect(json.phase1BaselineCompleteness).toBe("complete");
    expect(json.saved).toBe(false);
    expect(json.sessionId).toBeUndefined();
  });

  test("rejects request if client-provided owner_id or ownerId is present in request body", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const bodyWithOwnerId = { ...VALID_BODY, ownerId: "user-123" };
    const res1 = await POST(makeRequest(bodyWithOwnerId));
    expect(res1.status).toBe(400);
    const json1 = await res1.json() as { error: string };
    expect(json1.error).toBe("invalid_request");

    const bodyWithOwnerIdUnderscore = { ...VALID_BODY, owner_id: "user-123" };
    const res2 = await POST(makeRequest(bodyWithOwnerIdUnderscore));
    expect(res2.status).toBe(400);
    const json2 = await res2.json() as { error: string };
    expect(json2.error).toBe("invalid_request");
  });
});
