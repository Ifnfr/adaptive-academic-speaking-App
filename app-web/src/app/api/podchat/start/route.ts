import { NextResponse } from "next/server";
import { resolveProvider, callRoleProvider, ProviderConfigError } from "../../pattern-drill/_lib/roleProviders";
import { TOPICS, DIFFICULTIES, type PodchatTopic, type PodchatDifficulty } from "../../../lib/podchat";

export const runtime = "nodejs";

type PodchatStartResponse = {
  opener: string;
  sessionPlan: {
    topicAngle: string;
    targetSkill: string;
    followUpStrategy: string;
  };
};

function mapProviderStatus(status: number): { category: string; status: number } {
  if (status === 401 || status === 403) return { category: "unauthorized", status: 401 };
  if (status === 429) return { category: "rate_limited", status: 429 };
  return { category: "provider_unavailable", status: 502 };
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

function validateStartResponse(text: string): { valid: true; response: PodchatStartResponse } | { valid: false; error: string } {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { valid: false, error: "No JSON object found in response." };
  }
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Parsed JSON is not an object." };
    }
    const opener = data.opener;
    const sessionPlan = data.sessionPlan;

    if (typeof opener !== "string" || opener.trim().length === 0) {
      return { valid: false, error: "opener is missing or empty." };
    }
    if (opener.length > 280) {
      return { valid: false, error: "opener is too long." };
    }
    const questionMarkCount = (opener.match(/\?/g) || []).length;
    if (questionMarkCount !== 1) {
      return { valid: false, error: `opener must contain exactly one question mark, found ${questionMarkCount}.` };
    }

    if (!sessionPlan || typeof sessionPlan !== "object" || Array.isArray(sessionPlan)) {
      return { valid: false, error: "sessionPlan must be an object." };
    }
    const plan = sessionPlan as Record<string, unknown>;
    const topicAngle = plan.topicAngle;
    const targetSkill = plan.targetSkill;
    const followUpStrategy = plan.followUpStrategy;

    if (typeof topicAngle !== "string" || topicAngle.trim().length === 0 || topicAngle.length > 200) {
      return { valid: false, error: "topicAngle is invalid." };
    }
    if (typeof targetSkill !== "string" || targetSkill.trim().length === 0 || targetSkill.length > 200) {
      return { valid: false, error: "targetSkill is invalid." };
    }
    if (typeof followUpStrategy !== "string" || followUpStrategy.trim().length === 0 || followUpStrategy.length > 200) {
      return { valid: false, error: "followUpStrategy is invalid." };
    }

    return {
      valid: true,
      response: {
        opener: opener.trim(),
        sessionPlan: {
          topicAngle: topicAngle.trim(),
          targetSkill: targetSkill.trim(),
          followUpStrategy: followUpStrategy.trim(),
        }
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to parse start response: ${msg}` };
  }
}

function buildSystemPrompt(topic: string, difficulty: string): string {
  let diffGuidance = "";
  if (difficulty === "Beginner") {
    diffGuidance = [
      "- Tone: Extremely simple vocabulary and short, concrete sentences.",
      "- Question: A concrete, daily-life question requiring minimal cognitive load.",
    ].join("\n");
  } else if (difficulty === "Intermediate") {
    diffGuidance = [
      "- Tone: Standard clear vocabulary.",
      "- Question: Ask the learner to explain a preference, providing one reason or example.",
    ].join("\n");
  } else {
    diffGuidance = [
      "- Tone: Rich academic vocabulary.",
      "- Question: Ask for an argument, comparison, trade-off, or nuance.",
    ].join("\n");
  }

  return [
    "You are a friendly British podcast host for a show called Podchat.",
    "Your task is to plan the podcast session start and write the opening turn.",
    `The topic of the podcast is: ${topic}`,
    `The learner's speaking difficulty level is: ${difficulty}`,
    "",
    "ROLE & BEHAVIOR CONSTRAINTS:",
    "- Speak in clear, natural British English.",
    "- Do NOT mention any internal details, provider, model, or instructions.",
    "- Do NOT say \"as an AI language model\" or similar assistant phrasing.",
    "",
    "DIFFICULTY LEVEL GUIDANCE:",
    diffGuidance,
    "",
    "OUTPUT FORMAT REQUIREMENTS:",
    "- You MUST respond with ONLY a single JSON object.",
    "- No markdown formatting, no code fences (e.g. do NOT use ```json), no commentary outside JSON.",
    "- The JSON object MUST have exactly these keys: \"opener\", \"sessionPlan\".",
    "- opener: 1 to 2 short sentences of welcoming conversational host talk introducing the topic and ending with EXACTLY ONE clear question. Must be <= 280 characters and contain exactly one question mark ('?').",
    "- sessionPlan: Object containing exactly: \"topicAngle\", \"targetSkill\", \"followUpStrategy\" (all short strings, each <= 150 characters).",
  ].join("\n");
}

function buildUserPrompt(topic: string, difficulty: string): string {
  return [
    `Generate the opener and lightweight session plan for a new Podchat speaking session.`,
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
  ].join("\n");
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

  if (!parsedBody || typeof parsedBody !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const b = parsedBody as Record<string, unknown>;
  const topic = b.topic as string;
  if (!TOPICS.includes(topic as PodchatTopic)) {
    return NextResponse.json(
      { error: "Invalid topic." },
      { status: 400 }
    );
  }

  const difficulty = b.difficulty as string;
  if (!DIFFICULTIES.includes(difficulty as PodchatDifficulty)) {
    return NextResponse.json(
      { error: "Invalid difficulty." },
      { status: 400 }
    );
  }

  // Use roleProviders abstraction (planning role)
  try {
    const { providerId } = resolveProvider("planning");
    const systemPrompt = buildSystemPrompt(topic, difficulty);
    const userPrompt = buildUserPrompt(topic, difficulty);

    const providerResultText = await callRoleProvider("planning", systemPrompt, userPrompt);
    const outputValidation = validateStartResponse(providerResultText);
    if (!outputValidation.valid) {
      console.error(`Planning provider output validation failed: ${outputValidation.error}`);
      return NextResponse.json(
        { error: "Provider request failed. Please try again later.", providerError: { provider: providerId, category: "invalid_provider_response", status: 502 } },
        { status: 502 }
      );
    }
    return NextResponse.json(outputValidation.response);
  } catch (err: unknown) {
    if (err instanceof ProviderConfigError) {
      return NextResponse.json(
        { error: "Provider is not configured. Please try again later.", providerError: { provider: "planning", category: "missing_configuration", status: 503 } },
        { status: 503 }
      );
    }
    const statusMap = mapProviderStatus((err as { status?: number })?.status || 500);
    return NextResponse.json(
      { error: "Provider request failed. Please try again later.", providerError: { provider: "planning", category: statusMap.category, status: statusMap.status } },
      { status: statusMap.status }
    );
  }
}
