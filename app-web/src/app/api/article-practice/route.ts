import { NextResponse } from "next/server";
import {
  getArticlePracticeCacheKey,
  getGlobalCachedResponse,
  saveGlobalCachedResponse,
} from "../../lib/cache/ai-cache";
import {
  recordAiUsageEvent,
  resolveProviderModel,
  estimateTokensFromText,
  estimateTokensFromJson,
  estimateAiCost,
} from "../../lib/cache/ai-usage";
import {
  isValidIdempotencyKey,
  computeHash,
  getArticlePracticeRequestHash,
  getExistingIdempotencyRecord,
  saveIdempotencyRecord,
} from "../../lib/cache/ai-idempotency";

// Runs on the Node.js runtime so article fetching and provider keys stay server-side.
export const runtime = "nodejs";
// 30s gives headroom: 8s article fetch + 20s provider timeout + Supabase
// writes. Well inside Vercel Hobby's per-function ceiling. Without this,
// Vercel kills the function at 10s and returns 502.
export const maxDuration = 30;

type Provider = "Claude" | "DeepSeek" | "Gemini";

const LEVELS = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
type LearnerLevel = (typeof LEVELS)[number];

type FeedbackLanguage = "en" | "id";
type TargetLanguage = "en";

type ArticlePracticeRequest = {
  inputMode: "url" | "markdown";
  provider: Provider;
  url?: string;
  preparedContextMarkdown?: string;
  level: LearnerLevel;
  mode: string;
  focus: string;
  feedbackLanguage: FeedbackLanguage;
  targetLanguage: TargetLanguage;
};

type UsefulVocabularyItem = {
  word: string;
  meaning: string;
  whyUseful: string;
};

type SpeakingTask = {
  title: string;
  instruction: string;
  timeLimitSeconds: number;
  targetStructure: string[];
};

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

type ArticlePracticeResponse = {
  sourceTitle: string;
  sourceUrl: string;
  sourceDomain: string;
  articleBrief: string;
  mainIdea: string;
  keyPoints: string[];
  usefulVocabulary: UsefulVocabularyItem[];
  comprehensionChecks: string[];
  essayQuestions: ArticleEssayQuestion[];
  speakingTask: SpeakingTask;
  followUpQuestions: string[];
  warnings: string[];
};

type ExtractedArticle = {
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  text: string;
  wasTrimmed: boolean;
};

type ArticlePracticeParseResult =
  | { ok: true; value: ArticlePracticeResponse }
  | { ok: false; reason: "parse" | "validation" };

const MAX_URL_LENGTH = 2000;
const MAX_HTML_BYTES = 1_000_000;
const ARTICLE_TEXT_CHAR_BUDGET = 10_000;
const PREPARED_MARKDOWN_CHAR_BUDGET = 20_000;
const MIN_EXTRACTED_TEXT_CHARS = 400;
// 8s is tight enough to skip slow/blocked article hosts before the 25s Vercel budget runs out
// (worst case: 1 attempt 8s + AI call ~10s + parsing/Supabase writes ~5s ≈ 23s).
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const ARTICLE_PRACTICE_PROMPT_VERSION = "v1.2";
const ESSAY_TARGET_SKILLS = [
  "main_idea",
  "supporting_detail",
  "inference",
  "vocabulary_in_context",
  "critical_response",
] as const;
const REQUIRED_MARKDOWN_HEADINGS = [
  "# Article Context",
  "## Title",
  "## Short Summary",
  "## Main Idea",
  "## Key Points",
  "## Essay Comprehension Questions",
  "## Speaking Practice Prompt",
] as const;
const FORBIDDEN_MARKDOWN_MODE_KEYS = [
  "sourceurl",
  "fullarticletext",
  "userid",
  "useridentity",
  "auth",
  "authmetadata",
  "storagepath",
  "audio",
  "stt",
  "tts",
  "transcript",
  "file",
  "files",
] as const;

class ArticleFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleFetchError";
  }
}

function normalizeFeedbackLanguage(value: unknown): FeedbackLanguage {
  return value === "id" ? "id" : "en";
}

function normalizeTargetLanguage(value: unknown): TargetLanguage {
  return value === "en" ? "en" : "en";
}

function feedbackLanguageLabel(language: FeedbackLanguage): string {
  return language === "id" ? "Indonesian" : "English";
}

function buildLanguagePolicy(req: ArticlePracticeRequest): string {
  const policy = [
    "LANGUAGE POLICY:",
    `- Write articleBrief, mainIdea, keyPoints, usefulVocabulary.meaning, usefulVocabulary.whyUseful, comprehensionChecks, speakingTask.title, speakingTask.instruction, followUpQuestions, and warnings in ${feedbackLanguageLabel(req.feedbackLanguage)}.`,
    `- usefulVocabulary.word MUST remain in English.`,
    `- speakingTask.targetStructure MUST remain in English.`,
    `- sourceTitle, sourceUrl, and sourceDomain are source-derived and MUST NOT be translated.`,
    `- Do NOT translate the full article text.`,
    `- Do NOT store or return the full article text.`,
  ];
  if (req.feedbackLanguage === "id") {
    policy.push(
      "- Use concise, beginner-friendly Indonesian for all Indonesian text."
    );
  }
  return policy.join("\n");
}

