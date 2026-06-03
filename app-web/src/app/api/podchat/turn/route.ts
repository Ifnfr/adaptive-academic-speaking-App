import { NextResponse } from "next/server";
import {
  buildMockPodchatTurn,
  callDeepSeek,
  callGemini,
} from "../_lib/providers";

export const runtime = "nodejs";

const DIFFICULTY_DURATION: Record<string, number> = {
  Beginner: 180,
  Intermediate: 300,
  Advanced: 420,
};

type PodchatTopic = "Economics" | "Technology";
type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced";
type PodchatSpeaker = "host" | "learner";
type PodchatTurn = {
  speaker: PodchatSpeaker;
  text: string;
};

type PodchatTurnRequest = {
  topic: PodchatTopic;
  difficulty: PodchatDifficulty;
  turnIndex: number;
  durationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  turns: PodchatTurn[];
};

function validateRequest(body: unknown): { valid: true; request: PodchatTurnRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const topic = b.topic;
  if (topic !== "Economics" && topic !== "Technology") {
    return { valid: false, error: "Invalid topic. Must be Economics or Technology." };
  }
  const validTopic: PodchatTopic = topic;

  const difficulty = b.difficulty;
  if (difficulty !== "Beginner" && difficulty !== "Intermediate" && difficulty !== "Advanced") {
    return { valid: false, error: "Invalid difficulty. Must be Beginner, Intermediate, or Advanced." };
  }
  const validDifficulty: PodchatDifficulty = difficulty;

  const expectedDuration = DIFFICULTY_DURATION[validDifficulty];

  const durationSeconds = b.durationSeconds;
  if (typeof durationSeconds !== "number" || !Number.isInteger(durationSeconds) || durationSeconds !== expectedDuration) {
    return { valid: false, error: `Invalid durationSeconds. Must be ${expectedDuration} for ${validDifficulty}.` };
  }

  const elapsedSeconds = b.elapsedSeconds;
  if (typeof elapsedSeconds !== "number" || !Number.isInteger(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > durationSeconds) {
    return { valid: false, error: "Invalid elapsedSeconds. Must be a non-negative integer <= durationSeconds." };
  }

  const remainingSeconds = b.remainingSeconds;
  if (typeof remainingSeconds !== "number" || !Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > durationSeconds) {
    return { valid: false, error: "Invalid remainingSeconds. Must be a non-negative integer <= durationSeconds." };
  }

  // Allow ±5 second tolerance for clock drift / round-trip latency
  const expectedRemaining = durationSeconds - elapsedSeconds;
  if (Math.abs(remainingSeconds - expectedRemaining) > 5) {
    return { valid: false, error: "remainingSeconds is inconsistent with durationSeconds - elapsedSeconds (tolerance: 5s)." };
  }

  const turnIndex = b.turnIndex;
  if (typeof turnIndex !== "number" || !Number.isInteger(turnIndex) || turnIndex < 0) {
    return { valid: false, error: "Invalid turnIndex. Must be a non-negative integer." };
  }

  const turns = b.turns;
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > 20) {
    return { valid: false, error: "turns must be a non-empty array with max length 20." };
  }

  let learnerCount = 0;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i] as unknown;
    if (!turn || typeof turn !== "object") {
      return { valid: false, error: `Turn at index ${i} is not an object.` };
    }
    const t = turn as Record<string, unknown>;
    if (t.speaker !== "host" && t.speaker !== "learner") {
      return { valid: false, error: `Turn at index ${i} has invalid speaker.` };
    }
    if (typeof t.text !== "string" || t.text.trim().length === 0) {
      return { valid: false, error: `Turn at index ${i} has empty text.` };
    }
    if (t.text.length > 1200) {
      return { valid: false, error: `Turn at index ${i} text exceeds 1200 characters.` };
    }
    if (t.speaker === "learner") {
      learnerCount++;
    }
  }

  const lastTurn = turns[turns.length - 1] as Record<string, unknown>;
  if (lastTurn.speaker !== "learner") {
    return { valid: false, error: "Last turn must be learner." };
  }

  if (learnerCount !== turnIndex + 1) {
    return { valid: false, error: "Learner turn count must equal turnIndex + 1." };
  }

  return {
    valid: true,
    request: {
      topic: validTopic,
      difficulty: validDifficulty,
      turnIndex,
      durationSeconds,
      elapsedSeconds,
      remainingSeconds,
      turns: turns.map((t: unknown) => {
        const turnObj = t as Record<string, unknown>;
        return {
          speaker: turnObj.speaker as PodchatSpeaker,
          text: (turnObj.text as string).trim(),
        };
      }),
    },
  };
}

