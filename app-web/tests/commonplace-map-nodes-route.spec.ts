import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  DELETE,
  GET,
  PATCH,
  POST,
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

const baseMainMapRow = {
  id: "main-map-1",
  owner_id: "server-user-123",
  title: "Institutions Overview",
  type: "main",
  parent_mindmap_id: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

const baseSubMapRow = {
  ...baseMapRow,
  id: "sub-map-1",
  title: "Institutional Incentives",
  type: "sub",
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

const baseMainClusterRow = {
  id: "main-cluster-db-1",
  node_kind: "cluster",
  sub_mindmap_id: "sub-map-1",
  position_x: 140,
  position_y: 220,
  commonplace_mindmaps: {
    title: "Institutional Incentives",
    updated_at: "2026-06-06T02:00:00.000Z",
  },
};

const baseMainNoteRow = {
  id: "main-note-db-1",
  node_kind: "note",
  note_id: "note-db-1",
  sub_mindmap_id: null,
  position_x: 260,
  position_y: 320,
  commonplace_notes: {
    shortcode: "#wn1",
    title: "Institutions and Growth",
    source_book: "Why Nations Fail",
    tags: ["economics", "institutions"],
  },
};

const baseNoteRow = {
  id: "note-db-1",
  shortcode: "#wn1",
  title: "Institutions and Growth",
  source_book: "Why Nations Fail",
  tags: ["economics", "institutions"],
};

type MockOptions = {
  mapRow?: Record<string, unknown> | null;
  mapRows?: Record<string, unknown>[];
  mapReadError?: Error | null;
  noteRow?: Record<string, unknown> | null;
  noteReadError?: Error | null;
  nodeRows?: Record<string, unknown>[];
  nodeReadError?: Error | null;
  nodeInsertError?: Error | null;
  nodeUpdateError?: Error | null;
  nodeDeleteError?: Error | null;
  mainNodeRows?: Record<string, unknown>[];
  mainNodeReadError?: Error | null;
  mainNodeInsertError?: Error | null;
  mainNodeUpdateError?: Error | null;
  mainNodeDeleteError?: Error | null;
};

function buildPatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps/nodes", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps/nodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildDeleteRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps/nodes", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  const deleted: Record<string, boolean> = {};

  function buildQuery(table: string) {
    let operation = "";
    let insertedRow: Record<string, unknown> | null = null;
    const eqFilters: Record<string, string> = {};

    const query = {
      select(columns: string) {
        calls.push(`select:${table}:${columns.replace(/\s+/g, " ").trim()}`);
        return query;
      },
      insert(row: unknown) {
        operation = "insert";
        calls.push(`insert:${table}`);
        const rows = Array.isArray(row) ? row : [row];
        inserted[table] = [...(inserted[table] ?? []), ...rows];
        insertedRow = rows[0] as Record<string, unknown>;
        return query;
      },
      update(row: unknown) {
        operation = "update";
        calls.push(`update:${table}`);
        updated[table] = [...(updated[table] ?? []), row as Record<string, unknown>];
        return query;
      },
      delete() {
        operation = "delete";
        calls.push(`delete:${table}`);
        deleted[table] = true;
        return query;
      },
      eq(column: string, value: string) {
        eqFilters[column] = value;
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      in(column: string, values: string[]) {
        calls.push(`in:${table}:${column}:${values.join(",")}`);
        if (table === "commonplace_main_map_nodes") {
          return Promise.resolve({
            data: options.mainNodeRows ?? [baseMainClusterRow],
            error: options.mainNodeReadError ?? null,
          });
        }
        return Promise.resolve({
          data: options.nodeRows ?? [baseNodeRow],
          error: options.nodeReadError ?? null,
        });
      },
      order(column: string, orderOptions: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${orderOptions.ascending}`);
        if (table === "commonplace_main_map_nodes") {
          return Promise.resolve({
            data: options.mainNodeRows ?? [baseMainClusterRow],
            error: options.mainNodeReadError ?? null,
          });
        }
        return Promise.resolve({
          data: options.nodeRows ?? [baseNodeRow],
          error: options.nodeReadError ?? null,
        });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_notes") {
          return Promise.resolve({
            data:
              options.noteRow === undefined
                ? baseNoteRow
                : options.noteRow,
            error: options.noteReadError ?? null,
          });
        }
        if (table === "commonplace_main_map_nodes") {
          return Promise.resolve({
            data:
              options.mainNodeRows === undefined
                ? baseMainClusterRow
                : options.mainNodeRows[0] ?? null,
            error: options.mainNodeReadError ?? null,
          });
        }
        if (table === "commonplace_mindmap_nodes") {
          return Promise.resolve({
            data:
              options.nodeRows === undefined
                ? baseNodeRow
                : options.nodeRows[0] ?? null,
            error: options.nodeReadError ?? null,
          });
        }

        const mapRows =
          options.mapRows ??
          [
            { ...baseMapRow },
            { ...baseMainMapRow },
            { ...baseSubMapRow },
          ];
        const defaultMapRow =
          mapRows.find(
            (row) =>
              (!eqFilters.id || row.id === eqFilters.id) &&
              (!eqFilters.type || row.type === eqFilters.type),
          ) ?? null;

        return Promise.resolve({
          data:
            options.mapRow === undefined
              ? defaultMapRow
              : options.mapRow,
          error: options.mapReadError ?? null,
        });
      },
      single() {
        calls.push(`single:${table}`);
        if (table === "commonplace_mindmap_nodes" && operation === "insert") {
          return Promise.resolve({
            data: {
              id: `node-db-${(inserted.commonplace_mindmap_nodes ?? []).length}`,
              note_id: insertedRow?.note_id,
              position_x: insertedRow?.position_x,
              position_y: insertedRow?.position_y,
            },
            error: options.nodeInsertError ?? null,
          });
        }
        if (table === "commonplace_main_map_nodes" && operation === "insert") {
          const isNoteNode = insertedRow?.node_kind === "note";
          return Promise.resolve({
            data: {
              id: `${isNoteNode ? "main-note" : "main-cluster"}-db-${(inserted.commonplace_main_map_nodes ?? []).length}`,
              node_kind: insertedRow?.node_kind,
              note_id: insertedRow?.note_id,
              sub_mindmap_id: insertedRow?.sub_mindmap_id,
              position_x: insertedRow?.position_x,
              position_y: insertedRow?.position_y,
            },
            error: options.mainNodeInsertError ?? null,
          });
        }

        return Promise.resolve({
          data: null,
          error: null,
        });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        if (table === "commonplace_main_map_nodes") {
          const error =
            operation === "delete"
              ? options.mainNodeDeleteError ?? null
              : operation === "update"
                ? options.mainNodeUpdateError ?? null
                : options.mainNodeReadError ?? null;
          return Promise.resolve({
            data: null,
            error,
          }).then(onfulfilled);
        }

        return Promise.resolve({
          data: null,
          error:
            operation === "delete"
              ? options.nodeDeleteError ?? null
              : options.nodeUpdateError ?? null,
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

  return { client, calls, inserted, updated, deleted };
}

test.describe("Commonplace map nodes route", () => {
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
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=map-1&type=sub"),
    );
    const patchResponse = await PATCH(
      buildPatchRequest({
        mapId: "map-1",
        type: "sub",
        updates: [],
      }),
    );
    const postResponse = await POST(
      buildPostRequest({
        mapId: "map-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 10, y: 20 },
      }),
    );
    const deleteResponse = await DELETE(
      buildDeleteRequest({
        mapId: "main-map-1",
        type: "main",
        nodeId: "cluster-1",
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
    const postResponse = await POST(
      buildPostRequest({
        mapId: "map-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: Number.NaN, y: 20 },
      }),
    );

    expect(getResponse.status).toBe(400);
    expect(postResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
    expect(mock.calls).toEqual([]);
  });

  test("Main GET returns owner-scoped cluster and note nodes without edge table calls", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeRows: [baseMainClusterRow, baseMainNoteRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps/nodes?mapId=main-map-1&type=main"),
    );
    const data = (await response.json()) as {
      nodes: Array<{
        id: string;
        nodeKind: string;
        subMindMapTitle?: string;
        noteTitle?: string | null;
        noteSourceBook?: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(data.nodes[0]).toMatchObject({
      id: "main-cluster-db-1",
      nodeKind: "cluster",
      subMindMapTitle: "Institutional Incentives",
    });
    expect(data.nodes[1]).toMatchObject({
      id: "main-note-db-1",
      nodeKind: "note",
      noteTitle: "Institutions and Growth",
      noteSourceBook: "Why Nations Fail",
    });
    expect(mock.calls).toContain("select:commonplace_mindmaps:id");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:main_mindmap_id:main-map-1");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main PATCH updates owner-scoped visual node positions by node id", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeRows: [baseMainNoteRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildPatchRequest({
        mapId: "main-map-1",
        type: "main",
        updates: [{ nodeId: "main-note-db-1", position: { x: 200, y: 260 } }],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:main_mindmap_id:main-map-1");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:id:main-note-db-1");
    expect(mock.updated.commonplace_main_map_nodes[0]).toMatchObject({
      position_x: 200,
      position_y: 260,
    });
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main POST creates note nodes and ignores request owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "main-map-1",
        type: "main",
        nodeKind: "note",
        noteId: "note-db-1",
        position: { x: 120, y: 180 },
      }),
    );
    const data = (await response.json()) as {
      node: { id: string; nodeKind: string; noteId: string; noteTitle: string | null };
    };

    expect(response.status).toBe(201);
    expect(data.node).toMatchObject({
      id: "main-note-db-1",
      nodeKind: "note",
      noteId: "note-db-1",
      noteTitle: "Institutions and Growth",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:main-map-1");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
    expect(mock.calls).toContain("eq:commonplace_notes:id:note-db-1");
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:server-user-123");
    expect(mock.inserted.commonplace_main_map_nodes).toHaveLength(1);
    expect(mock.inserted.commonplace_main_map_nodes[0]).toMatchObject({
      owner_id: "server-user-123",
      main_mindmap_id: "main-map-1",
      node_kind: "note",
      sub_mindmap_id: null,
      note_id: "note-db-1",
      position_x: 120,
      position_y: 180,
    });
    expect(JSON.stringify(mock.inserted)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_nodes");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main POST creates duplicate note nodes for the same note", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const firstResponse = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "note",
        noteId: "note-db-1",
        position: { x: 120, y: 180 },
      }),
    );
    const secondResponse = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "note",
        noteId: "note-db-1",
        position: { x: 260, y: 300 },
      }),
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(mock.inserted.commonplace_main_map_nodes).toHaveLength(2);
    expect(mock.inserted.commonplace_main_map_nodes[0]).toMatchObject({
      node_kind: "note",
      note_id: "note-db-1",
      position_x: 120,
      position_y: 180,
    });
    expect(mock.inserted.commonplace_main_map_nodes[1]).toMatchObject({
      node_kind: "note",
      note_id: "note-db-1",
      position_x: 260,
      position_y: 300,
    });
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main POST note rejects notes outside the current owner scope", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({ noteRow: null });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "note",
        noteId: "foreign-note",
        position: { x: 120, y: 180 },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "map_not_found",
    });
    expect(mock.inserted.commonplace_main_map_nodes ?? []).toHaveLength(0);
  });

  test("Main POST creates duplicate cluster nodes and ignores request owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const firstResponse = await POST(
      buildPostRequest({
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "main-map-1",
        type: "main",
        nodeKind: "cluster",
        subMindmapId: "sub-map-1",
        position: { x: 140, y: 260 },
      }),
    );
    const secondResponse = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "cluster",
        subMindmapId: "sub-map-1",
        position: { x: 300, y: 360 },
      }),
    );
    const firstData = (await firstResponse.json()) as {
      node: { id: string; nodeKind: string; subMindMapId: string };
    };

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(firstData.node).toMatchObject({
      id: "main-cluster-db-1",
      nodeKind: "cluster",
      subMindMapId: "sub-map-1",
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:main-map-1");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:sub-map-1");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:sub");
    expect(mock.inserted.commonplace_main_map_nodes).toHaveLength(2);
    expect(mock.inserted.commonplace_main_map_nodes[0]).toMatchObject({
      owner_id: "server-user-123",
      main_mindmap_id: "main-map-1",
      node_kind: "cluster",
      sub_mindmap_id: "sub-map-1",
      note_id: null,
      position_x: 140,
      position_y: 260,
    });
    expect(mock.inserted.commonplace_main_map_nodes[1]).toMatchObject({
      sub_mindmap_id: "sub-map-1",
      position_x: 300,
      position_y: 360,
    });
    expect(JSON.stringify(mock.inserted)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("Main POST cluster rejects non-sub map references", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mapRows: [
        { ...baseMainMapRow },
        {
          ...baseMainMapRow,
          id: "not-a-sub-map",
          title: "Other Main Map",
        },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "cluster",
        subMindmapId: "not-a-sub-map",
        position: { x: 120, y: 180 },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "map_not_found" });
    expect(mock.calls).not.toContain("insert:commonplace_main_map_nodes");
  });

  test("Main DELETE removes only the visual node, not the referenced note or map", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeRows: [baseMainNoteRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(
      buildDeleteRequest({
        mapId: "main-map-1",
        type: "main",
        nodeId: "main-note-db-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("delete:commonplace_main_map_nodes");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:id:main-note-db-1");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls).not.toContain("delete:commonplace_mindmaps");
    expect(mock.calls).not.toContain("delete:commonplace_notes");
    expect(mock.deleted.commonplace_main_map_nodes).toBe(true);
  });

  test("Sub DELETE removes only the visual note node, not the Library note or map", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeRows: [baseNodeRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(
      buildDeleteRequest({
        mapId: "map-db-1",
        type: "sub",
        nodeId: "node-db-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mock.calls).toContain("delete:commonplace_mindmap_nodes");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:id:node-db-1");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:mindmap_id:map-db-1");
    expect(mock.calls).not.toContain("delete:commonplace_mindmaps");
    expect(mock.calls).not.toContain("delete:commonplace_notes");
    expect(mock.deleted.commonplace_mindmap_nodes).toBe(true);
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

  test("Sub POST creates owner-scoped note node and ignores request owner fields", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        ownerId: "attacker",
        owner_id: "attacker",
        mapId: "map-db-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 140, y: 260 },
      }),
    );
    const data = (await response.json()) as {
      node: { id: string; noteId: string; positionX: number; positionY: number };
    };

    expect(response.status).toBe(201);
    expect(data.node).toMatchObject({
      id: "node-db-1",
      noteId: "note-db-1",
      positionX: 140,
      positionY: 260,
    });
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:server-user-123");
    expect(mock.calls).toContain("insert:commonplace_mindmap_nodes");
    expect(mock.inserted.commonplace_mindmap_nodes[0]).toMatchObject({
      owner_id: "server-user-123",
      mindmap_id: "map-db-1",
      note_id: "note-db-1",
      position_x: 140,
      position_y: 260,
    });
    expect(JSON.stringify(mock.inserted)).not.toContain("attacker");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  test("Sub POST allows duplicate note node instances", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const firstResponse = await POST(
      buildPostRequest({
        mapId: "map-db-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 20, y: 40 },
      }),
    );
    const secondResponse = await POST(
      buildPostRequest({
        mapId: "map-db-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 240, y: 360 },
      }),
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(mock.inserted.commonplace_mindmap_nodes).toHaveLength(2);
    expect(mock.inserted.commonplace_mindmap_nodes[0]).toMatchObject({
      note_id: "note-db-1",
      position_x: 20,
      position_y: 40,
    });
    expect(mock.inserted.commonplace_mindmap_nodes[1]).toMatchObject({
      note_id: "note-db-1",
      position_x: 240,
      position_y: 360,
    });
  });

  test("Sub POST rejects maps and notes outside the current owner", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const missingMap = createMockSupabaseClient({ mapRow: null });
    testHooks.getSupabaseClient = () => missingMap.client;

    const mapResponse = await POST(
      buildPostRequest({
        mapId: "other-map",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 20, y: 40 },
      }),
    );

    const missingNote = createMockSupabaseClient({ noteRow: null });
    testHooks.getSupabaseClient = () => missingNote.client;
    const noteResponse = await POST(
      buildPostRequest({
        mapId: "map-db-1",
        type: "sub",
        noteId: "other-note",
        position: { x: 20, y: 40 },
      }),
    );

    expect(mapResponse.status).toBe(404);
    expect(noteResponse.status).toBe(404);
    await expect(mapResponse.json()).resolves.toEqual({ error: "map_not_found" });
    await expect(noteResponse.json()).resolves.toEqual({ error: "map_not_found" });
    expect(missingMap.calls).not.toContain("insert:commonplace_mindmap_nodes");
    expect(missingNote.calls).not.toContain("insert:commonplace_mindmap_nodes");
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

  test("Sub PATCH updates one duplicate node instance without touching its duplicate", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeRows: [
        {
          id: "node-duplicate-1",
          note_id: "note-db-1",
          position_x: 20,
          position_y: 40,
        },
      ],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildPatchRequest({
        mapId: "map-db-1",
        type: "sub",
        updates: [
          { nodeId: "node-duplicate-1", position: { x: 360, y: 420 } },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mock.updated.commonplace_mindmap_nodes).toHaveLength(1);
    expect(mock.updated.commonplace_mindmap_nodes[0]).toMatchObject({
      position_x: 360,
      position_y: 420,
    });
    expect(mock.calls).toContain(
      "in:commonplace_mindmap_nodes:id:node-duplicate-1",
    );
    expect(mock.calls).toContain(
      "eq:commonplace_mindmap_nodes:id:node-duplicate-1",
    );
    expect(mock.calls).not.toContain(
      "eq:commonplace_mindmap_nodes:id:node-duplicate-2",
    );
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

  test("POST Supabase failures return safe errors without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      nodeInsertError: new Error("raw Supabase insert failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        mapId: "map-db-1",
        type: "sub",
        noteId: "note-db-1",
        position: { x: 20, y: 40 },
      }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_node_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase insert failure");
  });

  test("Main POST Supabase failures return safe errors without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mainNodeInsertError: new Error("raw main cluster insert failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildPostRequest({
        mapId: "main-map-1",
        type: "main",
        nodeKind: "cluster",
        subMindmapId: "sub-map-1",
        position: { x: 20, y: 40 },
      }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_node_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw main cluster insert failure");
  });

  test("route source keeps service role server-only and does not reference edge tables", () => {
    const routeSource = readFileSync(
      "src/app/api/commonplace/maps/nodes/route.ts",
      "utf8",
    );

    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).toContain("createMainMapClusterNode");
    expect(routeSource).toContain("createMainMapNoteNode");
    expect(routeSource).toContain("deleteMainMapNode");
    expect(routeSource).toContain("deleteSubMapNode");
    expect(routeSource).not.toContain("commonplace_mindmap_edges");
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
