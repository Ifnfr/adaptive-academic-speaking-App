import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Temporary debug endpoint: calls DeepSeek with the same shape as the
// article-practice route and returns the RAW response text so we can see
// why parsing fails in production. DELETE after diagnosis.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const user = body.user || "Say hi in one word.";
  const system =
    body.system ||
    "You are an academic speaking coach. Respond with ONLY a JSON object. No markdown.";

  const res = await fetch(
    process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
  );

  const raw = await res.text();
  return NextResponse.json({
    status: res.status,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "(fallback)",
    model: process.env.DEEPSEEK_MODEL || "(fallback)",
    hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
    rawLength: raw.length,
    rawHead: raw.slice(0, 800),
  });
}
