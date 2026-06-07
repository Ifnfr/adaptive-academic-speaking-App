import { expect, test } from "@playwright/test";

type TestNote = {
  id: string;
  ownerId: string;
  clientId: string | null;
  shortcode: string;
  sourceBook: string;
  sourcePage: string | null;
  title: string | null;
  quote: string | null;
  insight: string;
  tags: string[];
  connections: string[];
  relevance: string | null;
  createdAt: string;
  updatedAt: string;
};

const renderedSecretLikePattern =
  /DEEPSEEK_API_KEY|DEEPGRAM_API_KEY|ELEVENLABS_API_KEY|CLAUDE_API_KEY|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|raw provider payload|audio_blob|recording_url|stt_payload|tts_payload/i;

const forbiddenCommonplaceContextFieldPattern =
  /\b(ownerId|clientId|auth_metadata)\b/i;

type TestMindMapSummary = {
  id: string;
  ownerId: string;
  title: string;
  type: "main" | "sub";
  parentMindMapId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TestMindMapNodeRow = {
  id: string;
  mindMapId: string;
  ownerId: string;
  noteId: string;
  positionX: number;
  positionY: number;
};

type TestMindMapEdgeRow = {
  id: string;
  mindMapId: string;
  ownerId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
};

type TestMainMapClusterRow = {
  id: string;
  subMindMapId: string;
  subMindMapTitle: string;
  positionX: number;
  positionY: number;
  updatedAt: string;
};

type TestMainMapEdgeRow = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
};

type TestMainMapSaveCall = {
  ownerId: string;
  clusters: Array<{
    localId: string;
    subMindMapId: string;
    positionX: number;
    positionY: number;
  }>;
  edges: Array<{
    sourceLocalId: string;
    targetLocalId: string;
    label?: string | null;
  }>;
};

