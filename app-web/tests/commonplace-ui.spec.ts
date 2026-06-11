import { expect, test, type Locator, type Page } from "@playwright/test";

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

type TestMap = {
  id: string;
  ownerId: string;
  title: string;
  type: "main" | "sub";
  parentMindMapId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TestMapNode = {
  id: string;
  ownerId: string;
  mapId: string;
  nodeKind: "note" | "cluster";
  noteId: string | null;
  subMindMapId: string | null;
  positionX: number;
  positionY: number;
};

type TestMapEdge = {
  id: string;
  ownerId: string;
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: "solid" | "dashed";
  label: string | null;
};

const TEST_OWNER_ID = "commonplace-test-owner";

const renderedSecretLikePattern =
  /DEEPSEEK_API_KEY|DEEPGRAM_API_KEY|ELEVENLABS_API_KEY|CLAUDE_API_KEY|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|raw provider payload|audio_blob|recording_url|stt_payload|tts_payload/i;

const forbiddenCommonplaceContextFieldPattern =
  /\b(ownerId|clientId|auth_metadata)\b/i;

function baseNote(overrides: Partial<TestNote>): TestNote {
  return {
    id: "note-1",
    ownerId: TEST_OWNER_ID,
    clientId: null,
    shortcode: "#wn1",
    sourceBook: "Why Nations Fail",
    sourcePage: null,
    title: "Institutions and Growth",
    quote: null,
    insight: "Inclusive institutions create stronger incentives for growth.",
    tags: ["politics", "economics", "institutions"],
    connections: [],
    relevance: null,
    createdAt: "2026-06-06T05:00:00.000Z",
    updatedAt: "2026-06-06T05:00:00.000Z",
    ...overrides,
  };
}

function manyLibraryNotes(count: number): TestNote[] {
  return Array.from({ length: count }, (_, index) =>
    baseNote({
      id: `many-note-${index + 1}`,
      shortcode: `#qa${index + 1}`,
      sourceBook: `Library Source ${index + 1}`,
      title: `Viewport Scroll Note ${index + 1}`,
      insight: `Seeded note ${index + 1} for checking internal Library scrolling.`,
      tags: ["qa", "scroll"],
      createdAt: new Date(
        Date.UTC(2026, 5, 6, 5, index, 0),
      ).toISOString(),
      updatedAt: new Date(
        Date.UTC(2026, 5, 6, 5, index, 0),
      ).toISOString(),
    }),
  );
}

function installCommonplaceTestAdapter(seedNotes: TestNote[] = []) {
  const testWindow = window as typeof window & {
    __COMMONPLACE_TEST_NOTES__?: TestNote[];
    __COMMONPLACE_TEST_MAPS__?: TestMap[];
    __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
    __COMMONPLACE_TEST_MAP_EDGES__?: TestMapEdge[];
    __COMMONPLACE_TEST_COUNTERS__?: Record<string, number>;
    __COMMONPLACE_TEST_ADAPTER__?: unknown;
    __COMMONPLACE_FORCE_CREATE_FAILURE__?: boolean;
    __COMMONPLACE_FORCE_DETAIL_READ_FAILURE__?: boolean;
    __COMMONPLACE_FORCE_LIST_FAILURE__?: boolean;
    __COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__?: boolean;
  };
  const notesStorageKey = "__COMMONPLACE_TEST_NOTES__";
  const readPersistedNotes = (): TestNote[] | null => {
    try {
      const stored = window.sessionStorage.getItem(notesStorageKey);
      const parsed = stored ? (JSON.parse(stored) as unknown) : null;
      return Array.isArray(parsed) ? (parsed as TestNote[]) : null;
    } catch {
      return null;
    }
  };
  const persistNotes = () => {
    try {
      window.sessionStorage.setItem(
        notesStorageKey,
        JSON.stringify(testWindow.__COMMONPLACE_TEST_NOTES__ ?? []),
      );
    } catch {
      // Persistence is only needed for reload-focused UI tests.
    }
  };

  testWindow.__COMMONPLACE_TEST_NOTES__ =
    readPersistedNotes() ?? seedNotes.map((note) => ({ ...note }));
  const testOwnerId = seedNotes[0]?.ownerId ?? "commonplace-test-owner";
  testWindow.__COMMONPLACE_TEST_MAPS__ = [
    {
      id: "main-map-1",
      ownerId: testOwnerId,
      title: "Institutions Overview",
      type: "main",
      parentMindMapId: null,
      createdAt: "2026-06-06T05:00:00.000Z",
      updatedAt: "2026-06-06T05:00:00.000Z",
    },
    {
      id: "main-map-2",
      ownerId: testOwnerId,
      title: "Comparative Politics Map",
      type: "main",
      parentMindMapId: null,
      createdAt: "2026-06-06T06:00:00.000Z",
      updatedAt: "2026-06-06T06:00:00.000Z",
    },
    {
      id: "sub-map-1",
      ownerId: testOwnerId,
      title: "Institutional Incentives",
      type: "sub",
      parentMindMapId: null,
      createdAt: "2026-06-06T05:00:00.000Z",
      updatedAt: "2026-06-06T05:00:00.000Z",
    },
    {
      id: "sub-map-2",
      ownerId: testOwnerId,
      title: "Cognitive Systems",
      type: "sub",
      parentMindMapId: null,
      createdAt: "2026-06-06T07:00:00.000Z",
      updatedAt: "2026-06-06T07:00:00.000Z",
    },
  ];
  testWindow.__COMMONPLACE_TEST_MAP_NODES__ = seedNotes[0]
    ? [
        {
          id: "sub-node-1",
          ownerId: testOwnerId,
          mapId: "sub-map-1",
          nodeKind: "note",
          noteId: seedNotes[0].id,
          subMindMapId: null,
          positionX: 120,
          positionY: 140,
        },
        ...(seedNotes[1]
          ? [
              {
                id: "sub-node-2",
                ownerId: testOwnerId,
                mapId: "sub-map-2",
                nodeKind: "note" as const,
                noteId: seedNotes[1].id,
                subMindMapId: null,
                positionX: 180,
                positionY: 160,
              },
            ]
          : []),
      ]
    : [];
  testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = [];
  testWindow.__COMMONPLACE_TEST_COUNTERS__ = {};

  testWindow.__COMMONPLACE_TEST_ADAPTER__ = {
    async listCommonplaceNotes(ownerId: string) {
      if (testWindow.__COMMONPLACE_FORCE_LIST_FAILURE__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }

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
      if (
        !input.ownerId ||
        !input.sourceBook?.trim() ||
        !input.title?.trim() ||
        !input.insight?.trim()
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }
      if (testWindow.__COMMONPLACE_FORCE_CREATE_FAILURE__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }

      const sourceBook = input.sourceBook.trim();
      const prefix =
        sourceBook
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
        title: input.title.trim(),
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
      persistNotes();
      return { ok: true as const, note };
    },
    async getCommonplaceNoteById(ownerId: string, noteId: string) {
      if (testWindow.__COMMONPLACE_FORCE_DETAIL_READ_FAILURE__) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.id === noteId,
      );
      return note
        ? { ok: true as const, note }
        : { ok: false as const, error: "commonplace_not_found" as const };
    },
    async getCommonplaceNoteByShortcode(ownerId: string, shortcode: string) {
      if (testWindow.__COMMONPLACE_FORCE_DETAIL_READ_FAILURE__) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.shortcode === shortcode,
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
      if (
        noteIndex < 0 ||
        !input.sourceBook?.trim() ||
        !input.title?.trim() ||
        !input.insight?.trim()
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const updated: TestNote = {
        ...notes[noteIndex],
        sourceBook: input.sourceBook.trim(),
        sourcePage: input.sourcePage?.trim() || null,
        title: input.title.trim(),
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
      persistNotes();
      return { ok: true as const, note: updated };
    },
    async deleteCommonplaceNote(ownerId: string, noteId: string) {
      testWindow.__COMMONPLACE_TEST_NOTES__ = (
        testWindow.__COMMONPLACE_TEST_NOTES__ ?? []
      ).filter((note) => note.ownerId !== ownerId || note.id !== noteId);
      persistNotes();
      return { ok: true as const };
    },
    async createCommonplaceSubMindMap() {
      return { ok: false as const, error: "commonplace_save_failed" as const };
    },
    async listCommonplaceSubMindMaps() {
      return { ok: true as const, mindMaps: [] };
    },
    async getCommonplaceMindMapGraph() {
      return { ok: false as const, error: "commonplace_not_found" as const };
    },
    async saveCommonplaceMindMapGraph() {
      return { ok: false as const, error: "commonplace_save_failed" as const };
    },
    async deleteCommonplaceMindMap() {
      return { ok: true as const };
    },
    async listCommonplaceMindMaps(ownerId: string, type?: "main" | "sub" | null) {
      return {
        ok: true as const,
        mindMaps: (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).filter(
          (map) => map.ownerId === ownerId && (!type || map.type === type),
        ),
      };
    },
    async createCommonplaceMindMap(input: {
      ownerId: string;
      title: string;
      type: "main" | "sub";
    }) {
      if (
        !input.ownerId ||
        !input.title.trim() ||
        (input.type !== "main" && input.type !== "sub")
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }
      const now = new Date("2026-06-06T07:00:00.000Z").toISOString();
      const map: TestMap = {
        id: `${input.type}-map-${Date.now()}`,
        ownerId: input.ownerId,
        title: input.title.trim(),
        type: input.type,
        parentMindMapId: null,
        createdAt: now,
        updatedAt: now,
      };
      testWindow.__COMMONPLACE_TEST_MAPS__ = [
        map,
        ...(testWindow.__COMMONPLACE_TEST_MAPS__ ?? []),
      ];
      return { ok: true as const, mindMap: map };
    },
    async renameCommonplaceMindMap(input: {
      ownerId: string;
      mindMapId: string;
      title: string;
    }) {
      const maps = testWindow.__COMMONPLACE_TEST_MAPS__ ?? [];
      const mapIndex = maps.findIndex(
        (map) => map.ownerId === input.ownerId && map.id === input.mindMapId,
      );
      if (mapIndex < 0 || !input.title.trim()) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }
      const updated = {
        ...maps[mapIndex],
        title: input.title.trim(),
        updatedAt: new Date("2026-06-06T08:00:00.000Z").toISOString(),
      };
      maps[mapIndex] = updated;
      testWindow.__COMMONPLACE_TEST_MAPS__ = maps;
      return { ok: true as const, mindMap: updated };
    },
    async deleteCommonplaceMindMapFromRegistry(ownerId: string, mindMapId: string) {
      testWindow.__COMMONPLACE_TEST_MAPS__ = (
        testWindow.__COMMONPLACE_TEST_MAPS__ ?? []
      ).filter((map) => map.ownerId !== ownerId || map.id !== mindMapId);
      return { ok: true as const };
    },
    async listCommonplaceMapNodes(
      ownerId: string,
      mindMapId: string,
      type: "main" | "sub",
    ) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === mindMapId &&
          candidate.type === type,
      );
      if (!map) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      if (type === "main") {
        const nodes = (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
          .filter(
            (node) =>
              node.ownerId === ownerId &&
              node.mapId === mindMapId,
          )
          .map((node) => {
            if (node.nodeKind === "note") {
              const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
                (candidate) =>
                  candidate.ownerId === ownerId && candidate.id === node.noteId,
              );

              return {
                id: node.id,
                nodeKind: "note" as const,
                noteId: node.noteId ?? "",
                positionX: node.positionX,
                positionY: node.positionY,
                noteShortcode: note?.shortcode ?? "",
                noteTitle: note?.title ?? null,
                noteSourceBook: note?.sourceBook ?? "Untitled Source",
                noteTags: note?.tags ?? [],
              };
            }

            const subMap = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
              (candidate) =>
                candidate.ownerId === ownerId &&
                candidate.id === node.subMindMapId &&
                candidate.type === "sub",
            );

            return {
              id: node.id,
              nodeKind: "cluster" as const,
              subMindMapId: node.subMindMapId ?? "",
              subMindMapTitle: subMap?.title ?? "Untitled Sub Mind Map",
              subMindMapUpdatedAt:
                subMap?.updatedAt ?? "2026-06-06T05:00:00.000Z",
              positionX: node.positionX,
              positionY: node.positionY,
            };
          });

        return { ok: true as const, nodes };
      }

      const nodes = (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter(
          (node) =>
            node.ownerId === ownerId &&
            node.mapId === mindMapId &&
            node.nodeKind === "note",
        )
        .map((node) => {
          const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
            (candidate) =>
              candidate.ownerId === ownerId && candidate.id === node.noteId,
          );

          return {
            id: node.id,
            nodeKind: "note" as const,
            noteId: node.noteId ?? "",
            positionX: node.positionX,
            positionY: node.positionY,
            noteShortcode: note?.shortcode ?? "",
            noteTitle: note?.title ?? null,
            noteSourceBook: note?.sourceBook ?? "Untitled Source",
            noteTags: note?.tags ?? [],
          };
        });

      return { ok: true as const, nodes };
    },
    async batchUpdateCommonplaceMapNodePositions(
      ownerId: string,
      mindMapId: string,
      type: "main" | "sub",
      updates: Array<{ nodeId: string; position: { x: number; y: number } }>,
    ) {
      if (testWindow.__COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__) {
        return { ok: false as const, error: "commonplace_save_failed" as const };
      }

      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === mindMapId &&
          candidate.type === type,
      );
      if (!map) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      if (type === "main") {
        const nodes = testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [];
        for (const update of updates) {
          const node = nodes.find(
            (candidate) =>
              candidate.ownerId === ownerId &&
              candidate.mapId === mindMapId &&
              candidate.id === update.nodeId,
          );
          if (!node) {
            return { ok: false as const, error: "commonplace_not_found" as const };
          }
          node.positionX = update.position.x;
          node.positionY = update.position.y;
        }
        testWindow.__COMMONPLACE_TEST_MAP_NODES__ = nodes;
        return { ok: true as const };
      }

      const nodes = testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [];
      for (const update of updates) {
        const node = nodes.find(
          (candidate) =>
            candidate.ownerId === ownerId &&
            candidate.mapId === mindMapId &&
            candidate.id === update.nodeId &&
            candidate.nodeKind === "note",
        );
        if (!node) {
          return { ok: false as const, error: "commonplace_not_found" as const };
        }
        node.positionX = update.position.x;
        node.positionY = update.position.y;
      }
      testWindow.__COMMONPLACE_TEST_MAP_NODES__ = nodes;
      return { ok: true as const };
    },
    async createSubMapNoteNode(
      ownerId: string,
      mindMapId: string,
      noteId: string,
      position: { x: number; y: number },
    ) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === mindMapId &&
          candidate.type === "sub",
      );
      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.id === noteId,
      );
      if (!map || !note) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const nextIndex = (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []).length + 1;
      const node: TestMapNode = {
        id: `sub-node-created-${nextIndex}`,
        ownerId,
        mapId: mindMapId,
        nodeKind: "note",
        noteId,
        subMindMapId: null,
        positionX: position.x,
        positionY: position.y,
      };
      testWindow.__COMMONPLACE_TEST_MAP_NODES__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []),
        node,
      ];
      return {
        ok: true as const,
        node: {
          id: node.id,
          nodeKind: "note" as const,
          noteId,
          positionX: node.positionX,
          positionY: node.positionY,
          noteShortcode: note.shortcode,
          noteTitle: note.title,
          noteSourceBook: note.sourceBook,
          noteTags: note.tags,
        },
      };
    },
    async createMainMapNoteNode(
      ownerId: string,
      input: {
        mainMapId: string;
        noteId: string;
        position: { x: number; y: number };
      },
    ) {
      const mainMap = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === input.mainMapId &&
          candidate.type === "main",
      );
      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.id === input.noteId,
      );
      if (!mainMap || !note) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      if (
        !Number.isFinite(input.position.x) ||
        !Number.isFinite(input.position.y)
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const nextIndex =
        (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []).filter(
          (node) => node.nodeKind === "note" && node.mapId === input.mainMapId,
        ).length + 1;
      const node: TestMapNode = {
        id: `main-note-created-${nextIndex}`,
        ownerId,
        mapId: input.mainMapId,
        nodeKind: "note",
        noteId: input.noteId,
        subMindMapId: null,
        positionX: input.position.x,
        positionY: input.position.y,
      };
      testWindow.__COMMONPLACE_TEST_MAP_NODES__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []),
        node,
      ];
      return {
        ok: true as const,
        node: {
          id: node.id,
          nodeKind: "note" as const,
          noteId: note.id,
          positionX: node.positionX,
          positionY: node.positionY,
          noteShortcode: note.shortcode,
          noteTitle: note.title,
          noteSourceBook: note.sourceBook,
          noteTags: note.tags,
        },
      };
    },
    async createMainMapClusterNode(
      ownerId: string,
      input: {
        mainMapId: string;
        subMindmapId: string;
        position: { x: number; y: number };
      },
    ) {
      const mainMap = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === input.mainMapId &&
          candidate.type === "main",
      );
      const subMap = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === input.subMindmapId &&
          candidate.type === "sub",
      );
      if (!mainMap || !subMap) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }
      if (
        !Number.isFinite(input.position.x) ||
        !Number.isFinite(input.position.y)
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const nextIndex =
        (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []).filter(
          (node) => node.nodeKind === "cluster",
        ).length + 1;
      const node: TestMapNode = {
        id: `main-cluster-created-${nextIndex}`,
        ownerId,
        mapId: input.mainMapId,
        nodeKind: "cluster",
        noteId: null,
        subMindMapId: input.subMindmapId,
        positionX: input.position.x,
        positionY: input.position.y,
      };
      testWindow.__COMMONPLACE_TEST_MAP_NODES__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []),
        node,
      ];
      return {
        ok: true as const,
        node: {
          id: node.id,
          nodeKind: "cluster" as const,
          subMindMapId: subMap.id,
          subMindMapTitle: subMap.title,
          subMindMapUpdatedAt: subMap.updatedAt,
          positionX: node.positionX,
          positionY: node.positionY,
        },
      };
    },
    async deleteMainMapNode(
      ownerId: string,
      mainMapId: string,
      nodeId: string,
    ) {
      testWindow.__COMMONPLACE_TEST_MAP_NODES__ = (
        testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? []
      ).filter(
        (node) =>
          node.ownerId !== ownerId ||
          node.mapId !== mainMapId ||
          node.id !== nodeId,
      );
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = (
        testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? []
      ).filter(
        (edge) =>
          edge.ownerId !== ownerId ||
          edge.mapId !== mainMapId ||
          (edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
      );
      return { ok: true as const };
    },
    async listSubMapEdges(ownerId: string, mindMapId: string) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === mindMapId &&
          candidate.type === "sub",
      );
      if (!map) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      return {
        ok: true as const,
        edges: (testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [])
          .filter(
            (edge) =>
              edge.ownerId === ownerId &&
              edge.mapId === mindMapId,
          )
          .map((edge) => ({
            id: edge.id,
            mapId: edge.mapId,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            edgeType: edge.edgeType,
            label: edge.label,
          })),
      };
    },
    async listMainMapEdges(ownerId: string, mainMapId: string) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === mainMapId &&
          candidate.type === "main",
      );
      if (!map) {
        return { ok: false as const, error: "commonplace_not_found" as const };
      }

      return {
        ok: true as const,
        edges: (testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [])
          .filter(
            (edge) =>
              edge.ownerId === ownerId &&
              edge.mapId === mainMapId,
          )
          .map((edge) => ({
            id: edge.id,
            mapId: edge.mapId,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            edgeType: edge.edgeType,
            label: edge.label,
          })),
      };
    },
    async createSubMapEdge(
      ownerId: string,
      input: {
        mapId: string;
        sourceNodeId: string;
        targetNodeId: string;
        edgeType: "solid" | "dashed";
        label?: string | null;
      },
    ) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === input.mapId &&
          candidate.type === "sub",
      );
      const nodes = testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [];
      const sourceNode = nodes.find(
        (node) =>
          node.ownerId === ownerId &&
          node.mapId === input.mapId &&
          node.id === input.sourceNodeId &&
          node.nodeKind === "note",
      );
      const targetNode = nodes.find(
        (node) =>
          node.ownerId === ownerId &&
          node.mapId === input.mapId &&
          node.id === input.targetNodeId &&
          node.nodeKind === "note",
      );
      if (
        !map ||
        !sourceNode ||
        !targetNode ||
        sourceNode.id === targetNode.id ||
        (input.edgeType !== "solid" && input.edgeType !== "dashed")
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const edge: TestMapEdge = {
        id: `sub-edge-${(testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? []).length + 1}`,
        ownerId,
        mapId: input.mapId,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        edgeType: input.edgeType,
        label: input.label?.trim() || null,
      };
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? []),
        edge,
      ];
      return { ok: true as const, edge };
    },
    async createMainMapEdge(
      ownerId: string,
      input: {
        mainMapId: string;
        sourceNodeId: string;
        targetNodeId: string;
        edgeType: "solid" | "dashed";
        label?: string | null;
      },
    ) {
      const map = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId &&
          candidate.id === input.mainMapId &&
          candidate.type === "main",
      );
      const nodes = testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [];
      const sourceNode = nodes.find(
        (node) =>
          node.ownerId === ownerId &&
          node.mapId === input.mainMapId &&
          node.id === input.sourceNodeId &&
          (node.nodeKind === "cluster" || node.nodeKind === "note"),
      );
      const targetNode = nodes.find(
        (node) =>
          node.ownerId === ownerId &&
          node.mapId === input.mainMapId &&
          node.id === input.targetNodeId &&
          (node.nodeKind === "cluster" || node.nodeKind === "note"),
      );
      if (
        !map ||
        !sourceNode ||
        !targetNode ||
        sourceNode.id === targetNode.id ||
        (input.edgeType !== "solid" && input.edgeType !== "dashed")
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const nextIndex =
        Math.max(
          0,
          ...(testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [])
            .map((edge) => /^main-edge-(\d+)$/.exec(edge.id)?.[1])
            .filter((value): value is string => Boolean(value))
            .map((value) => Number(value)),
        ) + 1;
      const edge: TestMapEdge = {
        id: `main-edge-${nextIndex}`,
        ownerId,
        mapId: input.mainMapId,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        edgeType: input.edgeType,
        label: input.label?.trim() || null,
      };
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = [
        ...(testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? []),
        edge,
      ];
      return { ok: true as const, edge };
    },
    async updateSubMapEdge(
      ownerId: string,
      input: {
        mapId: string;
        edgeId: string;
        edgeType?: "solid" | "dashed" | null;
        label?: string | null;
      },
    ) {
      const edges = testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [];
      const edgeIndex = edges.findIndex(
        (edge) =>
          edge.ownerId === ownerId &&
          edge.mapId === input.mapId &&
          edge.id === input.edgeId,
      );
      if (
        edgeIndex < 0 ||
        (input.edgeType !== undefined &&
          input.edgeType !== null &&
          input.edgeType !== "solid" &&
          input.edgeType !== "dashed")
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const updated: TestMapEdge = {
        ...edges[edgeIndex],
        edgeType: input.edgeType ?? edges[edgeIndex].edgeType,
        label:
          Object.prototype.hasOwnProperty.call(input, "label")
            ? input.label?.trim() || null
            : edges[edgeIndex].label,
      };
      edges[edgeIndex] = updated;
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = edges;
      return { ok: true as const, edge: updated };
    },
    async updateMainMapEdge(
      ownerId: string,
      input: {
        mainMapId: string;
        edgeId: string;
        edgeType?: "solid" | "dashed" | null;
        label?: string | null;
      },
    ) {
      const edges = testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [];
      const edgeIndex = edges.findIndex(
        (edge) =>
          edge.ownerId === ownerId &&
          edge.mapId === input.mainMapId &&
          edge.id === input.edgeId,
      );
      if (
        edgeIndex < 0 ||
        (input.edgeType !== undefined &&
          input.edgeType !== null &&
          input.edgeType !== "solid" &&
          input.edgeType !== "dashed")
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
      }

      const updated: TestMapEdge = {
        ...edges[edgeIndex],
        edgeType: input.edgeType ?? edges[edgeIndex].edgeType,
        label:
          Object.prototype.hasOwnProperty.call(input, "label")
            ? input.label?.trim() || null
            : edges[edgeIndex].label,
      };
      edges[edgeIndex] = updated;
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = edges;
      return { ok: true as const, edge: updated };
    },
    async deleteSubMapEdge(
      ownerId: string,
      mindMapId: string,
      edgeId: string,
    ) {
      const before = testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [];
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = before.filter(
        (edge) =>
          edge.ownerId !== ownerId ||
          edge.mapId !== mindMapId ||
          edge.id !== edgeId,
      );
      return { ok: true as const };
    },
    async deleteMainMapEdge(
      ownerId: string,
      mainMapId: string,
      edgeId: string,
    ) {
      const before = testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [];
      testWindow.__COMMONPLACE_TEST_MAP_EDGES__ = before.filter(
        (edge) =>
          edge.ownerId !== ownerId ||
          edge.mapId !== mainMapId ||
          edge.id !== edgeId,
      );
      return { ok: true as const };
    },
  };
}

