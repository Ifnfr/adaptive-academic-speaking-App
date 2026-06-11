import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  DELETE,
  GET,
  PATCH,
  POST,
  testHooks,
} from "../src/app/api/commonplace/maps/edges/route";

const baseMapRow = {
  id: "map-db-1",
  owner_id: "server-user-123",
  title: "Institutional Incentives",
  type: "sub",
  parent_mindmap_id: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

const baseMainMapRow = {
  id: "main-map-1",
  owner_id: "server-user-123",
  title: "Institutions Overview",
  type: "main",
  parent_mindmap_id: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

const baseNodes = [
  { id: "node-source", mindmap_id: "map-db-1" },
  { id: "node-target", mindmap_id: "map-db-1" },
];

const baseMainNodes = [
  { id: "main-cluster-source", main_mindmap_id: "main-map-1", node_kind: "cluster" },
  { id: "main-cluster-target", main_mindmap_id: "main-map-1", node_kind: "cluster" },
  { id: "main-note-source", main_mindmap_id: "main-map-1", node_kind: "note" },
  { id: "main-note-target", main_mindmap_id: "main-map-1", node_kind: "note" },
];

const baseEdgeRow = {
  id: "edge-db-1",
  mindmap_id: "map-db-1",
  source_node_id: "node-source",
  target_node_id: "node-target",
  edge_type: "solid",
  label: null,
};

const baseMainEdgeRow = {
  id: "main-edge-db-1",
  main_mindmap_id: "main-map-1",
  source_node_id: "main-cluster-source",
  target_node_id: "main-cluster-target",
  edge_type: "solid",
  label: null,
};

type MockOptions = {
  mapRow?: Record<string, unknown> | null;
  mainMapRow?: Record<string, unknown> | null;
  mapReadError?: Error | null;
  nodeRows?: Record<string, unknown>[];
  nodeReadError?: Error | null;
  mainNodeRows?: Record<string, unknown>[];
  mainNodeReadError?: Error | null;
  edgeRows?: Record<string, unknown>[];
  edgeReadError?: Error | null;
  edgeInsertError?: Error | null;
  edgeUpdateError?: Error | null;
  edgeUpdateRow?: Record<string, unknown> | null;
  edgeDeleteError?: Error | null;
  existingEdgeRow?: Record<string, unknown> | null;
  mainEdgeRows?: Record<string, unknown>[];
  mainEdgeReadError?: Error | null;
  mainEdgeInsertError?: Error | null;
  mainEdgeUpdateError?: Error | null;
  mainEdgeUpdateRow?: Record<string, unknown> | null;
  mainEdgeDeleteError?: Error | null;
  existingMainEdgeRow?: Record<string, unknown> | null;
};

function buildRequest(method: string, body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps/edges", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  const deleted: string[] = [];
  let operation = "";
  let payload: Record<string, unknown> | null = null;

  function buildQuery(table: string) {
    const filters: string[] = [];
    const query = {
      select(columns: string) {
        calls.push(`select:${table}:${columns.replace(/\s+/g, " ").trim()}`);
        return query;
      },
      insert(row: unknown) {
        operation = "insert";
        payload = row as Record<string, unknown>;
        calls.push(`insert:${table}`);
        inserted[table] = [...(inserted[table] ?? []), payload];
        return query;
      },
      update(row: unknown) {
        operation = "update";
        payload = row as Record<string, unknown>;
        calls.push(`update:${table}`);
        updated[table] = [...(updated[table] ?? []), payload];
        return query;
      },
      delete() {
        operation = "delete";
        calls.push(`delete:${table}`);
        deleted.push(table);
        return query;
      },
      eq(column: string, value: string) {
        filters.push(`${column}:${value}`);
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      in(column: string, values: string[]) {
        calls.push(`in:${table}:${column}:${values.join(",")}`);
        if (table === "commonplace_main_map_nodes") {
          return Promise.resolve({
            data: (options.mainNodeRows ?? baseMainNodes).filter((row) =>
              values.includes(String(row.id)),
            ),
            error: options.mainNodeReadError ?? null,
          });
        }
        return Promise.resolve({
          data: (options.nodeRows ?? baseNodes).filter((row) =>
            values.includes(String(row.id)),
          ),
          error: options.nodeReadError ?? null,
        });
      },
      order(column: string, orderOptions: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${orderOptions.ascending}`);
        if (table === "commonplace_main_map_edges") {
          return Promise.resolve({
            data: options.mainEdgeRows ?? [baseMainEdgeRow],
            error: options.mainEdgeReadError ?? null,
          });
        }
        return Promise.resolve({
          data: options.edgeRows ?? [baseEdgeRow],
          error: options.edgeReadError ?? null,
        });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_mindmaps") {
          const isMainMapLookup = filters.includes("type:main");
          return Promise.resolve({
            data:
              isMainMapLookup
                ? options.mainMapRow === undefined
                  ? baseMainMapRow
                  : options.mainMapRow
                : options.mapRow === undefined
                  ? baseMapRow
                  : options.mapRow,
            error: options.mapReadError ?? null,
          });
        }

        if (table === "commonplace_main_map_edges" && operation === "update") {
          return Promise.resolve({
            data:
              options.mainEdgeUpdateRow === undefined
                ? { ...baseMainEdgeRow, ...payload }
                : options.mainEdgeUpdateRow,
            error: options.mainEdgeUpdateError ?? null,
          });
        }

        if (table === "commonplace_main_map_edges") {
          return Promise.resolve({
            data:
              options.existingMainEdgeRow === undefined
                ? { id: baseMainEdgeRow.id }
                : options.existingMainEdgeRow,
            error: options.mainEdgeReadError ?? null,
          });
        }

        if (table === "commonplace_mindmap_edges" && operation === "update") {
          return Promise.resolve({
            data:
              options.edgeUpdateRow === undefined
                ? { ...baseEdgeRow, ...payload }
                : options.edgeUpdateRow,
            error: options.edgeUpdateError ?? null,
          });
        }

        return Promise.resolve({
          data:
            options.existingEdgeRow === undefined
              ? { id: baseEdgeRow.id }
              : options.existingEdgeRow,
          error: options.edgeReadError ?? null,
        });
      },
      single() {
        calls.push(`single:${table}`);
        if (table === "commonplace_main_map_edges") {
          return Promise.resolve({
            data:
              options.mainEdgeInsertError || !payload
                ? null
                : {
                    id: `main-edge-created-${(inserted.commonplace_main_map_edges ?? []).length}`,
                    main_mindmap_id: payload.main_mindmap_id,
                    source_node_id: payload.source_node_id,
                    target_node_id: payload.target_node_id,
                    edge_type: payload.edge_type,
                    label: payload.label,
                  },
            error: options.mainEdgeInsertError ?? null,
          });
        }
        return Promise.resolve({
          data:
            options.edgeInsertError || !payload
              ? null
              : {
                  id: "edge-created-1",
                  mindmap_id: payload.mindmap_id,
                  source_node_id: payload.source_node_id,
                  target_node_id: payload.target_node_id,
                  edge_type: payload.edge_type,
                  label: payload.label,
                },
          error: options.edgeInsertError ?? null,
        });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        return Promise.resolve({
          data: null,
          error:
            table === "commonplace_main_map_edges" && operation === "delete"
              ? options.mainEdgeDeleteError ?? null
              : table === "commonplace_mindmap_edges" && operation === "delete"
                ? options.edgeDeleteError ?? null
                : null,
        }).then(onfulfilled);
      },
    };
    return query;
  }

  const client = {
    from(table: string) {
      operation = "";
      payload = null;
      calls.push(`from:${table}`);
      return buildQuery(table);
    },
  };

  return { client, calls, inserted, updated, deleted };
}

test.describe("Commonplace map edges route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated GET, POST, PATCH, and DELETE return auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    testHooks.getSupabaseClient = () => {
      throw new Error("should not create client");
    };

    const getResponse = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=map-db-1&type=sub"),
    );
    const postResponse = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "node-target",
        edgeType: "solid",
      }),
    );
    const patchResponse = await PATCH(
      buildRequest("PATCH", {
        mapId: "map-db-1",
        type: "sub",
        edgeId: "edge-db-1",
        edgeType: "dashed",
      }),
    );
    const deleteResponse = await DELETE(
      buildRequest("DELETE", {
        mapId: "map-db-1",
        type: "sub",
        edgeId: "edge-db-1",
      }),
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(patchResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    await expect(getResponse.json()).resolves.toEqual({ error: "auth_required" });
    await expect(postResponse.json()).resolves.toEqual({ error: "auth_required" });
    await expect(patchResponse.json()).resolves.toEqual({ error: "auth_required" });
    await expect(deleteResponse.json()).resolves.toEqual({ error: "auth_required" });
  });

  test("invalid map edge fields are rejected before Supabase", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const getResponse = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=map-db-1&type=cluster"),
    );
    const postResponse = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "",
        targetNodeId: "node-target",
        edgeType: "solid",
      }),
    );
    const patchResponse = await PATCH(
      buildRequest("PATCH", {
        mapId: "map-db-1",
        type: "sub",
        edgeId: "edge-db-1",
      }),
    );
    const deleteResponse = await DELETE(
      buildRequest("DELETE", { mapId: "map-db-1", type: "sub" }),
    );

    expect(getResponse.status).toBe(400);
    expect(postResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
    expect(deleteResponse.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("GET returns owner-scoped Sub Mind Map edges", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      edgeRows: [{ ...baseEdgeRow, edge_type: "dashed", label: "weak link" }],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=map-db-1&type=sub"),
    );
    const data = (await response.json()) as {
      edges: Array<{ id: string; source: string; target: string; edgeType: string; label: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.edges[0]).toMatchObject({
      id: "edge-db-1",
      source: "node-source",
      target: "node-target",
      edgeType: "dashed",
      label: "weak link",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:mindmap_id:map-db-1");
  });

  test("POST creates a solid owner-scoped edge and ignores request owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "node-target",
        edgeType: "solid",
      }),
    );
    const data = (await response.json()) as {
      edge: { source: string; target: string; edgeType: string; label: string | null };
    };

    expect(response.status).toBe(201);
    expect(data.edge).toMatchObject({
      source: "node-source",
      target: "node-target",
      edgeType: "solid",
      label: null,
    });
    expect(mock.inserted.commonplace_mindmap_edges[0]).toMatchObject({
      owner_id: "server-user-123",
      mindmap_id: "map-db-1",
      source_node_id: "node-source",
      target_node_id: "node-target",
      edge_type: "solid",
      label: null,
    });
    expect(JSON.stringify(mock.inserted)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("POST creates a dashed edge with label", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "node-target",
        edgeType: "dashed",
        label: "speculative cause",
      }),
    );

    expect(response.status).toBe(201);
    expect(mock.inserted.commonplace_mindmap_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "speculative cause",
    });
  });

  test("POST creates an edge between duplicate note node instances", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeRows: [
        { id: "node-duplicate-1", mindmap_id: "map-db-1", note_id: "note-db-1" },
        { id: "node-duplicate-2", mindmap_id: "map-db-1", note_id: "note-db-1" },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-duplicate-1",
        targetNodeId: "node-duplicate-2",
        edgeType: "solid",
        label: "same note contrast",
      }),
    );

    expect(response.status).toBe(201);
    expect(mock.inserted.commonplace_mindmap_edges[0]).toMatchObject({
      source_node_id: "node-duplicate-1",
      target_node_id: "node-duplicate-2",
      edge_type: "solid",
      label: "same note contrast",
    });
    expect(mock.calls).toContain(
      "in:commonplace_mindmap_nodes:id:node-duplicate-1,node-duplicate-2",
    );
  });

  test("POST rejects self-edges before Supabase", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "node-source",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("POST rejects nodes not owned by the user", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeRows: [{ id: "node-source", mindmap_id: "map-db-1" }],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "other-owner-node",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:owner_id:server-user-123");
    expect(mock.calls).not.toContain("insert:commonplace_mindmap_edges");
  });

  test("POST rejects nodes from different maps", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeRows: [
        { id: "node-source", mindmap_id: "map-db-1" },
        { id: "node-target", mindmap_id: "other-map" },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "map-db-1",
        type: "sub",
        sourceNodeId: "node-source",
        targetNodeId: "node-target",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).not.toContain("insert:commonplace_mindmap_edges");
  });

  test("GET returns owner-scoped Main Map cluster edges", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainEdgeRows: [
        { ...baseMainEdgeRow, edge_type: "dashed", label: "theme bridge" },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=main-map-1&type=main"),
    );
    const data = (await response.json()) as {
      edges: Array<{ id: string; source: string; target: string; edgeType: string; label: string }>;
    };

    expect(response.status).toBe(200);
    expect(data.edges[0]).toMatchObject({
      id: "main-edge-db-1",
      source: "main-cluster-source",
      target: "main-cluster-target",
      edgeType: "dashed",
      label: "theme bridge",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:main_mindmap_id:main-map-1");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  test("POST creates a Main Map solid cluster edge and ignores owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "main-map-1",
        type: "main",
        sourceNodeId: "main-cluster-source",
        targetNodeId: "main-cluster-target",
        edgeType: "solid",
      }),
    );
    const data = (await response.json()) as {
      edge: { source: string; target: string; edgeType: string; label: string | null };
    };

    expect(response.status).toBe(201);
    expect(data.edge).toMatchObject({
      source: "main-cluster-source",
      target: "main-cluster-target",
      edgeType: "solid",
      label: null,
    });
    expect(mock.inserted.commonplace_main_map_edges[0]).toMatchObject({
      owner_id: "server-user-123",
      main_mindmap_id: "main-map-1",
      source_node_id: "main-cluster-source",
      target_node_id: "main-cluster-target",
      edge_type: "solid",
      label: null,
    });
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:main_mindmap_id:main-map-1");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(JSON.stringify(mock.inserted)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  const mainMixedEdgeCases: Array<{
    name: string;
    sourceNodeId: string;
    targetNodeId: string;
    edgeType: "solid" | "dashed";
    label: string;
  }> = [
    {
      name: "cluster to note",
      sourceNodeId: "main-cluster-source",
      targetNodeId: "main-note-target",
      edgeType: "solid",
      label: "cluster explains note",
    },
    {
      name: "note to cluster",
      sourceNodeId: "main-note-source",
      targetNodeId: "main-cluster-target",
      edgeType: "dashed",
      label: "note suggests cluster",
    },
    {
      name: "note to note",
      sourceNodeId: "main-note-source",
      targetNodeId: "main-note-target",
      edgeType: "solid",
      label: "note contrast",
    },
  ];

  for (const { name, sourceNodeId, targetNodeId, edgeType, label } of mainMixedEdgeCases) {
    test(`POST creates a Main Map mixed visual-node edge: ${name}`, async () => {
      testHooks.resolveCurrentUserId = async () => "server-user-123";
      const mock = createMockSupabaseClient();
      testHooks.getSupabaseClient = () => mock.client;

      const response = await POST(
        buildRequest("POST", {
          mapId: "main-map-1",
          type: "main",
          sourceNodeId,
          targetNodeId,
          edgeType,
          label,
        }),
      );
      const data = (await response.json()) as {
        edge: { source: string; target: string; edgeType: string; label: string | null };
      };

      expect(response.status).toBe(201);
      expect(data.edge).toMatchObject({
        source: sourceNodeId,
        target: targetNodeId,
        edgeType,
        label,
      });
      expect(mock.inserted.commonplace_main_map_edges[0]).toMatchObject({
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: edgeType,
        label,
      });
      expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    });
  }

  test("POST creates a Main Map dashed cluster edge with label", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "main-map-1",
        type: "main",
        sourceNodeId: "main-cluster-source",
        targetNodeId: "main-cluster-target",
        edgeType: "dashed",
        label: "loose theme",
      }),
    );

    expect(response.status).toBe(201);
    expect(mock.inserted.commonplace_main_map_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "loose theme",
    });
  });

  test("POST rejects Main Map self-edges before Supabase", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "main-map-1",
        type: "main",
        sourceNodeId: "main-cluster-source",
        targetNodeId: "main-cluster-source",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("POST rejects Main Map cluster nodes not owned by the user", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeRows: [{ id: "main-cluster-source", main_mindmap_id: "main-map-1" }],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "main-map-1",
        type: "main",
        sourceNodeId: "main-cluster-source",
        targetNodeId: "foreign-cluster",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:server-user-123");
    expect(mock.calls).not.toContain("insert:commonplace_main_map_edges");
  });

  test("POST rejects Main Map cluster nodes from different main maps", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeRows: [
        { id: "main-cluster-source", main_mindmap_id: "main-map-1" },
        { id: "main-cluster-target", main_mindmap_id: "other-main-map" },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", {
        mapId: "main-map-1",
        type: "main",
        sourceNodeId: "main-cluster-source",
        targetNodeId: "main-cluster-target",
        edgeType: "solid",
      }),
    );

    expect(response.status).toBe(400);
    expect(mock.calls).not.toContain("insert:commonplace_main_map_edges");
  });

  test("PATCH updates owner-scoped Main Map edge label and type", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildRequest("PATCH", {
        ownerId: "attacker",
        mapId: "main-map-1",
        type: "main",
        edgeId: "main-edge-db-1",
        edgeType: "dashed",
        label: "revised theme",
      }),
    );
    const data = (await response.json()) as { edge: { edgeType: string; label: string } };

    expect(response.status).toBe(200);
    expect(data.edge).toMatchObject({
      edgeType: "dashed",
      label: "revised theme",
    });
    expect(mock.updated.commonplace_main_map_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "revised theme",
    });
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:main_mindmap_id:main-map-1");
    expect(JSON.stringify(mock.updated)).not.toContain("attacker");
  });

  test("DELETE removes owner-scoped Main Map edge without deleting clusters", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(
      buildRequest("DELETE", {
        mapId: "main-map-1",
        type: "main",
        edgeId: "main-edge-db-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("delete:commonplace_main_map_edges");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:server-user-123");
    expect(mock.deleted).toContain("commonplace_main_map_edges");
    expect(mock.calls).not.toContain("delete:commonplace_main_map_nodes");
  });

  test("Main Map raw Supabase errors and secrets are not exposed", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainEdgeReadError: new Error("raw Supabase failure SUPABASE_SERVICE_ROLE_KEY"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=main-map-1&type=main"),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_edge_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase failure");
    expect(JSON.stringify(data)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("PATCH updates owner-scoped edge label and type", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildRequest("PATCH", {
        ownerId: "attacker",
        mapId: "map-db-1",
        type: "sub",
        edgeId: "edge-db-1",
        edgeType: "dashed",
        label: "revised label",
      }),
    );
    const data = (await response.json()) as { edge: { edgeType: string; label: string } };

    expect(response.status).toBe(200);
    expect(data.edge).toMatchObject({
      edgeType: "dashed",
      label: "revised label",
    });
    expect(mock.updated.commonplace_mindmap_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "revised label",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:owner_id:server-user-123");
    expect(JSON.stringify(mock.updated)).not.toContain("attacker");
  });

  test("DELETE removes owner-scoped edge", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(
      buildRequest("DELETE", {
        mapId: "map-db-1",
        type: "sub",
        edgeId: "edge-db-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("delete:commonplace_mindmap_edges");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:owner_id:server-user-123");
    expect(mock.deleted).toContain("commonplace_mindmap_edges");
  });

  test("raw Supabase errors and secrets are not exposed", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      edgeReadError: new Error("raw Supabase failure SUPABASE_SERVICE_ROLE_KEY"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/edges?mapId=map-db-1&type=sub"),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_edge_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase failure");
    expect(JSON.stringify(data)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("route source keeps service role server-only and delegates Main Map edges through adapter helpers", () => {
    const routeSource = readFileSync(
      "src/app/api/commonplace/maps/edges/route.ts",
      "utf8",
    );

    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).toContain("listMainMapEdges");
    expect(routeSource).toContain("createMainMapEdge");
    expect(routeSource).toContain("updateMainMapEdge");
    expect(routeSource).toContain("deleteMainMapEdge");
    expect(routeSource).not.toContain("commonplace_main_map_edges");
  });
});
