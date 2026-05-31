import { test, expect } from "@playwright/test";

test.describe("Independent Scrolling Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should have independent scroll containers on desktop viewports", async ({ page }) => {
    // Set desktop viewport size
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Verify CSS styles for independent scrolling
    const sidebar = page.locator("aside");
    const mainContainer = page.getByTestId("main-scroll-container");

    await expect(sidebar).toBeVisible();
    await expect(mainContainer).toBeVisible();

    // Verify computed style properties (overflow-y should be auto or scroll)
    const sidebarOverflow = await sidebar.evaluate((el) => window.getComputedStyle(el).overflowY);
    const mainOverflow = await mainContainer.evaluate((el) => window.getComputedStyle(el).overflowY);

    expect(sidebarOverflow).toBe("auto");
    expect(mainOverflow).toBe("auto");

    // 2. Navigation items work correctly
    const learningPathButton = page.locator("aside button:has-text(\"Learning Path\")");
    await expect(learningPathButton).toBeVisible();
    await learningPathButton.click();

    // Verify we navigated to the Learning Path view
    await expect(page.locator("header")).toContainText("Learning Path");

    // 3. Verify main content scrolling does not scroll/affect the sidebar visual position
    const initialSidebarBounding = await sidebar.boundingBox();
    expect(initialSidebarBounding).not.toBeNull();

    // Scroll the main content container down
    await mainContainer.evaluate((el) => {
      el.scrollTop = 500;
    });

    // Make sure we wait a brief moment for layout/scroll to settle
    await page.waitForTimeout(100);

    // Verify sidebar position did not change/move
    const afterScrollSidebarBounding = await sidebar.boundingBox();
    expect(afterScrollSidebarBounding).not.toBeNull();
    expect(afterScrollSidebarBounding?.y).toBe(initialSidebarBounding?.y);

    // 4. Verify no horizontal scrollbars on main container or body
    const mainScrollWidth = await mainContainer.evaluate((el) => el.scrollWidth);
    const mainClientWidth = await mainContainer.evaluate((el) => el.clientWidth);
    expect(mainScrollWidth).toBeLessThanOrEqual(mainClientWidth + 2); // allowance for border/minor padding differences

    // 5. Verification of DOM privacy
    const rawDomText = await page.content();
    expect(rawDomText).not.toContain("rawCsvContent");
    expect(rawDomText).not.toContain("privateNoteText");
  });

  test("should support mobile viewport layout where whole page scrolls", async ({ page }) => {
    // Set mobile viewport size
    await page.setViewportSize({ width: 375, height: 667 });

    const sidebar = page.locator("aside");
    const mainContainer = page.getByTestId("main-scroll-container");

    await expect(sidebar).toBeVisible();
    await expect(mainContainer).toBeVisible();

    // On mobile viewports, the parent elements should not restrict height with h-screen/overflow-hidden.
    // Verify computed overflow properties are default ('visible' or 'clip') rather than 'hidden'.
    const outerContainer = page.locator("div.min-h-screen");
    const outerOverflow = await outerContainer.evaluate((el) => window.getComputedStyle(el).overflowY);
    expect(outerOverflow).not.toBe("hidden");

    // Verify navigation still operates in mobile view
    const learningPathButton = page.locator("aside button:has-text(\"Learning Path\")");
    await learningPathButton.click();
    await expect(page.locator("header")).toContainText("Learning Path");
  });
});