async function gotoApp(page: Page) {
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

  await page.goto("/", { waitUntil: "domcontentloaded" });
}

async function dragSidebarNoteToCanvas(
  page: Page,
  noteText: string,
  offsetX: number,
  offsetY: number,
) {
  const note = page
    .getByTestId("commonplace-sidebar-note-list")
    .getByTestId("commonplace-sidebar-note")
    .filter({ hasText: noteText })
    .first();
  const canvas = page.locator(".react-flow").first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await note.dispatchEvent("dragstart", { dataTransfer });
  await canvas.dispatchEvent("dragover", {
    dataTransfer,
    clientX: canvasBox.x + offsetX,
    clientY: canvasBox.y + offsetY,
  });
  await expect(page.getByTestId("commonplace-map-drop-zone")).toBeVisible();
  await canvas.dispatchEvent("drop", {
    dataTransfer,
    clientX: canvasBox.x + offsetX,
    clientY: canvasBox.y + offsetY,
  });
  await expect(page.getByTestId("commonplace-map-drop-zone")).toHaveCount(0);
}

async function readSidebarNoteDragData(note: Locator) {
  return note.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    const event = new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    element.dispatchEvent(event);

    return {
      defaultPrevented: event.defaultPrevented,
      effectAllowed: dataTransfer.effectAllowed,
      types: Array.from(dataTransfer.types),
      payload: dataTransfer.getData("application/commonplace-note"),
      plainText: dataTransfer.getData("text/plain"),
    };
  });
}

