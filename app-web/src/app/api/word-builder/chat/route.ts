import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";

export const runtime = "nodejs";

// Helper to call DeepSeek with retry logic on 5xx or timeout
async function callDeepSeekWithRetry(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
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
          temperature: 0.3,
          max_tokens: 800,
          messages: messages,
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
    // 1. Auth check
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

    const { sessionId, message, sessionContext } = body;

    // Validation
    if (!sessionId || !message) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: "message_too_long" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    // 2. Verify session belongs to userId
    const { data: sessionData, error: sessionError } = await supabase
      .from("word_builder_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Load existing chat history
    const { data: chatHistory, error: chatError } = await supabase
      .from("word_builder_chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (chatError) {
      console.error("DB error loading chat history:", chatError);
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    // 4. Save user message to word_builder_chat_messages
    const { error: saveUserMsgError } = await supabase
      .from("word_builder_chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: message
      });

    if (saveUserMsgError) {
      console.error("DB error saving user message:", saveUserMsgError);
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    // 5. Build context string from sessionContext
    let contextParts: string[] = [];
    const completedPrompts = sessionContext?.completedPrompts || [];
    const currentPromptText = sessionContext?.currentPromptText || "";

    if (completedPrompts.length > 0) {
      contextParts.push("COMPLETED PROMPTS:");
      completedPrompts.forEach((cp: any, index: number) => {
        const errorInfo = (cp.errors || [])
          .map((e: any) => `- Category: ${e.category}. Rule: ${e.ruleReference}`)
          .join("\n");
        contextParts.push(
          `Attempt ${index + 1}:\n` +
          `- Prompt Text: ${cp.promptText || "N/A"}\n` +
          `- Learner's Sentence: ${cp.userSentence || "N/A"}\n` +
          `- Corrected Sentence: ${cp.correctedSentence || "N/A"}\n` +
          `- Errors Found:\n${errorInfo || "None"}\n` +
          `- Learner's Self-Analysis: ${cp.userAnalysis || "N/A"}`
        );
      });
    }

    if (currentPromptText) {
      contextParts.push(`CURRENT PROMPT TEXT:\n${currentPromptText}`);
    }

    const contextString = contextParts.join("\n\n");

    const systemPrompt = `You are an English language learning assistant embedded in a grammar practice session. Your role is to help the learner understand English grammar, vocabulary, sentence structure, and usage.

CONTEXT: You have access to the learner's current session — the prompts they are working on, the sentences they wrote, the errors detected, and their self-analyses. Use this context to give relevant, specific answers.

BEHAVIORAL RULES:
1. You may ONLY discuss topics related to English language learning: grammar rules, vocabulary, sentence structure, usage patterns, pronunciation concepts, idiomatic expressions, and linguistic concepts.
2. If the learner asks about anything unrelated to English language learning, respond with: "I can only assist with English language learning topics in this session."
3. You may use knowledge from any domain to explain English concepts — for example, using economics concepts to explain how a sentence about inflation should be structured. The constraint is on what you discuss, not on what knowledge you draw from.
4. Be direct and precise. Do not pad responses with affirmations or filler phrases.
5. Keep responses concise — maximum 3-4 paragraphs unless a detailed explanation is genuinely needed.
6. You may reference the learner's specific sentences and errors from the session context.`;

    // Build messages array
    const historyMessages = (chatHistory || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    const messagesToSend = [
      {
        role: "system",
        content: systemPrompt + "\n\nSESSION CONTEXT:\n" + contextString
      },
      ...historyMessages,
      {
        role: "user",
        content: message
      }
    ];

    // 6. Call DeepSeek
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
    }

    const result = await callDeepSeekWithRetry(apiKey, messagesToSend);
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
    }

    const responseData = result.data;
    const assistantResponse = responseData.choices?.[0]?.message?.content || "";

    // 7. Save assistant response to word_builder_chat_messages
    const { data: savedAssistantMsg, error: saveAssistantError } = await supabase
      .from("word_builder_chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: assistantResponse
      })
      .select("id")
      .single();

    if (saveAssistantError || !savedAssistantMsg) {
      console.error("DB error saving assistant response:", saveAssistantError);
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    // 8. Return response
    return NextResponse.json({
      reply: assistantResponse,
      messageId: savedAssistantMsg.id
    });
  } catch (error: any) {
    console.error("Word Builder Chat Route Error:", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
