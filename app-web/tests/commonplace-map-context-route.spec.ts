import { expect, test } from "@playwright/test";
import { GET, testHooks } from "../src/app/api/commonplace/maps/context/route";

const baseMapRow = {
  id: "sub-map-123",
  title: "Sub Mind Map Title",
  type: "sub",
};

const baseMainMapRow = {
  id: "main-map-456",
  title: "Main Map Title",
  type: "main",
};

const baseNodeRow = {
  id: "node-1",
  note_id: "note-abc",
  position_x: 100,
  position_y: 200,
  commonplace_notes: {
    shortcode: "#note1",
    title: "Note Title",
    source_book: "Note Book",
    insight: "This is a great insight excerpt to talk about in Podchat.",
    tags: ["growth", "economics"],
  },
};

const baseEdgeRow = {
  id: "edge-1",
  source_node_id: "node-1",
  target_node_id: "node-2",
  edge_type: "solid",
  label: "connection label",
};

const baseMainClusterNodeRow = {
  id: "main-node-cluster-1",
  node_kind: "cluster",
  note_id: null,
  sub_mindmap_id: "sub-map-ref-1",
  position_x: 100,
  position_y: 200,
  commonplace_mindmaps: {
    title: "Referenced Sub Map",
  },
  commonplace_notes: null,
};

const baseMainNoteNodeRow = {
  id: "main-node-note-1",
  node_kind: "note",
  note_id: "note-abc",
  sub_mindmap_id: null,
  position_x: 300,
  position_y: 400,
  commonplace_mindmaps: null,
  commonplace_notes: {
    shortcode: "#note1",
    title: "Note Title",
    source_book: "Note Book",
    insight: "This is a note insight excerpt.",
    tags: ["growth"],
  },
};

const baseMainEdgeRow = {
  id: "main-edge-1",
  source_node_id: "main-node-cluster-1",
  target_node_id: "main-node-note-1",
  edge_type: "solid",
  label: "main edge label",
};

