import { resolveProvider, callRoleProvider, ProviderConfigError } from "../../api/pattern-drill/_lib/roleProviders";

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export type DrillTurnOutput = {
  credit: "full" | "partial" | "none";
  missingSteps: string[];
  usedSteps: string[];
  shortFeedback: string;
};

export async function executeDrillTurn(
  input: {
    targetPattern: string;
    targetSteps: string[];
    commonMistakes: string[];
    promptTopic: string;
    transcript: string;
    attemptNumber: number;
    previousCredit?: "partial" | "none" | null;
  },
  overrides?: {
    callDeepSeek?: (apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>;
  }
): Promise<DrillTurnOutput> {
  const {
    targetPattern,
    targetSteps,
    commonMistakes,
    promptTopic,
    transcript,
    attemptNumber,
    previousCredit,
  } = input;

  let apiKey = "__test__";
  if (!overrides?.callDeepSeek) {
    try {
      const providerConfig = await resolveProvider("execution");
      apiKey = providerConfig.apiKey;
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        throw new Error("provider_not_configured");
      }
      throw err;
    }
  }

  const systemPrompt = `You are a strict language learning assistant evaluating spoken turns in a Contrastive Repetition drill.
Evaluate whether the learner's transcript correctly uses the target response pattern for the given topic.
Compare the target steps of the response pattern with the learner's transcript.

You must return ONLY a JSON object matching this schema:
{
  "credit": "full" | "partial" | "none",
  "missingSteps": string[], // steps from the pattern that the learner missed
  "usedSteps": string[], // steps from the pattern that the learner used
  "shortFeedback": string // a brief feedback message complying with the rules below
}

Feedback rules:
1. If credit is "full", the shortFeedback MUST be EXACTLY one of: "Good.", "Yes.", or "Exactly.". No additional text, commentary, or punctuation.
2. If credit is "partial", the shortFeedback must list only the missing steps or what is incorrect, with no coaching or conversational fluff (e.g. "Missing slot: [reason]."). Keep it very short.
3. If credit is "none", the shortFeedback must be a concise contrastive explanation (e.g. "You said X, but the pattern requires Y."). Keep it under 150 characters.

Return only raw JSON. Do not include markdown fences, comments, or any other wrapper text.`;

  const userPrompt = `Target Pattern Name: ${targetPattern}
Target Steps: ${targetSteps.join(", ")}
Common Mistakes: ${commonMistakes.join("; ")}
Topic: ${promptTopic}
Learner Transcript: "${transcript}"
Attempt Number: ${attemptNumber}
Previous Credit: ${previousCredit || "none"}

Evaluate the learner transcript against the pattern and topic.`;

  let text: string;
  if (overrides?.callDeepSeek) {
    text = await overrides.callDeepSeek(apiKey, systemPrompt, userPrompt);
  } else {
    text = await callRoleProvider("execution", systemPrompt, userPrompt);
  }

  const cleanedText = cleanJsonResponse(text);

  interface DeepSeekResponseParsed {
    credit?: unknown;
    missingSteps?: unknown;
    usedSteps?: unknown;
    shortFeedback?: unknown;
  }

  let parsed: DeepSeekResponseParsed;
  try {
    parsed = JSON.parse(cleanedText) as DeepSeekResponseParsed;
  } catch {
    console.error("Drill turn JSON parse error");
    throw new Error("invalid_provider_response");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed.credit !== "full" && parsed.credit !== "partial" && parsed.credit !== "none") ||
    !Array.isArray(parsed.missingSteps) ||
    parsed.missingSteps.some((s) => typeof s !== "string") ||
    !Array.isArray(parsed.usedSteps) ||
    parsed.usedSteps.some((s) => typeof s !== "string") ||
    typeof parsed.shortFeedback !== "string"
  ) {
    console.error("Drill turn invalid provider result fields:", parsed);
    throw new Error("invalid_provider_response");
  }

  const feedback = parsed.shortFeedback.trim();

  // Limit feedback length to prevent verbose coaching/prompts leakage
  if (feedback.length > 150) {
    console.error("Drill turn feedback exceeded character limit:", feedback.length);
    throw new Error("invalid_provider_response");
  }

  if (parsed.credit === "full") {
    if (feedback !== "Good." && feedback !== "Yes." && feedback !== "Exactly.") {
      console.error("Drill turn full credit feedback was not one of 'Good.', 'Yes.', 'Exactly.':", feedback);
      throw new Error("invalid_provider_response");
    }
  }

  return {
    credit: parsed.credit as "full" | "partial" | "none",
    missingSteps: parsed.missingSteps as string[],
    usedSteps: parsed.usedSteps as string[],
    shortFeedback: feedback,
  };
}
