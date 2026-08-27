
import { resolveFeatureProvider } from "../../../lib/ai-provider-resolver";

export interface AIProviderResponse {
  text: string;
}

export async function resolveListeningProvider(): Promise<{ providerId: string; apiKey: string; modelName: string }> {
  return resolveFeatureProvider("listening");
}

/**
 * Extracts a JSON object block from text that might contain markdown formatting.
 */
export function extractJsonObject(text: string): string | null {
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

/**
 * Generates mock response for Section 1 (Plan + Section 1 Content)
 */
export function getMockSection1Response(cefrLevel: string, sectionCount: number): string {
  return JSON.stringify({
    reasoning: {
      phase1_analysis: "Mock analysis: user has clean profile history.",
      phase2_planning: `Mock planning: session will proceed with 3 sections at CEFR level ${cefrLevel}.`,
      phase3_implementation: "Mock implementation: designing Section 1 content (Fill-in-the-blank)."
    },
    plan: {
      cefr_level: cefrLevel,
      section_count: 3,
      sections: [
        {
          section_index: 0,
          cefr_level: cefrLevel,
          topic: "Chemistry Basics",
          question_types: ["fill_blank"]
        },
        {
          section_index: 1,
          cefr_level: cefrLevel,
          topic: "Atmospheric Density",
          question_types: ["multiple_choice"]
        },
        {
          section_index: 2,
          cefr_level: cefrLevel,
          topic: "Water Properties",
          question_types: ["true_false"]
        }
      ]
    },
    section: {
      topic: "Chemistry Basics",
      audio_script: "Welcome to this chemistry lecture. Today we discuss water boiling points. Under standard sea-level atmospheric pressure, pure water always boils at exactly one hundred degrees Celsius. However, at higher altitudes where pressure is lower, water boils at lower temperatures. Oxygen and hydrogen bind together to form water molecules.",
      fact_units: [
        { id: "fact_0", text: "Under standard sea-level atmospheric pressure, pure water always boils at exactly 100 degrees Celsius." },
        { id: "fact_1", text: "At higher altitudes where pressure is lower, water boils at lower temperatures." },
        { id: "fact_2", text: "Water is composed of oxygen and hydrogen atoms." },
        { id: "fact_3", text: "Hydrogen is the lightest element on the periodic table." },
        { id: "fact_4", text: "Water molecules exhibit polarity due to unequal electron sharing." }
      ],
      questions: [
        {
          id: "q_0",
          question_type: "fill_blank",
          question_text: "Standard sea-level pressure causes water to boil at [blank] degrees Celsius.",
          answer: "100",
          accepted_variants: ["one hundred", "100c"],
          sub_skill: "detail",
          testing_fact_unit_id: "fact_0"
        },
        {
          id: "q_1",
          question_type: "fill_blank",
          question_text: "At higher altitudes where pressure is lower, water boils at [blank] temperatures.",
          answer: "lower",
          accepted_variants: ["colder"],
          sub_skill: "detail",
          testing_fact_unit_id: "fact_1"
        },
        {
          id: "q_2",
          question_type: "fill_blank",
          question_text: "Oxygen and [blank] bind together to form water molecules.",
          answer: "hydrogen",
          accepted_variants: ["H"],
          sub_skill: "detail",
          testing_fact_unit_id: "fact_2"
        },
        {
          id: "q_3",
          question_type: "fill_blank",
          question_text: "The lightest element on the periodic table is [blank].",
          answer: "hydrogen",
          accepted_variants: ["H"],
          sub_skill: "paraphrase-recognition",
          testing_fact_unit_id: "fact_3"
        },
        {
          id: "q_4",
          question_type: "fill_blank",
          question_text: "Water molecules exhibit polarity due to unequal [blank] sharing.",
          answer: "electron",
          accepted_variants: ["electrons"],
          sub_skill: "detail",
          testing_fact_unit_id: "fact_4"
        }
      ],
      pre_listening_prompt: "As you listen, pay close attention to the specific temperature values and atomic components mentioned in the lecture."
    }
  });
}

/**
 * Generates mock response for subsequent sections
 */
export function getMockNextSectionResponse(sectionIndex: number, cefrLevel: string, topic: string): string {
  if (sectionIndex === 1) {
    return JSON.stringify({
      reasoning: {
        phase3_implementation: `Mock implementation: generating section 2 (Multiple Choice) content at level ${cefrLevel}.`
      },
      section: {
        topic: topic || "Atmospheric Density",
        audio_script: "Warm air expands and rises, while cold air contracts and sinks. Gravity pulls the air molecules closer to the surface, creating higher density. Air pressure is measured using an instrument called a barometer.",
        fact_units: [
          { id: "fact_1_0", text: "Warm air expands and rises." },
          { id: "fact_1_1", text: "Cold air contracts and sinks." },
          { id: "fact_1_2", text: "Gravity pulls air molecules closer to the Earth's surface." },
          { id: "fact_1_3", text: "A barometer is used to measure air pressure." },
          { id: "fact_1_4", text: "Air density is higher closer to the surface." }
        ],
        questions: [
          {
            id: "q_1_0",
            question_type: "multiple_choice",
            question_text: "What happens to warm air?",
            options: ["It contracts and sinks", "It expands and rises", "It remains stable", "It turns into liquid"],
            answer: "It expands and rises",
            sub_skill: "detail",
            testing_fact_unit_id: "fact_1_0"
          },
          {
            id: "q_1_1",
            question_type: "multiple_choice",
            question_text: "What does cold air do?",
            options: ["It expands and rises", "It contracts and sinks", "It evaporates", "It does not move"],
            answer: "It contracts and sinks",
            sub_skill: "detail",
            testing_fact_unit_id: "fact_1_1"
          },
          {
            id: "q_1_2",
            question_type: "multiple_choice",
            question_text: "What force pulls air molecules closer to the surface?",
            options: ["Friction", "Centrifugal force", "Gravity", "Magnetic force"],
            answer: "Gravity",
            sub_skill: "detail",
            testing_fact_unit_id: "fact_1_2"
          },
          {
            id: "q_1_3",
            question_type: "multiple_choice",
            question_text: "Which instrument is used to measure air pressure?",
            options: ["Thermometer", "Barometer", "Hygrometer", "Anemometer"],
            answer: "Barometer",
            sub_skill: "detail",
            testing_fact_unit_id: "fact_1_3"
          },
          {
            id: "q_1_4",
            question_type: "multiple_choice",
            question_text: "Where is air density higher?",
            options: ["Closer to the surface", "Higher in the atmosphere", "In outer space", "It is uniform everywhere"],
            answer: "Closer to the surface",
            sub_skill: "inference",
            testing_fact_unit_id: "fact_1_4"
          }
        ],
        pre_listening_prompt: "Focus on how air temperature and gravity affect atmospheric density as the speaker explains these relationships."
      }
    });
  } else {
    return JSON.stringify({
      reasoning: {
        phase3_implementation: `Mock implementation: generating section 3 (True/False) content at level ${cefrLevel}.`
      },
      section: {
        topic: topic || "Water Properties",
        audio_script: "Water has many unique features. It exists in three states of matter: solid, liquid, and gas. Liquid water is denser than solid ice, which is why ice floats. Water is also known as the universal solvent.",
        fact_units: [
          { id: "fact_2_0", text: "Water exists in three states of matter." },
          { id: "fact_2_1", text: "Ice floats on water because liquid water is denser than ice." },
          { id: "fact_2_2", text: "Water is known as the universal solvent." },
          { id: "fact_2_3", text: "Pure water is odorless and tasteless." },
          { id: "fact_2_4", text: "Water freezes at zero degrees Celsius." }
        ],
        questions: [
          {
            id: "q_2_0",
            question_type: "true_false",
            question_text: "Water exists in exactly two states of matter.",
            options: ["True", "False"],
            answer: "False",
            sub_skill: "gist",
            testing_fact_unit_id: "fact_2_0"
          },
          {
            id: "q_2_1",
            question_type: "true_false",
            question_text: "Ice floats on water because ice is denser than liquid water.",
            options: ["True", "False"],
            answer: "False",
            sub_skill: "inference",
            testing_fact_unit_id: "fact_2_1"
          },
          {
            id: "q_2_2",
            question_type: "true_false",
            question_text: "Water is commonly referred to as the universal solvent.",
            options: ["True", "False"],
            answer: "True",
            sub_skill: "gist",
            testing_fact_unit_id: "fact_2_2"
          },
          {
            id: "q_2_3",
            question_type: "true_false",
            question_text: "Pure water has a strong odor and sour taste.",
            options: ["True", "False"],
            answer: "False",
            sub_skill: "inference",
            testing_fact_unit_id: "fact_2_3"
          },
          {
            id: "q_2_4",
            question_type: "true_false",
            question_text: "Under standard conditions, pure water freezes at 0 degrees Celsius.",
            options: ["True", "False"],
            answer: "True",
            sub_skill: "inference",
            testing_fact_unit_id: "fact_2_4"
          }
        ],
        pre_listening_prompt: "Listen carefully for the key characteristics of water and why ice behaves differently from liquid water."
      }
    });
  }
}

/**
 * Calls the active AI provider endpoint with a system and user prompt.
 */
export async function callListeningAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { providerId, apiKey, modelName } = await resolveListeningProvider();

  // If no API key is set, fall back to mock response generation logic based on the user prompt
  if (!apiKey) {
    if (userPrompt.includes("StartSession")) {
      const matchLevel = userPrompt.match(/CEFR Level: (\w+)/);
      const matchCount = userPrompt.match(/Section Count: (\d+)/);
      const level = matchLevel ? matchLevel[1] : "B2";
      const count = matchCount ? parseInt(matchCount[1], 10) : 3;
      return getMockSection1Response(level, count);
    } else {
      const matchIndex = userPrompt.match(/Section Index: (\d+)/);
      const matchLevel = userPrompt.match(/CEFR Level: (\w+)/);
      const matchTopic = userPrompt.match(/Topic: ([^\n]+)/);
      const idx = matchIndex ? parseInt(matchIndex[1], 10) : 1;
      const level = matchLevel ? matchLevel[1] : "B2";
      const topic = matchTopic ? matchTopic[1].trim() : "";
      return getMockNextSectionResponse(idx, level, topic);
    }
  }

  // Resolve provider-specific endpoint
  let endpoint: string;
  if (providerId === "claude") {
    endpoint = "https://api.anthropic.com/v1/messages";
  } else if (providerId === "gemini") {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
  } else if (providerId === "minimax_m3" || providerId === "minimax") {
    endpoint = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1/text/chatcompletion_v2";
  } else if (providerId === "opencode") {
    endpoint = process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1/chat/completions";
  } else if (providerId === "hermes") {
    endpoint = process.env.HERMES_BASE_URL || "http://127.0.0.1:8642/v1/chat/completions";
  } else if (providerId === "tokenrouter") {
    const trBase = process.env.TOKENROUTER_BASE_URL || "https://api.tokenrouter.com/v1";
    endpoint = trBase.endsWith("/chat/completions") ? trBase : `${trBase.replace(/\/$/, "")}/chat/completions`;
  } else if (providerId === "routeapi") {
    const raBase = process.env.ROUTEAPI_BASE_URL || "https://www.routeapi.ai/v1";
    endpoint = raBase.endsWith("/chat/completions") ? raBase : `${raBase.replace(/\/$/, "")}/chat/completions`;
  } else {
    endpoint = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions");
  }

  // Build provider-specific request
  let body: any;
  let headers: Record<string, string> = { "content-type": "application/json" };

  if (providerId === "claude") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: modelName,
      max_tokens: 4096,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPrompt }],
    };
  } else if (providerId === "gemini") {
    body = {
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    };
  } else if (providerId === "minimax_m3" || providerId === "minimax") {
    headers["authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  } else if (providerId === "opencode") {
    headers["authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  } else if (providerId === "hermes") {
    headers["authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  } else if (providerId === "tokenrouter") {
    headers["authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  } else if (providerId === "routeapi") {
    headers["authorization"] = `Bearer ${apiKey}`;
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  } else {
    // DeepSeek (default) — OpenAI-compatible. Prompt-caching hint:
    // DeepSeek reads the `X-DeepSeek-Cache: true` header to cache the
    // (stable) system prefix across calls. Ignored harmlessly if unsupported.
    headers["authorization"] = `Bearer ${apiKey}`;
    headers["X-DeepSeek-Cache"] = "true";
    body = {
      model: modelName,
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  }

  // Retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) continue;
        throw new Error(`${providerId} request failed: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();

      // Observability: log token accounting (prompt cache hit detection).
      // DeepSeek/OpenAI-compatible surfaces cached_tokens in usage; Anthropic
      // in usage.input_tokens_*; Gemini omits it. Harmless if absent.
      if (data?.usage) {
        console.log(
          `[llm-cache] provider=${providerId} model=${modelName} ` +
          `prompt_tokens=${data.usage.prompt_tokens ?? data.usage.total_tokens ?? "?"} ` +
          `cached_tokens=${data.usage.cached_tokens ?? data.usage.prompt_cache_hit_tokens ?? data.usage.cache_read_input_tokens ?? 0} ` +
          `completion_tokens=${data.usage.completion_tokens ?? "?"}`
        );
      }

      // Extract text based on provider
      if (providerId === "claude") {
        return data.content?.[0]?.text ?? "";
      } else if (providerId === "gemini") {
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else {
        // DeepSeek / MiniMax (OpenAI-compatible)
        const content = data.choices?.[0]?.message?.content ?? "";

        // Check for truncation (DeepSeek only)
        if (providerId === "deepseek" && data.choices?.[0]?.finish_reason === "length") {
          throw new Error(
            `TRUNCATED_RESPONSE: DeepSeek response was cut off by the max_tokens limit (finish_reason=length). Partial content: ${content.slice(0, 1000)}`
          );
        }

        return content;
      }
    } catch (err: any) {
      lastError = err;
      if (err.name === "AbortError" && attempt === 0) continue;
      throw err;
    }
  }

  throw lastError || new Error(`${providerId} request failed`);
}

function buildDifficultyInstruction(targetDifficulty: "easy" | "medium" | "hard"): string {
  if (targetDifficulty === "easy") {
    return "DIFFICULTY SCALING \u2014 EASY tier: Use only high-frequency, everyday vocabulary (roughly the top 1000\u20131500 most common English words; CEFR A1\u2013A2). No idioms, no phrasal verbs, no academic or technical jargon. Keep sentences short and simple \u2014 mostly present simple and simple past, minimal subordinate clauses \u2014 and explain any abstract idea in the simplest everyday terms. You may still let vocabulary and sentence complexity increase gradually from the first question toward the last, analyzing the user's past performance if provided in context, but every question must stay within these Easy-tier bounds \u2014 never introduce idioms, jargon, or complex clause structures even for later questions.";
  }
  if (targetDifficulty === "hard") {
    return "DIFFICULTY SCALING \u2014 HARD tier: Use a wide vocabulary range including abstract, academic, and domain-specific or technical terms appropriate to the topic (CEFR C1). Idiomatic expressions and less-common phrasal verbs are allowed. Use complex sentence structures \u2014 multiple clauses, passive voice, varied tenses, nuanced argumentation \u2014 and do not simplify domain concepts. You may still let vocabulary and sentence complexity increase gradually from the first question toward the last, analyzing the user's past performance if provided in context, but stay within this Hard-tier (C1) ceiling throughout \u2014 do not reach for highly specialized C2-level jargon unless the topic has no simpler equivalent term.";
  }
  // "medium" default
  return "DIFFICULTY SCALING \u2014 MEDIUM tier: Use broader everyday vocabulary plus common topic-related words (CEFR B1\u2013B2). Occasional common idioms or phrasal verbs are allowed. Use moderate sentence complexity \u2014 some subordinate clauses, a mix of tenses including present perfect, simple future, and basic conditionals \u2014 and introduce domain-specific terms naturally, briefly explaining them if unusual. You may still let vocabulary and sentence complexity increase gradually from the first question toward the last, analyzing the user's past performance if provided in context, but stay within these Medium-tier bounds throughout \u2014 do not drop to Easy-tier simplicity or reach into Hard-tier academic/idiomatic territory.";
}

/**
 * Adaptive length budget per section index (the "adaptive session" feature).
 * Section 0 acts as a warm-up (~1 min); later sections grow longer to train
 * sustained listening stamina (up to ~3 min). Returns a ready-to-embed
 * instruction string. All fact_units must fit inside the budget.
 */
export function adaptiveLengthBudget(sectionIndex: number): string {
  // Tiers: index 0 → ~150-200 words (60-80s); 1 → ~350-450 (110-150s);
  // 2+ → ~550-700 (220-280s). Clamp so any future index keeps growing safely.
  let min: number, max: number, secMin: number, secMax: number;
  if (sectionIndex <= 0) {
    min = 150; max = 200; secMin = 60; secMax = 80;
  } else if (sectionIndex === 1) {
    min = 350; max = 450; secMin = 110; secMax = 150;
  } else {
    min = 550; max = 700; secMin = 220; secMax = 280;
  }
  return (
    `ADAPTIVE LENGTH BUDGET (section index ${sectionIndex}): the finished audio_script MUST be ` +
    `between ${min} and ${max} words total (roughly ${secMin}-${secMax} seconds of spoken audio at a natural pace). ` +
    `All 5 fact_units must fit inside this budget. Count the words of your draft BEFORE returning; ` +
    `if it exceeds ${max} words, compress by removing redundant restatements first until it fits. ` +
    `NEVER exceed ${max} words under any circumstance — a passage that is too long is a failed output even if everything else is perfect.`
  );
}

/**
 * Builds the Phase 1, Phase 2, Phase 3 system prompt for Section 1 generation.
 */
export function buildSection1SystemPrompt(
  targetDifficulty: "easy" | "medium" | "hard"
): string {
  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "You must execute a strict Single-Call Three-Phase Reasoning Model:",
    "",
    "PHASE 1: ANALYSIS",
    "Analyze the learner's previous listening attempts history (if provided) to identify strengths and weaknesses. If no history is provided or is_placement is true, summarize that this is a new placement session.",
    "",
    "PHASE 2: PLANNING",
    "Plan the overall CEFR level and topic progression across exactly 3 sections. The plan must define a 3-phase session where:",
    "  - Section index 0 is always Fill-in-the-blank ('fill_blank').",
    "  - Section index 1 is always Multiple Choice ('multiple_choice').",
    "  - Section index 2 is always True/False ('true_false').",
    "The plan must match this exact layout. The CEFR level should match the requested average CEFR level.",
    "The user prompt provides this session's 3 section topics as pre-assigned, required values. You MUST use them verbatim as the 'topic' field for each corresponding section in your plan output — do not invent, alter, or substitute different topics.",
    "",
    "PHASE 3: IMPLEMENTATION",
    "Generate the listening passage script (audio_script) for Section 1 (index 0). Extract a discrete array of key facts (fact_units) from the passage script. Finally, formulate the questions array. Each question must target a specific fact unit and map to it via testing_fact_unit_id.",
    "The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure.",
    "The audio script MUST sound like natural spoken discourse, not an essay read aloud:",
    "  - Use discourse markers naturally and non-repetitively (e.g., 'you know', 'actually', 'I mean', 'so', 'well', 'anyway'). Vary them throughout the passage without reusing the same marker repeatedly.",
    "  - Incorporate mild redundancy by occasionally restating or rephrasing a point in slightly different words (self-paraphrase) as natural speech does, rather than stating each fact exactly once in perfectly dense prose.",
    "  - Maintain a conversational sentence rhythm using a mix of shorter and longer sentences, with occasional self-corrections (e.g., 'or rather', 'what I mean is'), while remaining fully grammatical, clear, and suitable for a listening exercise.",
    "",
    adaptiveLengthBudget(0),
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract exactly 5 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "CRITICAL RULE: You MUST generate exactly 5 questions. Do not generate fewer.",
    "",
    "FORMAT ENFORCEMENT: All 5 questions for this section (index 0) MUST be Fill-in-the-Blank ('fill_blank') format. Do not include any multiple choice or true/false questions in this section.",
    "",
    buildDifficultyInstruction(targetDifficulty),
    "",
    "QUESTION FORMAT RULES:",
    "1. fill_blank:",
    "   - The question_text MUST contain a single '[blank]' placeholder (e.g., 'Standard sea-level pressure causes water to boil at [blank] degrees.').",
    "   - You must provide the primary correct 'answer' and a list of 'accepted_variants' (alternate spellings, numbers vs. words, etc.).",
    "2. true_false:",
    "   - The question_text MUST be a complete statement.",
    "   - The 'options' array MUST contain exactly ['True', 'False'].",
    "   - The 'answer' MUST be either 'True' or 'False'.",
    "3. multiple_choice:",
    "   - The question_text MUST be a clear question or incomplete statement.",
    "   - The 'options' array MUST contain exactly 4 distinct choices.",
    "   - The 'answer' MUST be the exact string of the correct choice from the options array.",
    "",
    "SUB-SKILL TAGGING:",
    "Every question MUST include a \"sub_skill\" string property. Since all questions in this section are fill_blank, the \"sub_skill\" value MUST be either:",
    "  - \"detail\": The blank tests recall of a fact stated directly/literally in the audio passage.",
    "  - \"paraphrase-recognition\": Answering the blank requires recognizing a reworded/synonymous version of what was said, rather than the literal phrase.",
    "No other sub_skill value is allowed for fill_blank questions.",
    "",
    "PRE-LISTENING PROMPT:",
    "After you have finalized the questions array (including each question's sub_skill tag), write one additional field: \"pre_listening_prompt\" — a single natural sentence (not a list, not a technical explanation) that gives the listener a natural, implicit cue about what to pay attention to while listening, based on the sub_skill(s) most represented among this section's 5 questions. Do NOT use the words 'detail', 'inference', 'gist', 'paraphrase', 'paraphrase-recognition', 'speaker-attitude', or 'sub-skill' anywhere in this sentence — it must read like something a friendly instructor would casually say before playing the audio, not a technical hint. Reference the section's actual topic naturally rather than staying generic. Keep it to exactly one sentence.",
    "",
    "BRACKET DISCIPLINE: The \"section\" object must be closed with a single matching '}' after its last property (pre_listening_prompt). Never close it with ']' — fact_units, questions, and pre_listening_prompt must all remain nested inside the section object, not become sibling keys outside it.",
    "",
    "JSON ENFORCEMENT: Return strictly valid JSON matching the schema.",
    "{",
    '  "reasoning": {',
    '    "phase1_analysis": "your phase 1 findings here",',
    '    "phase2_planning": "your phase 2 outline here",',
    '    "phase3_implementation": "your phase 3 outline here"',
    "  },",
    '  "plan": {',
    '    "cefr_level": "A1-C2",',
    '    "section_count": 3,',
    '    "sections": [',
    '      { "section_index": 0, "cefr_level": "A1-C2", "topic": "topic name 1", "question_types": ["fill_blank"] },',
    '      { "section_index": 1, "cefr_level": "A1-C2", "topic": "topic name 2", "question_types": ["multiple_choice"] },',
    '      { "section_index": 2, "cefr_level": "A1-C2", "topic": "topic name 3", "question_types": ["true_false"] }',
    '    ]',
    "  },",
    '  "section": {',
    '    "topic": "topic name 1",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement 1" },',
    '      { "id": "fact_1", "text": "fact statement 2" },',
    '      { "id": "fact_2", "text": "fact statement 3" },',
    '      { "id": "fact_3", "text": "fact statement 4" },',
    '      { "id": "fact_4", "text": "fact statement 5" }',
    "    ],",
    '    "questions": [',
    '      { "id": "q_0", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": ["variant1"], "sub_skill": "detail", "testing_fact_unit_id": "fact_0" },',
    '      { "id": "q_1", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": [], "sub_skill": "paraphrase-recognition", "testing_fact_unit_id": "fact_1" },',
    '      { "id": "q_2", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "correct_word", "accepted_variants": [], "sub_skill": "detail", "testing_fact_unit_id": "fact_2" },',
    '      { "id": "q_3", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "word", "accepted_variants": [], "sub_skill": "detail", "testing_fact_unit_id": "fact_3" },',
    '      { "id": "q_4", "question_type": "fill_blank", "question_text": "text containing [blank]", "answer": "word", "accepted_variants": [], "sub_skill": "paraphrase-recognition", "testing_fact_unit_id": "fact_4" }',
    "    ],",
    '    "pre_listening_prompt": "one natural sentence here"',
    "  }",
    "}"
  ].join("\n");
}

const SUB_SKILLS_BY_QUESTION_TYPE: Record<string, string[]> = {
  fill_blank: ["detail", "paraphrase-recognition"],
  multiple_choice: ["detail", "inference", "paraphrase-recognition", "speaker-attitude"],
  true_false: ["gist", "inference"],
};

function buildWeakSubSkillLine(
  weakSubSkill: string | null | undefined,
  questionType: string
): string | null {
  if (!weakSubSkill) return null;
  const validForType = SUB_SKILLS_BY_QUESTION_TYPE[questionType] || [];
  if (!validForType.includes(weakSubSkill)) return null;
  return `The learner has recently shown comparatively weaker performance on "${weakSubSkill}"-type questions. Where it fits naturally with the section's content and the SUB-SKILL TAGGING rules above, lean toward tagging more of this section's questions as "${weakSubSkill}" — but do not force it onto content where it doesn't genuinely apply, and do not sacrifice question quality or natural phrasing to hit this preference.`;
}

/**
 * Builds the user prompt for Section 1 generation.
 */
export function buildSection1UserPrompt(
  cefrLevel: string,
  sectionCount: number,
  isPlacement: boolean,
  historySummary?: string,
  weakSubSkill?: string | null,
  assignedTopics?: Array<{ domainId: string; topic: string }>
): string {
  const weakSubSkillLine = buildWeakSubSkillLine(weakSubSkill, "fill_blank");
  const assignedTopicsLine =
    assignedTopics && assignedTopics.length > 0
      ? `Section topics are pre-assigned and MUST be used exactly as given for the 'topic' field of the corresponding section — do not substitute, reinterpret, or rephrase them: Section 0 (fill_blank): '${assignedTopics[0]?.topic ?? ""}'. Section 1 (multiple_choice): '${assignedTopics[1]?.topic ?? ""}'. Section 2 (true_false): '${assignedTopics[2]?.topic ?? ""}'.`
      : null;
  const lines = [
    "Generate Listening Exercise StartSession.",
    `Requested CEFR Level: ${cefrLevel}`,
    `Section Count: ${sectionCount}`,
    `Is Placement Session: ${isPlacement}`,
    historySummary ? `Previous Session History Summary:\n${historySummary}` : "No previous history available.",
    "Note on audio_script format: The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure. Make the audio script sound like natural spoken discourse (varied discourse markers like 'you know' or 'actually', mild self-paraphrasing/redundancy, and conversational sentence rhythm with occasional self-corrections).",
  ];
  if (weakSubSkillLine) lines.push(weakSubSkillLine);
  if (assignedTopicsLine) lines.push(assignedTopicsLine);
  return lines.join("\n");
}

/**
 * Builds the system prompt for subsequent sections (index >= 1) generation.
 */
export function buildNextSectionSystemPrompt(
  questionType: string,
  targetDifficulty: "easy" | "medium" | "hard",
  sectionIndex: number
): string {
  let questionsExample = "";
  let subSkillInstruction = "";

  if (questionType === "multiple_choice") {
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "multiple_choice", "question_text": "example multiple choice question", "options": ["choice1", "choice2", "choice3", "choice4"], "answer": "choice1", "sub_skill": "detail", "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "multiple_choice", "question_text": "another multiple choice question", "options": ["choice1", "choice2", "choice3", "choice4"], "answer": "choice2", "sub_skill": "inference", "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
    subSkillInstruction = [
      "SUB-SKILL TAGGING:",
      "Every question MUST include a \"sub_skill\" string property. For multiple_choice questions, the value MUST be one of:",
      "  - \"detail\": Tests recall of a specific fact stated directly in the audio.",
      "  - \"inference\": Requires reasoning beyond what is explicitly stated in the audio.",
      "  - \"paraphrase-recognition\": Requires recognizing reworded language rather than the literal phrase.",
      "  - \"speaker-attitude\": Tests understanding of the speaker's opinion, tone, or stance toward the topic. Only use this tag if the audio_script actually contains a moment of opinion or stance; do not force it onto a purely factual question.",
      "No other sub_skill value is allowed for multiple_choice questions."
    ].join("\n");
  } else if (questionType === "true_false") {
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "true_false", "question_text": "example true statement.", "answer": "True", "sub_skill": "gist", "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "true_false", "question_text": "example false statement.", "answer": "False", "sub_skill": "inference", "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
    subSkillInstruction = [
      "SUB-SKILL TAGGING:",
      "Every question MUST include a \"sub_skill\" string property. For true_false questions, the value MUST be one of:",
      "  - \"gist\": Tests overall or general understanding of the main message or theme of the passage.",
      "  - \"inference\": Requires reasoning beyond what is explicitly stated in the audio.",
      "No other sub_skill value is allowed for true_false questions."
    ].join("\n");
  } else {
    // default/fill_blank
    questionsExample = [
      '    "questions": [',
      '      { "id": "q_0", "question_type": "fill_blank", "question_text": "example [blank] question.", "answer": "correct_word", "accepted_variants": ["variant1"], "sub_skill": "detail", "testing_fact_unit_id": "fact_0" },',
      '      { "id": "q_1", "question_type": "fill_blank", "question_text": "another [blank] question.", "answer": "correct_word", "accepted_variants": [], "sub_skill": "paraphrase-recognition", "testing_fact_unit_id": "fact_1" }',
      '    ]'
    ].join("\n");
    subSkillInstruction = [
      "SUB-SKILL TAGGING:",
      "Every question MUST include a \"sub_skill\" string property. For fill_blank questions, the value MUST be one of:",
      "  - \"detail\": The blank tests recall of a fact stated directly/literally in the audio passage.",
      "  - \"paraphrase-recognition\": Answering the blank requires recognizing a reworded/synonymous version of what was said, rather than the literal phrase.",
      "No other sub_skill value is allowed for fill_blank questions."
    ].join("\n");
  }

  return [
    "You are an expert AI English academic listening content designer for the Fonetik application.",
    "Your task is to generate the next section content based on the pre-approved session generation plan.",
    "",
    "You must execute Phase 3: Implementation for this section.",
    `ADAPTIVE SECTION DURATION (section index ${sectionIndex}): this section's audio_script length is governed by the ADAPTIVE LENGTH BUDGET instruction below — it scales up with the section index to progressively train listening stamina. Do NOT use the fixed 150-200 word budget; use the budget specified later in this prompt.`,
    "The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure.",
    "The audio script MUST sound like natural spoken discourse, not an essay read aloud:",
    "  - Use discourse markers naturally and non-repetitively (e.g., 'you know', 'actually', 'I mean', 'so', 'well', 'anyway'). Vary them throughout the passage without reusing the same marker repeatedly.",
    "  - Incorporate mild redundancy by occasionally restating or rephrasing a point in slightly different words (self-paraphrase) as natural speech does, rather than stating each fact exactly once in perfectly dense prose.",
    "  - Maintain a conversational sentence rhythm using a mix of shorter and longer sentences, with occasional self-corrections (e.g., 'or rather', 'what I mean is'), while remaining fully grammatical, clear, and suitable for a listening exercise.",
    "",
    adaptiveLengthBudget(sectionIndex),
    "",
    "CRITICAL STRUCTURAL BRIDGE (FACT-UNITS BRIDGE):",
    "- You MUST write the complete passage audio_script first.",
    "- You MUST extract exactly 5 discrete, clear factual statements (fact_units) from that audio_script.",
    "- You must associate each question with the correct fact_unit_id in the testing_fact_unit_id property.",
    "",
    "CRITICAL RULE: You MUST generate exactly 5 questions. Do not generate fewer.",
    "",
    "FORMAT ENFORCEMENT: You MUST generate ALL 5 questions matching the EXACT single question format specified in the user prompt. Do not mix question formats.",
    "  - If the requested question type is 'fill_blank', all 5 questions must be 'fill_blank'.",
    "  - If the requested question type is 'multiple_choice', all 5 questions must be 'multiple_choice'.",
    "  - If the requested question type is 'true_false', all 5 questions must be 'true_false'.",
    "",
    buildDifficultyInstruction(targetDifficulty),
    "",
    "QUESTION FORMAT RULES:",
    "1. fill_blank:",
    "   - The question_text MUST contain a single '[blank]' placeholder (e.g., 'Standard sea-level pressure causes water to boil at [blank] degrees.').",
    "   - You must provide the primary correct 'answer' and a list of 'accepted_variants' (alternate spellings, numbers vs. words, etc.).",
    "2. true_false:",
    "   - The question_text MUST be a complete statement.",
    "   - The 'options' array MUST contain exactly ['True', 'False'].",
    "   - The 'answer' MUST be either 'True' or 'False'.",
    "3. multiple_choice:",
    "   - The question_text MUST be a clear question or incomplete statement.",
    "   - The 'options' array MUST contain exactly 4 distinct choices.",
    "   - The 'answer' MUST be the exact string of the correct choice from the options array.",
    "",
    subSkillInstruction,
    "",
    "PRE-LISTENING PROMPT:",
    "After you have finalized the questions array (including each question's sub_skill tag), write one additional field: \"pre_listening_prompt\" — a single natural sentence (not a list, not a technical explanation) that gives the listener a natural, implicit cue about what to pay attention to while listening, based on the sub_skill(s) most represented among this section's 5 questions. Do NOT use the words 'detail', 'inference', 'gist', 'paraphrase', 'paraphrase-recognition', 'speaker-attitude', or 'sub-skill' anywhere in this sentence — it must read like something a friendly instructor would casually say before playing the audio, not a technical hint. Reference the section's actual topic naturally rather than staying generic. Keep it to exactly one sentence.",
    "",
    "BRACKET DISCIPLINE: The \"section\" object must be closed with a single matching '}' after its last property (pre_listening_prompt). Never close it with ']' — fact_units, questions, and pre_listening_prompt must all remain nested inside the section object, not become sibling keys outside it.",
    "",
    "JSON ENFORCEMENT: Return strictly valid JSON matching the schema.",
    "{",
    '  "reasoning": {',
    '    "phase3_implementation": "your phase 3 details here"',
    "  },",
    '  "section": {',
    '    "topic": "topic name",',
    '    "audio_script": "lecture text...",',
    '    "fact_units": [',
    '      { "id": "fact_0", "text": "fact statement 1" },',
    '      { "id": "fact_1", "text": "fact statement 2" },',
    '      { "id": "fact_2", "text": "fact statement 3" },',
    '      { "id": "fact_3", "text": "fact statement 4" },',
    '      { "id": "fact_4", "text": "fact statement 5" }',
    "    ],",
    questionsExample + ",",
    '    "pre_listening_prompt": "one natural sentence here"',
    "  }",
    "}"
  ].join("\n");
}

/**
 * Builds the user prompt for subsequent sections.
 */
export function buildNextSectionUserPrompt(
  sectionIndex: number,
  cefrLevel: string,
  topic: string,
  questionTypes: string[],
  weakSubSkill?: string | null
): string {
  const questionType = questionTypes[0] || "fill_blank";
  const weakSubSkillLine = buildWeakSubSkillLine(weakSubSkill, questionType);
  const lines = [
    "Generate next section content for the session.",
    `Section Index: ${sectionIndex}`,
    `CEFR Level: ${cefrLevel}`,
    `Topic: ${topic}`,
    `Question Types: ${questionTypes.join(", ")}`,
    "Note on audio_script format: The audio script must NOT use ordinal or sequential markers (e.g., 'first', 'second', 'third', 'finally', 'lastly', 'to begin with', 'next') to structure the passage. Information must flow naturally as connected prose or natural spoken discourse — not as a numbered list read aloud. The listener must not be able to infer the number or position of key facts from the script's structure. Make the audio script sound like natural spoken discourse (varied discourse markers like 'you know' or 'actually', mild self-paraphrasing/redundancy, and conversational sentence rhythm with occasional self-corrections).",
  ];
  if (weakSubSkillLine) lines.push(weakSubSkillLine);
  return lines.join("\n");
}
