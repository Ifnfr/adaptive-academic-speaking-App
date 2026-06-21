import { NextResponse } from "next/server";
import { checkTranscriptQuality } from "../../../lib/podchat/transcriptQuality";
import { testHooks } from "./route-test-hooks";

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

const MAX_AUDIO_SIZE = 2 * 1024 * 1024; // 2 MB
const VALID_MIME_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

function normalizeAudioMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase().split(";")[0].trim();
}

export async function POST(request: Request) {
  const userId = await resolveCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Malformed multipart form data." },
      { status: 400 }
    );
  }

  const audio = formData.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "audio field is required and must be a valid file." },
      { status: 400 }
    );
  }

  if (audio.size === 0) {
    return NextResponse.json(
      { error: "audio file must not be empty." },
      { status: 400 }
    );
  }

  if (audio.size > MAX_AUDIO_SIZE) {
    return NextResponse.json(
      { error: "audio file must not exceed 2 MB." },
      { status: 400 }
    );
  }

  const mimeType = normalizeAudioMimeType(audio.type);
  if (!VALID_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Invalid audio format: ${mimeType || "unknown"}. Supported formats: webm, mp4, mpeg, wav, ogg.` },
      { status: 400 }
    );
  }

  const provider = process.env.PODCHAT_STT_PROVIDER?.trim().toLowerCase();
  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Mock provider is not allowed in production." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { transcript: "I use technology to learn English and practise speaking every day." },
      { status: 200 }
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Speech-to-text is not configured. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const durationMsStr = formData.get("durationMs");
    const durationMs = durationMsStr ? Number(durationMsStr) : undefined;

    const arrayBuffer = await audio.arrayBuffer();

    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": mimeType,
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      console.error(`Deepgram STT API returned status ${response.status}`);
      return NextResponse.json(
        { error: "Speech transcription failed. Please try again later." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (typeof transcript !== "string") {
      console.error("Deepgram returned malformed JSON structure or missing transcript");
      return NextResponse.json(
        { error: "Speech transcription failed. Please try again later." },
        { status: 502 }
      );
    }

    const trimmedTranscript = transcript.trim();
    if (trimmedTranscript.length === 0) {
      return NextResponse.json(
        { error: "No speech was detected. Please try recording again." },
        { status: 422 }
      );
    }

    const finalTranscript = trimmedTranscript.slice(0, 3000);

    // Apply Quality Guard validation check
    const metrics = checkTranscriptQuality(finalTranscript, durationMs);
    if (metrics.isRejected) {
      console.warn("STT quality guard rejected transcript. Metrics:", {
        wordCount: metrics.wordCount,
        uniqueRatio: metrics.uniqueRatio,
        repeatedTokenRatio: metrics.repeatedTokenRatio,
        reasonCode: metrics.reasonCode,
      });
      return NextResponse.json(
        { error: "Speech transcript looked unreliable. Please record again.", reasonCode: metrics.reasonCode },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { transcript: finalTranscript },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected Deepgram STT error: ${message}`);
    return NextResponse.json(
      { error: "Speech transcription failed. Please try again later." },
      { status: 502 }
    );
  }
}
