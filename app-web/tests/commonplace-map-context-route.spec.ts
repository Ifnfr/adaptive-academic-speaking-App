import { expect, test } from "@playwright/test";
import { GET, testHooks } from "../src/app/api/commonplace/maps/context/route";

const baseMapRow = {
  id: "sub-map-123",
  title: "Sub Mind Map Title",
  type: "sub",
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

type MockOptions = {
  mapRow?: Record<string, unknown> | null;
  nodeRows?: Record<string, unknown>[];
  edgeRows?: Record<string, unknown>[];
  mapError?: Error | null;
  nodeError?: Error | null;
  edgeError?: Error | null;
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

    const response = await GET(buildRequest("sub-map-123", "main"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_map_context_fields",
    });
  });

  test("rejects unowned map", async () => {
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