function buildSystemPrompt(req: ArticlePracticeRequest): string {
  return [
    "You are an academic speaking coach creating Article Practice from a real article source.",
    "Use only the provided article text, title, source domain, and URL.",
    "Do not invent facts outside the article.",
    "Do not reproduce long article passages, copied paragraphs, or copyrighted excerpts.",
    "Do not write a full speech, full answer, essay, or copy-ready response for the learner.",
    "Turn the article into understanding, vocabulary noticing, and speaking practice.",
    "",
    buildLanguagePolicy(req),
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "sourceTitle", "sourceUrl", "sourceDomain", "articleBrief", "mainIdea", "keyPoints", "usefulVocabulary", "comprehensionChecks", "essayQuestions", "speakingTask", "followUpQuestions", "warnings".',
    "- articleBrief is a concise summary of the article (MUST be under 70 words).",
    "- mainIdea is a single sentence (MUST be under 40 words).",
    "- keyPoints is an array of 3-5 short strings (each MUST be under 30 words).",
    "- usefulVocabulary is an array of 3-6 objects with word (under 5 words), meaning (under 15 words), and whyUseful (under 20 words).",
    "- comprehensionChecks is an array of 3-5 short questions (each MUST be under 20 words).",
    "- essayQuestions is an array of exactly 5 essay-style comprehension questions.",
    "- essayQuestions MUST cover exactly these targetSkill values once each: main_idea, supporting_detail, inference, vocabulary_in_context, critical_response.",
    "- Each essay question requires a short paragraph answer and tests article comprehension, not random opinion only.",
    "- Each essay question object has id, question, expectedFocus, targetSkill, and suggestedWordCount with integer min and max.",
    "- essay question id is short and stable, for example q1, q2, q3, q4, q5.",
    "- suggestedWordCount.min must be at least 30 and max must be at most 220.",
    "- speakingTask has title (under 10 words), instruction (concise, MUST be under 60 words), timeLimitSeconds, and targetStructure.",
    "- targetStructure is an array of 2-5 short strings (each MUST be under 12 words).",
    "- followUpQuestions is an array of 2-4 short questions (each MUST be under 25 words).",
    "- warnings is an array of strings. Use [] if there are no warnings.",
  ].join("\n");
}

function levelGuidance(level: LearnerLevel): string {
  switch (level) {
    case "Foundation":
      return [
        "LEVEL GUIDANCE FOR FOUNDATION:",
        "- Use simple wording and simple vocabulary.",
        "- Make the brief and questions short.",
        "- The speaking task must be 30-60 seconds.",
        "- Use this structure: topic sentence, because-reason, simple example, clear ending.",
        "- Do not ask for counterarguments, evidence evaluation, research tasks, advanced vocabulary drills, or long academic critique.",
      ].join("\n");
    case "Beginner":
      return [
        "LEVEL GUIDANCE FOR BEGINNER:",
        "- Focus on main idea, simple reason, simple example, and short opinion.",
        "- The speaking task should be about 60-90 seconds.",
        "- Avoid advanced research, critique, or heavy theory.",
      ].join("\n");
    case "Intermediate":
      return [
        "LEVEL GUIDANCE FOR INTERMEDIATE:",
        "- Ask the learner to summarize the article argument, explain one piece of evidence, give an opinion, and compare simple perspectives.",
        "- Keep tasks manageable and speaking-focused.",
      ].join("\n");
    case "Advanced":
      return [
        "LEVEL GUIDANCE FOR ADVANCED:",
        "- Allow evaluation of argument quality, evidence, nuance, academic tone, and a counterargument.",
        "- Keep the task as speaking practice, not essay writing.",
      ].join("\n");
    case "Expert":
      return [
        "LEVEL GUIDANCE FOR EXPERT:",
        "- Focus on precision, register, nuanced critique, and careful academic framing.",
        "- Do not write a full model answer.",
      ].join("\n");
  }
}

