/**
 * TASK-052L — Phase 2 Privacy QA
 *
 * Comprehensive privacy/security audit for the Phase 2 Learning Path implementation.
 * Covers:
 *  1. Static source file scans for forbidden API / storage / AI / audio patterns
 *  2. Curriculum serialization scan
 *  3. DOM privacy scan (Phase 2 visible)
 *  4. localStorage privacy scan after Phase 2 interactions
 *  5. Renderer-specific privacy checks (per card type)
 *  6. Dev/test hook audit
 *  7. Tutor voice helper audit (browser-only TTS)
 *  8. Copy safety (no harsh/punitive wording)
 *  9. Regression (existing tests still pass)
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

/** Phase 2 source files that must be audited */
const PHASE2_SOURCE_FILES = [
  "src/app/lib/learning-path/types.ts",
  "src/app/lib/learning-path/phase2-curriculum.ts",
  "src/app/lib/learning-path/curriculum.ts",
  "src/app/lib/learning-path/recommendation.ts",
  "src/app/components/LearningPathView.tsx",
  "src/app/components/learning-path/MicroLessonShell.tsx",
  "src/app/components/learning-path/MicroSpeakingLesson.tsx",
  "src/app/components/learning-path/SentenceBuilderLesson.tsx",
  "src/app/components/learning-path/SupportedConversationLesson.tsx",
  "src/app/components/learning-path/PronunciationAwarenessLesson.tsx",
  "src/app/components/learning-path/ReflectionCardLesson.tsx",
];

/**
 * Patterns that must NOT appear in Phase 2 source files.
 * Each entry is [label, regex].
 * Note: "recorded" as a local UI *state name* is safe and excluded via context.
 */
