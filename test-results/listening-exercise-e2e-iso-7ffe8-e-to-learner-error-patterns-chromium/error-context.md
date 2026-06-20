# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: listening-exercise\e2e-isolation.spec.ts >> Listening Exercise - E2E Isolation & Production Hardening >> simulate complete user flow and assert zero leakage to learner_error_patterns
- Location: tests\listening-exercise\e2e-isolation.spec.ts:58:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Play Audio/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Play Audio/i })

```

```yaml
- main:
  - heading "Listening Exercise Sandbox Test Page" [level=1]
  - img
  - text: Preparing Session Downloading listening audio passage...
- alert
```

# Test source

```ts
  137 |                   answer: "Chemistry",
  138 |                   testing_fact_unit_id: "fact_1"
  139 |                 }
  140 |               ]
  141 |             }
  142 |           })
  143 |         });
  144 |       } else {
  145 |         await route.fulfill({
  146 |           status: 200,
  147 |           contentType: "application/json",
  148 |           body: JSON.stringify({
  149 |             generation_status: "ready",
  150 |             section_index: 1,
  151 |             section: {
  152 |               id: "section-1",
  153 |               topic: "Section 2 Academic Passage",
  154 |               audio_script: "Pressure decreases with altitude.",
  155 |               questions: [
  156 |                 {
  157 |                   id: "q_2",
  158 |                   question_type: "fill_blank",
  159 |                   question_text: "Pressure [blank] with altitude.",
  160 |                   answer: "decreases",
  161 |                   accepted_variants: ["drops"],
  162 |                   testing_fact_unit_id: "fact_2"
  163 |                 }
  164 |               ]
  165 |             }
  166 |           })
  167 |         });
  168 |       }
  169 |     });
  170 | 
  171 |     // 4. Mock next section trigger endpoint
  172 |     await page.route("**/api/listening-exercise/session/next", async (route) => {
  173 |       currentSectionIndex = 1;
  174 |       await route.fulfill({
  175 |         status: 200,
  176 |         contentType: "application/json",
  177 |         body: JSON.stringify({ success: true }),
  178 |       });
  179 |     });
  180 | 
  181 |     // 5. Mock TTS endpoint to return mock audio bytes
  182 |     await page.route("**/api/podchat/tts", async (route) => {
  183 |       await route.fulfill({
  184 |         status: 200,
  185 |         contentType: "audio/mpeg",
  186 |         body: Buffer.from("mocked-audio-bytes-content"),
  187 |       });
  188 |     });
  189 | 
  190 |     // 6. Mock section submit endpoints
  191 |     await page.route(new RegExp(`.*/api/listening-exercise/session/${sessionId}/sections/section-\\d+/submit`), async (route) => {
  192 |       await route.fulfill({
  193 |         status: 200,
  194 |         contentType: "application/json",
  195 |         body: JSON.stringify({ success: true }),
  196 |       });
  197 |     });
  198 | 
  199 |     // 7. Mock complete session endpoint
  200 |     await page.route(new RegExp(`.*/api/listening-exercise/session/${sessionId}/complete`), async (route) => {
  201 |       await route.fulfill({
  202 |         status: 200,
  203 |         contentType: "application/json",
  204 |         body: JSON.stringify({
  205 |           overall_score: 100,
  206 |           estimated_band: "Band 7.5",
  207 |         }),
  208 |       });
  209 |     });
  210 | 
  211 |     // Stub play method on HTMLAudioElement prototype so playback completes immediately in headless environments
  212 |     await page.addInitScript(() => {
  213 |       HTMLAudioElement.prototype.play = async function() {
  214 |         setTimeout(() => {
  215 |           const event = new Event("ended");
  216 |           this.dispatchEvent(event);
  217 |         }, 100);
  218 |         return Promise.resolve();
  219 |       };
  220 |     });
  221 | 
  222 |     // 1. Go to Sandbox Page
  223 |     await page.goto("/listening-exercise-test?mockAuth=true");
  224 | 
  225 |     // Wait for redirects, Next.js Turbopack compilation, and Clerk handshake to settle
  226 |     await page.waitForLoadState("networkidle");
  227 |     await page.waitForTimeout(2000);
  228 | 
  229 |     // 2. Click "Start Assessment"
  230 |     const startButton = page.getByRole("button", { name: /Start Assessment|Mulai Asesmen/i });
  231 |     await expect(startButton).toBeVisible();
  232 |     await startButton.click();
  233 | 
  234 |     // 3. Play audio
  235 |     const playButton = page.getByRole("button", { name: /Play Audio/i });
  236 |     try {
> 237 |       await expect(playButton).toBeVisible({ timeout: 5000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
  238 |     } catch (err) {
  239 |       console.log("[DEBUG HTML CONTENT ON FAILURE]:", await page.content());
  240 |       throw err;
  241 |     }
  242 |     await playButton.click();
  243 | 
  244 |     // 4. Fill and submit Section 1 (true_false and multiple_choice mix)
  245 |     const trueBtn = page.getByRole("button", { name: "True", exact: true });
  246 |     await expect(trueBtn).toBeVisible();
  247 |     await trueBtn.click();
  248 | 
  249 |     const chemistryBtn = page.getByRole("button", { name: "Chemistry", exact: true });
  250 |     await expect(chemistryBtn).toBeVisible();
  251 |     await chemistryBtn.click();
  252 | 
  253 |     const submitBtn = page.getByRole("button", { name: /Submit Answer/i });
  254 |     await expect(submitBtn).toBeVisible();
  255 |     await submitBtn.click();
  256 | 
  257 |     // 5. Fill and submit Section 2 (fill_blank)
  258 |     const inputField = page.locator('input[type="text"]');
  259 |     await expect(inputField).toBeVisible();
  260 |     await inputField.fill("decreases");
  261 | 
  262 |     const replayButton = page.getByRole("button", { name: /Play Audio/i });
  263 |     await expect(replayButton).toBeVisible();
  264 |     await replayButton.click();
  265 | 
  266 |     await expect(submitBtn).toBeVisible();
  267 |     await submitBtn.click();
  268 | 
  269 |     // 6. Final session summary card validation
  270 |     const overallScoreText = page.getByText("100%");
  271 |     await expect(overallScoreText).toBeVisible();
  272 | 
  273 |     const estimatedBandText = page.getByText("Band 7.5");
  274 |     await expect(estimatedBandText).toBeVisible();
  275 | 
  276 |     // 7. Verify disclaimer UI is visible
  277 |     const disclaimer = page.getByTestId("listening-disclaimer");
  278 |     await expect(disclaimer).toBeVisible();
  279 |     await expect(disclaimer).toContainText('Estimated Listening Level');
  280 |     await expect(disclaimer).toContainText('NOT a certified or officially recognized IELTS or TOEFL score');
  281 | 
  282 |     // 8. Assert DB Isolation: row count of learner_error_patterns must remain EXACTLY the same
  283 |     if (supabase) {
  284 |       const { count, error } = await supabase
  285 |         .from("learner_error_patterns")
  286 |         .select("*", { count: "exact", head: true });
  287 | 
  288 |       expect(error).toBeNull();
  289 |       expect(count).toBe(initialCount);
  290 |       console.log(`Verified DB Isolation: learner_error_patterns count remained exactly at ${count}.`);
  291 |     }
  292 |   });
  293 | });
  294 | 
```