function buildUserPrompt(
  req: ArticlePracticeRequest,
  article: ExtractedArticle,
): string {
  return [
    "ARTICLE SOURCE:",
    `- Title: ${article.title}`,
    `- Domain: ${article.sourceDomain}`,
    `- URL: ${article.sourceUrl}`,
    "",
    "LEARNER CONTEXT:",
    `- Level: ${req.level}`,
    `- Mode: ${req.mode || "(not provided)"}`,
    `- Focus: ${req.focus || "(not provided)"}`,
    "",
    levelGuidance(req.level),
    "",
    "ARTICLE TEXT SAMPLE:",
    article.text,
    "",
    "TASK:",
    "1. Create a copyright-safe article brief without copying article paragraphs.",
    "2. State the main idea in learner-friendly language.",
    "3. List 3-5 short key points using your own words.",
    "4. Select 3-6 useful vocabulary items from the article for speaking practice.",
    "5. Write 3-5 comprehension checks.",
    "6. Write exactly 5 essay-style comprehension questions for writing practice.",
    "7. Create one level-appropriate speaking task.",
    "8. Write 2-4 follow-up questions.",
    "9. Add warnings only for thin article text, uncertainty, source limitations, or missing context.",
    "",
    'Return ONLY this JSON shape: {"sourceTitle":"...","sourceUrl":"...","sourceDomain":"...","articleBrief":"...","mainIdea":"...","keyPoints":["..."],"usefulVocabulary":[{"word":"...","meaning":"...","whyUseful":"..."}],"comprehensionChecks":["..."],"essayQuestions":[{"id":"q1","question":"...","expectedFocus":"...","targetSkill":"main_idea","suggestedWordCount":{"min":50,"max":120}}],"speakingTask":{"title":"...","instruction":"...","timeLimitSeconds":60,"targetStructure":["..."]},"followUpQuestions":["..."],"warnings":[]}',
  ].join("\n");
}

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

function hasForbiddenMarkdownModeKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenMarkdownModeKey(item));
  }
  if (!value || typeof value !== "object") return false;

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return (
      (FORBIDDEN_MARKDOWN_MODE_KEYS as readonly string[]).includes(
        normalizedKey,
      ) || hasForbiddenMarkdownModeKey(nested)
    );
  });
}

function validatePreparedMarkdown(
  value: unknown,
): { ok: true; markdown: string } | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: "Prepared Markdown context is required." };
  }

  const markdown = value.trim();
  if (markdown.length > PREPARED_MARKDOWN_CHAR_BUDGET) {
    return {
      ok: false,
      error: "Prepared Markdown must be 20,000 characters or fewer.",
    };
  }

  const missingHeading = REQUIRED_MARKDOWN_HEADINGS.find(
    (heading) => !markdown.includes(heading),
  );
  if (missingHeading) {
    return {
      ok: false,
      error: `Prepared Markdown is missing required heading: ${missingHeading}.`,
    };
  }

  const headingCount = (markdown.match(/^#{1,3}\s+/gm) ?? []).length;
  if (markdown.length > 5_000 && headingCount < 6) {
    return {
      ok: false,
      error: "Prepared Markdown appears to be an unstructured raw document.",
    };
  }

  return { ok: true, markdown };
}

function getMarkdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const afterHeading = start + heading.length;
  const rest = markdown.slice(afterHeading);
  const nextHeading = rest.search(/\n#{1,3}\s+/);
  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

function firstNonEmptyLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function buildPreparedMarkdownArticle(markdown: string): ExtractedArticle {
  const title =
    firstNonEmptyLine(getMarkdownSection(markdown, "## Title")) ||
    "Prepared Article Context";
  return {
    title: limitText(title, 200),
    sourceUrl: "prepared-markdown-context",
    sourceDomain: "Prepared Markdown",
    text: limitText(markdown, PREPARED_MARKDOWN_CHAR_BUDGET),
    wasTrimmed: markdown.trim().length > PREPARED_MARKDOWN_CHAR_BUDGET,
  };
}

function normalizeLevel(value: unknown): LearnerLevel | null {
  if (typeof value !== "string") return null;
  const match = (LEVELS as readonly string[]).find(
    (level) => level.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ? (match as LearnerLevel) : null;
}

function validateRequest(body: unknown): ArticlePracticeRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const source = body as Record<string, unknown>;
  const inputMode =
    source.inputMode === undefined || source.inputMode === "url"
      ? "url"
      : source.inputMode === "markdown"
        ? "markdown"
        : null;
  if (!inputMode) {
    return "Unsupported inputMode. Use url or markdown.";
  }

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

  let safeUrl = "";
  let preparedContextMarkdown = "";
  if (inputMode === "url") {
    const url = normalizeString(source.url, MAX_URL_LENGTH);
    if (!url) return "Article URL is required.";

    const parsedUrl = parseSafeArticleUrl(url);
    if (typeof parsedUrl === "string") return parsedUrl;
    safeUrl = parsedUrl.toString();
  } else {
    if (hasForbiddenMarkdownModeKey(source)) {
      return "Markdown mode request contains unsupported private data.";
    }
    const markdownResult = validatePreparedMarkdown(
      source.preparedContextMarkdown,
    );
    if (!markdownResult.ok) return markdownResult.error;
    preparedContextMarkdown = markdownResult.markdown;
  }

  return {
    inputMode,
    provider,
    ...(inputMode === "url"
      ? { url: safeUrl }
      : { preparedContextMarkdown }),
    level,
    mode: normalizeString(source.mode, 100),
    focus: normalizeString(source.focus, 300),
    feedbackLanguage: normalizeFeedbackLanguage(source.feedbackLanguage),
    targetLanguage: normalizeTargetLanguage(source.targetLanguage),
  };
}

function parseSafeArticleUrl(rawUrl: string): URL | string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only HTTP and HTTPS article URLs are supported.";
  }

  if (isUnsafeHost(parsed.hostname)) {
    return "This URL host is not allowed for Article Practice.";
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed;
}

function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1"
  ) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const parts = ipv4Match.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function sourceDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

