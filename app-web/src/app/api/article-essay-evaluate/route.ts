import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveArticleWritingMemory } from "../../lib/storage/supabase-article-writing-adapter";

export const runtime = "nodejs";

type Provider = "Claude" | "DeepSeek" | "Gemini";
type Level = "Beginner" | "Intermediate" | "Advanced";
type FeedbackLanguage = "English" | "Indonesian";

type ArticleEssayQuestion = {
  id: string;
  question: string;
  expectedFocus: string;
  targetSkill:
    | "main_idea"
    | "supporting_detail"
    | "inference"
    | "vocabulary_in_context"
    | "critical_response";
  suggestedWordCount: {
    min: number;
    max: number;
  };
};

type ArticleEssayEvaluateRequest = {
  provider: Provider;
  level: Level;
  feedbackLanguage: FeedbackLanguage;
  targetLanguage: string;
  articleContext: {
    sourceTitle: string;
    articleBrief: string;
    mainIdea: string;
    keyPoints: string[];
  };
  questions: ArticleEssayQuestion[];
  answers: {
    questionId: string;
    answer: string;
  }[];
};

type ArticleEssayQuestionFeedback = {
  questionId: string;
  comprehension: string;
  topicRelevance: string;
  grammarNotes: string[];
  wordFormOrPartOfSpeechNotes: string[];
  sentenceStructureNotes: string[];
  coherenceNotes: string[];
  vocabularyNotes: string[];
  improvedAnswerExample: string;
};

type ArticleEssayRecurringError = {
  label: string;
  explanation: string;
  exampleFromUser: string;
  correction: string;
};

type ArticleEssayEvaluationResponse = {
  overallFeedback: string;
  perQuestionFeedback: ArticleEssayQuestionFeedback[];
  recurringErrors: ArticleEssayRecurringError[];
  nextWritingFocus: string;
};

const TARGET_SKILLS = [
  "main_idea",
  "supporting_detail",
  "inference",
  "vocabulary_in_context",
  "critical_response",
] as const;

const FORBIDDEN_REQUEST_KEYS = [
  "fullarticletext",
  "sourceurl",
  "userid",
  "useridentity",
  "email",
  "auth",
  "authmetadata",
  "storagepath",
  "audioblob",
  "audio",
  "recordingurl",
  "transcript",
  "stt",
  "tts",
  "file",
  "files",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasForbiddenRequestKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenRequestKey(item));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.entries(value).some(([key, nested]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return (
      FORBIDDEN_REQUEST_KEYS.includes(normalizedKey) ||
      hasForbiddenRequestKey(nested)
    );
  });
}

function readRequiredString(
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

function readStringArray(
  raw: unknown,
  minItems: number,
  maxItems: number,
  maxLength: number,
): string[] | null {
  if (!Array.isArray(raw) || raw.length < minItems || raw.length > maxItems) {
    return null;
  }

  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) return null;
    result.push(trimmed);
  }
  return result;
}

function isTargetSkill(
  value: unknown,
): value is ArticleEssayQuestion["targetSkill"] {
  return (
    typeof value === "string" &&
    (TARGET_SKILLS as readonly string[]).includes(value)
  );
}

function normalizeQuestion(raw: unknown): ArticleEssayQuestion | null {
  if (!isPlainObject(raw)) return null;
  const id = readRequiredString(raw, "id", 40);
  const question = readRequiredString(raw, "question", 280);
  const expectedFocus = readRequiredString(raw, "expectedFocus", 400);
  const targetSkill = raw.targetSkill;
  const suggestedWordCount = raw.suggestedWordCount;

  if (
    !id ||
    !question ||
    !expectedFocus ||
    !isTargetSkill(targetSkill) ||
    !isPlainObject(suggestedWordCount)
  ) {
    return null;
  }

  const min = suggestedWordCount.min;
  const max = suggestedWordCount.max;
  if (
    typeof min !== "number" ||
    !Number.isInteger(min) ||
    min < 30 ||
    typeof max !== "number" ||
    !Number.isInteger(max) ||
    max > 220 ||
    min > max
  ) {
    return null;
  }

  return {
    id,
    question,
    expectedFocus,
    targetSkill,
    suggestedWordCount: { min, max },
  };
}

function normalizeQuestions(raw: unknown): ArticleEssayQuestion[] | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;

  const ids = new Set<string>();
  const questions: ArticleEssayQuestion[] = [];
  for (const item of raw) {
    const question = normalizeQuestion(item);
    if (!question || ids.has(question.id)) return null;
    ids.add(question.id);
    questions.push(question);
  }
  return questions;
}

