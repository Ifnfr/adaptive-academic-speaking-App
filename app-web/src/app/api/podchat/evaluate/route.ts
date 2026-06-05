import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { savePodchatMemory } from "../../../lib/storage/supabase-podchat-adapter";
import {
  buildMockPodchatEvaluation,
  callDeepSeek,
  callGemini,
  type PodchatArticleContext,
} from "../_lib/providers";

export const runtime = "nodejs";

const MAX_TURNS = 16;
const MAX_TURN_TEXT_LENGTH = 1200;
const MAX_TRANSCRIPT_LENGTH = 8000;

type PodchatTopic = "Economics" | "Technology";
type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced";
type PodchatSpeaker = "host" | "learner";

type PodchatTurn = {
  speaker: PodchatSpeaker;
  text: string;
};

type PodchatEvaluateRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  turns: PodchatTurn[];
  articleContext?: PodchatArticleContext;
};

type PodchatCorrection = {
  original: string;
  improved: string;
  explanation: string;
};

type PodchatVocabularySuggestion = {
  originalOrBasic: string;
  suggestion: string;
  example: string;
};

type PodchatRecurringError = {
  label: string;
  evidence: string;
  practiceFocus: string;
};

type PodchatAspectStatus = "excellent" | "needs_improvement";

type PodchatAspectFeedbackItem = {
  status: PodchatAspectStatus;
  message: string;
};

type PodchatAspectFeedback = {
  sentenceStructure: PodchatAspectFeedbackItem;
  grammar: PodchatAspectFeedbackItem;
  coherence: PodchatAspectFeedbackItem;
  topicRelevance: PodchatAspectFeedbackItem;
};

type PodchatEvaluateResponse = {
  summary: string;
  corrections: PodchatCorrection[];
  betterSentences: string[];
  vocabularySuggestions: PodchatVocabularySuggestion[];
  recurringErrors: PodchatRecurringError[];
  nextPracticeFocus: string;
  aspectFeedback?: PodchatAspectFeedback;
};

type ValidationResult =
  | { valid: true; request: PodchatEvaluateRequest }
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
  if (articleTitle.length > 160) {
    return { valid: false, error: "articleTitle must not exceed 160 characters." };
  }

  const articleBrief = c.articleBrief;
  if (typeof articleBrief !== "string" || articleBrief.trim().length === 0) {
    return { valid: false, error: "articleBrief must be a non-empty string." };
  }
  if (articleBrief.length > 1200) {
    return { valid: false, error: "articleBrief must not exceed 1200 characters." };
  }

  const mainIdea = c.mainIdea;
  if (mainIdea !== undefined) {
    if (typeof mainIdea !== "string") {
      return { valid: false, error: "mainIdea must be a string." };
    }
    if (mainIdea.length > 400) {
      return { valid: false, error: "mainIdea must not exceed 400 characters." };
    }
  }

  const keyPoints = c.keyPoints;
  if (keyPoints !== undefined) {
    if (!Array.isArray(keyPoints)) {
      return { valid: false, error: "keyPoints must be an array of strings." };
    }
    if (keyPoints.length > 6) {
      return { valid: false, error: "keyPoints must not exceed 6 items." };
    }
    for (let i = 0; i < keyPoints.length; i++) {
      const kp = keyPoints[i];
      if (typeof kp !== "string") {
        return { valid: false, error: `keyPoints at index ${i} must be a string.` };
      }
      if (kp.length > 240) {
        return { valid: false, error: `keyPoints at index ${i} must not exceed 240 characters.` };
      }
    }
  }

  const speakingTaskTitle = c.speakingTaskTitle;
  if (typeof speakingTaskTitle !== "string" || speakingTaskTitle.trim().length === 0) {
    return { valid: false, error: "speakingTaskTitle must be a non-empty string." };
  }
  if (speakingTaskTitle.length > 160) {
    return { valid: false, error: "speakingTaskTitle must not exceed 160 characters." };
  }

  const speakingTaskInstruction = c.speakingTaskInstruction;
  if (typeof speakingTaskInstruction !== "string" || speakingTaskInstruction.trim().length === 0) {
    return { valid: false, error: "speakingTaskInstruction must be a non-empty string." };
  }
  if (speakingTaskInstruction.length > 800) {
    return { valid: false, error: "speakingTaskInstruction must not exceed 800 characters." };
  }

  const targetStructure = c.targetStructure;
  if (targetStructure !== undefined) {
    if (!Array.isArray(targetStructure)) {
      return { valid: false, error: "targetStructure must be an array of strings." };
    }
    if (targetStructure.length > 6) {
      return { valid: false, error: "targetStructure must not exceed 6 items." };
    }
    for (let i = 0; i < targetStructure.length; i++) {
      const ts = targetStructure[i];
      if (typeof ts !== "string") {
        return { valid: false, error: `targetStructure at index ${i} must be a string.` };
      }
      if (ts.length > 160) {
        return { valid: false, error: `targetStructure at index ${i} must not exceed 160 characters.` };
      }
    }
  }

  const sourceDomain = c.sourceDomain;
  if (sourceDomain !== undefined) {
    if (typeof sourceDomain !== "string") {
      return { valid: false, error: "sourceDomain must be a string." };
    }
    if (sourceDomain.length > 160) {
      return { valid: false, error: "sourceDomain must not exceed 160 characters." };
    }
  }

  return {
    valid: true,
    value: {
      articleTitle: articleTitle.trim(),
      articleBrief: articleBrief.trim(),
      mainIdea: mainIdea !== undefined ? mainIdea.trim() : undefined,
      keyPoints: keyPoints !== undefined ? keyPoints.map((kp) => String(kp).trim()) : undefined,
      speakingTaskTitle: speakingTaskTitle.trim(),
      speakingTaskInstruction: speakingTaskInstruction.trim(),
      targetStructure: targetStructure !== undefined ? targetStructure.map((ts) => String(ts).trim()) : undefined,
      sourceDomain: sourceDomain !== undefined ? sourceDomain.trim() : undefined,
    },
  };
}