async function fetchArticle(url: string): Promise<ExtractedArticle> {
  let currentUrl = new URL(url);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
          "user-agent": "fonetik-local-mvp/1.0 Article Practice",
        },
      });
    } catch {
      throw new ArticleFetchError(
        "The article could not be fetched. This source may be blocked, dynamic, or paywalled.",
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ArticleFetchError("The article redirected without a valid location.");
      }
      const nextUrl = new URL(location, currentUrl);
      const safeNextUrl = parseSafeArticleUrl(nextUrl.toString());
      if (typeof safeNextUrl === "string") {
        throw new ArticleFetchError("The article redirected to an unsupported URL.");
      }
      currentUrl = safeNextUrl;
      continue;
    }

    if (!response.ok) {
      throw new ArticleFetchError(
        response.status === 401 || response.status === 403
          ? "This source may be blocked, dynamic, or paywalled."
          : "The page could not be fetched.",
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.toLowerCase().includes("text/html") &&
      !contentType.toLowerCase().includes("application/xhtml+xml")
    ) {
      throw new ArticleFetchError("The page does not look like an HTML article.");
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      throw new ArticleFetchError("The page is too large for Article Practice.");
    }

    const html = await readLimitedResponseText(response, MAX_HTML_BYTES);
    const canonicalUrl = extractCanonicalUrl(html, currentUrl);
    return extractReadableArticle(html, canonicalUrl.toString());
  }

  throw new ArticleFetchError("The article redirected too many times.");
}

async function readLimitedResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new ArticleFetchError("The page is too large for Article Practice.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ArticleFetchError("The page is too large for Article Practice.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function extractCanonicalUrl(html: string, fallbackUrl: URL): URL {
  const match = html.match(
    /<link[^>]+rel=["']?canonical["']?[^>]*href=["']([^"']+)["'][^>]*>/i,
  );
  if (!match) return fallbackUrl;

  try {
    const candidate = new URL(decodeHtmlEntities(match[1]), fallbackUrl);
    const safeCandidate = parseSafeArticleUrl(candidate.toString());
    return typeof safeCandidate === "string" ? fallbackUrl : safeCandidate;
  } catch {
    return fallbackUrl;
  }
}

function extractReadableArticle(html: string, sourceUrl: string): ExtractedArticle {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

  const title = extractTitle(withoutNoise) || sourceDomainFromUrl(sourceUrl);
  const container =
    firstTagBlock(withoutNoise, "article") ||
    firstTagBlock(withoutNoise, "main") ||
    firstTagBlock(withoutNoise, "body") ||
    withoutNoise;

  const readableText = htmlToText(container);
  if (readableText.length < MIN_EXTRACTED_TEXT_CHARS) {
    throw new ArticleFetchError("The article text could not be extracted.");
  }

  const wasTrimmed = readableText.length > ARTICLE_TEXT_CHAR_BUDGET;
  return {
    title,
    sourceUrl,
    sourceDomain: sourceDomainFromUrl(sourceUrl),
    text: limitText(readableText, ARTICLE_TEXT_CHAR_BUDGET),
    wasTrimmed,
  };
}

function extractTitle(html: string): string {
  const ogTitle = html.match(
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  if (ogTitle?.[1]) return normalizeWhitespace(decodeHtmlEntities(ogTitle[1]));

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? normalizeWhitespace(decodeHtmlEntities(title[1])) : "";
}

function firstTagBlock(html: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "i");
  return html.match(pattern)?.[0] ?? "";
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(?:p|div|section|article|main|h[1-6]|li|br)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|main|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(withBreaks));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower in named) return named[lower];
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return match;
  });
}

