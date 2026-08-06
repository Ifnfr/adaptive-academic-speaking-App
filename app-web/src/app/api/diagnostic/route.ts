import { NextResponse } from "next/server";

// Runs on the Node.js runtime so process.env is available server-side.
// Provider keys never leave the server.
export const runtime = "nodejs";

// ---------- Types ----------

type Provider = "Claude" | "DeepSeek" | "Gemini";

const LEVELS = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
type Level = (typeof LEVELS)[number];

type DiagnosticRequest = {
  provider: Provider;
  transcript: string;
  durationSeconds: number;
  currentLevel: string;
  todayTarget: string;
  feedbackLanguage: FeedbackLanguage;
  targetLanguage: TargetLanguage;
};

type DiagnosticScores = {
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  argument: number;
  academicTone: number;
};

type DiagnosticResponse = {
  recommendedLevel: Level;
  mainBottleneck: string;
  summary: string;
  scores: DiagnosticScores;
  sevenDayFocusPlan: string[];
};

type FeedbackLanguage = "en" | "id";
type TargetLanguage = "en";

// ---------- Prompt building ----------

const SCORE_KEYS = [
  "fluency",
  "grammar",
  "vocabulary",
  "coherence",
  "argument",
  "academicTone",
] as const;

function feedbackLanguageLabel(language: FeedbackLanguage): string {
  return language === "id" ? "Indonesian" : "English";
}

function targetLanguageLabel(language: TargetLanguage): string {
  return language === "en" ? "English" : "English";
}

function buildLanguagePolicy(req: DiagnosticRequest): string {
  return [
    "LANGUAGE POLICY:",
    `- Evaluate the learner's speaking ability as ${targetLanguageLabel(req.targetLanguage)}.`,
    `- Write mainBottleneck, summary, sevenDayFocusPlan, explanations, and warnings in ${feedbackLanguageLabel(req.feedbackLanguage)}.`,
    `- Keep reusable speaking phrases and templates in ${targetLanguageLabel(req.targetLanguage)}.`,
    "- Do not translate the full learner transcript or session content.",
    "- Keep recommendedLevel and scores unchanged as structured values.",
    ...(req.feedbackLanguage === "id"
      ? [
          "- Use concise, beginner-friendly Indonesian.",
          "- Avoid long grammar terminology unless necessary.",
        ]
      : []),
  ].join("\n");
}

function buildSystemPrompt(req: DiagnosticRequest): string {
  return [
    "You are an academic speaking coach running a quick diagnostic.",
    "Your job is to estimate the learner's current level and the single",
    "biggest bottleneck holding them back, then propose a focused 7-day plan.",
    "Be specific. Reference the transcript when possible. Never invent",
    "transcript details.",
    "Use the diagnostic recommendedLevel as the basis for the 7-day focus plan.",
    "The 7-day focus plan must be level-appropriate practical speaking drills, not reading or research homework only.",
    "Every plan item must include a concrete speaking action the learner can do.",
    "",
    buildLanguagePolicy(req),
    "",
    "LEVEL-SPECIFIC PLAN GUIDANCE:",
    "Foundation:",
    "- The plan must be simple, concrete, beginner-safe, and easy to understand.",
    "- Each day should be doable in 10-20 minutes.",
    "- Each day must include a concrete speaking action.",
    "- Focus on clear topic sentence, subject + verb clarity, one idea per sentence, simple reason using \"because\", 30-60 seconds of continuous speaking, reducing informal phrasing, and repeating a simple academic template.",
    "- Do NOT suggest journal abstracts, academic papers, research tasks, complex writing tasks, counterarguments, advanced academic vocabulary drills, or long essay planning.",
    "Beginner:",
    "- Use simple academic structure: position, reason, simple example, short conclusion.",
    "- Avoid advanced research tasks.",
    "Intermediate:",
    "- Allow structured argument drills, examples, coherence, and basic evidence.",
    "- Keep tasks manageable.",
    "Advanced:",
    "- Allow counterargument, nuance, evidence quality, academic tone, and stronger structure.",
    "Expert:",
    "- Allow refinement, precision, nuance, argument depth, and advanced academic speaking standards.",
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "recommendedLevel", "mainBottleneck", "summary", "scores",',
    '  "sevenDayFocusPlan".',
    "- recommendedLevel is one of: Foundation, Beginner, Intermediate, Advanced, Expert.",
    "- mainBottleneck is one short sentence naming the single biggest issue.",
    "- summary is 2-4 short sentences describing the learner's current profile.",
    "- scores is an object with integer values from 1 (very weak) to 5 (strong) for:",
    '  fluency, grammar, vocabulary, coherence, argument, academicTone.',
    '- sevenDayFocusPlan is an array of 7 strings, each starting with "Day N: ".',
    "- Each plan item is one short, specific, level-appropriate speaking practice instruction.",
  ].join("\n");
}

