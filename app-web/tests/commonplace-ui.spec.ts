import { expect, test } from "@playwright/test";

test.describe("Commonplace Library UI shell", () => {
  test.beforeEach(async ({ page }) => {
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

  test("sidebar opens Commonplace library empty state safely", async ({
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
    await expect(page.getByText("Note creation coming next.")).toBeVisible();
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
