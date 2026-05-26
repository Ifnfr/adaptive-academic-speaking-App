import { NextResponse } from "next/server";

// Runs on the Node.js runtime so article fetching and provider keys stay server-side.
export const runtime = "nodejs";

type Provider = "Claude" | "DeepSeek" | "Gemini";

const LEVELS = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
type LearnerLevel = (typeof LEVELS)[number];

type ArticlePracticeRequest = {
  provider: Provider;
  url: string;
  level: LearnerLevel;
  mode: string;
  focus: string;
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

type ArticlePracticeResponse = {
  sourceTitle: string;
  sourceUrl: string;
  sourceDomain: string;
  articleBrief: string;
  mainIdea: string;
  keyPoints: string[];
  usefulVocabulary: UsefulVocabularyItem[];
  comprehensionChecks: string[];
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
const MIN_EXTRACTED_TEXT_CHARS = 400;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

class ArticleFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleFetchError";
  }
}

function buildSystemPrompt(): string {
  return [
    "You are an academic speaking coach creating Article Practice from a real article source.",
    "Use only the provided article text, title, source domain, and URL.",
    "Do not invent facts outside the article.",
    "Do not reproduce long article passages, copied paragraphs, or copyrighted excerpts.",
    "Do not write a full speech, full answer, essay, or copy-ready response for the learner.",
    "Turn the article into understanding, vocabulary noticing, and speaking practice.",
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object.",
    "- No markdown. No code fences. No commentary outside JSON.",
    "- The JSON object MUST have exactly these keys:",
    '  "sourceTitle", "sourceUrl", "sourceDomain", "articleBrief", "mainIdea", "keyPoints", "usefulVocabulary", "comprehensionChecks", "speakingTask", "followUpQuestions", "warnings".',
    "- keyPoints is an array of 3-5 short strings.",
    "- usefulVocabulary is an array of 3-6 objects with word, meaning, and whyUseful.",
    "- comprehensionChecks is an array of 3-5 short questions.",
    "- speakingTask has title, instruction, timeLimitSeconds, and targetStructure.",
    "- targetStructure is an array of 2-5 short strings.",
    "- followUpQuestions is an array of 2-4 short questions.",
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
    "6. Create one level-appropriate speaking task.",
    "7. Write 2-4 follow-up questions.",
    "8. Add warnings only for thin article text, uncertainty, source limitations, or missing context.",
    "",
    'Return ONLY this JSON shape: {"sourceTitle":"...","sourceUrl":"...","sourceDomain":"...","articleBrief":"...","mainIdea":"...","keyPoints":["..."],"usefulVocabulary":[{"word":"...","meaning":"...","whyUseful":"..."}],"comprehensionChecks":["..."],"speakingTask":{"title":"...","instruction":"...","timeLimitSeconds":60,"targetStructure":["..."]},"followUpQuestions":["..."],"warnings":[]}',
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

  const url = normalizeString(source.url, MAX_URL_LENGTH);
  if (!url) return "Article URL is required.";

  const safeUrl = parseSafeArticleUrl(url);
  if (typeof safeUrl === "string") return safeUrl;

  return {
    provider,
    url: safeUrl.toString(),
    level,
    mode: normalizeString(source.mode, 100),
    focus: normalizeString(source.focus, 300),
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
        maxOutputTokens: 1800,
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
  switch (provider) {
    case "Claude":
      return process.env.CLAUDE_API_KEY;
    case "DeepSeek":
      return process.env.DEEPSEEK_API_KEY;
    case "Gemini":
      return process.env.GEMINI_API_KEY;
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

  const validated = validateRequest(parsed);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }

  let article: ExtractedArticle;
  try {
    article = await fetchArticle(validated.url);
  } catch (err) {
    const message =
      err instanceof ArticleFetchError
        ? err.message
        : "The article could not be prepared for practice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const apiKey = getApiKey(validated.provider);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key for selected provider. Add it to .env.local." },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(validated, article);

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

  const parsedPractice = parseArticlePractice(raw, validated.level, article);
  if (!parsedPractice.ok) {
    const error =
      parsedPractice.reason === "validation"
        ? "Provider JSON did not match the Article Practice schema. Try again or switch provider."
        : "Provider response could not be parsed as JSON. Try again or switch provider.";
    return NextResponse.json({ error }, { status: 502 });
  }

  return NextResponse.json(parsedPractice.value);
}