function buildUserPrompt(req: DiagnosticRequest): string {
  return [
    "DIAGNOSTIC CONTEXT:",
    `- Current self-reported level: ${req.currentLevel || "(not provided)"}`,
    `- Today's Target: ${req.todayTarget || "(not provided)"}`,
    `- Duration (seconds): ${req.durationSeconds}`,
    "",
    "TRANSCRIPT (a combined response covering: 60s self-introduction + learning goal,",
    "explanation of one recently learned academic concept, and a short opinion with one",
    "reason and one example):",
    req.transcript,
    "",
    "TASK:",
    "1. Estimate the learner's recommended level.",
    "2. Name the single biggest bottleneck.",
    "3. Write a 2-4 sentence summary of their current profile.",
    "4. Rate them on six dimensions, each as an integer from 1 to 5.",
    "5. Produce a 7-day focus plan calibrated to the recommendedLevel, one short speaking instruction per day.",
    "",
    'Return ONLY the JSON object: {"recommendedLevel": "...", "mainBottleneck": "...", "summary": "...", "scores": {"fluency": 3, "grammar": 3, "vocabulary": 3, "coherence": 3, "argument": 3, "academicTone": 3}, "sevenDayFocusPlan": ["Day 1: ...", "Day 2: ...", "Day 3: ...", "Day 4: ...", "Day 5: ...", "Day 6: ...", "Day 7: ..."]}',
  ].join("\n");
}

// ---------- JSON parsing helpers ----------

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

// ---------- Validation helpers ----------

function clampScore(value: unknown): number {
  const FALLBACK = 3;
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") n = Number(value);
  else return FALLBACK;
  if (!Number.isFinite(n)) return FALLBACK;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 5) return 5;
  return r;
}

function normalizeScores(raw: unknown): DiagnosticScores {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<(typeof SCORE_KEYS)[number], number>;
  for (const key of SCORE_KEYS) {
    out[key] = clampScore(source[key]);
  }
  return out as DiagnosticScores;
}

function normalizeLevel(value: unknown): Level {
  if (typeof value === "string") {
    const match = (LEVELS as readonly string[]).find(
      (lvl) => lvl.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) return match as Level;
  }
  return "Foundation";
}

function normalizePlan(raw: unknown): string[] {
  // Always emit exactly 7 items so the UI can render a stable list.
  const base: string[] = Array.from({ length: 7 }, (_, i) => `Day ${i + 1}: `);
  if (Array.isArray(raw)) {
    for (let i = 0; i < 7; i++) {
      const cell = raw[i];
      if (typeof cell === "string") {
        const trimmed = cell.trim();
        if (trimmed.length > 0) {
          // Make sure each line starts with "Day N:" for consistency.
          base[i] = /^day\s*\d/i.test(trimmed)
            ? trimmed
            : `Day ${i + 1}: ${trimmed}`;
        }
      }
    }
  }
  return base;
}

function normalizeFeedbackLanguage(value: unknown): FeedbackLanguage {
  return value === "id" ? "id" : "en";
}

function normalizeTargetLanguage(value: unknown): TargetLanguage {
  return value === "en" ? "en" : "en";
}

