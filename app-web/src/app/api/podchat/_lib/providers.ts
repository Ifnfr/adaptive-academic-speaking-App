type PodchatTopic = "Economics" | "Technology";
type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced";
type PodchatSpeaker = "host" | "learner";

type PodchatTurn = {
  speaker: PodchatSpeaker;
  text: string;
};

export type PodchatArticleContext = {
  articleTitle: string;
  articleBrief: string;
  mainIdea?: string;
  keyPoints?: string[];
  speakingTaskTitle: string;
  speakingTaskInstruction: string;
  targetStructure?: string[];
  sourceDomain?: string;
};

type MockTurnRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  turnIndex: number;
  durationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  turns: PodchatTurn[];
  articleContext?: PodchatArticleContext;
};

type MockEvaluateRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  turns: PodchatTurn[];
  articleContext?: PodchatArticleContext;
};

function mockDifficultyPhrase(difficulty: PodchatDifficulty): string {
  if (difficulty === "Beginner") return "simple everyday example";
  if (difficulty === "Intermediate") return "clear reason or example";
  return "trade-off or wider implication";
}

export function buildMockPodchatTurn(req: MockTurnRequest): string {
  if (req.articleContext) {
    return JSON.stringify({
      hostText: "Let's connect your answer to the article's main idea.",
      followUpQuestion: "What is one point from the article that you agree with?",
    });
  }

  const isClosing = req.remainingSeconds <= 60;
  const finalTurnNote = isClosing
    ? "We are nearly out of time — this is a good moment to wrap up."
    : "Let's keep the conversation moving.";

  return JSON.stringify({
    hostText: `Local mock host: your ${req.topic.toLowerCase()} point is clear. ${finalTurnNote}`,
    followUpQuestion: `Could you add one ${mockDifficultyPhrase(req.difficulty)}?`,
  });
}

export function buildMockPodchatEvaluation(req: MockEvaluateRequest): string {
  const topicLabel = req.articleContext
    ? `article "${req.articleContext.articleTitle}"`
    : req.topic.toLowerCase();

  const difficultyFocus =
    req.difficulty === "Beginner"
      ? "complete simple sentences"
      : req.difficulty === "Intermediate"
        ? "connect reasons and examples"
        : "develop nuance and trade-offs";

  return JSON.stringify({
    summary: `Local mock evaluation: you completed a Podchat about ${topicLabel} and kept your answers understandable. Your next step is to ${difficultyFocus}.`,
    corrections: [
      {
        original: "I think technology help people.",
        improved: "I think technology helps people work and study more effectively.",
        explanation:
          "Use a complete sentence with accurate verb agreement and a clearer object.",
      },
    ],
    betterSentences: [
      req.articleContext
        ? `One stronger answer about ${req.articleContext.speakingTaskTitle} would connect to the article's main idea.`
        : `One stronger ${req.difficulty.toLowerCase()} answer would connect the ${req.topic.toLowerCase()} point to a specific example.`,
    ],
    vocabularySuggestions: [
      {
        originalOrBasic: "good",
        suggestion: req.topic === "Economics" ? "beneficial" : "effective",
        example:
          req.topic === "Economics"
            ? "Lower transport costs can be beneficial for students."
            : "Digital tools can be effective when learners use them with a clear goal.",
      },
    ],
    recurringErrors: [
      {
        label: "Short explanations",
        evidence: "Some learner turns state an idea without adding a reason.",
        practiceFocus: `Add one ${mockDifficultyPhrase(req.difficulty)} before ending each answer.`,
      },
    ],
    nextPracticeFocus: req.articleContext
      ? `In your next Podchat, give one clear claim and one ${mockDifficultyPhrase(req.difficulty)} about "${req.articleContext.articleTitle}".`
      : `In your next Podchat, give one clear claim and one ${mockDifficultyPhrase(req.difficulty)} about ${req.topic.toLowerCase()}.`,
  });
}

export async function callGemini(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=` +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new Error(`Gemini request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

export async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`DeepSeek API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new Error(`DeepSeek request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}
