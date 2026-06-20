import { expect, test } from "@playwright/test";
import { sanitizeText } from "../../../src/app/lib/listening-exercise/evaluation/textSanitizer";
import { levenshteinDistance } from "../../../src/app/lib/listening-exercise/evaluation/levenshteinDistance";
import { evaluateFillBlank, getTypoLimit } from "../../../src/app/lib/listening-exercise/evaluation/fillBlankEvaluator";
import { calculateSessionScore } from "../../../src/app/lib/listening-exercise/evaluation/scoreAccumulator";
import { mapScoreToBand } from "../../../src/app/lib/listening-exercise/evaluation/bandMapper";

test.describe("Listening Exercise - Core Evaluation Engine Tests", () => {
  
  test.describe("1. Text Sanitizer", () => {
    test("should convert text to lowercase", () => {
      expect(sanitizeText("HELLO")).toBe("hello");
      expect(sanitizeText("Hello World")).toBe("hello world");
    });

    test("should trim leading and trailing whitespaces", () => {
      expect(sanitizeText("  hello  ")).toBe("hello");
      expect(sanitizeText("\t hello \n")).toBe("hello");
    });

    test("should deduplicate inner whitespaces", () => {
      expect(sanitizeText("hello   world")).toBe("hello world");
      expect(sanitizeText("a \t \n  b")).toBe("a b");
    });

    test("should remove absolute trailing punctuation blocks (. , ? !)", () => {
      expect(sanitizeText("hello.")).toBe("hello");
      expect(sanitizeText("hello!")).toBe("hello");
      expect(sanitizeText("hello?")).toBe("hello");
      expect(sanitizeText("hello,")).toBe("hello");
      
      // Multiple trailing punctuations (blocks)
      expect(sanitizeText("hello!?!!")).toBe("hello");
      expect(sanitizeText("hello...,,,,")).toBe("hello");
      
      // Punctuations in the middle should not be removed
      expect(sanitizeText("hello, world.")).toBe("hello, world");
      expect(sanitizeText("is this real? yes.")).toBe("is this real? yes");
      expect(sanitizeText("mr. smith")).toBe("mr. smith");
    });
    
    test("should handle empty or nullish strings", () => {
      expect(sanitizeText("")).toBe("");
      expect(sanitizeText(null as unknown as string)).toBe("");
    });
  });

  test.describe("2. Levenshtein Distance", () => {
    test("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
      expect(levenshteinDistance("", "")).toBe(0);
    });

    test("should detect single deletions", () => {
      expect(levenshteinDistance("cat", "ca")).toBe(1);
      expect(levenshteinDistance("apple", "aple")).toBe(1);
    });

    test("should detect single insertions", () => {
      expect(levenshteinDistance("cat", "cats")).toBe(1);
      expect(levenshteinDistance("aple", "apple")).toBe(1);
    });

    test("should detect single substitutions", () => {
      expect(levenshteinDistance("cat", "cot")).toBe(1);
      expect(levenshteinDistance("apple", "opple")).toBe(1);
    });

    test("should return correct distance for multiple edits", () => {
      // substitution (e->o) + insertion (s)
      expect(levenshteinDistance("elephant", "elephonts")).toBe(2);
      // deletion + substitution
      expect(levenshteinDistance("abcdef", "azcde")).toBe(2);
    });
  });

  test.describe("3. Fill Blank Evaluator", () => {
    test("should verify typo limits logic based on length", () => {
      // length <= 3 (0 typos allowed)
      expect(getTypoLimit(1)).toBe(0);
      expect(getTypoLimit(3)).toBe(0);
      
      // length 4-7 (1 typo allowed)
      expect(getTypoLimit(4)).toBe(1);
      expect(getTypoLimit(7)).toBe(1);
      
      // length >= 8 (2 typos allowed)
      expect(getTypoLimit(8)).toBe(2);
      expect(getTypoLimit(15)).toBe(2);
    });

    test("should reject length <= 3 with 1 typo", () => {
      // answer = "cat" (len=3, limit=0)
      // input = "cot" (dist=1) -> Reject
      const res = evaluateFillBlank("cot", "cat");
      expect(res.isCorrect).toBe(false);
      expect(res.distance).toBe(1);
      expect(res.typoLimit).toBe(0);
    });

    test("should accept length <= 3 with 0 typos", () => {
      const res = evaluateFillBlank("cat", "cat");
      expect(res.isCorrect).toBe(true);
      expect(res.distance).toBe(0);
    });

    test("should accept length 4-7 with 1 typo", () => {
      // answer = "apple" (len=5, limit=1)
      // input = "aple" (dist=1) -> Accept
      const res = evaluateFillBlank("aple", "apple");
      expect(res.isCorrect).toBe(true);
      expect(res.distance).toBe(1);
      expect(res.typoLimit).toBe(1);
    });

    test("should reject length 4-7 with 2 typos", () => {
      // answer = "apple" (len=5, limit=1)
      // input = "aples" (dist=2) -> Reject
      const res = evaluateFillBlank("aples", "apple");
      expect(res.isCorrect).toBe(false);
      expect(res.distance).toBe(2);
    });

    test("should accept length >= 8 with 2 typos", () => {
      // answer = "elephant" (len=8, limit=2)
      // input = "elephents" (dist=2) -> Accept
      const res = evaluateFillBlank("elephents", "elephant");
      expect(res.isCorrect).toBe(true);
      expect(res.distance).toBe(2);
      expect(res.typoLimit).toBe(2);
    });

    test("should reject length >= 8 with 3 typos", () => {
      // answer = "elephant" (len=8, limit=2)
      // input = "elephontss" (dist=3) -> Reject
      const res = evaluateFillBlank("elephontss", "elephant");
      expect(res.isCorrect).toBe(false);
      expect(res.distance).toBe(3);
    });

    test("should match against accepted_variants (camelCase and snake_case)", () => {
      // answer = "color"
      // input = "colour"
      // variants = ["colour", "colors"]
      const res1 = evaluateFillBlank("colour", "color", ["colour"]);
      expect(res1.isCorrect).toBe(true);
      expect(res1.matchedText).toBe("colour");
      expect(res1.distance).toBe(0);
      
      const res2 = evaluateFillBlank("colour", "color", [], ["colour"]);
      expect(res2.isCorrect).toBe(true);
      expect(res2.matchedText).toBe("colour");
      
      // Matching a variant with 1 typo allowed
      // variant = "banana" (len=6, limit=1)
      // input = "banan" (dist=1) -> Accept
      const res3 = evaluateFillBlank("banan", "apple", ["banana"]);
      expect(res3.isCorrect).toBe(true);
      expect(res3.matchedText).toBe("banana");
      expect(res3.distance).toBe(1);
    });
  });

  test.describe("4. Score Accumulator", () => {
    test("should calculate correct percentage across mixed pools", () => {
      const sections = [
        { correctCount: 3, totalCount: 4 }, // 75%
        { correctCount: 2, totalCount: 2 }, // 100%
        { correctCount: 1, totalCount: 4 }  // 25%
      ];
      // Total correct = 3 + 2 + 1 = 6
      // Total questions = 4 + 2 + 4 = 10
      // 6 / 10 = 60%
      expect(calculateSessionScore(sections)).toBe(60);
    });

    test("should round to the nearest integer", () => {
      // 2 correct out of 3 -> 66.66% -> 67%
      expect(calculateSessionScore([{ correctCount: 2, totalCount: 3 }])).toBe(67);
      
      // 1 correct out of 3 -> 33.33% -> 33%
      expect(calculateSessionScore([{ correctCount: 1, totalCount: 3 }])).toBe(33);
    });

    test("should handle division by zero (totalCount = 0)", () => {
      expect(calculateSessionScore([])).toBe(0);
      expect(calculateSessionScore([{ correctCount: 0, totalCount: 0 }])).toBe(0);
    });

    test("should clamp negative and invalid values to safe numbers", () => {
      const sections = [
        { correctCount: -2, totalCount: 5 }, // -2 -> 0 -> 0%
        { correctCount: 10, totalCount: 5 }  // correct > total -> 5/5 -> 100%
      ];
      // total correct = 0 + 5 = 5
      // total questions = 5 + 5 = 10
      // 5 / 10 = 50%
      expect(calculateSessionScore(sections)).toBe(50);
    });
  });

  test.describe("5. Band Mapper Matrix", () => {
    test("should map A1 scores correctly", () => {
      expect(mapScoreToBand("A1", 0)).toBe("Band 2.0");
      expect(mapScoreToBand("A1", 39)).toBe("Band 2.0");
      expect(mapScoreToBand("A1", 40)).toBe("Band 2.5");
      expect(mapScoreToBand("A1", 69)).toBe("Band 2.5");
      expect(mapScoreToBand("A1", 70)).toBe("Band 3.0");
      expect(mapScoreToBand("A1", 100)).toBe("Band 3.0");
    });

    test("should map A2 scores correctly", () => {
      expect(mapScoreToBand("A2", 20)).toBe("Band 2.5");
      expect(mapScoreToBand("A2", 29)).toBe("Band 2.5");
      expect(mapScoreToBand("A2", 30)).toBe("Band 3.0");
      expect(mapScoreToBand("A2", 59)).toBe("Band 3.0");
      expect(mapScoreToBand("A2", 60)).toBe("Band 3.5");
      expect(mapScoreToBand("A2", 84)).toBe("Band 3.5");
      expect(mapScoreToBand("A2", 85)).toBe("Band 4.0");
      expect(mapScoreToBand("A2", 100)).toBe("Band 4.0");
    });

    test("should map B1 scores correctly", () => {
      expect(mapScoreToBand("b1", 20)).toBe("Band 3.5");
      expect(mapScoreToBand("b1", 30)).toBe("Band 4.0");
      expect(mapScoreToBand("b1", 55)).toBe("Band 4.5");
      expect(mapScoreToBand("b1", 80)).toBe("Band 5.0");
    });

    test("should map B2 scores correctly", () => {
      expect(mapScoreToBand("B2", 20)).toBe("Band 4.5");
      expect(mapScoreToBand("B2", 30)).toBe("Band 5.0");
      expect(mapScoreToBand("B2", 55)).toBe("Band 5.5");
      expect(mapScoreToBand("B2", 80)).toBe("Band 6.0");
    });

    test("should map C1 scores correctly", () => {
      expect(mapScoreToBand("c1", 20)).toBe("Band 5.5");
      expect(mapScoreToBand("c1", 30)).toBe("Band 6.0");
      expect(mapScoreToBand("c1", 55)).toBe("Band 6.5");
      expect(mapScoreToBand("c1", 75)).toBe("Band 7.0");
      expect(mapScoreToBand("c1", 90)).toBe("Band 7.5");
    });

    test("should map C2 scores correctly", () => {
      expect(mapScoreToBand("C2", 29)).toBe("Band 6.5");
      expect(mapScoreToBand("C2", 30)).toBe("Band 7.0");
      expect(mapScoreToBand("C2", 49)).toBe("Band 7.0");
      expect(mapScoreToBand("C2", 50)).toBe("Band 7.5");
      expect(mapScoreToBand("C2", 69)).toBe("Band 7.5");
      expect(mapScoreToBand("C2", 70)).toBe("Band 8.0");
      expect(mapScoreToBand("C2", 89)).toBe("Band 8.0");
      expect(mapScoreToBand("C2", 90)).toBe("Band 8.5+");
      expect(mapScoreToBand("C2", 100)).toBe("Band 8.5+");
    });

    test("should handle generic fallback for unknown level or empty input", () => {
      expect(mapScoreToBand("XX", 20)).toBe("Band 2.0");
      expect(mapScoreToBand("XX", 50)).toBe("Band 4.0");
      expect(mapScoreToBand("XX", 99)).toBe("Band 7.0");
    });

    test("should clamp scores outside 0-100", () => {
      expect(mapScoreToBand("A1", -50)).toBe("Band 2.0");
      expect(mapScoreToBand("A1", 150)).toBe("Band 3.0");
    });
  });
});
