import { expect, test } from "@playwright/test";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import {
  createCommonplaceSubMindMap,
  listCommonplaceSubMindMaps,
  getCommonplaceMindMapGraph,
  saveCommonplaceMindMapGraph,
  deleteCommonplaceMindMap,
  createOrGetMainMindMap,
  type CreateCommonplaceMindMapInput,
  type SaveCommonplaceMindMapInput,
} from "../src/app/lib/storage/supabase-commonplace-mindmap-adapter";

type MockOptions = {
  mindMapRow?: Record<string, unknown> | null;
  listRows?: Record<string, unknown>[];
  nodesRows?: Record<string, unknown>[];
  edgesRows?: Record<string, unknown>[];
  notesRows?: Record<string, unknown>[];

  mindMapInsertError?: Error | null;
  mindMapReadError?: Error | null;
  mindMapUpdateError?: Error | null;
  mindMapDeleteError?: Error | null;
  nodeInsertError?: Error | null;
  nodeReadError?: Error | null;
  nodeDeleteError?: Error | null;
  edgeInsertError?: Error | null;
  edgeReadError?: Error | null;
  edgeDeleteError?: Error | null;
  notesReadError?: Error | null;
};

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const updated: Record<string, Record<string, unknown>[]> = {};
  const deleted: Record<string, boolean> = {};
  let noteIdsFilter: string[] = [];
  let insertedNodesPayload: Record<string, unknown>[] = [];
  let insertedPayload: Record<string, unknown> | null = null;

  function buildQuery(table: string) {
    let operation = "";
    const filters: string[] = [];

    const query = {
      insert(row: unknown) {
        operation = "insert";
        calls.push(`insert:${table}`);
        const rowsArray = Array.isArray(row) ? row : [row];
        inserted[table] = rowsArray as Record<string, unknown>[];
        insertedPayload = rowsArray[0] as Record<string, unknown>;
        if (table === "commonplace_mindmap_nodes") {
          insertedNodesPayload = rowsArray as Record<string, unknown>[];
        }
        return query;
      },
      update(row: unknown) {
        operation = "update";
        calls.push(`update:${table}`);
        updated[table] = [row as Record<string, unknown>];
        return query;
      },
      delete() {
        operation = "delete";
        calls.push(`delete:${table}`);
        deleted[table] = true;
        return query;
      },
      select(columns: string) {
        calls.push(`select:${table}:${columns}`);
        return query;
      },
      eq(column: string, value: string) {
        filters.push(`${column}:${value}`);
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      in(column: string, values: string[]) {
        filters.push(`${column}:in:${values.join(",")}`);
        calls.push(`in:${table}:${column}:${values.join(",")}`);
        if (table === "commonplace_notes" && column === "id") {
          noteIdsFilter = values;
        }
        return query;
      },
      order(column: string, optionsArg: { ascending: boolean }) {
        calls.push(`order:${table}:${column}:${optionsArg.ascending}`);
        return query;
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        let error: Error | null = null;
        let data: Record<string, unknown> | null = null;

        if (table === "commonplace_mindmaps") {
          error = options.mindMapReadError ?? null;
          if (operation === "insert") {
            data = {
              id: "map-db-123",
              owner_id: "user_123",
              title: "My Sub Map",
              type: "sub",
              parent_mindmap_id: null,
              created_at: "2026-06-06T00:00:00Z",
              updated_at: "2026-06-06T00:00:00Z",
              ...(insertedPayload ?? {}),
            };
          } else {
            data = options.mindMapRow !== undefined ? options.mindMapRow : {
              id: "map-db-123",
              owner_id: "user_123",
              title: "My Sub Map",
              type: "sub",
              parent_mindmap_id: null,
              created_at: "2026-06-06T00:00:00Z",
              updated_at: "2026-06-06T00:00:00Z",
            };
          }
        }
        return Promise.resolve({ data, error });
      },
      single() {
        calls.push(`single:${table}`);
        let error: Error | null = null;
        let data: Record<string, unknown> | null = null;

        if (table === "commonplace_mindmaps") {
          error = options.mindMapInsertError ?? null;
          if (operation === "insert") {
            data = {
              id: "map-db-123",
              owner_id: "user_123",
              title: "My Sub Map",
              type: "sub",
              parent_mindmap_id: null,
              created_at: "2026-06-06T00:00:00Z",
              updated_at: "2026-06-06T00:00:00Z",
              ...(insertedPayload ?? {}),
            };
          } else {
            data = options.mindMapRow !== undefined ? options.mindMapRow : {
              id: "map-db-123",
              owner_id: "user_123",
              title: "My Sub Map",
              type: "sub",
              parent_mindmap_id: null,
              created_at: "2026-06-06T00:00:00Z",
              updated_at: "2026-06-06T00:00:00Z",
            };
          }
        }
        return Promise.resolve({ data, error });
      },
      then(onfulfilled: (value: { data: unknown; error: Error | null }) => unknown) {
        let error: Error | null = null;
        let data: unknown = null;

        if (table === "commonplace_mindmaps") {
          if (operation === "insert") {
            error = options.mindMapInsertError ?? null;
            data = options.mindMapRow ?? {
              id: "map-db-123",
              owner_id: "user_123",
              title: "My Sub Map",
              type: "sub",
              parent_mindmap_id: null,
              created_at: "2026-06-06T00:00:00Z",
              updated_at: "2026-06-06T00:00:00Z",
              ...(insertedPayload ?? {}),
            };
          } else if (operation === "delete") {
            error = options.mindMapDeleteError ?? null;
          } else if (operation === "update") {
            error = options.mindMapUpdateError ?? null;
          } else {
            error = options.mindMapReadError ?? null;
            data = options.listRows ?? [
              {
                id: "map-db-123",
                owner_id: "user_123",
                title: "My Sub Map",
                type: "sub",
                parent_mindmap_id: null,
                created_at: "2026-06-06T00:00:00Z",
                updated_at: "2026-06-06T00:00:00Z",
              }
            ];
          }
        } else if (table === "commonplace_mindmap_nodes") {
          if (operation === "insert") {
            error = options.nodeInsertError ?? null;
            data = (insertedNodesPayload || []).map((n, i) => ({
              id: `node-db-uuid-${i + 1}`,
              note_id: n.note_id,
            }));
          } else if (operation === "delete") {
            error = options.nodeDeleteError ?? null;
          } else {
            error = options.nodeReadError ?? null;
            data = options.nodesRows ?? [];
          }
        } else if (table === "commonplace_mindmap_edges") {
          if (operation === "insert") {
            error = options.edgeInsertError ?? null;
            data = [];
          } else if (operation === "delete") {
            error = options.edgeDeleteError ?? null;
          } else {
            error = options.edgeReadError ?? null;
            data = options.edgesRows ?? [];
          }
        } else if (table === "commonplace_notes") {
          error = options.notesReadError ?? null;
          data = options.notesRows ?? (noteIdsFilter || []).map(id => ({ id }));
        }

        return Promise.resolve({ data, error }).then(onfulfilled);
      }
    };

    return query;
  }

  const client = ( {
    from(table: string) {
      calls.push(`from:${table}`);
      return buildQuery(table);
    },
  } ) as unknown as FonetikSupabaseClient;

  return { client, calls, inserted, updated, deleted };
}

