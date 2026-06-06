import { test, expect } from "@playwright/test";

function articleEssayQuestions() {
  return [
    {
      id: "q1",
      question: "What is the main idea of the article?",
      expectedFocus: "Summarize the central argument using article evidence.",
      targetSkill: "main_idea",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q2",
      question: "Which supporting detail best explains the article's argument?",
      expectedFocus: "Use one specific detail from the article.",
      targetSkill: "supporting_detail",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q3",
      question: "What can readers infer from the article's evidence?",
      expectedFocus: "Make a reasonable inference based on the article.",
      targetSkill: "inference",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q4",
      question: "How is one key phrase used in the article's context?",
      expectedFocus: "Explain a word or phrase using context clues.",
      targetSkill: "vocabulary_in_context",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q5",
      question: "What critical response follows from the article?",
      expectedFocus: "Give a thoughtful response connected to the article.",
      targetSkill: "critical_response",
      suggestedWordCount: { min: 50, max: 120 },
    },
  ];
}

function articlePracticeResponse() {
  return {
    sourceTitle: "Test Article Title",
    sourceUrl: "https://example.com/test-article",
    sourceDomain: "example.com",
    articleBrief: "Brief summary.",
    mainIdea: "Main idea.",
    keyPoints: ["Point 1", "Point 2"],
    usefulVocabulary: [
      { word: "synthesize", meaning: "combine", whyUseful: "academic" },
    ],
    comprehensionChecks: ["Check 1"],
    essayQuestions: articleEssayQuestions(),
    speakingTask: {
      title: "Synthesize the Findings",
      instruction: "Explain how synthesis works.",
      timeLimitSeconds: 120,
      targetStructure: ["Structure 1", "Structure 2"],
    },
    followUpQuestions: ["Follow up"],
    warnings: [],
  };
}

function articleEssayEvaluationResponse() {
  return {
    overallFeedback: "Your writing shows clear comprehension.",
    perQuestionFeedback: articleEssayQuestions().map((question) => ({
      questionId: question.id,
      comprehension: "You understood the article point.",
      topicRelevance: "The answer stays connected to the article.",
      grammarNotes: ["Use clearer verb agreement."],
      wordFormOrPartOfSpeechNotes: ["Use the noun form in this sentence."],
      sentenceStructureNotes: ["Join related ideas with a connector."],
      coherenceNotes: ["Keep the explanation in one clear sequence."],
      vocabularyNotes: ["Choose a more precise academic verb."],
      improvedAnswerExample:
        "The article suggests this issue matters because it affects learners and institutions.",
    })),
    recurringErrors: [
      {
        label: "Verb agreement",
        explanation: "Some verbs did not match the subject.",
        exampleFromUser: "Technology help students.",
        correction: "Technology helps students.",
      },
    ],
    nextWritingFocus: "Use one claim, one article detail, and one explanation.",
  };
}

function preparedArticleMarkdown() {
  return `# Article Context

## Title

Prepared AI Study Context

## Source

Class reading packet

## Short Summary

This prepared context explains how technology changes study habits, including benefits for access and risks around distraction.

## Main Idea

Technology can support learning when students use it with clear goals.

## Key Points

* Digital tools can make revision more flexible.
* Notifications can interrupt deep focus.
* Teachers can guide students toward better study routines.
* Learners need strategies for evaluating online information.
* Access to resources is useful but does not replace careful thinking.

## Important Vocabulary

* Word/Phrase: distraction
  Meaning: something that takes attention away
  Why useful: helps discuss study problems

## Debatable Issue

Whether technology improves learning more than it distracts students.

## Essay Comprehension Questions

### Q1

Question: What is the main idea?
Expected focus: Explain the central claim.
Suggested answer length: 60-100 words.

### Q2

Question: Which detail supports the argument?
Expected focus: Use a specific detail.
Suggested answer length: 60-100 words.

### Q3

Question: What can readers infer?
Expected focus: Make a reasonable inference.
Suggested answer length: 60-100 words.

### Q4

Question: What does distraction mean in context?
Expected focus: Explain vocabulary in context.
Suggested answer length: 60-100 words.

### Q5

Question: What critical response follows?
Expected focus: Give a balanced response.
Suggested answer length: 70-120 words.

## Speaking Practice Prompt

Explain whether technology helps students study better, using one benefit and one risk.

## Follow-up Discussion Questions

* What study tool helps you most?
* How can students reduce distractions?
* What role should teachers play?`;
}