function installCommonplaceTestAdapter() {
  const testWindow = window as typeof window & {
    __COMMONPLACE_TEST_NOTES__?: TestNote[];
    __COMMONPLACE_TEST_COUNTERS__?: Record<string, number>;
    __COMMONPLACE_TEST_MINDMAPS__?: TestMindMapSummary[];
    __COMMONPLACE_TEST_MINDMAP_NODES__?: TestMindMapNodeRow[];
    __COMMONPLACE_TEST_MINDMAP_EDGES__?: TestMindMapEdgeRow[];
    __COMMONPLACE_TEST_MAIN_NODES__?: TestMainMapClusterRow[];
    __COMMONPLACE_TEST_MAIN_EDGES__?: TestMainMapEdgeRow[];
    __COMMONPLACE_TEST_MAIN_SAVE_CALLS__?: TestMainMapSaveCall[];
    __COMMONPLACE_TEST_FAIL_SAVE__?: boolean;
    __COMMONPLACE_TEST_FAIL_LOAD__?: boolean;
    __COMMONPLACE_TEST_ADAPTER__?: unknown;
  };

  testWindow.__COMMONPLACE_TEST_NOTES__ = testWindow.__COMMONPLACE_TEST_NOTES__ || [];
  testWindow.__COMMONPLACE_TEST_COUNTERS__ = testWindow.__COMMONPLACE_TEST_COUNTERS__ || {};
  testWindow.__COMMONPLACE_TEST_MINDMAPS__ = testWindow.__COMMONPLACE_TEST_MINDMAPS__ || [];
  testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ = testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ || [];
  testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ = testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ || [];
  testWindow.__COMMONPLACE_TEST_MAIN_NODES__ = testWindow.__COMMONPLACE_TEST_MAIN_NODES__ || [];
  testWindow.__COMMONPLACE_TEST_MAIN_EDGES__ = testWindow.__COMMONPLACE_TEST_MAIN_EDGES__ || [];
  testWindow.__COMMONPLACE_TEST_MAIN_SAVE_CALLS__ = testWindow.__COMMONPLACE_TEST_MAIN_SAVE_CALLS__ || [];

  testWindow.__COMMONPLACE_TEST_ADAPTER__ = {
    async listCommonplaceNotes(ownerId: string) {
      return {
        ok: true as const,
        notes: (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).filter(
          (note) => note.ownerId === ownerId,
        ),
      };
    },
    async createCommonplaceNote(input: {
      ownerId: string;
      sourceBook?: string | null;
      sourcePage?: string | null;
      title?: string | null;
      quote?: string | null;
      insight: string;
      tags?: string[] | null;
      connections?: string[] | null;
      relevance?: string | null;
    }) {
      if (!input.ownerId || !input.insight?.trim()) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const sourceBook = input.sourceBook?.trim() || "Untitled Source";
      const prefix = sourceBook
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("") || "us";
      const counters = testWindow.__COMMONPLACE_TEST_COUNTERS__ ?? {};
      const nextValue = (counters[prefix] ?? 0) + 1;
      counters[prefix] = nextValue;
      testWindow.__COMMONPLACE_TEST_COUNTERS__ = counters;

      const now = new Date("2026-06-06T05:00:00.000Z").toISOString();
      const note: TestNote = {
        id: `note-${Date.now()}-${nextValue}`,
        ownerId: input.ownerId,
        clientId: null,
        shortcode: `#${prefix}${nextValue}`,
        sourceBook,
        sourcePage: input.sourcePage?.trim() || null,
        title: input.title?.trim() || null,
        quote: input.quote?.trim() || null,
        insight: input.insight.trim(),
        tags: (input.tags ?? [])
          .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
          .filter(Boolean),
        connections: (input.connections ?? [])
          .map((connection) => connection.trim())
          .filter((connection) => connection.startsWith("#")),
        relevance: input.relevance?.trim() || null,
        createdAt: now,
        updatedAt: now,
      };

      testWindow.__COMMONPLACE_TEST_NOTES__ = [
        note,
        ...(testWindow.__COMMONPLACE_TEST_NOTES__ ?? []),
      ];
      return { ok: true as const, note };
    },
    async getCommonplaceNoteById(ownerId: string, noteId: string) {
      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.id === noteId,
      );
      return note
        ? { ok: true as const, note }
        : { ok: false as const, error: "commonplace_not_found" as const };
    },
    async updateCommonplaceNote(input: {
      ownerId: string;
      noteId: string;
      sourceBook?: string | null;
      sourcePage?: string | null;
      title?: string | null;
      quote?: string | null;
      insight?: string;
      tags?: string[] | null;
      connections?: string[] | null;
      relevance?: string | null;
    }) {
      const notes = testWindow.__COMMONPLACE_TEST_NOTES__ ?? [];
      const noteIndex = notes.findIndex(
        (note) => note.ownerId === input.ownerId && note.id === input.noteId,
      );
      if (noteIndex < 0 || !input.insight?.trim()) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const previous = notes[noteIndex];
      const updated: TestNote = {
        ...previous,
        sourceBook: input.sourceBook?.trim() || "Untitled Source",
        sourcePage: input.sourcePage?.trim() || null,
        title: input.title?.trim() || null,
        quote: input.quote?.trim() || null,
        insight: input.insight.trim(),
        tags: (input.tags ?? [])
          .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
          .filter(Boolean),
        connections: (input.connections ?? [])
          .map((connection) => connection.trim())
          .filter((connection) => connection.startsWith("#")),
        relevance: input.relevance?.trim() || null,
        updatedAt: new Date("2026-06-06T06:00:00.000Z").toISOString(),
      };
      notes[noteIndex] = updated;
      testWindow.__COMMONPLACE_TEST_NOTES__ = notes;
      return { ok: true as const, note: updated };
    },
    async deleteCommonplaceNote(ownerId: string, noteId: string) {
      testWindow.__COMMONPLACE_TEST_NOTES__ = (
        testWindow.__COMMONPLACE_TEST_NOTES__ ?? []
      ).filter((note) => note.ownerId !== ownerId || note.id !== noteId);
      return { ok: true as const };
    },
    async getCommonplaceNoteByShortcode(ownerId: string, shortcode: string) {
      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.shortcode === shortcode,
      );
      return note
        ? { ok: true as const, note }
        : { ok: false as const, error: "commonplace_not_found" as const };
    },
    async createCommonplaceSubMindMap(input: { ownerId: string; title: string; parentMindMapId?: string | null }) {
      const now = new Date("2026-06-06T05:00:00.000Z").toISOString();
      const mindMap = {
        id: `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ownerId: input.ownerId,
        title: input.title,
        type: "sub" as const,
        parentMindMapId: input.parentMindMapId || null,
        createdAt: now,
        updatedAt: now,
      };
      testWindow.__COMMONPLACE_TEST_MINDMAPS__ = [
        mindMap,
        ...(testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? []),
      ];
      return { ok: true as const, mindMap };
    },
    async listCommonplaceSubMindMaps(ownerId: string) {
      return {
        ok: true as const,
        mindMaps: (testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? []).filter(
          (m) => m.ownerId === ownerId && m.type === "sub",
        ),
      };
    },
    async getCommonplaceMindMapGraph(ownerId: string, mindMapId: string) {
      if (testWindow.__COMMONPLACE_TEST_FAIL_LOAD__) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      const summary = (testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? []).find(
        (m) => m.ownerId === ownerId && m.id === mindMapId,
      );
      if (!summary) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      const nodeRows = (testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ ?? []).filter(
        (n) => n.ownerId === ownerId && n.mindMapId === mindMapId,
      );

      const nodes = nodeRows.map((row) => {
        const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
          (candidate) => candidate.ownerId === ownerId && candidate.id === row.noteId,
        );

        return {
          id: row.id,
          noteId: row.noteId,
          positionX: row.positionX,
          positionY: row.positionY,
          noteShortcode: note?.shortcode || "",
          noteTitle: note
            ? note.title?.trim() || note.sourceBook || "Untitled Source"
            : "Untitled Source",
          noteInsight: note?.insight || "",
          noteTags: note?.tags || [],
        };
      });

      const edgeRows = (testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ ?? []).filter(
        (e) => e.ownerId === ownerId && e.mindMapId === mindMapId,
      );

      const edges = edgeRows.map((row) => ({
        id: row.id,
        sourceNodeId: row.sourceNodeId,
        targetNodeId: row.targetNodeId,
        label: row.label,
      }));

      return {
        ok: true as const,
        graph: {
          summary,
          nodes,
          edges,
        },
      };
    },
    async saveCommonplaceMindMapGraph(input: {
      ownerId: string;
      mindMapId: string;
      title?: string | null;
      nodes: Array<{ localId: string; noteId: string; positionX: number; positionY: number }>;
      edges: Array<{ sourceLocalId: string; targetLocalId: string; label?: string | null }>;
    }) {
      if (testWindow.__COMMONPLACE_TEST_FAIL_SAVE__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }
      const { ownerId, mindMapId } = input;
      const maps = testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? [];
      const mapIndex = maps.findIndex((m) => m.ownerId === ownerId && m.id === mindMapId);
      if (mapIndex < 0) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      // Check for a special mock error to test Save Failure
      if (input.title === "TRIGGER_SAVE_FAILURE") {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }

      const notes = testWindow.__COMMONPLACE_TEST_NOTES__ ?? [];
      for (const n of input.nodes) {
        const noteExists = notes.some((candidate) => candidate.ownerId === ownerId && candidate.id === n.noteId);
        if (!noteExists) {
          return { ok: false as const, error: "commonplace_validation_failed" as const };
        }
      }

      testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ = (testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ ?? []).filter(
        (e) => e.ownerId !== ownerId || e.mindMapId !== mindMapId,
      );
      testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ = (testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ ?? []).filter(
        (n) => n.ownerId !== ownerId || n.mindMapId !== mindMapId,
      );

      const localIdToDbIdMap = new Map<string, string>();
      const insertedNodes = [];

      for (const n of input.nodes) {
        const nodeId = `node-row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localIdToDbIdMap.set(n.localId, nodeId);
        insertedNodes.push({
          id: nodeId,
          mindMapId,
          ownerId,
          noteId: n.noteId,
          positionX: n.positionX,
          positionY: n.positionY,
        });
      }
      testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__.push(...insertedNodes);

      const insertedEdges = [];
      for (const e of input.edges) {
        const sourceDbId = localIdToDbIdMap.get(e.sourceLocalId);
        const targetDbId = localIdToDbIdMap.get(e.targetLocalId);
        if (!sourceDbId || !targetDbId) {
          return { ok: false as const, error: "commonplace_validation_failed" as const };
        }

        insertedEdges.push({
          id: `edge-row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          mindMapId,
          ownerId,
          sourceNodeId: sourceDbId,
          targetNodeId: targetDbId,
          label: e.label || null,
        });
      }
      testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__.push(...insertedEdges);

      const now = new Date("2026-06-06T06:00:00.000Z").toISOString();
      const existing = maps[mapIndex];
      maps[mapIndex] = {
        ...existing,
        title: input.title || existing.title,
        updatedAt: now,
      };
      testWindow.__COMMONPLACE_TEST_MINDMAPS__ = maps;

      return { ok: true as const };
    },
    async deleteCommonplaceMindMap(ownerId: string, mindMapId: string) {
      testWindow.__COMMONPLACE_TEST_MINDMAPS__ = (testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? []).filter(
        (m) => m.ownerId !== ownerId || m.id !== mindMapId,
      );
      testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ = (testWindow.__COMMONPLACE_TEST_MINDMAP_NODES__ ?? []).filter(
        (n) => n.ownerId !== ownerId || n.mindMapId !== mindMapId,
      );
      testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ = (testWindow.__COMMONPLACE_TEST_MINDMAP_EDGES__ ?? []).filter(
        (e) => e.ownerId !== ownerId || e.mindMapId !== mindMapId,
      );
      return { ok: true as const };
    },
    async createOrGetCommonplaceMainMindMap(ownerId: string) {
      return {
        ok: true as const,
        mindMap: {
          id: "main-map-db-123",
          ownerId,
          title: "Main Mind Map",
          type: "main" as const,
          parentMindMapId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    },
    async getCommonplaceMainMindMapGraph(ownerId: string) {
      if (testWindow.__COMMONPLACE_TEST_FAIL_LOAD__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }
      const summary = {
        id: "main-map-db-123",
        ownerId,
        title: "Main Mind Map",
        type: "main" as const,
        parentMindMapId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nodes = (testWindow.__COMMONPLACE_TEST_MAIN_NODES__ ?? []).map((row) => ({
        id: row.id,
        subMindMapId: row.subMindMapId,
        subMindMapTitle: row.subMindMapTitle,
        positionX: row.positionX,
        positionY: row.positionY,
        updatedAt: row.updatedAt,
      }));

      const edges = (testWindow.__COMMONPLACE_TEST_MAIN_EDGES__ ?? []).map((row) => ({
        id: row.id,
        sourceNodeId: row.sourceNodeId,
        targetNodeId: row.targetNodeId,
        label: row.label,
      }));

      return {
        ok: true as const,
        graph: {
          summary,
          clusters: nodes,
          edges,
        },
      };
    },
    async saveCommonplaceMainMindMapGraph(input: TestMainMapSaveCall & { title?: string | null }) {
      if (testWindow.__COMMONPLACE_TEST_FAIL_SAVE__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }

      testWindow.__COMMONPLACE_TEST_MAIN_SAVE_CALLS__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAIN_SAVE_CALLS__ ?? []),
        {
          ownerId: input.ownerId,
          clusters: input.clusters.map((cluster) => ({ ...cluster })),
          edges: input.edges.map((edge) => ({ ...edge })),
        },
      ];

      const subMaps = testWindow.__COMMONPLACE_TEST_MINDMAPS__ ?? [];
      for (const cluster of input.clusters) {
        const subMap = subMaps.find(
          (map) =>
            map.ownerId === input.ownerId &&
            map.id === cluster.subMindMapId &&
            map.type === "sub",
        );
        if (!subMap) {
          return { ok: false as const, error: "commonplace_validation_failed" as const };
        }
      }

      const localIdToDbId = new Map<string, string>();
      testWindow.__COMMONPLACE_TEST_MAIN_NODES__ = input.clusters.map((cluster) => {
        const subMap = subMaps.find((map) => map.id === cluster.subMindMapId);
        const nodeId = `main-node-${cluster.subMindMapId}`;
        localIdToDbId.set(cluster.localId, nodeId);
        return {
          id: nodeId,
          subMindMapId: cluster.subMindMapId,
          subMindMapTitle: subMap?.title ?? "Untitled Mind Map",
          positionX: cluster.positionX,
          positionY: cluster.positionY,
          updatedAt: subMap?.updatedAt ?? new Date("2026-06-06T06:00:00.000Z").toISOString(),
        };
      });

      testWindow.__COMMONPLACE_TEST_MAIN_EDGES__ = [];
      for (const edge of input.edges) {
        const sourceNodeId = localIdToDbId.get(edge.sourceLocalId);
        const targetNodeId = localIdToDbId.get(edge.targetLocalId);
        if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
          return { ok: false as const, error: "commonplace_validation_failed" as const };
        }

        testWindow.__COMMONPLACE_TEST_MAIN_EDGES__.push({
          id: `main-edge-${sourceNodeId}-${targetNodeId}`,
          sourceNodeId,
          targetNodeId,
          label: edge.label?.trim() || null,
        });
      }

      const summary = {
        id: "main-map-db-123",
        ownerId: input.ownerId,
        title: input.title || "Main Mind Map",
        type: "main" as const,
        parentMindMapId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        ok: true as const,
        graph: {
          summary,
          clusters: testWindow.__COMMONPLACE_TEST_MAIN_NODES__,
          edges: testWindow.__COMMONPLACE_TEST_MAIN_EDGES__,
        },
      };
    },
    async deleteCommonplaceMainMapCluster(ownerId: string, mainMapNodeId: string) {
      console.log("Mock delete cluster:", ownerId, mainMapNodeId);
      return { ok: true as const };
    },
  };
}

test.describe("Commonplace Library UI shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installCommonplaceTestAdapter);

    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === "/" &&
        !url.searchParams.has("mockAuth") &&
        route.request().resourceType() === "document"
      ) {
        url.searchParams.set("mockAuth", "true");
        await route.fulfill({
          status: 302,
          headers: { location: url.toString() },
        });
        return;
      }

      await route.continue();
    });
  });

  test("creates, edits, and deletes a Commonplace note safely", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("aside")).toContainText("Commonplace");
    await expect(page.locator("aside")).not.toContainText("Learning Path");

    await page.getByRole("button", { name: "Commonplace" }).click();

    await expect(page.getByTestId("commonplace-view")).toBeVisible();
    await expect(
      page
        .getByTestId("commonplace-view")
        .getByRole("heading", { name: "Commonplace" }),
    ).toBeVisible();
    await expect(page.getByText("Tambah note")).toBeVisible();
    await expect(
      page.getByText("Start by saving one idea from a book."),
    ).toBeVisible();

    await page.getByRole("button", { name: /Tambah note/i }).click();
    await expect(
      page.getByRole("heading", { name: "Create note" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Insight is required.")).toBeVisible();

    await page
      .getByLabel("Insight")
      .fill("Institutions shape incentives over time.");
    await page.getByLabel("Tags").fill("Politics, Institutions");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByText("#us1")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Untitled Source" }),
    ).toBeVisible();
    await expect(
      page.getByText("Institutions shape incentives over time."),
    ).toBeVisible();
    await expect(page.getByText("#politics")).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(
      page.getByRole("button", {
        name: /#us1[\s\S]*Untitled Source[\s\S]*Institutions shape/i,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: /#us1/i }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Shortcode #us1")).toBeVisible();
    await page
      .getByLabel("Insight")
      .fill("Institutions shape long-term incentives.");
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page.getByLabel("Source page").fill("72");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByText("#us1")).toBeVisible();
    await expect(page.getByText("Why Nations Fail, p. 72")).toBeVisible();
    await expect(
      page.getByText("Institutions shape long-term incentives."),
    ).toBeVisible();
    await expect(page.getByText("#economics")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Delete this note?")).toBeVisible();
    await page.getByRole("button", { name: "Confirm delete" }).click();

    await expect(page.getByText("Start by saving one idea from a book.")).toBeVisible();
    await expect(page.getByText("Institutions shape long-term incentives.")).toHaveCount(0);
  });

  test("sends compact note context to Podchat without provider calls", async ({
    page,
  }) => {
    const podchatCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
    ]) {
      await page.route(path, async (route) => {
        podchatCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected bridge call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page.getByRole("button", { name: /Tambah note/i }).click();

    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page.getByLabel("Quote").fill("Private quoted source text.");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByRole("button", { name: "Diskusi di Podchat" })).toBeVisible();
    await page.getByRole("button", { name: "Diskusi di Podchat" }).click();

    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByTestId("podchat-commonplace-context-card")).toBeVisible();
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText(
      "Commonplace context",
    );
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText("#wn1");
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText(
      "Why Nations Fail",
    );
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText(
      "Inclusive institutions create stronger incentives for growth.",
    );
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText(
      "#politics",
    );
    await expect(page.getByText(/Today, we'll discuss your Commonplace note #wn1/)).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Private quoted source text.");
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(bodyText).not.toMatch(forbiddenCommonplaceContextFieldPattern);
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByText(/mind map/i)).toHaveCount(0);
    expect(podchatCalls).toEqual([]);
  });

  test("opens a local note mind map canvas shell without provider calls", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected mind map call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page.getByRole("button", { name: /Tambah note/i }).click();

    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByRole("button", { name: "Buka mind map" })).toBeVisible();
    await page.getByRole("button", { name: "Buka mind map" }).click();

    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-canvas")).toBeVisible();
    await expect(page.locator(".react-flow")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toContainText("#wn1");
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toContainText(
      "Why Nations Fail",
    );
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toContainText(
      "Inclusive institutions create stronger incentives for growth.",
    );
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toContainText(
      "#politics",
    );
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText("Main Mind Map")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(providerCalls).toEqual([]);

    await page.getByRole("button", { name: "Back to Detail" }).click();
    await expect(page.getByRole("heading", { name: "Insight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buka mind map" })).toBeVisible();
  });

  test("adds a note node by shortcode, rejects invalid and duplicate shortcodes", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    // Create first note
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#wn1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Create second note
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Thinking Fast and Slow");
    await page
      .getByLabel("Insight")
      .fill("System 1 operates automatically with little effort.");
    await page.getByLabel("Tags").fill("Psychology, Cognition");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#tf1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Open first note detail and enter mind map
    await page.getByRole("button", { name: /#wn1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();

    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-canvas")).toBeVisible();

    // Initial node for first note exists
    const noteNodes = page.getByTestId("commonplace-mindmap-note-node");
    await expect(noteNodes).toHaveCount(1);
    await expect(noteNodes.first()).toContainText("#wn1");

    // Shortcode input exists with correct placeholder
    const shortcodeInput = page.getByTestId("commonplace-mindmap-shortcode-input");
    await expect(shortcodeInput).toBeVisible();
    await expect(shortcodeInput).toHaveAttribute("placeholder", "Ketik shortcode...");

    // Add second note by shortcode
    await shortcodeInput.fill("#tf1");
    await shortcodeInput.press("Enter");

    await expect(noteNodes).toHaveCount(2);
    await expect(noteNodes.nth(1)).toContainText("#tf1");
    await expect(noteNodes.nth(1)).toContainText(
      "System 1 operates automatically with little effort.",
    );
    await expect(noteNodes.nth(1)).toContainText("#psychology");

    // Feedback shows success
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Added #tf1 to canvas.",
    );

    // Invalid shortcode shows error
    await shortcodeInput.fill("#nonexistent99");
    await shortcodeInput.press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Shortcode not found.",
    );
    await expect(noteNodes).toHaveCount(2);

    // Duplicate shortcode shows info message
    await shortcodeInput.fill("#tf1");
    await shortcodeInput.press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Node already exists on canvas.",
    );
    await expect(noteNodes).toHaveCount(2);

    // Shortcode without # prefix also works (normalization)
    await shortcodeInput.fill("wn1");
    await shortcodeInput.press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Node already exists on canvas.",
    );
    await expect(noteNodes).toHaveCount(2);

    // No AI Suggest, Laci, or Main Mind Map
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText("Main Mind Map")).toHaveCount(0);

    // No provider calls, no secrets
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(providerCalls).toEqual([]);

    // Back to Detail still works
    await page.getByRole("button", { name: "Back to Detail" }).click();
    await expect(page.getByRole("heading", { name: "Insight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buka mind map" })).toBeVisible();
  });

  test("connects two nodes with a labeled edge and blocks duplicates/self-connections", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    // Create first note (#wn1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#wn1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Create second note (#tf1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Thinking Fast and Slow");
    await page
      .getByLabel("Insight")
      .fill("System 1 operates automatically with little effort.");
    await page.getByLabel("Tags").fill("Psychology, Cognition");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#tf1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Open first note detail and enter mind map
    await page.getByRole("button", { name: /#wn1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();

    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();

    // Add second note to canvas
    const shortcodeInput = page.getByTestId("commonplace-mindmap-shortcode-input");
    await shortcodeInput.fill("#tf1");
    await shortcodeInput.press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Added #tf1 to canvas.");

    // Activate connect mode
    const connectButton = page.getByTestId("commonplace-mindmap-connect-toggle");
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Verify feedback shows connect mode instructions
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Connect mode active.");

    // Select source node (#wn1)
    const wn1Node = page.locator(".react-flow__node").filter({ hasText: "#wn1" });
    await wn1Node.click({ force: true });
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Select target node");

    // Try self-connection on #wn1
    await wn1Node.click({ force: true });
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Choose a different target node.");

    // Select source node again
    await wn1Node.click({ force: true });

    // Select target node (#tf1)
    const tf1Node = page.locator(".react-flow__node").filter({ hasText: "#tf1" });
    await tf1Node.click({ force: true });

    // Connection form should appear
    const connForm = page.getByTestId("commonplace-mindmap-connection-form");
    await expect(connForm).toBeVisible();
    await expect(connForm).toContainText("#wn1");
    await expect(connForm).toContainText("#tf1");

    // Fill label and confirm
    const edgeLabelInput = page.getByTestId("commonplace-mindmap-label-input");
    await edgeLabelInput.fill("sebab-akibat");
    await page.getByTestId("commonplace-mindmap-confirm-connection").click();

    // Edge label should be visible on canvas
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toContainText("sebab-akibat");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Connection created");

    // Try duplicate connection A -> B
    await wn1Node.click({ force: true });
    await tf1Node.click({ force: true });
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Connection already exists.");

    // Toggle connect mode off and on to reset selection
    await connectButton.click();
    await connectButton.click();

    // Try duplicate connection B -> A
    await tf1Node.click({ force: true });
    await wn1Node.click({ force: true });
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Connection already exists.");

    // Verify Back to Detail still works
    await page.getByRole("button", { name: "Back to Detail" }).click();
    await expect(page.getByRole("heading", { name: "Insight" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buka mind map" })).toBeVisible();

    // Verify no Laci, AI Suggest, or Main Mind Map
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText("Laci")).toHaveCount(0);
    await expect(page.getByText("Main Mind Map")).toHaveCount(0);

    // Verify no secrets or provider calls
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(providerCalls).toEqual([]);
  });

  test("saves, lists in Laci, loads, clears state with mind map baru, and handles save/load errors", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    // Create first note (#wn1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#wn1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Create second note (#tf1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Thinking Fast and Slow");
    await page
      .getByLabel("Insight")
      .fill("System 1 operates automatically with little effort.");
    await page.getByLabel("Tags").fill("Psychology, Cognition");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#tf1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Open first note detail and enter mind map
    await page.getByRole("button", { name: /#wn1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();

    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();

    // Add second note to canvas
    const shortcodeInput = page.getByTestId("commonplace-mindmap-shortcode-input");
    await shortcodeInput.fill("#tf1");
    await shortcodeInput.press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Added #tf1 to canvas.");

    // Activate connect mode and connect nodes
    const connectButton = page.getByTestId("commonplace-mindmap-connect-toggle");
    await connectButton.click();

    const wn1Node = page.locator(".react-flow__node").filter({ hasText: "#wn1" });
    await wn1Node.click({ force: true });

    const tf1Node = page.locator(".react-flow__node").filter({ hasText: "#tf1" });
    await tf1Node.click({ force: true });

    // Fill label and confirm connection
    const edgeLabelInput = page.getByTestId("commonplace-mindmap-label-input");
    await edgeLabelInput.fill("sebab-akibat");
    await page.getByTestId("commonplace-mindmap-confirm-connection").click();

    // Edge label should be visible
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toContainText("sebab-akibat");

    // Laci drawer is present but closed by default
    const laciDrawer = page.getByTestId("commonplace-mindmap-laci-drawer");
    await expect(laciDrawer).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-laci-body")).toHaveCount(0);

    // Save sub mind map
    const saveButton = page.getByTestId("commonplace-mindmap-save-btn");
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify feedback shows saved successfully
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Mind map saved successfully.");

    // Open Laci drawer
    const laciHeader = page.getByTestId("commonplace-mindmap-laci-header");
    await laciHeader.click();

    // The saved mind map should appear in Laci
    await expect(page.getByTestId("commonplace-mindmap-laci-body")).toBeVisible();
    await expect(laciDrawer.getByText("Why Nations Fail")).toBeVisible();
    await expect(laciDrawer.getByText("1 saved")).toBeVisible();

    // Test Load Failure behavior:
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_LOAD__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_LOAD__ = true;
    });

    // Click the saved item while Laci is already open
    const savedItem = page.getByTestId(/commonplace-mindmap-laci-item-map-/);
    await expect(savedItem).toBeVisible();
    await savedItem.click();

    // Verify feedback shows load failure error
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Could not load mind map.");

    // Laci drawer should still be open
    await expect(page.getByTestId("commonplace-mindmap-laci-body")).toBeVisible();

    // Clear the load failure flag
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_LOAD__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_LOAD__ = false;
    });

    // Click saved item again (loading succeeds)
    await savedItem.click();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Loaded mind map");

    // Drawer is now automatically closed after load!
    await expect(page.getByTestId("commonplace-mindmap-laci-body")).toHaveCount(0);

    // Test Save Failure behavior:
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_SAVE__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_SAVE__ = true;
    });
    // Click save
    await saveButton.click();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Could not save mind map.");

    // Clear save failure flag
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_SAVE__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_SAVE__ = false;
    });

    // Click "Mind map baru" to clear canvas and start fresh
    const newBtn = page.getByTestId("commonplace-mindmap-new-btn");
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Canvas should only show the initial note (#wn1) and no edges
    const noteNodes = page.getByTestId("commonplace-mindmap-note-node");
    await expect(noteNodes).toHaveCount(1);
    await expect(noteNodes.first()).toContainText("#wn1");
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Started a new mind map.");

    // Open Laci drawer to load again
    await laciHeader.click();
    await expect(savedItem).toBeVisible();
    await savedItem.click();

    // Restored nodes and edges
    await expect(noteNodes).toHaveCount(2);
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toContainText("sebab-akibat");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText("Loaded mind map");

    // Open Laci drawer again to test deletion
    await laciHeader.click();
    const deleteBtn = page.getByTestId(/commonplace-mindmap-laci-delete-map-/);
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Laci should now show no saved mind maps
    await expect(laciDrawer.getByText("0 saved")).toBeVisible();
    await expect(laciDrawer.getByText("Belum ada mind map yang disimpan.")).toBeVisible();

    // Verify no AI Suggest, Main Mind Map, or provider calls
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText("Main Mind Map")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(providerCalls).toEqual([]);
  });

  test("existing main views remain reachable from sidebar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("podchat-setup")).toBeVisible();

    await page.getByRole("button", { name: "Article Practice" }).click();
    await expect(
      page.locator("h2").filter({ hasText: "Article Practice" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Weekly Review" }).click();
    await expect(
      page.locator("h2").filter({ hasText: "Weekly Review" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(
      page.locator("h2").filter({ hasText: "Profile & Settings" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Active Session" }).click();
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
  });

  test("does not render mind map canvas or secret-like environment values", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-view")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
  });

  test("old invalid saved view values do not break active fallback", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("selectedView", "learning-path");
      localStorage.setItem("activeView", "level-up-check");
      localStorage.setItem("view", "diagnostic");
    });

    await page.goto("/");

    await expect(page.locator("aside")).not.toContainText("Learning Path");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
  });

  test("Main Mind Map UI shell behavior (empty state, header, back button, no note inputs)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    // 1. Commonplace Library shows `Mind Map Utama` entry point.
    const mainMapBtn = page.getByTestId("commonplace-main-mindmap-btn");
    await expect(mainMapBtn).toBeVisible();
    await expect(mainMapBtn).toContainText("Mind Map Utama");

    // 2. Clicking `Mind Map Utama` opens Main Mind Map view.
    await mainMapBtn.click();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();

    // 3. Main Mind Map header renders.
    await expect(page.getByRole("heading", { name: "Mind Map Utama" })).toBeVisible();
    await expect(page.getByText("Connect saved sub mind maps as high-level idea clusters.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah cluster" })).toBeVisible();

    // 4. Empty state renders when no clusters exist.
    await expect(page.getByTestId("commonplace-main-mindmap-empty")).toBeVisible();
    await expect(page.getByText("No clusters yet. Add saved sub mind maps in the next step.")).toBeVisible();

    // 6. Main Mind Map does not show `Ketik shortcode...`.
    await expect(page.getByPlaceholder("Ketik shortcode...")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-shortcode-input")).toHaveCount(0);

    // 7. Main Mind Map does not show note insertion controls.
    await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-connect-toggle")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-laci-drawer")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toHaveCount(0);

    // 8. Main Mind Map does not show AI Suggest.
    await expect(page.getByText("AI Suggest")).toHaveCount(0);

    // 12. No API keys / env values are rendered.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);

    // 5. Back to Library works.
    const backBtn = page.getByTestId("commonplace-main-mindmap-back-btn");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify back in Library view
    await expect(page.getByTestId("commonplace-main-mindmap-btn")).toBeVisible();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toHaveCount(0);
  });

  test("Main Mind Map loads existing clusters and renders custom cards", async ({
    page,
  }) => {
    // 9. Ensure no provider calls during this process.
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected main map provider call" }),
        });
      });
    }

    // Set up a mock cluster node in testWindow
    await page.addInitScript(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAIN_NODES__?: Record<string, unknown>[];
      };
      testWindow.__COMMONPLACE_TEST_MAIN_NODES__ = [
        {
          id: "cluster-db-1",
          subMindMapId: "sub-map-123",
          subMindMapTitle: "Philosophy of Science Submap",
          positionX: 150,
          positionY: 200,
          updatedAt: "2026-06-06T12:30:00Z",
        },
      ];
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page.getByTestId("commonplace-main-mindmap-btn").click();

    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-main-mindmap-empty")).toHaveCount(0);

    // 13. Cluster card renders as `Sub Mind Map`.
    const clusterNode = page.getByTestId("commonplace-mainmap-cluster-node");
    await expect(clusterNode).toBeVisible();
    await expect(clusterNode).toContainText("Sub Mind Map");
    await expect(clusterNode).toContainText("Philosophy of Science Submap");

    // 14. Cluster card does not display note insight or act like note node.
    await expect(clusterNode).not.toContainText("shape incentives over time");
    await expect(page.getByTestId("commonplace-mindmap-note-node")).toHaveCount(0);

    // No provider calls made
    expect(providerCalls).toEqual([]);
  });

  test("Main Mind Map cluster click opens the saved sub mind map graph", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected main map provider call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    // Create first note (#wn1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#wn1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Create second note (#tf1)
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Thinking Fast and Slow");
    await page
      .getByLabel("Insight")
      .fill("System 1 operates automatically with little effort.");
    await page.getByLabel("Tags").fill("Psychology, Cognition");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#tf1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    // Save a connected sub mind map.
    await page.getByRole("button", { name: /#wn1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();
    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();

    await page.getByTestId("commonplace-mindmap-shortcode-input").fill("#tf1");
    await page.getByTestId("commonplace-mindmap-shortcode-input").press("Enter");
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Added #tf1 to canvas.",
    );

    const connectButton = page.getByTestId("commonplace-mindmap-connect-toggle");
    await connectButton.click();

    const wn1Node = page.locator(".react-flow__node").filter({ hasText: "#wn1" });
    const tf1Node = page.locator(".react-flow__node").filter({ hasText: "#tf1" });
    await wn1Node.click({ force: true });
    await tf1Node.click({ force: true });

    await page.getByTestId("commonplace-mindmap-label-input").fill("sebab-akibat");
    await page.getByTestId("commonplace-mindmap-confirm-connection").click();
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toContainText(
      "sebab-akibat",
    );

    await page.getByTestId("commonplace-mindmap-save-btn").click();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Mind map saved successfully.",
    );

    await page.getByRole("button", { name: "Back to Detail" }).click();
    await page.getByRole("button", { name: "Back" }).click();

    // Open Main Map and insert the saved sub map as a cluster.
    await page.getByTestId("commonplace-main-mindmap-btn").click();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-shortcode-input")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-connect-toggle")).toHaveCount(0);

    await page.getByTestId("commonplace-mainmap-add-cluster-btn").click();
    const selector = page.getByTestId("commonplace-mainmap-cluster-selector");
    await expect(selector.getByText("Why Nations Fail")).toBeVisible();
    await selector.getByRole("button", { name: /Why Nations Fail/ }).click();

    const clusterNode = page.getByTestId("commonplace-mainmap-cluster-node");
    await expect(clusterNode).toBeVisible();
    await expect(clusterNode).toContainText("Why Nations Fail");
    await expect(clusterNode).toContainText("Sub Mind Map");
    await expect(clusterNode).toContainText("Click to open");

    // Clicking the cluster opens the existing sub map canvas and loads its saved graph.
    await clusterNode.click();
    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      'Loaded mind map: "Why Nations Fail"',
    );

    const openedNodes = page.getByTestId("commonplace-mindmap-note-node");
    await expect(openedNodes).toHaveCount(2);
    await expect(openedNodes).toContainText(["#wn1", "#tf1"]);
    await expect(page.getByTestId("commonplace-mindmap-edge-label")).toContainText(
      "sebab-akibat",
    );

    await expect(page.getByRole("button", { name: "Mind Map Utama" })).toHaveCount(0);
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(bodyText).not.toMatch(forbiddenCommonplaceContextFieldPattern);
    expect(providerCalls).toEqual([]);
  });

  test("Main Mind Map connects clusters locally and keeps normal click-to-open", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected main map provider call" }),
        });
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Why Nations Fail");
    await page
      .getByLabel("Insight")
      .fill("Inclusive institutions create stronger incentives for growth.");
    await page.getByLabel("Tags").fill("Politics, Economics");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#wn1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("button", { name: /Tambah note/i }).click();
    await page.getByLabel("Source book").fill("Thinking Fast and Slow");
    await page
      .getByLabel("Insight")
      .fill("System 1 operates automatically with little effort.");
    await page.getByLabel("Tags").fill("Psychology, Cognition");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("#tf1")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("button", { name: /#wn1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();
    await page.getByTestId("commonplace-mindmap-save-btn").click();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Mind map saved successfully.",
    );
    await page.getByRole("button", { name: "Back to Detail" }).click();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("button", { name: /#tf1/i }).click();
    await page.getByRole("button", { name: "Buka mind map" }).click();
    await page.getByTestId("commonplace-mindmap-save-btn").click();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      "Mind map saved successfully.",
    );
    await page.getByRole("button", { name: "Back to Detail" }).click();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByTestId("commonplace-main-mindmap-btn").click();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByPlaceholder("Ketik shortcode...")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-shortcode-input")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);

    await page.getByTestId("commonplace-mainmap-add-cluster-btn").click();
    await page
      .getByTestId("commonplace-mainmap-cluster-selector")
      .getByRole("button", { name: /Why Nations Fail/ })
      .click();
    await page.getByTestId("commonplace-mainmap-add-cluster-btn").click();
    await page
      .getByTestId("commonplace-mainmap-cluster-selector")
      .getByRole("button", { name: /Thinking Fast and Slow/ })
      .click();

    const clusterNodes = page.getByTestId("commonplace-mainmap-cluster-node");
    await expect(clusterNodes).toHaveCount(2);
    await expect(clusterNodes.first()).toContainText("Sub Mind Map");

    const wnfCluster = page.locator(".react-flow__node").filter({ hasText: "Why Nations Fail" });
    const tfsCluster = page.locator(".react-flow__node").filter({ hasText: "Thinking Fast and Slow" });
    const connectButton = page.getByTestId("commonplace-mainmap-connect-toggle");

    await connectButton.click();
    await expect(connectButton).toHaveClass(/bg-\[#534AB7\]/);
    await expect(page.getByTestId("commonplace-mainmap-connect-panel")).toContainText(
      "Pilih dua cluster untuk dihubungkan.",
    );

    await wnfCluster.click({ force: true });
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-view")).toHaveCount(0);

    await wnfCluster.click({ force: true });
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Choose a different target cluster.",
    );

    await tfsCluster.click({ force: true });
    await expect(page.getByTestId("commonplace-mainmap-connect-panel")).toContainText(
      "Label koneksi",
    );
    await page.getByTestId("commonplace-mainmap-label-input").fill("akar masalah");
    await page.getByTestId("commonplace-mainmap-confirm-connection").click();
    await expect(page.getByTestId("commonplace-mainmap-edge-label")).toContainText(
      "akar masalah",
    );

    const saveMainMapButton = page.getByTestId("commonplace-main-mindmap-save-btn");
    await expect(saveMainMapButton).toContainText("Save Main Map");
    await saveMainMapButton.click();
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Main Mind Map saved.",
    );
    await expect(clusterNodes).toHaveCount(2);
    await expect(page.getByTestId("commonplace-mainmap-edge-label")).toContainText(
      "akar masalah",
    );

    const savePayload = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAIN_SAVE_CALLS__?: TestMainMapSaveCall[];
      };
      return testWindow.__COMMONPLACE_TEST_MAIN_SAVE_CALLS__?.at(-1) ?? null;
    });

    expect(savePayload).not.toBeNull();
    expect(savePayload?.clusters.map((cluster) => cluster.subMindMapId).sort()).toEqual([
      expect.stringMatching(/^map-/),
      expect.stringMatching(/^map-/),
    ]);
    expect(savePayload?.clusters).toHaveLength(2);
    for (const cluster of savePayload?.clusters ?? []) {
      expect(cluster.localId).toMatch(/^cluster-map-/);
      expect(Number.isFinite(cluster.positionX)).toBe(true);
      expect(Number.isFinite(cluster.positionY)).toBe(true);
    }
    expect(savePayload?.edges).toEqual([
      expect.objectContaining({
        sourceLocalId: expect.stringMatching(/^cluster-map-/),
        targetLocalId: expect.stringMatching(/^cluster-map-/),
        label: "akar masalah",
      }),
    ]);

    await page.getByTestId("commonplace-main-mindmap-back-btn").click();
    await page.getByTestId("commonplace-main-mindmap-btn").click();
    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mainmap-cluster-node")).toHaveCount(2);
    await expect(page.getByTestId("commonplace-mainmap-edge-label")).toContainText(
      "akar masalah",
    );

    await page.getByTestId("commonplace-mainmap-add-cluster-btn").click();
    await page
      .getByTestId("commonplace-mainmap-cluster-selector")
      .getByRole("button", { name: /Why Nations Fail/ })
      .click();
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Cluster already exists on canvas.",
    );

    await connectButton.click();
    await expect(page.getByTestId("commonplace-mainmap-connect-panel")).toBeVisible();
    await tfsCluster.click({ force: true });
    await wnfCluster.click({ force: true });
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Connection already exists.",
    );
    await expect(page.getByTestId("commonplace-mainmap-edge-label")).toHaveCount(1);

    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_SAVE__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_SAVE__ = true;
    });
    await saveMainMapButton.click();
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Could not save Main Mind Map.",
    );
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_SAVE__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_SAVE__ = false;
    });

    await connectButton.click();
    await expect(page.getByTestId("commonplace-mainmap-connect-panel")).toHaveCount(0);
    await wnfCluster.click({ force: true });
    await expect(page.getByTestId("commonplace-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-mindmap-feedback")).toContainText(
      'Loaded mind map: "Why Nations Fail"',
    );

    await page.getByRole("button", { name: "Back to Detail" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_FAIL_LOAD__?: boolean;
      };
      testWindow.__COMMONPLACE_TEST_FAIL_LOAD__ = true;
    });
    await page.getByTestId("commonplace-main-mindmap-btn").click();
    await expect(page.getByTestId("commonplace-main-mindmap-error")).toContainText(
      "Could not load Main Mind Map.",
    );

    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(bodyText).not.toMatch(forbiddenCommonplaceContextFieldPattern);
    expect(providerCalls).toEqual([]);
  });

  test("Main Mind Map selector shows empty state when no sub mind maps exist", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page.getByTestId("commonplace-main-mindmap-btn").click();

    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();

    const addClusterBtn = page.getByTestId("commonplace-mainmap-add-cluster-btn");
    await expect(addClusterBtn).toBeVisible();
    await addClusterBtn.click();

    // Selector open, should show empty submaps copy
    await expect(page.getByTestId("commonplace-mainmap-cluster-selector")).toBeVisible();
    await expect(page.getByTestId("commonplace-mainmap-no-submaps")).toBeVisible();
    await expect(page.getByTestId("commonplace-mainmap-no-submaps")).toContainText(
      "No saved sub mind maps yet."
    );
  });

  test("Main Mind Map allows cluster insertion, draggability, and blocks duplicates", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    for (const path of [
      "**/api/podchat/turn",
      "**/api/podchat/evaluate",
      "**/api/podchat/stt",
      "**/api/podchat/tts",
      "**/api/article-practice",
    ]) {
      await page.route(path, async (route) => {
        providerCalls.push(route.request().url());
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected main map provider call" }),
        });
      });
    }

    // Inject mock sub mind maps into testWindow
    await page.addInitScript(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MINDMAPS__?: TestMindMapSummary[];
      };
      testWindow.__COMMONPLACE_TEST_MINDMAPS__ = [
        {
          id: "sub-map-111",
          ownerId: "commonplace-test-owner",
          title: "Political Institutions Map",
          type: "sub",
          parentMindMapId: null,
          createdAt: "2026-06-06T10:00:00Z",
          updatedAt: "2026-06-06T10:30:00Z",
        },
        {
          id: "sub-map-222",
          ownerId: "commonplace-test-owner",
          title: "Cognitive Psychology Map",
          type: "sub",
          parentMindMapId: null,
          createdAt: "2026-06-06T11:00:00Z",
          updatedAt: "2026-06-06T11:45:00Z",
        },
        {
          id: "main-map-should-not-render",
          ownerId: "commonplace-test-owner",
          title: "Main Map Should Not Appear",
          type: "main",
          parentMindMapId: null,
          createdAt: "2026-06-06T12:00:00Z",
          updatedAt: "2026-06-06T12:45:00Z",
        },
      ];
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page.getByTestId("commonplace-main-mindmap-btn").click();

    await expect(page.getByTestId("commonplace-main-mindmap-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-main-mindmap-empty")).toBeVisible();

    const addClusterBtn = page.getByTestId("commonplace-mainmap-add-cluster-btn");
    await addClusterBtn.click();

    // The selector list should appear and show both sub maps
    const selector = page.getByTestId("commonplace-mainmap-cluster-selector");
    await expect(selector).toBeVisible();
    await expect(selector.getByText("Political Institutions Map")).toBeVisible();
    await expect(selector.getByText("Cognitive Psychology Map")).toBeVisible();
    await expect(selector.getByText("Sub Mind Map", { exact: true })).toHaveCount(2);
    await expect(selector.locator("span").filter({ hasText: /^Updated:/ })).toHaveCount(2);
    await expect(selector.getByText("Main Map Should Not Appear")).toHaveCount(0);

    // Select the first one
    await page.getByTestId("commonplace-mainmap-select-item-sub-map-111").click();

    // Canvas empty state should disappear, cluster card node appears
    await expect(page.getByTestId("commonplace-main-mindmap-empty")).toHaveCount(0);
    const clusterNodes = page.getByTestId("commonplace-mainmap-cluster-node");
    await expect(clusterNodes).toHaveCount(1);
    await expect(clusterNodes.first()).toContainText("Political Institutions Map");
    await expect(clusterNodes.first()).toContainText("Sub Mind Map");

    // Success feedback shows up
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      'Added cluster for "Political Institutions Map"'
    );

    // Now try to insert the duplicate cluster
    await addClusterBtn.click();
    await page.getByTestId("commonplace-mainmap-select-item-sub-map-111").click();

    // Duplicate check blocks it, cluster count remains 1, duplicate error feedback shows
    await expect(clusterNodes).toHaveCount(1);
    await expect(page.getByTestId("commonplace-main-mindmap-feedback")).toContainText(
      "Cluster already exists on canvas."
    );

    // Insert the second cluster map
    await addClusterBtn.click();
    await page.getByTestId("commonplace-mainmap-select-item-sub-map-222").click();

    // Cluster count becomes 2
    await expect(clusterNodes).toHaveCount(2);
    await expect(clusterNodes.nth(1)).toContainText("Cognitive Psychology Map");
    await expect(page.getByPlaceholder("Ketik shortcode...")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-shortcode-input")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-connect-toggle")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-mindmap-laci-drawer")).toHaveCount(0);
    await expect(page.getByText("AI Suggest")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(bodyText).not.toMatch(forbiddenCommonplaceContextFieldPattern);
    expect(providerCalls).toEqual([]);
  });
});