function normalizeAnswers(
  raw: unknown,
  questionIds: ReadonlySet<string>,
): ArticleEssayEvaluateRequest["answers"] | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;

  const seen = new Set<string>();
  const answers: ArticleEssayEvaluateRequest["answers"] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return null;
    const questionId = readRequiredString(item, "questionId", 40);
    const answer = readRequiredString(item, "answer", 1200);
    if (
      !questionId ||
      !answer ||
      !questionIds.has(questionId) ||
      seen.has(questionId)
    ) {
      return null;
    }
    seen.add(questionId);
    answers.push({ questionId, answer });
  }

  return seen.size === questionIds.size ? answers : null;
}

function validateRequest(
  body: unknown,
):
  | { valid: true; request: ArticleEssayEvaluateRequest }
  | { valid: false; error: string } {
  if (!isPlainObject(body)) {
    return { valid: false, error: "Invalid request body." };
  }
  if (hasForbiddenRequestKey(body)) {
    return { valid: false, error: "Request contains unsupported private data." };
  }

  const rawProvider = body.provider ?? "Claude";
  if (
    rawProvider !== "Claude" &&
    rawProvider !== "DeepSeek" &&
    rawProvider !== "Gemini"
  ) {
    return { valid: false, error: "Unsupported provider." };
  }

  if (
    body.level !== "Beginner" &&
    body.level !== "Intermediate" &&
    body.level !== "Advanced"
  ) {
    return { valid: false, error: "Unsupported level." };
  }

  if (
    body.feedbackLanguage !== "English" &&
    body.feedbackLanguage !== "Indonesian"
  ) {
    return { valid: false, error: "Unsupported feedbackLanguage." };
  }

  if (!isPlainObject(body.articleContext)) {
    return { valid: false, error: "articleContext is required." };
  }

  const sourceTitle = readRequiredString(body.articleContext, "sourceTitle", 200);
  const articleBrief = readRequiredString(
    body.articleContext,
    "articleBrief",
    1500,
  );
  const mainIdea = readRequiredString(body.articleContext, "mainIdea", 500);
  const keyPoints = readStringArray(body.articleContext.keyPoints, 1, 8, 240);
  if (!sourceTitle || !articleBrief || !mainIdea || !keyPoints) {
    return { valid: false, error: "articleContext is invalid." };
  }

  const questions = normalizeQuestions(body.questions);
  if (!questions) {
    return { valid: false, error: "questions must contain exactly 5 items." };
  }

  const questionIds = new Set(questions.map((question) => question.id));
  const answers = normalizeAnswers(body.answers, questionIds);
  if (!answers) {
    return {
      valid: false,
      error: "answers must contain exactly one answer for each question.",
    };
  }

  return {
    valid: true,
    request: {
      provider: rawProvider,
      level: body.level,
      feedbackLanguage: body.feedbackLanguage,
      targetLanguage:
        typeof body.targetLanguage === "string" && body.targetLanguage.trim()
          ? body.targetLanguage.trim().slice(0, 40)
          : "English",
      articleContext: {
        sourceTitle,
        articleBrief,
        mainIdea,
        keyPoints,
      },
      questions,
      answers,
    },
  };
}

function buildSystemPrompt(req: ArticleEssayEvaluateRequest): string {
  return [
    "You are an academic writing evaluator for Article Writing Comprehension Practice.",
    "Evaluate the learner's five short paragraph answers using only the compact article context, questions, and answers provided.",
    `Learner level: ${req.level}`,
    `Feedback language: ${req.feedbackLanguage}`,
    "",
    "BOUNDARIES:",
    "- Do not use numeric scores.",
    "- Do not evaluate pronunciation, phonemes, speaking, or audio.",
    "- Do not request or refer to raw article text, source URLs, user identity, auth metadata, storage paths, or transcripts.",
    "- Treat answers as writing practice, not speaking practice.",
    "",
    "EVALUATION FOCUS:",
    "- Reading comprehension.",
    "- Topic relevance and substance.",
    "- Grammar.",
    "- Part of speech and word form issues.",
    "- Sentence structure.",
    "- Coherence.",
    "- Vocabulary and word choice.",
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these top-level keys: overallFeedback, perQuestionFeedback, recurringErrors, nextWritingFocus.",
    "- perQuestionFeedback MUST contain exactly 5 items, one per questionId.",
    "- grammarNotes, wordFormOrPartOfSpeechNotes, sentenceStructureNotes, coherenceNotes, and vocabularyNotes are arrays of concise strings.",
    "- improvedAnswerExample should be short and helpful, not a full essay.",
  ].join("\n");
}