test.describe("MVP Smoke Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept document requests to "/" and append mockAuth=true to bypass the cover page safely in E2E tests
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
      } else {
        await route.continue();
      }
    });
  });

  // Test A: App loads
  test("A. App loads and renders sidebar/navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("img[alt=\"fonetik logo\"]")).toBeVisible();
    await expect(page.locator("aside")).toContainText("Active Session");
    await expect(page.locator("aside")).toContainText("Vocabulary Notebook");
    await expect(page.locator("aside")).toContainText("Commonplace");
    await expect(page.locator("aside")).toContainText("Article Practice");
    await expect(page.locator("aside")).not.toContainText("Learning Path");
    await expect(page.locator("header")).toContainText("Local only");
    await expect(
      page.getByRole("button", { name: /restore cloud data|import cloud data/i }),
    ).toHaveCount(0);
  });

  test("A2. Weekly Review uses server memory instead of local session count", async ({
    page,
  }) => {
    const requestBodies: Record<string, unknown>[] = [];
    let weeklyReviewCalls = 0;

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.route("**/api/weekly-review", async (route) => {
      weeklyReviewCalls += 1;
      requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);

      if (weeklyReviewCalls === 1) {
        await route.fulfill({
          json: {
            summary:
              "You completed 1 practice session this week. Keep practicing to unlock complete review insights.",
            recurringWeakness:
              "Not enough sessions to analyze recurring weaknesses.",
            bestImprovement: "Not enough sessions to analyze improvements.",
            scoreTrend: "Not enough sessions to track score trend.",
            nextWeekFocus: "Practice consistency.",
            recommendedPlan: [
              "Day 1: Complete 1 new practice session.",
              "Day 2: Review your past feedback points.",
              "Day 3: Complete 1 new practice session.",
              "Day 4: Focus on speaking/writing without pausing.",
              "Day 5: Complete 1 new practice session.",
              "Day 6: Focus on correct subject-verb agreement.",
              "Day 7: Complete 1 new practice session.",
            ],
            warnings: [
              "Weekly Review requires at least 4 completed practice sessions. You have completed only 1.",
            ],
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          summary:
            "You completed 2 speaking sessions and 2 writing sessions this week.",
          recurringWeakness:
            "Your most recurring issue is in grammar under verb agreement.",
          bestImprovement:
            "You showed steady engagement across practice formats.",
          scoreTrend: "Score trends are stable across the week.",
          nextWeekFocus: "Use subject-verb agreement in short answers.",
          recommendedPlan: [
            "Day 1: Review your weekly review summary.",
            "Day 2: Practise verb agreement.",
            "Day 3: Complete a new practice session.",
            "Day 4: Do a short focus session.",
            "Day 5: Review past corrections.",
            "Day 6: Speak for 60 seconds.",
            "Day 7: Complete a new session.",
          ],
          warnings: [],
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Weekly Review" }).click();

    const runButton = page.getByRole("button", { name: "Run Weekly Review" });
    await expect(page.getByText("Server memory")).toBeVisible();
    await expect(page.getByText(/0\/4 completed sessions/i)).toHaveCount(0);
    await expect(runButton).toBeEnabled();

    await runButton.click();
    await expect(
      page.getByText(/Weekly Review requires at least 4 completed practice sessions/i),
    ).toBeVisible();

    await runButton.click();
    await expect(
      page.getByText("You completed 2 speaking sessions and 2 writing sessions this week."),
    ).toBeVisible();

    expect(weeklyReviewCalls).toBe(2);
    for (const body of requestBodies) {
      expect(body).not.toHaveProperty("sessions");
      expect(body).not.toHaveProperty("provider");
      expect(body).not.toHaveProperty("fullArticleText");
      expect(body).not.toHaveProperty("audioBlob");
      expect(body).not.toHaveProperty("transcript");
    }
  });

  // Test B: Podchat Phase 1 basic flow
  test("B. Podchat Phase 1 local flow without providers or audio", async ({
    page,
  }) => {
    const providerCalls: string[] = [];

    await page.addInitScript(() => {
      const customWin = window as unknown as Record<string, unknown>;
      customWin.__PODCHAT_MIC_REQUESTED__ = false;
      customWin.__PODCHAT_MIC_DENY__ = false;

      class MockMediaStreamTrack {
        kind = "audio";
        enabled = true;
        stop() {}
      }

      class MockMediaStream {
        _tracks = [new MockMediaStreamTrack()];
        getTracks() {
          return this._tracks;
        }
      }

      const mediaDevices = {
        async getUserMedia() {
          const w = window as unknown as Record<string, unknown>;
          w.__PODCHAT_MIC_REQUESTED__ = true;
          return new MockMediaStream();
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });

      class MockMediaRecorder {
        stream: unknown;
        options?: unknown;
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        mimeType = "audio/webm";

        constructor(stream: unknown, options?: unknown) {
          this.stream = stream;
          this.options = options;
        }

        static isTypeSupported(type: string) {
          return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"].includes(type);
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          if (this.ondataavailable) {
            const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
            this.ondataavailable({ data: mockBlob });
          }
          if (this.onstop) {
            setTimeout(() => {
              if (this.onstop) this.onstop();
            }, 0);
          }
        }
      }
      (window as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;
    });

    // Mock STT Route
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "I think prices affect daily decisions because people compare what they want with what they can afford."
        })
      });
    });

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("anthropic.com") ||
        url.includes("deepgram.com") ||
        url.includes("polly")
      ) {
        providerCalls.push(url);
      }
    });

    // Mock API Turn Route
    await page.route("**/api/podchat/turn", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a mocked host response.",
          followUpQuestion: "What is your next point?"
        })
      });
    });

    // Mock API Evaluate Route
    await page.route("**/api/podchat/evaluate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: "This is a mocked summary evaluation.",
          corrections: [
            { original: "wrong grammar", improved: "correct grammar", explanation: "Because of rules." }
          ],
          betterSentences: ["Better academic sentence."],
          vocabularySuggestions: [
            { originalOrBasic: "good", suggestion: "excellent", example: "It is excellent." }
          ],
          recurringErrors: [
            { label: "Grammar mistake", evidence: "wrong grammar", practiceFocus: "Practice rules." }
          ],
          nextPracticeFocus: "Focus on academic vocabulary."
        })
      });
    });

    await page.goto("/");

    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await page.getByRole("radio", { name: "Economics" }).click();
    await expect(page.getByRole("radio", { name: "Economics" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radio", { name: /Advanced/ }).click();
    await expect(page.getByRole("radio", { name: /Advanced/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();
    // Duration-based session: time left shown instead of turn count
    await expect(page.getByTestId("podchat-time-left")).toBeVisible();
    await expect(page.getByTestId("podchat-time-left")).toContainText("Time left:");
    await expect(page.getByTestId("podchat-turns-completed")).toContainText("Turns completed:");
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
    await page.getByTestId("podchat-submit-turn").click();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText(
      "Learner",
    );
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();
    await expect(page.getByTestId("podchat-evaluation-success")).toBeVisible();

    const microphoneRequested = await page.evaluate(() =>
      Boolean(
        (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
          .__PODCHAT_MIC_REQUESTED__,
      ),
    );
    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));

    expect(microphoneRequested).toBe(true);
    expect(providerCalls).toEqual([]);
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);
  });

  // Test C: Vocabulary Notebook
  test("C. Vocabulary Notebook basic operations", async ({ page }) => {
    // Intercept vocabulary correction API
    await page.route("**/api/vocabulary-correction", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "natural",
          explanation: "Good usage of clarify.",
          correctedSentence: "Let me clarify this issue.",
          collocationTip: "clarify the meaning, clarify the context",
          retryInstruction: "Try another context.",
          targetUsageRole:
            "Here, clarify functions as a verb meaning to make something clear.",
          warnings: [],
        }),
      });
    });

    await page.goto("/");

    // Navigate to Vocabulary Notebook
    await page.click("button:has-text(\"Vocabulary Notebook\")");

    // Fill word and meaning
    await page.locator("#vocab-word").fill("clarify");
    await page.locator("#vocab-meaning").fill("to make clear");
    await page.click("button:has-text(\"Add Vocabulary\")");

    // Verify word added to recent preview
    await expect(page.locator("p:has-text(\"clarify\")").first()).toBeVisible();

    // Active recall opens a fixed practice card
    await page.click("button:has-text(\"Start Practice\")");
    await expect(page.locator("text=Card 1 of 1")).toBeVisible();
    await expect(page.locator("h3:has-text(\"clarify\")")).toBeVisible();

    // Sentence practice without word should fail validation
    await page.locator("#vocab-sentence").fill("I want to explain the details.");
    await page.click("button:has-text(\"Submit Sentence\")");
    await expect(page.locator("p[role=\"status\"]")).toContainText(
      "Use the vocabulary word in your sentence first.",
    );

    // Sentence practice with word should succeed
    await page.locator("#vocab-sentence").fill("I want to clarify the details.");
    await page.click("button:has-text(\"Submit Sentence\")");
    await expect(page.locator("p[role=\"status\"]")).toContainText(
      "Sentence saved.",
    );

    // Sentence should appear under saved list, click Check Usage
    await page.click("button:has-text(\"Check Usage\")");

    // Correction feedback should load and display
    await expect(page.locator("span:has-text(\"Natural\")")).toBeVisible();
    await expect(
      page.locator("p:has-text(\"Good usage of clarify.\")"),
    ).toBeVisible();
    await expect(
      page.locator("text=Target role in your sentence"),
    ).toBeVisible();

    // Complete the recall session, then open full dictionary management
    await page.click("button:has-text(\"Finish Session\")");
    await expect(page.locator("h3:has-text(\"Session complete\")")).toBeVisible();
    await expect(
      page.locator("text=Completion XP requires 5 saved sentences"),
    ).toBeVisible();
    await page.click("button:has-text(\"Back to Vocabulary Notebook\")");
    await page.click("button:has-text(\"View All / Manage Vocabulary\")");
    await expect(page.locator("h3:has-text(\"All vocabulary\")")).toBeVisible();
    await expect(page.locator("text=Sentence history: 1")).toBeVisible();

    // Delete item from dictionary mode
    await page.click("button:has-text(\"Delete\")");
    await expect(page.locator("p:has-text(\"clarify\")").first()).not.toBeVisible();
  });

  // Test D: Article Practice UI
  test("D. Article Practice view loads and accepts input", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");

    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();
    await expect(page.locator("#article-url")).toBeVisible();
    await expect(page.locator("#article-focus")).toBeVisible();
    await expect(
      page.locator("button:has-text(\"Generate Practice\")"),
    ).toBeVisible();
    await page.getByRole("button", { name: "What article links work best?" }).click();
    await expect(page.getByText("Try public article pages from...")).toBeVisible();
  });

  test("D2. Article Writing Practice renders, validates, and evaluates compact payload", async ({
    page,
  }) => {
    const evaluatePayloads: unknown[] = [];

    await page.route("**/api/article-practice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articlePracticeResponse()),
      });
    });

    await page.route("**/api/article-essay-evaluate", async (route) => {
      evaluatePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articleEssayEvaluationResponse()),
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");
    await page.locator("#article-url").fill("https://example.com/test-article");
    await page.click("button:has-text(\"Generate Practice\")");

    const writingPractice = page.getByTestId("article-writing-practice");
    await expect(writingPractice).toBeVisible();
    await expect(page.getByTestId("article-essay-question-card")).toHaveCount(5);
    await expect(writingPractice.getByText("Main idea", { exact: true })).toBeVisible();
    await expect(
      writingPractice.getByText("Supporting detail", { exact: true }),
    ).toBeVisible();
    await expect(writingPractice.getByText("Inference", { exact: true })).toBeVisible();
    await expect(
      writingPractice.getByText("Vocabulary in context", { exact: true }),
    ).toBeVisible();
    await expect(
      writingPractice.getByText("Critical response", { exact: true }),
    ).toBeVisible();

    const submitButton = page.getByRole("button", {
      name: "Evaluate My Writing",
    });
    await expect(submitButton).toBeDisabled();

    for (const question of articleEssayQuestions()) {
      await page
        .locator(`#article-essay-answer-${question.id}`)
        .fill(`Answer for ${question.id} using article evidence.`);
    }
    await expect(submitButton).toBeEnabled();

    await page.locator("#article-essay-answer-q1").fill("x".repeat(1201));
    await expect(page.getByText("1201/1200 characters")).toBeVisible();
    await expect(page.getByText("Answer must be 1200 characters or fewer.")).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await page
      .locator("#article-essay-answer-q1")
      .fill("Answer for q1 using article evidence.");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const evaluationPanel = page.getByTestId("article-writing-evaluation");
    await expect(evaluationPanel).toBeVisible();
    await expect(page.getByText("Your writing shows clear comprehension.")).toBeVisible();
    await expect(evaluationPanel).toContainText("Comprehension");
    await expect(evaluationPanel).toContainText("Topic relevance / substance");
    await expect(evaluationPanel).toContainText("Grammar notes");
    await expect(evaluationPanel).toContainText("Word form / part of speech notes");
    await expect(evaluationPanel).toContainText("Sentence structure notes");
    await expect(evaluationPanel).toContainText("Coherence notes");
    await expect(evaluationPanel).toContainText("Vocabulary / word choice notes");
    await expect(evaluationPanel).toContainText("Improved answer example");
    await expect(evaluationPanel).toContainText("Verb agreement");
    await expect(evaluationPanel).toContainText(
      "Use one claim, one article detail, and one explanation.",
    );
    await expect(evaluationPanel).not.toContainText("Score");

    expect(evaluatePayloads).toHaveLength(1);
    const payload = evaluatePayloads[0] as Record<string, unknown>;
    expect(payload.provider).toBe("Claude");
    expect(payload.level).toBe("Intermediate");
    expect(payload.feedbackLanguage).toBe("English");
    expect(payload.targetLanguage).toBe("English");
    expect(payload.articleContext).toEqual({
      sourceTitle: "Test Article Title",
      articleBrief: "Brief summary.",
      mainIdea: "Main idea.",
      keyPoints: ["Point 1", "Point 2"],
    });
    expect(payload.questions).toEqual(articleEssayQuestions());
    expect(payload.answers).toEqual(
      articleEssayQuestions().map((question) => ({
        questionId: question.id,
        answer: `Answer for ${question.id} using article evidence.`,
      })),
    );

    const serializedPayload = JSON.stringify(payload).toLowerCase();
    for (const forbidden of [
      "fullarticletext",
      "sourceurl",
      "useridentity",
      "storagepath",
      "audio",
      "stt",
      "tts",
      "transcript",
      "files",
    ]) {
      expect(serializedPayload).not.toContain(forbidden);
    }
  });

  test("D3. Article Writing Practice failure shows safe error and preserves answers", async ({
    page,
  }) => {
    await page.route("**/api/article-practice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articlePracticeResponse()),
      });
    });

    await page.route("**/api/article-essay-evaluate", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "raw provider failure" }),
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");
    await page.locator("#article-url").fill("https://example.com/test-article");
    await page.click("button:has-text(\"Generate Practice\")");

    for (const question of articleEssayQuestions()) {
      await page
        .locator(`#article-essay-answer-${question.id}`)
        .fill(`Saved answer for ${question.id}.`);
    }

    await page.getByRole("button", { name: "Evaluate My Writing" }).click();

    await expect(
      page.getByText("Writing evaluation failed. Please try again."),
    ).toBeVisible();
    await expect(page.locator("#article-essay-answer-q1")).toHaveValue(
      "Saved answer for q1.",
    );
  });

  test("D4. Prepared Markdown Context mode uploads markdown and sends compact request", async ({
    page,
  }) => {
    const articlePayloads: unknown[] = [];

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText(value: string) {
            (window as unknown as { __COPIED_MARKDOWN_PROMPT__?: string })
              .__COPIED_MARKDOWN_PROMPT__ = value;
          },
        },
      });
    });

    await page.route("**/api/article-practice", async (route) => {
      articlePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...articlePracticeResponse(),
          sourceTitle: "Prepared AI Study Context",
          sourceUrl: "prepared-markdown-context",
          sourceDomain: "Prepared Markdown",
        }),
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");
    await page.getByLabel("Prepared Markdown Context").check();

    await expect(page.getByTestId("article-markdown-input")).toBeVisible();
    await expect(
      page.getByText("Use a prepared Article Context Markdown"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Prompt for another AI/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy prompt" })).toBeVisible();
    await page.getByRole("button", { name: /Prompt for another AI/ }).click();
    await expect(page.getByLabel("Prompt for another AI")).toHaveValue(
      /Convert the reading material I provide into clean Article Context Markdown text/,
    );
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect(page.getByText("Prompt copied.")).toBeVisible();
    const copiedPrompt = await page.evaluate(
      () =>
        (window as unknown as { __COPIED_MARKDOWN_PROMPT__?: string })
          .__COPIED_MARKDOWN_PROMPT__,
    );
    expect(copiedPrompt).toContain(
      "Convert the reading material I provide into clean Article Context Markdown text.",
    );
    expect(copiedPrompt).toContain("Do not create a file.");
    expect(copiedPrompt).toContain(
      "Do not use tools, skills, code, or file-generation features.",
    );
    expect(copiedPrompt).toContain("Output only the final Markdown content.");
    expect(copiedPrompt).toContain(
      'Return only the Markdown content starting with "# Article Context".',
    );
    expect(articlePayloads).toHaveLength(0);

    await page.locator("#article-markdown-file").setInputFiles({
      name: "reading.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("# Article Context"),
    });
    await expect(page.getByText("Only .md files are supported.")).toBeVisible();

    const markdown = preparedArticleMarkdown();
    await page.locator("#article-markdown-file").setInputFiles({
      name: "reading.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(markdown),
    });
    await expect(page.locator("#article-markdown")).toHaveValue(markdown);
    await expect(page.getByText("Only .md files are supported.")).toHaveCount(0);

    await page.click("button:has-text(\"Generate Practice\")");

    await expect(
      page.locator("dd").filter({ hasText: "Prepared AI Study Context" }),
    ).toBeVisible();
    await expect(page.getByTestId("article-writing-practice")).toBeVisible();
    expect(articlePayloads).toHaveLength(1);

    const payload = articlePayloads[0] as Record<string, unknown>;
    expect(payload.inputMode).toBe("markdown");
    expect(payload.preparedContextMarkdown).toBe(markdown);
    expect(payload).not.toHaveProperty("url");

    const serializedPayload = JSON.stringify(payload).toLowerCase();
    for (const forbidden of [
      "sourceurl",
      "fullarticletext",
      "audio",
      "stt",
      "tts",
      "transcript",
      "storagepath",
    ]) {
      expect(serializedPayload).not.toContain(forbidden);
    }
  });

  // Test E: Gamification UI
  test("E. Gamification UI renders without crash", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text(\"Progress\")");

    // Should render Speaker Level panel and claim button
    await expect(page.locator("p:has-text(\"Speaker Level\")").first()).toBeVisible();
    await expect(page.locator("button:has-text(\"Claim XP\")")).toBeVisible();
  });

  // Test F: Article -> Podchat navigation
  test("F. Article Practice opens Podchat with compact context and runs speaking task", async ({
    page,
  }) => {
    const turnPayloads: unknown[] = [];
    const evaluatePayloads: unknown[] = [];

    await page.addInitScript(() => {
      const customWin = window as unknown as Record<string, unknown>;
      customWin.__PODCHAT_MIC_REQUESTED__ = false;
      customWin.__PODCHAT_MIC_DENY__ = false;

      class MockMediaStreamTrack {
        kind = "audio";
        enabled = true;
        stop() {}
      }

      class MockMediaStream {
        _tracks = [new MockMediaStreamTrack()];
        getTracks() {
          return this._tracks;
        }
      }

      const mediaDevices = {
        async getUserMedia() {
          const w = window as unknown as Record<string, unknown>;
          w.__PODCHAT_MIC_REQUESTED__ = true;
          return new MockMediaStream();
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });

      class MockMediaRecorder {
        stream: unknown;
        options?: unknown;
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        mimeType = "audio/webm";

        constructor(stream: unknown, options?: unknown) {
          this.stream = stream;
          this.options = options;
        }

        static isTypeSupported(type: string) {
          return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"].includes(type);
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          if (this.ondataavailable) {
            const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
            this.ondataavailable({ data: mockBlob });
          }
          if (this.onstop) {
            setTimeout(() => {
              if (this.onstop) this.onstop();
            }, 0);
          }
        }
      }
      (window as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;
    });

    // Intercept article-practice API
    await page.route("**/api/article-practice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articlePracticeResponse()),
      });
    });

    // Mock STT Route
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "This is my spoken response about the article task."
        })
      });
    });

    // Mock API Turn Route
    await page.route("**/api/podchat/turn", async (route) => {
      turnPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a mocked host response about the article.",
          followUpQuestion: "What is your next point?"
        })
      });
    });

    // Mock API Evaluate Route
    await page.route("**/api/podchat/evaluate", async (route) => {
      evaluatePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: "This is a mocked summary evaluation of the article task.",
          corrections: [
            { original: "wrong grammar", improved: "correct grammar", explanation: "Because of rules." }
          ],
          betterSentences: ["Better academic sentence."],
          vocabularySuggestions: [
            { originalOrBasic: "good", suggestion: "excellent", example: "It is excellent." }
          ],
          recurringErrors: [
            { label: "Grammar mistake", evidence: "wrong grammar", practiceFocus: "Practice rules." }
          ],
          nextPracticeFocus: "Focus on academic vocabulary."
        })
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");

    // Fill URL and generate practice
    await page.locator("#article-url").fill("https://example.com/test-article");
    await page.click("button:has-text(\"Generate Practice\")");

    // Verify generated task title is visible
    await expect(
      page.locator("h4:has-text(\"Synthesize the Findings\")"),
    ).toBeVisible();

    // Click bridge button
    await page.click("button:has-text(\"Practice This Speaking Task\")");

    // Assert Podchat shows article-context setup card
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByTestId("podchat-article-context-card")).toBeVisible();
    await expect(page.getByText("This Podchat will discuss your article speaking task.")).toBeVisible();

    // Assert generic topic cards are not the main setup in article-context mode
    await expect(page.getByRole("radio", { name: "Economics" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Technology" })).toHaveCount(0);

    // Start Podchat
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();

    // Complete one recording/STT flow
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
    await page.getByTestId("podchat-submit-turn").click();

    // Assert /api/podchat/turn payload
    expect(turnPayloads).toHaveLength(1);
    const turnPayload = turnPayloads[0] as Record<string, unknown>;
    expect(turnPayload).toHaveProperty("articleContext");
    const articleCtx = turnPayload.articleContext as Record<string, unknown>;
    expect(articleCtx.articleTitle).toBe("Test Article Title");
    expect(articleCtx.articleBrief).toBe("Brief summary.");
    expect(articleCtx.speakingTaskTitle).toBe("Synthesize the Findings");
    expect(articleCtx.speakingTaskInstruction).toBe("Explain how synthesis works.");

    // Assert payload does NOT include forbidden fields
    const turnSerialized = JSON.stringify(turnPayload).toLowerCase();
    for (const forbidden of [
      "sourceurl",
      "raw markdown",
      "fullarticletext",
      "useridentity",
      "storagepath",
      "files",
      "audio",
    ]) {
      expect(turnSerialized).not.toContain(forbidden);
    }

    // End session
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();
    await expect(page.getByTestId("podchat-evaluation-success")).toBeVisible();

    // Assert /api/podchat/evaluate payload
    expect(evaluatePayloads).toHaveLength(1);
    const evaluatePayload = evaluatePayloads[0] as Record<string, unknown>;
    expect(evaluatePayload).toHaveProperty("articleContext");
    const evalArticleCtx = evaluatePayload.articleContext as Record<string, unknown>;
    expect(evalArticleCtx.articleTitle).toBe("Test Article Title");

    const evalSerialized = JSON.stringify(evaluatePayload).toLowerCase();
    for (const forbidden of [
      "sourceurl",
      "raw markdown",
      "fullarticletext",
      "useridentity",
      "storagepath",
      "files",
      "audio",
    ]) {
      expect(evalSerialized).not.toContain(forbidden);
    }
  });

  test("G. Global AI Provider Setting flow", async ({ page }) => {
    // 1. App loads settings page and renders Default AI Provider
    await page.goto("/");
    await page.click("button:has-text(\"Settings\")");
    await expect(page.locator("h2:has-text(\"Default AI Provider\")")).toBeVisible();
    await expect(page.locator("#default-ai-provider-select")).toBeVisible();
    await expect(page.locator("#default-ai-provider-select")).toHaveValue("Claude");

    // 2. Dropdown includes Claude, Gemini, DeepSeek, and NOT Mock
    const options = await page.locator("#default-ai-provider-select option").allTextContents();
    expect(options).toEqual(["Claude", "Gemini", "DeepSeek"]);
    expect(options).not.toContain("Mock");

    // 3. No API key input appears
    await expect(page.locator("input[placeholder*=\"API Key\"], input[placeholder*=\"api-key\"]")).toHaveCount(0);

    // 4. User can select Gemini
    await page.locator("#default-ai-provider-select").selectOption("Gemini");
    await expect(page.locator("#default-ai-provider-select")).toHaveValue("Gemini");

    // 5. LocalStorage persists it and does not contain API keys
    const storageVal = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageVal).toContain('"defaultAiProvider":"Gemini"');
    expect(storageVal).not.toMatch(/api_key|apikey|secret|token/i);

    // 6. Refresh page and confirm selection persists
    await page.reload();
    await page.click("button:has-text(\"Settings\")");
    await expect(page.locator("#default-ai-provider-select")).toHaveValue("Gemini");

    // 7. Test unknown localStorage value is ignored/sanitized
    await page.evaluate(() => {
      localStorage.setItem("defaultAiProvider", "InvalidProviderValue");
    });
    await page.reload();
    await page.click("button:has-text(\"Settings\")");
    // Should fallback to default (Claude)
    await expect(page.locator("#default-ai-provider-select")).toHaveValue("Claude");

    // 8. Test localStorage value "Mock" sanitizes to Claude
    await page.evaluate(() => {
      localStorage.setItem("defaultAiProvider", "Mock");
    });
    await page.reload();
    await page.click("button:has-text(\"Settings\")");
    await expect(page.locator("#default-ai-provider-select")).toHaveValue("Claude");
  });

  test("H. AI requests use the selected global AI provider", async ({ page }) => {
    const articlePayloads: unknown[] = [];
    const evaluatePayloads: unknown[] = [];

    // Intercept article-practice API
    await page.route("**/api/article-practice", async (route) => {
      articlePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articlePracticeResponse()),
      });
    });

    // Intercept article-essay-evaluate API
    await page.route("**/api/article-essay-evaluate", async (route) => {
      evaluatePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(articleEssayEvaluationResponse()),
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Settings\")");
    // Change to Gemini
    await page.locator("#default-ai-provider-select").selectOption("Gemini");

    // Navigate to Article Practice
    await page.click("button:has-text(\"Article Practice\")");
    await page.locator("#article-url").fill("https://example.com/test-article-settings");
    await page.click("button:has-text(\"Generate Practice\")");

    // Verify Article Practice payload used Gemini
    expect(articlePayloads).toHaveLength(1);
    expect((articlePayloads[0] as { provider: string }).provider).toBe("Gemini");

    // Fill answers and evaluate
    for (const question of articleEssayQuestions()) {
      await page
        .locator(`#article-essay-answer-${question.id}`)
        .fill(`Answer for ${question.id}.`);
    }
    await page.getByRole("button", { name: "Evaluate My Writing" }).click();

    // Verify Article Essay Evaluation payload used Gemini
    expect(evaluatePayloads).toHaveLength(1);
    expect((evaluatePayloads[0] as { provider: string }).provider).toBe("Gemini");
  });
});