function isValidCodePoint(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasParagraphShape(value: string): boolean {
  return /\n\s*\n/.test(value) || value.split(/\n/).length > 2;
}

function hasLongQuotedExcerpt(value: string): boolean {
  return /["“][^"”]{140,}["”]/.test(value);
}

function isSafeShortText(
  value: string | null,
  maxWords: number,
  maxChars: number,
): value is string {
  return Boolean(
    value &&
      value.length <= maxChars &&
      wordCount(value) <= maxWords &&
      !hasParagraphShape(value) &&
      !hasLongQuotedExcerpt(value),
  );
}

function normalizeTextArray(
  raw: unknown,
  min: number,
  max: number,
  maxWords: number,
  maxChars: number,
): string[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return null;

  const out: string[] = [];
  for (const item of raw) {
    const text = normalizeRequiredString(item);
    if (!isSafeShortText(text, maxWords, maxChars)) return null;
    out.push(text);
  }
  return out;
}

function normalizeWarnings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => limitText(item, 220))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeUsefulVocabulary(raw: unknown): UsefulVocabularyItem[] | null {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 6) return null;

  const out: UsefulVocabularyItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = item as Record<string, unknown>;
    const word = normalizeRequiredString(source.word);
    const meaning = normalizeRequiredString(source.meaning);
    const whyUseful = normalizeRequiredString(source.whyUseful);
    if (
      !isSafeShortText(word, 6, 80) ||
      !isSafeShortText(meaning, 18, 160) ||
      !isSafeShortText(whyUseful, 22, 180)
    ) {
      return null;
    }
    out.push({ word, meaning, whyUseful });
  }
  return out;
}

function normalizeTimeLimit(value: unknown, level: LearnerLevel): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const seconds = Math.floor(numeric);
  if (level === "Foundation") {
    return seconds >= 30 && seconds <= 60 ? seconds : null;
  }
  if (level === "Beginner") {
    return seconds >= 45 && seconds <= 90 ? seconds : null;
  }
  return seconds >= 60 && seconds <= 180 ? seconds : null;
}

function normalizeSpeakingTask(
  raw: unknown,
  level: LearnerLevel,
): SpeakingTask | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const title = normalizeRequiredString(source.title);
  const instruction = normalizeRequiredString(source.instruction);
  const timeLimitSeconds = normalizeTimeLimit(source.timeLimitSeconds, level);
  const targetStructure = normalizeTextArray(
    source.targetStructure,
    2,
    5,
    14,
    120,
  );

  if (
    !isSafeShortText(title, 12, 120) ||
    !isSafeShortText(instruction, 70, 600) ||
    timeLimitSeconds === null ||
    !targetStructure
  ) {
    return null;
  }

  if (
    level === "Foundation" &&
    /counterargument|counter-argument|evidence evaluation|research|critique|academic paper|journal/i.test(
      `${title} ${instruction} ${targetStructure.join(" ")}`,
    )
  ) {
    return null;
  }

  return { title, instruction, timeLimitSeconds, targetStructure };
}

function isEssayTargetSkill(
  value: unknown,
): value is ArticleEssayQuestion["targetSkill"] {
  return (
    typeof value === "string" &&
    (ESSAY_TARGET_SKILLS as readonly string[]).includes(value)
  );
}

function normalizeEssayQuestions(raw: unknown): ArticleEssayQuestion[] | null {
  if (!Array.isArray(raw) || raw.length !== 5) return null;

  const questions: ArticleEssayQuestion[] = [];
  const seenIds = new Set<string>();
  const seenSkills = new Set<ArticleEssayQuestion["targetSkill"]>();

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = item as Record<string, unknown>;
    const id = normalizeRequiredString(source.id);
    const question = normalizeRequiredString(source.question);
    const expectedFocus = normalizeRequiredString(source.expectedFocus);
    const targetSkill = source.targetSkill;
    const wordCount = source.suggestedWordCount;

    if (
      !id ||
      id.length > 40 ||
      seenIds.has(id) ||
      !question ||
      question.length > 280 ||
      !expectedFocus ||
      expectedFocus.length > 400 ||
      !isEssayTargetSkill(targetSkill) ||
      seenSkills.has(targetSkill) ||
      !wordCount ||
      typeof wordCount !== "object" ||
      Array.isArray(wordCount)
    ) {
      return null;
    }

    const wordCountSource = wordCount as Record<string, unknown>;
    const min = wordCountSource.min;
    const max = wordCountSource.max;
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

    seenIds.add(id);
    seenSkills.add(targetSkill);
    questions.push({
      id,
      question,
      expectedFocus,
      targetSkill,
      suggestedWordCount: { min, max },
    });
  }

  return ESSAY_TARGET_SKILLS.every((skill) => seenSkills.has(skill))
    ? questions
    : null;
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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseArticlePractice(
  raw: string,
  level: LearnerLevel,
  article: ExtractedArticle,
): ArticlePracticeParseResult {
  const jsonText = extractBalancedJsonObject(raw);
  if (!jsonText) return { ok: false, reason: "parse" };

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "validation" };
    }

    const data = parsed as Record<string, unknown>;
    const sourceTitle = normalizeRequiredString(data.sourceTitle);
    const sourceUrl = normalizeRequiredString(data.sourceUrl);
    const sourceDomain = normalizeRequiredString(data.sourceDomain);
    const articleBrief = normalizeRequiredString(data.articleBrief);
    const mainIdea = normalizeRequiredString(data.mainIdea);
    const keyPoints = normalizeTextArray(data.keyPoints, 3, 5, 32, 260);
    const usefulVocabulary = normalizeUsefulVocabulary(data.usefulVocabulary);
    const comprehensionChecks = normalizeTextArray(
      data.comprehensionChecks,
      3,
      5,
      24,
      220,
    );
    const essayQuestions = normalizeEssayQuestions(data.essayQuestions);
    const speakingTask = normalizeSpeakingTask(data.speakingTask, level);
    const followUpQuestions = normalizeTextArray(
      data.followUpQuestions,
      2,
      4,
      28,
      240,
    );

    if (
      !isSafeShortText(sourceTitle, 20, 220) ||
      !isSafeShortText(sourceUrl, 20, 500) ||
      !isSafeShortText(sourceDomain, 5, 120) ||
      !isSafeShortText(articleBrief, 80, 650) ||
      !isSafeShortText(mainIdea, 45, 360) ||
      !keyPoints ||
      !usefulVocabulary ||
      !comprehensionChecks ||
      !essayQuestions ||
      !speakingTask ||
      !followUpQuestions
    ) {
      return { ok: false, reason: "validation" };
    }

    return {
      ok: true,
      value: {
        sourceTitle: article.title,
        sourceUrl: article.sourceUrl,
        sourceDomain: article.sourceDomain,
        articleBrief,
        mainIdea,
        keyPoints,
        usefulVocabulary,
        comprehensionChecks,
        essayQuestions,
        speakingTask,
        followUpQuestions,
        warnings: [
          ...normalizeWarnings(data.warnings),
          ...(article.wasTrimmed
            ? ["The article was trimmed before analysis to keep practice lightweight."]
            : []),
        ].slice(0, 5),
      },
    };
  } catch {
    return { ok: false, reason: "parse" };
  }
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

