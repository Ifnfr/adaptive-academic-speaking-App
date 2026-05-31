import type { ImprovementProposal } from "./types";

/**
 * Formats an ImprovementProposal into a developer-actionable markdown checklist.
 * Outlines tasks, verification commands, risk mitigation notes, and manual sign-offs.
 */
export function buildHumanApprovalChecklist(proposal: ImprovementProposal): string {
  const lines: string[] = [];

  lines.push(`# DEVELOPER CHECKLIST: ${proposal.title}`);
  lines.push("");
  lines.push(`> **Proposal ID:** \`${proposal.proposalId}\``);
  lines.push(`> **Type:** \`${proposal.type}\` | **Priority:** \`${proposal.priority}\` | **Risk Level:** \`${proposal.riskLevel}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push(proposal.safeSummary);
  lines.push("");
  lines.push("## Proposed Adjustment Details");
  lines.push(`- **Target Area:** \`${proposal.affectedArea}\``);
  lines.push(`- **Action:** ${proposal.proposedChange}`);
  lines.push(`- **Expected Benefit:** ${proposal.expectedBenefit}`);
  lines.push("");
  lines.push("## Risk Analysis & Mitigation");
  if (proposal.riskLevel === "high") {
    lines.push("> [!WARNING]");
    lines.push("> This modification has a higher potential impact. Verify all dependent components before merging.");
  } else {
    lines.push("> [!NOTE]");
    lines.push("> Low risk modification. Ensure standard E2E test suites pass successfully.");
  }
  lines.push("");
  lines.push("## Implementation Checklist");
  lines.push("- [ ] 1. Verify sandbox local build is clean.");
  lines.push("- [ ] 2. Edit the corresponding curriculum, patterns, or config files manually.");
  lines.push("- [ ] 3. Run validation commands:");
  lines.push("  ```bash");
  lines.push("  npm run lint");
  lines.push("  npx tsc --noEmit");
  lines.push("  npm run test:e2e");
  lines.push("  ```");
  lines.push("- [ ] 4. Confirm no regression or unintended modifications appear via `" + "git" + " diff`.");
  lines.push("");
  lines.push("## Human Sign-Off");
  lines.push("- Approved by (Developer Name/Initials): _________________");
  lines.push("- Date of Review: _________________");

  return lines.join("\n");
}
