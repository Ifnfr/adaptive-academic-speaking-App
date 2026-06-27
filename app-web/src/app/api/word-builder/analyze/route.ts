import { NextResponse } from "next/server";

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
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userSentence, correctedSentence, userAnalysis, errors } = body;

    // Validate fields exist
    if (
      userSentence === undefined ||
      correctedSentence === undefined ||
      userAnalysis === undefined ||
      errors === undefined
    ) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Validate userAnalysis length
    if (typeof userAnalysis !== "string" || userAnalysis.trim().length < 10) {
      return NextResponse.json({ error: "analysis_too_short" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI provider is currently unconfigured" },
        { status: 503 }
      );
    }

    const systemPrompt = `You are a grammar analysis evaluator. Your function is to assess whether a learner's self-analysis of their grammar error is accurate.

EVALUATION RULES:
1. Evaluate whether the user identified and explained the specific grammatical rule that makes the corrected sentence correct — not whether their statement is literally true. For example, if the user writes "I don't know" or "I made a mistake", do not mark it as correct or sufficient just because it is a true statement.
2. If the user's response does not contain a grammatical explanation (e.g., "I don't know", vague answers, irrelevant statements), mark it as insufficient (isCorrect: false) and specify what explanation was expected.
3. Reference the actual grammar rule from the errors list rule references in all feedback so the user knows what they were supposed to explain.
4. Tone: mechanical, non-affirmative, objective. No praise, no softening.
5. Never use phrases like: "Good observation", "You're on the right track", "Great attempt", "Nice try", "Almost there", "That's a good start", or any equivalent affirmation.

RESPONSE FORMAT:
Return ONLY valid JSON matching this schema:
{"isCorrect":boolean,"feedback":"string","correctElements":["string"],"incorrectElements":["string"],"modelAnalysis":"string"}

For modelAnalysis: explain the grammatical role of the incorrect words in the sentence, why that role is wrong in this context, and what the correct structure should be. Be specific about grammatical function (subject, predicate, auxiliary verb, main verb, modifier).`;

    const userMessage = `Original sentence: ${userSentence}
Corrected sentence: ${correctedSentence}
Grammar errors detected: ${JSON.stringify(errors)}
Learner's analysis: ${userAnalysis}
Evaluate whether the learner's analysis correctly identifies the grammatical error and explains it accurately.`;

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

    try {
      let cleanText = textResponse.trim();
      if (cleanText.startsWith("```")) {
        const lines = cleanText.split("\n");
        const jsonStartIndex = lines.findIndex((line) => line.includes("{"));
        const jsonEndIndex = lines.map((line) => line.trim()).lastIndexOf("}");
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
          cleanText = lines.slice(jsonStartIndex, jsonEndIndex + 1).join("\n");
        }
      }

      const evaluationData = JSON.parse(cleanText);
      return NextResponse.json(evaluationData);
    } catch (parseError) {
      console.error("Failed to parse DeepSeek analyze response:", textResponse, parseError);
      return NextResponse.json(
        { error: "Failed to parse AI evaluation data response" },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Word Builder Analyze Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
