// =============================================================================
// app-web/src/app/api/word-builder/_lib/providers.ts
// Provider abstraction for Word Builder AI calls.
// Currently only DeepSeek is implemented. To add a new provider,
// implement the WordBuilderAIProvider interface and register it below.
// =============================================================================

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  isCorrect: boolean;
  errors: Array<{
    errorId: string;
    category: string;
    severity: string;
    locationHint: string;
    ruleReference: string;
    guidedCompletion: string;
    resolved: boolean;
  }>;
  correctedSentence: string;
  recommendedSentences?: string[];
  echoPrompt: string;
  highlightedWords: Array<{ word: string; rule: string }>;
}

export interface AnalysisResult {
  isCorrect: boolean;
  feedback: string;
  correctElements: string[];
  incorrectElements: string[];
  modelAnalysis: string;
}

export interface WordBuilderAIProvider {
  evaluate(sentence: string, promptText: string, impliedStructures: string[]): Promise<EvaluationResult>;
  analyze(userSentence: string, correctedSentence: string, userAnalysis: string, errors: Array<{ category: string; locationHint: string; ruleReference: string }>): Promise<AnalysisResult>;
  chat(messages: Array<{ role: string; content: string }>, sessionContext: string): Promise<string>;
}

// ─── DeepSeek Provider ───────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.DEEPSEEK_API_KEY ?? null;
}

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const { temperature = 0, maxTokens = 1000, jsonMode = false } = options;

  const body: Record<string, any> = {
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) continue;
        throw new Error(`DeepSeek returned ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      lastError = err;
      if (err.name === "AbortError" && attempt === 0) continue;
      throw err;
    }
  }

  throw lastError || new Error("DeepSeek request failed");
}

async function callDeepSeekMulti(
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const { temperature = 0, maxTokens = 1000, jsonMode = false } = options;

  const body: Record<string, any> = {
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature,
    max_tokens: maxTokens,
    messages,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) continue;
        throw new Error(`DeepSeek returned ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      lastError = err;
      if (err.name === "AbortError" && attempt === 0) continue;
      throw err;
    }
  }

  throw lastError || new Error("DeepSeek request failed");
}

function extractJson(text: string): any {
  let clean = text.trim();
  if (clean.startsWith("```")) {
    const lines = clean.split("\n");
    const start = lines.findIndex((l) => l.includes("{"));
    const end = [...lines].reverse().findIndex((l) => l.includes("}"));
    if (start !== -1 && end !== -1) {
      clean = lines.slice(start, lines.length - end).join("\n");
    }
  }
  return JSON.parse(clean);
}