function isArticleMockProvider(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ARTICLE_AI_PROVIDER?.trim().toLowerCase() === "mock";
}

function buildMockArticlePracticeResponse(): ArticlePracticeResponse {
  return {
    sourceTitle: "Mock Article: AI-Assisted Learning Habits",
    sourceUrl: "mock-article-practice",
    sourceDomain: "Fonetik Mock",
    articleBrief:
      "The article explains how AI study tools can help learners practice independently, while warning that progress depends on clear goals, privacy awareness, and active thinking.",
    mainIdea:
      "AI-assisted learning is most useful when students use it as a structured practice partner rather than a replacement for effort.",
    keyPoints: [
      "AI tools can give quick feedback and more chances to revise.",
      "Learners still need goals, reflection, and teacher guidance.",
      "Privacy and overdependence are important risks to manage.",
    ],
    usefulVocabulary: [
      {
        word: "intentional",
        meaning: "done with a clear purpose",
        whyUseful: "Useful for explaining effective study habits.",
      },
      {
        word: "feedback loop",
        meaning: "a cycle of response and improvement",
        whyUseful: "Helps describe repeated learning practice.",
      },
      {
        word: "overdependence",
        meaning: "relying on something too much",
        whyUseful: "Useful for discussing technology risks.",
      },
    ],
    comprehensionChecks: [
      "What benefit does AI give learners?",
      "Why are clear goals important?",
      "What risk does the article mention?",
    ],
    essayQuestions: [
      {
        id: "q1",
        question: "What is the main idea of the article?",
        expectedFocus: "Explain the central claim about AI-assisted learning.",
        targetSkill: "main_idea",
        suggestedWordCount: { min: 50, max: 120 },
      },
      {
        id: "q2",
        question: "Which supporting detail shows how AI can help students?",
        expectedFocus: "Use one detail about feedback, revision, or practice.",
        targetSkill: "supporting_detail",
        suggestedWordCount: { min: 50, max: 120 },
      },
      {
        id: "q3",
        question: "What can readers infer about independent study habits?",
        expectedFocus: "Infer why tools alone are not enough for progress.",
        targetSkill: "inference",
        suggestedWordCount: { min: 50, max: 120 },
      },
      {
        id: "q4",
        question: "What does intentional mean in this learning context?",
        expectedFocus: "Explain the vocabulary meaning using the article context.",
        targetSkill: "vocabulary_in_context",
        suggestedWordCount: { min: 50, max: 120 },
      },
      {
        id: "q5",
        question: "What implication follows for students using AI tools?",
        expectedFocus: "Give a balanced critical response about benefits and risks.",
        targetSkill: "critical_response",
        suggestedWordCount: { min: 60, max: 140 },
      },
    ],
    speakingTask: {
      title: "AI Study Balance",
      instruction:
        "Explain one benefit and one risk of using AI for study, then give one habit that keeps learning active.",
      timeLimitSeconds: 120,
      targetStructure: ["Claim", "Benefit", "Risk", "Study habit"],
    },
    followUpQuestions: [
      "Which AI study habit seems most useful?",
      "How can learners avoid overdependence?",
      "What should teachers guide students to do?",
    ],
    warnings: ["Mock article practice is deterministic and not based on a live article."],
  };
}