function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body." };
  }

  const b = body as Record<string, unknown>;
  const topic = b.topic;
  if (topic !== "Economics" && topic !== "Technology") {
    return {
      valid: false,
      error: "Invalid topic. Must be Economics or Technology.",
    };
  }

  const difficulty = b.difficulty;
  if (
    difficulty !== "Beginner" &&
    difficulty !== "Intermediate" &&
    difficulty !== "Advanced"
  ) {
    return {
      valid: false,
      error: "Invalid difficulty. Must be Beginner, Intermediate, or Advanced.",
    };
  }

  const turns = b.turns;
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > MAX_TURNS) {
    return {
      valid: false,
      error: "turns must be a non-empty array with max length 16.",
    };
  }

  let hostTurnCount = 0;
  let learnerTurnCount = 0;
  let transcriptLength = 0;
  const normalizedTurns: PodchatTurn[] = [];

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
    if (text.length > MAX_TURN_TEXT_LENGTH) {
      return {
        valid: false,
        error: `Turn at index ${i} text exceeds 1200 characters.`,
      };
    }

    if (turn.speaker === "host") {
      hostTurnCount++;
    } else {
      learnerTurnCount++;
    }

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
    return {
      valid: false,
      error: "Transcript text is too long. Keep it under 8000 characters.",
    };
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
      topic,
      difficulty,
      turns: normalizedTurns,
      articleContext,
    },
  };
}

function difficultyGuidance(difficulty: PodchatDifficulty): string {
  if (difficulty === "Beginner") {
    return [
      "- Beginner: Use simple explanations.",
      "- Focus on basic grammar, sentence completeness, and clear ideas.",
    ].join("\n");
  }

  if (difficulty === "Intermediate") {
    return [
      "- Intermediate: Focus on reasons, examples, connectors, and sentence structure.",
      "- Help the learner make explanations clearer and more connected.",
    ].join("\n");
  }

  return [
    "- Advanced: Focus on nuance, precision, argument structure, trade-offs, and academic phrasing.",
    "- Help the learner develop stronger implications, counterpoints, and topic depth.",
  ].join("\n");
}

