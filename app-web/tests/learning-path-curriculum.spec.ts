import { test, expect } from "@playwright/test";
import { phase1Curriculum } from "../src/app/lib/learning-path/phase1-curriculum";

test.describe("Learning Path - Phase 1 Curriculum Validation", () => {
  test("1. Phase 1 curriculum loads successfully", () => {
    expect(phase1Curriculum).toBeDefined();
    expect(typeof phase1Curriculum).toBe("object");
  });

  test("2. Path id and title exist and are correct", () => {
    expect(phase1Curriculum.id).toBe("beginner-confidence-ladder");
    expect(phase1Curriculum.title).toBe("Beginner Confidence Ladder");
    expect(phase1Curriculum.description).toBeTruthy();
  });

  test("3. Confidence Foundation phase exists", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation");
    expect(phase).toBeDefined();
    expect(phase?.title).toBe("Confidence Foundation");
    expect(phase?.durationDays).toBe(14);
  });

  test("4. Unit 1 and Unit 2 exist and are correct", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const unit1 = phase.units.find(u => u.id === "introduce-yourself");
    const unit2 = phase.units.find(u => u.id === "my-daily-life");

    expect(unit1).toBeDefined();
    expect(unit1?.title).toBe("Introduce Yourself");
    expect(unit1?.unitNumber).toBe(1);

    expect(unit2).toBeDefined();
    expect(unit2?.title).toBe("My Daily Life");
    expect(unit2?.unitNumber).toBe(2);
  });

  test("5. There are exactly 14 days in the phase duration", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    let totalDays = 0;
    for (const unit of phase.units) {
      totalDays += unit.days.length;
    }
    expect(totalDays).toBe(14);
  });

  test("6. Days are ordered sequentially from 1 to 14", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const allDays = [...phase.units[0].days, ...phase.units[1].days];
    expect(allDays.length).toBe(14);
    for (let i = 0; i < 14; i++) {
      expect(allDays[i].dayNumber).toBe(i + 1);
    }
  });

  test("7. Days 1-7 belong to Unit 1 (Introduce Yourself)", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const unit1 = phase.units.find(u => u.id === "introduce-yourself")!;
    expect(unit1.days.length).toBe(7);
    unit1.days.forEach(day => {
      expect(day.dayNumber).toBeGreaterThanOrEqual(1);
      expect(day.dayNumber).toBeLessThanOrEqual(7);
      expect(day.unitId).toBe("introduce-yourself");
    });
  });

  test("8. Days 8-14 belong to Unit 2 (My Daily Life)", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const unit2 = phase.units.find(u => u.id === "my-daily-life")!;
    expect(unit2.days.length).toBe(7);
    unit2.days.forEach(day => {
      expect(day.dayNumber).toBeGreaterThanOrEqual(8);
      expect(day.dayNumber).toBeLessThanOrEqual(14);
      expect(day.unitId).toBe("my-daily-life");
    });
  });

  test("9. Approved card types appear", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const allCards = phase.units.flatMap(u => u.days.flatMap(d => d.cards));
    
    const approvedTypes = new Set([
      "guided-word",
      "phrase-pattern",
      "sentence-builder",
      "micro-speaking",
      "weekly-checkpoint"
    ]);

    allCards.forEach(card => {
      expect(approvedTypes.has(card.type)).toBe(true);
    });
  });

  test("10. Every day has at least one card", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const allDays = phase.units.flatMap(u => u.days);
    allDays.forEach(day => {
      expect(day.cards.length).toBeGreaterThanOrEqual(1);
    });
  });

  test("11. Every card has required safe fields", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const allCards = phase.units.flatMap(u => u.days.flatMap(d => d.cards));

    allCards.forEach(card => {
      expect(card.id).toBeTruthy();
      expect(typeof card.dayNumber).toBe("number");
      expect(card.unitId).toBeTruthy();
      expect(card.type).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(Array.isArray(card.targetPhrases)).toBe(true);
      expect(card.targetPhrases.length).toBeGreaterThan(0);
      expect(card.learnerInstruction).toBeTruthy();
      expect(card.indonesianExplanation).toBeTruthy();
      expect(card.scaffold).toBeTruthy();
      expect(card.cta).toBeTruthy();
      expect(typeof card.estimatedMinutes).toBe("number");
      expect(card.completionRule).toBeTruthy();
      expect(card.linkedEngine).toBeTruthy();
      expect(card.mobileLayoutHint).toBeTruthy();

      // Check mobileLayoutHint type constraints
      expect(["compact", "standard", "scrollable"]).toContain(card.mobileLayoutHint);
    });
  });

  test("12. Curriculum JSON/string output does not contain forbidden private fields", () => {
    const serialized = JSON.stringify(phase1Curriculum).toLowerCase();
    
    const forbiddenPatterns = [
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

    forbiddenPatterns.forEach(pattern => {
      expect(serialized).not.toContain(pattern);
    });

    // Email check
    expect(serialized).not.toContain("@");
  });

  test("13. Curriculum JSON/string output does not contain banned scoring claims", () => {
    const serialized = JSON.stringify(phase1Curriculum).toLowerCase();
    
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

  test("14. No advanced card types are present", () => {
    const phase = phase1Curriculum.phases.find(p => p.id === "confidence-foundation")!;
    const allCards = phase.units.flatMap(u => u.days.flatMap(d => d.cards));
    
    const bannedCardTypes = [
      "shadow-mode",
      "shadow_mode",
      "supported-conversation",
      "supported_conversation",
      "free-speaking",
      "free_speaking",
      "article-speaking",
      "article_speaking"
    ];

    allCards.forEach(card => {
      expect(bannedCardTypes).not.toContain(card.type);
    });
  });

  test("15. No final exam wording or 'ujian akhir' appears", () => {
    const serialized = JSON.stringify(phase1Curriculum).toLowerCase();
    expect(serialized).not.toContain("final exam");
    expect(serialized).not.toContain("ujian akhir");
  });
});
