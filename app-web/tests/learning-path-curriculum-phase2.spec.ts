import { test, expect } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

test.describe("Learning Path - Phase 2 Curriculum Validation", () => {
  test("1. Phase 2 curriculum exists and loads successfully", () => {
    expect(phase2Curriculum).toBeDefined();
    expect(phase2Curriculum.id).toBe("everyday-interaction");
    expect(phase2Curriculum.title).toBe("Everyday Interaction");
    expect(phase2Curriculum.durationDays).toBe(14);
  });

  test("2. Phase 2 contains Unit 3 and Unit 4", () => {
    const phase2 = phase2Curriculum;
    const unit3 = phase2.units.find(u => u.id === "asking-and-answering");
    const unit4 = phase2.units.find(u => u.id === "expressing-preferences");

    expect(unit3).toBeDefined();
    expect(unit3?.title).toBe("Asking and Answering");
    expect(unit3?.unitNumber).toBe(3);

    expect(unit4).toBeDefined();
    expect(unit4?.title).toBe("Expressing Simple Preferences");
    expect(unit4?.unitNumber).toBe(4);
  });

  test("3. There are exactly 14 days in Phase 2", () => {
    const phase2 = phase2Curriculum;
    let totalDays = 0;
    for (const unit of phase2.units) {
      totalDays += unit.days.length;
    }
    expect(totalDays).toBe(14);
  });

  test("4. Days are sequential from 15 to 28", () => {
    const phase2 = phase2Curriculum;
    const unit3 = phase2.units.find(u => u.id === "asking-and-answering")!;
    const unit4 = phase2.units.find(u => u.id === "expressing-preferences")!;
    const allDays = [...unit3.days, ...unit4.days];

    expect(allDays.length).toBe(14);
    for (let i = 0; i < 14; i++) {
      expect(allDays[i].dayNumber).toBe(15 + i);
    }
  });

  test("5. Unit 3 (Asking and Answering) covers Days 15-21", () => {
    const phase2 = phase2Curriculum;
    const unit3 = phase2.units.find(u => u.id === "asking-and-answering")!;
    expect(unit3.days.length).toBe(7);
    unit3.days.forEach(day => {
      expect(day.dayNumber).toBeGreaterThanOrEqual(15);
      expect(day.dayNumber).toBeLessThanOrEqual(21);
      expect(day.unitId).toBe("asking-and-answering");
    });
  });

  test("6. Unit 4 (Expressing Simple Preferences) covers Days 22-28", () => {
    const phase2 = phase2Curriculum;
    const unit4 = phase2.units.find(u => u.id === "expressing-preferences")!;
    expect(unit4.days.length).toBe(7);
    unit4.days.forEach(day => {
      expect(day.dayNumber).toBeGreaterThanOrEqual(22);
      expect(day.dayNumber).toBeLessThanOrEqual(28);
      expect(day.unitId).toBe("expressing-preferences");
    });
  });

  test("7. Every day has at least one card", () => {
    const phase2 = phase2Curriculum;
    const allDays = phase2.units.flatMap(u => u.days);
    allDays.forEach(day => {
      expect(day.cards.length).toBeGreaterThanOrEqual(1);
    });
  });

  test("8. Cards use only approved card types", () => {
    const phase2 = phase2Curriculum;
    const allCards = phase2.units.flatMap(u => u.days.flatMap(d => d.cards));
    
    const approvedTypes = new Set([
      "guided-word",
      "phrase-pattern",
      "sentence-builder",
      "micro-speaking",
      "weekly-checkpoint",
      "supported-conversation",
      "pronunciation-awareness",
      "reflection-card"
    ]);

    allCards.forEach(card => {
      expect(approvedTypes.has(card.type)).toBe(true);
    });
  });

  test("9. Every card contains required safe fields", () => {
    const phase2 = phase2Curriculum;
    const allCards = phase2.units.flatMap(u => u.days.flatMap(d => d.cards));

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
      expect(["compact", "standard", "scrollable"]).toContain(card.mobileLayoutHint);
    });
  });

  test("10. Phase 2 JSON output contains no forbidden private fields", () => {
    const phase2 = phase2Curriculum;
    const serialized = JSON.stringify(phase2).toLowerCase();
    
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

    expect(serialized).not.toContain("@");
  });

  test("11. Phase 2 JSON output does not contain banned scoring claims", () => {
    const phase2 = phase2Curriculum;
    const serialized = JSON.stringify(phase2).toLowerCase();
    
    const bannedClaims = [
      "accuracy score",
      "confidence score",
      "baseline threshold",
      "acoustic threshold",
      "vowel-duration",
      "vowelduration",
      "semantic grading",
      "semanticgrading",
      "auto-pass",
      "autopass"
    ];

    bannedClaims.forEach(claim => {
      expect(serialized).not.toContain(claim);
    });
  });

  test("12. No generative conversation, open-ended roleplay, or AI tutor prompt wording appears", () => {
    const phase2 = phase2Curriculum;
    const serialized = JSON.stringify(phase2).toLowerCase();
    
    expect(serialized).not.toContain("ai tutor asks");
    expect(serialized).not.toContain("generative conversation");
    expect(serialized).not.toContain("open roleplay");
    expect(serialized).not.toContain("dynamic conversation repair");
    expect(serialized).not.toContain("ujian akhir");
    expect(serialized).not.toContain("final exam");
  });
});
