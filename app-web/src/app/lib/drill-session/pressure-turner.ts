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

export type PressureTurnOutput = {
  patternDetected: boolean;
  usedSteps: string[];
  missingSteps: string[];
  timedOut: boolean;
  shortFeedback: string;
};

export async function executePressureTurn(
  input: {
    targetPattern: string;
    targetSteps: string[];
    commonMistakes: string[];
    promptTopic: string;
    transcript: string;
    roundSeconds: number;
    roundIndex: number;
  },
  overrides?: {
    callClaude?: (apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>;
  }
): Promise<PressureTurnOutput> {
  const {
    targetPattern,
    targetSteps,
    commonMistakes,
    promptTopic,
    transcript,
    roundSeconds,
    roundIndex,
  } = input;

  let apiKey = "__test__";
  if (!overrides?.callClaude) {
    try {
      const providerConfig = resolveProvider("execution");
      apiKey = providerConfig.apiKey;
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        throw new Error("provider_not_configured");
      }
      throw err;
    }
  }

  const systemPrompt = `You are a strict language learning assistant evaluating spoken turns in a text-based Pressure Test drill.
Evaluate whether the learner's transcript correctly uses the target response pattern for the given topic.
Compare the target steps of the response pattern with the learner's transcript.

You must return ONLY a JSON object matching this schema:
{
  "patternDetected": boolean,
  "usedSteps": string[], // steps from the pattern that the learner used
  "missingSteps": string[], // steps from the pattern that the learner missed
  "timedOut": false,
  "shortFeedback": string // a brief feedback message complying with the rules below
}

Feedback rules:
1. Keep the shortFeedback extremely concise.
2. If patternDetected is true, the shortFeedback MUST be EXACTLY one of: "Good.", "Yes.", or "Exactly.". No additional text or punctuation.
3. If patternDetected is false, list only the missing steps or what is incorrect concisely.

Return only raw JSON. Do not include markdown fences, comments, or any other wrapper text.`;

  const userPrompt = `Target Pattern Name: ${targetPattern}
Target Steps: ${targetSteps.join(", ")}
Common Mistakes: ${commonMistakes.join("; ")}
Topic: ${promptTopic}
Learner Transcript: "${transcript}"
Round Index: ${roundIndex} (Seconds: ${roundSeconds})

Evaluate the learner transcript against the pattern and topic.`;

  let text: string;
  if (overrides?.callClaude) {
    text = await overrides.callClaude(apiKey, systemPrompt, userPrompt);
  } else {
    text = await callRoleProvider("execution", systemPrompt, userPrompt);
  }

  const cleanedText = cleanJsonResponse(text);

  interface ClaudeResponseParsed {
    patternDetected?: unknown;
    usedSteps?: unknown;
    missingSteps?: unknown;
    timedOut?: unknown;
    shortFeedback?: unknown;
  }

  let parsed: ClaudeResponseParsed;
  try {
    parsed = JSON.parse(cleanedText) as ClaudeResponseParsed;
  } catch (parseErr) {
    console.error("JSON Parse Error in pressure-turn helper:", parseErr, "Raw response:", text);
    throw new Error("provider_evaluation_failed");
  }

  if (
    typeof parsed.patternDetected !== "boolean" ||
    !Array.isArray(parsed.usedSteps) ||
    parsed.usedSteps.some((s) => typeof s !== "string") ||
    !Array.isArray(parsed.missingSteps) ||
    parsed.missingSteps.some((s) => typeof s !== "string") ||
    typeof parsed.shortFeedback !== "string"
  ) {
    console.error("Validation failed: pressure-turn response format invalid:", parsed);
    throw new Error("provider_evaluation_failed");
  }

  // Enforce exact feedback rule for patternDetected = true
  const shortFeedback = parsed.shortFeedback.trim();
  if (parsed.patternDetected) {
    if (!["Good.", "Yes.", "Exactly."].includes(shortFeedback)) {
      console.error("Pressure turn detected pattern but feedback was not one of allowed values:", shortFeedback);
      throw new Error("provider_evaluation_failed");
    }
  }

  if (shortFeedback.length > 150) {
    console.error("Pressure turn feedback exceeded character limit:", shortFeedback.length);
    throw new Error("provider_evaluation_failed");
  }

  return {
    patternDetected: parsed.patternDetected,
    usedSteps: parsed.usedSteps,
    missingSteps: parsed.missingSteps,
    timedOut: false,
    shortFeedback,
  };
}
