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

export type QuickCheckOutput = {
  result: "detected" | "not_detected_or_partial";
  entryPhase: 1 | 3;
};

export async function executeQuickCheck(
  responsePattern: { name: string; steps: string[] },
  commonMistakes: string[],
  transcript: string,
  overrides?: {
    callClaude?: (apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>;
  }
): Promise<QuickCheckOutput> {
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

  const patternName = responsePattern.name;
  const patternSteps = responsePattern.steps.join(", ");
  const mistakesList = commonMistakes.length > 0 ? commonMistakes.join("; ") : "none specified";

  const systemPrompt = `You are an expert language learning evaluator. Your task is to determine whether a learner's spoken sentence demonstrates a specific response pattern. Return ONLY a JSON object with a single field "result" that is either "detected" or "not_detected_or_partial". No explanation, no score, no grammar correction — just the JSON.

Rules:
- "detected": the sentence clearly follows the pattern structure, using the key slot types in roughly the correct order
- "not_detected_or_partial": the sentence is missing key slots, uses the pattern incorrectly, or does not attempt the pattern

Return format (strict): {"result":"detected"} or {"result":"not_detected_or_partial"}`;

  const userPrompt = `Pattern name: ${patternName}
Pattern steps: ${patternSteps}
Common mistakes to watch for: ${mistakesList}

Learner sentence: "${transcript}"

Does this sentence demonstrate the pattern? Return only JSON.`;

  let text: string;
  if (overrides?.callClaude) {
    text = await overrides.callClaude(apiKey, systemPrompt, userPrompt);
  } else {
    text = await callRoleProvider("execution", systemPrompt, userPrompt);
  }

  const cleanedText = cleanJsonResponse(text);

  let parsed: { result?: unknown };
  try {
    parsed = JSON.parse(cleanedText) as { result?: unknown };
  } catch {
    console.error("Quick check JSON parse error");
    throw new Error("invalid_provider_response");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed.result !== "detected" && parsed.result !== "not_detected_or_partial")
  ) {
    console.error("Quick check invalid provider result:", parsed);
    throw new Error("invalid_provider_response");
  }

  const result = parsed.result as "detected" | "not_detected_or_partial";
  const entryPhase: 1 | 3 = result === "detected" ? 3 : 1;

  return { result, entryPhase };
}
