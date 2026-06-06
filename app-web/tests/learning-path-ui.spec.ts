import { test, expect } from "@playwright/test";

test.describe("Learning Path Disabled Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept document requests to "/" and append mockAuth=true to bypass the cover page safely in E2E tests
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
      } else {
        await route.continue();
      }
    });
  });

  test("1. Sidebar does NOT show Learning Path navigation item", async ({ page }) => {
    await page.goto("/");
    const learningPathItem = page.getByRole("button", { name: "Learning Path" });
    await expect(learningPathItem).not.toBeVisible();
  });

  test("2. App does not render Learning Path container in the DOM", async ({ page }) => {
    await page.goto("/");
    const container = page.locator("[data-testid='learning-path-container']");
    await expect(container).not.toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Beginner Confidence Ladder");
    expect(bodyText).not.toContain("Confidence Foundation");
  });

  test("3. Setting view state to 'learning-path' falls back safely to 'active'", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fonetik:view", "learning-path");
    });

    await page.goto("/");

    // Check that we default back to the Active Session content
    await expect(page.getByTestId("podchat-setup")).toBeVisible();

    // Assert the URL or other elements show active view
    const container = page.locator("[data-testid='learning-path-container']");
    await expect(container).not.toBeVisible();
  });

  test("4. Other navigation links in the sidebar still render and function", async ({ page }) => {
    await page.goto("/");

    // Check remaining practice items
    await expect(page.getByRole("button", { name: "Active Session" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vocabulary Notebook" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Article Practice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Session Log" })).toBeVisible();

    // Check analytics items
    await expect(page.getByRole("button", { name: "Progress & Quest" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Weekly Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leaderboard" })).toBeVisible();

    // Check settings
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  });

  test("5. Archived component is not imported/mounted in the active application flow", async ({ page }) => {
    await page.goto("/");
    const archiveContainer = page.locator("[data-testid='learning-path-archive-container']");
    await expect(archiveContainer).not.toBeVisible();
  });
});
