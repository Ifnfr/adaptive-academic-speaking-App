import { expect, test } from "@playwright/test";
import { createPodchatContextAnalyzeHandlers } from "../src/app/api/podchat/context/analyze/handler";

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/context/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionMode: "context_open_ended",
      sourceType: "article",
      context: {
        articleTitle: "AI in study",
        articleBrief: "The article argues that AI can support learning when students use it critically.",
        speakingTaskTitle: "Discuss the article",
        speakingTaskInstruction: "Explain the main idea and defend your position.",
      },
      ...body,
    }),
  });
}

test.describe("POST /api/podchat/context/analyze", () => {
  test("returns safe state for article analysis", async () => {
    const handlers = createPodchatContextAnalyzeHandlers({
      callDeepSeekJson: async () =>
        JSON.stringify({
          sourceType: "article",
          discussionFocus: "AI can support critical learning.",
          keyConcepts: ["critical learning", "AI support"],
          evidenceOrExamples: ["The article describes students using AI with judgment."],
          assumptionsToTest: ["Students can identify weak AI output."],
          implications: ["Teachers may need to teach AI literacy."],
          counterarguments: ["Students may become dependent."],
          learnerLikelyProblem: "The learner may praise AI without evaluating risks.",
          discussionPath: ["claim", "evidence", "position", "counterargument"],
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
        }),
    });

    const response = await handlers.POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    const json = JSON.stringify(data);
    expect(json).toContain("AI can support critical learning");
    expect(json).not.toMatch(/provider|model|ownerId|rawPrompt|apiKey/i);
  });

  test("missing key, provider throw, timeout, and invalid JSON return fallback not failure", async () => {
    const throwingHandlers = createPodchatContextAnalyzeHandlers({
      callDeepSeekJson: async () => {
        throw new Error("missing_key");
      },
    });
    const throwingResponse = await throwingHandlers.POST(buildRequest({}));
    expect(throwingResponse.status).toBe(200);
    expect(JSON.stringify(await throwingResponse.json())).toContain("The article argues");

    const invalidHandlers = createPodchatContextAnalyzeHandlers({
      callDeepSeekJson: async () => "plain text",
    });
    const invalidResponse = await invalidHandlers.POST(buildRequest({}));
    expect(invalidResponse.status).toBe(200);
    expect(JSON.stringify(await invalidResponse.json())).toContain("The article argues");

    const timeoutHandlers = createPodchatContextAnalyzeHandlers({
      timeoutMs: 1,
      callDeepSeekJson: async () => new Promise((resolve) => setTimeout(() => resolve("{}"), 20)),
    });
    const timeoutResponse = await timeoutHandlers.POST(buildRequest({}));
    expect(timeoutResponse.status).toBe(200);
    expect(JSON.stringify(await timeoutResponse.json())).toContain("The article argues");
  });

  test("rejects owner, provider, model, and prompt fields", async () => {
    const handlers = createPodchatContextAnalyzeHandlers({
      callDeepSeekJson: async () => "{}",
    });
    const response = await handlers.POST(buildRequest({
      ownerId: "user-123",
    }));
    expect(response.status).toBe(400);
  });

  test("returns safe fallback for Commonplace map context", async () => {
    const handlers = createPodchatContextAnalyzeHandlers({
      callDeepSeekJson: async () => "{}",
    });
    const response = await handlers.POST(buildRequest({
      sourceType: "commonplace_map",
      context: {
        mapType: "main",
        mapId: "map-1",
        mapTitle: "Policy map",
        counts: { nodes: 8, edges: 9 },
        nodes: Array.from({ length: 8 }, (_, index) => ({
          visualNodeId: `node-${index}`,
          title: `Concept ${index}`,
          insightExcerpt: `Insight ${index}`,
        })),
        edges: [],
      },
    }));
    expect(response.status).toBe(200);
    const json = JSON.stringify(await response.json());
    expect(json).toContain("commonplace_map");
    expect(json).toContain("Concept 0");
    expect(json).toContain("lower-priority map");
  });
});
