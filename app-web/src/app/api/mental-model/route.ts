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

type MentalModelRequest = {
  provider: Provider;
  level: Level;
  mode: string;
  focus: string;
  latestWeakness: string;
  latestRetryTask: string;
  feedbackLanguage: FeedbackLanguage;
  targetLanguage: TargetLanguage;
};

type MentalModelResponse = {
  coreStandard: string;
  qualityCriteria: string[];
  weakPattern: string;
  strongPattern: string;
  selfCheckQuestions: string[];
  microDrill: string;
  referenceModel: string;
};

type MentalModelParseResult =
  | { ok: true; value: MentalModelResponse }
  | { ok: false; reason: "parse" | "validation" };

type FeedbackLanguage = "en" | "id";
type TargetLanguage = "en";

// ---------- Prompt building ----------

function feedbackLanguageLabel(language: FeedbackLanguage): string {
  return language === "id" ? "Indonesian" : "English";
}

function targetLanguageLabel(language: TargetLanguage): string {
  return language === "en" ? "English" : "English";
}

function buildLanguagePolicy(req: MentalModelRequest): string {
  return [
    "LANGUAGE POLICY:",
    `- Write coreStandard, qualityCriteria, weakPattern, strongPattern, selfCheckQuestions, and microDrill in ${feedbackLanguageLabel(req.feedbackLanguage)}.`,
    `- Keep referenceModel in ${targetLanguageLabel(req.targetLanguage)} because it is a target-language speech pattern sample.`,
    `- Keep examples inside explanation fields in ${targetLanguageLabel(req.targetLanguage)} when they are target-language examples.`,
    "- Do not translate full learner transcripts or session content.",
    ...(req.feedbackLanguage === "id"
      ? [
          "- Use concise, beginner-friendly Indonesian.",
          "- Avoid long grammar terminology unless necessary.",
        ]
      : []),
  ].join("\n");
}

function buildSystemPrompt(req: MentalModelRequest): string {
  return [
    "You are an academic speaking coach teaching mental models for speaking practice.",
    "Your job is to help the learner recognize what a strong academic speaking response sounds like before they practice.",
    "Do not solve a live practice prompt.",
    "Do not produce a full essay, full answer, or memorization script.",
    "Teach general standards, response patterns, evaluation habits, and contrastive examples.",
    "Keep the reference model short, generic, and framed as a pattern sample rather than an answer to copy.",
    "",
    buildLanguagePolicy(req),
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "coreStandard", "qualityCriteria", "weakPattern", "strongPattern", "selfCheckQuestions", "microDrill", "referenceModel".',
    "- coreStandard, weakPattern, strongPattern, microDrill, and referenceModel are short strings.",
    "- qualityCriteria is an array of 3 to 5 short strings.",
    "- selfCheckQuestions is an array of 3 to 5 short strings.",
    "- referenceModel must be brief: no more than 120 words.",
  ].join("\n");
}

function levelGuidance(level: Level): string {
  if (level !== "Foundation") return "";
  return [
    "FOUNDATION GUIDANCE:",
    "- Use simple wording that a beginner can understand.",
    "- Teach simple speaking standards: one clear topic sentence, one idea at a time, subject + verb clarity, a simple reason using \"because\", a simple example, a 30-60 second speaking target, and a clear ending sentence.",
    "- Avoid abstract academic theory, counterarguments, complex evidence evaluation, advanced academic vocabulary lists, long reference models, and essay-like structure.",
    "- The referenceModel must be short, generic, and only a pattern sample. It must not sound like a polished full answer.",
  ].join("\n");
}

