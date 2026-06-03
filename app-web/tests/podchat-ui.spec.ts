import { test, expect } from "@playwright/test";

test.describe("Podchat Phase 1 local UI", () => {
  test("runs setup, speaking, and evaluation without providers or audio capture", async ({
    page,
  }) => {
    const providerCalls: string[] = [];
    let microphoneRequested = false;

    await page.addInitScript(() => {
      const mediaDevices = {
        getUserMedia() {
          (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
            .__PODCHAT_MIC_REQUESTED__ = true;
          return Promise.reject(new Error("Microphone must not be requested"));
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });
    });

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("/api/feedback") ||
        url.includes("/api/diagnostic") ||
        url.includes("/api/podchat") ||
        url.includes("anthropic.com") ||
        url.includes("deepgram.com") ||
        url.includes("polly")
      ) {
        providerCalls.push(url);
      }
    });

    await page.goto("/");

    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Economics" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Technology" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Beginner/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Intermediate/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Advanced/ })).toBeVisible();

    await page.getByRole("radio", { name: "Economics" }).click();
    await expect(page.getByRole("radio", { name: "Economics" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radio", { name: "Technology" }).click();
    await expect(page.getByRole("radio", { name: "Technology" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("radio", { name: /Beginner/ }).click();
    await page.getByRole("radio", { name: /Advanced/ }).click();
    await expect(page.getByRole("radio", { name: /Advanced/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radio", { name: /Intermediate/ }).click();

    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();
    await expect(page.getByTestId("podchat-turn-progress")).toContainText(
      "Turn 1 of 5",
    );
    await expect(page.getByTestId("podchat-status")).toContainText("Your turn");
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText(
      "AI host",
    );

    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();
    await expect(page.getByTestId("podchat-turn-progress")).toContainText(
      "Turn 2 of 5",
    );
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText(
      "Learner",
    );

    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();
    await expect(page.getByTestId("podchat-full-transcript")).toContainText(
      "AI host",
    );
    await expect(page.getByTestId("podchat-full-transcript")).toContainText(
      "Learner",
    );
    await expect(page.getByText("Summary")).toBeVisible();
    await expect(page.getByText("Grammar notes")).toBeVisible();
    await expect(page.getByText("Better sentence examples")).toBeVisible();
    await expect(page.getByText("Vocabulary suggestions")).toBeVisible();
    await expect(page.getByText("Next practice focus")).toBeVisible();

    microphoneRequested = await page.evaluate(
      () =>
        Boolean(
          (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
            .__PODCHAT_MIC_REQUESTED__,
        ),
    );
    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));

    expect(microphoneRequested).toBe(false);
    expect(providerCalls).toEqual([]);
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);
  });
});
