import { NextResponse } from "next/server";
import {
  callDeepSeek,
  callGemini,
  type PodchatArticleContext,
} from "../_lib/providers";
import {
  TOPICS,
  DIFFICULTIES,
  type PodchatTopic,
  type PodchatDifficulty,
  type PodchatSessionMode,
} from "../../../lib/podchat";
import { resolveFeatureProvider } from "../../../lib/ai-provider-resolver";

export const runtime = "nodejs";

const MAX_BUBBLE_TEXT_LENGTH = 1200;
const MAX_QUESTION_LENGTH = 1200;
const MAX_TRANSCRIPT_LENGTH = 8000;

export type PodchatBubbleEvaluation = {
  status: "excellent" | "good" | "needs_improvement";
  score: number;
  message: string;
  strengths: string[];
  improvements: string[];
  suggestion: string;
};

type PodchatBubbleTurn = {
  speaker: "host" | "learner";
  text: string;
};

type PodchatBubbleEvaluateRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  sessionMode: PodchatSessionMode;
  bubble: PodchatBubbleTurn;
  turns: PodchatBubbleTurn[];
  articleContext?: PodchatArticleContext;
};

type ValidationResult =
  | { valid: true; request: PodchatBubbleEvaluateRequest }
  | { valid: false; error: string };

function validateArticleContext(
  context: unknown,
): { valid: true; value: PodchatArticleContext } | { valid: false; error: string } {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { valid: false, error: "articleContext must be an object." };
  }
  const c = context as Record<string, unknown>;
  const allowedKeys = [
    "articleTitle",
    "articleBrief",
    "mainIdea",
    "keyPoints",
    "speakingTaskTitle",
    "speakingTaskInstruction",
    "targetStructure",
    "sourceDomain",
  ];
  for (const key of Object.keys(c)) {
    if (!allowedKeys.includes(key)) {
      return { valid: false, error: `Unexpected field '${key}' in articleContext.` };
    }
  }
  const articleTitle = c.articleTitle;
  if (typeof articleTitle !== "string" || articleTitle.trim().length === 0) {
    return { valid: false, error: "articleTitle must be a non-empty string." };
  }
  const articleBrief = c.articleBrief;
  if (typeof articleBrief !== "string" || articleBrief.trim().length === 0) {
    return { valid: false, error: "articleBrief must be a non-empty string." };
  }
  return {
    valid: true,
    value: {
      articleTitle: articleTitle.trim().slice(0, 160),
      articleBrief: articleBrief.trim().slice(0, 1200),
      mainIdea: typeof c.mainIdea === "string" ? (c.mainIdea as string).trim().slice(0, 400) : undefined,
      keyPoints: Array.isArray(c.keyPoints)
        ? (c.keyPoints as unknown[]).filter((kp) => typeof kp === "string").slice(0, 6).map((kp) => String(kp).trim().slice(0, 240))
        : undefined,
      speakingTaskTitle: typeof c.speakingTaskTitle === "string" ? (c.speakingTaskTitle as string).trim().slice(0, 160) : "",
      speakingTaskInstruction: typeof c.speakingTaskInstruction === "string" ? (c.speakingTaskInstruction as string).trim().slice(0, 800) : "",
      targetStructure: Array.isArray(c.targetStructure)
        ? (c.targetStructure as unknown[]).filter((ts) => typeof ts === "string").slice(0, 6).map((ts) => String(ts).trim().slice(0, 160))
        : undefined,
      sourceDomain: typeof c.sourceDomain === "string" ? (c.sourceDomain as string).trim().slice(0, 160) : undefined,
    },
  };
}