function buildSystemPrompt(req: PodchatEvaluateRequest): string {
  let contextGuidance = `Topic: ${req.topic}`;
  if (req.articleContext) {
    const ac = req.articleContext;
    contextGuidance = [
      `The conversation was based on the article: "${ac.articleTitle}" (Domain: ${ac.sourceDomain || "unknown"}).`,
      `Article Brief: ${ac.articleBrief}`,
      ac.mainIdea ? `Article Main Idea: ${ac.mainIdea}` : "",
      ac.keyPoints ? `Key Points: ${ac.keyPoints.join(", ")}` : "",
      `Speaking Task: "${ac.speakingTaskTitle}"`,
      `Speaking Task Instruction: ${ac.speakingTaskInstruction}`,
      ac.targetStructure ? `Target structure: ${ac.targetStructure.join(" -> ")}` : "",
      "",
      "EVALUATION CRITERIA FOR ARTICLE CONTEXT:",
      "- Evaluate how well the learner's responses address the specific article's ideas and speaking task instructions, as well as general academic speaking criteria.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "You are an academic speaking evaluator for Podchat.",
    "Evaluate only the transcript text from a completed Podchat conversation.",
    contextGuidance,
    `Difficulty: ${req.difficulty}`,
    "",
    "EVALUATION BEHAVIOR:",
    "- Be supportive, precise, and practical.",
    "- Focus on grammar, clarity, vocabulary, sentence structure, and topic development.",
    "- Treat the transcript as possibly generated by speech recognition.",
    "- Avoid over-penalizing ambiguous wording, homophones, filler words, or minor transcript glitches.",
    "- Do not analyze pronunciation or phonemes.",
    "- Do not use psychological, clinical, punitive, or harsh labels.",
    "- Do not return numeric ratings or score objects.",
    "",
    "DIFFICULTY GUIDANCE:",
    difficultyGuidance(req.difficulty),
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown, code fences, or commentary outside JSON.",
    "- The JSON object MUST have exactly these top-level keys:",
    '  "summary", "corrections", "betterSentences", "vocabularySuggestions", "recurringErrors", "nextPracticeFocus", "aspectFeedback".',
    "- summary: one supportive summary, <= 800 characters.",
    "- corrections: array of up to 5 objects with original, improved, explanation.",
    "- betterSentences: array of up to 5 stronger academic sentence strings.",
    "- vocabularySuggestions: array of up to 5 objects with originalOrBasic, suggestion, example.",
    "- recurringErrors: array of up to 5 objects with label, evidence, practiceFocus.",
    "- nextPracticeFocus: one clear practice suggestion, <= 300 characters.",
    "- aspectFeedback: object with sentenceStructure, grammar, coherence, and topicRelevance.",
    '- Each aspectFeedback item must have status "excellent" or "needs_improvement" and a short message.',
    '- If an aspect is strong, use status "excellent" and message "Excellent".',
    "- If an aspect needs improvement, give one short, specific, actionable suggestion.",
    "- Avoid vague advice such as \"improve grammar\".",
    "- Do not include scores, pronunciation fields, phoneme fields, raw provider content, or hidden metadata.",
  ].join("\n");
}

function buildUserPrompt(req: PodchatEvaluateRequest): string {
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
    "TASK:",
    "Evaluate the learner's academic speaking from this conversation.",
    "Return only the required JSON object.",
  ].join("\n");
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
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

function normalizeCorrections(raw: unknown): PodchatCorrection[] | null {
  if (!Array.isArray(raw) || raw.length > 5) return null;

  const result: PodchatCorrection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const original = readShortString(source, "original", 400);
    const improved = readShortString(source, "improved", 400);
    const explanation = readShortString(source, "explanation", 400);
    if (!original || !improved || !explanation) return null;
    result.push({ original, improved, explanation });
  }

  return result;
}

