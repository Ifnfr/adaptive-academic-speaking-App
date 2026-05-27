import { test, expect } from "@playwright/test";

test.describe("Sidebar Simplification Flows", () => {
  test("diagnostic and level-up check are not in sidebar but features remain accessible", async ({ page }) => {
    await page.goto("/");

    // 1. Verify Diagnostic is not shown as a sidebar item
    await expect(page.locator("aside button:has-text(\"Diagnostic\")")).toHaveCount(0);
    await expect(page.locator("aside")).not.toContainText("Diagnostic");

    // 2. Verify Level-Up Check is not shown as a sidebar item
    await expect(page.locator("aside button:has-text(\"Level-Up Check\")")).toHaveCount(0);
    await expect(page.locator("aside")).not.toContainText("Level-Up Check");

    // 3. Verify Active Session still renders
    await expect(page.locator("aside")).toContainText("Active Session");
    await expect(page.locator("h2:has-text(\"Session setup\")")).toBeVisible();

    // 4. Verify Diagnostic functionality remains reachable from Active Session
    const diagnosticModeButton = page.locator("button[role=\"radio\"]:has-text(\"Diagnostic\")");
    await expect(diagnosticModeButton).toBeVisible();
    
    // Select Diagnostic mode and verify the setup updates
    await diagnosticModeButton.click();
    await expect(diagnosticModeButton).toHaveAttribute("aria-checked", "true");

    // 5. Verify Progress still renders and Level-Up Check remains reachable from Progress
    await page.click("button:has-text(\"Progress\")");
    await expect(page.locator("h2:has-text(\"Progress\")")).toBeVisible();
    await expect(page.locator("p:has-text(\"Level-Up Check\")")).toBeVisible();
    await expect(page.locator("h3:has-text(\"Local readiness check\")")).toBeVisible();
  });
});
