import { createHash, createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  AMAZON_POLLY_VOICE_PROFILES,
  DEFAULT_TTS_VOICE_PROFILE,
  isTtsVoiceProfile,
} from "../../../../lib/tts/voiceProfiles";

export const runtime = "nodejs";

const POLLY_SERVICE = "polly";
const POLLY_PATH = "/v1/speech";
const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";

type AwsConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  outputFormat: "mp3";
  sampleRate: "8000" | "16000" | "22050" | "24000";
};

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

function getAwsConfig(): AwsConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.AWS_REGION?.trim();

  if (!accessKeyId || !secretAccessKey || !region) {
    return null;
  }

  const sampleRateEnv = process.env.AMAZON_POLLY_SAMPLE_RATE;
  const validSampleRates = ["8000", "16000", "22050", "24000"] as const;
  const sampleRate = (validSampleRates.includes(sampleRateEnv as any)
    ? sampleRateEnv
    : "24000") as AwsConfig["sampleRate"];

  return {
    accessKeyId,
    secretAccessKey,
    region,
    outputFormat: "mp3",
    sampleRate,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: Buffer | string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildAuthorizationHeader(params: {
  config: AwsConfig;
  body: string;
  host: string;
  amzDate: string;
  dateStamp: string;
}): string {
  const payloadHash = sha256Hex(params.body);
  const headers = [
    `content-type:application/json`,
    `host:${params.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${params.amzDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "POST",
    POLLY_PATH,
    "",
    headers,
    "",
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${params.dateStamp}/${params.config.region}/${POLLY_SERVICE}/aws4_request`;
  const stringToSign = [
    SIGNING_ALGORITHM,
    params.amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${params.config.secretAccessKey}`, params.dateStamp);
  const regionKey = hmac(dateKey, params.config.region);
  const serviceKey = hmac(regionKey, POLLY_SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmacHex(signingKey, stringToSign);

  return `${SIGNING_ALGORITHM} Credential=${params.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function synthesizeSpeech(
  text: string,
  config: AwsConfig,
): Promise<ArrayBuffer> {
  const host = `polly.${config.region}.amazonaws.com`;
  
  const voiceProfileEnv = process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE;
  const voiceProfile = isTtsVoiceProfile(voiceProfileEnv)
    ? voiceProfileEnv
    : DEFAULT_TTS_VOICE_PROFILE;

  const profile = AMAZON_POLLY_VOICE_PROFILES[voiceProfile];
  const body = JSON.stringify({
    Engine: profile.engine,
    LanguageCode: profile.languageCode,
    OutputFormat: config.outputFormat,
    SampleRate: config.sampleRate,
    Text: text,
    VoiceId: profile.voiceId,
  });
  const { amzDate, dateStamp } = formatAmzDate(new Date());
  const payloadHash = sha256Hex(body);
  const authorization = buildAuthorizationHeader({
    config,
    body,
    host,
    amzDate,
    dateStamp,
  });

  const response = await fetch(`https://${host}${POLLY_PATH}`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body,
  });

  if (!response.ok) {
    console.error(`Polly request failed with status ${response.status}`);
    throw new Error("Polly request failed.");
  }

  const audioBytes = await response.arrayBuffer();
  if (audioBytes.byteLength === 0) {
    throw new Error("Polly returned empty audio.");
  }
  return audioBytes;
}

export async function POST(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Unauthorized: Missing valid session credentials." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Internal Server Error: Database client configuration missing." },
      { status: 500 }
    );
  }

  let parsedBody: any;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { sessionId, sectionId, text } = parsedBody || {};

  if (!sessionId || !sectionId || !text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "sessionId, sectionId, and text are required." },
      { status: 400 }
    );
  }

  // Validate ownership
  const { data: section, error: sectionError } = await supabase
    .from("listening_exercise_sections")
    .select("owner_id")
    .eq("id", sectionId)
    .eq("session_id", sessionId)
    .single();

  if (sectionError || !section) {
    console.error("Section validation error:", sectionError);
    return NextResponse.json(
      { error: "Forbidden: Section not found or database error." },
      { status: 403 }
    );
  }

  if (section.owner_id !== ownerId) {
    return NextResponse.json(
      { error: "Forbidden: You do not own this section." },
      { status: 403 }
    );
  }

  // Synthesize speech via Amazon Polly
  const awsConfig = getAwsConfig();
  if (!awsConfig) {
    return NextResponse.json(
      { error: "Audio generation failed", message: "Polly credentials missing." },
      { status: 503 }
    );
  }

  let audioBytes: ArrayBuffer;
  try {
    audioBytes = await synthesizeSpeech(text, awsConfig);
  } catch (err: any) {
    console.error("Polly speech synthesis error:", err);
    return NextResponse.json(
      { error: "Audio generation failed" },
      { status: 502 }
    );
  }

  // Upload to Supabase Storage
  const filePath = `listening/${ownerId}/${sessionId}/${sectionId}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from("listening-audio")
    .upload(filePath, new Uint8Array(audioBytes), {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Audio upload failed" },
      { status: 502 }
    );
  }

  // Generate signed URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("listening-audio")
    .createSignedUrl(filePath, 3600);

  if (signedUrlError || !signedUrlData) {
    console.error("Signed URL generation error:", signedUrlError);
    return NextResponse.json(
      { error: "Failed to generate audio URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ audioUrl: signedUrlData.signedUrl });
}
