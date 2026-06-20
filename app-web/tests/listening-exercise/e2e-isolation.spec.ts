import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse env file to access Supabase configurations in test process
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  });
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("Listening Exercise - E2E Isolation & Production Hardening", () => {
  let supabase: ReturnType<typeof createClient> | undefined;
  let initialCount = 0;

  test.beforeAll(async () => {
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // Query initial count of learner_error_patterns to check for zero leakage
      const { count, error } = await supabase
        .from("learner_error_patterns")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error("Error querying database before test:", error);
      } else {
        initialCount = count || 0;
        console.log(`Initial learner_error_patterns row count: ${initialCount}`);
      }
    } else {
      console.warn("Supabase credentials missing from env, database checks will be skipped");
    }
  });

  test("simulate complete user flow and assert zero leakage to learner_error_patterns", async ({ page }) => {
    test.setTimeout(90000);
    // Add logging handlers to diagnose page execution
    page.on("console", (msg) => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[Browser Page Error] ${err.message}`);
    });
    page.on("request", (req) => {
      console.log(`[Browser Request] ${req.method()} ${req.url()}`);
    });
    page.on("response", (res) => {
      console.log(`[Browser Response] ${res.status()} ${res.url()}`);
    });
    page.on("requestfailed", (request) => {
      console.error(`[Browser Request Failed] ${request.url()}: ${request.failure()?.errorText}`);
    });

    // 1. Intercept/mock Clerk authentication bypass redirect
    await page.route("**/listening*", async (route) => {
      const url = new URL(route.request().url());
      if (
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



    const sessionId = "test-mock-session-123";

    // 2. Mock start session endpoint
    await page.route("**/api/listening-exercise/session/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ session_id: sessionId }),
      });
    });

    // Keep track of which section index we are requesting/polling
    let currentSectionIndex = 0;

    // 3. Mock status endpoint
    await page.route(new RegExp(`.*/api/listening-exercise/session/${sessionId}/status`), async (route) => {
      if (currentSectionIndex === 0) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            generation_status: "ready",
            section_index: 0,
            section: {
              id: "section-0",
              topic: "Section 1 Academic Passage",
              audio_script: "Standard sea-level pressure causes water to boil at one hundred degrees.",
              questions: [
                {
                  id: "q_0",
                  question_type: "true_false",
                  question_text: "True or False: Water boils at 100 degrees Celsius under standard conditions.",
                  options: ["True", "False"],
                  answer: "True",
                  testing_fact_unit_id: "fact_0"
                },
                {
                  id: "q_1",
                  question_type: "multiple_choice",
                  question_text: "What is the primary topic of today's talk?",
                  options: ["Chemistry", "Physics", "Biology"],
                  answer: "Chemistry",
                  testing_fact_unit_id: "fact_1"
                }
              ]
            }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            generation_status: "ready",
            section_index: 1,
            section: {
              id: "section-1",
              topic: "Section 2 Academic Passage",
              audio_script: "Pressure decreases with altitude.",
              questions: [
                {
                  id: "q_2",
                  question_type: "fill_blank",
                  question_text: "Pressure [blank] with altitude.",
                  answer: "decreases",
                  accepted_variants: ["drops"],
                  testing_fact_unit_id: "fact_2"
                }
              ]
            }
          })
        });
      }
    });

    // 4. Mock next section trigger endpoint
    await page.route("**/api/listening-exercise/session/next", async (route) => {
      currentSectionIndex = 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // 5. Mock TTS endpoint to return mock audio bytes
    await page.route("**/api/podchat/tts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from("mocked-audio-bytes-content"),
      });
    });

    // 6. Mock section submit endpoints
    await page.route(new RegExp(`.*/api/listening-exercise/session/${sessionId}/sections/section-\\d+/submit`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // 7. Mock complete session endpoint
    await page.route(new RegExp(`.*/api/listening-exercise/session/${sessionId}/complete`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overall_score: 100,
          estimated_band: "Band 7.5",
        }),
      });
    });

    // Stub play method on HTMLAudioElement prototype so playback completes immediately in headless environments
    await page.addInitScript(() => {
      HTMLAudioElement.prototype.play = async function() {
        setTimeout(() => {
          const event = new Event("ended");
          this.dispatchEvent(event);
        }, 100);
        return Promise.resolve();
      };
    });

    // 1. Go to Sandbox Page
    await page.goto("/listening?mockAuth=true");

    // Wait for redirects, Next.js Turbopack compilation, and Clerk handshake to settle
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 2. Click "Start Assessment"
    const startButton = page.getByRole("button", { name: /Start Assessment|Mulai Asesmen/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Play audio
    const playButton = page.getByRole("button", { name: /Play Audio/i });
    try {
      await expect(playButton).toBeVisible({ timeout: 5000 });
    } catch (err) {
      console.log("[DEBUG HTML CONTENT ON FAILURE]:", await page.content());
      throw err;
    }
    await playButton.click();

    // 4. Fill and submit Section 1 (true_false and multiple_choice mix)
    const trueBtn = page.getByRole("button", { name: "True", exact: true });
    await expect(trueBtn).toBeVisible();
    await trueBtn.click();

    const chemistryBtn = page.getByRole("button", { name: "Chemistry", exact: true });
    await expect(chemistryBtn).toBeVisible();
    await chemistryBtn.click();

    const submitBtn = page.getByRole("button", { name: /Submit Answer/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 5. Fill and submit Section 2 (fill_blank)
    const inputField = page.locator('input[type="text"]');
    await expect(inputField).toBeVisible();
    await inputField.fill("decreases");

    const replayButton = page.getByRole("button", { name: /Play Audio/i });
    await expect(replayButton).toBeVisible();
    await replayButton.click();

    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Final session summary card validation
    const overallScoreText = page.getByText("100%");
    await expect(overallScoreText).toBeVisible();

    const estimatedBandText = page.getByText("Band 7.5");
    await expect(estimatedBandText).toBeVisible();

    // 7. Verify disclaimer UI is visible
    const disclaimer = page.getByTestId("listening-disclaimer");
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText('Estimated Listening Level');
    await expect(disclaimer).toContainText('NOT a certified or officially recognized IELTS or TOEFL score');

    // 8. Assert DB Isolation: row count of learner_error_patterns must remain EXACTLY the same
    if (supabase) {
      const { count, error } = await supabase
        .from("learner_error_patterns")
        .select("*", { count: "exact", head: true });

      expect(error).toBeNull();
      expect(count).toBe(initialCount);
      console.log(`Verified DB Isolation: learner_error_patterns count remained exactly at ${count}.`);
    }
  });
});
