import { expect, test } from "@playwright/test";
import { estimatePodchatDifficulty } from "../src/app/lib/podchatDifficulty";

test.describe("Podchat Context Difficulty Estimator Tests", () => {
  test("empty context falls back to Intermediate", () => {
    const estimate = estimatePodchatDifficulty({
      source: "commonplace_note",
      insight: "",
      tags: [],
    });
    expect(estimate.difficulty).toBe("Intermediate");
    expect(estimate.reasonCode).toBe("fallback_intermediate");
  });

  test("empty article context falls back to Intermediate", () => {
    const estimate = estimatePodchatDifficulty({
      source: "article",
    });
    expect(estimate.difficulty).toBe("Intermediate");
    expect(estimate.reasonCode).toBe("fallback_intermediate");
  });

  test("moderate article (short brief) estimates Intermediate", () => {
    // Word count ~26, conceptCount 3
    const estimate = estimatePodchatDifficulty({
      source: "article",
      articleBrief: "This article discusses basic technology changes in learning. Students can use online platforms to practice and review lessons. The framework requires minimal effort and simple explanation.",
      keyPoints: ["point 1", "point 2", "point 3"],
    });
    expect(estimate.difficulty).toBe("Intermediate");
  });

  test("moderate article estimates Intermediate", () => {
    const estimate = estimatePodchatDifficulty({
      source: "article",
      articleTitle: "Remote work and productivity",
      articleBrief:
        "The article explains how remote work can improve focus but also create communication challenges for teams.",
      speakingTaskInstruction:
        "Explain one benefit and one challenge, then give your own opinion with an example.",
      keyPoints: ["focus", "communication", "team culture"],
    });
    expect(estimate.difficulty).toBe("Intermediate");
  });

  test("complex academic article estimates Advanced", () => {
    const estimate = estimatePodchatDifficulty({
      source: "article",
      articleTitle: "Policy trade-offs in climate adaptation",
      articleBrief:
        "The article compares policy frameworks, evidence quality, incentives, constraints, and the implication of long-term infrastructure choices. However, it also explains why local assumptions can change the model. Therefore, the reader must compare competing policy choices because each trade-off creates different risks.",
      mainIdea:
        "Climate adaptation requires a framework that balances evidence, incentives, and political constraints.",
      speakingTaskInstruction:
        "Defend a position, discuss a counterargument, and explain the implication for public policy.",
      keyPoints: ["policy", "framework", "evidence", "counterargument"],
    });
    expect(estimate.difficulty).toBe("Advanced");
  });

  test("dense map with multiple strong signals estimates Expert", () => {
    const estimate = estimatePodchatDifficulty({
      source: "commonplace_map",
      mapTitle: "Ethics, incentives, and policy systems",
      counts: { nodes: 16, edges: 22, clusterNodes: 4, noteNodes: 12 },
      nodes: Array.from({ length: 12 }, (_, index) => ({
        title: `Framework node ${index + 1}`,
        insightExcerpt:
          "This note connects theory, evidence, assumptions, counterargument, policy implication, and system constraints.",
        tags: ["theory", "policy", "evidence"],
      })),
      edges: Array.from({ length: 22 }, () => ({ label: "causality and trade-off" })),
    });
    expect(estimate.difficulty).toBe("Expert");
  });

  test("Expert candidate with one strong signal is capped at Advanced", () => {
    const estimate = estimatePodchatDifficulty({
      source: "commonplace_map",
      mapTitle: "Large simple map",
      counts: { nodes: 20, edges: 4, clusterNodes: 0, noteNodes: 20 },
      nodes: Array.from({ length: 20 }, (_, index) => ({
        title: `Simple node ${index + 1}`,
        insightExcerpt: "A short practical example.",
      })),
      edges: Array.from({ length: 4 }, () => ({ label: "example" })),
    });
    expect(estimate.difficulty).toBe("Advanced");
  });

  test("thin Commonplace note remains conservative (Intermediate)", () => {
    const estimate = estimatePodchatDifficulty({
      source: "commonplace_note",
      insight: "Very thin note insight.",
    });
    expect(estimate.difficulty).toBe("Intermediate");
  });
});
