// tests/feedback-normalization-normalize.spec.ts
import {
  normalizeFeedbackScores,
  classifyFeedbackText,
  normalizeActiveFeedbackSignal,
  normalizeDiagnosticSignal,
  normalizeWeeklyReviewSignal,
  normalizeVocabularyCorrectionSignal,
  buildSafeFeedbackSignal,
} from "../src/app/lib/feedback-normalization/normalize";
import { test, expect } from '@playwright/test';

test.describe("Feedback Normalization Helpers", () => {
  // Helper to assert allowed fields only
  const allowedKeys = [
    "version",
    "category",
    "severity",
    "confidence",
    "learnerLevel",
    "sourceSurface",
    "safeLabel",
    "safeSummary",
    "recommendedActionId",
    "createdAt",
  ];

  const assertAllowed = (obj: Record<string, unknown>) => {
    const keys = Object.keys(obj);
    for (const k of keys) {
      expect(allowedKeys).toContain(k);
    }
  };

  test("score keys map to categories and severity", () => {
    const rawScores = {
      fluency: 0.8,
      grammar: 0.4,
      vocabulary: 45, // 0-100 style
      coherence: 0.2,
      argument: 0.6,
      academicTone: 90,
    };
    const signal = normalizeFeedbackScores(rawScores, "active-feedback");
    // Should pick first key in deterministic order (fluency)
    expect(signal.category).toBe("fluency");
    // 0.8 => light severity, high confidence
    expect(signal.severity).toBe("light");
    expect(signal.confidence).toBe("high");
    assertAllowed(signal);
  });

  test("0-100 scores are normalized correctly", () => {
    const raw = { vocabulary: 30 }; // 30/100 = 0.3 -> strong severity
    const sig = normalizeFeedbackScores(raw, "active-feedback");
    expect(sig.category).toBe("vocabulary");
    expect(sig.severity).toBe("strong");
    expect(sig.confidence).toBe("high");
    assertAllowed(sig);
  });

  test("missing scores fallback to clarity with low confidence", () => {
    const sig = normalizeFeedbackScores({}, "active-feedback");
    expect(sig.category).toBe("clarity");
    expect(sig.severity).toBe("light");
    expect(sig.confidence).toBe("low");
    expect(sig.safeLabel).toBe("General speaking focus");
    assertAllowed(sig);
  });

  test("classifyFeedbackText maps keywords", () => {
    const { category, confidence } = classifyFeedbackText("You tend to pause a lot.");
    expect(category).toBe("fluency");
    expect(confidence).toBe("high");
  });

  test("classifyFeedbackText unknown returns fallback", () => {
    const res = classifyFeedbackText("some random gibberish");
    expect(res.category).toBe("clarity");
    expect(res.confidence).toBe("low");
  });

  test("deterministic recommendedActionId", () => {
    const sig = normalizeActiveFeedbackSignal({ scores: { grammar: 0.2 } });
    expect(sig.recommendedActionId).toBe("practice-grammar-Foundation");
  });

  test("normalizeActiveFeedbackSignal respects text fallback", () => {
    const sig = normalizeActiveFeedbackSignal({ mainWeakness: "you need better flow" });
    expect(sig.category).toBe("fluency"); // flow keyword → fluency
    expect(sig.confidence).toBe("high");
    assertAllowed(sig);
  });

  test("normalizeDiagnosticSignal with scores works", () => {
    const sig = normalizeDiagnosticSignal({ scores: { coherence: 0.5 } });
    expect(sig.category).toBe("coherence");
    expect(sig.severity).toBe("medium");
    assertAllowed(sig);
  });

  test("normalizeWeeklyReviewSignal with text fallback", () => {
    const sig = normalizeWeeklyReviewSignal({ nextWeekFocus: "focus on grammar forms" });
    expect(sig.category).toBe("grammar");
    expect(sig.confidence).toBe("high");
    assertAllowed(sig);
  });

  test("normalizeVocabularyCorrectionSignal with scores", () => {
    const sig = normalizeVocabularyCorrectionSignal({ scores: { vocabulary: 0.9 } });
    expect(sig.category).toBe("vocabulary");
    expect(sig.severity).toBe("light");
    assertAllowed(sig);
  });

  test("buildSafeFeedbackSignal does not include extra fields", () => {
    // Define an object with extra fields to test omission
    const sig = buildSafeFeedbackSignal({
      category: "clarity",
      severity: "light",
      confidence: "low",
      sourceSurface: "active-feedback",
      safeLabel: "Label",
      safeSummary: "Summary",
      foo: "bar",
    } as unknown as Parameters<typeof buildSafeFeedbackSignal>[0]);
    expect(((sig as unknown) as Record<string, unknown>).foo).toBeUndefined();
    assertAllowed(sig);
  });
});
