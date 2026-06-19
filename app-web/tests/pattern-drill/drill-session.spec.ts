import { test, expect } from "@playwright/test";
import { POST as startPOST } from "../../src/app/api/drill-session/start/route";
import { testHooks as startHooks } from "../../src/app/api/drill-session/start/route-test-hooks";
import { POST as turnPOST } from "../../src/app/api/drill-session/turn/route";
import { testHooks as turnHooks } from "../../src/app/api/drill-session/turn/route-test-hooks";
import { POST as completePOST } from "../../src/app/api/drill-session/complete/route";
import { testHooks as completeHooks } from "../../src/app/api/drill-session/complete/route-test-hooks";
import type { DrillSessionState } from "../../src/app/lib/drill-session/types";

function makeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BRIEF = {
  title: "CRE Structure",
  focus: "Support claim with reason and evidence",
  qualityCriteria: ["Include slot claims", "Include because reason"],
  responsePattern: {
    name: "CRE Structure",
    steps: ["[claim]", "because [reason]", "for example [evidence]"],
    spokenModelFragment: "I think it is good because it works.",
  },
  miniExample: "I think learning is good because it expands mind. Illustration only — do not memorize or copy.",
  commonMistakes: ["No evidence", "Missing claiming word"],
  drillEntryConfig: {
    targetPattern: "CRE Structure",
    targetSteps: ["[claim]", "because [reason]", "for example [evidence]"],
    commonMistakes: ["No evidence", "Missing claiming word"],
    suggestedEntryPhase: 1,
  },
};

const VALID_STATE: DrillSessionState = {
  sessionId: "test-session-uuid",
  currentPhase: 0,
  briefContent: {
    briefId: "test-brief-uuid",
    title: "CRE Structure",
    focus: "Support claim with reason and evidence",
    qualityCriteria: ["Include slot claims", "Include because reason"],
    responsePattern: {
      name: "CRE Structure",
      steps: ["[claim]", "because [reason]", "for example [evidence]"],
      spokenModelFragment: "I think it is good because it works.",
    },
    miniExample: "I think learning is good because it expands mind. Illustration only — do not memorize or copy.",
    commonMistakes: ["No evidence", "Missing claiming word"],
  },
  phase1Results: [],
  phase2Results: [],
  phase3Results: [],
  entryPhase: null,
};