function buildSystemPrompt(topic: string, difficulty: string): string {
  let difficultyGuidance = "";
  if (difficulty === "Beginner") {
    difficultyGuidance = "- Beginner: Use simple vocabulary and short, easy-to-understand sentences. Ask a very direct and simple question.";
  } else if (difficulty === "Intermediate") {
    difficultyGuidance = "- Intermediate: Use standard vocabulary. Ask for a reason or example and ask for a clearer explanation.";
  } else {
    difficultyGuidance = "- Advanced: Use rich vocabulary. Ask about trade-offs, counterarguments, implications, or predictions.";
  }

  return [
    "You are a friendly British podcast host for a show called Podchat.",
    `The topic of the podcast is: ${topic}`,
    `The learner's speaking difficulty level is: ${difficulty}`,
    "",
    "ROLE & BEHAVIOR CONSTRAINTS:",
    "- Speak in clear, natural British English.",
    "- Stay on topic.",
    "- Do NOT score the user's attempt.",
    "- Do NOT provide pronunciation feedback or point out specific grammar mistakes.",
    "- Treat the user's input transcript as possibly generated by Speech-to-Text (STT) recognition: ignore minor transcript errors, transcription glitches, homophone issues, or lack of capitalization, and avoid harsh correction.",
    "",
    "DIFFICULTY LEVEL GUIDANCE:",
    difficultyGuidance,
    "",
    "OUTPUT FORMAT REQUIREMENTS:",
    "- You MUST respond with ONLY a single JSON object.",
    "- No markdown formatting, no code fences (e.g. do NOT use ```json), no commentary outside JSON.",
    "- The JSON object MUST have exactly these keys: \"hostText\", \"followUpQuestion\".",
    "- hostText: 1 to 3 short sentences of conversational host talk reacting to the learner. Must be <= 600 characters.",
    "- followUpQuestion: Exactly one follow-up question. Must contain exactly one question mark ('?') and be <= 240 characters.",
  ].join("\n");
}

function buildUserPrompt(req: PodchatTurnRequest): string {
  const formattedTurns = req.turns
    .map((t) => `${t.speaker === "host" ? "AI Host" : "Learner"}: ${t.text}`)
    .join("\n\n");

  let timeNote = "";
  if (req.remainingSeconds <= 30) {
    timeNote = "NOTE: Very little time remains. Guide the conversation toward a natural close.";
  } else if (req.remainingSeconds <= 90) {
    timeNote = "NOTE: The session is nearly over. Ask a concise closing-style follow-up question.";
  } else {
    timeNote = "NOTE: The session has plenty of time remaining. Continue the discussion naturally.";
  }

  return [
    "CONVERSATION TRANSCRIPT SO FAR:",
    formattedTurns,
    "",
    timeNote,
    "",
    "TASK:",
    "As the AI Host, write your next conversational turn reacting to the last Learner response.",
    "Return only the JSON object with keys \"hostText\" and \"followUpQuestion\".",
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
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function validateClaudeOutput(text: string): { valid: true; response: { hostText: string; followUpQuestion: string } } | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Parsed JSON is not an object." };
    }
    const hostText = data.hostText;
    const followUpQuestion = data.followUpQuestion;

    if (typeof hostText !== "string" || hostText.trim().length === 0) {
      return { valid: false, error: "hostText is missing or empty." };
    }
    if (hostText.length > 600) {
      return { valid: false, error: "hostText exceeds 600 characters." };
    }

    if (typeof followUpQuestion !== "string" || followUpQuestion.trim().length === 0) {
      return { valid: false, error: "followUpQuestion is missing or empty." };
    }
    if (followUpQuestion.length > 240) {
      return { valid: false, error: "followUpQuestion exceeds 240 characters." };
    }

    const questionMarkCount = (followUpQuestion.match(/\?/g) || []).length;
    if (questionMarkCount !== 1) {
      return { valid: false, error: `followUpQuestion has ${questionMarkCount} question marks instead of exactly one.` };
    }

    return {
      valid: true,
      response: {
        hostText: hostText.trim(),
        followUpQuestion: followUpQuestion.trim(),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse Claude output: ${msg}` };
  }
}

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const validation = validateRequest(parsedBody);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const provider = (process.env.PODCHAT_AI_PROVIDER || "claude").toLowerCase();
  const validatedReq = validation.request;

  if (provider === "mock") {
    const text = buildMockPodchatTurn(validatedReq);
    const outputValidation = validateClaudeOutput(text);
    if (!outputValidation.valid) {
      console.error(`Mock output validation failed: ${outputValidation.error}. Raw: ${text}`);
      return NextResponse.json(
        { error: "Invalid provider response format. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(outputValidation.response);
  }

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 }
      );
    }

    const systemPrompt = buildSystemPrompt(validatedReq.topic, validatedReq.difficulty);
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
      return NextResponse.json(outputValidation.response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected Gemini error: ${msg}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  }

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later." },
        { status: 503 }
      );
    }

    const systemPrompt = buildSystemPrompt(validatedReq.topic, validatedReq.difficulty);
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
      return NextResponse.json(outputValidation.response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Unexpected DeepSeek error: ${msg}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }
  }


  // Claude Default
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Provider is not configured. Please try again later." },
      { status: 503 }
    );
  }

  const systemPrompt = buildSystemPrompt(validatedReq.topic, validatedReq.difficulty);
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
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Claude API error ${res.status}: ${errText.slice(0, 500)}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";

    const outputValidation = validateClaudeOutput(text);
    if (!outputValidation.valid) {
      console.error(`Claude output validation failed: ${outputValidation.error}. Raw: ${text}`);
      return NextResponse.json(
        { error: "Invalid provider response format. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(outputValidation.response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected route error: ${msg}`);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 502 }
    );
  }
}
