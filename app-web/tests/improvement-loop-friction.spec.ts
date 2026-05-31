import { expect, test } from "@playwright/test";
import {
  detectLearningPathFriction,
  detectMicroPracticeFriction,
  detectFeedbackPatternFriction,
  detectDocumentationGap,
} from "../src/app/lib/improvement-loop/friction";

test.describe("Tutor Memory - Improvement Loop Friction Detection Helpers", () => {
  test("should detect Learning Path friction and generate curriculum adjustment proposal", () => {
    const mockProgress = [
      { unitId: "unit-1-basics", completionRate: 45, attemptCount: 6 },
      { unitId: "unit-2-advanced", completionRate: 90, attemptCount: 10 },
    ];

    const proposals = detectLearningPathFriction(mockProgress);
    expect(proposals.length).toBe(1);
    expect(proposals[0].type).toBe("curriculum_adjustment");
    expect(proposals[0].affectedArea).toBe("unit1basics");
    expect(proposals[0].priority).toBe("high");
  });

  test("should detect Micro-Practice friction and generate practice adjustment proposal", () => {
    const mockStats = [
      { cardId: "card-intro", attemptCount: 5, retryCount: 4 }, // 80% retry rate
      { cardId: "card-greeting", attemptCount: 10, retryCount: 2 }, // 20% retry rate
    ];

    const proposals = detectMicroPracticeFriction(mockStats);
    expect(proposals.length).toBe(1);
    expect(proposals[0].type).toBe("micro_practice_adjustment");
    expect(proposals[0].affectedArea).toBe("cardintro");
    expect(proposals[0].priority).toBe("medium");
  });

  test("should detect Feedback Pattern friction and generate recommendation rule adjustment proposal", () => {
    const mockFeedback = [
      { category: "grammar", count: 4 },
      { category: "fluency", count: 1 },
    ];

    const proposals = detectFeedbackPatternFriction(mockFeedback);
    expect(proposals.length).toBe(1);
    expect(proposals[0].type).toBe("recommendation_rule_adjustment");
    expect(proposals[0].affectedArea).toBe("grammar");
  });

  test("should detect Documentation Gap and generate documentation update proposal", () => {
    const mockQA = [
      { featureName: "leaderboard", missingDocs: true },
      { featureName: "i18n", missingDocs: false },
    ];

    const proposals = detectDocumentationGap(mockQA);
    expect(proposals.length).toBe(1);
    expect(proposals[0].type).toBe("documentation_update");
    expect(proposals[0].affectedArea).toBe("leaderboard");
  });
});
