import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const FALLBACK_TIPS = [
  "Focus on slowing down your speech to monitor grammatical accuracy and word choice.",
  "Record your practice sessions and listen back to identify specific areas of improvement.",
  "Drill target sentence patterns repeatedly until they feel natural and automatic."
];

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

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

async function callDeepSeek(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `DeepSeek API error ${res.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(`DeepSeek API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const ownerId = await resolveCurrentUserId();
    if (!ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request payload
    const body = await req.json();
    const { weaknessText } = body as { weaknessText?: string };
    if (!weaknessText || !weaknessText.trim()) {
      return NextResponse.json({ tips: FALLBACK_TIPS });
    }

    const trimmedWeakness = weaknessText.trim();

    // 3. Cache lookup
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: cacheData, error: cacheError } = await supabase
          .from("contextual_tips_cache")
          .select("tips")
          .eq("owner_id", ownerId)
          .eq("weakness_key", trimmedWeakness)
          .gte("created_at", sevenDaysAgo)
          .maybeSingle();

        if (cacheError) {
          console.error("Supabase cache read error:", cacheError);
        } else if (cacheData && Array.isArray(cacheData.tips)) {
          return NextResponse.json({ tips: cacheData.tips });
        }
      } catch (err) {
        console.error("Cache lookup failure:", err);
      }
    }

    // 4. AI Generation (DeepSeek)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn("DEEPSEEK_API_KEY is not configured. Returning fallback tips.");
      return NextResponse.json({ tips: FALLBACK_TIPS });
    }

    const systemPrompt =
      "You are an English speaking coach. Given a learner's weakness, " +
      "generate exactly 3 short, actionable practice tips. " +
      "Each tip must be 1 sentence, under 20 words. " +
      "Respond ONLY with a JSON array of 3 strings. " +
      "No preamble, no explanation, no markdown.";

    const userPrompt = `Weakness: ${trimmedWeakness}`;

    let tips: string[] = [];
    try {
      const content = await callDeepSeek(apiKey, systemPrompt, userPrompt);
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        tips = parsed.slice(0, 3).map(String);
      } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.tips)) {
        tips = parsed.tips.slice(0, 3).map(String);
      }
    } catch (err) {
      console.error("DeepSeek generation/parsing failed, using fallback:", err);
    }

    if (tips.length < 3) {
      tips = FALLBACK_TIPS;
    }

    // 5. Save to cache
    if (supabase && tips !== FALLBACK_TIPS) {
      try {
        const { error: insertError } = await supabase
          .from("contextual_tips_cache")
          .insert({
            owner_id: ownerId,
            weakness_key: trimmedWeakness,
            tips: tips,
          });
        if (insertError) {
          console.error("Failed to write to contextual_tips_cache:", insertError);
        }
      } catch (err) {
        console.error("Cache write failure:", err);
      }
    }

    return NextResponse.json({ tips });
  } catch (err) {
    console.error("Unhandled error in contextual-tips route:", err);
    return NextResponse.json({ tips: FALLBACK_TIPS });
  }
}