function buildUserPrompt(req: MentalModelRequest): string {
  const guidance = levelGuidance(req.level);
  return [
    "LEARNER CONTEXT:",
    `- Level: ${req.level}`,
    `- Mode: ${req.mode || "(not provided)"}`,
    `- Focus / weakness: ${req.focus}`,
    `- Latest weakness: ${req.latestWeakness || "(not available)"}`,
    `- Latest retry task: ${req.latestRetryTask || "(not available)"}`,
    "",
    ...(guidance ? [guidance, ""] : []),
    "TASK:",
    "1. Explain the core standard for this level/mode/focus.",
    "2. Give 3-5 quality criteria the learner should listen for.",
    "3. Contrast a weak response pattern with a strong response pattern.",
    "4. Give 3-5 self-check questions the learner can ask after speaking.",
    "5. Give one micro drill for the next practice attempt.",
    "6. Give one short reference model that demonstrates the pattern only, not a full answer.",
    "",
    'Return ONLY this JSON shape: {"coreStandard":"...","qualityCriteria":["...","...","..."],"weakPattern":"...","strongPattern":"...","selfCheckQuestions":["...","...","..."],"microDrill":"...","referenceModel":"..."}',
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

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLevel(value: unknown): Level | null {
  if (typeof value !== "string") return null;
  const match = (LEVELS as readonly string[]).find(
    (level) => level.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ? (match as Level) : null;
}

function normalizeFeedbackLanguage(value: unknown): FeedbackLanguage {
  return value === "id" ? "id" : "en";
}

function normalizeTargetLanguage(value: unknown): TargetLanguage {
  return value === "en" ? "en" : "en";
}

function normalizeShortList(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 5) return null;
  const out = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return out.length === raw.length ? out : null;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractBalancedJsonObject(raw: string): string | null {
  const text = stripCodeFence(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (start === -1) {
      if (char === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseMentalModel(raw: string): MentalModelParseResult {
  const jsonText = extractBalancedJsonObject(raw);
  if (!jsonText) return { ok: false, reason: "parse" };

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "validation" };
    }

    const data = parsed as Record<string, unknown>;
    const coreStandard = normalizeRequiredString(data.coreStandard);
    const qualityCriteria = normalizeShortList(data.qualityCriteria);
    const weakPattern = normalizeRequiredString(data.weakPattern);
    const strongPattern = normalizeRequiredString(data.strongPattern);
    const selfCheckQuestions = normalizeShortList(data.selfCheckQuestions);
    const microDrill = normalizeRequiredString(data.microDrill);
    const referenceModel = normalizeRequiredString(data.referenceModel);

    if (
      !coreStandard ||
      !qualityCriteria ||
      !weakPattern ||
      !strongPattern ||
      !selfCheckQuestions ||
      !microDrill ||
      !referenceModel
    ) {
      return { ok: false, reason: "validation" };
    }
    if (referenceModel.length > 800 || wordCount(referenceModel) > 120) {
      return { ok: false, reason: "validation" };
    }

    return {
      ok: true,
      value: {
        coreStandard,
        qualityCriteria,
        weakPattern,
        strongPattern,
        selfCheckQuestions,
        microDrill,
        referenceModel,
      },
    };
  } catch {
    return { ok: false, reason: "parse" };
  }
}

function validateRequest(body: unknown): MentalModelRequest | string {
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

  const level = normalizeLevel(source.level);
  if (!level) {
    return "Unsupported level. Use Foundation, Beginner, Intermediate, Advanced, or Expert.";
  }

  const focus = normalizeString(source.focus, 500);
  if (!focus) {
    return "Focus is required.";
  }

  return {
    provider,
    level,
    mode: normalizeString(source.mode, 80),
    focus,
    latestWeakness: normalizeString(source.latestWeakness, 500),
    latestRetryTask: normalizeString(source.latestRetryTask, 500),
    feedbackLanguage: normalizeFeedbackLanguage(source.feedbackLanguage),
    targetLanguage: normalizeTargetLanguage(source.targetLanguage),
  };
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
      max_tokens: 700,
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
      { error: "Missing API key for selected provider. Add it to .env.local." },
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
    const message = err instanceof Error ? err.message : "Provider call failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const parsedMentalModel = parseMentalModel(raw);
  if (!parsedMentalModel.ok) {
    const error =
      parsedMentalModel.reason === "validation"
        ? "Provider JSON did not match the Mental Model schema. Try again or switch provider."
        : "Provider response could not be parsed as JSON. Try again or switch provider.";
    return NextResponse.json(
      { error },
      { status: 502 },
    );
  }

  return NextResponse.json(parsedMentalModel.value);
}
