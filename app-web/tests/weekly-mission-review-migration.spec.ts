import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const migration = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260618_001_add_weekly_mission_reviews.sql",
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

test.describe("Weekly Mission Review Supabase migration", () => {
  test("defines weekly_mission_reviews table with required columns", () => {
    const body = tableBody("weekly_mission_reviews");
    const cols = body
      .split("\n")
      .map((line) => line.trim().match(/^([a-z0-9_]+)\s+/)?.[1])
      .filter(Boolean);

    for (const column of [
      "id",
      "owner_id",
      "week_start",
      "week_end",
      "timezone",
      "generated_at",
      "diagnosis_summary",
      "data_sufficiency",
      "missions",
      "mission_count",
      "status",
      "source_snapshot",
      "next_review_available_at",
      "provider",
      "created_at",
      "updated_at",
    ]) {
      expect(cols).toContain(column);
    }
  });

  test("enforces mission review constraints", () => {
    const body = compactSql(tableBody("weekly_mission_reviews"));

    expect(body).toContain("week_end >= week_start");
    expect(body).toContain("data_sufficiency in ('starter', 'partial', 'strong')");
    expect(body).toContain("status in ('active', 'completed', 'expired')");
    expect(body).toContain("jsonb_typeof(missions) = 'array'");
    expect(body).toContain("jsonb_typeof(source_snapshot) = 'object'");
    expect(body).toContain("mission_count between 1 and 5");
    expect(body).toContain("unique (owner_id, week_start, week_end)");
  });

  test("enables owner-scoped RLS policies", () => {
    expect(migration).toMatch(/alter table weekly_mission_reviews enable row level security;/i);
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migration).toContain(`weekly_mission_reviews_${operation}_own`);
    }
    expect(migration).toMatch(/owner_id = auth\.jwt\(\)->>'sub'/i);
  });

  test("defines owner-week and owner-status indexes", () => {
    expect(migration).toMatch(
      /create index weekly_mission_reviews_owner_week_idx\s+on weekly_mission_reviews \(owner_id, week_start desc, week_end desc\)/i,
    );
    expect(migration).toMatch(
      /create index weekly_mission_reviews_owner_status_idx\s+on weekly_mission_reviews \(owner_id, status, week_end\)/i,
    );
  });

  test("does not create learning_activity_events or modify legacy weekly_reviews", () => {
    expect(migration).not.toMatch(/create table learning_activity_events/i);
    expect(migration).not.toMatch(/alter table weekly_reviews/i);
  });

  test("does not include raw transcript, answer, audio, or provider output columns", () => {
    const body = tableBody("weekly_mission_reviews").toLowerCase();

    for (const forbidden of [
      "raw_transcript",
      "transcript",
      "answer_text",
      "raw_answer",
      "audio_blob",
      "raw_provider_output",
      "prompt_text",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });
});
