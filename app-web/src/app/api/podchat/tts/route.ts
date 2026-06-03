import { createHash, createHmac } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 700;
const VALID_VOICES = ["Brian", "Amy", "Emma"] as const;
const POLLY_SERVICE = "polly";
const POLLY_PATH = "/v1/speech";
const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";

type PodchatTtsVoice = (typeof VALID_VOICES)[number];

type PodchatTtsRequest = {
  text: string;
  voice: PodchatTtsVoice;
};

type AwsConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  engine: string;
};

function isValidVoice(value: unknown): value is PodchatTtsVoice {
  return VALID_VOICES.includes(value as PodchatTtsVoice);
}

function defaultVoice(): PodchatTtsVoice {
  return isValidVoice(process.env.POLLY_VOICE_ID)
    ? process.env.POLLY_VOICE_ID
    : "Brian";
}

function validateRequest(
  body: unknown,
):
  | { valid: true; request: PodchatTtsRequest }
  | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body." };
  }

  const source = body as Record<string, unknown>;
  if (typeof source.text !== "string" || source.text.trim().length === 0) {
    return { valid: false, error: "text must be a non-empty string." };
  }

  const text = source.text.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: "text must be 700 characters or fewer." };
  }

  if (source.voice !== undefined && !isValidVoice(source.voice)) {
    return { valid: false, error: "Invalid voice." };
  }

  return {
    valid: true,
    request: {
      text,
      voice: source.voice === undefined ? defaultVoice() : source.voice,
    },
  };
}

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
    engine: process.env.POLLY_ENGINE?.trim() || "neural",
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
  const body = JSON.stringify({
    Engine: config.engine,
    OutputFormat: "mp3",
    Text: request.text,
    VoiceId: request.voice,
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
    const errorText = await response.text().catch(() => "");
    console.error(
      `Polly request failed with status ${response.status}: ${errorText.slice(0, 500)}`,
    );
    throw new Error("Polly request failed.");
  }

  return response.arrayBuffer();
}

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateRequest(parsedBody);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const config = getAwsConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Text-to-speech is not configured. Please try again later." },
      { status: 503 },
    );
  }

  try {
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
    console.error(`Unexpected Polly TTS error: ${message}`);
    return NextResponse.json(
      { error: "Text-to-speech request failed. Please try again later." },
      { status: 502 },
    );
  }
}
