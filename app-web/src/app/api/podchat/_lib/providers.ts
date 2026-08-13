import type { PodchatTopic, PodchatDifficulty } from "../../../lib/podchat";
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


export function openAICompatibleConfigForProvider(providerId: string): { endpoint: string; model: string } {
  const ensure = (base: string) =>
    base.endsWith("/chat/completions") ? base : `${base.replace(/\/$/, "")}/chat/completions`;
  if (providerId === "tokenrouter") {
    return {
      endpoint: ensure(process.env.TOKENROUTER_BASE_URL || "https://api.tokenrouter.com/v1"),
      model: process.env.TOKENROUTER_MODEL || "deepseek/deepseek-v4-flash-0731",
    };
  }
  if (providerId === "routeapi") {
    return {
      endpoint: ensure(process.env.ROUTEAPI_BASE_URL || "https://www.routeapi.ai/v1"),
      model: process.env.ROUTEAPI_MODEL || "deepseek-v4-flash",
    };
  }
  if (providerId === "opencode") {
    return {
      endpoint: ensure(process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1"),
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    };
  }
  if (providerId === "hermes") {
    return {
      endpoint: ensure(process.env.HERMES_BASE_URL || "http://127.0.0.1:8642/v1"),
      model: process.env.HERMES_MODEL || "deepseek-v4-flash",
    };
  }
  return {
    endpoint: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

export async function callOpenAICompatibleForProvider(
  providerId: string,
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const cfg = openAICompatibleConfigForProvider(providerId);
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
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
    console.error(`${providerId} API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new Error(`${providerId} request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}
export async function callGemini(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const actualApiKey = process.env.DEEPSEEK_API_KEY || "";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const res = await fetch((process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${actualApiKey}`,
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

export async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const res = await fetch((process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions"), {
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
