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

type FeedbackResponse = QuickFeedback & { providerUsed: Provider };

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
        ].join("\n")
      : [
          "LEVEL RULE:",
          "- Evaluate based on the learner's level. Be specific and academic.",
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
    "- The JSON object MUST have exactly these keys:",
    '  "mainWeakness", "evidence", "betterPhrase", "retryTask".',
    "- All values are short strings (1-3 sentences each).",
    "- evidence must quote or paraphrase a specific moment from the transcript.",
    "- betterPhrase must be a stronger academic phrase or sentence the learner could have said.",
    "- retryTask must be one direct, doable instruction for the next attempt.",
  ].join("\n");
}

function buildUserPrompt(req: FeedbackRequest): string {
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
    "",
    'Return ONLY the JSON object: {"mainWeakness": "...", "evidence": "...", "betterPhrase": "...", "retryTask": "..."}',
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

function parseFeedback(raw: string): QuickFeedback | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const data = JSON.parse(jsonText) as Partial<QuickFeedback>;
    if (
      typeof data.mainWeakness === "string" &&
      typeof data.evidence === "string" &&
      typeof data.betterPhrase === "string" &&
      typeof data.retryTask === "string"
    ) {
      return {
        mainWeakness: data.mainWeakness.trim(),
        evidence: data.evidence.trim(),
        betterPhrase: data.betterPhrase.trim(),
        retryTask: data.retryTask.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
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
    throw new Error(`Claude API error ${res.status}: ${errText.slice(0, 300)}`);
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
    throw new Error(
      `DeepSeek API error ${res.status}: ${errText.slice(0, 300)}`,
    );
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
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
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
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
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

  const feedback = parseFeedback(raw);
  if (!feedback) {
    return NextResponse.json(
      {
        error:
          "Provider response could not be parsed as JSON. Try again or switch provider.",
      },
      { status: 502 },
    );
  }

  const response: FeedbackResponse = {
    ...feedback,
    providerUsed: validated.provider,
  };
  return NextResponse.json(response);
}
