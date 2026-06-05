import { test, expect } from "@playwright/test";

test.describe("Fonetik Cover Page E2E Tests", () => {
  test("1. Landing page renders branding, headline and typewriter", async ({ page }) => {
    // Navigate with showCover=true to bypass Playwright's webdriver check
    await page.goto("/?showCover=true");

    // 1. Landing page renders 'fonetik' branding
    await expect(page.locator("span:has-text('fonetik')")).toBeVisible();
    await expect(page.locator(".rounded-2xl.bg-\\[\\#1A554A\\]")).toBeVisible(); // Mic icon wrapper

    // 2. Landing headline renders 'Master your'
    await expect(page.locator("h1")).toContainText("Master your");

    // 3. At least one typewriter word appears
    const typewriter = page.getByTestId("typewriter-word");
    await expect(typewriter).toBeVisible();
    
    // Verify it contains typed text
    await expect(async () => {
      const text = await typewriter.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    // 4. Start button exists
    const startBtn = page.getByRole("button", { name: "Start" });
    await expect(startBtn).toBeVisible();

    // 7. Particles/background renders without crashing
    const particles = page.getByTestId("particles-bg");
    await expect(particles).toBeVisible();

    // 8. No API keys or env values are rendered (smoke checking page text)
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(bodyText).not.toContain("sk-proj-");
    expect(bodyText).not.toContain("supabase");
  });

  test("2. Clicking Start reveals login area and accepts credentials", async ({ page }) => {
    await page.goto("/?showCover=true&mockAuth=true");

    // Click Start button
    const startBtn = page.getByRole("button", { name: "Start" });
    await startBtn.click();

    // 5. Clicking Start reveals login/auth card
    const loginHeading = page.locator("h2:has-text('Start Practice (Local Mode)')").or(page.locator("h2:has-text('Sign in to Fonetik')"));
    await expect(loginHeading).toBeVisible();

    // Verify fields exist
    const emailInput = page.locator("#local-email").or(page.locator("#email"));
    const passwordInput = page.locator("#local-password").or(page.locator("#password"));
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Enter fake inputs
    await emailInput.fill("test@fonetik.ai");
    await passwordInput.fill("password123");

    // Clicking submit (Start Practice or Sign In)
    const submitBtn = page.getByRole("button", { name: /Start Practice|Sign In/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Transition to existing main app dashboard
    await expect(page.locator("img[alt=\"fonetik logo\"]")).toBeVisible();
    await expect(page.locator("aside")).toContainText("Active Session");
  });

  test("3. Existing Settings/Podchat navigation smoke test still passes via standard entry", async ({ page }) => {
    // Normal visit bypassing cover page directly to app via mockAuth
    await page.goto("/?mockAuth=true");

    await expect(page.locator("img[alt=\"fonetik logo\"]")).toBeVisible();
    await expect(page.locator("aside")).toContainText("Active Session");

    // Click Settings
    await page.click("button:has-text('Settings')");
    await expect(page.locator("h2:has-text('Settings')")).toBeVisible();

    // Click Podchat (Active Session)
    await page.click("button:has-text('Active Session')");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
  });
});
