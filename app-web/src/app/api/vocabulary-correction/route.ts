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

const CORRECTION_STATUSES = [
  "natural",
  "understandable",
  "awkward",
  "incorrect",
] as const;
type VocabularyCorrectionStatus = (typeof CORRECTION_STATUSES)[number];

type VocabularyCorrectionRequest = {
  provider: Provider;
  level: Level;
  targetVocabulary: string;
  meaning: string;
  partOfSpeech: string;
  userSentence: string;
  feedbackLanguage: FeedbackLanguage;
  targetLanguage: TargetLanguage;
};

type VocabularyCorrectionResponse = {
  status: VocabularyCorrectionStatus;
  explanation: string;
  correctedSentence: string;
  collocationTip: string;
  retryInstruction: string;
  targetUsageRole?: string;
  warnings: string[];
};

type VocabularyCorrectionParseResult =
  | { ok: true; value: VocabularyCorrectionResponse }
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

function buildLanguagePolicy(req: VocabularyCorrectionRequest): string {
  return [
    "LANGUAGE POLICY:",
    `- Evaluate the learner's submitted sentence as ${targetLanguageLabel(req.targetLanguage)}.`,
    `- Write explanation, collocationTip, retryInstruction, targetUsageRole, and warnings in ${feedbackLanguageLabel(req.feedbackLanguage)}.`,
    `- Keep correctedSentence in ${targetLanguageLabel(req.targetLanguage)}.`,
    "- Do not translate the full learner sentence.",
    "- Keep the target vocabulary word or phrase in the target language.",
    ...(req.feedbackLanguage === "id"
      ? [
          "- Use concise, beginner-friendly Indonesian.",
          "- Avoid long grammar terminology unless necessary.",
        ]
      : []),
  ].join("\n");
}

function buildSystemPrompt(req: VocabularyCorrectionRequest): string {
  return [
    "You are a vocabulary sentence correction coach for academic speaking.",
    "Your job is to check ONLY the user's submitted sentence using the target vocabulary word or phrase.",
    "Do not write a paragraph, essay, speech, full answer, or copy-ready response.",
    "Do not generate multiple alternative sentences.",
    "Do not generate extra example sentences.",
    "The correctedSentence must be exactly one sentence.",
    "The retryInstruction must be one short actionable task asking the learner to try again themselves.",
    "Feedback should support spoken reuse of the vocabulary word.",
    "If partOfSpeech is provided, consider how the target vocabulary functions in the user's sentence.",
    "Explain only the role of the target vocabulary. Do not classify every word in the sentence.",
    "",
    buildLanguagePolicy(req),
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "status", "explanation", "correctedSentence", "collocationTip", "retryInstruction", "targetUsageRole", "warnings".',
    '- status MUST be one of: "natural", "understandable", "awkward", "incorrect".',
    "- explanation, correctedSentence, collocationTip, and retryInstruction are short strings.",
    "- targetUsageRole is a short string explaining how the target vocabulary functions in the user's sentence. Use an empty string if unsure.",
    "- correctedSentence is one sentence only, no paragraph, no list, no multiple alternatives.",
    "- retryInstruction is one short task.",
    "- warnings is an array of strings. Use [] if there are no warnings.",
  ].join("\n");
}

function levelGuidance(level: Level): string {
  switch (level) {
    case "Foundation":
      return [
        "LEVEL GUIDANCE FOR FOUNDATION:",
        "- Use simple wording.",
        "- Focus on one main correction only.",
        "- Emphasize subject + verb clarity, basic grammar, simple sentence order, and correct use of the target word.",
        "- Avoid advanced grammar terms, academic polish, counterarguments, evidence evaluation, and long explanations.",
        "- correctedSentence should be short and repeatable.",
      ].join("\n");
    case "Beginner":
      return [
        "LEVEL GUIDANCE FOR BEGINNER:",
        "- Keep the explanation short.",
        "- Allow basic grammar and word-choice notes.",
        "- correctedSentence should use simple academic structure.",
      ].join("\n");
    case "Intermediate":
      return [
        "LEVEL GUIDANCE FOR INTERMEDIATE:",
        "- Check naturalness, basic collocation, clarity, and sentence flow.",
        "- Keep the correction practical for speaking.",
      ].join("\n");
    case "Advanced":
      return [
        "LEVEL GUIDANCE FOR ADVANCED:",
        "- Check precision, tone, collocation, nuance, and phrasing improvements.",
        "- Still provide only one corrected sentence.",
      ].join("\n");
    case "Expert":
      return [
        "LEVEL GUIDANCE FOR EXPERT:",
        "- Check fine-grained naturalness, register, concision, and academic tone.",
        "- Do not rewrite as a paragraph.",
      ].join("\n");
  }
}

