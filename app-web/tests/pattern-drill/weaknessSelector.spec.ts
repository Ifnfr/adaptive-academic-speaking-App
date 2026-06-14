import { expect, test } from "@playwright/test";
import { selectLatestWeakness, type LearnerErrorPatternRow } from "../../src/app/lib/pattern-drill/weaknessSelector";

function buildRow(overrides: Partial<LearnerErrorPatternRow>): LearnerErrorPatternRow {
  return {
    id: "err-123",
    owner_id: "user-1",
    source_kind: "podchat",
    source_id: "session-123",
    category: "Coherence",
    label: "Missing because clauses",
    evidence: "Learner said: 'I like technology.' but did not explain.",
    practice_focus: "Try to add a because clause to justify claims.",
    created_at: "2026-06-10T12:00:00Z",
    ...overrides,
  };
}

test.describe("Latest Weakness Selector Utility", () => {
  const refDate = new Date("2026-06-15T12:00:00Z");

  test("returns error when input is not an array", () => {
    const res = selectLatestWeakness(null);
    expect(res.status).toBe("error");
    expect(res.reason).toContain("Could not load weakness data");
  });

  test("returns empty when input is an empty array", () => {
    const res = selectLatestWeakness([]);
    expect(res.status).toBe("empty");
    expect(res.reason).toContain("No speaking weakness data yet");
  });

  test("ignores non-podchat source kinds", () => {
    const row = buildRow({ source_kind: "article_writing" });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("respects owner scoping when ownerId is specified", () => {
    const row1 = buildRow({ owner_id: "user-1" });
    const row2 = buildRow({ owner_id: "user-2" });
    const res = selectLatestWeakness([row1, row2], { now: refDate, ownerId: "user-2" });
    expect(res.status).toBe("found");
    expect((res.weakness as Record<string, unknown>)?.owner_id).toBeUndefined(); // weakness details object doesn't include owner_id directly
    expect(res.weakness?.label).toBe("Missing because clauses");
  });

  test("rejects generic labels", () => {
    const row = buildRow({ label: "Grammar", category: "Grammar" });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("rejects generic categories", () => {
    const row = buildRow({ label: "Vague error", category: "General" });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("rejects candidates failing specificity check", () => {
    const row = buildRow({
      label: "Short",
      evidence: "Short",
      practice_focus: "Short", // Less than 6 words, no actionable phrase
    });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("accepts candidates with actionable phrases despite low word count", () => {
    const row = buildRow({
      label: "Short",
      evidence: "Short",
      practice_focus: "Use specific examples", // contains actionable phrase
    });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("found");
    expect(res.weakness?.label).toBe("Short");
  });

  test("rejects stale rows older than 30 days", () => {
    const row = buildRow({ created_at: "2026-05-01T12:00:00Z" }); // 45 days old
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("rejects rows with invalid timestamps", () => {
    const row = buildRow({ created_at: "invalid-date" });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("insufficient");
  });

  test("accepts a single high-quality candidate with count = 1", () => {
    const row = buildRow({
      evidence: "Learner did not explain why.",
      practice_focus: "Acknowledge opposing view in responses.",
    });
    const res = selectLatestWeakness([row], { now: refDate });
    expect(res.status).toBe("found");
    expect(res.weakness?.failureCount).toBe(1);
    expect(res.weakness?.derivedConfidence).toBe(0.65);
  });

  test("accepts a repeated weakness (count >= 2) even with minor missing fields", () => {
    const row1 = buildRow({
      label: "No sentence endings",
      evidence: "Did not finish sentence.",
      practice_focus: null,
      created_at: "2026-06-10T12:00:00Z",
    });
    const row2 = buildRow({
      label: "No sentence endings",
      evidence: null,
      practice_focus: "Add clear sentence endings to ensure clarity.",
      created_at: "2026-06-11T12:00:00Z",
    });
    const res = selectLatestWeakness([row1, row2], { now: refDate });
    expect(res.status).toBe("found");
    expect(res.weakness?.label).toBe("No sentence endings");
    expect(res.weakness?.failureCount).toBe(2);
    expect(res.weakness?.derivedConfidence).toBe(0.8);
  });

  test("tie-breaks by confidence first, then count, then recency, then completeness", () => {
    // Row A: High confidence (0.8), count=2, newer
    const rowA1 = buildRow({
      label: "Weakness A",
      evidence: "Some evidence A",
      practice_focus: "Improve your hedging phrase use.",
      created_at: "2026-06-12T12:00:00Z",
    });
    const rowA2 = buildRow({
      label: "Weakness A",
      evidence: "More evidence A",
      practice_focus: "Improve your hedging phrase use.",
      created_at: "2026-06-13T12:00:00Z",
    });

    // Row B: Lower confidence (0.65), count=1, but very new
    const rowB = buildRow({
      label: "Weakness B",
      evidence: "Evidence B is extremely fresh",
      practice_focus: "Acknowledge opposing view at all times.",
      created_at: "2026-06-14T12:00:00Z",
    });

    const res = selectLatestWeakness([rowA1, rowA2, rowB], { now: refDate });
    expect(res.status).toBe("found");
    // High confidence (0.8) should win over lower confidence (0.65) despite newer date
    expect(res.weakness?.label).toBe("Weakness A");
  });

  test("tie-breaks by count if confidence matches", () => {
    // Weakness A: count=3, older
    const rA1 = buildRow({ label: "Weakness A", created_at: "2026-06-01T12:00:00Z" });
    const rA2 = buildRow({ label: "Weakness A", created_at: "2026-06-02T12:00:00Z" });
    const rA3 = buildRow({ label: "Weakness A", created_at: "2026-06-03T12:00:00Z" });

    // Weakness B: count=2, newer
    const rB1 = buildRow({ label: "Weakness B", created_at: "2026-06-10T12:00:00Z" });
    const rB2 = buildRow({ label: "Weakness B", created_at: "2026-06-11T12:00:00Z" });

    const res = selectLatestWeakness([rA1, rA2, rA3, rB1, rB2], { now: refDate });
    expect(res.status).toBe("found");
    expect(res.weakness?.label).toBe("Weakness A");
  });
});