const deepseekProvider: WordBuilderAIProvider = {
  async evaluate(sentence, promptText, impliedStructures): Promise<EvaluationResult> {
    const systemPrompt = `You are a grammar evaluation engine for an English language learning app. Your job is to evaluate English sentences written by Indonesian learners and return structured error data.

CRITICAL RULES:
1. Return ONLY valid JSON. No preamble, no explanation, no markdown formatting, no backticks.
2. Evaluate all of these dimensions simultaneously: subject-verb agreement, auxiliary verb presence and correctness, tense consistency, article usage, preposition correctness, word order, verb form.
3. For locationHint: be vague about location only. Never name the grammatical rule. Never reveal the correction. Example of GOOD locationHint: "There is an issue with the verb used after the modal in your sentence." Example of BAD locationHint: "You need to use a bare infinitive after 'will'."
4. For ruleReference: state the rule clearly and explicitly, but do not show the correction applied to the learner's sentence.
5. For guidedCompletion: reproduce the learner's sentence with the ONE most critical error replaced by a blank (___). Do not blank out multiple words.
6. For echoPrompt: generate a new prompt on a different topic that would naturally require the same grammar structures as the errors found. If no errors, generate a prompt on a related topic.
7. If the sentence is correct, return isCorrect: true, errors: [], correctedSentence as the original sentence, and a new echoPrompt anyway.
8. correctedSentence must be the fully corrected version of the learner's input — not a model answer, but the learner's own sentence with all errors fixed.
9. CRITICAL: The correctedSentence field MUST contain ALL sentences from the user's input. Never remove, omit, or merge sentences. Only fix grammatical errors.

RESPONSE FORMAT:
{"isCorrect":boolean,"errors":[{"errorId":"err_1","category":"auxiliary_verb|subject_verb_agreement|tense|article|preposition|word_order|verb_form","severity":"critical|minor","locationHint":"string","ruleReference":"string","guidedCompletion":"string","resolved":false}],"correctedSentence":"string","recommendedSentences":["string"],"echoPrompt":"string","highlightedWords":[{"word":"string","rule":"string"}]}

Rules for recommendedSentences:
- 1-3 alternative versions of the corrected sentence that sound more natural in academic English.
- If the correctedSentence is already very natural, return 1 alternative only.
- Each alternative must preserve the original meaning.

Rules for highlightedWords:
- Include every word or short phrase in the user sentence that contains an error
- "word" must be the exact token as it appears in the user sentence
- "rule" must be a general grammatical rule statement — not specific to this sentence
- If isCorrect is true, highlightedWords must be an empty array`;

    const userMessage = `EXAMPLES OF CORRECT EVALUATION:

Input sentence: "the technology development changing how we learn, work, and shop."
Prompt: "Describe how a technology you use every day has changed the way people work or communicate."
Expected output:
{"isCorrect":false,"errors":[{"errorId":"err_1","category":"auxiliary_verb","severity":"critical","locationHint":"There is something missing between the subject and the main verb in your sentence.","ruleReference":"In English, continuous tenses require an auxiliary 'be' verb before the -ing form. The form of 'be' must agree with the subject.","guidedCompletion":"The technology development ___ changing how we learn, work, and shop.","resolved":false}],"correctedSentence":"The technology development is changing how we learn, work, and shop.","echoPrompt":"Describe what is currently happening to job markets as automation becomes more common."}

Input sentence: "when inflation happen the price will be increasing then it will be impact household."
Prompt: "Describe what happens to consumer purchasing power when inflation rises faster than wages."
Expected output:
{"isCorrect":false,"errors":[{"errorId":"err_1","category":"subject_verb_agreement","severity":"critical","locationHint":"There is an issue with the verb form used directly after the subject in your first clause.","ruleReference":"Singular nouns in third person require the verb to end in -s in simple present tense.","guidedCompletion":"when inflation ___ the price will be increasing then it will be impact household.","resolved":false},{"errorId":"err_2","category":"auxiliary_verb","severity":"critical","locationHint":"There is an issue with the verb structure in the final clause of your sentence.","ruleReference":"Modal verbs like 'will' are always followed by the bare infinitive.","guidedCompletion":"when inflation happens the price will be increasing then it will ___ impact household.","resolved":false}],"correctedSentence":"When inflation happens, the price will increase and it will impact households.","echoPrompt":"Explain what happens to a country's currency value when its inflation rate is higher than its trading partners."}

Now evaluate this sentence:
Prompt: ${promptText}
Sentence: ${sentence}`;

    const response = await callDeepSeek(systemPrompt, userMessage, {
      temperature: 0,
      maxTokens: 1000,
      jsonMode: true,
    });

    const result = extractJson(response);
    if (!Array.isArray(result.highlightedWords)) {
      result.highlightedWords = [];
    }
    return result as EvaluationResult;
  },

  async analyze(userSentence, correctedSentence, userAnalysis, errors): Promise<AnalysisResult> {
    const systemPrompt = `You are a grammar analysis evaluator. Your function is to assess whether a learner's self-analysis of their grammar error is accurate.

EVALUATION RULES:
1. Evaluate whether the user identified and explained the specific grammatical rule that makes the corrected sentence correct — not whether their statement is literally true.
2. If the user's response does not contain a grammatical explanation, mark it as insufficient (isCorrect: false) and specify what explanation was expected.
3. Reference the actual grammar rule from the errors list in all feedback.
4. Tone: mechanical, non-affirmative, objective. No praise, no softening.
5. Never use phrases like: "Good observation", "You're on the right track", "Great attempt", "Nice try".

RESPONSE FORMAT:
Return ONLY valid JSON matching this schema:
{"isCorrect":boolean,"feedback":"string","correctElements":["string"],"incorrectElements":["string"],"modelAnalysis":"string"}

For modelAnalysis: explain the grammatical role of the incorrect words in the sentence, why that role is wrong, and what the correct structure should be.`;

    const userMessage = `Original sentence: ${userSentence}
Corrected sentence: ${correctedSentence}
Grammar errors detected: ${JSON.stringify(errors)}
Learner's analysis: ${userAnalysis}
Evaluate whether the learner's analysis correctly identifies the grammatical error and explains it accurately.`;

    const response = await callDeepSeek(systemPrompt, userMessage, {
      temperature: 0,
      maxTokens: 1000,
      jsonMode: true,
    });

    return extractJson(response) as AnalysisResult;
  },

  async chat(messages, sessionContext): Promise<string> {
    const systemPrompt = `You are an English language learning assistant embedded in a grammar practice session. Your role is to help the learner understand English grammar, vocabulary, sentence structure, and usage.

CONTEXT: You have access to the learner's current session — the prompts they are working on, the sentences they wrote, the errors detected, and their self-analyses. Use this context to give relevant, specific answers.

BEHAVIORAL RULES:
1. You may ONLY discuss topics related to English language learning: grammar rules, vocabulary, sentence structure, usage patterns, pronunciation concepts, idiomatic expressions, and linguistic concepts.
2. If the learner asks about anything unrelated to English language learning, respond with: "I can only assist with English language learning topics in this session."
3. You may use knowledge from any domain to explain English concepts.
4. Be direct and precise. Do not pad responses with affirmations or filler phrases.
5. Keep responses concise — maximum 3-4 paragraphs unless a detailed explanation is genuinely needed.
6. You may reference the learner's specific sentences and errors from the session context.`;

    const fullSystemPrompt = systemPrompt + "\n\nSESSION CONTEXT:\n" + sessionContext;

    const allMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages,
    ];

    return await callDeepSeekMulti(allMessages, {
      temperature: 0.3,
      maxTokens: 800,
    });
  },
};

// ─── Provider Resolution ─────────────────────────────────────────────────────

const providerName = process.env.WORD_BUILDER_AI_PROVIDER || "deepseek";

export function getAIProvider(): WordBuilderAIProvider {
  // Future: add cases for other providers here
  switch (providerName) {
    case "deepseek":
    default:
      return deepseekProvider;
  }
}
