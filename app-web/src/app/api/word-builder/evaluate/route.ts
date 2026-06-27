import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/word-builder/rate-limit";

export const runtime = "nodejs";

// Helper function to resolve Clerk authentication
async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

// Helper to initialize Supabase service client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

// Helper to call DeepSeek with retry logic on 5xx or timeout
async function callDeepSeekWithRetry(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxRetries = 2
): Promise<{ ok: boolean; data?: any; status?: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0,
          max_tokens: 1000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return { ok: true, data };
      }

      // Retry on 5xx
      if (response.status >= 500 && attempt < maxRetries - 1) {
        continue;
      }

      return { ok: false, status: response.status };
    } catch (err: any) {
      // Retry on abort/timeout
      if (err.name === "AbortError" && attempt < maxRetries - 1) {
        continue;
      }
      return { ok: false, status: 503 };
    }
  }
  return { ok: false, status: 503 };
}

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limit Check
    const { allowed } = checkRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429 }
      );
    }

    // 2. Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sentence, promptId, promptText } = body;
    if (!sentence || !promptId || !promptText) {
      return NextResponse.json(
        { error: "Missing required fields: sentence, promptId, or promptText" },
        { status: 400 }
      );
    }

    // Guard 1 — Sentence too short
    if (sentence.trim().split(/\s+/).filter(Boolean).length < 3) {
      return NextResponse.json({ error: "sentence_too_short" }, { status: 400 });
    }

    // 3. Fetch prompt metadata (implied structures) from Supabase
    const supabase = getSupabaseClient();
    let impliedStructures: string[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("word_builder_prompts")
          .select("implied_structures")
          .eq("id", promptId)
          .single();

        if (!error && data) {
          if (Array.isArray(data.implied_structures)) {
            impliedStructures = data.implied_structures;
          } else if (typeof data.implied_structures === "string") {
            try {
              impliedStructures = JSON.parse(data.implied_structures);
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch implied structures:", err);
      }
    }

    // 4. Call DeepSeek API
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI provider is currently unconfigured" },
        { status: 503 }
      );
    }

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
9. CRITICAL: The correctedSentence field MUST contain ALL sentences from the user's input. Never remove, omit, or merge sentences. Only fix grammatical errors. If the user wrote 2 sentences, correctedSentence must have 2 sentences. If the user wrote 3 sentences, correctedSentence must have 3 sentences. Sentence count must match exactly.

RESPONSE FORMAT:
{"isCorrect":boolean,"errors":[{"errorId":"err_1","category":"auxiliary_verb|subject_verb_agreement|tense|article|preposition|word_order|verb_form","severity":"critical|minor","locationHint":"string","ruleReference":"string","guidedCompletion":"string","resolved":false}],"correctedSentence":"string","recommendedSentences":["string"],"echoPrompt":"string","highlightedWords":[{"word":"string","rule":"string"}]}

Rules for recommendedSentences:
- An array of 1-3 alternative versions of the corrected sentence that sound more natural in academic English.
- Each alternative must be grammatically correct AND more natural/idiomatic than the correctedSentence.
- If the correctedSentence is already very natural, return 1 alternative only. Never return more than 3.
- Each alternative must preserve the original meaning.
- Do NOT add praise or explanations — return only the sentence strings.

Rules for highlightedWords:
- Include every word or short phrase in the user sentence that contains an error
- "word" must be the exact token as it appears in the user sentence
- "rule" must be a general grammatical rule statement — not specific to this sentence, not revealing the correction. Example: "Third-person singular subjects require the verb to end in -s in simple present tense." NOT "Change 'happen' to 'happens'."
- If isCorrect is true, highlightedWords must be an empty array`;

    const userMessage = `EXAMPLES OF CORRECT EVALUATION:

Input sentence: "the technology development changing how we learn, work, and shop."
Prompt: "Describe how a technology you use every day has changed the way people work or communicate."
Expected output:
{"isCorrect":false,"errors":[{"errorId":"err_1","category":"auxiliary_verb","severity":"critical","locationHint":"There is something missing between the subject and the main verb in your sentence.","ruleReference":"In English, continuous tenses require an auxiliary 'be' verb before the -ing form. The form of 'be' must agree with the subject.","guidedCompletion":"The technology development ___ changing how we learn, work, and shop.","resolved":false}],"correctedSentence":"The technology development is changing how we learn, work, and shop.","echoPrompt":"Describe what is currently happening to job markets as automation becomes more common."}

Input sentence: "when inflation happen the price will be increasing then it will be impact household."
Prompt: "Describe what happens to consumer purchasing power when inflation rises faster than wages."
Expected output:
{"isCorrect":false,"errors":[{"errorId":"err_1","category":"subject_verb_agreement","severity":"critical","locationHint":"There is an issue with the verb form used directly after the subject in your first clause.","ruleReference":"Singular nouns in third person require the verb to end in -s in simple present tense. For example: 'inflation happens', not 'inflation happen'.","guidedCompletion":"when inflation ___ the price will be increasing then it will be impact household.","resolved":false},{"errorId":"err_2","category":"auxiliary_verb","severity":"critical","locationHint":"There is an issue with the verb structure in the final clause of your sentence.","ruleReference":"Modal verbs like 'will' are always followed by the bare infinitive — the base form of the verb. Do not add 'be' between 'will' and a base verb.","guidedCompletion":"when inflation happens the price will be increasing then it will ___ impact household.","resolved":false}],"correctedSentence":"When inflation happens, the price will increase and it will impact households.","echoPrompt":"Explain what happens to a country's currency value when its inflation rate is higher than its trading partners."}

Now evaluate this sentence:
Prompt: ${promptText}
Sentence: ${sentence}`;

    // Call DeepSeek with retry
    const result = await callDeepSeekWithRetry(apiKey, systemPrompt, userMessage);

    if (!result.ok || !result.data) {
      return NextResponse.json(
        { error: `DeepSeek API request failed with status ${result.status}` },
        { status: 502 }
      );
    }

    const responseData = result.data as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const textResponse = responseData.choices?.[0]?.message?.content || "";

    // 5. Parse and return DeepSeek's response
    try {
      let cleanText = textResponse.trim();
      if (cleanText.startsWith("```")) {
        const lines = cleanText.split("\n");
        const jsonStartIndex = lines.findIndex(line => line.includes("{"));
        const jsonEndIndex = lines.map(line => line.trim()).lastIndexOf("}");
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
          cleanText = lines.slice(jsonStartIndex, jsonEndIndex + 1).join("\n");
        }
      }

      const evaluationData = JSON.parse(cleanText);
      if (!Array.isArray(evaluationData.highlightedWords)) {
        evaluationData.highlightedWords = [];
      }
      return NextResponse.json(evaluationData);
    } catch (parseError) {
      console.error("Failed to parse DeepSeek evaluation response:", textResponse, parseError);
      return NextResponse.json(
        { error: "Failed to parse AI evaluation data response" },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Word Builder Evaluate Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
