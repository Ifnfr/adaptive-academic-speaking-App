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

function installCommonplaceTestAdapter() {
  const testWindow = window as typeof window & {
    __COMMONPLACE_TEST_NOTES__?: TestNote[];
    __COMMONPLACE_TEST_COUNTERS__?: Record<string, number>;
    __COMMONPLACE_TEST_ADAPTER__?: unknown;
  };

  testWindow.__COMMONPLACE_TEST_NOTES__ = [];
  testWindow.__COMMONPLACE_TEST_COUNTERS__ = {};
  testWindow.__COMMONPLACE_TEST_ADAPTER__ = {
    async listCommonplaceNotes(ownerId: string) {
      return {
        ok: true,
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
        return { ok: false, error: "commonplace_validation_failed" };
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
      return { ok: true, note };
    },
    async getCommonplaceNoteById(ownerId: string, noteId: string) {
      const note = (testWindow.__COMMONPLACE_TEST_NOTES__ ?? []).find(
        (candidate) =>
          candidate.ownerId === ownerId && candidate.id === noteId,
      );
      return note
        ? { ok: true, note }
        : { ok: false, error: "commonplace_not_found" };
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
        return { ok: false, error: "commonplace_validation_failed" };
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
      return { ok: true, note: updated };
    },
    async deleteCommonplaceNote(ownerId: string, noteId: string) {
      testWindow.__COMMONPLACE_TEST_NOTES__ = (
        testWindow.__COMMONPLACE_TEST_NOTES__ ?? []
      ).filter((note) => note.ownerId !== ownerId || note.id !== noteId);
      return { ok: true };
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
    expect(bodyText).not.toMatch(
      /ownerId|clientId|auth|api[_-]?key|service[_-]?role|secret|token/i,
    );
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByText(/mind map/i)).toHaveCount(0);
    expect(podchatCalls).toEqual([]);
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
    await expect(page.getByText(/mind map/i)).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(
      /api[_-]?key|service[_-]?role|supabase_service|next_public|secret|token/i,
    );
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
});
