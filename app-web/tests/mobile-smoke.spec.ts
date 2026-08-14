import { test, expect } from "@playwright/test";

// Mobile smoke test against the deployed app (unauthenticated shell check)
test.describe("Mobile viewport smoke test (deployed)", () => {
  test.use({
    viewport: { width: 393, height: 851 }, // Pixel 5
    userAgent:
      "Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  });

  test("app loads on mobile without layout overflow or JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    await page.goto("https://adaptive-academic-speaking-app.vercel.app/", {
      waitUntil: "networkidle",
      timeout: 45000,
    });

    // Title check
    await expect(page).toHaveTitle(/fonetik/i);

    // Clerk sign-in should appear (unauthenticated)
    const clerkVisible =
      (await page.locator(".cl-rootBox, [data-testid='sign-in'], .cl-component").count()) > 0;
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });

    console.log(`Clerk visible: ${clerkVisible}, horizontal overflow: ${hasOverflow}`);
    console.log(`JS errors: ${errors.length}`);
    if (errors.length > 0) console.log(errors.slice(0, 5).join("\n"));

    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
    expect(hasOverflow).toBe(false);
  });

  test("listening page renders on mobile", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("https://adaptive-academic-speaking-app.vercel.app/listening", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(3000);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    console.log(`Listening page horizontal overflow: ${hasOverflow}`);
    console.log(`Listening page JS errors: ${errors.length}`);
    expect(hasOverflow).toBe(false);
  });
});