function buildUserPrompt(req: VocabularyCorrectionRequest): string {
  return [
    "LEARNER CONTEXT:",
    `- Level: ${req.level}`,
    `- Target word/phrase: ${req.targetVocabulary}`,
    `- Meaning: ${req.meaning || "(not provided)"}`,
    `- Part of speech: ${req.partOfSpeech || "(not provided)"}`,
    "",
    levelGuidance(req.level),
    "",
    "USER SUBMITTED SENTENCE:",
    req.userSentence,
    "",
    "TASK:",
    "1. Decide whether the sentence is natural, understandable, awkward, or incorrect.",
    "2. Explain the main issue briefly.",
    "3. Provide exactly one corrected sentence.",
    "4. Give one collocation or usage tip.",
    "5. Give one short retry instruction so the learner writes or says a new sentence themselves.",
    "6. Explain how the target vocabulary functions in the user's sentence if you can do that briefly.",
    "7. Add warnings only when useful.",
    "",
    'Return ONLY this JSON shape: {"status":"understandable","explanation":"...","correctedSentence":"...","collocationTip":"...","retryInstruction":"...","targetUsageRole":"...","warnings":[]}',
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

function normalizeStatus(value: unknown): VocabularyCorrectionStatus | null {
  if (typeof value !== "string") return null;
  const match = (CORRECTION_STATUSES as readonly string[]).find(
    (status) => status === value.trim().toLowerCase(),
  );
  return match ? (match as VocabularyCorrectionStatus) : null;
}

function normalizeWarnings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsVocabWord(text: string, word: string): boolean {
  const normalizedText = normalizeSpacing(text).toLowerCase();
  const normalizedWord = normalizeSpacing(word).toLowerCase();
  if (!normalizedText || !normalizedWord) return false;

  if (normalizedWord.includes(" ")) {
    return normalizedText.includes(normalizedWord);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, "i");
  return pattern.test(normalizedText);
}

function hasParagraphShape(value: string): boolean {
  return /\n\s*\n/.test(value) || value.split(/\n/).length > 2;
}

function hasMultipleSentenceShape(value: string): boolean {
  return /[.!?]+["')\]]?\s+\S/.test(value.trim());
}

function hasAlternativeListShape(value: string): boolean {
  return (
    /(^|\n)\s*(?:\d+\.|[-*])\s+\S/.test(value) ||
    /\bhere are\s+\d+\b/i.test(value) ||
    /\bmultiple alternatives\b/i.test(value)
  );
}

function isShortRequiredText(
  value: string | null,
  maxWords: number,
  maxChars: number,
): value is string {
  return Boolean(
    value &&
      value.length <= maxChars &&
      wordCount(value) <= maxWords &&
      !hasParagraphShape(value) &&
      !hasAlternativeListShape(value),
  );
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

function parseVocabularyCorrection(
  raw: string,
): VocabularyCorrectionParseResult {
  const jsonText = extractBalancedJsonObject(raw);
  if (!jsonText) return { ok: false, reason: "parse" };

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "validation" };
    }

    const data = parsed as Record<string, unknown>;
    const status = normalizeStatus(data.status);
    const explanation = normalizeRequiredString(data.explanation);
    const correctedSentence = normalizeRequiredString(data.correctedSentence);
    const collocationTip = normalizeRequiredString(data.collocationTip);
    const retryInstruction = normalizeRequiredString(data.retryInstruction);
    const targetUsageRole =
      typeof data.targetUsageRole === "string"
        ? limitText(data.targetUsageRole, 400)
        : "";

    if (
      !status ||
      !isShortRequiredText(explanation, 60, 500) ||
      !isShortRequiredText(collocationTip, 60, 500) ||
      !isShortRequiredText(retryInstruction, 30, 220) ||
      !isShortRequiredText(correctedSentence, 40, 300) ||
      (targetUsageRole.length > 0 &&
        !isShortRequiredText(targetUsageRole, 50, 400))
    ) {
      return { ok: false, reason: "validation" };
    }

    if (hasMultipleSentenceShape(correctedSentence)) {
      return { ok: false, reason: "validation" };
    }

    return {
      ok: true,
      value: {
        status,
        explanation,
        correctedSentence,
        collocationTip,
        retryInstruction,
        targetUsageRole: targetUsageRole || undefined,
        warnings: normalizeWarnings(data.warnings),
      },
    };
  } catch {
    return { ok: false, reason: "parse" };
  }
}

function validateRequest(body: unknown): VocabularyCorrectionRequest | string {
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

  const targetVocabulary = normalizeString(
    source.targetVocabulary ?? source.word,
    100,
  );
  if (!targetVocabulary) {
    return "Vocabulary word or phrase is required.";
  }

  const userSentence = normalizeString(
    source.userSentence ?? source.sentence,
    500,
  );
  if (!userSentence) {
    return "Sentence is required.";
  }

  if (!containsVocabWord(userSentence, targetVocabulary)) {
    return "Sentence must include the target vocabulary word or phrase.";
  }

  return {
    provider,
    level,
    targetVocabulary,
    meaning: normalizeString(source.meaning, 300),
    partOfSpeech: normalizeString(source.partOfSpeech, 80),
    userSentence,
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
      max_tokens: 600,
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

  const parsedCorrection = parseVocabularyCorrection(raw);
  if (!parsedCorrection.ok) {
    const error =
      parsedCorrection.reason === "validation"
        ? "Provider JSON did not match the Vocabulary Correction schema. Try again or switch provider."
        : "Provider response could not be parsed as JSON. Try again or switch provider.";
    return NextResponse.json({ error }, { status: 502 });
  }

  return NextResponse.json(parsedCorrection.value);
}