function buildUserPrompt(req: ArticleEssayEvaluateRequest): string {
  return [
    "COMPACT ARTICLE CONTEXT:",
    JSON.stringify(req.articleContext),
    "",
    "ESSAY QUESTIONS:",
    JSON.stringify(req.questions),
    "",
    "LEARNER ANSWERS:",
    JSON.stringify(req.answers),
    "",
    "TASK:",
    "Evaluate all five answers in one response. Return only the required JSON object.",
  ].join("\n");
}

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
  if (isModelError) return `${provider} model not available.`;
  if (status === 401 || status === 403) return "API key rejected.";
  if (status === 429 || /rate limit|quota|too many requests/.test(text)) {
    return "Rate limit reached. Please wait before trying again.";
  }
  return "Provider request failed. Please try again later.";
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
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Claude API error ${res.status}: ${errText.slice(0, 500)}`);
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
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new Error(friendlyProviderError("Gemini", res.status, errText));
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

function getApiKey(provider: Provider): string | undefined {
  if (provider === "Claude") return process.env.CLAUDE_API_KEY;
  if (provider === "DeepSeek") return process.env.DEEPSEEK_API_KEY;
  return process.env.GEMINI_API_KEY;
}

function isArticleMockProvider(): boolean {
  return process.env.ARTICLE_AI_PROVIDER?.trim().toLowerCase() === "mock";
}

function buildMockArticleEssayEvaluation(
  req: ArticleEssayEvaluateRequest,
): ArticleEssayEvaluationResponse {
  return {
    overallFeedback:
      "Your answers show a clear understanding of the article's main message. The next improvement is to support each answer with one precise article detail and connect ideas with smoother academic transitions.",
    perQuestionFeedback: req.questions.map((question) => ({
      questionId: question.id,
      comprehension:
        "You answer the question directly and show basic understanding of the article context.",
      topicRelevance:
        "The response stays relevant, but it can use more specific evidence from the article brief or key points.",
      grammarNotes: [
        "Use consistent verb tense when explaining article ideas.",
        "Check subject-verb agreement in longer sentences.",
      ],
      wordFormOrPartOfSpeechNotes: [
        "Use nouns such as improvement or dependence after academic verbs.",
      ],
      sentenceStructureNotes: [
        "Begin with a clear topic sentence before adding explanation.",
        "Combine short ideas with because, however, or therefore.",
      ],
      coherenceNotes: [
        "Link the claim, article detail, and explanation in one paragraph.",
      ],
      vocabularyNotes: [
        "Use precise phrases such as intentional practice and learning strategy.",
      ],
      improvedAnswerExample:
        "The article suggests that AI tools are helpful when learners use them intentionally, because feedback is more useful when it supports a clear learning goal.",
    })),
    recurringErrors: [
      {
        label: "General support",
        explanation:
          "Several answers make a reasonable point but need one article-based detail to make the explanation stronger.",
        exampleFromUser: req.answers[0]?.answer.slice(0, 160) || "The article is useful.",
        correction:
          "The article is useful because it explains how feedback loops help learners revise with a clearer goal.",
      },
      {
        label: "Sentence connection",
        explanation:
          "Some ideas would read more academically if the relationship between claim and reason were explicit.",
        exampleFromUser: req.answers[1]?.answer.slice(0, 160) || "Technology helps students.",
        correction:
          "Technology helps students when it gives targeted feedback, but it can distract them without clear study routines.",
      },
    ],
    nextWritingFocus:
      "For the next article task, write each answer as one claim, one article detail, and one explanation of why the detail matters.",
  };
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
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function hasForbiddenOutputKeys(data: Record<string, unknown>): boolean {
  return [
    "score",
    "scores",
    "pronunciation",
    "phoneme",
    "phonemes",
    "audio",
    "stt",
    "tts",
    "rawProviderPayload",
    "raw",
  ].some((key) => Object.hasOwn(data, key));
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

function normalizeOutputStringArray(
  raw: unknown,
  maxItems: number,
): string[] | null {
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

function normalizePerQuestionFeedback(
  raw: unknown,
  questionIds: ReadonlySet<string>,
): ArticleEssayQuestionFeedback[] | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;

  const seen = new Set<string>();
  const result: ArticleEssayQuestionFeedback[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || hasForbiddenOutputKeys(item)) return null;
    const questionId = readShortString(item, "questionId", 40);
    const comprehension = readShortString(item, "comprehension", 500);
    const topicRelevance = readShortString(item, "topicRelevance", 500);
    const grammarNotes = normalizeOutputStringArray(item.grammarNotes, 5);
    const wordFormOrPartOfSpeechNotes = normalizeOutputStringArray(
      item.wordFormOrPartOfSpeechNotes,
      5,
    );
    const sentenceStructureNotes = normalizeOutputStringArray(
      item.sentenceStructureNotes,
      5,
    );
    const coherenceNotes = normalizeOutputStringArray(item.coherenceNotes, 5);
    const vocabularyNotes = normalizeOutputStringArray(item.vocabularyNotes, 5);
    const improvedAnswerExample = readShortString(
      item,
      "improvedAnswerExample",
      700,
    );

    if (
      !questionId ||
      !questionIds.has(questionId) ||
      seen.has(questionId) ||
      !comprehension ||
      !topicRelevance ||
      !grammarNotes ||
      !wordFormOrPartOfSpeechNotes ||
      !sentenceStructureNotes ||
      !coherenceNotes ||
      !vocabularyNotes ||
      !improvedAnswerExample
    ) {
      return null;
    }

    seen.add(questionId);
    result.push({
      questionId,
      comprehension,
      topicRelevance,
      grammarNotes,
      wordFormOrPartOfSpeechNotes,
      sentenceStructureNotes,
      coherenceNotes,
      vocabularyNotes,
      improvedAnswerExample,
    });
  }

  return seen.size === questionIds.size ? result : null;
}

function normalizeRecurringErrors(
  raw: unknown,
): ArticleEssayRecurringError[] | null {
  if (!Array.isArray(raw) || raw.length > 6) return null;

  const result: ArticleEssayRecurringError[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || hasForbiddenOutputKeys(item)) return null;
    const label = readShortString(item, "label", 160);
    const explanation = readShortString(item, "explanation", 500);
    const exampleFromUser = readShortString(item, "exampleFromUser", 500);
    const correction = readShortString(item, "correction", 500);
    if (!label || !explanation || !exampleFromUser || !correction) return null;
    result.push({ label, explanation, exampleFromUser, correction });
  }

  return result;
}

function validateProviderOutput(
  raw: string,
  questionIds: ReadonlySet<string>,
):
  | { valid: true; response: ArticleEssayEvaluationResponse }
  | { valid: false; error: string } {
  const jsonText = extractBalancedJsonObject(raw);
  if (!jsonText) return { valid: false, error: "No JSON object found." };

  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!isPlainObject(data) || hasForbiddenOutputKeys(data)) {
      return { valid: false, error: "Provider response has forbidden fields." };
    }

    const overallFeedback = readShortString(data, "overallFeedback", 1000);
    const perQuestionFeedback = normalizePerQuestionFeedback(
      data.perQuestionFeedback,
      questionIds,
    );
    const recurringErrors = normalizeRecurringErrors(data.recurringErrors);
    const nextWritingFocus = readShortString(data, "nextWritingFocus", 400);

    if (
      !overallFeedback ||
      !perQuestionFeedback ||
      !recurringErrors ||
      !nextWritingFocus
    ) {
      return { valid: false, error: "Provider response schema is invalid." };
    }

    return {
      valid: true,
      response: {
        overallFeedback,
        perQuestionFeedback,
        recurringErrors,
        nextWritingFocus,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse provider output: ${message}` };
  }
}

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
};

