import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const migration = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260606_001_add_commonplace_tables.sql",
  ),
  "utf8",
);

const COMMONPLACE_TABLES = [
  "commonplace_notes",
  "commonplace_shortcode_counters",
  "commonplace_mindmaps",
  "commonplace_mindmap_nodes",
  "commonplace_mindmap_edges",
];

const UPDATED_AT_TABLES = [
  "commonplace_notes",
  "commonplace_mindmaps",
  "commonplace_mindmap_nodes",
  "commonplace_mindmap_edges",
];

const FORBIDDEN_FIELDS = [
  "api_key",
  "raw_provider_payload",
  "audio",
  "audio_blob",
  "recording_url",
  "stt_payload",
  "tts_payload",
  "auth_metadata",
];

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

test.describe("Commonplace Supabase schema migration", () => {
  test("defines all five Commonplace tables", () => {
    for (const table of COMMONPLACE_TABLES) {
      expect(migration).toMatch(new RegExp(`create table ${table} \\(`, "i"));
    }
  });

  test("enables RLS on every Commonplace table", () => {
    for (const table of COMMONPLACE_TABLES) {
      expect(migration).toMatch(
        new RegExp(`alter table ${table} enable row level security;`, "i"),
      );
    }
  });

  test("creates authenticated owner-scoped policies for all row operations", () => {
    for (const table of COMMONPLACE_TABLES) {
      for (const operation of ["select", "insert", "update", "delete"]) {
        expect(migration).toMatch(
          new RegExp(
            `create policy "${table}_${operation}_own"[\\s\\S]*?on ${table} for ${operation}[\\s\\S]*?to authenticated[\\s\\S]*?owner_id = auth\\.jwt\\(\\)->>'sub'`,
            "i",
          ),
        );
      }
    }
  });

  test("does not create public or anonymous broad policies", () => {
    expect(migration).not.toMatch(/to\s+(anon|public)\b/i);
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  test("adds required note and counter uniqueness constraints", () => {
    expect(compactSql(tableBody("commonplace_notes"))).toContain(
      "unique (owner_id, shortcode)",
    );
    expect(compactSql(tableBody("commonplace_shortcode_counters"))).toContain(
      "primary key (owner_id, prefix)",
    );
  });

  test("adds required mindmap, node, and edge constraints", () => {
    expect(compactSql(tableBody("commonplace_mindmaps"))).toContain(
      "check (type in ('main', 'sub'))",
    );
    expect(compactSql(tableBody("commonplace_mindmap_nodes"))).toContain(
      "unique (owner_id, mindmap_id, note_id)",
    );
    expect(compactSql(tableBody("commonplace_mindmap_edges"))).toContain(
      "check (source_node_id <> target_node_id)",
    );
  });

  test("adds updated_at triggers where updated_at exists", () => {
    for (const table of UPDATED_AT_TABLES) {
      expect(migration).toMatch(
        new RegExp(
          `create trigger ${table}_set_updated_at[\\s\\S]*?before update on ${table}[\\s\\S]*?execute function set_updated_at\\(\\);`,
          "i",
        ),
      );
    }

    expect(migration).not.toMatch(
      /create trigger commonplace_shortcode_counters_set_updated_at/i,
    );
  });

  test("adds useful owner indexes", () => {
    for (const indexPattern of [
      /on commonplace_notes \(owner_id, created_at desc\)/i,
      /on commonplace_notes \(owner_id, shortcode\)/i,
      /on commonplace_mindmaps \(owner_id, updated_at desc\)/i,
      /on commonplace_mindmap_nodes \(owner_id, mindmap_id\)/i,
      /on commonplace_mindmap_edges \(owner_id, mindmap_id\)/i,
      /on commonplace_notes using gin \(tags\)/i,
    ]) {
      expect(migration).toMatch(indexPattern);
    }
  });

  test("does not introduce forbidden provider, audio, speech, or auth metadata fields", () => {
    const definedColumns = COMMONPLACE_TABLES.flatMap((table) =>
      tableBody(table)
        .split("\n")
        .map((line) => line.trim().match(/^([a-z_]+)\s+/)?.[1])
        .filter(Boolean),
    );

    for (const field of FORBIDDEN_FIELDS) {
      expect(definedColumns).not.toContain(field);
    }
  });
});