function isFoundationPlanItemAllowed(item: string): boolean {
  const lower = item.toLowerCase();
  const banned =
    /journal abstract|academic paper|research task|research|counterargument|counter-argument|advanced academic vocabulary|vocabulary drill|essay plan|essay planning|long essay|literature review|scholarly article|peer-reviewed|paper abstract/.test(
      lower,
    );
  if (banned) return false;

  return /\b(speak|say|talk|record|repeat|describe|answer|explain|tell|present|read aloud|practice saying|explain aloud|answer aloud|summarize aloud)\b/.test(
    lower,
  );
}

function isFoundationPlanAllowed(plan: string[]): boolean {
  return plan.every(isFoundationPlanItemAllowed);
}

function parseDiagnostic(raw: string): {
  recommendedLevel: Level;
  mainBottleneck: string;
  summary: string;
  scores: DiagnosticScores;
  sevenDayFocusPlan: string[];
} | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    const mainBottleneck =
      typeof data.mainBottleneck === "string" ? data.mainBottleneck.trim() : "";
    const summary =
      typeof data.summary === "string" ? data.summary.trim() : "";
    if (!mainBottleneck || !summary) return null;
    const recommendedLevel = normalizeLevel(data.recommendedLevel);
    const sevenDayFocusPlan = normalizePlan(data.sevenDayFocusPlan);
    if (
      recommendedLevel === "Foundation" &&
      !isFoundationPlanAllowed(sevenDayFocusPlan)
    ) {
      return null;
    }

    return {
      recommendedLevel,
      mainBottleneck,
      summary,
      scores: normalizeScores(data.scores),
      sevenDayFocusPlan,
    };
  } catch {
    return null;
  }
}

// ---------- Provider error mapping ----------

function friendlyProviderError(
  provider: Provider,
  status: number,
  errText: string,
): string {
  const text = (errText || "").toLowerCase();
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
  return `${provider} request failed (status ${status}). Please try again or switch provider.`;
}

// ---------- Provider callers ----------
// Minimal copies of the same shape used in /api/feedback. We keep them inline
// here so this MVP route can ship without a shared module refactor.

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
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `Claude API error ${res.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(friendlyProviderError("Claude", res.status, errText));
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
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
  const actualApiKey = process.env.DEEPSEEK_API_KEY || "";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${actualApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1800,
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
    throw new Error(friendlyProviderError("DeepSeek", res.status, errText));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------- Validation + key lookup ----------

function validateRequest(body: unknown): DiagnosticRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const b = body as Record<string, unknown>;

  const provider = b.provider;
  if (
    provider !== "Claude" &&
    provider !== "DeepSeek" &&
    provider !== "Gemini"
  ) {
    return "Unsupported provider. Use Claude, DeepSeek, or Gemini.";
  }

  const transcript =
    typeof b.transcript === "string" ? b.transcript.trim() : "";
  if (transcript.length === 0) {
    return "Transcript is required.";
  }

  const durationSeconds =
    typeof b.durationSeconds === "number" && Number.isFinite(b.durationSeconds)
      ? Math.max(0, Math.floor(b.durationSeconds))
      : 0;

  return {
    provider,
    transcript,
    durationSeconds,
    currentLevel: typeof b.currentLevel === "string" ? b.currentLevel : "",
    todayTarget: typeof b.todayTarget === "string" ? b.todayTarget : "",
    feedbackLanguage: normalizeFeedbackLanguage(b.feedbackLanguage),
    targetLanguage: normalizeTargetLanguage(b.targetLanguage),
  };
}

function getApiKey(provider: Provider): string | undefined {
  switch (provider) {
    case "Claude":
      return process.env.CLAUDE_API_KEY;
    case "DeepSeek":
      return process.env.DEEPSEEK_API_KEY;
    case "Gemini":
      return process.env.DEEPSEEK_API_KEY || "";
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
      {
        error:
          "Missing API key for selected provider. Add it to .env.local.",
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(validated);
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
    const message =
      err instanceof Error ? err.message : "Provider call failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const parsedResult = parseDiagnostic(raw);
  if (!parsedResult) {
    return NextResponse.json(
      {
        error:
          "Provider response could not be parsed as JSON. Try again or switch provider.",
      },
      { status: 502 },
    );
  }

  const response: DiagnosticResponse = parsedResult;
  return NextResponse.json(response);
}
