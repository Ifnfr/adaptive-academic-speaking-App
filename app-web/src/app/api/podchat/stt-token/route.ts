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

// Ephemeral keys live for this many seconds (Deepgram max is 3600).
const EPHEMERAL_KEY_TTL_SECONDS = 600;

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

  // SECURITY: never hand the project API key to the browser. Create a
  // short-lived ephemeral key server-side and return only that.
  let ephemeralKey: string;
  try {
    const res = await fetch("https://api.deepgram.com/v1/keys", {
      method: "POST",
      headers: {
        authorization: `Token ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        comment: "fonetik-podchat-live-stt",
        scopes: ["usage"],
        expiration: EPHEMERAL_KEY_TTL_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`Deepgram ephemeral key request failed with status ${res.status}`);
      throw new Error("ephemeral key request failed");
    }
    const data = (await res.json()) as { key?: unknown };
    if (typeof data.key !== "string" || data.key.trim().length === 0) {
      console.error("Deepgram ephemeral key response is missing the key field");
      throw new Error("missing key in ephemeral key response");
    }
    ephemeralKey = data.key.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected Deepgram ephemeral key error: ${message}`);
    return NextResponse.json(
      { error: "Live speech-to-text is not configured. Falling back to recording-based transcription." },
      { status: 503 }
    );
  }

  const baseUrl = (
    process.env.DEEPGRAM_WEBSOCKET_URL?.trim() || DEFAULT_DEEPGRAM_WS_URL
  ).replace(/\?$/, "");

  const separator = baseUrl.includes("?") ? "&" : "?";
  const wsUrl = `${baseUrl}${separator}access_token=${encodeURIComponent(ephemeralKey)}`;

  return NextResponse.json(
    { wsUrl, encoding: "linear16", sampleRate: 16000 },
    { status: 200 }
  );
}
