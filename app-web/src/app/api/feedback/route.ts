import { NextResponse } from "next/server";

// This route runs on the Node.js runtime so process.env is available
// for server-side keys. Keys never leave the server.
export const runtime = "nodejs";

// ---------- Types ----------

type Provider = "Claude" | "DeepSeek" | "Gemini";

type FeedbackRequest = {
  level: string;
  mode: string;
  feedbackType: string;
  sessionType: string;
  provider: Provider;
  todayTarget: string;
  transcript: string;
  durationSeconds: number;
};

type QuickFeedback = {
  mainWeakness: string;
  evidence: string;
  betterPhrase: string;
  retryTask: string;
};

// Scores are level-specific. Keys match the casing used by the frontend.
type FoundationScores = { fluency: number; coherence: number };
type BeginnerScores = {
  fluency: number;
  grammar: number;
  coherence: number;
};
type AdvancedScores = {
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  argument: number;
  academicTone: number;
};
type Scores = FoundationScores | BeginnerScores | AdvancedScores;

type FeedbackResponse = QuickFeedback & {
  providerUsed: Provider;
  scores: Scores;
};

// Score dimensions per level. Keys are camelCase to match the JSON shape.
const FOUNDATION_KEYS = ["fluency", "coherence"] as const;
const BEGINNER_KEYS = ["fluency", "grammar", "coherence"] as const;
const ADVANCED_KEYS = [
  "fluency",
  "grammar",
  "vocabulary",
  "coherence",
  "argument",
  "academicTone",
] as const;

type ScoreKey =
  | (typeof FOUNDATION_KEYS)[number]
  | (typeof BEGINNER_KEYS)[number]
  | (typeof ADVANCED_KEYS)[number];

function scoreKeysForLevel(level: string): readonly ScoreKey[] {
  if (level === "Foundation") return FOUNDATION_KEYS;
  if (level === "Beginner") return BEGINNER_KEYS;
  // Intermediate, Advanced, Expert all use the full set.
  return ADVANCED_KEYS;
}

// ---------- Prompt building ----------

function buildSystemPrompt(level: string): string {
  const foundationRule =
    level === "Foundation"
      ? [
          "LEVEL RULE (Foundation):",
          "- Do NOT correct grammar.",
          "- Do NOT judge vocabulary choice.",
          "- Do NOT judge argument strength or academic tone.",
          "- Focus ONLY on speaking continuity, clarity, and basic coherence.",
          '- The "scores" object MUST contain exactly: fluency, coherence.',
          "- Do NOT include grammar, vocabulary, argument, or academicTone keys.",
        ].join("\n")
      : level === "Beginner"
        ? [
            "LEVEL RULE (Beginner):",
            "- Evaluate fluency, grammar, and coherence only.",
            '- The "scores" object MUST contain exactly: fluency, grammar, coherence.',
            "- Do NOT include vocabulary, argument, or academicTone keys.",
          ].join("\n")
        : [
            "LEVEL RULE:",
            "- Evaluate fluency, grammar, vocabulary, coherence, argument, and academicTone.",
            '- The "scores" object MUST contain exactly: fluency, grammar, vocabulary, coherence, argument, academicTone.',
          ].join("\n");

  return [
    "You are an academic speaking coach for deliberate practice.",
    "You give Quick Feedback that corrects ONLY ONE main issue.",
    "Feedback must be moment-specific and reference a real sentence or",
    "moment from the transcript. Never invent transcript details.",
    "",
    foundationRule,
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown, no code fences, no commentary outside JSON.",
    "- The JSON object MUST have exactly these top-level keys:",
    '  "mainWeakness", "evidence", "betterPhrase", "retryTask", "scores".',
    "- mainWeakness, evidence, betterPhrase, retryTask are short strings (1-3 sentences each).",
    "- evidence must quote or paraphrase a specific moment from the transcript.",
    "- betterPhrase must be a stronger academic phrase or sentence the learner could have said.",
    "- retryTask must be one direct, doable instruction for the next attempt.",
    "- scores is an object whose values are integers from 1 to 5 (5 is best).",
    "- Use the exact score keys required by the level rule above.",
  ].join("\n");
}

function buildUserPrompt(req: FeedbackRequest): string {
  const keys = scoreKeysForLevel(req.level);
  const scoresExample = keys
    .map((k, idx) => `"${k}": ${idx === 0 ? 4 : 3}`)
    .join(", ");
  const exampleJson = `{"mainWeakness": "...", "evidence": "...", "betterPhrase": "...", "retryTask": "...", "scores": {${scoresExample}}}`;

  return [
    "SESSION CONFIG:",
    `- Level: ${req.level}`,
    `- Mode: ${req.mode}`,
    `- Feedback Type: ${req.feedbackType}`,
    `- Session Type: ${req.sessionType}`,
    `- Today's Target: ${req.todayTarget || "(not provided)"}`,
    `- Duration (seconds): ${req.durationSeconds}`,
    "",
    "TRANSCRIPT:",
    req.transcript,
    "",
    "TASK:",
    "1. Identify the single biggest issue in this attempt.",
    "2. Cite one specific sentence or moment from the transcript as evidence.",
    "3. Provide one stronger academic phrase or sentence.",
    "4. Give one direct retry task.",
    `5. Score the attempt on these dimensions only: ${keys.join(", ")}.`,
    "   Each score is an integer from 1 (very weak) to 5 (strong).",
    "",
    `Return ONLY the JSON object: ${exampleJson}`,
  ].join("\n");
}

// ---------- JSON parsing helpers ----------

// Models sometimes wrap JSON in code fences or include stray text.
// Extract the first balanced JSON object we can find.
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

