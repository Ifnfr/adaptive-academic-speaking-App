import { NextResponse } from "next/server";
import {
  callDeepSeek,
  callGemini,
  callOpenAICompatibleForProvider,
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
const MAX_AICONTEXT_LENGTH = 1200;
const MAX_TURN_TEXT_LENGTH = 1200;
const MAX_BUBBLES = 40;
const CHUNK_SIZE = 10;

export type PodchatBubbleIssueType =
  | "grammar"
  | "vocabulary"
  | "idea_development"
  | "responsiveness"
  | "fluency";

export type PodchatBubbleIssue = {
  type: PodchatBubbleIssueType;
  problem: string;
  correction: string;
  explanation: string;
};

export type PodchatMicroDrill = {
  focus: string;
  instruction: string;
  example: string;
};

export type PodchatBubbleStatus = "strong" | "developing" | "needs_work";

export type PodchatBubbleEvaluation = {
  bubbleId: string;
  status: PodchatBubbleStatus;
  strengths: string[];
  issues: PodchatBubbleIssue[];
  strongerVersion: string;
  microDrill: PodchatMicroDrill;
};

export type PodchatBubbleWeakness = {
  label: string;
  evidence: string;
  practiceFocus: string;
  count: number;
};

export type PodchatBubbleSummary = {
  overallStatus: PodchatBubbleStatus;
  topWeaknesses: PodchatBubbleWeakness[];
  nextPracticeFocus: string;
};

type PodchatBubbleTurn = {
  speaker: "host" | "learner";
  text: string;
};

type PodchatBubbleItem = {
  id: string;
  text: string;
  aiContext?: string;
};

type PodchatEvaluateBubblesRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  sessionMode: PodchatSessionMode;
  learnerBubbles: PodchatBubbleItem[];
  turns?: PodchatBubbleTurn[];
  articleContext?: PodchatArticleContext;
};

type ValidationResult =
  | { valid: true; request: PodchatEvaluateBubblesRequest }
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

  const rawBubbles = b.learnerBubbles;
  if (!Array.isArray(rawBubbles) || rawBubbles.length === 0) {
    return { valid: false, error: "learnerBubbles must be a non-empty array." };
  }
  if (rawBubbles.length > MAX_BUBBLES) {
    return { valid: false, error: `learnerBubbles must not exceed ${MAX_BUBBLES} items.` };
  }

  const learnerBubbles: PodchatBubbleItem[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < rawBubbles.length; i++) {
    const raw = rawBubbles[i] as unknown;
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: `learnerBubbles at index ${i} must be an object.` };
    }
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id || id.length > 120) {
      return { valid: false, error: `learnerBubbles at index ${i} has an invalid id.` };
    }
    if (seenIds.has(id)) {
      return { valid: false, error: `learnerBubbles at index ${i} has a duplicate id.` };
    }
    seenIds.add(id);
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (text.length === 0 || text.length > MAX_BUBBLE_TEXT_LENGTH) {
      return { valid: false, error: `learnerBubbles at index ${i} text must be 1-${MAX_BUBBLE_TEXT_LENGTH} chars.` };
    }
    const aiContext =
      typeof item.aiContext === "string" && item.aiContext.trim().length > 0
        ? item.aiContext.trim().slice(0, MAX_AICONTEXT_LENGTH)
        : undefined;
    learnerBubbles.push({ id, text, aiContext });
  }

  let turns: PodchatBubbleTurn[] | undefined;
  if (b.turns !== undefined) {
    const rawTurns = b.turns;
    if (!Array.isArray(rawTurns) || rawTurns.length === 0) {
      return { valid: false, error: "turns must be a non-empty array." };
    }
    if (rawTurns.length > 40) {
      return { valid: false, error: "turns must not exceed 40 items." };
    }
    const normalizedTurns: PodchatBubbleTurn[] = [];
    for (let i = 0; i < rawTurns.length; i++) {
      const rawTurn = rawTurns[i] as unknown;
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
        return { valid: false, error: `Turn at index ${i} text exceeds ${MAX_TURN_TEXT_LENGTH} characters.` };
      }
      normalizedTurns.push({ speaker: turn.speaker, text });
    }
    turns = normalizedTurns;
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
      learnerBubbles,
      turns,
      articleContext,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalizers / output validation
// ---------------------------------------------------------------------------

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

function normalizeStringArray(raw: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(raw) || raw.length > maxItems) return null;
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) return null;
    result.push(trimmed);
  }
  return result;
}