type MockOptions = {
  mapRow?: Record<string, unknown> | null;
  nodeRows?: Record<string, unknown>[];
  edgeRows?: Record<string, unknown>[];
  mainNodeRows?: Record<string, unknown>[];
  mainEdgeRows?: Record<string, unknown>[];
  mapError?: Error | null;
  nodeError?: Error | null;
  edgeError?: Error | null;
  mainNodeError?: Error | null;
  mainEdgeError?: Error | null;
};

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];
  const filters: string[] = [];
  const orders: string[] = [];

  function buildQuery(table: string) {
    const query = {
      select(columns: string) {
        calls.push(`select:${table}:${columns.replace(/\s+/g, " ")}`);
        return query;
      },
      eq(column: string, value: string) {
        filters.push(`${table}:${column}:${value}`);
        calls.push(`eq:${table}:${column}:${value}`);
        return query;
      },
      order(column: string, orderOptions: { ascending: boolean }) {
        orders.push(`${table}:${column}:${orderOptions.ascending}`);
        calls.push(`order:${table}:${column}:${orderOptions.ascending}`);
        if (table === "commonplace_mindmap_nodes") {
          return Promise.resolve({
            data: options.nodeRows !== undefined ? options.nodeRows : [baseNodeRow],
            error: options.nodeError ?? null,
          });
        }
        if (table === "commonplace_mindmap_edges") {
          return Promise.resolve({
            data: options.edgeRows !== undefined ? options.edgeRows : [baseEdgeRow],
            error: options.edgeError ?? null,
          });
        }
        if (table === "commonplace_main_map_nodes") {
          return Promise.resolve({
            data:
              options.mainNodeRows !== undefined
                ? options.mainNodeRows
                : [baseMainClusterNodeRow, baseMainNoteNodeRow],
            error: options.mainNodeError ?? null,
          });
        }
        if (table === "commonplace_main_map_edges") {
          return Promise.resolve({
            data:
              options.mainEdgeRows !== undefined
                ? options.mainEdgeRows
                : [baseMainEdgeRow],
            error: options.mainEdgeError ?? null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      },
      maybeSingle() {
        calls.push(`maybeSingle:${table}`);
        if (table === "commonplace_mindmaps") {
          return Promise.resolve({
            data: options.mapRow !== undefined ? options.mapRow : baseMapRow,
            error: options.mapError ?? null,
          });
        }
        return Promise.resolve({ data: null, error: null });
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

  return { client, calls, filters, orders };
}

function buildRequest(mapId?: string, mapType?: string): Request {
  const url = new URL("http://localhost/api/commonplace/maps/context");
  if (mapId) url.searchParams.set("mapId", mapId);
  if (mapType) url.searchParams.set("mapType", mapType);
  return new Request(url.toString(), {
    method: "GET",
    headers: { "content-type": "application/json" },
  });
}

test.describe("Commonplace map context route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated requests return auth_required", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    testHooks.getSupabaseClient = () => {
      throw new Error("should not create client");
    };

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "auth_required" });
  });

  test("rejects missing mapId", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const response = await GET(buildRequest(undefined, "sub"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_map_context_fields",
    });
  });

  test("rejects unsupported mapType", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const response = await GET(buildRequest("sub-map-123", "unknown"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_map_context_fields",
    });
  });

  test("accepts mapType main without error", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({ mapRow: baseMainMapRow });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.mapType).toBe("main");
    expect(data.context.source).toBe("commonplace-map");
  });

  test("rejects unowned map (sub)", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({ mapRow: null });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "map_not_found" });

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:sub-map-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:sub");
  });

  test("rejects unowned map (main)", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({ mapRow: null });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "map_not_found" });

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:id:main-map-456");
    expect(mock.calls).toContain("eq:commonplace_mindmaps:type:main");
  });

  test("returns only owner-scoped sub map data", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const node2 = {
      id: "node-2",
      note_id: "note-xyz",
      position_x: 300,
      position_y: 400,
      commonplace_notes: {
        shortcode: "#note2",
        title: "Note 2 Title",
        source_book: "Note Book 2",
        insight: "Another insight",
        tags: ["tag2"],
      },
    };
    const mock = createMockSupabaseClient({
      nodeRows: [baseNodeRow, node2],
      edgeRows: [baseEdgeRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context).toEqual({
      source: "commonplace-map",
      mapType: "sub",
      mapId: "sub-map-123",
      mapTitle: "Sub Mind Map Title",
      counts: {
        nodes: 2,
        edges: 1,
        truncatedNodes: false,
        truncatedEdges: false,
      },
      nodes: [
        {
          visualNodeId: "node-1",
          noteId: "note-abc",
          shortcode: "#note1",
          title: "Note Title",
          sourceBook: "Note Book",
          insightExcerpt: "This is a great insight excerpt to talk about in Podchat.",
          tags: ["growth", "economics"],
        },
        {
          visualNodeId: "node-2",
          noteId: "note-xyz",
          shortcode: "#note2",
          title: "Note 2 Title",
          sourceBook: "Note Book 2",
          insightExcerpt: "Another insight",
          tags: ["tag2"],
        },
      ],
      edges: [
        {
          sourceVisualNodeId: "node-1",
          targetVisualNodeId: "node-2",
          edgeType: "solid",
          label: "connection label",
        },
      ],
    });

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_nodes:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_mindmap_edges:owner_id:user-123");
  });

  test("returns owner-scoped main map context with cluster and note nodes", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows: [baseMainClusterNodeRow, baseMainNoteNodeRow],
      mainEdgeRows: [baseMainEdgeRow],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.mapType).toBe("main");
    expect(data.context.mapId).toBe("main-map-456");
    expect(data.context.mapTitle).toBe("Main Map Title");
    expect(data.context.counts.nodes).toBe(2);
    expect(data.context.counts.edges).toBe(1);
    expect(data.context.counts.clusterNodes).toBe(1);
    expect(data.context.counts.noteNodes).toBe(1);
    expect(data.context.counts.truncatedNodes).toBe(false);
    expect(data.context.counts.truncatedEdges).toBe(false);

    const clusterNode = data.context.nodes.find(
      (n: { nodeKind: string }) => n.nodeKind === "cluster",
    );
    expect(clusterNode).toMatchObject({
      visualNodeId: "main-node-cluster-1",
      nodeKind: "cluster",
      referencedSubMindMapId: "sub-map-ref-1",
      referencedSubMindMapTitle: "Referenced Sub Map",
    });
    expect(clusterNode).not.toHaveProperty("noteId");
    expect(clusterNode).not.toHaveProperty("insight");
    expect(clusterNode).not.toHaveProperty("insightExcerpt");

    const noteNode = data.context.nodes.find(
      (n: { nodeKind: string }) => n.nodeKind === "note",
    );
    expect(noteNode).toMatchObject({
      visualNodeId: "main-node-note-1",
      nodeKind: "note",
      noteId: "note-abc",
      shortcode: "#note1",
      title: "Note Title",
      sourceBook: "Note Book",
      insightExcerpt: "This is a note insight excerpt.",
      tags: ["growth"],
    });
    expect(noteNode).not.toHaveProperty("referencedSubMindMapId");
    expect(noteNode).not.toHaveProperty("referencedSubMindMapTitle");

    expect(data.context.edges[0]).toMatchObject({
      sourceVisualNodeId: "main-node-cluster-1",
      targetVisualNodeId: "main-node-note-1",
      edgeType: "solid",
      label: "main edge label",
    });

    expect(mock.calls).toContain("eq:commonplace_mindmaps:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_nodes:owner_id:user-123");
    expect(mock.calls).toContain("eq:commonplace_main_map_edges:owner_id:user-123");
  });

  test("cluster node with no sub_mindmap_id is excluded from main map context", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const orphanCluster = {
      ...baseMainClusterNodeRow,
      id: "orphan-cluster",
      sub_mindmap_id: null, // no referenced sub map — should be excluded
    };
    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows: [orphanCluster, baseMainNoteNodeRow],
      mainEdgeRows: [],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(1);
    expect(data.context.nodes[0].nodeKind).toBe("note");
  });

  test("note node with no commonplace_notes relation is excluded from main map context", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const orphanNote = {
      ...baseMainNoteNodeRow,
      id: "orphan-note",
      commonplace_notes: null,
    };
    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows: [baseMainClusterNodeRow, orphanNote],
      mainEdgeRows: [],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(1);
    expect(data.context.nodes[0].nodeKind).toBe("cluster");
  });

  test("main map edges cross-referenced against included node IDs", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const edgeWithMissingTarget = {
      id: "edge-orphan",
      source_node_id: "main-node-cluster-1",
      target_node_id: "non-existent-node",
      edge_type: "solid",
      label: null,
    };
    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows: [baseMainClusterNodeRow, baseMainNoteNodeRow],
      mainEdgeRows: [baseMainEdgeRow, edgeWithMissingTarget],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.edges).toHaveLength(1);
    expect(data.context.edges[0].sourceVisualNodeId).toBe("main-node-cluster-1");
    expect(data.context.edges[0].targetVisualNodeId).toBe("main-node-note-1");
  });

  test("does not recursively expand cluster sub map contents", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows: [baseMainClusterNodeRow],
      mainEdgeRows: [],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    const clusterNode = data.context.nodes[0];
    // Cluster node should have only identity info, no sub-node expansion
    expect(clusterNode).not.toHaveProperty("nodes");
    expect(clusterNode).not.toHaveProperty("subnodes");
    expect(clusterNode).not.toHaveProperty("children");
    expect(clusterNode.nodeKind).toBe("cluster");
    expect(clusterNode.referencedSubMindMapId).toBe("sub-map-ref-1");
  });

  test("bounds and truncates main map nodes (max 30) and edges (max 50)", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    const mainNodeRows = Array.from({ length: 35 }, (_, i) => ({
      id: `main-node-${i}`,
      node_kind: "note",
      note_id: `note-${i}`,
      sub_mindmap_id: null,
      position_x: 0,
      position_y: 0,
      commonplace_mindmaps: null,
      commonplace_notes: {
        shortcode: `#n${i}`,
        title: `Node ${i}`,
        source_book: "Book",
        insight: "Excerpt",
        tags: [],
      },
    }));

    const mainEdgeRows = [
      {
        id: "edge-valid",
        source_node_id: "main-node-0",
        target_node_id: "main-node-1",
        edge_type: "solid",
        label: "valid",
      },
      {
        id: "edge-invalid",
        source_node_id: "main-node-0",
        target_node_id: "main-node-31", // sliced out (index >= 30)
        edge_type: "solid",
        label: "invalid",
      },
    ];

    const mock = createMockSupabaseClient({
      mapRow: baseMainMapRow,
      mainNodeRows,
      mainEdgeRows,
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(30);
    expect(data.context.counts.truncatedNodes).toBe(true);
    expect(data.context.edges).toHaveLength(1);
  });

  test("excludes sensitive database columns from main map context output", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({ mapRow: baseMainMapRow });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    const data = await response.json();

    const keys = Object.keys(data.context);
    expect(keys).not.toContain("ownerId");
    expect(keys).not.toContain("owner_id");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("auth");
    expect(keys).not.toContain("settings");

    const nodeKeys = Object.keys(data.context.nodes[0]);
    expect(nodeKeys).not.toContain("owner_id");
    expect(nodeKeys).not.toContain("ownerId");
  });

  test("returns safe error status code on main map database errors", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      mapError: new Error("internal postgres crash"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("main-map-456", "main"));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "map_context_fetch_failed" });
    expect(JSON.stringify(data)).not.toContain("postgres");
  });

  test("preserves duplicate visual nodes by visualNodeId", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const duplicateNodeRow = {
      id: "node-duplicate",
      note_id: "note-abc", // same note ID
      position_x: 150,
      position_y: 250,
      commonplace_notes: baseNodeRow.commonplace_notes,
    };
    const mock = createMockSupabaseClient({
      nodeRows: [baseNodeRow, duplicateNodeRow],
      edgeRows: [],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(2);
    expect(data.context.nodes[0].visualNodeId).toBe("node-1");
    expect(data.context.nodes[1].visualNodeId).toBe("node-duplicate");
    expect(data.context.nodes[0].noteId).toBe("note-abc");
    expect(data.context.nodes[1].noteId).toBe("note-abc");
  });

  test("includes only nodes referenced by visual nodes and ignores missing notes relations", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const nodeWithNoRelation = {
      id: "node-orphan",
      note_id: "note-missing",
      position_x: 0,
      position_y: 0,
      commonplace_notes: null, // joined relation is null
    };
    const mock = createMockSupabaseClient({
      nodeRows: [baseNodeRow, nodeWithNoRelation],
      edgeRows: [],
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(1);
    expect(data.context.nodes[0].visualNodeId).toBe("node-1");
  });

  test("bounds and truncates nodes, edges, insight excerpts, tags, labels", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";

    // Create a node with very long excerpt and tags
    const longExcerptNode = {
      id: "node-1",
      note_id: "note-abc",
      position_x: 100,
      position_y: 200,
      commonplace_notes: {
        shortcode: "#note1",
        title: "A".repeat(200), // title limit is 160
        source_book: "B".repeat(200), // sourceBook limit is 160
        insight: "C".repeat(400), // insightExcerpt limit is 320
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9"], // max tags is 8
      },
    };

    const edgeWithLongLabel = {
      id: "edge-1",
      source_node_id: "node-1",
      target_node_id: "node-2",
      edge_type: "dashed",
      label: "D".repeat(200), // label limit is 120
    };

    // Also test node count truncation (max 24)
    const nodeRows = Array.from({ length: 30 }, (_, i) => ({
      id: `node-${i}`,
      note_id: `note-${i}`,
      position_x: 0,
      position_y: 0,
      commonplace_notes: {
        shortcode: `#n${i}`,
        title: `Node ${i}`,
        source_book: "Book",
        insight: "Excerpt",
        tags: [],
      },
    }));

    // edge list having edges with nodes not in the first 24 nodes
    const edgeRows = [
      {
        id: "edge-valid",
        source_node_id: "node-0",
        target_node_id: "node-1",
        edge_type: "solid",
        label: "valid edge",
      },
      {
        id: "edge-invalid",
        source_node_id: "node-0",
        target_node_id: "node-25", // node-25 will be sliced out (nodes index >= 24)
        edge_type: "solid",
        label: "invalid edge",
      },
    ];

    const mock = createMockSupabaseClient({
      nodeRows,
      edgeRows,
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.context.nodes).toHaveLength(24);
    expect(data.context.counts.truncatedNodes).toBe(true);

    // Verify only edges connecting valid (non-sliced) nodes are kept
    expect(data.context.edges).toHaveLength(1);
    expect(data.context.edges[0].sourceVisualNodeId).toBe("node-0");
    expect(data.context.edges[0].targetVisualNodeId).toBe("node-1");

    // Let's test individual string truncation limits
    const longExcerptNode2 = {
      id: "node-2",
      note_id: "note-xyz",
      position_x: 300,
      position_y: 400,
      commonplace_notes: {
        shortcode: "#note2",
        title: "Note 2",
        source_book: "Book 2",
        insight: "Insight 2",
        tags: [],
      },
    };
    const mockSingle = createMockSupabaseClient({
      nodeRows: [longExcerptNode, longExcerptNode2],
      edgeRows: [edgeWithLongLabel],
    });
    testHooks.getSupabaseClient = () => mockSingle.client;

    const singleResponse = await GET(buildRequest("sub-map-123", "sub"));
    const singleData = await singleResponse.json();

    const node = singleData.context.nodes[0];
    expect(node.title).toHaveLength(160);
    expect(node.sourceBook).toHaveLength(160);
    expect(node.insightExcerpt).toHaveLength(320);
    expect(node.tags).toHaveLength(8);

    const edge = singleData.context.edges[0];
    expect(edge.label).toHaveLength(120);
  });

  test("excludes sensitive database columns from context output", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient();
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    const data = await response.json();

    // Verify response structure
    const keys = Object.keys(data.context);
    expect(keys).not.toContain("ownerId");
    expect(keys).not.toContain("owner_id");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("auth");
    expect(keys).not.toContain("settings");

    const nodeKeys = Object.keys(data.context.nodes[0]);
    expect(nodeKeys).not.toContain("owner_id");
    expect(nodeKeys).not.toContain("ownerId");
  });

  test("returns safe error status code on database errors", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const mock = createMockSupabaseClient({
      mapError: new Error("internal postgres crash"),
    });
    testHooks.getSupabaseClient = () => mock.client;

    const response = await GET(buildRequest("sub-map-123", "sub"));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "map_context_fetch_failed" });
    expect(JSON.stringify(data)).not.toContain("postgres");
  });
});
