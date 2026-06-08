import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  GET,
  PATCH,
  testHooks,
} from "../src/app/api/commonplace/maps/nodes/route";

const baseMapRow = {
  id: "map-db-1",
  owner_id: "server-user-123",
  title: "Institutional Incentives",
  type: "sub",
  parent_mindmap_id: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

const baseNodeRow = {
  id: "node-db-1",
  note_id: "note-db-1",
  position_x: 120,
  position_y: 160,
  commonplace_notes: {
    shortcode: "#wn1",
    title: "Institutions and Growth",
    source_book: "Why Nations Fail",
    insight: "Inclusive institutions shape incentives.",
    tags: ["economics", "institutions"],
  },
};

type MockOptions = {
  mapRow?: Record<string, unknown> | null;
  mapReadError?: Error | null;
  nodeRows?: Record<string, unknown>[];
  nodeReadError?: Error | null;
  nodeUpdateError?: Error | null;
};

function buildPatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps/nodes", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const updated: Record<string, unknown[]> = {};

  function buildQuery(table: string) {
    const query = {
      select(columns: string) {
        calls.push(`select:${table}:${columns.replace(/\s+/g, " ").trim()}`);
        return query;
      },
      update(row: unknown) {
        calls.push(`update:${table}`);
        updated[table] = [...(updated[table] ?? []), row as Record<string, unknown>];
        return query;
      },
      eq(column: string, value: string) {
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      in(column: string, values: string[]) {
        calls.push(`in:${table}:${column}:${values.join(",")}`);
        return Promise.resolve({
          data: options.nodeRows ?? [baseNodeRow],
          error: options.nodeReadError ?? null,
        });
      },
      order(column: string, orderOptions: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${orderOptions.ascending}`);
        return Promise.resolve({
          data: options.nodeRows ?? [baseNodeRow],
          error: options.nodeReadError ?? null,
        });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        return Promise.resolve({
          data:
            options.mapRow === undefined
              ? baseMapRow
              : options.mapRow,
          error: options.mapReadError ?? null,
        });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        return Promise.resolve({
          data: null,
          error: options.nodeUpdateError ?? null,
        }).then(onfulfilled);
      },
    };
    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return buildQuery(table);
    },
  };

  return { client, calls, updated };
}

test.describe("Commonplace map nodes route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated GET and PATCH return auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    testHooks.getSupabaseClient = () => {
      throw new Error("should not create client");
    };

    const getResponse = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=map-1&type=sub"),
    );
    const patchResponse = await PATCH(
      buildPatchRequest({
        mapId: "map-1",
        type: "sub",
        updates: [],
      }),
    );

    expect(getResponse.status).toBe(401);
    expect(patchResponse.status).toBe(401);
    await expect(getResponse.json()).resolves.toEqual({ error: "auth_required" });
    await expect(patchResponse.json()).resolves.toEqual({ error: "auth_required" });
  });

  test("invalid map node fields are rejected before Supabase", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const getResponse = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=map-1&type=cluster"),
    );
    const patchResponse = await PATCH(
      buildPatchRequest({
        mapId: "map-1",
        type: "sub",
        updates: [{ nodeId: "node-db-1", position: { x: Number.NaN, y: 20 } }],
      }),
    );

    expect(getResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("Main GET returns empty nodes without cluster table calls", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mapRow: { ...baseMapRow, type: "main" },
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=main-map-1&type=main"),
    );
    const data = (await response.json()) as { nodes: unknown[] };

    expect(response.status).toBe(200);
    expect(data.nodes).toEqual([]);
    expect(mock.calls).toContain("select:commonplace_mindmaps:id");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_nodes");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main PATCH rejects non-empty updates", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mapRow: { ...baseMapRow, type: "main" },
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildPatchRequest({
        mapId: "main-map-1",
        type: "main",
        updates: [{ nodeId: "node-db-1", position: { x: 200, y: 260 } }],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_map_node_fields",
    });
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_nodes");
  });

  test("Sub GET returns owner-scoped saved note nodes", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=map-db-1&type=sub"),
    );
    const data = (await response.json()) as {
      nodes: Array<{ noteShortcode: string; noteSourceBook: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.nodes[0]).toMatchObject({
      noteShortcode: "#wn1",
      noteSourceBook: "Why Nations Fail",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:mindmap_id:map-db-1");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  test("Sub PATCH updates owner-scoped node positions and ignores request owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildPatchRequest({
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "map-db-1",
        type: "sub",
        updates: [{ nodeId: "node-db-1", position: { x: 220, y: 320 } }],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:mindmap_id:map-db-1");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:id:node-db-1");
    expect(mock.updated.commonplace_mindmap_nodes[0]).toMatchObject({
      position_x: 220,
      position_y: 320,
    });
    expect(JSON.stringify(mock.updated)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  test("Supabase failures return safe map node errors without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeReadError: new Error("raw Supabase graph failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=map-db-1&type=sub"),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_node_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase graph failure");
  });

  test("route source keeps service role server-only and does not reference edge or cluster tables", () => {
    const routeSource = readFileSync(
      "src/app/api/commonplace/maps/nodes/route.ts",
      "utf8",
    );

    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).not.toContain("commonplace_mindmap_edges");
    expect(routeSource).not.toContain("commonplace_main_map_nodes");
    expect(routeSource).not.toContain("commonplace_main_map_edges");
  });

  test("duplicate sub-node migration removes only note-level uniqueness", () => {
    const migrationSource = readFileSync(
      "../supabase/migrations/20260608_001_allow_duplicate_commonplace_sub_note_nodes.sql",
      "utf8",
    );

    expect(migrationSource).toContain(
      "drop constraint if exists commonplace_mindmap_nodes_owner_mindmap_note_unique",
    );
    expect(migrationSource).toContain(
      "create index if not exists commonplace_mindmap_nodes_owner_mindmap_note_idx",
    );
    expect(migrationSource).not.toContain("drop table");
    expect(migrationSource).not.toContain("disable row level security");
    expect(migrationSource).not.toContain("commonplace_main_map_nodes");
    expect(migrationSource).not.toContain("commonplace_mindmap_edges");
  });
});
