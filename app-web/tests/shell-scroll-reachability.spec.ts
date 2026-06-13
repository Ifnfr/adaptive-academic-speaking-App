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

test.describe("Shell Scroll & Reachability Tests", () => {
  // Test desktop layout at 1366x768 in Light Mode
  test("1366x768 light mode: scroll containers and footer boundaries are safe", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoMockApp(page);

    // Active Session / Podchat setup is default
    const startButton = page.getByRole("button", { name: "Start a Podchat" });
    await expect(startButton).toBeVisible();

    const footer = page.locator("footer#system");
    await expect(footer).toBeVisible();

    const scrollContainer = page.locator('[data-testid="main-scroll-container"]');
    await expect(scrollContainer).toBeVisible();

    // Verify footer is below the scroll container bounding box
    const footerBox = await footer.boundingBox();
    const scrollBox = await scrollContainer.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(scrollBox).not.toBeNull();
    if (footerBox && scrollBox) {
      expect(footerBox.y).toBeGreaterThanOrEqual(scrollBox.y + scrollBox.height);
    }

    // Navigate to Vocabulary Notebook
    await page.click("button:has-text(\"Vocabulary Notebook\")");
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();

    // Check footer is still below the scroll container
    const footerBox2 = await footer.boundingBox();
    const scrollBox2 = await scrollContainer.boundingBox();
    if (footerBox2 && scrollBox2) {
      expect(footerBox2.y).toBeGreaterThanOrEqual(scrollBox2.y + scrollBox2.height);
    }

    // Navigate to Article Practice
    await page.click("button:has-text(\"Article Practice\")");
    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();

    // Verify article controls are visible
    const inputModeRadio = page.getByRole("radio", { name: "Article URL" });
    await expect(inputModeRadio).toBeVisible();

    // Check footer is still below the scroll container
    const footerBox3 = await footer.boundingBox();
    const scrollBox3 = await scrollContainer.boundingBox();
    if (footerBox3 && scrollBox3) {
      expect(footerBox3.y).toBeGreaterThanOrEqual(scrollBox3.y + scrollBox3.height);
    }
  });

  // Test desktop layout at 1366x768 in Dark Mode
  test("1366x768 dark mode: representative screen (Vocabulary) has scroll reachability", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoMockApp(page);

    // Programmatically enable Dark Mode on the document element
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });

    // Go to Vocabulary Notebook
    await page.click("button:has-text(\"Vocabulary Notebook\")");
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();

    // Add multiple items to ensure scrolling
    for (let i = 1; i <= 5; i++) {
      await page.fill("input#vocab-word", `darkword${i}`);
      await page.fill("input#vocab-meaning", `meaning ${i}`);
      await page.click("button:has-text(\"Add Vocabulary\")");
    }
    // Scroll to the bottom of the container
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="main-scroll-container"]');
      if (el) el.scrollTop = el.scrollHeight;
    });

    // Verify container scrollHeight is greater than clientHeight
    const isScrollable = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="main-scroll-container"]');
      return el ? el.scrollHeight > el.clientHeight : false;
    });
    expect(isScrollable).toBe(true);

    // Verify last added item is visible/reachable
    const lastWord = page.getByText("darkword5").first();
    await expect(lastWord).toBeVisible();
  });

  // Test mobile layout at 390x844
  test("390x844 mobile layout: scroll reaches bottom and mobile navigation drawer functions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoMockApp(page);

    // Verify mobile toggle menu exists
    const menuButton = page.getByTestId("mobile-nav-toggle");
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Verify mobile drawer opens
    const drawer = page.getByTestId("mobile-nav-drawer");
    await expect(drawer).toBeVisible();

    // Close drawer
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Scroll to bottom of the page
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Verify footer is at the bottom of the page and visible
    const footer = page.locator("footer#system");
    await expect(footer).toBeInViewport();

    // Ensure no horizontal overflow
    await expectNoHorizontalOverflow(page);
  });
});
