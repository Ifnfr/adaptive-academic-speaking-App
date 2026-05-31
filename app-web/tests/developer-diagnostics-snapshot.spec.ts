import { expect, test } from "@playwright/test";
import {
  buildSignalAvailability,
  buildFoundationReadinessResult,
  getDefaultFoundationReadiness,
  buildDeveloperDiagnosticSnapshot,
  getSafeDeveloperDiagnosticSnapshot
} from "../src/app/lib/developer-diagnostics/snapshot";
import type {
  DeveloperDiagnosticSnapshot,
  Phase2ReadinessResult,
} from "../src/app/lib/developer-diagnostics/types";
import * as fs from "fs";
import * as path from "path";

const ALLOWED_KEYS = new Set([
  "version",
  "generatedAt",
  "foundations",
  "availableSignals",
  "missingSignals",
  "risks",
  "recommendations",
  "phase2Readiness",
  "improvementProposalRefs",
  "checklist",
  "safeSummary",

  // nested/item keys
  "learning_path",
  "micro_practice",
  "feedback_normalization",
  "tutor_memory",
  "improvement_loop",
  "docs",
  "tests",
  "privacy",
  "status",
  "readinessScore",
  "passedChecks",
  "failedChecks",
  "warnings",
  "foundation",
  "signalName",
  "isAvailable",
  "reason",
  "area",
  "severity",
  "description",
  "mitigation",
  "recommendationId",
  "priority",
  "suggestedNextStep",
  "humanReviewRequired",
  "id",
  "mandatory",
  "score",
  "isReady",
  "blockers"
]);

const FORBIDDEN_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

function getAllKeys(obj: unknown): string[] {
  if (obj === null || typeof obj !== "object") {
    return [];
  }
  const keys: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      keys.push(...getAllKeys(item));
    }
  } else {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      keys.push(key);
      keys.push(...getAllKeys(record[key]));
    }
  }
  return keys;
}