function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const topic = b.topic as string;
  if (!TOPICS.includes(topic as PodchatTopic)) {
    return { valid: false, error: "Invalid topic." };
  }
  const difficulty = b.difficulty as string;
  if (!DIFFICULTIES.includes(difficulty as PodchatDifficulty)) {
    return { valid: false, error: "Invalid difficulty." };
  }
  const sessionMode: PodchatSessionMode =
    b.sessionMode === "context_open_ended" ? "context_open_ended" : "normal_timed";

  const bubble = b.bubble as unknown;
  if (!bubble || typeof bubble !== "object") {
    return { valid: false, error: "bubble must be an object." };
  }
  const bubbleTurn = bubble as Record<string, unknown>;
  if (bubbleTurn.speaker !== "learner") {
    return { valid: false, error: "bubble.speaker must be 'learner'." };
  }
  if (typeof bubbleTurn.text !== "string" || bubbleTurn.text.trim().length === 0) {
    return { valid: false, error: "bubble.text must be a non-empty string." };
  }
  const bubbleText = bubbleTurn.text.trim();
  if (bubbleText.length > MAX_BUBBLE_TEXT_LENGTH) {
    return { valid: false, error: "bubble.text exceeds 1200 characters." };
  }

  const turns = b.turns;
  if (!Array.isArray(turns) || turns.length === 0) {
    return { valid: false, error: "turns must be a non-empty array." };
  }
  let transcriptLength = 0;
  let hostTurnCount = 0;
  let learnerTurnCount = 0;
  const normalizedTurns: PodchatBubbleTurn[] = [];
  for (let i = 0; i < turns.length; i++) {
    const rawTurn = turns[i] as unknown;
    if (!rawTurn || typeof rawTurn !== "object") {
      return { valid: false, error: `Turn at index ${i} is not an object.` };
    }
    const turn = rawTurn as Record<string, unknown>;
    if (turn.speaker !== "host" && turn.speaker !== "learner") {
      return { valid: false, error: `Turn at index ${i} has invalid speaker.` };
    }
    if (typeof turn.text !== "string" || turn.text.trim().length === 0) {
      return { valid: false, error: `Turn at index ${i} has empty text.` };
    }
    const text = turn.text.trim();
    if (text.length > MAX_QUESTION_LENGTH) {
      return { valid: false, error: `Turn at index ${i} text exceeds 1200 characters.` };
    }
    if (turn.speaker === "host") hostTurnCount++;
    else learnerTurnCount++;
    transcriptLength += text.length;
    normalizedTurns.push({ speaker: turn.speaker, text });
  }
  if (hostTurnCount < 1) {
    return { valid: false, error: "At least one host turn is required." };
  }
  if (learnerTurnCount < 1) {
    return { valid: false, error: "At least one learner turn is required." };
  }
  if (transcriptLength > MAX_TRANSCRIPT_LENGTH) {
    return { valid: false, error: "Transcript text is too long. Keep it under 8000 characters." };
  }

  let articleContext: PodchatArticleContext | undefined;
  if (b.articleContext !== undefined) {
    const valResult = validateArticleContext(b.articleContext);
    if (!valResult.valid) {
      return { valid: false, error: valResult.error };
    }
    articleContext = valResult.value;
  }

  return {
    valid: true,
    request: {
      topic: topic as PodchatTopic,
      difficulty: difficulty as PodchatDifficulty,
      sessionMode,
      bubble: { speaker: "learner", text: bubbleText },
      turns: normalizedTurns,
      articleContext,
    },
  };
}

function buildMockBubbleEvaluation(
  req: PodchatBubbleEvaluateRequest,
): string {
  const wordCount = req.bubble.text.split(/\s+/).filter((w) => w.length > 0).length;
  const developed = wordCount >= 12;
  const focusedOnTopic = /technology|econom|education|environment|health|debate|article|idea|point/i.test(
    req.bubble.text,
  );
  const status: "excellent" | "good" | "needs_improvement" = developed && focusedOnTopic
    ? "excellent"
    : developed
      ? "good"
      : "needs_improvement";
  return JSON.stringify({
    status,
    score: status === "excellent" ? 85 : status === "good" ? 70 : 55,
    message: status === "excellent"
      ? `Clear, developed answer about ${req.topic.toLowerCase()}.`
      : status === "good"
        ? "You made a solid point. Add one reason or example to develop it further."
        : "Your answer was too brief. Expand with a reason and an example.",
    strengths: focusedOnTopic
      ? ["Stays on the topic of the conversation.", "Uses a complete sentence."]
      : ["Speaks in a full sentence."],
    improvements: developed
      ? ["Could add a specific example to strengthen the point."]
      : ["Extend beyond one sentence by adding a reason or example."],
    suggestion: `Next time, add one ${req.difficulty.toLowerCase()} example to develop your idea about ${req.topic.toLowerCase()}.`,
  });
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function readShortString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function normalizeStringArray(raw: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(raw) || raw.length > maxItems) return null;
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > 400) return null;
    result.push(trimmed);
  }
  return result;
}

