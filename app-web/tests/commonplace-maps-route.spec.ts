import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  DELETE,
  GET,
  PATCH,
  POST,
  testHooks,
} from "../src/app/api/commonplace/maps/route";

const baseMapRow = {
  id: "map-db-1",
  owner_id: "server-user-123",
  title: "Institutions Overview",
  type: "main",
  parent_mindmap_id: null,
  created_at: "2026-06-06T01:00:00.000Z",
  updated_at: "2026-06-06T01:00:00.000Z",
};

type MockOptions = {
  listRows?: Record<string, unknown>[];
  mapReadRow?: Record<string, unknown> | null;
  mapInsertError?: Error | null;
  mapUpdateError?: Error | null;
  mapDeleteError?: Error | null;
  mapReadError?: Error | null;
  relatedSubNodes?: Record<string, unknown>[];
  relatedMainNodes?: Record<string, unknown>[];
  relatedClusterRefs?: Record<string, unknown>[];
};

function buildRequest(method: string, body?: Record<string, unknown>): Request {
  return new Request("http://localhost/api/commonplace/maps", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const updated: Record<string, unknown[]> = {};
  let operation = "";
  let payload: unknown = null;
  const filters: string[] = [];

  function buildQuery(table: string) {
    const query = {
      insert(row: unknown) {
        operation = "insert";
        payload = row;
        calls.push(`insert:${table}`);
        inserted[table] = Array.isArray(row) ? row : [row];
        return query;
      },
      update(row: unknown) {
        operation = "update";
        payload = row;
        calls.push(`update:${table}`);
        updated[table] = [row];
        return query;
      },
      delete() {
        operation = "delete";
        calls.push(`delete:${table}`);
        return query;
      },
      select(columns: string) {
        calls.push(`select:${table}:${columns}`);
        return query;
      },
      eq(column: string, value: string) {
        filters.push(`${table}:${column}:${value}`);
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      order(column: string, optionsArg: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${optionsArg.ascending}`);
        return Promise.resolve({
          data: options.listRows ?? [baseMapRow],
          error: options.mapReadError ?? null,
        });
      },
      limit(count: number) {
        calls.push(`limit:${table}:${count}`);
        return Promise.resolve({
          data:
            table === "commonplace_mindmap_nodes"
              ? options.relatedSubNodes ?? []
              : filters.some((filter) => filter.includes("main_mindmap_id"))
                ? options.relatedMainNodes ?? []
                : options.relatedClusterRefs ?? [],
          error: null,
        });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_mindmaps" && operation === "update") {
          return Promise.resolve({
            data:
              options.mapUpdateError || options.mapReadRow === null
                ? null
                : { ...baseMapRow, ...(payload as Record<string, unknown>) },
            error: options.mapUpdateError ?? null,
          });
        }
        return Promise.resolve({
          data:
            options.mapReadRow === undefined ? { id: baseMapRow.id } : options.mapReadRow,
          error: options.mapReadError ?? null,
        });
      },
      single() {
        calls.push(`single:${table}`);
        return Promise.resolve({
          data:
            options.mapInsertError || !payload
              ? null
              : { ...baseMapRow, ...(payload as Record<string, unknown>) },
          error: options.mapInsertError ?? null,
        });
      },
      then(
        onfulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      ) {
        if (table === "commonplace_mindmaps" && operation === "delete") {
          return Promise.resolve({
            data: null,
            error: options.mapDeleteError ?? null,
          }).then(onfulfilled);
        }
        return Promise.resolve({ data: null, error: null }).then(onfulfilled);
      },
    };
    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      operation = "";
      payload = null;
      filters.length = 0;
      return buildQuery(table);
    },
  };

  return { client, calls, inserted, updated };
}

test.describe("Commonplace maps route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated requests return auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    testHooks.getSupabaseClient = () => {
      throw new Error("should not create client");
    };

    for (const handler of [
      () => GET(buildRequest("GET")),
      () => POST(buildRequest("POST", { title: "Map", type: "main" })),
      () => PATCH(buildRequest("PATCH", { mapId: "map-1", title: "Map" })),
      () => DELETE(buildRequest("DELETE", { mapId: "map-1" })),
    ]) {
      const response = await handler();
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "auth_required" });
    }
  });

  test("GET returns owner-scoped maps and filters by type", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(
      new Request("http://localhost/api/commonplace/maps?type=main"),
    );
    const data = (await response.json()) as { maps: Array<{ ownerId: string }> };

    expect(response.status).toBe(200);
    expect(data.maps[0].ownerId).toBe("server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
  });

  test("POST creates main and sub maps with server ownerId and ignores body owner", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const mainResponse = await POST(
      buildRequest("POST", {
        ownerId: "attacker",
        owner_id: "attacker",
        title: "Main Registry Map",
        type: "main",
      }),
    );
    const subResponse = await POST(
      buildRequest("POST", { title: "Sub Registry Map", type: "sub" }),
    );

    expect(mainResponse.status).toBe(201);
    expect(subResponse.status).toBe(201);
    expect(mock.inserted.commonplace_mindmaps[0]).toMatchObject({
      owner_id: "server-user-123",
      title: "Sub Registry Map",
      type: "sub",
    });
    expect(JSON.stringify(mock.inserted.commonplace_mindmaps)).not.toContain(
      "attacker",
    );
  });

  test("invalid type is rejected before Supabase", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", { title: "Bad Map", type: "canvas" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_map_fields",
    });
    expect(mock.calls).toEqual([]);
  });

  test("PATCH renames only owner-scoped map", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await PATCH(
      buildRequest("PATCH", { mapId: "map-db-1", title: "Renamed Map" }),
    );
    const data = (await response.json()) as { map: { title: string } };

    expect(response.status).toBe(200);
    expect(data.map.title).toBe("Renamed Map");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:map-db-1");
  });

  test("DELETE hard-deletes own map only after related graph checks", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(buildRequest("DELETE", { mapId: "map-db-1" }));

    expect(response.status).toBe(200);
    expect(mock.calls).toContain("select:commonplace_mindmap_nodes:id");
    expect(mock.calls).toContain("select:commonplace_main_map_nodes:id");
    expect(mock.calls).toContain("delete:commonplace_mindmaps");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:server-user-123");
  });

  test("DELETE blocks maps that already have related graph data", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      relatedSubNodes: [{ id: "node-1" }],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await DELETE(buildRequest("DELETE", { mapId: "map-db-1" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "map_has_related_graph_data",
    });
    expect(mock.calls).not.toContain("delete:commonplace_mindmaps");
  });

  test("Supabase failures return safe map error without raw details", async () => {
    testHooks.resolveCurrentUserId = async () => "server-user-123";
    const mock = createMockSupabaseClient({
      mapInsertError: new Error("raw Supabase relation failure"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await POST(
      buildRequest("POST", { title: "Map", type: "main" }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "map_save_failed" });
    expect(JSON.stringify(data)).not.toContain("raw Supabase relation failure");
  });

  test("route source keeps service role server-only and does not use singleton main map helper", () => {
    const routeSource = readFileSync(
      "src/app/api/commonplace/maps/route.ts",
      "utf8",
    );
    const componentSource = readFileSync(
      "src/app/components/CommonplaceView.tsx",
      "utf8",
    );

    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).not.toContain("createOrGetMainMindMap");
    expect(routeSource).not.toContain("createOrGetCommonplaceMainMindMap");
    expect(componentSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(componentSource).toContain("/api/commonplace/maps");
  });
});
