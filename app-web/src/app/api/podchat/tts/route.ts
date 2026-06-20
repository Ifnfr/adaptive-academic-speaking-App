import { createHash, createHmac } from "crypto";
import { NextResponse } from "next/server";
import {
  AMAZON_POLLY_VOICE_PROFILES,
  DEFAULT_TTS_VOICE_PROFILE,
  isTtsVoiceProfile,
  normalizeTtsProvider,
  type TtsProvider,
  type TtsVoiceProfile,
} from "../../../lib/tts/voiceProfiles";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 700;
const POLLY_SERVICE = "polly";
const POLLY_PATH = "/v1/speech";
const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";
const VALID_OUTPUT_FORMATS = ["mp3"] as const;
const VALID_SAMPLE_RATES = ["8000", "16000", "22050", "24000"] as const;

type TtsErrorCode =
  | "invalid_tts_voice_profile"
  | "invalid_tts_input"
  | "tts_unavailable"
  | "tts_provider_error";

type PodchatTtsRequest = {
  text: string;
  ttsProvider: TtsProvider;
  voiceProfile: TtsVoiceProfile;
  elevenLabsModelId?: string;
};

type AwsConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  outputFormat: "mp3";
  sampleRate: "8000" | "16000" | "22050" | "24000";
};

type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
};

function getTargetProvider(source: Record<string, unknown>): TtsProvider {
  const raw = source.provider !== undefined ? source.provider : source.ttsProvider;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return normalizeTtsProvider(raw);
  }

  const envVal = process.env.TTS_PROVIDER || process.env.PODCHAT_TTS_PROVIDER;
  if (typeof envVal === "string") {
    return normalizeTtsProvider(envVal);
  }
  return "amazon-polly";
}

function getDefaultVoiceProfile(): TtsVoiceProfile {
  return isTtsVoiceProfile(process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE)
    ? process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE
    : DEFAULT_TTS_VOICE_PROFILE;
}

function validateRequest(
  body: unknown,
):
  | { valid: true; request: PodchatTtsRequest }
  | { valid: false; status: number; code: TtsErrorCode; message: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, status: 400, code: "invalid_tts_input", message: "Invalid request body." };
  }

  const source = body as Record<string, unknown>;
  if (typeof source.text !== "string" || source.text.trim().length === 0) {
    return { valid: false, status: 400, code: "invalid_tts_input", message: "Text is required." };
  }

  const text = source.text.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, status: 400, code: "invalid_tts_input", message: "Text is too long." };
  }

  if (source.voice !== undefined || source.voiceId !== undefined || source.VoiceId !== undefined) {
    return {
      valid: false,
      status: 400,
      code: "invalid_tts_voice_profile",
      message: "Select a supported voice profile.",
    };
  }

  const ttsProvider = getTargetProvider(source);
  let voiceProfile = getDefaultVoiceProfile();
  if (source.voiceProfile !== undefined) {
    if (!isTtsVoiceProfile(source.voiceProfile)) {
      return {
        valid: false,
        status: 400,
        code: "invalid_tts_voice_profile",
        message: "Select a supported voice profile.",
      };
    }
    voiceProfile = source.voiceProfile;
  }
  const elevenLabsModelId = typeof source.elevenLabsModelId === "string" ? source.elevenLabsModelId.trim() : undefined;

  return {
    valid: true,
    request: {
      text,
      ttsProvider,
      voiceProfile,
      elevenLabsModelId,
    },
  };
}

// ---------------------------------------------------------------------------
// AWS Polly helpers
// ---------------------------------------------------------------------------

function getAwsConfig(): AwsConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.AWS_REGION?.trim();

  if (!accessKeyId || !secretAccessKey || !region) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
    outputFormat: VALID_OUTPUT_FORMATS.includes(process.env.AMAZON_POLLY_OUTPUT_FORMAT as "mp3")
      ? process.env.AMAZON_POLLY_OUTPUT_FORMAT as "mp3"
      : "mp3",
    sampleRate: VALID_SAMPLE_RATES.includes(process.env.AMAZON_POLLY_SAMPLE_RATE as AwsConfig["sampleRate"])
      ? process.env.AMAZON_POLLY_SAMPLE_RATE as AwsConfig["sampleRate"]
      : "24000",
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
  request: PodchatTtsRequest,
  config: AwsConfig,
): Promise<ArrayBuffer> {
  const host = `polly.${config.region}.amazonaws.com`;
  const profile = AMAZON_POLLY_VOICE_PROFILES[request.voiceProfile];
  const body = JSON.stringify({
    Engine: profile.engine,
    LanguageCode: profile.languageCode,
    OutputFormat: config.outputFormat,
    SampleRate: config.sampleRate,
    Text: request.text,
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

// ---------------------------------------------------------------------------
// ElevenLabs helpers
// ---------------------------------------------------------------------------

function getElevenLabsConfig(modelId: string): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!apiKey || !voiceId) {
    return null;
  }

  return { apiKey, voiceId, modelId };
}

async function synthesizeSpeechElevenLabs(
  text: string,
  config: ElevenLabsConfig,
): Promise<ArrayBuffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}`;
  const body = JSON.stringify({
    text,
    model_id: config.modelId,
    output_format: "mp3_44100_128",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `ElevenLabs request failed with status ${response.status}: ${errorText.slice(0, 500)}`,
    );
    throw new Error("ElevenLabs request failed.");
  }

  return response.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ---------------------------------------------------------------------------
  // Internal security guard — server-to-server only.
  // Reject any request that does not carry the correct X-Internal-Key header.
  // This prevents external callers from abusing shared speech bandwidth costs.
  // ---------------------------------------------------------------------------
  const internalKey = process.env.INTERNAL_SPEECH_SECURITY_KEY;
  const receivedKey = request.headers.get("X-Internal-Key");
  if (!internalKey || !receivedKey || receivedKey !== internalKey) {
    return NextResponse.json(
      { error: "unauthorized", message: "Unauthorized." },
      { status: 401 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_tts_input", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateRequest(parsedBody);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.code, message: validation.message },
      { status: validation.status },
    );
  }

  const { ttsProvider, elevenLabsModelId } = validation.request;

  try {
    if (ttsProvider === "elevenlabs") {
      if (
        !elevenLabsModelId ||
        (elevenLabsModelId !== "eleven_flash_v2_5" &&
          elevenLabsModelId !== "eleven_multilingual_v2" &&
          elevenLabsModelId !== "eleven_v3")
      ) {
        return NextResponse.json(
          { error: "tts_unavailable", message: "Text-to-speech is unavailable. Continuing with text." },
          { status: 503 },
        );
      }

      const elevenLabsConfig = getElevenLabsConfig(elevenLabsModelId);
      if (!elevenLabsConfig) {
        return NextResponse.json(
          { error: "tts_unavailable", message: "Text-to-speech is unavailable. Continuing with text." },
          { status: 503 },
        );
      }
      const audioBytes = await synthesizeSpeechElevenLabs(
        validation.request.text,
        elevenLabsConfig,
      );
      return new Response(audioBytes, {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "audio/mpeg",
        },
      });
    }

    // Amazon Polly
    const config = getAwsConfig();
    if (!config) {
      return NextResponse.json(
        { error: "tts_unavailable", message: "Text-to-speech is unavailable. Please try again later." },
        { status: 503 },
      );
    }
    const audioBytes = await synthesizeSpeech(validation.request, config);
    return new Response(audioBytes, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "audio/mpeg",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected TTS error: ${message}`);
    return NextResponse.json(
      { error: "tts_provider_error", message: "Text-to-speech request failed. Please try again later." },
      { status: 502 },
    );
  }
}