const BUBBLE_ISSUE_TYPES = new Set<PodchatBubbleIssueType>([
  "grammar",
  "vocabulary",
  "idea_development",
  "responsiveness",
  "fluency",
]);

function normalizeIssues(raw: unknown): PodchatBubbleIssue[] | null {
  if (!Array.isArray(raw) || raw.length > 3) return null;
  const result: PodchatBubbleIssue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const type = source.type;
    if (typeof type !== "string" || !BUBBLE_ISSUE_TYPES.has(type as PodchatBubbleIssueType)) {
      return null;
    }
    const problem = readShortString(source, "problem", 400);
    const correction = readShortString(source, "correction", 400);
    const explanation = readShortString(source, "explanation", 400);
    if (!problem || !correction || !explanation) return null;
    result.push({
      type: type as PodchatBubbleIssueType,
      problem,
      correction,
      explanation,
    });
  }
  return result;
}

function normalizeMicroDrill(raw: unknown): PodchatMicroDrill | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const focus = readShortString(source, "focus", 200);
  const instruction = readShortString(source, "instruction", 300);
  const example = readShortString(source, "example", 300);
  if (!focus || !instruction || !example) return null;
  return { focus, instruction, example };
}

const BUBBLE_STATUSES = new Set<PodchatBubbleStatus>([
  "strong",
  "developing",
  "needs_work",
]);

function normalizeEvaluation(raw: unknown): PodchatBubbleEvaluation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (hasForbiddenOutputKeys(source)) return null;

  const bubbleId = readShortString(source, "bubbleId", 120);
  const status = source.status;
  if (typeof status !== "string" || !BUBBLE_STATUSES.has(status as PodchatBubbleStatus)) {
    return null;
  }
  const strengths = normalizeStringArray(source.strengths, 3, 300);
  const issues = normalizeIssues(source.issues);
  const strongerVersion = readShortString(source, "strongerVersion", 1200);
  const microDrill = normalizeMicroDrill(source.microDrill);
  if (!bubbleId || !strengths || !issues || !strongerVersion || !microDrill) return null;

  return {
    bubbleId,
    status: status as PodchatBubbleStatus,
    strengths,
    issues,
    strongerVersion,
    microDrill,
  };
}

function normalizeWeakness(raw: unknown): PodchatBubbleWeakness | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const label = readShortString(source, "label", 160);
  const evidence = readShortString(source, "evidence", 400);
  const practiceFocus = readShortString(source, "practiceFocus", 300);
  const count = source.count;
  if (
    !label || !evidence || !practiceFocus ||
    typeof count !== "number" || !Number.isFinite(count) || count < 1 || count > MAX_BUBBLES
  ) {
    return null;
  }
  return { label, evidence, practiceFocus, count: Math.round(count) };
}

