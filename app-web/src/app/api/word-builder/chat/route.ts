import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";
import { checkRateLimit } from "@/lib/word-builder/rate-limit";
import { getAIProvider } from "../_lib/providers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Auth check
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limit Check
    const supabase = getSupabaseClient();
    const { allowed } = await checkRateLimit(supabase, userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429 }
      );
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

    // 4. Save user message
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

    // 5. Build context string
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

    // 6. Build messages for AI (history + current)
    const historyMessages = (chatHistory || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    const messagesToSend = [
      ...historyMessages,
      { role: "user", content: message },
    ];

    // 7. Call AI provider
    let assistantResponse: string;
    try {
      const provider = getAIProvider();
      assistantResponse = await provider.chat(messagesToSend, contextString);
    } catch (error: any) {
      console.error("Word Builder Chat AI Error:", error);
      return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
    }

    // 8. Save assistant response
    const { data: savedAssistantMsg, error: saveAssistantError } = await supabase
      .from("word_builder_chat_messages")
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: assistantResponse,
      })
      .select("id")
      .single();

    if (saveAssistantError || !savedAssistantMsg) {
      console.error("DB error saving assistant response:", saveAssistantError);
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    // 9. Return response
    return NextResponse.json({
      reply: assistantResponse,
      messageId: savedAssistantMsg.id,
    });
  } catch (error: any) {
    console.error("Word Builder Chat Route Error:", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