test.describe("Developer Diagnostics Snapshot Helpers Tests", () => {
  test("1. buildSignalAvailability returns whitelisted safe object", () => {
    const signal = buildSignalAvailability("learning_path", "test_signal", true, "Test description");
    expect(signal.foundation).toBe("learning_path");
    expect(signal.signalName).toBe("test_signal");
    expect(signal.isAvailable).toBe(true);
    expect(signal.reason).toBe("Test description");

    const keys = getAllKeys(signal);
    for (const key of keys) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  test("2. buildFoundationReadinessResult returns whitelisted safe object", () => {
    const available = [buildSignalAvailability("learning_path", "test_sig_1", true, "ok")];
    const missing = [buildSignalAvailability("learning_path", "test_sig_2", false, "missing")];
    const result = buildFoundationReadinessResult(
      "learning_path",
      "ready",
      95,
      "Foundation is fully ready.",
      available,
      missing
    );

    expect(result.status).toBe("ready");
    expect(result.readinessScore).toBe(95);
    expect(result.safeSummary).toBe("Foundation is fully ready.");
    expect(result.availableSignals.length).toBe(1);
    expect(result.missingSignals.length).toBe(1);

    const keys = getAllKeys(result);
    for (const key of keys) {
      if (key === "test_sig_1" || key === "ok" || key === "test_sig_2" || key === "missing") continue;
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  test("3. score is clamped to 0-100", () => {
    const resultLow = buildFoundationReadinessResult("learning_path", "not_started", -50, "test", [], []);
    expect(resultLow.readinessScore).toBe(0);

    const resultHigh = buildFoundationReadinessResult("learning_path", "ready", 150, "test", [], []);
    expect(resultHigh.readinessScore).toBe(100);
  });

  test("4. getDefaultFoundationReadiness returns neutral not_started result", () => {
    const result = getDefaultFoundationReadiness("learning_path");
    expect(result.status).toBe("not_started");
    expect(result.readinessScore).toBe(0);
    expect(result.passedChecks).toEqual([]);
    expect(result.failedChecks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.safeSummary).toContain("learning_path");
    expect(result.availableSignals).toEqual([]);
    expect(result.missingSignals).toEqual([]);
  });

  test("5. buildDeveloperDiagnosticSnapshot creates version 1 snapshot", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const mp = getDefaultFoundationReadiness("micro_practice");
    const fn = getDefaultFoundationReadiness("feedback_normalization");
    const tm = getDefaultFoundationReadiness("tutor_memory");
    const il = getDefaultFoundationReadiness("improvement_loop");
    const docs = getDefaultFoundationReadiness("docs");
    const tests = getDefaultFoundationReadiness("tests");
    const privacy = getDefaultFoundationReadiness("privacy");

    const foundations = {
      learning_path: lp,
      micro_practice: mp,
      feedback_normalization: fn,
      tutor_memory: tm,
      improvement_loop: il,
      docs,
      tests,
      privacy
    };

    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const snapshot = buildDeveloperDiagnosticSnapshot(
      "2026-05-31T10:00:00Z",
      foundations,
      [],
      [],
      phase2,
      [],
      "Top-level test summary"
    );

    expect(snapshot.version).toBe("1");
    expect(snapshot.generatedAt).toBe("2026-05-31T10:00:00Z");
    expect(snapshot.safeSummary).toBe("Top-level test summary");
    expect(snapshot.phase2Readiness.status).toBe("ready_for_research");
  });

  test("6. generatedAt is input-driven and deterministic", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const foundations = {
      learning_path: lp,
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    };
    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const inputTime = "2026-05-31T11:00:00Z";
    const snapshot = buildDeveloperDiagnosticSnapshot(inputTime, foundations, [], [], phase2, [], "test");
    expect(snapshot.generatedAt).toBe(inputTime);
  });

  test("7. getSafeDeveloperDiagnosticSnapshot strips extra runtime fields", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const foundations = {
      learning_path: lp,
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    };
    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const snapshot = buildDeveloperDiagnosticSnapshot("2026-05-31T10:00:00Z", foundations, [], [], phase2, [], "test");

    // Add extra runtime properties to snapshot
    const snapshotWithExtras = {
      ...snapshot,
      extraProperty: "should-be-removed",
      nestedExtra: {
        someSecret: "leak"
      }
    } as unknown as DeveloperDiagnosticSnapshot;

    const sanitized = getSafeDeveloperDiagnosticSnapshot(snapshotWithExtras);
    const rawSanitized = sanitized as unknown as Record<string, unknown>;
    expect(rawSanitized.extraProperty).toBeUndefined();
    expect(rawSanitized.nestedExtra).toBeUndefined();

    const keys = getAllKeys(sanitized);
    for (const key of keys) {
      if (key.includes("not been started") || key.includes("test")) continue;
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  test("8. helpers do not mutate input arrays or objects", () => {
    const originalAvailable = [buildSignalAvailability("learning_path", "sig", true, "ok")];
    const result = buildFoundationReadinessResult("learning_path", "ready", 90, "test", originalAvailable, []);

    // Verify mutating result does not affect input array
    result.availableSignals.push(buildSignalAvailability("learning_path", "another", true, "ok"));
    expect(originalAvailable.length).toBe(1);
  });

  test("9. same input produces identical JSON output", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const foundations = {
      learning_path: lp,
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    };
    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const s1 = buildDeveloperDiagnosticSnapshot("2026-05-31T10:00:00Z", foundations, [], [], phase2, [], "test");
    const s2 = buildDeveloperDiagnosticSnapshot("2026-05-31T10:00:00Z", foundations, [], [], phase2, [], "test");

    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  test("10. serialized output contains only approved keys", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const foundations = {
      learning_path: lp,
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    };
    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const snapshot = buildDeveloperDiagnosticSnapshot("2026-05-31T10:00:00Z", foundations, [], [], phase2, [], "test");
    const keys = getAllKeys(snapshot);
    for (const key of keys) {
      if (key.includes("not been started") || key.includes("test")) continue;
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  test("11. serialized output contains no forbidden private fields", () => {
    const lp = getDefaultFoundationReadiness("learning_path");
    const foundations = {
      learning_path: lp,
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    };
    const phase2: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: []
    };

    const snapshot = buildDeveloperDiagnosticSnapshot("2026-05-31T10:00:00Z", foundations, [], [], phase2, [], "test");
    const serialized = JSON.stringify(snapshot);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  test("12. source file does not contain prohibited calls", () => {
    const sourcePath = path.resolve(__dirname, "../src/app/lib/developer-diagnostics/snapshot.ts");
    const content = fs.readFileSync(sourcePath, "utf8");

    expect(content).not.toContain("localStorage");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("SupabaseClient");
    expect(content).not.toContain("createClient(");
    expect(content).not.toContain("Date.now(");
    expect(content).not.toContain("Math.random(");
    expect(content).not.toContain("randomUUID(");
    expect(content).not.toContain("fs.write");
    expect(content).not.toContain("child_process");
    expect(content).not.toContain("Object.assign(snapshot");
  });
});