const FORBIDDEN_SOURCE_PATTERNS: Array<[string, RegExp]> = [
  // Speech-to-text / microphone capture
  ["speechToText", /speechToText/],
  ["SpeechRecognition (constructor)", /new SpeechRecognition|new webkitSpeechRecognition/],
  ["MediaRecorder", /new MediaRecorder|MediaRecorder\(/],
  ["getUserMedia", /getUserMedia\s*\(/],
  // Audio storage / upload
  ["audioBlob", /audioBlob/],
  ["Blob constructor for audio", /new Blob\(\s*\[.*audio/i],
  ["recordingUrl", /recordingUrl/],
  ["upload audio", /upload\s+audio/i],
  // Raw learner data
  ["rawLearnerSentence", /rawLearnerSentence/],
  ["exactLearnerSentence", /exactLearnerSentence/],
  ["rawPayload", /rawPayload/],
  // PII fields
  ["owner_id", /owner_id/],
  ["source_id", /source_id/],
  ["userId storage", /localStorage.*userId|sessionStorage.*userId/],
  ["sessionId storage", /localStorage.*sessionId|sessionStorage.*sessionId/],
  // AI providers
  ["OpenAI import", /from ['"]openai['"]/],
  ["Anthropic import", /from ['"]@anthropic/],
  ["generateText call", /generateText\s*\(/],
  ["generateObject call", /generateObject\s*\(/],
  ["chat.completions", /chat\.completions/],
  ["providerResponse", /providerResponse/],
  // Backend write calls in frontend components
  ["supabase.from().insert() in component", /supabase\.from\([^)]+\)\s*\.insert\(/],
  ["supabase.from().upsert() in component", /supabase\.from\([^)]+\)\s*\.upsert\(/],
  ["new API route call fetch /api/", /fetch\s*\(\s*['"]\/api\//],
  // localStorage schema migrations
  ["localStorage.setItem schema migration", /localStorage\.setItem\s*\(\s*['"]lp_schema_version/],
];

/**
 * Terms forbidden in serialized Phase 2 curriculum JSON.
 */
const FORBIDDEN_CURRICULUM_TERMS = [
  "transcript",
  "retryTranscript",
  "speechToText",
  "audioBlob",
  "recordingUrl",
  "rawLearnerSentence",
  "exactLearnerSentence",
  "providerResponse",
  "email",
  "owner_id",
  "source_id",
  "userId",
  "sessionId",
  "rawPayload",
  "articleUrl",
  "privateNote",
  // Clinical / diagnostic labels
  "disorder",
  "diagnosis",
  "clinical",
  "pathological",
  "psychological profil",
  "AI scoring",
  "pronunciationScore",
  "grammarScore",
  "phonemeScore",
  "confidenceScore",
  "free speaking",
  "open roleplay",
  "final exam",
];

/**
 * Terms forbidden in DOM text content.
 */
const FORBIDDEN_DOM_TERMS = [
  "transcript",
  "speechToText",
  "audioBlob",
  "recordingUrl",
  "rawLearnerSentence",
  "owner_id",
  "source_id",
  "rawPayload",
  "AI scoring",
  "pronunciationScore",
  "grammarScore",
  "phonemeScore",
  "disorder",
  "diagnosis",
  "clinical",
  "final exam",
  "open roleplay",
];

/**
 * Terms forbidden in localStorage values after Phase 2 card interaction.
 */
const FORBIDDEN_LOCALSTORAGE_TERMS = [
  "transcript",
  "speechToText",
  "audioBlob",
  "recordingUrl",
  "rawLearnerSentence",
  "exactLearnerSentence",
  "privateNote",
  "owner_id",
  "source_id",
  "rawPayload",
  "providerResponse",
  "pronunciationScore",
  "grammarScore",
  "phonemeScore",
  "email",
];

/**
 * Harsh / punitive copy terms that must not appear in Phase 2 source or DOM.
 */
const HARSH_WORDING_PATTERNS: Array<[string, RegExp]> = [
  ["failed (as standalone verdict)", /\bfailed\b/i],
  ["failure verdict", /\bfailure\b/i],
  ["bad pronunciation", /bad\s+pronunciation/i],
  ["weak grammar", /weak\s+grammar/i],
  ["deficient", /\bdeficient\b/i],
  ["disorder", /\bdisorder\b/i],
  ["wrong speaker", /wrong\s+speaker/i],
  ["clinical diagnosis", /clinical\s+diagnosis/i],
  ["psychological diagnosis", /psychological\s+diagnosis/i],
];

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe("Phase 2 Privacy QA (TASK-052L)", () => {

  // -------------------------------------------------------------------------
  // 1. Static source scan
  // -------------------------------------------------------------------------
  test("1. Static Phase 2 source files contain no forbidden API/storage/AI/audio-processing patterns", () => {
    const violations: string[] = [];

    for (const relPath of PHASE2_SOURCE_FILES) {
      const src = readSrc(relPath);
      for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
        if (pattern.test(src)) {
          violations.push(`[${relPath}] found forbidden pattern: ${label}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        "Phase 2 source files contain forbidden patterns:\n" + violations.join("\n")
      );
    }
  });

  // -------------------------------------------------------------------------
  // 2. Curriculum serialization scan
  // -------------------------------------------------------------------------
  test("2. Serialized Phase 2 curriculum contains no forbidden private/scoring/free-speaking terms", () => {
    // Dynamically require the curriculum module via reading its file content
    // We test the raw file content to avoid needing a full module resolution.
    const curriculumSrc = readSrc("src/app/lib/learning-path/phase2-curriculum.ts");
    const violations: string[] = [];

    for (const term of FORBIDDEN_CURRICULUM_TERMS) {
      if (curriculumSrc.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden curriculum term: "${term}"`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        "Phase 2 curriculum source contains forbidden terms:\n" + violations.join("\n")
      );
    }
  });

  // -------------------------------------------------------------------------
  // 3. DOM privacy scan — Phase 2 visible
  // -------------------------------------------------------------------------
  test("3. Learning Path DOM with Phase 2 visible contains no forbidden terms", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    // Wait for Phase 2 to be in the DOM
    await expect(page.locator("[data-testid='phase-everyday-interaction']")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    const violations: string[] = [];

    for (const term of FORBIDDEN_DOM_TERMS) {
      // Case-insensitive, but avoid false positives by checking as substring
      if (bodyText.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden DOM term: "${term}"`);
      }
    }

    // Also verify no raw JS object key patterns leak
    const bodyHTML = await page.locator("body").innerHTML();
    const htmlForbidden = ["rawPayload", "audioBlob", "transcript", "owner_id"];
    for (const term of htmlForbidden) {
      if (bodyHTML.includes(term)) {
        violations.push(`Found forbidden HTML term: "${term}"`);
      }
    }

    if (violations.length > 0) {
      throw new Error("DOM privacy violations:\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 4. localStorage privacy scan — supported-conversation interaction
  // -------------------------------------------------------------------------
  test("4. Interacting with a supported-conversation card does not write forbidden data to localStorage", async ({ page }) => {
    await page.goto("/");
    // Reset progress to start clean
    await page.getByRole("button", { name: "Learning Path" }).click();

    // Navigate to the shell via the DEV hook if available, or simulate directly
    // by evaluating JS that fires the card open. We use the dev hook (NODE_ENV=test).
    const cardOpened = await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)["__DEV_TEST_ONLY_OPEN_CARD__"];
      if (typeof hook !== "function") return false;
      // Minimal supported-conversation card stub
      hook({
        id: "priv-qa-conv-card",
        dayNumber: 19,
        unitId: "asking-and-answering",
        type: "supported-conversation",
        title: "Privacy QA Conversation",
        targetPhrases: ["I am fine"],
        learnerInstruction: "Select a response.",
        indonesianExplanation: "Pilih jawaban.",
        scaffold: "tutor: How are you?",
        cta: "Select",
        estimatedMinutes: 3,
        completionRule: "completed",
        linkedEngine: "supported-conversation",
        mobileLayoutHint: "standard",
        conversationPrompt: {
          tutorTurn: "How are you?",
          options: [
            { id: "opt-1", text: "I am fine. And you?" },
            { id: "opt-2", text: "How about you?" },
          ],
        },
      });
      return true;
    });

    if (cardOpened) {
      // Shell is open — interact with it
      const shell = page.locator("[data-testid='micro-lesson-shell']");
      await expect(shell).toBeVisible();

      // Select a conversation option
      const opts = shell.locator("[data-testid='supported-conversation-option']");
      if (await opts.count() > 0) {
        await opts.first().click();
      }

      // Close the shell
      await shell.getByTestId("close-lesson-btn").click();
    }

    // Scope scan to app-owned keys only (prefix 'fonetik:').
    // Third-party auth (Clerk) writes its own data (e.g. email) to localStorage;
    // that is outside the Phase 2 privacy contract and must not be tested here.
    const storageSnapshot = await page.evaluate(() => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith("fonetik:")) {
          entries[key] = localStorage.getItem(key) || "";
        }
      }
      return entries;
    });

    const allValues = JSON.stringify(storageSnapshot);
    const violations: string[] = [];
    for (const term of FORBIDDEN_LOCALSTORAGE_TERMS) {
      if (allValues.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden localStorage term: "${term}"`);
      }
    }

    if (violations.length > 0) {
      throw new Error("localStorage privacy violations (supported-conversation):\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 5. localStorage privacy scan — pronunciation-awareness interaction
  // -------------------------------------------------------------------------
  test("5. Interacting with a pronunciation-awareness card does not write forbidden data to localStorage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)["__DEV_TEST_ONLY_OPEN_CARD__"];
      if (typeof hook === "function") {
        hook({
          id: "priv-qa-pron-card",
          dayNumber: 16,
          unitId: "asking-and-answering",
          type: "pronunciation-awareness",
          title: "Privacy QA Pronunciation",
          targetPhrases: ["this", "that"],
          learnerInstruction: "Listen and select.",
          indonesianExplanation: "Pilih.",
          scaffold: "Listen and select the word you hear.",
          cta: "Select",
          estimatedMinutes: 2,
          completionRule: "completed",
          linkedEngine: "pronunciation-awareness",
          mobileLayoutHint: "standard",
          pronunciationFocus: {
            pairs: [{ wordA: "this", wordB: "that", correct: "A" }],
            instruction: "Choose the correct word.",
          },
        });
      }
    });

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    if (await shell.isVisible()) {
      // Select an option
      const opts = shell.locator("[data-testid='pronunciation-pair-option']");
      if (await opts.count() > 0) {
        await opts.first().click();
      }
      await shell.getByTestId("close-lesson-btn").click();
    }

    // Scope to app-owned keys only — Clerk auth writes its own data (e.g. email)
    // to localStorage, which is outside the Phase 2 privacy contract.
    const allValues = JSON.stringify(await page.evaluate(() => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith("fonetik:")) {
          entries[key] = localStorage.getItem(key) || "";
        }
      }
      return entries;
    }));

    const violations: string[] = [];
    for (const term of FORBIDDEN_LOCALSTORAGE_TERMS) {
      if (allValues.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden localStorage term: "${term}"`);
      }
    }

    if (violations.length > 0) {
      throw new Error("localStorage privacy violations (pronunciation-awareness):\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 6. localStorage privacy scan — reflection-card interaction
  // -------------------------------------------------------------------------
  test("6. Interacting with a reflection-card does not write forbidden data to localStorage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)["__DEV_TEST_ONLY_OPEN_CARD__"];
      if (typeof hook === "function") {
        hook({
          id: "priv-qa-reflection-card",
          dayNumber: 20,
          unitId: "asking-and-answering",
          type: "reflection-card",
          title: "Privacy QA Reflection",
          targetPhrases: ["I can ask questions"],
          learnerInstruction: "Reflect on your progress.",
          indonesianExplanation: "Renungkan.",
          scaffold: "Select how confident you feel.",
          cta: "Select",
          estimatedMinutes: 2,
          completionRule: "completed",
          linkedEngine: "reflection-card",
          mobileLayoutHint: "standard",
          reflectionPrompt: {
            question: "How confident did you feel?",
            options: ["Very confident", "Okay", "Need more practice"],
          },
        });
      }
    });

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    if (await shell.isVisible()) {
      const opts = shell.locator("[data-testid='reflection-option']");
      if (await opts.count() > 0) {
        await opts.first().click();
      }
      await shell.getByTestId("close-lesson-btn").click();
    }

    // Scope to app-owned keys only — Clerk auth writes its own data (e.g. email)
    // to localStorage, which is outside the Phase 2 privacy contract.
    const allValues = JSON.stringify(await page.evaluate(() => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith("fonetik:")) {
          entries[key] = localStorage.getItem(key) || "";
        }
      }
      return entries;
    }));

    const violations: string[] = [];
    for (const term of FORBIDDEN_LOCALSTORAGE_TERMS) {
      if (allValues.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden localStorage term: "${term}"`);
      }
    }

    if (violations.length > 0) {
      throw new Error("localStorage privacy violations (reflection-card):\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 7. Fluency sprint source: no scoring / pass-fail / transcript wording
  // -------------------------------------------------------------------------
  test("7. Fluency sprint UI source contains no scoring/pass-fail/transcript wording", () => {
    const src = readSrc("src/app/components/learning-path/MicroSpeakingLesson.tsx");

    const forbidden: Array<[string, RegExp]> = [
      ["transcript variable", /\btranscript\b/],
      ["score variable", /\bscore\b/],
      ["pronunciation score", /pronunciationScore|pronunciation_score/i],
      ["grammar score", /grammarScore|grammar_score/i],
      ["phoneme score", /phonemeScore|phoneme_score/i],
      ["pass wording", /\byou passed\b|\bpass\b.*\btest\b/i],
      ["fail wording (standalone verdict)", /\byou failed\b|\bfailed\b.*\btest\b/i],
      ["SpeechRecognition", /SpeechRecognition/],
      ["MediaRecorder", /MediaRecorder/],
      ["getUserMedia", /getUserMedia/],
    ];

    const violations: string[] = [];
    for (const [label, pattern] of forbidden) {
      if (pattern.test(src)) {
        violations.push(`Fluency sprint: found "${label}"`);
      }
    }

    // Positive checks: timer is present (guidance only), no pass/fail verdict
    expect(src).toContain("remainingSeconds");          // timer countdown
    expect(src).toContain("Fluency Arena");             // arena label
    expect(src).not.toContain("you passed");
    expect(src).not.toContain("you failed");
    expect(src).not.toContain("your score is");

    if (violations.length > 0) {
      throw new Error("Fluency sprint privacy violations:\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 8. Progressive builder source: no free text input / grammar scoring
  // -------------------------------------------------------------------------
  test("8. Progressive builder source contains no free text input or grammar scoring", () => {
    const src = readSrc("src/app/components/learning-path/SentenceBuilderLesson.tsx");

    // Must NOT contain
    expect(src).not.toMatch(/\<input\s[^>]*type=['"]text['"]/i);  // free text input
    expect(src).not.toMatch(/grammarScore|grammar_score/i);
    expect(src).not.toMatch(/pronunciationScore|pronunciation_score/i);
    expect(src).not.toMatch(/AI.*grammar|grammar.*AI/i);
    expect(src).not.toMatch(/rawLearnerSentence|exactLearnerSentence/);
    expect(src).not.toMatch(/SpeechRecognition|MediaRecorder|getUserMedia/);

    // Must contain predefined choices only
    expect(src).toContain("progressiveSlots");
    expect(src).toContain("choices");
    expect(src).toContain("isCorrect");

    // Privacy note must be present
    expect(src).toContain("No private sentence is stored");
  });

  // -------------------------------------------------------------------------
  // 9. Supported conversation source: scripted only, no free chat / AI
  // -------------------------------------------------------------------------
  test("9. Supported conversation source: scripted only, no free chat or AI wording", () => {
    const src = readSrc("src/app/components/learning-path/SupportedConversationLesson.tsx");

    expect(src).not.toMatch(/generateText|generateObject|chat\.completions/);
    expect(src).not.toMatch(/free\s+chat|open\s+roleplay/i);
    expect(src).not.toMatch(/transcript/);
    expect(src).not.toMatch(/grammarScore|pronunciationScore|phonemeScore/i);
    expect(src).not.toMatch(/SpeechRecognition|MediaRecorder|getUserMedia/);
    expect(src).not.toMatch(/rawLearnerSentence|exactLearnerSentence|privateNote/);

    // Must use scripted prompt + fixed options
    expect(src).toContain("conversationPrompt");
    expect(src).toContain("options");
    expect(src).toContain("tutorTurn");

    // Privacy note must appear
    expect(src).toContain("No speech is scored or stored");
  });

  // -------------------------------------------------------------------------
  // 10. Pronunciation awareness source: fixed-choice only, no scoring / analysis
  // -------------------------------------------------------------------------
  test("10. Pronunciation awareness source: fixed-choice only, no phoneme scoring or speech analysis", () => {
    const src = readSrc("src/app/components/learning-path/PronunciationAwarenessLesson.tsx");

    expect(src).not.toMatch(/phonemeScore|phoneme_score/i);
    expect(src).not.toMatch(/pronunciationScore|pronunciation_score/i);
    expect(src).not.toMatch(/SpeechRecognition|MediaRecorder|getUserMedia/);
    expect(src).not.toMatch(/rawLearnerSentence|transcript/);
    expect(src).not.toMatch(/generateText|generateObject/);

    // Must use minimal-pair fixed choices
    expect(src).toContain("pronunciationFocus");
    expect(src).toContain("pairs");
    expect(src).toContain("wordA");
    expect(src).toContain("wordB");

    // Privacy note
    expect(src).toContain("No speech is scored or stored");
  });

  // -------------------------------------------------------------------------
  // 11. Reflection card source: fixed options only, no private notes or clinical labels
  // -------------------------------------------------------------------------
  test("11. Reflection card source: fixed options only, no private notes or clinical/diagnostic labels", () => {
    const src = readSrc("src/app/components/learning-path/ReflectionCardLesson.tsx");

    expect(src).not.toMatch(/privateNote|freeTextReflection/i);
    expect(src).not.toMatch(/<textarea/i);
    expect(src).not.toMatch(/clinical|diagnostic|psychological\s+profil/i);
    expect(src).not.toMatch(/confidenceScore|confidence_score/i);
    expect(src).not.toMatch(/grammarScore|pronunciationScore|phonemeScore/i);
    expect(src).not.toMatch(/SpeechRecognition|MediaRecorder|getUserMedia/);

    // Must use fixed options
    expect(src).toContain("reflectionPrompt");
    expect(src).toContain("options");

    // Privacy note
    expect(src).toContain("No private note is stored");
  });

  // -------------------------------------------------------------------------
  // 12. Dev/test hook audit
  // -------------------------------------------------------------------------
  test("12. Dev/test hook __DEV_TEST_ONLY_OPEN_CARD__ is production-guarded if present", () => {
    const src = readSrc("src/app/components/LearningPathView.tsx");

    const hasHook = src.includes("__DEV_TEST_ONLY_OPEN_CARD__");
    if (hasHook) {
      // Must be guarded by NODE_ENV !== 'production'
      expect(src).toMatch(/NODE_ENV\s*!==\s*['"]production['"]/);
      // Must be deleted on unmount (cleanup)
      expect(src).toContain("delete");
      // Must not exist without the guard
      const hookIdx = src.indexOf("__DEV_TEST_ONLY_OPEN_CARD__");
      const beforeHook = src.slice(0, hookIdx);
      // Ensure the NODE_ENV guard precedes the hook assignment
      expect(beforeHook).toMatch(/NODE_ENV/);
    }
    // If hook is absent, test passes trivially — that's also acceptable.
  });

  // -------------------------------------------------------------------------
  // 13. Tutor voice / TTS audit: browser-only, no external provider
  // -------------------------------------------------------------------------
  test("13. TTS in Phase 2 renderers uses browser SpeechSynthesis only, no external provider", () => {
    const renderers = [
      "src/app/components/learning-path/MicroSpeakingLesson.tsx",
      "src/app/components/learning-path/SentenceBuilderLesson.tsx",
      "src/app/components/learning-path/SupportedConversationLesson.tsx",
      "src/app/components/learning-path/PronunciationAwarenessLesson.tsx",
    ];
    const tutorVoiceHelper = "src/app/lib/speech/tutor-voice.ts";
    const helperSrc = readSrc(tutorVoiceHelper);

    expect(helperSrc, "Tutor voice helper should use browser SpeechSynthesis").toContain("SpeechSynthesisUtterance");
    expect(helperSrc, "Tutor voice helper should speak through browser speechSynthesis").toContain("window.speechSynthesis.speak");
    expect(helperSrc, "Tutor voice helper should have unsupported-browser fallback").toContain("canUseTutorVoice");
    expect(helperSrc, "Tutor voice helper must not call external TTS API").not.toMatch(/fetch\s*\(\s*['"]https?:\/\/.*tts/i);
    expect(helperSrc, "Tutor voice helper must not import TTS SDK").not.toMatch(/from ['"]@google-cloud\/text-to-speech|elevenlabs|deepgram/i);
    expect(helperSrc, "Tutor voice helper must not capture microphone input").not.toMatch(/getUserMedia\s*\(|MediaRecorder|SpeechRecognition|webkitSpeechRecognition/);
    expect(helperSrc, "Tutor voice helper must not store or upload audio").not.toMatch(/upload.*audio|audioBlob|recordingUrl/i);
    expect(helperSrc, "Tutor voice helper must not perform speech scoring").not.toMatch(/score|phoneme|pronunciationAccuracy/i);

    for (const relPath of renderers) {
      const src = readSrc(relPath);
      const usesInlineSpeechSynthesis = src.includes("SpeechSynthesisUtterance");
      const usesTutorVoiceHelper = src.includes("speakTutorPhrase") || src.includes("speechSynthesis");

      // May use browser SpeechSynthesis directly or via the shared tutor voice helper.
      expect(
        usesInlineSpeechSynthesis || usesTutorVoiceHelper,
        `${relPath} should use browser-native tutor voice directly or via helper`
      ).toBe(true);
      // Must NOT use fetch to an external TTS endpoint
      expect(src, `${relPath} must not call external TTS API`).not.toMatch(/fetch\s*\(\s*['"]https?:\/\/.*tts/i);
      // Must NOT import any TTS SDK
      expect(src, `${relPath} must not import TTS SDK`).not.toMatch(/from ['"]@google-cloud\/text-to-speech|elevenlabs|deepgram/i);
      // Must NOT upload audio
      expect(src, `${relPath} must not upload audio`).not.toMatch(/upload.*audio|audioBlob|recordingUrl/i);
      // Must NOT capture or score learner speech
      expect(src, `${relPath} must not capture microphone input`).not.toMatch(/getUserMedia\s*\(|MediaRecorder|SpeechRecognition|webkitSpeechRecognition/);
      expect(src, `${relPath} must not perform speech scoring`).not.toMatch(/phoneme|pronunciationAccuracy|aiScore/i);
      // Must have fallback for unsupported browsers (setTimeout fallback)
      expect(
        src.includes("setTimeout") || src.includes("canUseTutorVoice"),
        `${relPath} should have fallback for unsupported TTS directly or via helper`
      ).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // 14. Copy safety: no harsh/punitive wording in Phase 2 source files
  // -------------------------------------------------------------------------
  test("14. Phase 2 source files contain no harsh/punitive wording", () => {
    const violations: string[] = [];

    // Allowlist: terms that are safe in certain contexts (e.g., "failed" as a
    // try/catch label in infrastructure code is fine; we only check component files)
    const componentFiles = [
      "src/app/components/learning-path/MicroSpeakingLesson.tsx",
      "src/app/components/learning-path/SentenceBuilderLesson.tsx",
      "src/app/components/learning-path/SupportedConversationLesson.tsx",
      "src/app/components/learning-path/PronunciationAwarenessLesson.tsx",
      "src/app/components/learning-path/ReflectionCardLesson.tsx",
      "src/app/components/learning-path/MicroLessonShell.tsx",
      "src/app/lib/learning-path/phase2-curriculum.ts",
    ];

    for (const relPath of componentFiles) {
      const src = readSrc(relPath);
      for (const [label, pattern] of HARSH_WORDING_PATTERNS) {
        if (pattern.test(src)) {
          violations.push(`[${relPath}] found harsh wording: ${label}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error("Harsh wording found in Phase 2 files:\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 15. Phase 2 UI renders correctly and Phase 2 elements are visible in DOM
  // -------------------------------------------------------------------------
  test("15. Phase 2 UI renders: title, units, days 15-28 visible, no forbidden terms in visible text", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    // Phase 2 section
    await expect(page.locator("text=Everyday Interaction")).toBeVisible();

    // Unit 3 and 4
    await expect(page.locator("[data-testid='unit-asking-and-answering']")).toBeVisible();
    // Days 15-28 should be in the DOM
    for (let day = 15; day <= 28; day++) {
      const dayEl = page.locator(`[data-testid='day-${day}']`);
      await expect(dayEl, `Day ${day} should be visible`).toBeVisible();
    }

    // Privacy DOM check for Phase 2 section specifically
    const phase2Section = page.locator("[data-testid='phase-everyday-interaction']");
    const phase2Text = await phase2Section.innerText();

    const violations: string[] = [];
    for (const term of FORBIDDEN_DOM_TERMS) {
      if (phase2Text.toLowerCase().includes(term.toLowerCase())) {
        violations.push(`Found forbidden term in Phase 2 DOM: "${term}"`);
      }
    }
    if (violations.length > 0) {
      throw new Error("Phase 2 DOM privacy violations:\n" + violations.join("\n"));
    }
  });

  // -------------------------------------------------------------------------
  // 16. Regression: existing Phase 1 behavior unaffected
  // -------------------------------------------------------------------------
  test("16. Regression: Phase 1 still renders correctly and Day 1 is recommended on fresh start", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    // Phase 1 should still render
    await expect(page.locator("text=Confidence Foundation")).toBeVisible();
    await expect(page.locator("[data-testid='unit-introduce-yourself']")).toBeVisible();
    await expect(page.locator("[data-testid='unit-my-daily-life']")).toBeVisible();

    // Days 1-14 should all be present
    for (let day = 1; day <= 14; day++) {
      await expect(
        page.locator(`[data-testid='day-${day}']`),
        `Day ${day} should be visible`
      ).toBeVisible();
    }

    // Sidebar recommendation should point to Day 1 on fresh state
    const missionSidebar = page.locator("[data-testid='mission-sidebar']");
    await expect(missionSidebar).toContainText("Day 1 Recommended");
    await expect(missionSidebar).toContainText("Greeting Someone");
  });

  // -------------------------------------------------------------------------
  // 17. Shell safety: shell renders Phase 2 cards without exposing forbidden data
  // -------------------------------------------------------------------------
  test("17. MicroLessonShell renders Phase 2 card types safely without forbidden DOM terms", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Learning Path" }).click();

    // Open a Phase 2 reflection card via dev hook
    await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)["__DEV_TEST_ONLY_OPEN_CARD__"];
      if (typeof hook === "function") {
        hook({
          id: "priv-qa-shell-reflection",
          dayNumber: 20,
          unitId: "asking-and-answering",
          type: "reflection-card",
          title: "Shell Safety Check",
          targetPhrases: ["I feel confident"],
          learnerInstruction: "Reflect on your confidence.",
          indonesianExplanation: "Renungkan.",
          scaffold: "Select how confident you feel.",
          cta: "Select",
          estimatedMinutes: 2,
          completionRule: "completed",
          linkedEngine: "reflection-card",
          mobileLayoutHint: "standard",
          reflectionPrompt: {
            question: "How confident did you feel with this unit?",
            options: ["Very confident", "Okay", "Need more practice"],
          },
        });
      }
    });

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    if (await shell.isVisible({ timeout: 3000 }).catch(() => false)) {
      const shellText = await shell.innerText();
      const violations: string[] = [];
      for (const term of FORBIDDEN_DOM_TERMS) {
        if (shellText.toLowerCase().includes(term.toLowerCase())) {
          violations.push(`Shell DOM contains forbidden term: "${term}"`);
        }
      }
      // Also verify privacy note is displayed
      await expect(shell.locator("[data-testid='privacy-note']")).toBeVisible();

      if (violations.length > 0) {
        throw new Error("Shell DOM privacy violations:\n" + violations.join("\n"));
      }

      await shell.getByTestId("close-lesson-btn").click();
    }
  });
});
