import { expect, test, type Page } from "@playwright/test";

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
    __COMMONPLACE_TEST_COUNTERS__?: Record<string, number>;
    __COMMONPLACE_TEST_ADAPTER__?: unknown;
    __COMMONPLACE_FORCE_DETAIL_READ_FAILURE__?: boolean;
  };

  testWindow.__COMMONPLACE_TEST_NOTES__ = seedNotes.map((note) => ({ ...note }));
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
      id: "sub-map-1",
      ownerId: testOwnerId,
      title: "Institutional Incentives",
      type: "sub",
      parentMindMapId: null,
      createdAt: "2026-06-06T05:00:00.000Z",
      updatedAt: "2026-06-06T05:00:00.000Z",
    },
  ];
  testWindow.__COMMONPLACE_TEST_COUNTERS__ = {};

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
      if (
        !input.ownerId ||
        !input.sourceBook?.trim() ||
        !input.title?.trim() ||
        !input.insight?.trim()
      ) {
        return { ok: false as const, error: "commonplace_validation_failed" as const };
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
      return { ok: true as const, note: updated };
    },
    async deleteCommonplaceNote(ownerId: string, noteId: string) {
      testWindow.__COMMONPLACE_TEST_NOTES__ = (
        testWindow.__COMMONPLACE_TEST_NOTES__ ?? []
      ).filter((note) => note.ownerId !== ownerId || note.id !== noteId);
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
    await expect(page.getByTestId("commonplace-map-detail-placeholder")).toBeVisible();
    await expect(page.getByText("Canvas will be built in the next phase.")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".react-flow")).toHaveCount(0);
    await expect(page.getByText("AI Suggest")).toHaveCount(0);
    await expect(page.getByText(/cluster/i)).toHaveCount(0);
    await expect(page.getByText(/saved map/i)).toHaveCount(0);

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

    await page.getByLabel("New Sub Mind Map title").fill("Attention Systems");
    await page.getByRole("button", { name: "+ New Sub Mind Map" }).click();
    await expect(page.getByText("Attention Systems")).toBeVisible();

    await page.getByRole("button", { name: /Attention Systems/i }).click();
    await expect(page.getByTestId("commonplace-map-detail-placeholder")).toBeVisible();
    await expect(
      page.getByText("Sub Mind Map canvas will be built in the next phase."),
    ).toBeVisible();
    await expect(page.getByText(/Opened from #tf1/i)).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".react-flow")).toHaveCount(0);
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