function validateBubbleOutput(
  text: string,
):
  | { valid: true; response: PodchatBubbleEvaluation }
  | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    const status = data.status;
    if (status !== "excellent" && status !== "good" && status !== "needs_improvement") {
      return { valid: false, error: "Provider response has invalid status." };
    }
    const score = data.score;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
      return { valid: false, error: "Provider response has invalid score." };
    }
    const message = readShortString(data, "message", 400);
    const strengths = normalizeStringArray(data.strengths, 4);
    const improvements = normalizeStringArray(data.improvements, 4);
    const suggestion = readShortString(data, "suggestion", 400);
    if (!message || !strengths || !improvements || !suggestion) {
      return { valid: false, error: "Provider response schema is invalid." };
    }
    return {
      valid: true,
      response: { status, score, message, strengths, improvements, suggestion },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse provider output: ${message}` };
  }
}

function buildSystemPrompt(req: PodchatBubbleEvaluateRequest): string {
  const contextLines: string[] = [];
  if (req.articleContext) {
    const ac = req.articleContext;
    contextLines.push(
      `The conversation was based on the article: "${ac.articleTitle}" (Domain: ${ac.sourceDomain || "unknown"}).`,
      `Article Brief: ${ac.articleBrief}`,
      ac.mainIdea ? `Article Main Idea: ${ac.mainIdea}` : "",
      `Speaking Task: "${ac.speakingTaskTitle}"`,
      `Speaking Task Instruction: ${ac.speakingTaskInstruction}`,
      "",
      "CONTEXT PARSING SAFEGUARD: Evaluate the learner's response strictly against this context. Do NOT hallucinate criteria not present in the context.",
    );
  }
  return [
    "You are an academic speaking coach evaluating ONE bubble (utterance) from a Podchat conversation.",
    "Evaluate the learner's SPOKEN English in this bubble only, grounded in the surrounding transcript.",
    ...contextLines,
    `Topic: ${req.topic}`,
    `Difficulty: ${req.difficulty}`,
    req.sessionMode === "context_open_ended"
      ? "SESSION MODE: Context Discussion / Open-ended."
      : "SESSION MODE: Normal timed Podchat.",
    "",
    "EVALUATION BEHAVIOR:",
    "- Evaluate SPOKEN English, not written English. Do not penalize homophones, punctuation, or STT glitches.",
    "- Be supportive, precise, and practical.",
    "- Do not return ratings for other bubbles; focus only on the provided bubble.",
    "",
    "TRANSCRIPT GROUNDING RULE:",
    "- Reference specific words from the learner's bubble in strengths/improvements.",
    "- Do not give generic feedback that could apply to any learner.",
    "",
    "OUTPUT FORMAT: Respond with ONLY a single JSON object (no markdown fences). Exactly these keys:",
    '  "status" ("excellent" | "good" | "needs_improvement"),',
    '  "score" (0-100 integer),',
    '  "message" (one supportive sentence specific to this bubble, <= 400 chars),',
    '  "strengths" (array of up to 3 specific strengths, each <= 200 chars),',
    '  "improvements" (array of up to 3 specific improvements, each <= 200 chars),',
    '  "suggestion" (one concrete next-step suggestion, <= 400 chars).',
    "- Do not include any other keys.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(req: PodchatBubbleEvaluateRequest): string {
  const formattedTurns = req.turns
    .map((turn) => {
      const label = turn.speaker === "host" ? "AI Host" : "Learner";
      return `${label}: ${turn.text}`;
    })
    .join("\n\n");
  return [
    "PODCHAT TRANSCRIPT:",
    formattedTurns,
    "",
    "BUBBLE TO EVALUATE (learner's utterance):",
    req.bubble.text,
    "",
    "TASK:",
    "Evaluate this single learner bubble against the conversation. Return only the required JSON object.",
  ].join("\n");
}

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateRequest(parsedBody);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const req = validation.request;

  const { providerId, apiKey, modelName } = await resolveFeatureProvider("podchat");
  let evaluationResponse: PodchatBubbleEvaluation;

  if (providerId === "mock") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Mock provider is not allowed in production." },
        { status: 400 }
      );
    }
    const outputValidation = validateBubbleOutput(buildMockBubbleEvaluation(req));
    if (!outputValidation.valid) {
      return NextResponse.json(
        { error: "Invalid provider response format. Please try again." },
        { status: 502 }
      );
    }
    evaluationResponse = outputValidation.response;
  } else if (providerId === "gemini") {
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }
    try {
      const text = await callGemini(apiKey, buildSystemPrompt(req), buildUserPrompt(req));
      const outputValidation = validateBubbleOutput(text);
      if (!outputValidation.valid) {
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 }
        );
      }
      evaluationResponse = outputValidation.response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected Gemini bubble error: ${message}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  } else if (providerId === "deepseek") {
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }
    try {
      const text = await callDeepSeek(apiKey, buildSystemPrompt(req), buildUserPrompt(req));
      const outputValidation = validateBubbleOutput(text);
      if (!outputValidation.valid) {
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 }
        );
      }
      evaluationResponse = outputValidation.response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected DeepSeek bubble error: ${message}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  } else {
    // Claude default
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName || "claude-3-5-haiku-latest",
          max_tokens: 400,
          system: buildSystemPrompt(req),
          messages: [{ role: "user", content: buildUserPrompt(req) }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Claude bubble API error ${res.status}: ${errText.slice(0, 500)}`);
        return NextResponse.json(
          { error: "Provider request failed. Please try again later." },
          { status: 502 },
        );
      }
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.find((content) => content.type === "text")?.text;
      const outputValidation = validateBubbleOutput(text ?? "");
      if (!outputValidation.valid) {
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 }
        );
      }
      evaluationResponse = outputValidation.response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected route error: ${message}`);
      return NextResponse.json(
        { error: "An unexpected error occurred. Please try again." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(evaluationResponse);
}