function normalizeVocabularySuggestions(
  raw: unknown,
): PodchatVocabularySuggestion[] | null {
  if (!Array.isArray(raw) || raw.length > 5) return null;

  const result: PodchatVocabularySuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const originalOrBasic = readShortString(source, "originalOrBasic", 300);
    const suggestion = readShortString(source, "suggestion", 300);
    const example = readShortString(source, "example", 400);
    if (!originalOrBasic || !suggestion || !example) return null;
    result.push({ originalOrBasic, suggestion, example });
  }

  return result;
}

function normalizeRecurringErrors(raw: unknown): PodchatRecurringError[] | null {
  if (!Array.isArray(raw) || raw.length > 5) return null;

  const result: PodchatRecurringError[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const label = readShortString(source, "label", 160);
    const evidence = readShortString(source, "evidence", 400);
    const practiceFocus = readShortString(source, "practiceFocus", 300);
    if (!label || !evidence || !practiceFocus) return null;
    result.push({ label, evidence, practiceFocus });
  }

  return result;
}

function normalizeAspectFeedbackItem(raw: unknown): PodchatAspectFeedbackItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const status = source.status;
  if (status !== "excellent" && status !== "needs_improvement") return null;

  const message = readShortString(source, "message", 240);
  if (!message) return null;
  if (status === "needs_improvement" && message.toLowerCase() === "improve grammar") {
    return null;
  }

  return { status, message };
}

function normalizeAspectFeedback(raw: unknown): PodchatAspectFeedback | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const sentenceStructure = normalizeAspectFeedbackItem(source.sentenceStructure);
  const grammar = normalizeAspectFeedbackItem(source.grammar);
  const coherence = normalizeAspectFeedbackItem(source.coherence);
  const topicRelevance = normalizeAspectFeedbackItem(source.topicRelevance);

  if (!sentenceStructure || !grammar || !coherence || !topicRelevance) {
    return null;
  }

  return {
    sentenceStructure,
    grammar,
    coherence,
    topicRelevance,
  };
}

function hasForbiddenOutputKeys(data: Record<string, unknown>): boolean {
  const forbidden = [
    "score",
    "scores",
    "pronunciation",
    "phoneme",
    "phonemes",
    "rawProviderPayload",
    "raw",
  ];
  return forbidden.some((key) => Object.hasOwn(data, key));
}

