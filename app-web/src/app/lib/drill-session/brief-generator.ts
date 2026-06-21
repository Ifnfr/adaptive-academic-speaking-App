import { getLatestWeaknessForUser } from "../pattern-drill/latestWeaknessServer";
import { resolveProvider, callRoleProvider, ProviderConfigError } from "../../api/pattern-drill/_lib/roleProviders";
import { validateSpokenModelFragment } from "./validation";
import crypto from "crypto";
import { selectReinforcementWeakness } from "./reinforcement/reinforcementSelector";

export interface PatternBriefInput {
  level: string;
  mode: string;
  source: string;
  focus?: string;
  sourceId?: string;
  allowFallbacks?: boolean;
}

export type BriefContentOutput = {
  briefId: string;
  title: string;
  focus: string;
  qualityCriteria: string[];
  responsePattern: {
    name: string;
    steps: string[];
    spokenModelFragment: string;
  };
  miniExample: string;
  commonMistakes: string[];
  drillEntryConfig: {
    targetPattern: string;
    targetSteps: string[];
    commonMistakes: string[];
    suggestedEntryPhase: number;
  };
  weaknessLabel?: string;
  weaknessDescription?: string;
};

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

export async function generatePatternBriefContent(
  ownerId: string,
  supabaseClient: Parameters<typeof getLatestWeaknessForUser>[1],
  input: PatternBriefInput,
  overrides?: {
    callClaude?: (apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>;
  }
): Promise<BriefContentOutput> {
  const { level, mode, source, focus, sourceId, allowFallbacks } = input;

  let validatedFocus = "";
  let selectedWeaknessLabel = "";
  let selectedWeaknessDescription = "";

  if (source === "manual") {
    if (!focus || focus.trim().length === 0) {
      throw new Error("focus_required");
    }
    const trimmedFocus = focus.trim();
    if (trimmedFocus.length > 200) {
      throw new Error("focus_too_long");
    }
    validatedFocus = trimmedFocus;
    selectedWeaknessLabel = trimmedFocus;
    selectedWeaknessDescription = trimmedFocus;
  } else {
    // source === "latest_weakness"
    if (!supabaseClient) {
      throw new Error("latest_weakness_unavailable");
    }

    // 1. Check unresolved Drill reinforcement weakness
    const reinforcementWeakness = await selectReinforcementWeakness(ownerId, supabaseClient);
    if (reinforcementWeakness) {
      selectedWeaknessLabel = reinforcementWeakness.weaknessTitle;
      selectedWeaknessDescription = reinforcementWeakness.weaknessDescription;
    } else {
      // 2. Check learner_error_patterns weakness
      let selectorResult;
      try {
        selectorResult = await getLatestWeaknessForUser(ownerId, supabaseClient, { sourceId });
      } catch (err) {
        console.error("Error fetching latest weakness:", err);
      }

      if (selectorResult && selectorResult.status === "found" && selectorResult.weakness) {
        selectedWeaknessLabel = selectorResult.weakness.title;
        selectedWeaknessDescription = selectorResult.weakness.description;
      } else {
        if (allowFallbacks) {
          // 3. latest weakness fallback (query absolute most recent row)
          let fallbackRow = null;
          try {
            let query = supabaseClient
              .from("learner_error_patterns")
              .select("id, category, label, evidence, practice_focus, created_at")
              .eq("owner_id", ownerId)
              .eq("source_kind", "podchat");
            if (sourceId) {
              query = query.eq("source_id", sourceId);
            }
            const { data } = await query
              .order("created_at", { ascending: false })
              .limit(1);
            if (data && data.length > 0) {
              fallbackRow = data[0];
            }
          } catch (err) {
            console.error("Error fetching latest weakness fallback:", err);
          }

          if (fallbackRow) {
            selectedWeaknessLabel = fallbackRow.label || "Academic Speaking Issue";
            selectedWeaknessDescription = fallbackRow.practice_focus || fallbackRow.evidence || fallbackRow.label || "Improve speaking structure and transitions.";
          } else {
            // 4. generic Drill fallback
            selectedWeaknessLabel = "Academic Discourse Structure";
            selectedWeaknessDescription = "Organizing speaking responses with a clear claim and supporting evidence.";
          }
        } else {
          const status = selectorResult?.status || "empty";
          if (status === "empty") {
            throw new Error("latest_weakness_not_found");
          }
          if (status === "insufficient") {
            throw new Error("latest_weakness_insufficient");
          }
          throw new Error("pattern_brief_failed");
        }
      }
    }

    validatedFocus = selectedWeaknessDescription;
  }

  let apiKey = "__test__";
  if (!overrides?.callClaude) {
    try {
      const providerConfig = await resolveProvider("planning");
      apiKey = providerConfig.apiKey;
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        throw new Error("provider_not_configured");
      }
      throw err;
    }
  }

  const systemPrompt = `You are an AI language learning assistant specializing in pre-drill speech instruction for academic English. Your task is to generate a pre-drill briefing ("Pattern Brief") in JSON format based on the user's level, mode, and target speaking focus/weakness.

The generated JSON must match the following schema exactly:
{
  "title": "A short, engaging pattern title",
  "focus": "Brief restatement of the practice focus",
  "qualityCriteria": ["Criterion 1", "Criterion 2"], // 1 to 3 short criteria
  "responsePattern": {
    "name": "Name of response structure",
    "steps": [
      "[claim]", 
      "because [reason]"
    ], // 2 to 5 steps. CRITICAL: Every step MUST contain at least one bracketed slot variable (e.g., "[claim]", "[cause]", "[result]", "[reason]"). Do not write plain instruction sentences without brackets; they will be rejected by the system. Keep each step under 10 words. Example 1: ["[claim]", "because [reason]"]. Example 2: ["[cause] of the issue", "therefore [result] of the issue"]. Example 3: ["[observation]", "although [contrast]"].
    "spokenModelFragment": "A short spoken sentence that DEMONSTRATES this exact pattern by using the CONCRETE (non-bracketed) words from responsePattern.steps above — do NOT write a generic unrelated sentence. The fragment must contain at least one concrete keyword from the steps (e.g. if a step says 'because + reason', the fragment MUST contain the word 'because'). STRICTLY 8 to 10 words (MUST be strictly less than 12 words), max 120 characters, single sentence, no internal punctuation other than the final period. Use single-word nouns and short clauses to keep it brief."
  },
  "miniExample": "Example sentence. Illustration only — do not memorize or copy.", // CRITICAL: Must be exactly two sentences: a short example sentence, followed by the exact warning: "Illustration only — do not memorize or copy."
  "commonMistakes": ["Mistake 1", "Mistake 2"], // 1 to 3 short strings
  "drillEntryConfig": {
    "targetPattern": "Name of response structure", // Must match responsePattern.name
    "targetSteps": [
      "[claim]", 
      "because [reason]"
    ], // Must match responsePattern.steps exactly
    "commonMistakes": ["Mistake 1", "Mistake 2"], // Must match commonMistakes exactly
    "suggestedEntryPhase": 1 // Must be 1 or 3
  }
}

Do not include any wrapper, markdown fences, or notes. Return only raw JSON.

CRITICAL CONSTRAINTS:
1. responsePattern.spokenModelFragment MUST contain between 8 and 10 words (strict limit: strictly less than 12 words). It must be a single sentence ending with a single period and containing no other sentence-ending punctuation or internal periods. To keep the word count strictly under 12 words:
   - Use simple, single-word nouns/pronouns (e.g., "dogs", "gold", "it", "this") instead of multi-word subjects (e.g., "the new system", "the blue car").
   - Use very short clauses for reasons (e.g., "because it saves time" [4 words]) instead of long explanatory reasons (e.g., "because it has a more powerful engine" [7 words]).
2. miniExample MUST consist of exactly two sentences. The first sentence is the example itself (which must be a single short sentence). The second sentence is the exact warning: "Illustration only — do not memorize or copy." Do not use multiple sentences for the example. If you need multiple steps, connect them with commas or transition words within a single sentence.
3. Ensure you define the responsePattern.steps first, and then construct responsePattern.spokenModelFragment by directly incorporating the concrete keywords (e.g., transition words like 'because', 'therefore', 'although') that are explicitly defined in those steps.`;

  const userPrompt = `Generate a Pattern Brief for:
Level: ${level}
Mode: ${mode}
Focus: ${validatedFocus}`;

  let text = "";
  let parsed: any = null;
  let lastError: Error | null = null;
  
  // Feature flag to enable/disable retry logic
  const ENABLE_RETRY = true;
  const maxAttempts = ENABLE_RETRY ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (overrides?.callClaude) {
        text = await overrides.callClaude(apiKey, systemPrompt, userPrompt);
      } else {
        text = await callRoleProvider("planning", systemPrompt, userPrompt);
      }
      console.log(`Raw provider response for Pattern Brief (Attempt ${attempt}):`, text);

      const cleanedText = cleanJsonResponse(text);
      try {
        parsed = JSON.parse(cleanedText);
      } catch (parseErr) {
        console.error(`JSON Parse Error in helper (Attempt ${attempt}):`, parseErr);
        throw new Error("invalid_provider_response");
      }

      // Strict validation rules
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof parsed.title !== "string" ||
        typeof parsed.focus !== "string" ||
        !Array.isArray(parsed.qualityCriteria) ||
        parsed.qualityCriteria.length < 1 ||
        parsed.qualityCriteria.length > 3 ||
        parsed.qualityCriteria.some((c: unknown) => typeof c !== "string")
      ) {
        console.error("Validation failed: basic fields", parsed);
        throw new Error("invalid_provider_response");
      }

      if (
        typeof parsed.responsePattern !== "object" ||
        parsed.responsePattern === null ||
        typeof parsed.responsePattern.name !== "string" ||
        !Array.isArray(parsed.responsePattern.steps) ||
        parsed.responsePattern.steps.length < 2 ||
        parsed.responsePattern.steps.length > 5 ||
        parsed.responsePattern.steps.some((s: unknown) => typeof s !== "string")
      ) {
        console.error("Validation failed: responsePattern", parsed);
        throw new Error("invalid_provider_response");
      }

      // Validate spokenModelFragment
      if (!validateSpokenModelFragment(parsed.responsePattern.spokenModelFragment, parsed.responsePattern.steps)) {
        console.error("Validation failed: spokenModelFragment", parsed.responsePattern.spokenModelFragment);
        throw new Error("invalid_provider_response");
      }

      // Check slot notation in steps
      const slotRegex = /\[[a-zA-Z0-9_\s-]+\]/;
      const hasAtLeastOneSlot = parsed.responsePattern.steps.some((step: string) => slotRegex.test(step));
      const allStepsAreShort = parsed.responsePattern.steps.every((step: string) => step.split(/\s+/).length <= 10);
      const stepsOk = hasAtLeastOneSlot && allStepsAreShort;
      if (!stepsOk) {
        console.error("Validation failed: slot steps", parsed.responsePattern.steps);
        throw new Error("invalid_provider_response");
      }

      // Check miniExample
      if (typeof parsed.miniExample !== "string") {
        console.error("Validation failed: miniExample type", parsed);
        throw new Error("invalid_provider_response");
      }
      const sentences = parsed.miniExample.split(/[.!?]/).filter((s: string) => s.trim().length > 0);
      const hasExactWarning = parsed.miniExample.includes("Illustration only — do not memorize or copy.");
      if (sentences.length < 1 || sentences.length > 2 || !hasExactWarning) {
        console.error("Validation failed: miniExample checks", {
          sentenceCount: sentences.length,
          hasExactWarning,
        });
        throw new Error("invalid_provider_response");
      }

      // Check commonMistakes
      if (
        !Array.isArray(parsed.commonMistakes) ||
        parsed.commonMistakes.length < 1 ||
        parsed.commonMistakes.length > 3 ||
        parsed.commonMistakes.some((m: unknown) => typeof m !== "string")
      ) {
        console.error("Validation failed: commonMistakes", parsed);
        throw new Error("invalid_provider_response");
      }

      // Check drillEntryConfig
      if (
        typeof parsed.drillEntryConfig !== "object" ||
        parsed.drillEntryConfig === null ||
        parsed.drillEntryConfig.targetPattern !== parsed.responsePattern.name ||
        !Array.isArray(parsed.drillEntryConfig.targetSteps) ||
        parsed.drillEntryConfig.targetSteps.length !== parsed.responsePattern.steps.length ||
        parsed.drillEntryConfig.targetSteps.some((s: unknown, idx: number) => s !== parsed.responsePattern.steps[idx]) ||
        !Array.isArray(parsed.drillEntryConfig.commonMistakes) ||
        parsed.drillEntryConfig.commonMistakes.length !== parsed.commonMistakes.length ||
        parsed.drillEntryConfig.commonMistakes.some((m: unknown, idx: number) => m !== parsed.commonMistakes[idx]) ||
        ![1, 3].includes(parsed.drillEntryConfig.suggestedEntryPhase)
      ) {
        console.error("Validation failed: drillEntryConfig", parsed.drillEntryConfig);
        throw new Error("invalid_provider_response");
      }

      // If we reach here, validation passed! Break loop.
      break;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Attempt ${attempt} of ${maxAttempts} failed validation. Retrying if attempts remain...`);
      if (attempt === maxAttempts) {
        throw lastError;
      }
    }
  }

  parsed.responsePattern.spokenModelFragment = parsed.responsePattern.spokenModelFragment.trim();

  return {
    briefId: crypto.randomUUID(),
    title: parsed.title,
    focus: parsed.focus,
    qualityCriteria: parsed.qualityCriteria,
    responsePattern: parsed.responsePattern,
    miniExample: parsed.miniExample,
    commonMistakes: parsed.commonMistakes,
    drillEntryConfig: parsed.drillEntryConfig,
    weaknessLabel: selectedWeaknessLabel || undefined,
    weaknessDescription: selectedWeaknessDescription || undefined,
  };
}
