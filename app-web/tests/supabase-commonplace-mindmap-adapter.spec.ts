import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";

import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import {
  createCommonplaceSubMindMap,
  listCommonplaceSubMindMaps,
  getCommonplaceMindMapGraph,
  saveCommonplaceMindMapGraph,
  deleteCommonplaceMindMap,
  createOrGetMainMindMap,
  createOrGetCommonplaceMainMindMap,
  getCommonplaceMainMindMapGraph,
  saveCommonplaceMainMindMapGraph,
  deleteCommonplaceMainMapCluster,
  batchUpdateMainMapNodePositions,
  createMainMapClusterNode,
  createMainMapNoteNode,
  createMainMapEdge,
  deleteMainMapNode,
  deleteMainMapEdge,
  listMainMapEdges,
  listMainMapNodes,
  updateMainMapEdge,
  type CreateCommonplaceMindMapInput,
  type SaveCommonplaceMindMapInput,
  type CommonplaceMainMapEdgeType,
  type CommonplaceMainMapNodeKind,
  type SaveCommonplaceMainMapGraphInput,
} from "../src/app/lib/storage/supabase-commonplace-mindmap-adapter";

type MockOptions = {
  mindMapRow?: Record<string, unknown> | null;
  listRows?: Record<string, unknown>[];
  nodesRows?: Record<string, unknown>[];
  edgesRows?: Record<string, unknown>[];
  notesRows?: Record<string, unknown>[];
  noteRow?: Record<string, unknown> | null;

  // Main map options:
  mainNodesRows?: Record<string, unknown>[];
  mainEdgesRows?: Record<string, unknown>[];
  subMindMapsRows?: Record<string, unknown>[];

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

  // Main map errors:
  mainNodeInsertError?: Error | null;
  mainNodeReadError?: Error | null;
  mainNodeUpdateError?: Error | null;
  mainNodeDeleteError?: Error | null;
  mainEdgeInsertError?: Error | null;
  mainEdgeReadError?: Error | null;
  mainEdgeUpdateError?: Error | null;
  mainEdgeUpdateRow?: Record<string, unknown> | null;
  mainEdgeDeleteError?: Error | null;
  existingMainEdgeRow?: Record<string, unknown> | null;
};

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const updated: Record<string, Record<string, unknown>[]> = {};
  const deleted: Record<string, boolean> = {};
  let noteIdsFilter: string[] = [];
  let mainNodeIdsFilter: string[] = [];
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
        inserted[table] = [
          ...(inserted[table] ?? []),
          ...(rowsArray as Record<string, unknown>[]),
        ];
        insertedPayload = rowsArray[0] as Record<string, unknown>;
        if (table === "commonplace_mindmap_nodes" || table === "commonplace_main_map_nodes") {
          insertedNodesPayload = rowsArray as Record<string, unknown>[];
        }
        return query;
      },
      update(row: unknown) {
        operation = "update";
        calls.push(`update:${table}`);
        updated[table] = [row as Record<string, unknown>];
        insertedPayload = row as Record<string, unknown>;
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
        if (table === "commonplace_main_map_nodes" && column === "id") {
          mainNodeIdsFilter = values;
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
        } else if (table === "commonplace_main_map_nodes") {
          error = options.mainNodeReadError ?? null;
          data = options.mainNodesRows?.[0] ?? {
            id: "main-node-db-uuid-1",
          };
        } else if (table === "commonplace_notes") {
          error = options.notesReadError ?? null;
          data =
            options.noteRow === undefined
              ? {
                  id: "note-1",
                  shortcode: "#wn1",
                  title: "Institutions and Growth",
                  source_book: "Why Nations Fail",
                  tags: ["economics", "institutions"],
                }
              : options.noteRow;
        } else if (table === "commonplace_main_map_edges") {
          if (operation === "update") {
            error = options.mainEdgeUpdateError ?? null;
            data =
              options.mainEdgeUpdateRow === undefined
                ? {
                    id: "main-edge-db-1",
                    main_mindmap_id: "main-map-db-123",
                    source_node_id: "main-node-source",
                    target_node_id: "main-node-target",
                    edge_type: insertedPayload?.edge_type ?? "dashed",
                    label: insertedPayload?.label ?? "updated link",
                  }
                : options.mainEdgeUpdateRow;
          } else {
            error = options.mainEdgeReadError ?? null;
            data =
              options.existingMainEdgeRow === undefined
                ? { id: "main-edge-db-1" }
                : options.existingMainEdgeRow;
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
        } else if (table === "commonplace_main_map_nodes") {
          if (operation === "insert") {
            error = options.mainNodeInsertError ?? null;
            data = {
              id: `main-node-db-uuid-${(inserted.commonplace_main_map_nodes ?? []).length}`,
              node_kind: insertedPayload?.node_kind,
              note_id: insertedPayload?.note_id,
              sub_mindmap_id: insertedPayload?.sub_mindmap_id,
              position_x: insertedPayload?.position_x,
              position_y: insertedPayload?.position_y,
            };
          }
        } else if (table === "commonplace_main_map_edges") {
          if (operation === "insert") {
            error = options.mainEdgeInsertError ?? null;
            data = {
              id: `main-edge-db-uuid-${(inserted.commonplace_main_map_edges ?? []).length}`,
              main_mindmap_id: insertedPayload?.main_mindmap_id,
              source_node_id: insertedPayload?.source_node_id,
              target_node_id: insertedPayload?.target_node_id,
              edge_type: insertedPayload?.edge_type,
              label: insertedPayload?.label,
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
            data = options.subMindMapsRows ?? options.listRows ?? [
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
        } else if (table === "commonplace_main_map_nodes") {
          if (operation === "insert") {
            error = options.mainNodeInsertError ?? null;
            data = (insertedNodesPayload || []).map((n, i) => ({
              id: `main-node-db-uuid-${i + 1}`,
              sub_mindmap_id: n.sub_mindmap_id,
              node_kind: n.node_kind,
              note_id: n.note_id,
            }));
          } else if (operation === "delete") {
            error = options.mainNodeDeleteError ?? null;
          } else if (operation === "update") {
            error = options.mainNodeUpdateError ?? null;
          } else {
            error = options.mainNodeReadError ?? null;
            data =
              mainNodeIdsFilter.length > 0
                ? (options.mainNodesRows ?? []).filter((row) =>
                    mainNodeIdsFilter.includes(String(row.id)),
                  )
                : options.mainNodesRows ?? [];
          }
        } else if (table === "commonplace_main_map_edges") {
          if (operation === "insert") {
            error = options.mainEdgeInsertError ?? null;
            data = [];
          } else if (operation === "delete") {
            error = options.mainEdgeDeleteError ?? null;
          } else {
            error = options.mainEdgeReadError ?? null;
            data = options.mainEdgesRows ?? [];
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
  test("exports Main Map node kind and edge type unions for future visual nodes", () => {
    const clusterKind: CommonplaceMainMapNodeKind = "cluster";
    const noteKind: CommonplaceMainMapNodeKind = "note";
    const solidEdge: CommonplaceMainMapEdgeType = "solid";
    const dashedEdge: CommonplaceMainMapEdgeType = "dashed";

    expect([clusterKind, noteKind]).toEqual(["cluster", "note"]);
    expect([solidEdge, dashedEdge]).toEqual(["solid", "dashed"]);
  });

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
          edge_type: "dashed",
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
    expect(result.graph.edges[0].edgeType).toBe("dashed");

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

  test("get graph defaults legacy edges without edge_type to solid", async () => {
    const mock = createMockSupabaseClient({
      edgesRows: [
        {
          id: "legacy-edge-1",
          source_node_id: "node-1",
          target_node_id: "node-2",
          label: "legacy label",
        },
      ],
    });

    const result = await getCommonplaceMindMapGraph("user_123", "map-123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.edges[0]).toMatchObject({
      id: "legacy-edge-1",
      edgeType: "solid",
      label: "legacy label",
    });
  });

  test("save graph rejects invalid edge_type", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 10 },
        { localId: "n2", noteId: "note-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        {
          sourceLocalId: "n1",
          targetLocalId: "n2",
          edgeType: "bold",
          label: "invalid edge type",
        },
      ],
    } as unknown as SaveCommonplaceMindMapInput;

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  // 12. Save graph inserts nodes and maps local IDs to database UUIDs
  test("save graph inserts nodes and maps local IDs to inserted DB node IDs for solid edges", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 10 },
        { localId: "n2", noteId: "note-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        {
          sourceLocalId: "n1",
          targetLocalId: "n2",
          edgeType: "solid",
          label: "my relation",
        },
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
      edge_type: "solid",
      label: "my relation",
    });
  });

  test("save graph inserts dashed edge type independently from label", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 10 },
        { localId: "n2", noteId: "note-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        {
          sourceLocalId: "n1",
          targetLocalId: "n2",
          edgeType: "dashed",
          label: "possible relation",
        },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.inserted.commonplace_mindmap_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "possible relation",
    });
  });

  test("save graph allows duplicate note nodes as separate visual instances", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMindMapInput = {
      ownerId: "user_123",
      mindMapId: "map-123",
      nodes: [
        { localId: "n1", noteId: "note-1", positionX: 10, positionY: 20 },
        { localId: "n2", noteId: "note-1", positionX: 240, positionY: 360 },
      ],
      edges: [
        { sourceLocalId: "n1", targetLocalId: "n2", label: "same idea twice" },
      ],
    };

    const result = await saveCommonplaceMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.calls).toContain("in:commonplace_notes:id:note-1");
    expect(mock.inserted.commonplace_mindmap_nodes).toEqual([
      {
        owner_id: "user_123",
        mindmap_id: "map-123",
        note_id: "note-1",
        position_x: 10,
        position_y: 20,
      },
      {
        owner_id: "user_123",
        mindmap_id: "map-123",
        note_id: "note-1",
        position_x: 240,
        position_y: 360,
      },
    ]);
    expect(mock.inserted.commonplace_mindmap_edges[0]).toMatchObject({
      source_node_id: "node-db-uuid-1",
      target_node_id: "node-db-uuid-2",
      edge_type: "solid",
    });
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_nodes");
  });

  test("edge type migration adds only Sub Mind Map edge_type schema", () => {
    const migration = readFileSync(
      "../supabase/migrations/20260608_002_add_commonplace_edge_type.sql",
      "utf8",
    );

    expect(migration).toContain("alter table public.commonplace_mindmap_edges");
    expect(migration).toContain("add column if not exists edge_type text not null default 'solid'");
    expect(migration).toContain("commonplace_mindmap_edges_edge_type_valid");
    expect(migration).toContain("check (edge_type in ('solid', 'dashed'))");
    expect(migration).not.toContain("commonplace_main_map_edges");
    expect(migration).not.toContain("disable row level security");
    expect(migration).not.toContain("drop table");
  });

  test("main map visual node migration prepares duplicate clusters, note nodes, and edge types only", () => {
    const migration = readFileSync(
      "../supabase/migrations/20260608_003_prepare_commonplace_main_map_visual_nodes.sql",
      "utf8",
    );

    expect(migration).toContain(
      "drop constraint if exists commonplace_main_map_nodes_owner_main_sub_unique",
    );
    expect(migration).toContain("add column if not exists node_kind text not null default 'cluster'");
    expect(migration).toContain("check (node_kind in ('cluster', 'note'))");
    expect(migration).toContain("add column if not exists note_id uuid");
    expect(migration).toContain("foreign key (note_id)");
    expect(migration).toContain("references public.commonplace_notes(id)");
    expect(migration).toContain("commonplace_main_map_nodes_target_valid");
    expect(migration).toContain("create index if not exists commonplace_main_map_nodes_owner_main_kind_idx");
    expect(migration).toContain("create index if not exists commonplace_main_map_nodes_owner_main_note_idx");
    expect(migration).toContain("alter table public.commonplace_main_map_edges");
    expect(migration).toContain("add column if not exists edge_type text not null default 'solid'");
    expect(migration).toContain("commonplace_main_map_edges_edge_type_valid");
    expect(migration).not.toContain("alter table public.commonplace_mindmap_edges");
    expect(migration).not.toContain("disable row level security");
    expect(migration).not.toContain("drop table");
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

  // Main Mind Map storage adapter tests
  test("createOrGetCommonplaceMainMindMap returns existing main map", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    const result = await createOrGetCommonplaceMainMindMap("user_123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mindMap.id).toBe("main-map-db-123");
    expect(result.mindMap.type).toBe("main");
    expect(mock.calls).toContain("select:commonplace_mindmaps:*");
    expect(mock.calls).not.toContain("insert:commonplace_mindmaps");
  });

  test("createOrGetCommonplaceMainMindMap creates main map if missing", async () => {
    const mock = createMockSupabaseClient({ mindMapRow: null });

    const result = await createOrGetCommonplaceMainMindMap("user_123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mindMap.title).toBe("Main Mind Map");
    expect(result.mindMap.type).toBe("main");
    expect(mock.calls).toContain("insert:commonplace_mindmaps");
  });

  test("createOrGetCommonplaceMainMindMap rejects missing ownerId before Supabase call", async () => {
    const mock = createMockSupabaseClient();
    const result = await createOrGetCommonplaceMainMindMap("  ", mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  test("getCommonplaceMainMindMapGraph filters by owner_id", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    await getCommonplaceMainMindMapGraph("user_123", mock.client);

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:user_123");
  });

  test("getCommonplaceMainMindMapGraph returns clusters referencing sub mindmaps", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [
        {
          id: "node-db-1",
          sub_mindmap_id: "sub-map-1",
          position_x: 15,
          position_y: 30,
          commonplace_mindmaps: {
            title: "Sub Map Title",
            updated_at: "2026-06-06T12:00:00Z",
          },
        },
      ],
    });

    const result = await getCommonplaceMainMindMapGraph("user_123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.clusters.length).toBe(1);
    expect(result.graph.clusters[0]).toEqual({
      id: "node-db-1",
      subMindMapId: "sub-map-1",
      subMindMapTitle: "Sub Map Title",
      positionX: 15,
      positionY: 30,
      updatedAt: "2026-06-06T12:00:00Z",
    });
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
  });

  test("getCommonplaceMainMindMapGraph returns edges with edge types", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainEdgesRows: [
        {
          id: "edge-db-1",
          source_node_id: "node-db-1",
          target_node_id: "node-db-2",
          edge_type: "dashed",
          label: "connected-label",
        },
      ],
    });

    const result = await getCommonplaceMainMindMapGraph("user_123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.edges.length).toBe(1);
    expect(result.graph.edges[0]).toEqual({
      id: "edge-db-1",
      sourceNodeId: "node-db-1",
      targetNodeId: "node-db-2",
      edgeType: "dashed",
      label: "connected-label",
    });
  });

  test("getCommonplaceMainMindMapGraph defaults legacy main edges without edge_type to solid", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainEdgesRows: [
        {
          id: "edge-db-1",
          source_node_id: "node-db-1",
          target_node_id: "node-db-2",
          label: "legacy main edge",
        },
      ],
    });

    const result = await getCommonplaceMainMindMapGraph("user_123", mock.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.edges[0]).toMatchObject({
      id: "edge-db-1",
      edgeType: "solid",
      label: "legacy main edge",
    });
  });

  test("listMainMapEdges returns owner-scoped cluster edges", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainEdgesRows: [
        {
          id: "main-edge-db-1",
          main_mindmap_id: "main-map-db-123",
          source_node_id: "main-node-source",
          target_node_id: "main-node-target",
          edge_type: "dashed",
          label: "theme bridge",
        },
      ],
    });

    const result = await listMainMapEdges(
      "user_123",
      "main-map-db-123",
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edges).toEqual([
      {
        id: "main-edge-db-1",
        mapId: "main-map-db-123",
        sourceNodeId: "main-node-source",
        targetNodeId: "main-node-target",
        edgeType: "dashed",
        label: "theme bridge",
      },
    ]);
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:user_123");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:main_mindmap_id:main-map-db-123");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_edges");
  });

  test("createMainMapEdge inserts a cluster-to-cluster edge without touching node tables", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [
        { id: "main-node-source", main_mindmap_id: "main-map-db-123", node_kind: "cluster" },
        { id: "main-node-target", main_mindmap_id: "main-map-db-123", node_kind: "cluster" },
      ],
    });

    const result = await createMainMapEdge(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        sourceNodeId: "main-node-source",
        targetNodeId: "main-node-target",
        edgeType: "solid",
        label: "direct theme",
      },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edge).toMatchObject({
      id: "main-edge-db-uuid-1",
      mapId: "main-map-db-123",
      sourceNodeId: "main-node-source",
      targetNodeId: "main-node-target",
      edgeType: "solid",
      label: "direct theme",
    });
    expect(mock.inserted.commonplace_main_map_edges[0]).toEqual({
      owner_id: "user_123",
      main_mindmap_id: "main-map-db-123",
      source_node_id: "main-node-source",
      target_node_id: "main-node-target",
      edge_type: "solid",
      label: "direct theme",
    });
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls).not.toContain("insert:commonplace_main_map_nodes");
    expect(mock.calls).not.toContain("delete:commonplace_main_map_nodes");
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
      edgeType: "solid" as const,
      label: "cluster detail",
    },
    {
      name: "note to cluster",
      sourceNodeId: "main-note-source",
      targetNodeId: "main-cluster-target",
      edgeType: "dashed" as const,
      label: "note evidence",
    },
    {
      name: "note to note",
      sourceNodeId: "main-note-source",
      targetNodeId: "main-note-target",
      edgeType: "solid" as const,
      label: "note pair",
    },
  ];

  for (const { name, sourceNodeId, targetNodeId, edgeType, label } of mainMixedEdgeCases) {
    test(`createMainMapEdge creates mixed visual-node edge: ${name}`, async () => {
      const mock = createMockSupabaseClient({
        mindMapRow: {
          id: "main-map-db-123",
          owner_id: "user_123",
          title: "Main Mind Map",
          type: "main",
          parent_mindmap_id: null,
          created_at: "2026-06-06T00:00:00Z",
          updated_at: "2026-06-06T00:00:00Z",
        },
        mainNodesRows: [
          { id: "main-cluster-source", main_mindmap_id: "main-map-db-123", node_kind: "cluster" },
          { id: "main-cluster-target", main_mindmap_id: "main-map-db-123", node_kind: "cluster" },
          { id: "main-note-source", main_mindmap_id: "main-map-db-123", node_kind: "note" },
          { id: "main-note-target", main_mindmap_id: "main-map-db-123", node_kind: "note" },
        ],
      });

      const result = await createMainMapEdge(
        "user_123",
        {
          mainMapId: "main-map-db-123",
          sourceNodeId,
          targetNodeId,
          edgeType,
          label,
        },
        mock.client,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.edge).toMatchObject({
        sourceNodeId,
        targetNodeId,
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

  test("createMainMapEdge rejects clusters from different Main Maps", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [
        { id: "main-node-source", main_mindmap_id: "main-map-db-123" },
        { id: "main-node-target", main_mindmap_id: "other-main-map" },
      ],
    });

    const result = await createMainMapEdge(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        sourceNodeId: "main-node-source",
        targetNodeId: "main-node-target",
        edgeType: "dashed",
        label: "bad link",
      },
      mock.client,
    );

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).not.toContain("insert:commonplace_main_map_edges");
  });

  test("updateMainMapEdge updates only edge type and label", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    const result = await updateMainMapEdge(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        edgeId: "main-edge-db-1",
        edgeType: "dashed",
        label: "revised theme",
      },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edge).toMatchObject({
      id: "main-edge-db-1",
      mapId: "main-map-db-123",
      edgeType: "dashed",
      label: "revised theme",
    });
    expect(mock.updated.commonplace_main_map_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "revised theme",
    });
    expect(mock.updated.commonplace_main_map_edges[0].source_node_id).toBeUndefined();
    expect(mock.updated.commonplace_main_map_edges[0].target_node_id).toBeUndefined();
    expect(mock.calls).not.toContain("update:commonplace_main_map_nodes");
  });

  test("deleteMainMapEdge removes only the edge row", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    const result = await deleteMainMapEdge(
      "user_123",
      "main-map-db-123",
      "main-edge-db-1",
      mock.client,
    );

    expect(result).toEqual({ ok: true });
    expect(mock.deleted.commonplace_main_map_edges).toBe(true);
    expect(mock.deleted.commonplace_main_map_nodes).toBeUndefined();
    expect(mock.deleted.commonplace_mindmaps).toBeUndefined();
  });

  test("saveCommonplaceMainMindMapGraph rejects invalid cluster position", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        {
          localId: "c1",
          subMindMapId: "sub-1",
          positionX: NaN,
          positionY: 100,
        },
      ],
      edges: [],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph rejects edge referencing unknown cluster local ID", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c_unknown", label: "link" },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph rejects self edge", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c1", label: "self" },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph rejects duplicate undirected edge", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c2", label: "first" },
        { sourceLocalId: "c2", targetLocalId: "c1", label: "second" },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph allows duplicate subMindMapId clusters as separate visual instances", async () => {
    const mock = createMockSupabaseClient();
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-1", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c2", label: "same sub map twice" },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.calls).toContain("in:commonplace_mindmaps:id:sub-1");
    expect(mock.inserted.commonplace_main_map_nodes).toEqual([
      {
        owner_id: "user_123",
        main_mindmap_id: "map-db-123",
        node_kind: "cluster",
        sub_mindmap_id: "sub-1",
        note_id: null,
        position_x: 10,
        position_y: 10,
      },
      {
        owner_id: "user_123",
        main_mindmap_id: "map-db-123",
        node_kind: "cluster",
        sub_mindmap_id: "sub-1",
        note_id: null,
        position_x: 20,
        position_y: 20,
      },
    ]);
    expect(mock.inserted.commonplace_main_map_edges[0]).toMatchObject({
      source_node_id: "main-node-db-uuid-1",
      target_node_id: "main-node-db-uuid-2",
      edge_type: "solid",
    });
  });

  test("saveCommonplaceMainMindMapGraph rejects invalid main edge_type", async () => {
    const mock = createMockSupabaseClient();
    const input = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c2", edgeType: "bold", label: "invalid" },
      ],
    } as unknown as SaveCommonplaceMainMapGraphInput;

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
    expect(mock.calls).toEqual([]);
  });

  test("saveCommonplaceMainMindMapGraph validates referenced sub mindmaps are owner-scoped", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-2", positionX: 20, positionY: 20 },
      ],
      edges: [],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph rejects referenced mindmap if type is main", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "main" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_validation_failed",
    });
  });

  test("saveCommonplaceMainMindMapGraph deletes old edges before old clusters", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [],
    };

    await saveCommonplaceMainMindMapGraph(input, mock.client);

    const deleteEdgesIdx = mock.calls.indexOf("delete:commonplace_main_map_edges");
    const deleteNodesIdx = mock.calls.indexOf("delete:commonplace_main_map_nodes");

    expect(deleteEdgesIdx).toBeGreaterThan(-1);
    expect(deleteNodesIdx).toBeGreaterThan(-1);
    expect(deleteEdgesIdx).toBeLessThan(deleteNodesIdx);
  });

  test("saveCommonplaceMainMindMapGraph inserts clusters and maps local IDs to DB node IDs for edges", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
        { id: "sub-2", owner_id: "user_123", type: "sub" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        { sourceLocalId: "c1", targetLocalId: "c2", label: "cluster edge link" },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.inserted.commonplace_main_map_edges[0]).toEqual({
      owner_id: "user_123",
      main_mindmap_id: "map-db-123",
      source_node_id: "main-node-db-uuid-1",
      target_node_id: "main-node-db-uuid-2",
      edge_type: "solid",
      label: "cluster edge link",
    });
  });

  test("saveCommonplaceMainMindMapGraph inserts dashed main edge type independently from label", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
        { id: "sub-2", owner_id: "user_123", type: "sub" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
        { localId: "c2", subMindMapId: "sub-2", positionX: 20, positionY: 20 },
      ],
      edges: [
        {
          sourceLocalId: "c1",
          targetLocalId: "c2",
          edgeType: "dashed",
          label: "possible theme link",
        },
      ],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result.ok).toBe(true);
    expect(mock.inserted.commonplace_main_map_edges[0]).toMatchObject({
      edge_type: "dashed",
      label: "possible theme link",
    });
  });

  test("listMainMapNodes returns cluster and note nodes without reading edge tables", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [
        {
          id: "cluster-node-1",
          node_kind: "cluster",
          sub_mindmap_id: "sub-map-1",
          position_x: 64,
          position_y: 128,
          commonplace_mindmaps: {
            title: "Institutional Incentives",
            updated_at: "2026-06-06T12:00:00Z",
          },
        },
        {
          id: "note-node-1",
          node_kind: "note",
          note_id: "note-1",
          sub_mindmap_id: null,
          position_x: 260,
          position_y: 320,
          commonplace_notes: {
            shortcode: "#wn1",
            title: "Institutions and Growth",
            source_book: "Why Nations Fail",
            tags: ["economics", "institutions"],
          },
        },
      ],
    });

    const result = await listMainMapNodes(
      "user_123",
      "main-map-db-123",
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).toEqual([
      {
        id: "cluster-node-1",
        nodeKind: "cluster",
        subMindMapId: "sub-map-1",
        subMindMapTitle: "Institutional Incentives",
        subMindMapUpdatedAt: "2026-06-06T12:00:00Z",
        positionX: 64,
        positionY: 128,
      },
      {
        id: "note-node-1",
        nodeKind: "note",
        noteId: "note-1",
        noteShortcode: "#wn1",
        noteTitle: "Institutions and Growth",
        noteSourceBook: "Why Nations Fail",
        noteTags: ["economics", "institutions"],
        positionX: 260,
        positionY: 320,
      },
    ]);
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("createMainMapClusterNode inserts clusters with note_id null and allows duplicates", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    const firstResult = await createMainMapClusterNode(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        subMindmapId: "sub-map-1",
        position: { x: 50, y: 75 },
      },
      mock.client,
    );
    const secondResult = await createMainMapClusterNode(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        subMindmapId: "sub-map-1",
        position: { x: 180, y: 210 },
      },
      mock.client,
    );

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) return;
    expect(firstResult.node).toMatchObject({
      id: "main-node-db-uuid-1",
      nodeKind: "cluster",
      subMindMapId: "sub-map-1",
      positionX: 50,
      positionY: 75,
    });
    expect(mock.inserted.commonplace_main_map_nodes).toEqual([
      {
        owner_id: "user_123",
        main_mindmap_id: "main-map-db-123",
        node_kind: "cluster",
        sub_mindmap_id: "sub-map-1",
        note_id: null,
        position_x: 50,
        position_y: 75,
      },
      {
        owner_id: "user_123",
        main_mindmap_id: "main-map-db-123",
        node_kind: "cluster",
        sub_mindmap_id: "sub-map-1",
        note_id: null,
        position_x: 180,
        position_y: 210,
      },
    ]);
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("createMainMapNoteNode inserts note nodes with sub_mindmap_id null and allows duplicates", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
    });

    const firstResult = await createMainMapNoteNode(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        noteId: "note-1",
        position: { x: 80, y: 100 },
      },
      mock.client,
    );
    const secondResult = await createMainMapNoteNode(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        noteId: "note-1",
        position: { x: 220, y: 260 },
      },
      mock.client,
    );

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) return;
    expect(firstResult.node).toMatchObject({
      id: "main-node-db-uuid-1",
      nodeKind: "note",
      noteId: "note-1",
      noteShortcode: "#wn1",
      noteTitle: "Institutions and Growth",
      noteSourceBook: "Why Nations Fail",
      positionX: 80,
      positionY: 100,
    });
    expect(mock.inserted.commonplace_main_map_nodes).toEqual([
      {
        owner_id: "user_123",
        main_mindmap_id: "main-map-db-123",
        node_kind: "note",
        sub_mindmap_id: null,
        note_id: "note-1",
        position_x: 80,
        position_y: 100,
      },
      {
        owner_id: "user_123",
        main_mindmap_id: "main-map-db-123",
        node_kind: "note",
        sub_mindmap_id: null,
        note_id: "note-1",
        position_x: 220,
        position_y: 260,
      },
    ]);
    expect(mock.calls).toContain("eq:commonplace_notes:owner_id:user_123");
    expect(mock.calls.join("\n")).not.toContain("commonplace_mindmap_nodes");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("createMainMapNoteNode rejects notes outside the owner scope", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      noteRow: null,
    });

    const result = await createMainMapNoteNode(
      "user_123",
      {
        mainMapId: "main-map-db-123",
        noteId: "foreign-note",
        position: { x: 80, y: 100 },
      },
      mock.client,
    );

    expect(result).toEqual({ ok: false, error: "commonplace_not_found" });
    expect(mock.inserted.commonplace_main_map_nodes ?? []).toHaveLength(0);
  });

  test("batchUpdateMainMapNodePositions updates owner-scoped visual rows by node id", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [{ id: "note-node-1", node_kind: "note", note_id: "note-1" }],
    });

    const result = await batchUpdateMainMapNodePositions(
      "user_123",
      "main-map-db-123",
      [{ nodeId: "note-node-1", position: { x: 240, y: 320 } }],
      mock.client,
    );

    expect(result).toEqual({ ok: true });
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:id:note-node-1");
    expect(mock.updated.commonplace_main_map_nodes[0]).toMatchObject({
      position_x: 240,
      position_y: 320,
    });
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("batchUpdateMainMapNodePositions updates one duplicate note node without touching its duplicate", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [{ id: "note-node-1", node_kind: "note", note_id: "note-1" }],
    });

    const result = await batchUpdateMainMapNodePositions(
      "user_123",
      "main-map-db-123",
      [{ nodeId: "note-node-1", position: { x: 360, y: 420 } }],
      mock.client,
    );

    expect(result).toEqual({ ok: true });
    expect(mock.updated.commonplace_main_map_nodes).toHaveLength(1);
    expect(mock.updated.commonplace_main_map_nodes[0]).toMatchObject({
      position_x: 360,
      position_y: 420,
    });
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:id:note-node-1");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:id:note-node-2");
  });

  test("deleteMainMapNode deletes only the visual node in the selected Main Map", async () => {
    const mock = createMockSupabaseClient({
      mindMapRow: {
        id: "main-map-db-123",
        owner_id: "user_123",
        title: "Main Mind Map",
        type: "main",
        parent_mindmap_id: null,
        created_at: "2026-06-06T00:00:00Z",
        updated_at: "2026-06-06T00:00:00Z",
      },
      mainNodesRows: [{ id: "note-node-1", node_kind: "note", note_id: "note-1" }],
    });

    const result = await deleteMainMapNode(
      "user_123",
      "main-map-db-123",
      "note-node-1",
      mock.client,
    );

    expect(result).toEqual({ ok: true });
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:main_mindmap_id:main-map-db-123");
    expect(mock.calls).not.toContain("eq:commonplace_main_map_nodes:node_kind:cluster");
    expect(mock.calls).toContain("delete:commonplace_main_map_nodes");
    expect(mock.calls).not.toContain("delete:commonplace_mindmaps");
    expect(mock.calls).not.toContain("delete:commonplace_notes");
    expect(mock.calls.join("\n")).not.toContain("commonplace_main_map_edges");
  });

  test("deleteCommonplaceMainMapCluster deletes only main map node, not sub mind map", async () => {
    const mock = createMockSupabaseClient();

    const result = await deleteCommonplaceMainMapCluster("user_123", "cluster-node-123", mock.client);

    expect(result).toEqual({ ok: true });
    expect(mock.calls).toContain("from:commonplace_main_map_nodes");
    expect(mock.calls).toContain("delete:commonplace_main_map_nodes");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:id:cluster-node-123");
    expect(mock.calls).not.toContain("delete:commonplace_mindmaps");
  });

  test("saveCommonplaceMainMindMapGraph returns safe commonplace_save_failed on database error", async () => {
    const mock = createMockSupabaseClient({
      mainNodeInsertError: new Error("DB unique constraint violation"),
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
      ],
    });
    const input: SaveCommonplaceMainMapGraphInput = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [],
    };

    const result = await saveCommonplaceMainMindMapGraph(input, mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_save_failed",
    });
  });

  test("getCommonplaceMainMindMapGraph returns safe commonplace_not_found on missing main map", async () => {
    const mock = createMockSupabaseClient({ mindMapRow: null, mindMapInsertError: new Error("Cannot insert") });

    const result = await getCommonplaceMainMindMapGraph("user_123", mock.client);

    expect(result).toEqual({
      ok: false,
      error: "commonplace_save_failed",
    });
  });

  test("main map save graph prevents storing forbidden fields", async () => {
    const mock = createMockSupabaseClient({
      subMindMapsRows: [
        { id: "sub-1", owner_id: "user_123", type: "sub" },
      ],
    });
    const payload = {
      ownerId: "user_123",
      clusters: [
        { localId: "c1", subMindMapId: "sub-1", positionX: 10, positionY: 10 },
      ],
      edges: [],
      api_key: "secret",
      raw_provider_payload: {},
      audio: "audio",
      audio_blob: "blob",
      recording_url: "url",
      stt_payload: {},
      tts_payload: {},
      auth_metadata: {},
    } as unknown as SaveCommonplaceMainMapGraphInput;

    await saveCommonplaceMainMindMapGraph(payload, mock.client);

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
});
