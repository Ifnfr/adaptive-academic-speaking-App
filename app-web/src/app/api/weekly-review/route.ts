import { NextResponse } from "next/server";

// Runs on the Node.js runtime so process.env is available server-side.
// Provider keys never leave the server.
export const runtime = "nodejs";

// ---------- Types ----------

type Provider = "Claude" | "DeepSeek" | "Gemini";

type WeeklyReviewSession = {
  date: string;
  level: string;
  mode: string;
  durationSeconds: number;
  mainWeakness: string;
  evidence: string;
  retryTask: string;
  csv: string;
};

type WeeklyReviewRequest = {
  provider: Provider;
  sessions: WeeklyReviewSession[];
};

type WeeklyReviewResponse = {
  summary: string;
  recurringWeakness: string;
  bestImprovement: string;
  scoreTrend: string;
  nextWeekFocus: string;
  recommendedPlan: string[];
  warnings: string[];
};

// ---------- Prompt building ----------

function buildSystemPrompt(): string {
  return [
    "You are an academic speaking coach producing a weekly review.",
    "Use only the provided completed practice session summaries.",
    "Do not invent sessions, transcripts, scores, or evidence.",
    "Focus on recurring patterns, visible improvements, score trends from CSV rows, and one practical plan for next week.",
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "summary", "recurringWeakness", "bestImprovement", "scoreTrend", "nextWeekFocus", "recommendedPlan", "warnings".',
    "- summary, recurringWeakness, bestImprovement, scoreTrend, and nextWeekFocus are short strings.",
    '- recommendedPlan is an array of exactly 7 non-empty strings, each starting with "Day N: ".',
    "- warnings is an array of strings. Use [] if there are no warnings.",
  ].join("\n");
}

function buildUserPrompt(req: WeeklyReviewRequest): string {
  const sessionsText = req.sessions
    .map((session, index) =>
      [
        `SESSION ${index + 1}:`,
        `- Date: ${session.date}`,
        `- Level: ${session.level}`,
        `- Mode: ${session.mode}`,
        `- Duration (seconds): ${session.durationSeconds}`,
        `- Main Weakness: ${session.mainWeakness || "(not recorded)"}`,
        `- Evidence: ${session.evidence || "(not recorded)"}`,
        `- Retry Task: ${session.retryTask || "(not recorded)"}`,
        "- CSV:",
        session.csv || "(not recorded)",
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "RECENT COMPLETED PRACTICE SESSIONS:",
    sessionsText,
    "",
    "TASK:",
    "1. Summarize the learner's week in 2-4 short sentences.",
    "2. Identify the most recurring weakness across sessions.",
    "3. Identify the best visible improvement, if any.",
    "4. Describe the score trend using only CSV score data.",
    "5. Choose one next-week focus.",
    "6. Produce a 7-day recommended plan with one concrete practice task per day.",
    "7. Add warnings only when data is thin, inconsistent, or missing.",
    "",
    'Return ONLY this JSON shape: {"summary":"...","recurringWeakness":"...","bestImprovement":"...","scoreTrend":"...","nextWeekFocus":"...","recommendedPlan":["Day 1: ...","Day 2: ...","Day 3: ...","Day 4: ...","Day 5: ...","Day 6: ...","Day 7: ..."],"warnings":[]}',
  ].join("\n");
}

// ---------- Validation helpers ----------

function limitText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim();
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? limitText(value, maxLength) : "";
}

function normalizeDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeSession(value: unknown): WeeklyReviewSession | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    date: normalizeString(source.date, 24),
    level: normalizeString(source.level, 40),
    mode: normalizeString(source.mode, 80),
    durationSeconds: normalizeDuration(source.durationSeconds),
    mainWeakness: normalizeString(source.mainWeakness, 500),
    evidence: normalizeString(source.evidence, 700),
    retryTask: normalizeString(source.retryTask, 500),
    csv: normalizeString(source.csv, 1500),
  };
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePlan(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;

  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const item = normalizeRequiredString(raw[i]);
    if (!item) return null;
    out.push(/^day\s*\d\s*:/i.test(item) ? item : `Day ${i + 1}: ${item}`);
  }
  return out;
}

function normalizeWarnings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseWeeklyReview(raw: string): WeeklyReviewResponse | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const summary = normalizeRequiredString(data.summary);
    const recurringWeakness = normalizeRequiredString(data.recurringWeakness);
    const bestImprovement = normalizeRequiredString(data.bestImprovement);
    const scoreTrend = normalizeRequiredString(data.scoreTrend);
    const nextWeekFocus = normalizeRequiredString(data.nextWeekFocus);
    const recommendedPlan = normalizePlan(data.recommendedPlan);

    if (
      !summary ||
      !recurringWeakness ||
      !bestImprovement ||
      !scoreTrend ||
      !nextWeekFocus ||
      !recommendedPlan
    ) {
      return null;
    }

    return {
      summary,
      recurringWeakness,
      bestImprovement,
      scoreTrend,
      nextWeekFocus,
      recommendedPlan,
      warnings: normalizeWarnings(data.warnings),
    };
  } catch {
    return null;
  }
}

function validateRequest(body: unknown): WeeklyReviewRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const source = body as Record<string, unknown>;

  const provider = source.provider;
  if (
    provider !== "Claude" &&
    provider !== "DeepSeek" &&
    provider !== "Gemini"
  ) {
    return "Unsupported provider. Use Claude, DeepSeek, or Gemini.";
  }

  if (!Array.isArray(source.sessions)) {
    return "Sessions array is required.";
  }
  if (source.sessions.length < 4) {
    return "Weekly Review requires at least 4 completed practice sessions.";
  }
  if (source.sessions.length > 7) {
    return "Weekly Review accepts at most 7 recent sessions.";
  }

  const sessions = source.sessions
    .map(normalizeSession)
    .filter((session): session is WeeklyReviewSession => session !== null);

  if (sessions.length < 4) {
    return "Weekly Review requires at least 4 valid completed practice sessions.";
  }

  return { provider, sessions };
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
  return data.content?.find((item) => item.type === "text")?.text ?? "";
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
      temperature: 0.3,
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
        temperature: 0.3,
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
  return parts.map((part) => part.text ?? "").join("");
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

  const systemPrompt = buildSystemPrompt();
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

  const result = parseWeeklyReview(raw);
  if (!result) {
    return NextResponse.json(
      {
        error:
          "Provider response could not be parsed as JSON. Try again or switch provider.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