function parseFeedback(
  raw: string,
): { feedback: QuickFeedback; rawScores: unknown } | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const data = JSON.parse(jsonText) as Partial<QuickFeedback> & {
      scores?: unknown;
    };
    if (
      typeof data.mainWeakness === "string" &&
      typeof data.evidence === "string" &&
      typeof data.betterPhrase === "string" &&
      typeof data.retryTask === "string"
    ) {
      return {
        feedback: {
          mainWeakness: data.mainWeakness.trim(),
          evidence: data.evidence.trim(),
          betterPhrase: data.betterPhrase.trim(),
          retryTask: data.retryTask.trim(),
        },
        rawScores: data.scores,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Clamp a single score to an integer in [1, 5]. Falls back to 3 when the
// value is missing, non-finite, or otherwise unreadable.
function clampScore(value: unknown): number {
  const FALLBACK = 3;
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    n = Number(value);
  } else {
    return FALLBACK;
  }
  if (!Number.isFinite(n)) return FALLBACK;
  const rounded = Math.round(n);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

// Build a level-correct scores object, ignoring any extra keys the model
// might have included and filling missing keys with the fallback.
function normalizeScores(level: string, raw: unknown): Scores {
  const keys = scoreKeysForLevel(level);
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = {} as Record<ScoreKey, number>;
  for (const key of keys) {
    result[key] = clampScore(source[key]);
  }
  return result as Scores;
}

// ---------- Provider callers ----------

// Map common upstream HTTP errors to short, user-facing messages.
// We never expose the raw upstream JSON or stack traces to the client.
function friendlyProviderError(
  provider: Provider,
  status: number,
  errText: string,
): string {
  const text = (errText || "").toLowerCase();

  // Model not found / unavailable (specific to Gemini's wording but safe
  // to apply across providers if they say something similar).
  const isModelError =
    /model.*(not found|not available|unavailable|not supported|does not exist)/i.test(
      errText,
    ) ||
    /not found for api version|is not supported for generatecontent/i.test(
      errText,
    );
  if (provider === "Gemini" && (status === 404 || isModelError)) {
    return "Gemini model not available. Check GEMINI_MODEL in .env.local.";
  }
  if (isModelError) {
    return `${provider} model not available. Check your provider settings.`;
  }

  if (status === 401 || status === 403) {
    return "API key rejected. Check your .env.local key for the selected provider.";
  }
  if (status === 429 || /rate limit|quota|too many requests/.test(text)) {
    return "Rate limit reached. Please wait before trying again.";
  }
  if (status === 503 || status === 502 || status === 504) {
    return `${provider} is temporarily unavailable. Please wait a moment and try again.`;
  }
  if (status === 400) {
    return `${provider} rejected the request. Please try again or switch provider.`;
  }

  // Generic fallback: short and provider-tagged, no JSON or stack traces.
  return `${provider} request failed (status ${status}). Please try again or switch provider.`;
}

async function callClaude(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Keep the technical detail in the server log; surface a clean message.
    console.error(
      `Claude API error ${res.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(friendlyProviderError("Claude", res.status, errText));
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  return text;
}

async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `DeepSeek API error ${res.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(friendlyProviderError("DeepSeek", res.status, errText));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
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
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `Gemini API error ${res.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(friendlyProviderError("Gemini", res.status, errText));
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

// ---------- Validation ----------

function validateRequest(body: unknown): FeedbackRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const b = body as Record<string, unknown>;

  const provider = b.provider;
  if (provider !== "Claude" && provider !== "DeepSeek" && provider !== "Gemini") {
    return "Unsupported provider. Use Claude, DeepSeek, or Gemini.";
  }

  const transcript = typeof b.transcript === "string" ? b.transcript.trim() : "";
  if (transcript.length === 0) {
    return "Transcript is required.";
  }

  const durationSeconds =
    typeof b.durationSeconds === "number" && Number.isFinite(b.durationSeconds)
      ? Math.max(0, Math.floor(b.durationSeconds))
      : 0;

  return {
    level: typeof b.level === "string" ? b.level : "",
    mode: typeof b.mode === "string" ? b.mode : "",
    feedbackType: typeof b.feedbackType === "string" ? b.feedbackType : "",
    sessionType: typeof b.sessionType === "string" ? b.sessionType : "",
    provider,
    todayTarget: typeof b.todayTarget === "string" ? b.todayTarget : "",
    transcript,
    durationSeconds,
  };
}

function getApiKey(provider: Provider): string | undefined {
  switch (provider) {
    case "Claude":
      return process.env.CLAUDE_API_KEY;
    case "DeepSeek":
      return process.env.DEEPSEEK_API_KEY;
    case "Gemini":
      return process.env.GEMINI_API_KEY;
  }
}

// ---------- Route handler ----------

export async function POST(request: Request) {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validated = validateRequest(parsed);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }

  const apiKey = getApiKey(validated.provider);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key for selected provider. Add it to .env.local." },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(validated.level);
  const userPrompt = buildUserPrompt(validated);

  let raw = "";
  try {
    if (validated.provider === "Claude") {
      raw = await callClaude(apiKey, systemPrompt, userPrompt);
    } else if (validated.provider === "DeepSeek") {
      raw = await callDeepSeek(apiKey, systemPrompt, userPrompt);
    } else {
      raw = await callGemini(apiKey, systemPrompt, userPrompt);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider call failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const parsedFeedback = parseFeedback(raw);
  if (!parsedFeedback) {
    return NextResponse.json(
      {
        error:
          "Provider response could not be parsed as JSON. Try again or switch provider.",
      },
      { status: 502 },
    );
  }

  const response: FeedbackResponse = {
    ...parsedFeedback.feedback,
    providerUsed: validated.provider,
    scores: normalizeScores(validated.level, parsedFeedback.rawScores),
  };
  return NextResponse.json(response);
}
