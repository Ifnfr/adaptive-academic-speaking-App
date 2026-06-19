import { expect, test, type Page } from "@playwright/test";

function mission(overrides: Record<string, unknown> = {}) {
  return {
    missionId: "mission-podchat",
    title: "Complete a baseline Podchat",
    description: "Finish one evaluated Podchat session.",
    reason: "Start with a real speaking sample before diagnosing patterns.",
    weaknessTarget: null,
    metricType: "podchat_sessions",
    targetValue: 1,
    currentValue: 0,
    unit: "sessions",
    sourceFeatures: ["podchat"],
    status: "not_started",
    recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
    createdAt: "2026-06-18T12:00:00.000Z",
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    ...overrides,
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    reviewId: "review-1",
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    timezone: "UTC",
    generatedAt: "2026-06-18T12:00:00.000Z",
    diagnosisSummary: "Start this week with baseline practice across speaking and vocabulary.",
    dataSufficiency: "starter",
    missions: [
      mission(),
      mission({
        missionId: "mission-vocab",
        title: "Collect starter vocabulary",
        reason: "A starter word bank gives future reviews useful material.",
        metricType: "vocabulary_collected",
        targetValue: 5,
        currentValue: 2,
        unit: "items",
        sourceFeatures: ["vocabulary"],
        status: "in_progress",
        recommendedAction: { label: "Open Vocabulary", routeTarget: "vocabulary" },
      }),
      mission({
        missionId: "mission-pattern",
        title: "Drill your top weakness",
        reason: "Targeted pattern practice turns feedback into repeatable control.",
        weaknessTarget: {
          category: "Grammar",
          label: "Verb form",
          practiceFocus: "Use correct verb forms.",
        },
        metricType: "pattern_drill_sessions",
        targetValue: 1,
        currentValue: 0,
        unit: "sessions",
        sourceFeatures: ["pattern_drill"],
        status: "not_started",
        recommendedAction: { label: "Open Pattern Drill", routeTarget: "pattern_drill" },
      }),
      mission({
        missionId: "mission-article",
        title: "Add article transfer practice",
        reason: "Article work adds a transfer surface beyond speaking.",
        metricType: "article_practice_completed",
        targetValue: 1,
        currentValue: 0,
        unit: "sessions",
        sourceFeatures: ["article_practice"],
        status: "not_started",
        recommendedAction: { label: "Start Article Practice", routeTarget: "article_practice" },
      }),
    ],
    missionCount: 4,
    status: "active",
    nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
    warnings: [],
    ...overrides,
  };
}

async function gotoMockApp(page: Page) {
  await page.goto("/?mockAuth=true");
  await expect(page.getByTestId("podchat-setup")).toBeVisible();
}

async function openWeeklyReview(page: Page) {
  const menuButton = page.getByTestId("mobile-nav-toggle");
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
  await page.getByRole("button", { name: "Weekly Review" }).click();
  await expect(page.getByTestId("weekly-mission-dashboard")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const allowedRoundingError = 1;
        return (
          document.documentElement.scrollWidth <=
            window.innerWidth + allowedRoundingError &&
          document.body.scrollWidth <= window.innerWidth + allowedRoundingError
        );
      }),
    )
    .toBe(true);
}