function validateClaudeOutput(
  text: string,
):
  | { valid: true; response: PodchatEvaluateResponse }
  | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }

  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!data || typeof data !== "object" || hasForbiddenOutputKeys(data)) {
      return { valid: false, error: "Provider response has forbidden fields." };
    }

    const summary = readShortString(data, "summary", 800);
    const corrections = normalizeCorrections(data.corrections);
    const betterSentences = normalizeStringArray(data.betterSentences, 5);
    const vocabularySuggestions = normalizeVocabularySuggestions(
      data.vocabularySuggestions,
    );
    const recurringErrors = normalizeRecurringErrors(data.recurringErrors);
    const nextPracticeFocus = readShortString(data, "nextPracticeFocus", 300);
    const aspectFeedback =
      data.aspectFeedback === undefined
        ? undefined
        : normalizeAspectFeedback(data.aspectFeedback);

    if (
      !summary ||
      !corrections ||
      !betterSentences ||
      !vocabularySuggestions ||
      !recurringErrors ||
      !nextPracticeFocus ||
      (data.aspectFeedback !== undefined && !aspectFeedback)
    ) {
      return { valid: false, error: "Provider response schema is invalid." };
    }

    return {
      valid: true,
      response: {
        summary,
        corrections,
        betterSentences,
        vocabularySuggestions,
        recurringErrors,
        nextPracticeFocus,
        aspectFeedback: aspectFeedback ?? undefined,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to parse provider output: ${message}`,
    };
  }
}

function buildMockAspectFeedback(): PodchatAspectFeedback {
  return {
    sentenceStructure: {
      status: "needs_improvement",
      message: "Use a complete sentence with a clear subject and verb.",
    },
    grammar: {
      status: "needs_improvement",
      message: "Check subject-verb agreement in your main idea.",
    },
    coherence: {
      status: "needs_improvement",
      message: "Add one reason or example after your main idea.",
    },
    topicRelevance: {
      status: "excellent",
      message: "Excellent",
    },
  };
}

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getDbClient: null as (() => unknown) | null,
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

function getDbClient(): ReturnType<typeof createClient> | null {
  if (testHooks.getDbClient) {
    return testHooks.getDbClient() as ReturnType<typeof createClient>;
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

  let provider = (process.env.PODCHAT_AI_PROVIDER || "claude").toLowerCase();
  if (provider === "undefined") {
    provider = "claude";
  }
  const validatedReq = validation.request;
  let evaluationResponse: PodchatEvaluateResponse;

  if (provider === "mock") {
    const text = buildMockPodchatEvaluation(validatedReq);
    const outputValidation = validateClaudeOutput(text);
    if (!outputValidation.valid) {
      console.error(`Mock output validation failed: ${outputValidation.error}. Raw: ${text}`);
      return NextResponse.json(
        { error: "Invalid provider response format. Please try again." },
        { status: 502 }
      );
    }
    evaluationResponse = {
      ...outputValidation.response,
      aspectFeedback: buildMockAspectFeedback(),
    };
  } else if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }

    const systemPrompt = buildSystemPrompt(validatedReq);
    const userPrompt = buildUserPrompt(validatedReq);

    try {
      const text = await callGemini(apiKey, systemPrompt, userPrompt);
      const outputValidation = validateClaudeOutput(text);
      if (!outputValidation.valid) {
        console.error(`Gemini output validation failed: ${outputValidation.error}. Raw: ${text}`);
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 }
        );
      }
      evaluationResponse = outputValidation.response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected Gemini error: ${message}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  } else if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }

    const systemPrompt = buildSystemPrompt(validatedReq);
    const userPrompt = buildUserPrompt(validatedReq);

    try {
      const text = await callDeepSeek(apiKey, systemPrompt, userPrompt);
      const outputValidation = validateClaudeOutput(text);
      if (!outputValidation.valid) {
        console.error(`DeepSeek output validation failed: ${outputValidation.error}. Raw: ${text}`);
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 }
        );
      }
      evaluationResponse = outputValidation.response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected DeepSeek error: ${message}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  } else {
    // Claude Default
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }

    const systemPrompt = buildSystemPrompt(validatedReq);
    const userPrompt = buildUserPrompt(validatedReq);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Claude API error ${res.status}: ${errText.slice(0, 500)}`);
        return NextResponse.json(
          { error: "Provider request failed. Please try again later." },
          { status: 502 },
        );
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.find((content) => content.type === "text")?.text;
      const outputValidation = validateClaudeOutput(text ?? "");
      if (!outputValidation.valid) {
        console.error(
          `Claude output validation failed: ${outputValidation.error}. Raw: ${text ?? ""}`,
        );
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 },
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

  let memorySaved = false;
  const ownerId = await resolveCurrentUserId();
  if (ownerId) {
    const dbClient = getDbClient();
    if (dbClient) {
      try {
        const rawBody = parsedBody as Record<string, unknown>;
        const durationSeconds = typeof rawBody.durationSeconds === "number" && rawBody.durationSeconds > 0
          ? rawBody.durationSeconds
          : 60;
        const elapsedSeconds = typeof rawBody.elapsedSeconds === "number" && rawBody.elapsedSeconds >= 0
          ? rawBody.elapsedSeconds
          : undefined;

        const saveResult = await savePodchatMemory(
          {
            ownerId,
            provider,
            topic: validatedReq.topic,
            difficulty: validatedReq.difficulty,
            articleContext: validatedReq.articleContext,
            durationSeconds,
            elapsedSeconds,
            turns: validatedReq.turns,
            evaluation: evaluationResponse,
          },
          dbClient,
        );

        if (saveResult.ok) {
          memorySaved = true;
        } else {
          console.error(`savePodchatMemory failed: ${saveResult.error}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error inside savePodchatMemory call: ${msg}`);
      }
    }
  }

  const finalResponse = {
    ...evaluationResponse,
    memory: { saved: memorySaved },
  };

  return NextResponse.json(finalResponse);
}