async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient() {
  if (testHooks.getSupabaseClient) {
    return testHooks.getSupabaseClient() as ReturnType<typeof createClient> | null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

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

  const validation = validateRequest(parsed);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const validated = validation.request;
  let evaluationResponse: ArticleEssayEvaluationResponse;

  if (isArticleMockProvider()) {
    evaluationResponse = buildMockArticleEssayEvaluation(validated);
  } else {
    const apiKey = getApiKey(validated.provider);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Article essay evaluation provider error: ${message}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 },
      );
    }

    const questionIds = new Set(validated.questions.map((question) => question.id));
    const outputValidation = validateProviderOutput(raw, questionIds);
    if (!outputValidation.valid) {
      console.error(
        `Article essay evaluation output validation failed: ${outputValidation.error}`,
      );
      return NextResponse.json(
        { error: "Invalid provider response format. Please try again." },
        { status: 502 },
      );
    }
    evaluationResponse = outputValidation.response;
  }

  let memorySaved = false;
  const ownerId = await resolveCurrentUserId();
  if (ownerId) {
    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      try {
        const saveResult = await saveArticleWritingMemory(
          {
            ownerId,
            provider: validated.provider,
            level: validated.level,
            feedbackLanguage: validated.feedbackLanguage,
            articleContext: validated.articleContext,
            questions: validated.questions,
            answers: validated.answers,
            evaluation: evaluationResponse,
          },
          supabaseClient,
        );
        if (saveResult.ok) {
          memorySaved = true;
        } else {
          console.error(`saveArticleWritingMemory failed: ${saveResult.error}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error inside saveArticleWritingMemory call: ${msg}`);
      }
    }
  }

  const finalResponse = {
    ...evaluationResponse,
    memory: { saved: memorySaved },
  };

  return NextResponse.json(finalResponse);
}
