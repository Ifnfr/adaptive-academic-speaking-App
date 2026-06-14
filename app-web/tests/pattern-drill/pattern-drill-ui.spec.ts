import { test, expect } from "@playwright/test";

test.describe("Pattern Drill UI Wiring", () => {
  test.beforeEach(async ({ page }) => {
    // Standard mock auth redirect bypass
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

  test("asserts latest-weakness API is NOT fetched on initial Active Session Podchat mount", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty" }),
      });
    });

    await page.goto("/");
    // Active session loads Podchat view first
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("asserts latest-weakness API is fetched when Pattern Drill mode is entered", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty" }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-empty")).toBeVisible();
    expect(apiCalled).toBe(true);
  });

  test("displays found weakness state with all details, confidence, evidence, and disabled actions", async ({ page }) => {
    let apiBriefCalled = false;
    let apiDrillCalled = false;

    // Fail-safe routes for unauthorized endpoints
    await page.route("**/api/pattern-brief/**", async (route) => {
      apiBriefCalled = true;
      await route.fulfill({ status: 404 });
    });
    await page.route("**/api/drill/**", async (route) => {
      apiDrillCalled = true;
      await route.fulfill({ status: 404 });
    });

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "found",
          weakness: {
            title: "No sentence endings",
            description: "Add clear sentence endings to ensure clarity.",
            category: "Coherence",
            label: "No sentence endings",
            evidence: "Did not finish sentence.",
            practiceFocus: "Focus on endings.",
            failureCount: 3,
            lastSeenAt: "2026-06-10T12:00:00Z",
            derivedConfidence: 0.8,
          },
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();

    // Verify found weakness fields
    await expect(page.getByTestId("weakness-found")).toBeVisible();
    await expect(page.getByText("Add clear sentence endings to ensure clarity.")).toBeVisible();
    await expect(page.getByText("Coherence")).toBeVisible();
    await expect(page.getByText("3 times")).toBeVisible();
    await expect(page.getByText("High (0.80)")).toBeVisible();
    await expect(page.getByText("Did not finish sentence.")).toBeVisible();
    await expect(page.getByText("Focus on endings.")).toBeVisible();

    // Verify Pattern Brief preview copy is shown
    await expect(
      page.getByText("Pattern Brief is not generated yet. Finish your speaking analysis to view the full practice brief.")
    ).toBeVisible();

    // Verify no XP reward badges/text exist inside the drill component sections
    const xpElements = await page.locator("section").locator("text=/XP/").count();
    expect(xpElements).toBe(0);

    // Verify action button is disabled and explains why
    const generateBtn = page.getByRole("button", { name: "Generate Pattern Brief" });
    await expect(generateBtn).toBeDisabled();
    await expect(generateBtn).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Pattern Brief generation is not active in this milestone.")).toBeVisible();

    // Confirm no invalid network/brief calls occurred
    expect(apiBriefCalled).toBe(false);
    expect(apiDrillCalled).toBe(false);
  });

  test("handles loading, empty, insufficient, and error states gracefully", async ({ page }) => {
    let mockStatus = "loading";

    // Set up dynamic route mocker
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      if (mockStatus === "loading") {
        // keep request pending / fulfill with loading if requested, but route resolves loading immediately in test mock
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "loading" }),
        });
      } else if (mockStatus === "empty") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "empty" }),
        });
      } else if (mockStatus === "insufficient") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "insufficient" }),
        });
      } else {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "DB Error" }),
        });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();

    // Test loading display
    await expect(page.getByTestId("weakness-loading")).toBeVisible();
    await expect(page.getByText("Checking your latest speaking weakness...")).toBeVisible();

    // Test empty
    mockStatus = "empty";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-empty")).toBeVisible();
    await expect(page.getByText("No speaking weakness data yet. Complete an evaluated Podchat session first.")).toBeVisible();

    // Test insufficient
    mockStatus = "insufficient";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-insufficient")).toBeVisible();
    await expect(
      page.getByText(
        "Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more evaluated Podchat sessions so Fonetik can detect a repeated pattern."
      )
    ).toBeVisible();

    // Test error
    mockStatus = "error";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-error")).toBeVisible();
    await expect(page.getByText("Could not load weakness data. Try again later.")).toBeVisible();
  });
});