test.describe("Drill Session Start Route", () => {
  test.beforeEach(() => {
    startHooks.resolveCurrentUserId = null;
    startHooks.getSupabaseClient = null;
    startHooks.callClaude = null;
  });

  test("unauthenticated request returns 401 auth_required", async () => {
    startHooks.resolveCurrentUserId = async () => null;
    const res = await startPOST(makeRequest("http://localhost/api/drill-session/start", {
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "practice speaking",
    }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("auth_required");
  });

  test("valid input returns phase-0 session, brief content, fragment, and no persistence", async () => {
    startHooks.resolveCurrentUserId = async () => "user-123";
    startHooks.callClaude = async () => JSON.stringify(VALID_BRIEF);

    const res = await startPOST(makeRequest("http://localhost/api/drill-session/start", {
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "practice speaking",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sessionId).toBeDefined();
    expect(json.currentPhase).toBe(0);
    expect(json.briefContent.responsePattern.spokenModelFragment).toBe("I think it is good because it works.");
    expect(json.drillEntryConfig).toBeDefined();
  });

  test("rejects owner or internal fields", async () => {
    startHooks.resolveCurrentUserId = async () => "user-123";
    const res = await startPOST(makeRequest("http://localhost/api/drill-session/start", {
      level: "beginner",
      mode: "fluency_sprint",
      source: "manual",
      focus: "practice speaking",
      ownerId: "user-123",
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });
});

test.describe("Drill Session Turn Route", () => {
  test.beforeEach(() => {
    turnHooks.resolveCurrentUserId = null;
    turnHooks.callClaude = null;
    turnHooks.callDeepSeek = null;
  });

  test("turn supports quick-check", async () => {
    turnHooks.resolveCurrentUserId = async () => "user-123";
    turnHooks.callClaude = async () => JSON.stringify({ result: "detected" });

    const res = await turnPOST(makeRequest("http://localhost/api/drill-session/turn", {
      session: VALID_STATE,
      phase: "quick_check",
      transcript: "I think it is good because it works.",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session.entryPhase).toBe(3);
    expect(json.session.currentPhase).toBe(3);
    expect(json.turnResult.result).toBe("detected");
  });

  test("turn supports phase 1", async () => {
    turnHooks.resolveCurrentUserId = async () => "user-123";

    const res = await turnPOST(makeRequest("http://localhost/api/drill-session/turn", {
      session: VALID_STATE,
      phase: 1,
      topic: "My academic topic",
      transcript: "This is some transcript.",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session.phase1Results.length).toBe(1);
    expect(json.session.phase1Results[0].detected).toBe(true);
    expect(json.turnResult.phase).toBe(1);
  });

  test("turn supports phase 2", async () => {
    turnHooks.resolveCurrentUserId = async () => "user-123";
    turnHooks.callDeepSeek = async () => JSON.stringify({
      credit: "full",
      missingSteps: [],
      usedSteps: ["[claim]", "because [reason]", "for example [evidence]"],
      shortFeedback: "Good.",
    });

    const res = await turnPOST(makeRequest("http://localhost/api/drill-session/turn", {
      session: {
        ...VALID_STATE,
        currentPhase: 2,
      },
      phase: 2,
      topic: "My academic topic",
      attemptNumber: 1,
      transcript: "This is a sentence containing claim because reason for example evidence.",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session.phase2Results.length).toBe(1);
    expect(json.session.phase2Results[0].credit).toBe("full");
    expect(json.turnResult.credit).toBe("full");
  });

  test("turn supports phase 3", async () => {
    turnHooks.resolveCurrentUserId = async () => "user-123";
    turnHooks.callClaude = async () => JSON.stringify({
      patternDetected: true,
      usedSteps: ["[claim]", "because [reason]"],
      missingSteps: [],
      timedOut: false,
      shortFeedback: "Good.",
    });

    const res = await turnPOST(makeRequest("http://localhost/api/drill-session/turn", {
      session: {
        ...VALID_STATE,
        currentPhase: 3,
      },
      phase: 3,
      roundSeconds: 10,
      roundIndex: 0,
      transcript: "This is a sentence under pressure.",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session.phase3Results.length).toBe(1);
    expect(json.session.phase3Results[0].patternDetected).toBe(true);
    expect(json.turnResult.patternDetected).toBe(true);
  });

  test("turn rejects missing transcript", async () => {
    turnHooks.resolveCurrentUserId = async () => "user-123";
    const res = await turnPOST(makeRequest("http://localhost/api/drill-session/turn", {
      session: VALID_STATE,
      phase: 1,
      topic: "academic topic",
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("transcript_required");
  });
});

test.describe("Drill Session Complete Route", () => {
  test.beforeEach(() => {
    completeHooks.resolveCurrentUserId = null;
    completeHooks.getSupabaseClient = null;
  });

  test("complete validates bounded state, persists and returns final summary", async () => {
    completeHooks.resolveCurrentUserId = async () => "user-123";
    completeHooks.getSupabaseClient = () => {
      return {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "inserted-uuid" },
                error: null,
              }),
            }),
          }),
        }),
      };
    };

    const completedState: DrillSessionState = {
      ...VALID_STATE,
      entryPhase: 1,
      phase1Results: [{ phase: 1, detected: true }, { phase: 1, detected: true }],
      phase2Results: [
        {
          phase: 2,
          credit: "full",
          missingSteps: [],
          usedSteps: ["[claim]", "because [reason]", "for example [evidence]"],
          shortFeedback: "Good.",
          topic: "Academic topic",
          attemptNumber: 1,
        },
      ],
    };

    const res = await completePOST(makeRequest("http://localhost/api/drill-session/complete", completedState));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.saved).toBe(true);
    expect(json.sessionId).toBe("inserted-uuid");
    expect(json.session.currentPhase).toBe("complete");
  });

  test("complete accepts detected quick-check sessions that enter Phase 3 directly", async () => {
    completeHooks.resolveCurrentUserId = async () => "user-123";
    completeHooks.getSupabaseClient = () => {
      return {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "inserted-pressure-uuid" },
                error: null,
              }),
            }),
          }),
        }),
      };
    };

    const pressureState: DrillSessionState = {
      ...VALID_STATE,
      currentPhase: "complete",
      entryPhase: 3,
      phase1Results: [],
      phase2Results: [],
      phase3Results: [0, 1, 2, 3].map((roundIndex) => ({
        phase: 3,
        patternDetected: true,
        missingSteps: [],
        usedSteps: ["[claim]", "because [reason]"],
        timedOut: false,
        shortFeedback: "Good.",
        roundSeconds: [10, 7, 5, 3][roundIndex],
        roundIndex,
      })),
    };

    const res = await completePOST(makeRequest("http://localhost/api/drill-session/complete", pressureState));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.saved).toBe(true);
    expect(json.sessionId).toBe("inserted-pressure-uuid");
    expect(json.phase1BaselineCompleteness).toBe("missing");
    expect(json.evaluatedAttemptCount).toBe(0);
    expect(json.phase3PressureAccuracy).toBe(100);
    expect(json.session.currentPhase).toBe("complete");
  });

  test("complete rejects client-provided owner fields", async () => {
    completeHooks.resolveCurrentUserId = async () => "user-123";
    const body = {
      ...VALID_STATE,
      ownerId: "user-123",
    };
    const res = await completePOST(makeRequest("http://localhost/api/drill-session/complete", body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
  });
});
