import { NextResponse } from "next/server";
import { testHooks } from "../stt/route-test-hooks";

export const runtime = "nodejs";

async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

const DEFAULT_DEEPGRAM_WS_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&encoding=linear16&sample_rate=16000&interim_results=true";

export async function GET() {
  const userId = await resolveCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Live speech-to-text is not configured. Falling back to recording-based transcription." },
      { status: 503 }
    );
  }

  const baseUrl = (
    process.env.DEEPGRAM_WEBSOCKET_URL?.trim() || DEFAULT_DEEPGRAM_WS_URL
  ).replace(/\?$/, "");

  const separator = baseUrl.includes("?") ? "&" : "?";
  const wsUrl = `${baseUrl}${separator}access_token=${encodeURIComponent(apiKey)}`;

  return NextResponse.json(
    { wsUrl, encoding: "linear16", sampleRate: 16000 },
    { status: 200 }
  );
}