function normalizeSummary(raw: unknown): PodchatBubbleSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (hasForbiddenOutputKeys(source)) return null;

  const overallStatus = source.overallStatus;
  if (typeof overallStatus !== "string" || !BUBBLE_STATUSES.has(overallStatus as PodchatBubbleStatus)) {
    return null;
  }
  const topWeaknessesRaw = source.topWeaknesses;
  if (!Array.isArray(topWeaknessesRaw) || topWeaknessesRaw.length > 3) return null;
  const topWeaknesses: PodchatBubbleWeakness[] = [];
  for (const item of topWeaknessesRaw) {
    const weakness = normalizeWeakness(item);
    if (!weakness) return null;
    topWeaknesses.push(weakness);
  }
  const nextPracticeFocus = readShortString(source, "nextPracticeFocus", 300);
  if (!nextPracticeFocus) return null;

  return {
    overallStatus: overallStatus as PodchatBubbleStatus,
    topWeaknesses,
    nextPracticeFocus,
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

function validateChunkOutput(
  text: string,
): { valid: true; evaluations: PodchatBubbleEvaluation[] } | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!data || typeof data !== "object" || hasForbiddenOutputKeys(data)) {
      return { valid: false, error: "Provider response has forbidden fields." };
    }
    const rawEvaluations = data.evaluations;
    if (!Array.isArray(rawEvaluations) || rawEvaluations.length === 0) {
      return { valid: false, error: "Provider response has no evaluations." };
    }
    const evaluations: PodchatBubbleEvaluation[] = [];
    for (const item of rawEvaluations) {
      const evaluation = normalizeEvaluation(item);
      if (!evaluation) {
        return { valid: false, error: "Provider response schema is invalid." };
      }
      evaluations.push(evaluation);
    }
    return { valid: true, evaluations };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse provider output: ${message}` };
  }
}

function validateSummaryOutput(
  text: string,
): { valid: true; summary: PodchatBubbleSummary } | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    const summary = normalizeSummary(data);
    if (!summary) {
      return { valid: false, error: "Provider summary schema is invalid." };
    }
    return { valid: true, summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse provider output: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSharedContextGuidance(req: PodchatEvaluateBubblesRequest): string[] {
  const lines: string[] = [];
  if (req.articleContext) {
    const ac = req.articleContext;
    lines.push(
      `The conversation was based on the article: "${ac.articleTitle}" (Domain: ${ac.sourceDomain || "unknown"}).`,
      `Article Brief: ${ac.articleBrief}`,
      ac.mainIdea ? `Article Main Idea: ${ac.mainIdea}` : "",
      `Speaking Task: "${ac.speakingTaskTitle}"`,
      `Speaking Task Instruction: ${ac.speakingTaskInstruction}`,
      "",
      "CONTEXT PARSING SAFEGUARD: Evaluate the learner's responses strictly against this context. Do NOT hallucinate criteria not present in the context.",
    );
  }
  lines.push(
    `Topic: ${req.topic}`,
    `Difficulty: ${req.difficulty}`,
    req.sessionMode === "context_open_ended"
      ? "SESSION MODE: Context Discussion / Open-ended."
      : "SESSION MODE: Normal timed Podchat.",
  );
  return lines.filter(Boolean);
}

function buildSystemPrompt(req: PodchatEvaluateBubblesRequest): string {
  return [
    "You are an academic speaking coach evaluating individual learner utterances (bubbles) from a Podchat conversation.",
    "Evaluate SPOKEN English, not written English. Treat the transcript as possibly generated by speech recognition (STT): do not penalize homophones, missing punctuation, capitalization, or minor transcription glitches.",
    "Be supportive, precise, and practical. Never use empty praise; every strength must reference specific words the learner actually said.",
    "",
    "TRANSCRIPT GROUNDING RULE (CRITICAL):",
    "- Every issue must quote or closely paraphrase the learner's actual words (problem field) and explain why it is weak.",
    "- Provide an exact correction (correction field) and a sentence-specific explanation — never a generic grammar rule.",
    "- Provide a strongerVersion: a complete rewritten version of the learner's utterance that could serve as a model answer.",
    "- Do not state a problem without showing what a better response looks like.",
    "",
    "L1 TRANSFER AWARENESS:",
    "- The learner's first language is Indonesian. When an error reflects a common Indonesian-to-English transfer pattern (dropped subject, missing article, missing auxiliary verb, Indonesian word order, literal translation such as 'we solve to end the conversations here'), name that transfer pattern explicitly in the explanation and show the corrected English form.",
    "- Apply this only when the pattern genuinely fits; never force it.",
    "",
    ...buildSharedContextGuidance(req),
    "",
    "PER-BUBBLE EVALUATION:",
    "- Evaluate each bubble independently against its own context (the host question it responds to) and the conversation so far.",
    "- status: strong (clear, developed, accurate for the difficulty level) | developing (understandable but with notable gaps) | needs_work (significantly underdeveloped or hard to follow).",
    "- strengths: up to 3 specific things that worked, quoting the learner's words.",
    "- issues: up to 3, each with type (grammar | vocabulary | idea_development | responsiveness | fluency), problem (quote), correction (corrected form), explanation (why, sentence-specific, L1-aware when it fits).",
    "- microDrill: ONE concrete speaking exercise targeting the single biggest issue of that bubble, with a clear instruction and one example the learner can imitate.",
    "",
    "OUTPUT FORMAT: Respond with ONLY a single JSON object (no markdown fences, no commentary). Exactly these keys:",
    '  "evaluations": [ { "bubbleId", "status" ("strong"|"developing"|"needs_work"), "strengths" (string[] <= 3, each <= 300 chars), "issues" (<= 3 of { "type", "problem" <= 400, "correction" <= 400, "explanation" <= 400 }), "strongerVersion" (<= 1200 chars), "microDrill" ({ "focus" <= 200, "instruction" <= 300, "example" <= 300 }) } ]',
    "- Use the exact bubbleId values provided in the request.",
    "- Do NOT include numeric scores, pronunciation/phoneme analysis, or any other keys.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildChunkUserPrompt(
  req: PodchatEvaluateBubblesRequest,
  chunk: PodchatBubbleItem[],
): string {
  const lines: string[] = [];
  if (req.turns && req.turns.length > 0) {
    lines.push(
      "PODCHAT TRANSCRIPT:",
      req.turns
        .map((turn) => `${turn.speaker === "host" ? "AI Host" : "Learner"}: ${turn.text}`)
        .join("\n\n"),
      "",
    );
  }
  lines.push("BUBBLES TO EVALUATE (learner utterances):");
  for (const bubble of chunk) {
    lines.push(
      `BUBBLE ID "${bubble.id}":`,
      bubble.aiContext ? `Context (host question/response it followed): ${bubble.aiContext}` : "",
      `Learner utterance: ${bubble.text}`,
      "",
    );
  }
  lines.push(
    "TASK:",
    "Evaluate exactly the learner utterances above, one evaluation per BUBBLE ID. Return only the required JSON object.",
  );
  return lines.join("\n");
}

function buildSummarySystemPrompt(req: PodchatEvaluateBubblesRequest): string {
  return [
    "You are an academic speaking coach summarizing per-bubble evaluations of a Podchat session.",
    "Aggregate the provided per-bubble evaluations into an honest session summary.",
    ...buildSharedContextGuidance(req),
    "",
    "RULES:",
    "- overallStatus: strong | developing | needs_work, based on the overall balance of the bubble statuses.",
    "- topWeaknesses: up to 3 recurring patterns across bubbles. Each must have label (short pattern name), evidence (quote from an actual learner utterance), practiceFocus (specific exercise), count (how many evaluated bubbles showed the pattern).",
    "- nextPracticeFocus: ONE clear, specific next action for the learner, tied to the most significant weakness. <= 300 chars.",
    "- Ground everything in the provided evaluations; do not invent weaknesses absent from them.",
    "- Do NOT include numeric scores, pronunciation/phoneme analysis, or any other keys.",
    "",
    "OUTPUT FORMAT: Respond with ONLY a single JSON object (no markdown fences). Exactly these keys:",
    '  "overallStatus", "topWeaknesses" (<= 3 of { "label" <= 160, "evidence" <= 400, "practiceFocus" <= 300, "count" }), "nextPracticeFocus" (<= 300 chars).',
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSummaryUserPrompt(
  req: PodchatEvaluateBubblesRequest,
  evaluations: PodchatBubbleEvaluation[],
): string {
  const evaluationsBlock = evaluations
    .map(
      (evaluation) =>
        `BUBBLE "${evaluation.bubbleId}" [${evaluation.status}]:\n` +
        `- strengths: ${evaluation.strengths.join("; ")}\n` +
        `- issues: ${evaluation.issues
          .map((issue) => `${issue.type}: ${issue.problem} -> ${issue.correction}`)
          .join("; ")}\n` +
        `- strongerVersion: ${evaluation.strongerVersion}\n` +
        `- microDrill: ${evaluation.microDrill.focus} | ${evaluation.microDrill.instruction}`,
    )
    .join("\n\n");

  return [
    "PER-BUBBLE EVALUATIONS:",
    evaluationsBlock,
    "",
    "TASK:",
    "Produce the session summary. Return only the required JSON object.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Mock provider (dev only)
// ---------------------------------------------------------------------------

function buildMockEvaluations(
  req: PodchatEvaluateBubblesRequest,
): PodchatBubbleEvaluation[] {
  return req.learnerBubbles.map((bubble) => {
    const wordCount = bubble.text.split(/\s+/).filter((w) => w.length > 0).length;
    const developed = wordCount >= 12;
    const hasReason = /because|for example|such as|so that|which means/i.test(bubble.text);
    const status: PodchatBubbleStatus = developed && hasReason ? "strong" : developed ? "developing" : "needs_work";
    const issues: PodchatBubbleIssue[] = [];
    if (!developed) {
      issues.push({
        type: "idea_development",
        problem: bubble.text,
        correction: `${bubble.text.replace(/\.?$/, "")} because it directly affects how I study and practise every day.`,
        explanation: "The answer states an idea but stops after one sentence. Adding a reason turns it into a developed response.",
      });
    }
    if (issues.length === 0) {
      issues.push({
        type: "fluency",
        problem: "No pauses or fillers visible in the transcript.",
        correction: "Keep the same flow in your next answer.",
        explanation: "The response reads fluently; maintain this pace.",
      });
    }
    return {
      bubbleId: bubble.id,
      status,
      strengths: ["Uses a complete sentence.", "Stays on the topic of the conversation."],
      issues,
      strongerVersion: `${bubble.text.replace(/\.?$/, "")} because it gives me more chances to practise speaking and get immediate feedback.`,
      microDrill: {
        focus: `Add one reason to a ${req.difficulty.toLowerCase()} answer`,
        instruction: "Answer the same question again in one sentence, then add 'because' plus one reason.",
        example: "I think AI tools help me study because I can practise speaking more often.",
      },
    };
  });
}

function buildMockSummary(
  evaluations: PodchatBubbleEvaluation[],
): PodchatBubbleSummary {
  const counts = { strong: 0, developing: 0, needs_work: 0 };
  for (const evaluation of evaluations) {
    counts[evaluation.status] += 1;
  }
  const overallStatus: PodchatBubbleStatus =
    counts.needs_work > counts.strong ? "needs_work" : counts.strong >= counts.developing ? "strong" : "developing";
  const developingCount = counts.developing + counts.needs_work;
  return {
    overallStatus,
    topWeaknesses:
      developingCount > 0
        ? [
            {
              label: "Short explanations",
              evidence: "Some answers state an idea without adding a reason or example.",
              practiceFocus: "Add one reason or example before ending each answer.",
              count: developingCount,
            },
          ]
        : [
            {
              label: "None recurring",
              evidence: "No pattern repeated across the evaluated bubbles.",
              practiceFocus: "Keep developing answers with reasons and examples.",
              count: 1,
            },
          ],
    nextPracticeFocus: `In your next Podchat, give one clear claim and one ${overallStatus === "needs_work" ? "simple" : "stronger"} reason or example in every answer.`,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

function sanitizeProviderError(message: string): string {
  return message.length > 200 ? `${message.slice(0, 200)}…` : message;
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
  const provider = providerId;

  let evaluations: PodchatBubbleEvaluation[] = [];
  let summary: PodchatBubbleSummary | null = null;

  const runProviderCall = async (
    system: string,
    user: string,
  ): Promise<string> => {
    if (provider === "mock") {
      throw new Error("mock provider must be handled before provider calls");
    }
    if (provider === "gemini") {
      if (!apiKey) {
        throw new Error("provider_not_configured");
      }
      return callGemini(apiKey, system, user);
    }
    if (provider === "deepseek" || provider === "tokenrouter" || provider === "routeapi" || provider === "opencode" || provider === "hermes") {
      if (!apiKey) {
        throw new Error("provider_not_configured");
      }
      return provider === "deepseek"
      ? callDeepSeek(apiKey, system, user)
      : callOpenAICompatibleForProvider(provider, apiKey, system, user);
    }
    // Claude default
    if (!apiKey) {
      throw new Error("provider_not_configured");
    }
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
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Claude bubble API error ${res.status}: ${errText.slice(0, 500)}`);
      throw new Error("provider_request_failed");
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return data.content?.find((content) => content.type === "text")?.text ?? "";
  };

  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Mock provider is not allowed in production." },
        { status: 400 },
      );
    }
    evaluations = buildMockEvaluations(req);
    summary = buildMockSummary(evaluations);
    return NextResponse.json({ evaluations, summary }, { status: 200 });
  }

  try {
    // Evaluate bubbles in chunks to keep each provider call small.
    for (let offset = 0; offset < req.learnerBubbles.length; offset += CHUNK_SIZE) {
      const chunk = req.learnerBubbles.slice(offset, offset + CHUNK_SIZE);
      const text = await runProviderCall(
        buildSystemPrompt(req),
        buildChunkUserPrompt(req, chunk),
      );
      const chunkValidation = validateChunkOutput(text);
      if (!chunkValidation.valid) {
        console.error(
          `Provider bubble output validation failed: ${chunkValidation.error}. Raw: ${text.slice(0, 300)}`,
        );
        return NextResponse.json(
          { error: "Invalid provider response format. Please try again." },
          { status: 502 },
        );
      }
      evaluations = [...evaluations, ...chunkValidation.evaluations];
    }

    // Session summary (graceful: if it fails, evaluations still stand).
    try {
      const summaryText = await runProviderCall(
        buildSummarySystemPrompt(req),
        buildSummaryUserPrompt(req, evaluations),
      );
      const summaryValidation = validateSummaryOutput(summaryText);
      if (summaryValidation.valid) {
        summary = summaryValidation.summary;
      } else {
        console.error(
          `Provider summary output validation failed: ${summaryValidation.error}. Raw: ${summaryText.slice(0, 300)}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Session summary generation failed (evaluations kept): ${message}`);
    }

    return NextResponse.json({ evaluations, summary }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "provider_not_configured") {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 },
      );
    }
    if (message === "provider_request_failed") {
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 },
      );
    }
    console.error(`Unexpected evaluate-bubbles error: ${message}`);
    return NextResponse.json(
      { error: sanitizeProviderError(message) },
      { status: 502 },
    );
  }
}
