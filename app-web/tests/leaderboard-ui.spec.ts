import { test, expect } from "@playwright/test";

// ---------- Mock Data Helpers ----------

const mockEmptyResponse = {
  period: "weekly",
  leaderboard: [],
  currentUser: {
    isSignedIn: true,
    optedIn: true,
    visibility: "public",
    rank: null,
    previewRank: 1,
    periodXp: 0,
    displayName: "Mock User",
    avatarUrl: null,
    initials: "MU",
    level: { number: 1, name: "New Speaker" },
  },
};

const mockPrivateUserResponse = {
  period: "weekly",
  leaderboard: [
    {
      rank: 1,
      displayName: "Alice S.",
      avatarUrl: null,
      initials: "AS",
      level: { number: 3, name: "Intermediate Speaker" },
      periodXp: 120,
      badgeCount: 2,
    },
    {
      rank: 2,
      displayName: "Bob J.",
      avatarUrl: null,
      initials: "BJ",
      level: { number: 2, name: "Beginner Speaker" },
      periodXp: 80,
      badgeCount: 1,
    },
  ],
  currentUser: {
    isSignedIn: true,
    optedIn: false,
    visibility: "private",
    rank: null,
    previewRank: 2, // 100 XP is between 120 and 80
    periodXp: 100,
    displayName: "Mock User (Private)",
    avatarUrl: null,
    initials: "MP",
    level: { number: 4, name: "Advanced Speaker" },
  },
};

const mockReadyResponse = {
  period: "weekly",
  leaderboard: [
    {
      rank: 1,
      displayName: "Alice S.",
      avatarUrl: null,
      initials: "AS",
      level: { number: 3, name: "Intermediate Speaker" },
      periodXp: 120,
      badgeCount: 2,
    },
    {
      rank: 2,
      displayName: "Mock User",
      avatarUrl: null,
      initials: "MU",
      level: { number: 1, name: "New Speaker" },
      periodXp: 100,
      badgeCount: 0,
    },
    {
      rank: 3,
      displayName: "Bob J.",
      avatarUrl: null,
      initials: "BJ",
      level: { number: 2, name: "Beginner Speaker" },
      periodXp: 80,
      badgeCount: 1,
    },
  ],
  currentUser: {
    isSignedIn: true,
    optedIn: true,
    visibility: "public",
    rank: 2,
    previewRank: 2,
    periodXp: 100,
    displayName: "Mock User",
    avatarUrl: null,
    initials: "MU",
    level: { number: 1, name: "New Speaker" },
  },
};

const mockSignedOutResponse = {
  period: "weekly",
  leaderboard: [
    {
      rank: 1,
      displayName: "Alice S.",
      avatarUrl: null,
      initials: "AS",
      level: { number: 3, name: "Intermediate Speaker" },
      periodXp: 120,
      badgeCount: 2,
    },
  ],
  currentUser: {
    isSignedIn: false,
    optedIn: false,
    visibility: "signed-out",
    rank: -1,
    previewRank: -1,
    periodXp: 0,
    displayName: "",
    avatarUrl: null,
    initials: "S",
    level: { number: 1, name: "New Speaker" },
  },
};

// ---------- E2E UI Tests ----------