async function openFlowNodeContextMenu(node: Locator) {
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await node.dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    buttons: 2,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
}

async function clickFlowNode(node: Locator) {
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await node.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
}

async function selectFlowNode(page: Page, node: Locator) {
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function clickConnectIdea(page: Page) {
  const connectIdea = page.getByTestId("commonplace-map-connect-idea");
  await expect(connectIdea).toBeVisible();
  await connectIdea.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
  });
}

async function clickConnectVisualNode(page: Page) {
  const connectVisualNode = page.getByTestId("commonplace-map-connect-visual-node");
  await expect(connectVisualNode).toBeVisible();
  await connectVisualNode.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
  });
}

test.describe("Commonplace Phase 1B form and detail", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installCommonplaceTestAdapter, [
      baseNote({
        id: "note-1",
        quote: "Institutions are the rules of the game.",
        connections: ["#tf1"],
        relevance: "Useful for explaining how incentives shape outcomes.",
      }),
      baseNote({
        id: "note-2",
        shortcode: "#tf1",
        sourceBook: "Thinking Fast and Slow",
        title: "System One Attention",
        insight: "System 1 operates automatically with little effort.",
        tags: ["psychology", "cognition"],
      }),
    ]);
  });

  test("enters Commonplace as a mode switch and returns to the previous Fonetik view", async ({
    page,
  }) => {
    await gotoApp(page);

    await page.getByRole("button", { name: "Vocabulary Notebook" }).click();
    await expect(page.locator("h1", { hasText: "Vocabulary Notebook" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Vocabulary Notebook");

    await page.getByRole("button", { name: "Commonplace" }).click();

    await expect(page.getByTestId("commonplace-view")).toBeVisible();
    await expect(page.getByTestId("commonplace-sidebar")).toBeVisible();
    await expect(page.getByTestId("commonplace-sidebar")).toContainText("LIBRARY");
    await expect(page.locator("aside").filter({ hasText: "Active Session" })).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Kembali ke Fonetik/ })).toBeVisible();

    await page.getByRole("button", { name: /Kembali ke Fonetik/ }).click();
    await expect(page.locator("h1", { hasText: "Vocabulary Notebook" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Vocabulary Notebook");
  });

  test("Library is default and exposes grid, Add Note tile, and Main Maps registry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.getByText("LIBRARY").first()).toBeVisible();
    await expect(
      page.getByTestId("commonplace-view").getByRole("heading", { name: "Commonplace" }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("commonplace-view").getByText(/Capture book ideas/i),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("commonplace-view").getByText(/FONETIK\s*·\s*COMMONPLACE/i),
    ).toHaveCount(0);
    await expect(page.getByTestId("commonplace-library-grid")).toBeVisible();
    await expect(
      page
        .getByTestId("commonplace-sidebar-note-list")
        .getByTestId("commonplace-sidebar-note")
        .first(),
    ).toHaveAttribute("draggable", "false");
    const librarySidebarDragData = await readSidebarNoteDragData(
      page
        .getByTestId("commonplace-sidebar-note-list")
        .getByTestId("commonplace-sidebar-note")
        .first(),
    );
    expect(librarySidebarDragData.defaultPrevented).toBe(true);
    expect(librarySidebarDragData.types).not.toContain("application/commonplace-note");
    await expect(page.locator(".react-flow")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Tambah note/i })).toBeVisible();
    const firstCard = page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i });
    const secondCard = page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /System One Attention/i });
    const addNoteTile = page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Tambah note/i });
    await expect(firstCard).toContainText("Why Nations Fail");
    await expect(firstCard).toContainText(
      "Inclusive institutions create stronger incentives for growth.",
    );
    await expect(firstCard).toContainText("#wn1");
    await expect(firstCard).toContainText("#politics");
    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.height).toBeLessThan(190);
    expect(cardBox?.width).toBeLessThan(220);
    const firstShortcodeBox = await firstCard.getByText("#wn1").boundingBox();
    expect((firstShortcodeBox?.x ?? 0) + (firstShortcodeBox?.width ?? 0)).toBeLessThanOrEqual(
      (cardBox?.x ?? 0) + (cardBox?.width ?? 0) + 1,
    );
    expect((firstShortcodeBox?.y ?? 0) + (firstShortcodeBox?.height ?? 0)).toBeLessThanOrEqual(
      (cardBox?.y ?? 0) + (cardBox?.height ?? 0) + 1,
    );
    const cardSpacing = await page
      .getByTestId("commonplace-library-grid")
      .evaluate((grid) => {
        const cardGrid = grid.querySelector(".grid");
        if (!cardGrid) return { columnGap: 0, rowGap: 0 };
        const styles = window.getComputedStyle(cardGrid);
        return {
          columnGap: Number.parseFloat(styles.columnGap),
          rowGap: Number.parseFloat(styles.rowGap),
        };
      });
    expect(cardSpacing.columnGap).toBeGreaterThanOrEqual(20);
    expect(cardSpacing.rowGap).toBeGreaterThanOrEqual(20);
    await expect(secondCard).toBeVisible();
    await expect(addNoteTile).toBeVisible();
    const secondCardBox = await secondCard.boundingBox();
    const addNoteBox = await addNoteTile.boundingBox();
    expect((addNoteBox?.x ?? 0) - ((secondCardBox?.x ?? 0) + (secondCardBox?.width ?? 0))).toBeGreaterThanOrEqual(12);
    const workspaceBox = await page.getByTestId("commonplace-view").boundingBox();
    const viewport = page.viewportSize();
    expect(workspaceBox?.height).toBeLessThanOrEqual((viewport?.height ?? 768) + 1);
    expect(workspaceBox?.y).toBeLessThanOrEqual(20);

    await page.getByTestId("commonplace-main-maps-btn").click();
    await expect(page.getByTestId("commonplace-main-maps-registry")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Main Maps" })).toBeVisible();
    await expect(page.getByText("Institutions Overview")).toBeVisible();

    await page.getByLabel("New Main Map title").fill("Comparative Institutions");
    await page.getByRole("button", { name: "+ New Main Map" }).click();
    await expect(page.getByText("Comparative Institutions")).toBeVisible();

    const newMapCard = page.locator("article").filter({
      hasText: "Comparative Institutions",
    });
    await newMapCard.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Rename Comparative Institutions").fill("Institutions Map");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Institutions Map")).toBeVisible();

    await page
      .locator("article")
      .filter({ hasText: "Institutions Map" })
      .getByRole("button", { name: "Open" })
      .click();
    await expect(page.getByTestId("commonplace-map-canvas")).toBeVisible();
    await expect(
      page
        .getByTestId("commonplace-sidebar-note-list")
        .getByTestId("commonplace-sidebar-note")
        .first(),
    ).toHaveAttribute("draggable", "true");
    await expect(page.locator(".react-flow")).toHaveCount(1);
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();
    await page.getByRole("button", { name: "fit view" }).click();
    const mainCanvasStyle = await page
      .getByTestId("commonplace-map-canvas")
      .evaluate((element) => {
        const panel = element.querySelector(".react-flow")?.parentElement;
        const controls = element.querySelector(".react-flow__controls");
        const styles = panel ? window.getComputedStyle(panel) : null;
        const controlStyles = controls
          ? window.getComputedStyle(controls)
          : null;
        return {
          backgroundColor: styles?.backgroundColor ?? "",
          controlsPointerEvents: controlStyles?.pointerEvents ?? "",
          controlsZIndex: controlStyles?.zIndex ?? "",
        };
      });
    expect(mainCanvasStyle.backgroundColor).not.toBe("rgb(255, 255, 255)");
    expect(mainCanvasStyle.controlsPointerEvents).not.toBe("none");
    await expect(page.getByTestId("commonplace-map-bubble-background")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-main-background")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-empty-state")).toContainText(
      "Add a saved Sub Mind Map as a cluster, or drag notes from the sidebar.",
    );
    await expect(page.getByText("Clusters organize saved sub maps. Notes are individual ideas.")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-note-drag-guidance")).toHaveText(
      "Drag notes from the sidebar",
    );
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeDisabled();
    const inventory = page.getByTestId("commonplace-map-inventory");
    await expect(inventory).toBeVisible();
    await expect(inventory).toContainText("Inventory");
    await expect(inventory).toContainText("Saved maps");
    await expect(inventory).toContainText("Open saved maps");
    await expect(inventory).toContainText("Main Maps");
    await expect(inventory).toContainText("Sub Mind Maps");
    await expect(inventory).toContainText("Institutions Overview");
    await expect(inventory).toContainText("Comparative Politics Map");
    await expect(inventory).toContainText("Institutional Incentives");
    await expect(inventory).toContainText("Cognitive Systems");
    await expect(inventory).not.toContainText("Laci");
    await expect(inventory).not.toContainText("Drawer");
    await expect(inventory).not.toContainText("Map Shelf");
    await expect(
      inventory.getByTestId("commonplace-map-inventory-item").filter({
        hasText: "Institutions Map",
      }),
    ).toHaveAttribute("data-active", "true");
    await expect(
      inventory.getByTestId("commonplace-map-inventory-item").filter({
        hasText: "Comparative Politics Map",
      }),
    ).toHaveAttribute("data-active", "false");
    await inventory
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Comparative Politics Map" })
      .click();
    await expect(
      page.locator("h2").filter({ hasText: "Comparative Politics Map" }),
    ).toBeVisible();
    await expect(page.getByTestId("commonplace-map-main-background")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-empty-state")).toContainText(
      "Add a saved Sub Mind Map as a cluster, or drag notes from the sidebar.",
    );
    await expect(
      page
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Comparative Politics Map" }),
    ).toHaveAttribute("data-active", "true");
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Institutional Incentives" })
      .click();
    await expect(
      page.locator("h2").filter({ hasText: "Institutional Incentives" }),
    ).toBeVisible();
    await expect(page.getByText("Sub Mind Map", { exact: true })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-bubble-background")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Institutions and Growth",
    );
    await expect(
      page
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Institutional Incentives" }),
    ).toHaveAttribute("data-active", "true");
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Cognitive Systems" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Cognitive Systems" })).toBeVisible();
    await expect(page.getByText("Sub Mind Map", { exact: true })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "System One Attention",
    );
    await expect(
      page
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Cognitive Systems" }),
    ).toHaveAttribute("data-active", "true");
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Institutions Map" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Institutions Map" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-main-background")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-add-cluster-button")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-add-cluster-button")).toHaveText(
      "+ Add cluster",
    );
    await page.getByTestId("commonplace-map-add-cluster-button").click();
    await expect(page.getByTestId("commonplace-map-cluster-chooser")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-cluster-chooser")).toContainText(
      "Choose a saved Sub Mind Map to place as a cluster.",
    );
    await expect(
      page.getByTestId("commonplace-map-cluster-option").filter({
        hasText: "Institutional Incentives",
      }),
    ).toBeVisible();
    await page
      .getByTestId("commonplace-map-cluster-option")
      .filter({ hasText: "Institutional Incentives" })
      .click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-cluster-node").first()).toContainText(
      "Institutional Incentives",
    );
    await expect(page.getByTestId("commonplace-map-cluster-node").first()).toContainText(
      "Sub Map",
    );
    await expect(page.getByTestId("commonplace-map-cluster-node").first()).toContainText(
      "Cluster",
    );
    await expect(page.getByTestId("commonplace-map-cluster-node").first()).toContainText(
      "Saved Sub Mind Map cluster",
    );
    await expect(page.getByTestId("commonplace-map-cluster-node").first()).toHaveAttribute(
      "data-node-kind",
      "cluster",
    );
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toHaveText(
      "Save",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeEnabled();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("unsaved map changes");
      await dialog.dismiss();
    });
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Comparative Politics Map" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Institutions Map" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    if ((await page.getByTestId("commonplace-map-cluster-chooser").count()) === 0) {
      await page.getByTestId("commonplace-map-add-cluster-button").click();
    }
    await expect(page.getByTestId("commonplace-map-cluster-chooser")).toBeVisible();
    await page
      .getByTestId("commonplace-map-cluster-option")
      .filter({ hasText: "Institutional Incentives" })
      .click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);

    const firstClusterNode = page.getByTestId("rf__node-main-cluster-created-2");
    const clusterPositionsBeforeMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
      };

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) => node.nodeKind === "cluster")
        .map((node) => ({
          id: node.id,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    const firstClusterBox = await firstClusterNode.boundingBox();
    expect(firstClusterBox).not.toBeNull();
    const canvasBoxForClusterDrag = await page.locator(".react-flow").first().boundingBox();
    expect(canvasBoxForClusterDrag).not.toBeNull();
    if (canvasBoxForClusterDrag) {
      await firstClusterNode.dragTo(page.locator(".react-flow").first(), {
        sourcePosition: { x: 42, y: 42 },
        targetPosition: {
          x: Math.min(canvasBoxForClusterDrag.width - 80, 420),
          y: Math.min(canvasBoxForClusterDrag.height - 80, 320),
        },
      });
    }
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-button")).toBeEnabled();
    await page.getByTestId("commonplace-map-save-button").click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeDisabled();
    const clusterPositionsAfterMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
      };

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) => node.nodeKind === "cluster")
        .map((node) => ({
          id: node.id,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    expect(clusterPositionsAfterMove).toHaveLength(2);
    expect(clusterPositionsAfterMove).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main-cluster-created-1",
        }),
        expect.objectContaining({
          id: "main-cluster-created-2",
        }),
      ]),
    );
    const movedClusters = clusterPositionsAfterMove.filter((node) => {
      const before = clusterPositionsBeforeMove.find(
        (candidate) => candidate.id === node.id,
      );
      return (
        before &&
        (before.positionX !== node.positionX ||
          before.positionY !== node.positionY)
      );
    });
    expect(movedClusters).toHaveLength(1);

    await page.getByRole("button", { name: "Back to Main Maps" }).click();
    await page
      .locator("article")
      .filter({ hasText: "Institutions Map" })
      .getByRole("button", { name: "Open" })
      .click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);
    await expect(page.getByTestId("commonplace-map-empty-state")).toHaveCount(0);
    await page
      .getByTestId("commonplace-map-cluster-open-submap")
      .first()
      .dispatchEvent("click", {
        bubbles: true,
        cancelable: true,
      });
    await expect(page.getByTestId("commonplace-map-canvas")).toBeVisible();
    await expect(page.locator("h2").filter({ hasText: "Institutional Incentives" })).toBeVisible();
    await expect(page.getByText("Sub Mind Map", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to Main Map" }).click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);

    const mainSourceCluster = page.getByTestId("rf__node-main-cluster-created-2");
    const mainTargetCluster = page.getByTestId("rf__node-main-cluster-created-1");
    await selectFlowNode(page, mainSourceCluster);
    await expect(
      mainSourceCluster.getByTestId("commonplace-map-cluster-node"),
    ).toHaveAttribute("data-selected", "true");
    await openFlowNodeContextMenu(mainSourceCluster);
    await expect(page.getByTestId("commonplace-map-node-context-menu")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-connect-visual-node")).toHaveText(
      "Connect visual nodes",
    );
    await clickConnectVisualNode(page);
    await expect(page.getByTestId("commonplace-map-connection-mode")).toContainText(
      "Click a target visual node",
    );
    await page.mouse.move(520, 360);
    await expect(page.getByTestId("commonplace-map-connection-preview")).toBeVisible();
    await clickFlowNode(mainTargetCluster);
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-label-input").fill("theme bridge");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".commonplace-map-edge--solid")).toHaveCount(1);
    await expect(page.getByText("theme bridge")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );

    await openFlowNodeContextMenu(mainTargetCluster);
    await clickConnectVisualNode(page);
    await clickFlowNode(mainSourceCluster);
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-type-select").selectOption("dashed");
    await page.getByTestId("commonplace-map-edge-label-input").fill("weak theme");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(1);
    await expect(page.getByText("weak theme")).toBeVisible();

    await page.getByTestId("commonplace-map-edge-label-main-edge-2").dispatchEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const mainEdgeEditPopover = page.getByTestId("commonplace-map-edge-edit-popover");
    await expect(mainEdgeEditPopover).toBeVisible();
    await mainEdgeEditPopover.getByLabel("Label").fill("revised theme");
    await mainEdgeEditPopover.getByLabel("Relationship type").selectOption("solid");
    await mainEdgeEditPopover.getByRole("button", { name: "Save" }).click();
    await expect(mainEdgeEditPopover).toHaveCount(0);
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(0);
    await expect(page.getByText("revised theme")).toBeVisible();
    const mainEdgesAfterEdit = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_EDGES__?: TestMapEdge[];
      };

      return testWindow.__COMMONPLACE_TEST_MAP_EDGES__ ?? [];
    });
    expect(mainEdgesAfterEdit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main-edge-2",
          edgeType: "solid",
          label: "revised theme",
        }),
      ]),
    );

    await page.getByRole("button", { name: "theme bridge" }).dispatchEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    await expect(page.getByTestId("commonplace-map-edge-edit-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-delete-button").click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);

    await page.getByRole("button", { name: "Back to Main Maps" }).click();
    await page
      .locator("article")
      .filter({ hasText: "Institutions Map" })
      .getByRole("button", { name: "Open" })
      .click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.getByText("revised theme")).toBeVisible();

    await expect(
      page
        .getByTestId("commonplace-sidebar-note-list")
        .getByTestId("commonplace-sidebar-note")
        .first(),
    ).toHaveAttribute("draggable", "true");
    await dragSidebarNoteToCanvas(page, "Institutions and Growth", 170, 220);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Institutions and Growth",
    );
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Why Nations Fail",
    );
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "#wn1",
    );
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Library Note",
    );
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Visual idea",
    );
    await expect(page.getByTestId("commonplace-map-note-node").first()).toHaveAttribute(
      "data-node-kind",
      "note",
    );
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeEnabled();
    await dragSidebarNoteToCanvas(page, "Institutions and Growth", 320, 300);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(2);
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    const notePositionsBeforeMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
        __COMMONPLACE_TEST_MAPS__?: TestMap[];
      };
      const mainMapId = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (map) => map.type === "main" && map.title === "Institutions Map",
      )?.id;

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) => node.nodeKind === "note" && node.mapId === mainMapId)
        .map((node) => ({
          id: node.id,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    const firstMainNoteNode = page.getByTestId("rf__node-main-note-created-1");
    const movedMainNoteNode = page.getByTestId("rf__node-main-note-created-2");
    const firstMainNoteBox = await movedMainNoteNode.boundingBox();
    expect(firstMainNoteBox).not.toBeNull();
    const canvasBoxForNoteDrag = await page.locator(".react-flow").first().boundingBox();
    expect(canvasBoxForNoteDrag).not.toBeNull();
    if (canvasBoxForNoteDrag) {
      await movedMainNoteNode.dragTo(page.locator(".react-flow").first(), {
        sourcePosition: { x: 36, y: 36 },
        targetPosition: {
          x: Math.min(canvasBoxForNoteDrag.width - 80, 520),
          y: Math.min(canvasBoxForNoteDrag.height - 80, 380),
        },
      });
    }
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await page.evaluate(() => {
      (
        window as typeof window & {
          __COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__?: boolean;
        }
      ).__COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__ = true;
    });
    await page.getByTestId("commonplace-map-save-button").click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Save failed",
    );
    await expect(
      page.getByText("Could not save map. Please try again. Your local changes are still visible."),
    ).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-button")).toBeEnabled();
    await page.evaluate(() => {
      (
        window as typeof window & {
          __COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__?: boolean;
        }
      ).__COMMONPLACE_FORCE_POSITION_SAVE_FAILURE__ = false;
    });
    await page.getByTestId("commonplace-map-save-button").click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-save-button")).toBeDisabled();
    const notePositionsAfterMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
        __COMMONPLACE_TEST_MAPS__?: TestMap[];
      };
      const mainMapId = (testWindow.__COMMONPLACE_TEST_MAPS__ ?? []).find(
        (map) => map.type === "main" && map.title === "Institutions Map",
      )?.id;

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) => node.nodeKind === "note" && node.mapId === mainMapId)
        .map((node) => ({
          id: node.id,
          noteId: node.noteId,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    expect(notePositionsAfterMove).toHaveLength(2);
    expect(notePositionsAfterMove).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main-note-created-1",
          noteId: "note-1",
        }),
        expect.objectContaining({
          id: "main-note-created-2",
          noteId: "note-1",
        }),
      ]),
    );
    const movedMainNotes = notePositionsAfterMove.filter((node) => {
      const before = notePositionsBeforeMove.find(
        (candidate) => candidate.id === node.id,
      );
      return (
        before &&
        (before.positionX !== node.positionX ||
          before.positionY !== node.positionY)
      );
    });
    expect(movedMainNotes).toHaveLength(1);
    await selectFlowNode(page, movedMainNoteNode);
    await expect(
      movedMainNoteNode.getByTestId("commonplace-map-note-node"),
    ).toHaveAttribute("data-selected", "true");
    await openFlowNodeContextMenu(movedMainNoteNode);
    await expect(page.getByTestId("commonplace-map-node-context-menu")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-connect-visual-node")).toHaveText(
      "Connect visual nodes",
    );
    await expect(page.getByTestId("commonplace-map-delete-visual-node")).toHaveText(
      "Delete visual note",
    );
    await page
      .getByTestId("commonplace-map-node-context-menu")
      .getByRole("button", { name: "Cancel" })
      .click();
    const secondMainNoteNode = firstMainNoteNode;

    await openFlowNodeContextMenu(page.getByTestId("rf__node-main-cluster-created-1"));
    await clickConnectVisualNode(page);
    await clickFlowNode(movedMainNoteNode);
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-label-input").fill("cluster note link");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    await expect(page.getByText("cluster note link")).toBeVisible();

    await openFlowNodeContextMenu(movedMainNoteNode);
    await clickConnectVisualNode(page);
    await clickFlowNode(page.getByTestId("rf__node-main-cluster-created-2"));
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-type-select").selectOption("dashed");
    await page.getByTestId("commonplace-map-edge-label-input").fill("note cluster hint");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(1);
    await expect(page.getByText("note cluster hint")).toBeVisible();

    await openFlowNodeContextMenu(movedMainNoteNode);
    await clickConnectVisualNode(page);
    await clickFlowNode(secondMainNoteNode);
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-label-input").fill("note pair link");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(4);
    await expect(page.getByText("note pair link")).toBeVisible();

    await page.getByRole("button", { name: "note pair link" }).dispatchEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const mixedEdgeEditPopover = page.getByTestId("commonplace-map-edge-edit-popover");
    await expect(mixedEdgeEditPopover).toBeVisible();
    await mixedEdgeEditPopover.getByLabel("Relationship type").selectOption("dashed");
    await mixedEdgeEditPopover.getByLabel("Label").fill("revised note pair");
    await mixedEdgeEditPopover.getByRole("button", { name: "Save" }).click();
    await expect(mixedEdgeEditPopover).toHaveCount(0);
    await expect(page.getByText("revised note pair")).toBeVisible();
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(2);

    await page.getByRole("button", { name: "cluster note link" }).dispatchEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    await expect(page.getByTestId("commonplace-map-edge-edit-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-delete-button").click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    await expect(page.getByText("cluster note link")).toHaveCount(0);

    await page.getByRole("button", { name: "Back to Main Maps" }).click();
    await page
      .locator("article")
      .filter({ hasText: "Institutions Map" })
      .getByRole("button", { name: "Open" })
      .click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(2);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    await expect(page.getByText("note cluster hint")).toBeVisible();
    await expect(page.getByText("revised note pair")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Institutions and Growth",
    );
    await openFlowNodeContextMenu(page.getByTestId("rf__node-main-note-created-2"));
    await page.getByTestId("commonplace-map-delete-visual-node").click();
    await expect(page.getByTestId("commonplace-map-node-delete-confirm")).toContainText(
      "Delete visual note?",
    );
    await expect(page.getByTestId("commonplace-map-node-delete-confirm")).toContainText(
      "The original Library note will remain.",
    );
    await page.getByTestId("commonplace-map-node-delete-confirm-button").click();
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "Institutions and Growth",
    );
    await expect(page.getByTestId("commonplace-sidebar-note-list")).toContainText(
      "Institutions and Growth",
    );
    const visualNotesAfterDelete = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
        __COMMONPLACE_TEST_NOTES__?: TestNote[];
      };

      return {
        visualNoteIds: (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
          .filter((node) => node.nodeKind === "note")
          .map((node) => node.id),
        libraryNoteExists: (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).some(
          (note) => note.id === "note-1",
        ),
      };
    });
    expect(visualNotesAfterDelete.visualNoteIds).toContain("main-note-created-1");
    expect(visualNotesAfterDelete.visualNoteIds).not.toContain("main-note-created-2");
    expect(visualNotesAfterDelete.libraryNoteExists).toBe(true);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.getByText("note cluster hint")).toHaveCount(0);
    await expect(page.getByText("revised note pair")).toHaveCount(0);

    await openFlowNodeContextMenu(page.getByTestId("rf__node-main-cluster-created-1"));
    await page.getByTestId("commonplace-map-delete-visual-node").click();
    await expect(page.getByTestId("commonplace-map-node-delete-confirm")).toContainText(
      "Delete visual cluster?",
    );
    await expect(page.getByTestId("commonplace-map-node-delete-confirm")).toContainText(
      "The referenced Sub Mind Map will remain.",
    );
    await page.getByTestId("commonplace-map-node-delete-confirm-button").click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await expect(page.getByText("revised theme")).toHaveCount(0);
    await page
      .getByTestId("commonplace-map-cluster-open-submap")
      .first()
      .dispatchEvent("click", {
        bubbles: true,
        cancelable: true,
      });
    await expect(page.locator("h2").filter({ hasText: "Institutional Incentives" })).toBeVisible();
    await page.getByRole("button", { name: "Back to Main Map" }).click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(1);

    await openFlowNodeContextMenu(page.getByTestId("rf__node-main-cluster-created-2"));
    await page.getByTestId("commonplace-map-delete-visual-node").click();
    await page.getByTestId("commonplace-map-node-delete-confirm-button").click();
    await expect(page.getByTestId("commonplace-map-cluster-node")).toHaveCount(0);
    await openFlowNodeContextMenu(page.getByTestId("rf__node-main-note-created-1"));
    await page.getByTestId("commonplace-map-delete-visual-node").click();
    await page.getByTestId("commonplace-map-node-delete-confirm-button").click();
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-empty-state")).toContainText(
      "Add a saved Sub Mind Map as a cluster, or drag notes from the sidebar.",
    );
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText(/connect idea/i)).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-inventory")).toContainText("Saved maps");

    await page.getByRole("button", { name: "Back to Main Maps" }).click();
    await page
      .locator("article")
      .filter({ hasText: "Institutions Map" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Delete this map?")).toBeVisible();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText("Institutions Map")).toHaveCount(0);

    await page.getByRole("button", { name: "← Library" }).click();
    await expect(page.getByTestId("commonplace-library-grid")).toBeVisible();
  });

  test("Inventory stays map-scoped and confirms dirty map switching", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await expect(page.getByTestId("commonplace-library-grid")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-inventory")).toHaveCount(0);

    await page.getByRole("button", { name: "+ Baru" }).click();
    await expect(page.getByRole("heading", { name: "Create note" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-inventory")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Institutions and Growth" }),
    ).toBeVisible();
    await expect(page.getByTestId("commonplace-map-inventory")).toHaveCount(0);
    await page.getByRole("button", { name: /Library/ }).click();

    await page.getByTestId("commonplace-main-maps-btn").click();
    await page
      .locator("article")
      .filter({ hasText: "Institutions Overview" })
      .getByRole("button", { name: "Open" })
      .click();

    const inventory = page.getByTestId("commonplace-map-inventory");
    await expect(inventory).toBeVisible();
    await expect(inventory).toContainText("Inventory");
    await expect(inventory).toContainText("Saved maps");
    await expect(inventory).not.toContainText("Laci");
    await expect(inventory).not.toContainText("Drawer");
    await expect(
      inventory
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Institutions Overview" }),
    ).toHaveAttribute("data-active", "true");

    await inventory
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Comparative Politics Map" })
      .click();
    await expect(
      page.locator("h2").filter({ hasText: "Comparative Politics Map" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Comparative Politics Map" }),
    ).toHaveAttribute("data-active", "true");

    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Institutional Incentives" })
      .click();
    await expect(
      page.locator("h2").filter({ hasText: "Institutional Incentives" }),
    ).toBeVisible();
    await expect(page.getByText("Sub Mind Map", { exact: true })).toBeVisible();

    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Cognitive Systems" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Cognitive Systems" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-note-node").first()).toContainText(
      "System One Attention",
    );
    await expect(
      page
        .getByTestId("commonplace-map-inventory-item")
        .filter({ hasText: "Cognitive Systems" }),
    ).toHaveAttribute("data-active", "true");

    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Institutions Overview" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Institutions Overview" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-main-background")).toHaveCount(1);
    await page.getByRole("button", { name: "fit view" }).click();

    await page.getByTestId("commonplace-map-add-cluster-button").click();
    await page
      .getByTestId("commonplace-map-cluster-option")
      .filter({ hasText: "Institutional Incentives" })
      .click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("unsaved map changes");
      await dialog.dismiss();
    });
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Comparative Politics Map" })
      .click();
    await expect(page.locator("h2").filter({ hasText: "Institutions Overview" })).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("unsaved map changes");
      await dialog.accept();
    });
    await page
      .getByTestId("commonplace-map-inventory-item")
      .filter({ hasText: "Comparative Politics Map" })
      .click();
    await expect(
      page.locator("h2").filter({ hasText: "Comparative Politics Map" }),
    ).toBeVisible();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText("Saved");
  });

  test("Library keeps a viewport-bounded frame while grid and sidebar scroll internally", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(installCommonplaceTestAdapter, manyLibraryNotes(24));
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    const workspaceMetrics = await page
      .getByTestId("commonplace-view")
      .evaluate((element) => ({
        bottom: element.getBoundingClientRect().bottom,
        height: element.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
      }));
    expect(workspaceMetrics.height).toBeLessThanOrEqual(
      workspaceMetrics.viewportHeight,
    );

    const gridMetrics = await page
      .getByTestId("commonplace-library-grid")
      .evaluate((element) => ({
        bottom: element.getBoundingClientRect().bottom,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: window.getComputedStyle(element).overflowY,
      }));
    expect(gridMetrics.overflowY).toBe("auto");
    expect(gridMetrics.clientHeight).toBeGreaterThan(430);
    expect(gridMetrics.scrollHeight).toBeGreaterThan(gridMetrics.clientHeight);
    expect(gridMetrics.bottom).toBeLessThanOrEqual(workspaceMetrics.bottom);

    const sidebarMetrics = await page
      .getByTestId("commonplace-sidebar-scroll")
      .evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: window.getComputedStyle(element).overflowY,
      }));
    expect(sidebarMetrics.overflowY).toBe("auto");
    expect(sidebarMetrics.scrollHeight).toBeGreaterThan(
      sidebarMetrics.clientHeight,
    );

    await page.getByTestId("commonplace-library-grid").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole("button", { name: "+ Baru" })).toBeVisible();
    await expect(page.getByLabel("Search notes")).toBeVisible();
  });

  test("+ Baru and Add Note tile open the in-place form with required field validation", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page.getByRole("button", { name: "+ Baru" }).click();
    await expect(page.getByRole("heading", { name: "Create note" })).toBeVisible();
    await expect(page.getByLabel("Quote")).toBeVisible();
    await expect(page.getByLabel("Insight")).toBeVisible();
    await expect(page.getByLabel("Connections")).toBeVisible();
    await expect(page.getByLabel("Relevance")).toBeVisible();
    await page.getByRole("button", { name: "Save note" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Save note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Source book is required.")).toBeVisible();
    await expect(page.getByText("Title is required.")).toBeVisible();
    await expect(page.getByText("Insight is required.")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: /Tambah note/i }).click();
    await expect(page.getByRole("heading", { name: "Create note" })).toBeVisible();

    await page.getByLabel("Source book").fill("Pedagogy of the Oppressed");
    await page.getByLabel("Title").fill("Dialogue and Agency");
    await page
      .getByLabel("Insight")
      .fill("Learners develop agency when dialogue becomes reciprocal.");
    await page.getByLabel("Tags").fill("education, agency");
    await page.getByLabel("Connections").fill("#wn1, not-a-shortcode");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByTestId("commonplace-library-grid")).toBeVisible();
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Dialogue and Agency",
    );

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Dialogue and Agency/i })
      .click();
    await expect(page.getByRole("heading", { name: "Dialogue and Agency" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("#po1");
    await expect(page.getByRole("article")).toContainText("#education");
    await expect(page.getByRole("article")).toContainText("#wn1");
    await expect(page.getByRole("article")).not.toContainText("not-a-shortcode");
  });

  test("created notes persist after leaving Commonplace and after page reload", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page.getByRole("button", { name: "+ Baru" }).click();
    await page.getByLabel("Source book").fill("Persistence Source");
    await page.getByLabel("Title").fill("Persistent Library Note");
    await page
      .getByLabel("Insight")
      .fill("A saved note should come back from persistent storage.");
    await page.getByLabel("Tags").fill("persistence, qa");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Persistent Library Note",
    );
    await expect(page.getByTestId("commonplace-sidebar-note-list")).toContainText(
      "Persistent Library Note",
    );

    await page.getByRole("button", { name: /Kembali ke Fonetik/ }).click();
    await page.getByRole("button", { name: "Commonplace" }).click();
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Persistent Library Note",
    );
    await expect(page.getByTestId("commonplace-sidebar-note-list")).toContainText(
      "Persistent Library Note",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Commonplace" }).click();
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Persistent Library Note",
    );

    await page.getByLabel("Search notes").fill("persistence");
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Persistent Library Note",
    );
    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Persistent Library Note/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Persistent Library Note" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toContainText("Persistence Source");
  });

  test("create failure does not leave a fake permanent note card", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_FORCE_CREATE_FAILURE__?: boolean;
      };
      testWindow.__COMMONPLACE_FORCE_CREATE_FAILURE__ = true;
    });

    await page.getByRole("button", { name: "+ Baru" }).click();
    await page.getByLabel("Source book").fill("Failed Persistence Source");
    await page.getByLabel("Title").fill("Failed Permanent Note");
    await page.getByLabel("Insight").fill("This note should never become permanent.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(
      page.getByText("Could not save this note. Please try again."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("commonplace-library-grid")).not.toContainText(
      "Failed Permanent Note",
    );
    await expect(page.getByTestId("commonplace-sidebar-note-list")).not.toContainText(
      "Failed Permanent Note",
    );
  });

  test("list failure shows a safe error instead of silently clearing state", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_FORCE_LIST_FAILURE__?: boolean;
      };
      testWindow.__COMMONPLACE_FORCE_LIST_FAILURE__ = true;
    });

    await page.getByRole("button", { name: "Commonplace" }).click();
    await expect(
      page.getByText("Could not load Commonplace notes. Please try again."),
    ).toBeVisible();
  });

  test("note cards and sidebar note items open the existing Detail Note behavior", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await expect(page.getByRole("heading", { name: "Institutions and Growth" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("#wn1");
    await expect(page.getByRole("article")).toContainText("Why Nations Fail");
    await expect(page.getByRole("article")).toContainText(
      "Inclusive institutions create stronger incentives for growth.",
    );
    await expect(
      page.getByText("Could not open that note. Please try again."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Library/ }).click();

    await page
      .getByTestId("commonplace-sidebar-note-list")
      .getByRole("button", { name: /System One Attention/i })
      .click();
    await expect(page.getByRole("heading", { name: "System One Attention" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("Thinking Fast and Slow");
    await expect(
      page.getByText("Could not open that note. Please try again."),
    ).toHaveCount(0);
  });

  test("visible note cards and sidebar items open from loaded note state when detail reads fail", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (
        window as typeof window & {
          __COMMONPLACE_FORCE_DETAIL_READ_FAILURE__?: boolean;
        }
      ).__COMMONPLACE_FORCE_DETAIL_READ_FAILURE__ = true;
    });
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await expect(page.getByRole("heading", { name: "Institutions and Growth" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("#wn1");
    await expect(page.getByRole("article")).toContainText("Why Nations Fail");
    await expect(
      page.getByText("Could not open that note. Please try again."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Library/ }).click();

    await page
      .getByTestId("commonplace-sidebar-note-list")
      .getByRole("button", { name: /System One Attention/i })
      .click();
    await expect(page.getByRole("heading", { name: "System One Attention" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("#tf1");
    await expect(page.getByRole("article")).toContainText("Thinking Fast and Slow");
    await expect(
      page.getByText("Could not open that note. Please try again."),
    ).toHaveCount(0);
  });

  test("Detail Note hides empty optional sections and opens Sub Mind Map chooser", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await expect(page.getByRole("article")).toContainText("Quote");
    await expect(page.getByRole("article")).toContainText("Relevance");
    await expect(page.getByRole("article")).toContainText("#tf1");

    await page.getByRole("article").getByRole("button", { name: "#tf1" }).click();
    await expect(page.getByRole("heading", { name: "System One Attention" })).toBeVisible();
    await expect(page.getByRole("article")).not.toContainText("Quote");
    await expect(page.getByRole("article")).not.toContainText("Relevance");
    await expect(page.getByRole("article")).not.toContainText("Connections");

    await page.getByTestId("commonplace-note-mind-map-btn").click();
    await expect(page.getByTestId("commonplace-sub-map-chooser")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose Sub Mind Map" })).toBeVisible();
    await expect(page.getByText("Institutional Incentives")).toBeVisible();

    await page.getByRole("button", { name: /Institutional Incentives/i }).click();
    await expect(page.getByTestId("commonplace-map-canvas")).toBeVisible();
    await expect(page.locator(".react-flow")).toHaveCount(1);
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-bubble-background")).toHaveCount(1);
    const bubbleBackground = await page
      .getByTestId("commonplace-map-bubble-background")
      .evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
          backgroundImage: styles.backgroundImage,
          pointerEvents: styles.pointerEvents,
        };
      });
    expect(bubbleBackground.backgroundImage).toContain("radial-gradient");
    expect(bubbleBackground.pointerEvents).toBe("none");
    await expect(page.getByText(/Opened from #tf1/i)).toBeVisible();
    const noteNode = page.getByTestId("commonplace-map-note-node");
    await expect(noteNode).toBeVisible();
    await expect(noteNode).toContainText("Institutions and Growth");
    await expect(noteNode).toContainText("Why Nations Fail");
    await expect(noteNode).toContainText("#wn1");
    await expect(noteNode).toContainText("#politics");
    await expect(page.getByTestId("commonplace-map-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );

    const subMapFlowNode = page.getByTestId("rf__node-sub-node-1");
    const nodeBox = await subMapFlowNode.boundingBox();
    expect(nodeBox).not.toBeNull();
    const subMapCanvasBox = await page.locator(".react-flow").first().boundingBox();
    expect(subMapCanvasBox).not.toBeNull();
    if (subMapCanvasBox) {
      await subMapFlowNode.dragTo(page.locator(".react-flow").first(), {
        sourcePosition: { x: 36, y: 36 },
        targetPosition: {
          x: Math.min(subMapCanvasBox.width - 80, 420),
          y: Math.min(subMapCanvasBox.height - 80, 320),
        },
      });
    }
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await page.getByTestId("commonplace-map-save-button").click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText(/connect idea/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Sub Mind Maps" }).click();

    await page.getByLabel("New Sub Mind Map title").fill("Attention Systems");
    await page.getByRole("button", { name: "+ New Sub Mind Map" }).click();
    await expect(page.getByText("Attention Systems")).toBeVisible();

    await page.getByRole("button", { name: /Attention Systems/i }).click();
    await expect(page.getByTestId("commonplace-map-canvas")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-empty-state")).toContainText(
      "Canvas is ready. Drag notes from the sidebar to add them here.",
    );
    await expect(page.getByText(/Opened from #tf1/i)).toBeVisible();
    await expect(page.locator(".react-flow")).toHaveCount(1);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(0);
    const draggableNote = page
      .getByTestId("commonplace-sidebar-note-list")
      .getByTestId("commonplace-sidebar-note")
      .filter({ hasText: "Institutions and Growth" })
      .first();
    await expect(draggableNote).toHaveAttribute("draggable", "true");
    const subMapSidebarDragData = await readSidebarNoteDragData(draggableNote);
    expect(subMapSidebarDragData.defaultPrevented).toBe(false);
    expect(subMapSidebarDragData.types).toContain("application/commonplace-note");
    expect(subMapSidebarDragData.plainText).toBe("#wn1");
    const subMapPayload = JSON.parse(subMapSidebarDragData.payload) as {
      noteId: string;
      title: string;
      sourceBook: string;
      shortcode: string;
      tags: string[];
    };
    expect(subMapPayload).toEqual({
      noteId: "note-1",
      title: "Institutions and Growth",
      sourceBook: "Why Nations Fail",
      shortcode: "#wn1",
      tags: ["politics", "economics", "institutions"],
    });

    await dragSidebarNoteToCanvas(page, "Institutions and Growth", 160, 200);
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(1);
    await expect(
      page.getByTestId("commonplace-map-note-node").first(),
    ).toContainText("Institutions and Growth");

    await dragSidebarNoteToCanvas(page, "Institutions and Growth", 420, 200);
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(2);

    const sourceNode = page.getByTestId("rf__node-sub-node-created-3");
    const targetNode = page.getByTestId("rf__node-sub-node-created-4");
    const duplicatePositionsBeforeMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
      };

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) =>
          ["sub-node-created-3", "sub-node-created-4"].includes(node.id),
        )
        .map((node) => ({
          id: node.id,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    const sourceDuplicateBefore = duplicatePositionsBeforeMove.find(
      (node) => node.id === "sub-node-created-3",
    );
    const targetDuplicateBefore = duplicatePositionsBeforeMove.find(
      (node) => node.id === "sub-node-created-4",
    );
    expect(sourceDuplicateBefore).toBeTruthy();
    expect(targetDuplicateBefore).toBeTruthy();

    await sourceNode
      .getByTestId("commonplace-map-note-node")
      .dragTo(page.locator(".react-flow__pane"), {
        force: true,
        targetPosition: { x: 260, y: 300 },
      });
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Unsaved changes",
    );
    await page.getByTestId("commonplace-map-save-button").click();
    await expect(page.getByTestId("commonplace-map-save-status")).toHaveText(
      "Saved",
    );

    const duplicatePositionsAfterMove = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __COMMONPLACE_TEST_MAP_NODES__?: TestMapNode[];
      };

      return (testWindow.__COMMONPLACE_TEST_MAP_NODES__ ?? [])
        .filter((node) =>
          ["sub-node-created-3", "sub-node-created-4"].includes(node.id),
        )
        .map((node) => ({
          id: node.id,
          positionX: node.positionX,
          positionY: node.positionY,
        }));
    });
    const changedDuplicateNodes = duplicatePositionsAfterMove.filter((node) => {
      const before = duplicatePositionsBeforeMove.find(
        (candidate) => candidate.id === node.id,
      );
      return (
        before &&
        (before.positionX !== node.positionX ||
          before.positionY !== node.positionY)
      );
    });
    expect(changedDuplicateNodes).toHaveLength(1);

    await openFlowNodeContextMenu(sourceNode);
    await expect(page.getByTestId("commonplace-map-node-context-menu")).toBeVisible();
    await expect(page.getByTestId("commonplace-map-connect-idea")).toHaveText(
      "Connect idea",
    );
    await clickConnectIdea(page);
    await expect(page.getByTestId("commonplace-map-connection-mode")).toContainText(
      "Click a target note",
    );
    await page.mouse.move(540, 380);
    await expect(page.getByTestId("commonplace-map-connection-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("commonplace-map-connection-preview")).toHaveCount(0);
    await expect(page.getByTestId("commonplace-map-connection-mode")).toHaveCount(0);

    await openFlowNodeContextMenu(sourceNode);
    await clickConnectIdea(page);
    await expect(page.getByTestId("commonplace-map-connection-mode")).toBeVisible();
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId("commonplace-map-connection-mode")).toHaveCount(0);

    await openFlowNodeContextMenu(sourceNode);
    await clickConnectIdea(page);
    await clickFlowNode(targetNode);
    await expect(page.getByTestId("commonplace-map-edge-create-popover")).toBeVisible();
    await page.getByTestId("commonplace-map-edge-label-input").fill("direct influence");
    await page
      .getByTestId("commonplace-map-edge-create-popover")
      .getByRole("button", { name: "Create" })
      .click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".commonplace-map-edge--solid")).toHaveCount(1);
    await expect(page.getByText("direct influence")).toBeVisible();

    await page.getByTestId("commonplace-map-edge-label-sub-edge-1").click({ force: true });
    const editPopover = page.getByTestId("commonplace-map-edge-edit-popover");
    await expect(editPopover).toBeVisible();
    await editPopover.getByLabel("Label").fill("weak association");
    await editPopover.getByLabel("Relationship type").selectOption("dashed");
    await editPopover.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(1);
    await expect(page.getByText("weak association")).toBeVisible();

    await page.getByTestId("commonplace-map-edge-label-sub-edge-1").click({ force: true });
    await expect(editPopover).toBeVisible();
    await editPopover.getByLabel("Label").fill("revised association");
    await editPopover.getByLabel("Relationship type").selectOption("solid");
    await editPopover.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".commonplace-map-edge--dashed")).toHaveCount(0);
    await expect(page.getByText("revised association")).toBeVisible();

    await page.getByTestId("commonplace-map-edge-label-sub-edge-1").click({ force: true });
    await expect(editPopover).toBeVisible();
    await page.getByTestId("commonplace-map-edge-delete-button").click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);

    await page.getByRole("button", { name: "Back to Sub Mind Maps" }).click();
    await page.getByRole("button", { name: /Attention Systems/i }).click();
    await expect(page.getByTestId("commonplace-map-note-node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText(/connect idea/i)).toHaveCount(0);
  });

  test("Diskusi di Podchat passes only compact Commonplace context", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await page.getByRole("button", { name: "Diskusi di Podchat" }).click();

    await expect(page.getByTestId("podchat-commonplace-context-card")).toBeVisible();
    await expect(page.getByTestId("podchat-commonplace-context-card")).toContainText("#wn1");

    const storedContext = await page.evaluate(() =>
      window.sessionStorage.getItem("fonetik:commonplace-podchat-context"),
    );
    expect(storedContext).toContain('"source":"commonplace"');
    expect(storedContext).toContain('"shortcode":"#wn1"');
    expect(storedContext).not.toMatch(forbiddenCommonplaceContextFieldPattern);
    expect(storedContext).not.toContain("quote");
  });

  test("search filters sidebar and Library notes by title, source, shortcode, and tags", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();

    await page.getByLabel("Search notes").fill("psychology");
    await expect(page.getByTestId("commonplace-sidebar-note-list")).toContainText(
      "System One Attention",
    );
    await expect(page.getByTestId("commonplace-sidebar-note-list")).not.toContainText(
      "Institutions and Growth",
    );
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "System One Attention",
    );
    await expect(page.getByTestId("commonplace-library-grid")).not.toContainText(
      "Institutions and Growth",
    );

    await page.getByLabel("Search notes").fill("#wn1");
    await expect(page.getByTestId("commonplace-sidebar-note-list")).toContainText(
      "Institutions and Growth",
    );

    await page.getByLabel("Search notes").fill("thinking fast");
    await expect(page.getByTestId("commonplace-library-grid")).toContainText(
      "Thinking Fast and Slow",
    );
  });

  test("note editing and deletion still use the existing note data flow safely", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Commonplace" }).click();
    await page
      .getByTestId("commonplace-library-grid")
      .getByRole("button", { name: /Institutions and Growth/i })
      .click();
    await expect(page.getByRole("article")).toContainText("#wn1");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Title").fill("Institutions Updated");
    await page.getByLabel("Source page").fill("72");
    await page
      .getByLabel("Insight")
      .fill("Institutions shape long-term incentives.");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByRole("heading", { name: "Institutions Updated" })).toBeVisible();
    await expect(page.getByText("Why Nations Fail, p. 72")).toBeVisible();
    await expect(page.getByRole("article")).toContainText("#wn1");

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Delete this note?")).toBeVisible();
    await page.getByRole("button", { name: "Confirm delete" }).click();

    await expect(page.getByTestId("commonplace-library-grid")).not.toContainText(
      "Institutions Updated",
    );

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(renderedSecretLikePattern);
    expect(bodyText).not.toMatch(forbiddenCommonplaceContextFieldPattern);
  });
});
