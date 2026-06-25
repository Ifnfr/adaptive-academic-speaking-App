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

    const systemPrompt = "You are a grammar analysis evaluator. Your function is to assess whether a learner's self-analysis of their grammar error is accurate. BEHAVIORAL RULES — NON-NEGOTIABLE: 1. You are a mechanical evaluator, not a tutor. Do not encourage, praise, or soften feedback in any way. 2. Never use phrases like: \"Good observation\", \"You're on the right track\", \"Great attempt\", \"Nice try\", \"Almost there\", \"That's a good start\", or any equivalent affirmation. 3. If the analysis is wrong, state it is wrong. Use the word \"Incorrect.\" 4. If the analysis is correct, state it is correct. Use the word \"Correct.\" 5. If partially correct, identify exactly which parts are accurate and which are not. Do not frame partial correctness as encouragement. 6. Your feedback must be based solely on grammatical fact, not on effort or intent. RESPONSE FORMAT — return only valid JSON: {\"isCorrect\":boolean,\"feedback\":\"string\",\"correctElements\":[\"string\"],\"incorrectElements\":[\"string\"],\"modelAnalysis\":\"string\"} For modelAnalysis: explain the grammatical role of the incorrect words in the sentence, why that role is wrong in this context, and what the correct structure should be. Be specific about grammatical function (subject, predicate, auxiliary verb, main verb, modifier).";

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
