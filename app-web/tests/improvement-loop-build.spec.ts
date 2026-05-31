import { expect, test } from "@playwright/test";
import { buildImprovementProposal, getSafeImprovementProposalSnapshot } from "../src/app/lib/improvement-loop/build";
import type { ImprovementProposalEvidence } from "../src/app/lib/improvement-loop/types";

test.describe("Tutor Memory - Improvement Proposal Builder Helpers", () => {
  const mockEvidence: ImprovementProposalEvidence = {
    repeatedCategoryCounts: { grammar: 3 },
    completionRate: 80,
    attemptCount: 5,
  };

  test("should build proposal with deterministic ID and default fields", () => {
    const proposal = buildImprovementProposal(
      "curriculum_adjustment",
      "Unit 1 Introduction",
      "grammar-rule-1",
      mockEvidence
    );

    expect(proposal.proposalId).toBe("improvement-curriculum_adjustment-unit1introduction-grammarrule1");
    expect(proposal.requiresHumanApproval).toBe(true);
    expect(proposal.status).toBe("draft");
    expect(proposal.priority).toBe("medium");
    expect(proposal.createdAt).toBe("2026-05-31T09:00:00Z");
  });

  test("should accept and merge options correctly", () => {
    const proposal = buildImprovementProposal(
      "micro_practice_adjustment",
      "card-d3",
      "retries",
      mockEvidence,
      {
        title: "Reduce card-d3 complexity",
        priority: "high",
        riskLevel: "medium",
        timestamp: "2026-06-01T12:00:00Z",
      }
    );

    expect(proposal.title).toBe("Reduce card-d3 complexity");
    expect(proposal.priority).toBe("high");
    expect(proposal.riskLevel).toBe("medium");
    expect(proposal.createdAt).toBe("2026-06-01T12:00:00Z");
  });

  test("should not mutate the input evidence object", () => {
    const origEvidence = { repeatedCategoryCounts: { grammar: 3 } };
    const proposal = buildImprovementProposal(
      "curriculum_adjustment",
      "unit",
      "scope",
      origEvidence
    );

    // Verify modifying the output does not affect the input source
    if (proposal.evidence.repeatedCategoryCounts) {
      proposal.evidence.repeatedCategoryCounts.grammar = 100;
    }
    expect(origEvidence.repeatedCategoryCounts.grammar).toBe(3);
  });

  test("should strip extra dynamically added keys via the snapshot helper", () => {
    const proposal = buildImprovementProposal(
      "curriculum_adjustment",
      "unit",
      "scope",
      mockEvidence
    );

    const dirtyProposal = {
      ...proposal,
      someForbiddenHack: "malicious-data",
    } as unknown as typeof proposal;

    const snapshot = getSafeImprovementProposalSnapshot(dirtyProposal);
    expect((snapshot as Record<string, unknown>).someForbiddenHack).toBeUndefined();
    expect(snapshot.proposalId).toBe(proposal.proposalId);
  });
});
