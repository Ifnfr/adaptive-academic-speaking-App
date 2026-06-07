import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const migration = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260606_002_add_commonplace_mainmap_tables.sql",
  ),
  "utf8",
);

const MAINMAP_TABLES = [
  "commonplace_main_map_nodes",
  "commonplace_main_map_edges",
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

test.describe("Commonplace Main Mind Map Supabase schema migration", () => {
  test("defines both Main Mind Map tables", () => {
    for (const table of MAINMAP_TABLES) {
      expect(migration).toMatch(new RegExp(`create table ${table} \\(`, "i"));
    }
  });

  test("enables RLS on every Main Mind Map table", () => {
    for (const table of MAINMAP_TABLES) {
      expect(migration).toMatch(
        new RegExp(`alter table ${table} enable row level security;`, "i"),
      );
    }
  });

  test("creates authenticated owner-scoped policies for all row operations", () => {
    for (const table of MAINMAP_TABLES) {
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

  test("adds required foreign keys and uniqueness constraints to commonplace_main_map_nodes", () => {
    const body = compactSql(tableBody("commonplace_main_map_nodes"));
    expect(body).toContain("main_mindmap_id uuid not null references commonplace_mindmaps(id)");
    expect(body).toContain("sub_mindmap_id uuid not null references commonplace_mindmaps(id)");
    expect(body).toContain("unique (owner_id, main_mindmap_id, sub_mindmap_id)");
    expect(body).toContain("check (main_mindmap_id <> sub_mindmap_id)");
  });

  test("adds required foreign keys and checks to commonplace_main_map_edges", () => {
    const body = compactSql(tableBody("commonplace_main_map_edges"));
    expect(body).toContain("main_mindmap_id uuid not null references commonplace_mindmaps(id)");
    expect(body).toContain("source_node_id uuid not null references commonplace_main_map_nodes(id)");
    expect(body).toContain("target_node_id uuid not null references commonplace_main_map_nodes(id)");
    expect(body).toContain("check (source_node_id <> target_node_id)");
  });

  test("adds updated_at triggers to both tables", () => {
    for (const table of MAINMAP_TABLES) {
      expect(migration).toMatch(
        new RegExp(
          `create trigger ${table}_set_updated_at[\\s\\S]*?before update on ${table}[\\s\\S]*?execute function set_updated_at\\(\\);`,
          "i",
        ),
      );
    }
  });

  test("adds useful owner indexes for Main Mind Map tables", () => {
    for (const indexPattern of [
      /on commonplace_main_map_nodes \(owner_id, main_mindmap_id\)/i,
      /on commonplace_main_map_nodes \(owner_id, sub_mindmap_id\)/i,
      /on commonplace_main_map_edges \(owner_id, main_mindmap_id\)/i,
    ]) {
      expect(migration).toMatch(indexPattern);
    }
  });

  test("does not introduce forbidden provider, audio, speech, or auth metadata fields", () => {
    const definedColumns = MAINMAP_TABLES.flatMap((table) =>
      tableBody(table)
        .split("\n")
        .map((line) => line.trim().match(/^([a-z_]+)\s+/)?.[1])
        .filter(Boolean),
    );

    for (const field of FORBIDDEN_FIELDS) {
      expect(definedColumns).not.toContain(field);
    }
  });

  test("does not alter or drop existing sub mind map tables", () => {
    expect(migration).not.toMatch(/alter table (commonplace_notes|commonplace_mindmaps|commonplace_mindmap_nodes|commonplace_mindmap_edges)\b/i);
    expect(migration).not.toMatch(/drop table\b/i);
  });
});
