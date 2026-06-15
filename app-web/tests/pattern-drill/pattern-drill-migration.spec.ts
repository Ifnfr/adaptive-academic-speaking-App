import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const migration = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260612_004_add_pattern_drill_sessions.sql",
  ),
  "utf8",
);

function tableBody(tableName: string) {
  const match = migration.match(
    new RegExp(`create table ${tableName} \\(([\\s\\S]*?)\\n\\);`, "i"),
  );

  expect(match, `${tableName} table definition`).not.toBeNull();
  return match![1];
}

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

test.describe("Pattern Drill Supabase Schema Migration", () => {
  test("defines pattern_drill_sessions table", () => {
    expect(migration).toMatch(/create table pattern_drill_sessions \(/i);
  });

  test("defines expected columns in pattern_drill_sessions", () => {
    const body = tableBody("pattern_drill_sessions");
    const cols = body.split("\n").map(line => line.trim().match(/^([a-z0-9_]+)\s+/)?.[1]).filter(Boolean);
    
    const expectedCols = [
      "id",
      "owner_id",
      "brief_id",
      "target_pattern",
      "target_steps",
      "common_mistakes",
      "quick_check_status",
      "entry_phase",
      "phase1_baseline_completeness",
      "phase1_completed_prompt_count",
      "phase2_accuracy",
      "full_credit_count",
      "partial_credit_count",
      "no_credit_count",
      "evaluated_attempt_count",
      "final_full_credit_streak",
      "most_missed_steps",
      "simplified_topic_used",
      "improvement_signal",
      "next_session_recommendation",
      "weakness_update",
      "phase3_pressure_accuracy",
      "pressure_fail_rate",
      "saved_summary",
      "created_at",
    ];

    for (const col of expectedCols) {
      expect(cols).toContain(col);
    }
  });

  test("enables RLS on pattern_drill_sessions", () => {
    expect(migration).toMatch(/alter table pattern_drill_sessions enable row level security;/i);
  });

  test("defines owner-scoped select and insert policies", () => {
    expect(migration).toMatch(/create policy "pattern_drill_sessions_select_own"\s+on pattern_drill_sessions for select\s+using\s*\(owner_id = auth\.jwt\(\)->>'sub'\)/i);
    expect(migration).toMatch(/create policy "pattern_drill_sessions_insert_own"\s+on pattern_drill_sessions for insert\s+with check\s*\(owner_id = auth\.jwt\(\)->>'sub'\)/i);
  });

  test("defines expected check constraints on fields", () => {
    const bodyCompact = compactSql(tableBody("pattern_drill_sessions"));
    
    // Enum/Check constraints
    expect(bodyCompact).toContain("quick_check_status in ('detected', 'not_detected_or_partial', 'skipped')");
    expect(bodyCompact).toContain("entry_phase in (1, 3)");
    expect(bodyCompact).toContain("phase1_baseline_completeness in ('complete', 'partial', 'missing')");
    expect(bodyCompact).toContain("improvement_signal in ('strong', 'emerging', 'needs_more_repetition')");
    
    // Bounds and counts
    expect(bodyCompact).toContain("phase1_completed_prompt_count >= 0");
    expect(bodyCompact).toContain("phase2_accuracy between 0 and 100");
    expect(bodyCompact).toContain("full_credit_count >= 0");
    expect(bodyCompact).toContain("partial_credit_count >= 0");
    expect(bodyCompact).toContain("no_credit_count >= 0");
    expect(bodyCompact).toContain("evaluated_attempt_count >= 0");
    expect(bodyCompact).toContain("final_full_credit_streak >= 0");
    
    expect(bodyCompact).toContain("phase3_pressure_accuracy is null or (phase3_pressure_accuracy between 0 and 100)");
    expect(bodyCompact).toContain("pressure_fail_rate is null or (pressure_fail_rate between 0 and 100)");
    
    // JSON formats
    expect(bodyCompact).toContain("jsonb_typeof(target_steps) = 'array'");
    expect(bodyCompact).toContain("jsonb_typeof(common_mistakes) = 'array'");
    expect(bodyCompact).toContain("jsonb_typeof(most_missed_steps) = 'array'");
    expect(bodyCompact).toContain("jsonb_typeof(saved_summary) = 'object'");
    expect(bodyCompact).toContain("weakness_update is null or jsonb_typeof(weakness_update) = 'object'");
  });

  test("defines expected owner-created index", () => {
    expect(migration).toMatch(/create index pattern_drill_sessions_owner_created_idx\s+on pattern_drill_sessions \(owner_id, created_at desc\)/i);
  });

  test("does not contain raw audio, transcript, or provider output columns", () => {
    const body = tableBody("pattern_drill_sessions").toLowerCase();
    
    expect(body).not.toContain("raw_transcript");
    expect(body).not.toContain("transcript_text");
    expect(body).not.toContain("audio_blob");
    expect(body).not.toContain("raw_provider_output");
    expect(body).not.toContain("attempt_text");
  });

  test("does not modify learner_error_patterns constraints or tables", () => {
    expect(migration).not.toContain("learner_error_patterns");
  });
});
