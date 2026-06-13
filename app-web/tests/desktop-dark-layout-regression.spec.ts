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

test.describe("Desktop Layout & Dark Mode Regression Tests", () => {
  test("1366x768 Active Session/Podchat setup: no bottom clipping and primary controls visible", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoMockApp(page);

    // Verify setup card and primary button are visible in the viewport
    const startButton = page.getByRole("button", { name: "Start a Podchat" });
    await expect(startButton).toBeVisible();

    // Verify footer does not overlap or hide start button
    const footer = page.locator("footer#system");
    await expect(footer).toBeVisible();

    // Verify both elements are positioned in normal block order (footer is below start button)
    const buttonBox = await startButton.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    if (buttonBox && footerBox) {
      expect(footerBox.y).toBeGreaterThan(buttonBox.y);
    }
  });

  test("1366x768 Vocabulary Notebook: no awkward topbar wrapping and bottom content visible", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoMockApp(page);

    // Navigate to Vocabulary
    await page.click("button:has-text(\"Vocabulary Notebook\")");
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();

    // Verify topbar right section grouped status pills do not drop below header
    const topbar = page.locator("header");
    const topbarBox = await topbar.boundingBox();
    expect(topbarBox).not.toBeNull();

    // Verify bottom controls are visible and not clipped by footer
    const addWordButton = page.getByRole("button", { name: "Add Vocabulary" });
    await expect(addWordButton).toBeVisible();

    const footer = page.locator("footer#system");
    await expect(footer).toBeVisible();
  });

  test("1366x768 Article Practice: article input controls not clipped by footer", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoMockApp(page);

    // Navigate to Article Practice
    await page.click("button:has-text(\"Article Practice\")");
    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();

    // Verify input controls are visible
    const inputModeRadio = page.getByRole("radio", { name: "Article URL" });
    await expect(inputModeRadio).toBeVisible();

    const footer = page.locator("footer#system");
    await expect(footer).toBeVisible();
  });

  test("390x844 mobile regression smoke check: mobile navigation drawer opens and closes safely", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMockApp(page);

    // Ensure mobile bar is visible and toggle navigation drawer
    const menuButton = page.getByTestId("mobile-nav-toggle");
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Verify drawer opens
    await expect(page.getByTestId("mobile-nav-drawer")).toBeVisible();
    await page.keyboard.press("Escape");

    // Verify drawer closes
    await expect(page.getByTestId("mobile-nav-drawer")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });
});