test.describe("Weekly Mission Dashboard UI", () => {
  test("not generated state can create and render starter weekly missions", async ({ page }) => {
    let postCalled = false;
    await page.route("**/api/weekly-review/mission", async (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ state: "created", review: review() }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "not_generated",
          period: {
            weekStart: "2026-06-15",
            weekEnd: "2026-06-21",
            timezone: "UTC",
            nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
          },
          review: null,
        }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);

    await expect(page.getByRole("heading", { name: "Generate the weekly mission plan" })).toBeVisible();
    await page.getByRole("button", { name: "Generate Weekly Missions" }).click();

    await expect(page.getByRole("heading", { name: "Weekly Missions", exact: true })).toBeVisible();
    await expect(page.getByText("Weekly missions generated.")).toBeVisible();
    await expect(page.getByText("Weekly missions are unavailable right now.")).toHaveCount(0);
    await expect(page.getByText("Starter plan")).toBeVisible();
    await expect(page.getByText("This is a starter mission plan.")).toBeVisible();
    await expect(page.getByText("0 / 1 sessions").first()).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /Complete a baseline Podchat/ })).toBeVisible();
    expect(postCalled).toBe(true);

    const dashboardText = await page.getByTestId("weekly-mission-dashboard").innerText();
    expect(dashboardText).not.toContain("provider");
    expect(dashboardText).not.toContain("owner");
    expect(dashboardText).not.toContain("source_snapshot");
    expect(dashboardText).not.toContain("prompt");
    expect(dashboardText).not.toContain("model");
  });

  test("generation loading uses staged UX copy without provider details", async ({ page }) => {
    let releasePost: () => void = () => {};
    await page.route("**/api/weekly-review/mission", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise<void>((resolve) => {
          releasePost = resolve;
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ state: "created", review: review() }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "not_generated",
          period: {
            weekStart: "2026-06-15",
            weekEnd: "2026-06-21",
            timezone: "UTC",
            nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
          },
          review: null,
        }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Generate Weekly Missions" }).click();

    await expect(page.getByText("Analyzing your learning data...")).toBeVisible();
    await expect(page.getByText("Finding your weekly focus...")).toBeVisible({ timeout: 2500 });
    const dashboardText = await page.getByTestId("weekly-mission-dashboard").innerText();
    expect(dashboardText).not.toContain("DeepSeek");
    expect(dashboardText).not.toContain("provider");
    expect(dashboardText).not.toContain("model");

    releasePost();
    await expect(page.getByRole("heading", { name: "Weekly Missions", exact: true })).toBeVisible();
  });

  test("storage setup failure is shown as a safe storage message after generate", async ({ page }) => {
    await page.route("**/api/weekly-review/mission", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "weekly_mission_storage_unavailable" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "not_generated",
          period: {
            weekStart: "2026-06-15",
            weekEnd: "2026-06-21",
            timezone: "UTC",
            nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
          },
          review: null,
        }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Generate Weekly Missions" }).click();

    await expect(page.getByTestId("weekly-mission-error")).toContainText(
      "Weekly mission storage is not ready yet.",
    );
    await expect(page.getByTestId("weekly-mission-error")).not.toContainText("provider");
    await expect(page.getByTestId("weekly-mission-error")).not.toContainText("model");
  });

  test("existing mission CTAs route to target app surfaces", async ({ page }) => {
    await page.route("**/api/weekly-review/mission", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "existing", review: review({ dataSufficiency: "strong" }) }),
      });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty", reason: "No weakness data yet." }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);

    await page.getByRole("button", { name: "Open Pattern Drill" }).click();
    await expect(page.getByRole("heading", { name: "Active Session" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drill Mode" })).toHaveAttribute("aria-pressed", "true");

    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Open Vocabulary" }).click();
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();

    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Start Article Practice" }).click();
    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();

    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Start Podchat" }).click();
    await expect(page.getByRole("button", { name: "Podchat", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
  });

  test("mobile error state is safe, retryable, and does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/weekly-review/mission", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "weekly_mission_unavailable" }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);

    await expect(page.getByTestId("weekly-mission-dashboard").getByRole("alert")).toContainText(
      "Weekly missions are unavailable right now. Please try again.",
    );
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    const errorCard = page.getByTestId("weekly-mission-error");
    await expect(errorCard).toBeVisible();
    await expect(errorCard).not.toHaveAttribute("data-commonplace-card-surface", /.*/);
    await expect(errorCard).not.toHaveAttribute("data-commonplace-panel-surface", /.*/);
    const errorColors = await errorCard.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: styles.color,
      };
    });
    expect(errorColors.backgroundColor).not.toBe("rgb(76, 29, 16)");
    expect(errorColors.borderColor).not.toBe("rgb(249, 115, 22)");
    await expectNoHorizontalOverflow(page);
  });
});
