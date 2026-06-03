import { test, expect } from "@playwright/test";

test.describe("Sidebar Simplification Flows", () => {
  test("diagnostic and level-up check are not in sidebar but features remain accessible", async ({ page }) => {
    await page.goto("/");

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
});
