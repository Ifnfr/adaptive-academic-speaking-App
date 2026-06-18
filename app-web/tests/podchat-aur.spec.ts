import { expect, test } from "@playwright/test";
import {
  buildFallbackUnderstandingState,
  compactCommonplaceMap,
  parseUnderstandingState,
  parseUnderstandingStateJson,
} from "../src/app/lib/podchat-aur/analysis";
import { selectSocraticResponseMode } from "../src/app/lib/podchat-aur/router";

test.describe("Podchat AUR helpers", () => {
  test("builds source-specific fallback states", () => {
    expect(buildFallbackUnderstandingState("article").sourceType).toBe("article");
    expect(buildFallbackUnderstandingState("commonplace_note").discussionFocus).toContain("Commonplace note");
    expect(buildFallbackUnderstandingState("commonplace_map").scope.exclude).toContain("unbounded full-map traversal");
  });

  test("compacts Commonplace maps to bounded focus nodes and exclusions", () => {
    const compact = compactCommonplaceMap({
      sourceType: "commonplace_map",
      mapTitle: "Systems map",
      counts: { nodes: 10, edges: 14 },
      nodes: Array.from({ length: 10 }, (_, index) => ({
        visualNodeId: `node-${index}`,
        title: `Node ${index}`,
        insightExcerpt: `Insight ${index}`,
      })),
      edges: Array.from({ length: 14 }, (_, index) => ({
        sourceVisualNodeId: `node-${index % 10}`,
        targetVisualNodeId: `node-${(index + 1) % 10}`,
        edgeType: "solid",
        label: "supports",
      })),
    });

    expect(compact.focusNodes).toHaveLength(7);
    expect(compact.exclusions.join(" ")).toContain("lower-priority map nodes");
    expect(JSON.stringify(compact)).not.toContain("raw");
  });

  test("parser rejects forbidden fields and overlong strings by falling back", () => {
    const parsed = parseUnderstandingState(
      {
        sourceType: "article",
        discussionFocus: "x".repeat(1000),
        provider: "deepseek",
        keyConcepts: ["unsafe"],
      },
      "article",
    );

    expect(parsed.discussionFocus).toContain("article's main claim");
    expect(parsed.keyConcepts).toContain("main claim");
  });

  test("invalid JSON output returns deterministic fallback", () => {
    const parsed = parseUnderstandingStateJson("not json", "commonplace_note");
    expect(parsed.sourceType).toBe("commonplace_note");
    expect(parsed.discussionPath.join(" ")).toContain("central idea");
  });

  test("router selects language coach for Indonesian-dominant or unclear English", () => {
    const state = buildFallbackUnderstandingState("article");
    expect(
      selectSocraticResponseMode({
        latestUserText: "menurut saya ini penting karena masyarakat berubah",
        difficulty: "Advanced",
        understandingState: state,
      }),
    ).toBe("language_coach");
  });

  test("router selects explain, challenge, synthesize, and ask", () => {
    const base = buildFallbackUnderstandingState("article");
    expect(
      selectSocraticResponseMode({
        latestUserText: "What does this implication mean?",
        difficulty: "Intermediate",
        understandingState: base,
      }),
    ).toBe("explain");
    expect(
      selectSocraticResponseMode({
        latestUserText: "Every country must use this policy.",
        difficulty: "Advanced",
        understandingState: base,
      }),
    ).toBe("challenge");
    expect(
      selectSocraticResponseMode({
        latestUserText: "Can we summarize my position now?",
        difficulty: "Advanced",
        understandingState: base,
      }),
    ).toBe("synthesize");
    expect(
      selectSocraticResponseMode({
        latestUserText: "I think the evidence shows a trade-off because the policy helps one group.",
        difficulty: "Advanced",
        understandingState: base,
      }),
    ).toBe("ask");
  });
});
