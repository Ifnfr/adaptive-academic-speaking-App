import { test, expect, type Page } from "@playwright/test";

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

async function gotoMockApp(page: Page) {
  await page.goto("/?mockAuth=true");
  await expect(page.getByTestId("podchat-setup")).toBeVisible();
}

test.describe("Sidebar Simplification Flows", () => {
  test("diagnostic and level-up check are not in sidebar but features remain accessible", async ({ page }) => {
    await gotoMockApp(page);

    // Wait for hydration to complete
    await expect(page.locator("aside")).not.toContainText("Loading speaker progress");

    // 1. Verify Diagnostic is not shown as a sidebar item
    await expect(page.locator("aside button:has-text(\"Diagnostic\")")).toHaveCount(0);
    await expect(page.locator("aside")).not.toContainText("Diagnostic");

    // 2. Verify Level-Up Check is not shown as a sidebar item
    await expect(page.locator("aside button:has-text(\"Level-Up Check\")")).toHaveCount(0);
    await expect(page.locator("aside")).not.toContainText("Level-Up Check");

    // 3. Verify Active Session now renders the Podchat setup
    await expect(page.locator("aside")).toContainText("Active Session");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();

    // 4. Verify Podchat topic and difficulty controls remain reachable
    const economicsButton = page.getByRole("radio", { name: "Economics" });
    await expect(economicsButton).toBeVisible();
    await economicsButton.click();
    await expect(economicsButton).toHaveAttribute("aria-checked", "true");

    const beginnerButton = page.getByRole("radio", { name: /Beginner/ });
    await expect(beginnerButton).toBeVisible();
    await beginnerButton.click();
    await expect(beginnerButton).toHaveAttribute("aria-checked", "true");

    // 5. Verify Progress still renders and Level-Up Check remains reachable from Progress
    await page.click("button:has-text(\"Progress & Quest\")");
    await expect(page.locator("h2:has-text(\"Progress & Quest\")")).toBeVisible();
    await expect(page.locator("p:has-text(\"Level-Up Check\")")).toBeVisible();
    await expect(page.locator("h3:has-text(\"Local readiness check\")")).toBeVisible();
  });

  test("mobile shell shows main content first and opens navigation drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await gotoMockApp(page);

    await expect(page.getByTestId("mobile-nav-toggle")).toBeVisible();
    await expect(page.locator("aside").first()).toBeHidden();
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const toggleBox = await page.getByTestId("mobile-nav-toggle").boundingBox();
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.getByTestId("mobile-nav-toggle").click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Active Session");
    await expect(drawer).toContainText("Commonplace");
    await expect(drawer).toContainText("Settings");

    await drawer.getByRole("button", { name: "Settings" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId("mobile-shell-bar")).toContainText(
      "Settings",
    );
    await expect(page.locator("h2").first()).toContainText(
      /Profile & Settings/i,
    );
    await expectNoHorizontalOverflow(page);
  });

  test("mobile shell has no horizontal overflow at 360 and 390 widths", async ({
    page,
  }) => {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: width === 360 ? 760 : 844 });
      await gotoMockApp(page);
      await expectNoHorizontalOverflow(page);
      await page.getByTestId("mobile-nav-toggle").click();
      await expect(page.getByTestId("mobile-nav-drawer")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("mobile-nav-drawer")).toBeHidden();
    }
  });

  test("mobile drawer reaches Commonplace and returns to Podchat", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMockApp(page);

    await page.getByTestId("mobile-nav-toggle").click();
    await page
      .getByTestId("mobile-nav-drawer")
      .getByRole("button", { name: "Commonplace" })
      .click();
    await expect(page.getByTestId("mobile-shell-bar")).toContainText(
      "Commonplace",
    );
    await expect(page.getByTestId("mobile-nav-drawer")).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await page.getByTestId("mobile-nav-toggle").click();
    await page
      .getByTestId("mobile-nav-drawer")
      .getByRole("button", { name: "Active Session" })
      .click();
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByTestId("mobile-nav-drawer")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("desktop sidebar remains visible at 1024 and 1366 widths", async ({
    page,
  }) => {
    for (const width of [1024, 1366]) {
      await page.setViewportSize({ width, height: 768 });
      await gotoMockApp(page);
      await expect(page.getByTestId("mobile-nav-toggle")).toBeHidden();
      await expect(page.locator("aside")).toBeVisible();
      await expect(page.locator("aside")).toContainText("Active Session");
      await expectNoHorizontalOverflow(page);
    }
  });
});
