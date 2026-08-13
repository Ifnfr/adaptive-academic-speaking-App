import { NextResponse } from "next/server";
import { resolveFeatureProvider } from "../../../lib/ai-provider-resolver";
import { callDeepSeek, callGemini, callOpenAICompatibleForProvider } from "../_lib/providers";

export const runtime = "nodejs";

type QuizMCQ = {
  type: "mcq";
  question: string;
  options: [string, string, string, string]; // always exactly 4 options
  correctIndex: number; // 0-3
  explanation: string;
};

type QuizEssay = {
  type: "essay";
  question: string;
  guidancePoints: string[]; // 2-3 bullet points of what a good answer should include
};

type QuizQuestion = QuizMCQ | QuizEssay;

type PodchatQuizResponse = {
  questions: QuizQuestion[];
};

type ValidationResult =
  | { valid: true; questions: QuizQuestion[] }
  | { valid: false; error: string };

function validateQuizOutput(text: string): ValidationResult {
  // Extract JSON object
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return { valid: false, error: "No JSON object found." };

  let depth = 0;
  let jsonText: string | null = null;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        jsonText = candidate.slice(start, i + 1);
        break;
      }
    }
  }

  if (!jsonText) return { valid: false, error: "Malformed JSON object." };

  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    if (!Array.isArray(data.questions)) {
      return { valid: false, error: "questions must be an array." };
    }
    if (data.questions.length !== 5) {
      return { valid: false, error: `Expected 5 questions, got ${data.questions.length}.` };
    }

    const validated: QuizQuestion[] = [];
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i] as Record<string, unknown>;
      if (q.type === "mcq") {
        if (typeof q.question !== "string" || q.question.trim().length === 0) {
          return { valid: false, error: `MCQ ${i}: missing question.` };
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          return { valid: false, error: `MCQ ${i}: options must be array of 4.` };
        }
        for (const opt of q.options) {
          if (typeof opt !== "string" || opt.trim().length === 0) {
            return { valid: false, error: `MCQ ${i}: all options must be non-empty strings.` };
          }
        }
        if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) {
          return { valid: false, error: `MCQ ${i}: correctIndex must be 0-3.` };
        }
        if (typeof q.explanation !== "string" || q.explanation.trim().length === 0) {
          return { valid: false, error: `MCQ ${i}: missing explanation.` };
        }
        validated.push({
          type: "mcq",
          question: q.question.trim(),
          options: (q.options as string[]).map((o) => o.trim()) as [string, string, string, string],
          correctIndex: q.correctIndex,
          explanation: q.explanation.trim(),
        });
      } else if (q.type === "essay") {
        if (typeof q.question !== "string" || q.question.trim().length === 0) {
          return { valid: false, error: `Essay ${i}: missing question.` };
        }
        if (!Array.isArray(q.guidancePoints) || q.guidancePoints.length < 2 || q.guidancePoints.length > 3) {
          return { valid: false, error: `Essay ${i}: guidancePoints must have 2-3 items.` };
        }
        for (const gp of q.guidancePoints) {
          if (typeof gp !== "string" || gp.trim().length === 0) {
            return { valid: false, error: `Essay ${i}: all guidancePoints must be non-empty strings.` };
          }
        }
        validated.push({
          type: "essay",
          question: q.question.trim(),
          guidancePoints: (q.guidancePoints as string[]).map((gp) => gp.trim()),
        });
      } else {
        return { valid: false, error: `Question ${i}: unknown type "${String(q.type)}".` };
      }
    }

    return { valid: true, questions: validated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `JSON parse failed: ${message}` };
  }
}