async function callClaude(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
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
  const res = await fetchWithTimeout((process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
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
  const actualApiKey = process.env.DEEPSEEK_API_KEY || "";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const res = await fetchWithTimeout((process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions"), {
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

// Wraps fetch with an AbortController so a slow provider cannot hang the
// Vercel function until it hits maxDuration and returns a bare 502.
// Without this, callDeepSeek/callClaude/callGemini had no timeout and would
// block until Vercel killed the invocation (observed: 23s hang -> 502).
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Provider request timed out after 20s.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const tlog = (label: string, extra?: Record<string, unknown>) => {
    console.log(`[article-practice-t+${Date.now() - t0}ms] ${label}`, extra ?? "");
  };
  tlog("handler_start");
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  tlog("body_parsed");

  const validated = validateRequest(parsed);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }
  tlog("request_validated", {
    inputMode: validated.inputMode,
    provider: validated.provider,
    level: validated.level,
    hasUrl: Boolean(validated.url),
    hasMarkdown: Boolean(validated.preparedContextMarkdown),
  });

  if (isArticleMockProvider()) {
    return NextResponse.json(buildMockArticlePracticeResponse());
  }
  tlog("mock_check_done");

  const resolvedModel = resolveProviderModel(validated.provider);
  const isUrlMode = validated.inputMode === "url";

  const rawIdempotencyKey = request.headers.get("x-fonetik-idempotency-key");
  const idempotencyKeyValid =
    isUrlMode && isValidIdempotencyKey(rawIdempotencyKey);
  let idempotencyKeyHash = "";
  let requestHash = "";

  if (idempotencyKeyValid && rawIdempotencyKey) {
    idempotencyKeyHash = computeHash(rawIdempotencyKey);
    requestHash = getArticlePracticeRequestHash({
      url: validated.url ?? "",
      level: validated.level,
      provider: validated.provider,
      model: resolvedModel,
      mode: validated.mode,
      focus: validated.focus,
      promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
      feedbackLanguage: validated.feedbackLanguage,
      targetLanguage: validated.targetLanguage,
    });

    try {
      const existing = await getExistingIdempotencyRecord(
        "global:article-practice",
        idempotencyKeyHash
      );
      tlog("idempotency_lookup_done", { found: Boolean(existing) });
      if (
        existing &&
        existing.request_status === "succeeded" &&
        existing.response_json &&
        existing.request_hash === requestHash
      ) {
        recordAiUsageEvent({
          feature: "article-practice",
          provider: validated.provider,
          model: resolvedModel,
          promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
          cached: true,
          requestStatus: "cache_hit",
          estimatedInputTokens: null,
          estimatedOutputTokens: estimateTokensFromJson(existing.response_json),
          estimatedCostUsd: 0,
        }).catch(() => {});

        return NextResponse.json(existing.response_json);
      }
    } catch {
      // Non-blocking
    }

    try {
      await saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash,
        requestHash,
        requestStatus: "in_progress",
      });
    } catch {
      // Non-blocking
    }
  }

  let cacheKey = "";
  if (isUrlMode) {
    // Check global cache only for URL mode. Prepared markdown is user-provided
    // context and is intentionally not persisted in the shared cache.
    cacheKey = getArticlePracticeCacheKey(
      validated.url ?? "",
      validated.level,
      validated.provider,
      validated.mode,
      validated.focus,
      validated.feedbackLanguage,
      validated.targetLanguage,
      ARTICLE_PRACTICE_PROMPT_VERSION
    );
    try {
    const cached = await getGlobalCachedResponse(cacheKey);
    tlog("global_cache_lookup_done", { hit: Boolean(cached) });
    if (cached) {
      // Log cache hit — fire and forget
      recordAiUsageEvent({
        feature: "article-practice",
        provider: validated.provider,
        model: resolvedModel,
        promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
        cached: true,
        requestStatus: "cache_hit",
        estimatedInputTokens: null,
        estimatedOutputTokens: estimateTokensFromJson(cached),
        estimatedCostUsd: 0,
      }).catch(() => {});

      if (idempotencyKeyValid) {
        saveIdempotencyRecord({
          scopeKey: "global:article-practice",
          feature: "article-practice",
          idempotencyKeyHash,
          requestHash,
          requestStatus: "succeeded",
          responseJson: cached,
        }).catch(() => {});
      }

      return NextResponse.json(cached);
    }
    } catch {
      // Non-blocking: ignore read errors
    }
  }

  let article: ExtractedArticle;
  if (isUrlMode) {
    tlog("fetchArticle_start", { url: validated.url });
    try {
      article = await fetchArticle(validated.url ?? "");
      tlog("fetchArticle_done", {
        textChars: article.text.length,
        wasTrimmed: article.wasTrimmed,
      });
    } catch (err) {
      tlog("fetchArticle_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      const message =
        err instanceof ArticleFetchError
          ? err.message
          : "The article could not be prepared for practice.";
      recordAiUsageEvent({
        feature: "article-practice",
        provider: validated.provider,
        model: resolvedModel,
        promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
        cached: false,
        requestStatus: "article_fetch_failed",
        errorCode: message.slice(0, 200),
      }).catch(() => {});

      if (idempotencyKeyValid) {
        saveIdempotencyRecord({
          scopeKey: "global:article-practice",
          feature: "article-practice",
          idempotencyKeyHash,
          requestHash,
          requestStatus: "failed",
          errorCode: "article_fetch_failed",
        }).catch(() => {});
      }

      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    article = buildPreparedMarkdownArticle(
      validated.preparedContextMarkdown ?? "",
    );
  }

  const apiKey = getApiKey(validated.provider);
  tlog("api_key_resolved", { hasKey: Boolean(apiKey) });
  if (!apiKey) {
    if (idempotencyKeyValid) {
      saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash,
        requestHash,
        requestStatus: "failed",
        errorCode: "missing_api_key",
      }).catch(() => {});
    }

    return NextResponse.json(
      { error: "Missing API key for selected provider. Add it to .env.local." },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(validated);
  const userPrompt = buildUserPrompt(validated, article);

  const estimatedInputTokens = estimateTokensFromText(systemPrompt + userPrompt);

  let raw = "";
  tlog("provider_call_start", { provider: validated.provider, model: process.env.DEEPSEEK_MODEL });
  try {
    if (validated.provider === "Claude") {
      raw = await callClaude(apiKey, systemPrompt, userPrompt);
    } else if (validated.provider === "DeepSeek") {
      raw = await callDeepSeek(apiKey, systemPrompt, userPrompt);
    } else {
      raw = await callGemini(apiKey, systemPrompt, userPrompt);
    }
    tlog("provider_call_done", { rawChars: raw.length });
  } catch (err) {
    tlog("provider_call_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : "Provider call failed.";
    recordAiUsageEvent({
      feature: "article-practice",
      provider: validated.provider,
      model: resolvedModel,
      promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
      cached: false,
      requestStatus: "provider_failed",
      estimatedInputTokens,
      errorCode: message.slice(0, 200),
    }).catch(() => {});

    if (idempotencyKeyValid) {
      saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash,
        requestHash,
        requestStatus: "failed",
        errorCode: "provider_failed",
      }).catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }

  const estimatedOutputTokens = estimateTokensFromText(raw);

  const parsedPractice = parseArticlePractice(raw, validated.level, article);
  if (!parsedPractice.ok) {
    const error =
      parsedPractice.reason === "validation"
        ? "Provider JSON did not match the Article Practice schema. Try again or switch provider."
        : "Provider response could not be parsed as JSON. Try again or switch provider.";
    recordAiUsageEvent({
      feature: "article-practice",
      provider: validated.provider,
      model: resolvedModel,
      promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
      cached: false,
      requestStatus: "provider_parse_failed",
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd: estimateAiCost({
        provider: validated.provider,
        model: resolvedModel,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
      }),
      errorCode: parsedPractice.reason,
    }).catch(() => {});

    if (idempotencyKeyValid) {
      saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash,
        requestHash,
        requestStatus: "failed",
        errorCode: parsedPractice.reason || "parse_failed",
      }).catch(() => {});
    }

    return NextResponse.json({ error }, { status: 502 });
  }

  // Log provider success — fire and forget
  recordAiUsageEvent({
    feature: "article-practice",
    provider: validated.provider,
    model: resolvedModel,
    promptVersion: ARTICLE_PRACTICE_PROMPT_VERSION,
    cached: false,
    requestStatus: "provider_success",
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: estimateAiCost({
      provider: validated.provider,
      model: resolvedModel,
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
    }),
  }).catch(() => {});

  if (isUrlMode) {
    // Save successful URL result to global cache.
    try {
      await saveGlobalCachedResponse(cacheKey, "article-practice", parsedPractice.value);
    } catch {
      // Non-blocking: ignore write errors
    }
  }

  if (idempotencyKeyValid) {
    try {
      await saveIdempotencyRecord({
        scopeKey: "global:article-practice",
        feature: "article-practice",
        idempotencyKeyHash,
        requestHash,
        requestStatus: "succeeded",
        responseJson: parsedPractice.value,
      });
    } catch {
      // Non-blocking
    }
  }

  return NextResponse.json(parsedPractice.value);
}
