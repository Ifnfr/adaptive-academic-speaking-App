import { expect, test } from "@playwright/test";
import { buildHumanApprovalChecklist } from "../src/app/lib/improvement-loop/checklist";
import type { ImprovementProposal } from "../src/app/lib/improvement-loop/types";

test.describe("Tutor Memory - Improvement Loop Checklist Helpers", () => {
  test("should format low risk proposal correctly", () => {
    const proposal: ImprovementProposal = {
      version: "1.0",
      proposalId: "improvement-curriculum_adjustment-unit1-completion",
      type: "curriculum_adjustment",
      title: "Optimize Curriculum Pacing",
      safeSummary: "Low completion rates detected.",
      evidence: { completionRate: 40 },
      affectedArea: "unit1",
      proposedChange: "Simplify exercises.",
      expectedBenefit: "Higher retention.",
      riskLevel: "low",
      priority: "medium",
      status: "draft",
      requiresHumanApproval: true,
      createdAt: "2026-05-31T09:00:00Z",
      updatedAt: "2026-05-31T09:00:00Z",
    };

    const checklist = buildHumanApprovalChecklist(proposal);
    expect(checklist).toContain("DEVELOPER CHECKLIST: Optimize Curriculum Pacing");
    expect(checklist).toContain("> [!NOTE]");
    expect(checklist).toContain("npm run test:e2e");
    expect(checklist).toContain("Human Sign-Off");
  });

  test("should format high risk proposal with warning alert", () => {
    const proposal: ImprovementProposal = {
      version: "1.0",
      proposalId: "improvement-curriculum_adjustment-unit1-completion",
      type: "curriculum_adjustment",
      title: "Optimize Curriculum Pacing",
      safeSummary: "Low completion rates detected.",
      evidence: { completionRate: 40 },
      affectedArea: "unit1",
      proposedChange: "Simplify exercises.",
      expectedBenefit: "Higher retention.",
      riskLevel: "high",
      priority: "critical",
      status: "draft",
      requiresHumanApproval: true,
      createdAt: "2026-05-31T09:00:00Z",
      updatedAt: "2026-05-31T09:00:00Z",
    };

    const checklist = buildHumanApprovalChecklist(proposal);
    expect(checklist).toContain("> [!WARNING]");
  });
});