test.describe("Leaderboard UI Shell", () => {

  test("Sidebar shows Leaderboard navigation button", async ({ page }) => {
    // Intercept API call to prevent failure
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("button:has-text('Leaderboard')")).toBeVisible();
  });

  test("Leaderboard view renders upon selection", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Verify main headings
    await expect(page.locator("h2:has-text('Leaderboard')")).toBeVisible();
    await expect(page.locator("#leaderboard-view").getByText("Celebrate progress and consistency")).toBeVisible();
  });

  test("Weekly is default period and period tabs render", async ({ page }) => {
    let requestedPeriod: string | null = null;
    await page.route("**/api/leaderboard*", async (route) => {
      const url = new URL(route.request().url());
      requestedPeriod = url.searchParams.get("period");
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Verify tabs
    const tabList = page.locator("[role='tablist']");
    await expect(tabList.locator("[role='tab']:has-text('Daily')")).toBeVisible();
    await expect(tabList.locator("[role='tab']:has-text('Weekly')")).toBeVisible();
    await expect(tabList.locator("[role='tab']:has-text('Monthly')")).toBeVisible();
    await expect(tabList.locator("[role='tab']:has-text('All-time')")).toBeVisible();

    // Default period check
    await expect(tabList.locator("[role='tab'][aria-selected='true']")).toHaveText("Weekly");
    expect(requestedPeriod).toBe("weekly");
  });

  test("Fetches /api/leaderboard with selected period on tab click", async ({ page }) => {
    const requestedPeriods: string[] = [];
    await page.route("**/api/leaderboard*", async (route) => {
      const url = new URL(route.request().url());
      requestedPeriods.push(url.searchParams.get("period") || "");
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Click "Daily" tab
    await page.locator("[role='tab']:has-text('Daily')").click();
    // Wait for the simulated fetch call
    await page.waitForTimeout(100);

    expect(requestedPeriods).toContain("daily");
  });

  test("Loading state renders", async ({ page }) => {
    // Deliberately delay API response to check loading state
    await page.route("**/api/leaderboard*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Check loading indicator is visible
    await expect(page.locator("#leaderboard-loading")).toBeVisible();
  });

  test("Error state renders", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "DB Failure" }) });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    await expect(page.locator("#leaderboard-error")).toBeVisible();
    await expect(page.locator("text=Failed to fetch leaderboard data")).toBeVisible();
  });

  test("Empty/no-data state renders", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockEmptyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    await expect(page.locator("#leaderboard-empty")).toBeVisible();
    await expect(page.locator("text=No active users on the leaderboard")).toBeVisible();
  });

  test("Signed-out notice renders when currentUser is signed out", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockSignedOutResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    await expect(page.locator("#leaderboard-signed-out")).toBeVisible();
    await expect(page.locator("text=You are currently signed out")).toBeVisible();
  });

  test("Opted-out/private current user card renders safely", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockPrivateUserResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Notice card
    await expect(page.locator("#leaderboard-private-notice")).toBeVisible();
    await expect(page.locator("text=Your leaderboard visibility is set to Private")).toBeVisible();

    // Current User Standing
    const userCard = page.locator("#leaderboard-current-user-card");
    await expect(userCard).toBeVisible();
    await expect(userCard.locator("text=Mock User (Private)")).toBeVisible();
    await expect(userCard.locator("text=Simulated Rank #2")).toBeVisible();
    await expect(userCard.locator("text=100 XP")).toBeVisible();
  });

  test("Public ranking list renders sanitized user rows", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();

    // Rankings List
    const ranks = page.locator("#leaderboard-list");
    await expect(ranks).toBeVisible();
    await expect(ranks.locator("text=Alice S.")).toBeVisible();
    await expect(ranks.locator("text=Bob J.")).toBeVisible();
    await expect(ranks.locator("text=Mock User")).toBeVisible();
  });

  test("Private fields are not rendered in DOM", async ({ page }) => {
    await page.route("**/api/leaderboard*", async (route) => {
      await route.fulfill({ json: mockReadyResponse });
    });

    await page.goto("/");
    await page.locator("aside button:has-text('Leaderboard')").click();
    await page.waitForSelector("#leaderboard-ready");

    const content = await page.content();
    const forbidden = [
      "email",
      "ownerId",
      "owner_id",
      "sourceId",
      "source_id",
      "transcript",
      "retry_transcript",
      "vocabulary_sentence",
      "correction",
      "article_url",
      "main_weakness",
      "retry_task",
      "csv",
      "private_note",
      "session_id",
    ];

    for (const field of forbidden) {
      expect(content).not.toContain(`"${field}":`);
      expect(content).not.toContain(`${field}=`);
    }
  });
});