test.describe("Supabase Commonplace Mind Map Storage Adapter", () => {
  // 1. Create sub mind map succeeds
  test("create sub mind map succeeds with ownerId and title", async () => {
    const mock = createMockSupabaseClient();
    const input: CreateCommonplaceMindMapInput = {
      ownerId: "user_123",
      title: "Philosophy Map",
    };

    const result = await createCommonplaceSubMindMap(input, mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mindMap.title).toBe("Philosophy Map");
    expect(result.mindMap.type).toBe("sub");
    expect(mock.inserted.commonplace_mindmaps[0]).toEqual({
      owner_id: "user_123",
      title: "Philosophy Map",
      type: "sub",
      parent_mindmap_id: null,
    });
  });

  // 2. Create rejects missing ownerId
  test("create rejects missing ownerId before Supabase call", async () => {
    const mock = createMockSupabaseClient();
    const result = await createCommonplaceSubMindMap(
      { ownerId: "  ", title: "Map" },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  // 3. Create rejects blank title
  test("create rejects blank title before Supabase call", async () => {
    const mock = createMockSupabaseClient();
    const result = await createCommonplaceSubMindMap(
      { ownerId: "user_123", title: "   " },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  // 4. List filters owner_id and type=sub
  test("list filters owner_id and type=sub", async () => {
    const mock = createMockSupabaseClient({
      listRows: [
        {
          id: "map-1",
          owner_id: "user_123",
          title: "Sub Map",
          type: "sub",
          parent_mindmap_id: null,
          created_at: "2026-06-06",
          updated_at: "2026-06-06",
        },
      ],
    });

    const result = await listCommonplaceSubMindMaps("user_123", mock.client);

    expect(result.ok).toBe(true);
    expect(mock.calls).toEqual([
      "from:commonplace_mindmaps",
      "select:commonplace_mindmaps:*",
      "eq:commonplace_mindmaps:owner_id:user_123",
      "eq:commonplace_mindmaps:type:sub",
      "order:commonplace_mindmaps:updated_at:false",
    ]);
  });

  // 5. Get graph filters by owner_id
  test("get graph filters mindmap/nodes/edges by owner_id", async () => {
    const mock = createMockSupabaseClient({
      nodesRows: [
        {
          id: "node-1",
          note_id: "note-uuid-1",
          position_x: 10,
          position_y: 20,
          commonplace_notes: {
            shortcode: "#wn1",
            title: "Why Nations Fail",
            source_book: "Why Nations Fail",
            insight: "Institutions.",
            tags: ["politics"],
          },
        },
      ],
      edgesRows: [
        {
          id: "edge-1",
          source_node_id: "node-1",
          target_node_id: "node-2",
          label: "causes",
        },
      ],
    });

    const result = await getCommonplaceMindMapGraph("user_123", "map-123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.summary.id).toBe("map-db-123");
    expect(result.graph.nodes.length).toBe(1);
    expect(result.graph.nodes[0].noteShortcode).toBe("#wn1");
    expect(result.graph.edges[0].label).toBe("causes");

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:map-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:mindmap_id:map-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:mindmap_id:map-123");
  });

  // 6. Get graph returns not_found
  test("get graph returns not_found when mindmap missing", async () => {
    const mock = createMockSupabaseClient({ mindMapRow: null });

    const result = await getCommonplaceMindMapGraph("user_123", "missing-map", mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_not_found",
    });
  });

  // 7. Save graph rejects missing ownerId/mindMapId
  test("save graph rejects missing ownerId/mindMapId", async () => {
    const mock = createMockSupabaseClient();
    const result = await saveCommonplaceMindMapGraph(
      { ownerId: " ", mindMapId: "map-1", nodes: [], edges: [] },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  // 8. Save graph rejects invalid node position
  test("save graph rejects invalid node position", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        {
          localId: "n1",
          noteId: "note-1",
          positionX: NaN,
          positionY: 200,
        },
      ],
      edges: [],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  // 9. Save graph rejects edge referencing unknown node
  test("save graph rejects edge that references unknown local node", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        {
          localId: "n1",
          noteId: "note-1",
          positionX: 100,
          positionY: 100,
        },
      ],
      edges: [
        {
          sourceLocalId: "n1",
          targetLocalId: "unknown-node",
          label: "link",
        },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  // 10. Save graph rejects self edge
  test("save graph rejects self edge", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        {
          localId: "n1",
          noteId: "note-1",
          positionX: 100,
          positionY: 100,
        },
      ],
      edges: [
        {
          sourceLocalId: "n1",
          targetLocalId: "n1",
          label: "self-loop",
        },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  // 11. Save graph rejects duplicate undirected edge
  test("save graph rejects duplicate undirected edge", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 10 },
        { localId: "n2", noteId: "note-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "n1", targetLocalId: "n2", label: "label 1" },
        { sourceLocalId: "n2", targetLocalId: "n1", label: "label 2" },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  // 12. Save graph inserts nodes and maps local IDs to database UUIDs
  test("save graph inserts nodes and maps local IDs to inserted DB node IDs for edges", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 10 },
        { localId: "n2", noteId: "note-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "n1", targetLocalId: "n2", label: "my relation" },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);

    // Verify DB node ids were successfully mapped:
    // node 1 mapped to node-db-uuid-1
    // node 2 mapped to node-db-uuid-2
    expect(mock.inserted.commonplace_mindmap_edges[0]).toEqual({
      owner_id: "user_123",
      mindmap_id: "map-123",
      source_node_id: "node-db-uuid-1",
      target_node_id: "node-db-uuid-2",
      label: "my relation",
    });
  });

  // 13. Save graph deletes old edges before old nodes
  test("save graph deletes old edges before old nodes", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [],
      edges: [],
    };

    await saveCommonplaceMindMapGraph(input, mock.client);

    const deleteEdgesIdx = mock.calls.indexOf("delete:commonplace_mindmap_edges");
    const deleteNodesIdx = mock.calls.indexOf("delete:commonplace_mindmap_nodes");

    expect(deleteEdgesIdx).toBeGreaterThan(-1);
    expect(deleteNodesIdx).toBeGreaterThan(-1);
    expect(deleteEdgesIdx).toBeLessThan(deleteNodesIdx); // Edges deleted before nodes
  });

  // 14. Save graph updates mindmap title/updated_at
  test("save graph updates mindmap title and updated_at timestamp", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      title: "New Title",
      nodes: [],
      edges: [],
    };

    await saveCommonplaceMindMapGraph(input, mock.client);

    expect(mock.updated.commonplace_mindmaps[0].title).toBe("New Title");
    expect(mock.updated.commonplace_mindmaps[0].updated_at).toBeDefined();
  });

  // 15. Delete mindmap filters by owner_id and id
  test("delete mindmap filters by owner_id and mindmap_id", async () => {
    const mock = createMockSupabaseClient();

    const result = await deleteCommonplaceMindMap("user_123", "map-123", mock.client);

    expect(result).toEqual({ ok: true });
    expect(mock.calls).toEqual([
      "from:commonplace_mindmaps",
      "delete:commonplace_mindmaps",
      "eq:commonplace_mindmaps:owner_id:user_123",
      "eq:commonplace_mindmaps:id:map-123",
    ]);
  });

  // 16. Supabase failure returns commonplace_save_failed
  test("Supabase failure returns safe commonplace_save_failed", async () => {
    const mock = createMockSupabaseClient({
      mindMapInsertError: new Error("relation commonplace_mindmaps is unavailable"),
    });

    const result = await createCommonplaceSubMindMap(
      { ownerId: "user_123", title: "Map" },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_save_failed",
    });
  });

  // 17. Not found returns safe commonplace_not_found
  test("not found returns safe commonplace_not_found", async () => {
    const mock = createMockSupabaseClient({ mindMapRow: null });

    const result = await saveCommonplaceMindMapGraph(
      { ownerId: "user_123", mindMapId: "missing-map", nodes: [], edges: [] },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_not_found",
    });
  });

  // 18. Forbidden fields are not mapped/stored
  test("forbidden fields are not mapped or stored", async () => {
    const mock = createMockSupabaseClient();
    const payload = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [],
      edges: [],
      api_key: "secret",
      raw_provider_payload: {},
      audio: "audio",
      audio_blob: "blob",
      recording_url: "url",
      stt_payload: {},
      tts_payload: {},
      auth_metadata: {},
    } as unknown as SaveCommonplaceMindMapInput;

    await saveCommonplaceMindMapGraph(payload, mock.client);

    const updatedMap = mock.updated.commonplace_mindmaps[0] as Record<string, unknown>;
    for (const forbidden of [
      "api_key",
      "raw_provider_payload",
      "audio",
      "audio_blob",
      "recording_url",
      "stt_payload",
      "tts_payload",
      "auth_metadata",
    ]) {
      expect(updatedMap[forbidden]).toBeUndefined();
    }
  });

  // Helper createOrGetMainMindMap tests
  test("createOrGetMainMindMap creates main mind map if not found", async () => {
    const mock = createMockSupabaseClient({ mindMapRow: null });

    const result = await createOrGetMainMindMap("user_123", mock.client);

    expect(result.ok).toBe(true);
    expect(mock.calls).toContain("select:commonplace_mindmaps:*");
    expect(mock.calls).toContain("insert:commonplace_mindmaps");
    expect(mock.inserted.commonplace_mindmaps[0]).toEqual({
      owner_id: "user_123",
      title: "Main Mind Map",
      type: "main",
    });
  });
});
