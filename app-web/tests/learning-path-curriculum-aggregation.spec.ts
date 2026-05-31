import { test, expect } from "@playwright/test";
import {
  allLearningPathCurriculum,
  phase1Curriculum,
  phase2Curriculum,
  getAllLearningPathCards,
  getLearningPathPhaseById,
  getLearningPathDayByNumber,
  getLearningPathCardsByPhase
} from "../src/app/lib/learning-path/curriculum";

test.describe("Learning Path - Curriculum Aggregation & Compatibility (TASK-052C)", () => {
  
  test("1. Combined curriculum loads Phase 1 and Phase 2 correctly", () => {
    expect(allLearningPathCurriculum).toBeDefined();
    expect(phase1Curriculum).toBeDefined();
    expect(phase2Curriculum).toBeDefined();
    expect(allLearningPathCurriculum.phases.length).toBe(2);
  });

  test("2. Combined curriculum preserves phase order", () => {
    const phases = allLearningPathCurriculum.phases;
    expect(phases[0].id).toBe("confidence-foundation");
    expect(phases[1].id).toBe("everyday-interaction");
  });

  test("3. Combined curriculum covers Day 1 to Day 28", () => {
    const days: number[] = [];
    for (const phase of allLearningPathCurriculum.phases) {
      for (const unit of phase.units) {
        for (const day of unit.days) {
          days.push(day.dayNumber);
        }
      }
    }
    expect(days.length).toBe(28);
    for (let i = 0; i < 28; i++) {
      expect(days[i]).toBe(i + 1);
    }
  });

  test("4. Days 1–14 belong to Phase 1", () => {
    const phase1 = allLearningPathCurriculum.phases[0];
    const days = phase1.units.flatMap(u => u.days.map(d => d.dayNumber));
    expect(days.length).toBe(14);
    days.forEach(dayNumber => {
      expect(dayNumber).toBeGreaterThanOrEqual(1);
      expect(dayNumber).toBeLessThanOrEqual(14);
    });
  });

  test("5. Days 15–28 belong to Phase 2", () => {
    const phase2 = allLearningPathCurriculum.phases[1];
    const days = phase2.units.flatMap(u => u.days.map(d => d.dayNumber));
    expect(days.length).toBe(14);
    days.forEach(dayNumber => {
      expect(dayNumber).toBeGreaterThanOrEqual(15);
      expect(dayNumber).toBeLessThanOrEqual(28);
    });
  });

  test("6. Day 14 and Day 15 boundary is correct", () => {
    const day14 = getLearningPathDayByNumber(14);
    const day15 = getLearningPathDayByNumber(15);

    expect(day14).toBeDefined();
    expect(day14?.dayNumber).toBe(14);
    expect(day14?.unitId).toBe("my-daily-life");

    expect(day15).toBeDefined();
    expect(day15?.dayNumber).toBe(15);
    expect(day15?.unitId).toBe("asking-and-answering");
  });

  test("7. getAllLearningPathCards returns ordered cards", () => {
    const cards = getAllLearningPathCards();
    expect(cards.length).toBeGreaterThan(0);
    
    // Check that cards are sorted by dayNumber asc
    for (let i = 0; i < cards.length - 1; i++) {
      expect(cards[i].dayNumber).toBeLessThanOrEqual(cards[i + 1].dayNumber);
    }
  });

  test("8. New Phase 2 card types appear only in Phase 2", () => {
    const phase1Cards = getLearningPathCardsByPhase("confidence-foundation");
    const phase2Cards = getLearningPathCardsByPhase("everyday-interaction");

    const phase2OnlyTypes = new Set([
      "supported-conversation",
      "pronunciation-awareness",
      "reflection-card"
    ]);

    phase1Cards.forEach(card => {
      expect(phase2OnlyTypes.has(card.type)).toBe(false);
    });

    const phase2HasNewTypes = phase2Cards.some(card => phase2OnlyTypes.has(card.type));
    expect(phase2HasNewTypes).toBe(true);
  });

  test("9. Delayed/forbidden card types do not appear anywhere", () => {
    const allCards = getAllLearningPathCards();
    const bannedTypes = new Set([
      "free-speaking",
      "open-roleplay",
      "shadow-mode",
      "dynamic-conversation-repair",
      "ai-scored-speaking",
      "transcript-feedback"
    ]);

    allCards.forEach(card => {
      expect(bannedTypes.has(card.type)).toBe(false);
    });
  });

  test("10. No AI scoring claims exist anywhere in combined curriculum", () => {
    const serialized = JSON.stringify(allLearningPathCurriculum).toLowerCase();
    const bannedClaims = [
      "accuracy score",
      "confidence score",
      "baseline threshold",
      "acoustic threshold",
      "vowel-duration",
      "vowelduration",
      "intonation",
      "semantic grading",
      "semanticgrading",
      "auto-pass",
      "autopass"
    ];

    bannedClaims.forEach(claim => {
      expect(serialized).not.toContain(claim);
    });
  });

  test("11. No transcript/audio/private field terms exist anywhere in combined curriculum", () => {
    const serialized = JSON.stringify(allLearningPathCurriculum).toLowerCase();
    const bannedPrivatePatterns = [
      "transcript",
      "retry_transcript",
      "retrytranscript",
      "vocabulary_sentence",
      "vocabularysentence",
      "ai_correction",
      "aicorrection",
      "article_url",
      "articleurl",
      "weakness",
      "retry_task",
      "retrytask",
      "owner_id",
      "ownerid",
      "source_id",
      "sourceid",
      "localstorage",
      "email"
    ];

    bannedPrivatePatterns.forEach(pattern => {
      expect(serialized).not.toContain(pattern);
    });

    expect(serialized).not.toContain("@");
  });

  test("12. No final exam wording exists in combined curriculum", () => {
    const serialized = JSON.stringify(allLearningPathCurriculum).toLowerCase();
    expect(serialized).not.toContain("final exam");
    expect(serialized).not.toContain("ujian akhir");
  });

  test("13. No harsh learner labels exist in combined curriculum", () => {
    const serialized = JSON.stringify(allLearningPathCurriculum).toLowerCase();
    const clinicalOrPsychologicalTerms = [
      "dysfluent",
      "stutter",
      "deficient",
      "incompetent",
      "poor english",
      "broken english",
      "bad english",
      "fail",
      "failed"
    ];

    clinicalOrPsychologicalTerms.forEach(term => {
      expect(serialized).not.toContain(term);
    });
  });

  test("14. Aggregation helper methods do not mutate source curriculum objects", () => {
    const originalJson = JSON.stringify(allLearningPathCurriculum);
    
    // Call all aggregation helper methods
    const allCards = getAllLearningPathCards();
    if (allCards.length > 0) {
      allCards[0].title = "MUTATED TITLE";
    }

    const phase = getLearningPathPhaseById("confidence-foundation");
    if (phase) {
      phase.title = "MUTATED PHASE TITLE";
    }

    const day = getLearningPathDayByNumber(15);
    if (day) {
      day.title = "MUTATED DAY TITLE";
    }

    const phaseCards = getLearningPathCardsByPhase("everyday-interaction");
    if (phaseCards.length > 0) {
      phaseCards[0].title = "MUTATED PHASE CARD TITLE";
    }

    // Verify allLearningPathCurriculum remained completely unchanged
    expect(JSON.stringify(allLearningPathCurriculum)).toBe(originalJson);
  });

  test("15. Safety and privacy scan compliance check", () => {
    const serialized = JSON.stringify(allLearningPathCurriculum).toLowerCase();
    
    const scanBannedTerms = [
      "transcript",
      "retrytranscript",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "rawlearnersentence",
      "exactlearnersentence",
      "raw ai response",
      "provider response",
      "email",
      "owner_id",
      "source_id",
      "userid",
      "sessionid",
      "rawpayload",
      "articleurl",
      "privatenote",
      "clinical",
      "psychological",
      "pronunciation score",
      "grammar score",
      "confidence score"
    ];

    scanBannedTerms.forEach(term => {
      expect(serialized).not.toContain(term);
    });
  });

});