function buildQuizSystemPrompt(): string {
  return [
    "You are a language quiz generator for Podchat, an English speaking practice platform for Indonesian learners.",
    "",
    "You will receive a structured evaluation of a learner's speaking session.",
    "Your task is to generate exactly 5 quiz questions that help the learner consolidate the specific lessons from their evaluation.",
    "",
    "QUIZ DESIGN RULES:",
    "- All questions must be directly grounded in the learner's actual evaluation — their corrections, recurring errors, vocabulary suggestions, and aspect feedback weaknesses.",
    "- Do not generate generic grammar questions. Every question must relate to a specific pattern, error, or vocabulary item identified in the evaluation.",
    "- Generate exactly 3 multiple choice questions (type: mcq) and exactly 2 essay questions (type: essay).",
    "- MCQ questions should test whether the learner can identify correct usage of a grammar pattern or vocabulary item from their evaluation.",
    "- Essay questions should ask the learner to practice a speaking skill identified as weak in their evaluation (e.g. developing an idea, using spoken connectors, responding to a specific type of question).",
    "- Questions must be answerable in English. Do not use Bahasa Indonesia.",
    "- Keep questions concise and clear.",
    "",
    "OUTPUT FORMAT:",
    "- Respond with ONLY a single JSON object. No markdown, code fences, or commentary.",
    "- The JSON must have exactly one top-level key: 'questions'.",
    "- 'questions' must be an array of exactly 5 objects.",
    "- Each MCQ object: { type: 'mcq', question: string, options: [string, string, string, string], correctIndex: number (0-3), explanation: string }",
    "- Each essay object: { type: 'essay', question: string, guidancePoints: [string, string] or [string, string, string] }",
    "- explanation for MCQ: one sentence explaining why the correct answer is right and what rule it demonstrates.",
    "- guidancePoints for essay: 2-3 bullet points describing what a strong spoken answer should include.",
    "- The first 3 questions must be MCQ (type: mcq). The last 2 must be essay (type: essay).",
  ].join("\n");
}

function buildQuizUserPrompt(evaluationJson: unknown): string {
  return [
    "EVALUATION RESULT:",
    JSON.stringify(evaluationJson, null, 2),
    "",
    "TASK:",
    "Generate exactly 5 quiz questions (3 MCQ, 2 essay) based on this evaluation.",
    "Return only the required JSON object.",
  ].join("\n");
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

  if (!parsedBody || typeof parsedBody !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body = parsedBody as Record<string, unknown>;
  if (!body.evaluation || typeof body.evaluation !== "object") {
    return NextResponse.json({ error: "evaluation field is required and must be an object." }, { status: 400 });
  }

  const { providerId, apiKey, modelName } = await resolveFeatureProvider("podchat");
  const provider = providerId;

  const systemPrompt = buildQuizSystemPrompt();
  const userPrompt = buildQuizUserPrompt(body.evaluation);

  let rawText = "";

  try {
    if (provider === "gemini") {
      if (!apiKey) {
        return NextResponse.json({ error: "Provider is not configured." }, { status: 503 });
      }
      rawText = await callGemini(apiKey, systemPrompt, userPrompt);
    } else if (provider === "deepseek" || provider === "tokenrouter" || provider === "routeapi" || provider === "opencode" || provider === "hermes") {
      if (!apiKey) {
        return NextResponse.json({ error: "Provider is not configured." }, { status: 503 });
      }
      rawText = provider === "deepseek"
        ? await callDeepSeek(apiKey, systemPrompt, userPrompt)
        : await callOpenAICompatibleForProvider(provider, apiKey, systemPrompt, userPrompt);
    } else {
      // Claude default
      if (!apiKey) {
        return NextResponse.json({ error: "Provider is not configured." }, { status: 503 });
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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Claude API error ${res.status}: ${errText.slice(0, 500)}`);
        return NextResponse.json({ error: "Provider request failed." }, { status: 502 });
      }
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      rawText = data.content?.find((c) => c.type === "text")?.text ?? "";
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Quiz generation error: ${message}`);
    return NextResponse.json({ error: "Provider request failed. Please try again." }, { status: 502 });
  }

  const validation = validateQuizOutput(rawText);
  if (!validation.valid) {
    console.error(`Quiz output validation failed: ${validation.error}. Raw: ${rawText}`);
    return NextResponse.json({ error: "Invalid quiz response format. Please try again." }, { status: 502 });
  }

  const response: PodchatQuizResponse = { questions: validation.questions };
  return NextResponse.json(response);
}
