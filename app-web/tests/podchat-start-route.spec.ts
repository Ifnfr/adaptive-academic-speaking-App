import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/podchat/start/route";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalPlanningProvider = process.env.AI_PLANNING_PROVIDER;
const originalExecutionProvider = process.env.AI_EXECUTION_PROVIDER;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Economics",
      difficulty: "Beginner",
      ...body,
    }),
  });
}

function mockDeepSeekResponse(
  status: number,
  responseText: string,
  capture: { body?: Record<string, unknown> } = {},
) {
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  process.env.AI_PLANNING_PROVIDER = "deepseek";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }
    if (status === 200) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: responseText,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    } else {
      return new Response(responseText, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }) as typeof fetch;
}

test.describe("POST /api/podchat/start Route Tests", () => {
  test.afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    process.env.AI_PLANNING_PROVIDER = originalPlanningProvider;
    process.env.AI_EXECUTION_PROVIDER = originalExecutionProvider;
    globalThis.fetch = originalFetch;
  });

  test("Valid request returns strict opener and sessionPlan", async () => {
    const mockJson = {
      opener: "Hello and welcome to Podchat! Let's discuss everyday prices. How do they affect your grocery choices?",
      sessionPlan: {
        topicAngle: "everyday grocery choices",
        targetSkill: "providing simple examples",
        followUpStrategy: "ask about price changes",
        expectedLanguagePattern: "I chose [option] because [reason], but I gave up [alternative].",
        evaluationFocus: ["sentence structure", "vocabulary range"]
      }
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson));

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.opener).toBe(mockJson.opener);
    expect(data.sessionPlan).toEqual(mockJson.sessionPlan);
  });

  test("Invalid topic is rejected with 400", async () => {
    const response = await POST(buildRequest({ topic: "InvalidTopicName" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("topic");
  });

  test("Invalid difficulty is rejected with 400", async () => {
    const response = await POST(buildRequest({ difficulty: "InvalidDifficultyName" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("difficulty");
  });

  test("context open-ended article start includes article and completion guidance", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    const mockJson = {
      opener: "Let's connect this article to your own view. What is the main implication?",
      sessionPlan: {
        topicAngle: "article implications",
        targetSkill: "defending a position",
        followUpStrategy: "ask about evidence and implications",
        expectedLanguagePattern: "The main implication is [idea] because [evidence].",
        evaluationFocus: ["topic development"],
      },
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson), capture);

    const response = await POST(buildRequest({
      difficulty: "Expert",
      sessionMode: "context_open_ended",
      articleContext: {
        articleTitle: "Policy systems",
        articleBrief: "A complex article about evidence and implications.",
        speakingTaskTitle: "Discuss the article",
        speakingTaskInstruction: "Defend a position.",
      },
      aurUnderstandingState: {
        sourceType: "article",
        discussionFocus: "Policy evidence and assumptions",
        keyConcepts: ["evidence", "assumptions"],
        evidenceOrExamples: ["The article compares policy evidence."],
        assumptionsToTest: ["Policy assumptions may differ by context."],
        implications: ["The policy may affect public trust."],
        counterarguments: ["Evidence may be incomplete."],
        learnerLikelyProblem: "The learner may summarize without a position.",
        discussionPath: ["claim", "evidence", "position"],
        scope: { include: ["article claim"], exclude: ["raw article"] },
        closureCriteria: ["The learner states a position."],
        coverageState: {
          mainIdeaExplored: false,
          evidenceExplored: false,
          implicationsExplored: false,
          learnerPositionFormed: false,
          counterargumentExplored: false,
          synthesisCompleted: false,
        },
      },
    }));
    expect(response.status).toBe(200);

    const providerBody = JSON.stringify(capture.body);
    expect(providerBody).toContain("Policy systems");
    expect(providerBody).toContain("Session mode: context_open_ended");
    expect(providerBody).toContain("open-ended context discussion");
    expect(providerBody).toContain("AUR CONTEXT BRIDGE");
    expect(providerBody).toContain("Policy evidence and assumptions");
  });

  test("Missing planning provider key returns safe 503", async () => {
    // Unset keys
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    process.env.AI_PLANNING_PROVIDER = "deepseek";

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toContain("Provider is not configured");
    expect(data.providerError.category).toBe("missing_configuration");
  });

  test("Malformed provider output returns safe 502", async () => {
    mockDeepSeekResponse(200, "This is plain text, not JSON");

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Provider request failed");
    expect(data.providerError.category).toBe("invalid_provider_response");
  });

  test("Overlong opener (over 280 chars limit in validator) is rejected with 502", async () => {
    const mockJson = {
      opener: "This is a super long opener sentence that is definitely going to exceed the maximum character limit set in our validation rules to keep the opening turns short and conversational, otherwise the learner would be overwhelmed. And it also ends with a single question to prompt the user?",
      sessionPlan: {
        topicAngle: "grocery choices",
        targetSkill: "simple examples",
        followUpStrategy: "price changes"
      }
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson));

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Provider request failed");
    expect(data.providerError.category).toBe("invalid_provider_response");
  });

  test("Opener with no question mark is rejected with 502", async () => {
    const mockJson = {
      opener: "Welcome to Podchat. Let's discuss grocery shopping.",
      sessionPlan: {
        topicAngle: "grocery choices",
        targetSkill: "simple examples",
        followUpStrategy: "price changes"
      }
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson));

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Provider request failed");
  });

  test("Opener with multiple question marks is rejected with 502", async () => {
    const mockJson = {
      opener: "Welcome? Ready to talk? Let's discuss grocery shopping?",
      sessionPlan: {
        topicAngle: "grocery choices",
        targetSkill: "simple examples",
        followUpStrategy: "price changes"
      }
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson));

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Provider request failed");
  });

  test("Provider details are not leaked in error response", async () => {
    mockDeepSeekResponse(500, "Internal Server Error");

    const response = await POST(buildRequest({}));
    // Should return 502 or 500 depending on mapProviderStatus. status 500 maps to 502 categories.
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toBe("Provider request failed. Please try again later.");
    expect(data.providerError.provider).toBe("planning"); // abstracted category/role, not deepseek/auth keys
  });

  test("Opener starting with Welcome to Podchat is rejected with 502", async () => {
    const mockJson = {
      opener: "Welcome to Podchat! Let's discuss grocery choices. How do they affect your grocery choices?",
      sessionPlan: {
        topicAngle: "everyday grocery choices",
        targetSkill: "providing simple examples",
        followUpStrategy: "ask about price changes",
        expectedLanguagePattern: "I chose [option] because [reason], but I gave up [alternative].",
        evaluationFocus: ["sentence structure", "vocabulary range"]
      }
    };
    mockDeepSeekResponse(200, JSON.stringify(mockJson));

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Provider request failed");
  });
});
