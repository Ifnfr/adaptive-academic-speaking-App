export type TtsVoiceProfile =
  | "british_male"
  | "american_female"
  | "british_female_generative"
  | "american_male_generative";

export type TtsProvider = "amazon-polly" | "elevenlabs";

export const AMAZON_POLLY_VOICE_PROFILES = {
  british_male: {
    label: "British Male",
    languageCode: "en-GB",
    voiceId: "Arthur",
    engine: "neural",
  },
  american_female: {
    label: "American Female",
    languageCode: "en-US",
    voiceId: "Danielle",
    engine: "neural",
  },
  british_female_generative: {
    label: "British Female",
    languageCode: "en-GB",
    voiceId: "Amy",
    engine: "neural",
  },
  american_male_generative: {
    label: "American Male",
    languageCode: "en-US",
    voiceId: "Matthew",
    engine: "neural",
  },
} as const satisfies Record<
  TtsVoiceProfile,
  {
    label: string;
    languageCode: "en-GB" | "en-US";
    voiceId: string;
    engine: "neural" | "generative";
  }
>;

export const DEFAULT_TTS_VOICE_PROFILE: TtsVoiceProfile = "british_male";

export function isTtsVoiceProfile(value: unknown): value is TtsVoiceProfile {
  return (
    value === "british_male" ||
    value === "american_female" ||
    value === "british_female_generative" ||
    value === "american_male_generative"
  );
}

export function normalizeTtsVoiceProfile(value: unknown): TtsVoiceProfile {
  return isTtsVoiceProfile(value) ? value : DEFAULT_TTS_VOICE_PROFILE;
}

export function normalizeTtsProvider(value: unknown): TtsProvider {
  if (typeof value !== "string") return "amazon-polly";
  const normalized = value.trim().toLowerCase();
  // ElevenLabs is hidden from Settings for now: the account is on the free
  // tier, so every TTS call fails with 402 paid_plan_required. Stored
  // "elevenlabs" choices are coerced back to Polly so users never hit the
  // dead provider. NOTE: resolveTtsProvider() below intentionally still
  // accepts "elevenlabs" so direct API callers and the (hidden) pipeline
  // keep working unchanged.
  if (normalized === "amazon-polly" || normalized === "amazon_polly" || normalized === "polly") {
    return "amazon-polly";
  }
  return "amazon-polly";
}

// Allowed ElevenLabs model IDs — mirrors the allow-list enforced by
// /api/podchat/tts so every consumer resolves models through one definition.
export const ELEVENLABS_MODEL_IDS = [
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
  "eleven_v3",
] as const;

export type ElevenLabsModelId = (typeof ELEVENLABS_MODEL_IDS)[number];

export function isElevenLabsModelId(value: unknown): value is ElevenLabsModelId {
  return (
    value === "eleven_flash_v2_5" ||
    value === "eleven_multilingual_v2" ||
    value === "eleven_v3"
  );
}

// Provider selection shared by every TTS-consuming API route.
// Precedence mirrors /api/podchat/tts: explicit request value wins, then
// TTS_PROVIDER, then legacy PODCHAT_TTS_PROVIDER, else Amazon Polly.
export type TtsProviderChoice = TtsProvider;

export function resolveTtsProvider(
  explicitProvider: unknown,
  envOverrides?: { TTS_PROVIDER?: string; PODCHAT_TTS_PROVIDER?: string },
): TtsProviderChoice {
  let raw: string;
  if (typeof explicitProvider === "string" && explicitProvider.trim().length > 0) {
    raw = explicitProvider;
  } else {
    const ttsProviderEnv = envOverrides?.TTS_PROVIDER ?? process.env.TTS_PROVIDER;
    const podchatTtsProviderEnv =
      envOverrides?.PODCHAT_TTS_PROVIDER ?? process.env.PODCHAT_TTS_PROVIDER;
    raw = ttsProviderEnv || podchatTtsProviderEnv || "amazon-polly";
  }

  return raw.trim().toLowerCase() === "elevenlabs" ? "elevenlabs" : "amazon-polly";
}

// Model resolution for ElevenLabs calls: request value must pass the shared
// allow-list, otherwise fall back to ELEVENLABS_MODEL_ID env, else null.
export function resolveElevenLabsModelId(requestedModelId: unknown): string | null {
  if (isElevenLabsModelId(requestedModelId)) {
    return requestedModelId;
  }
  return process.env.ELEVENLABS_MODEL_ID?.trim() || null;
}

// Approved ElevenLabs voices. Every ID here has been verified accessible with
// the account's API key (GET /v1/voices/<id> -> 200) before being listed.
export type ElevenLabsVoiceId = "lUTamkMw7gOzZbFIwmq4" | "BIvP0GN1cAtSRTxNHnWS";

export const ELEVENLABS_VOICE_CATALOG = {
  lUTamkMw7gOzZbFIwmq4: {
    label: "James (Professional British Male)",
  },
  BIvP0GN1cAtSRTxNHnWS: {
    label: "Ellen (Serious, Direct and Confident)",
  },
} as const satisfies Record<ElevenLabsVoiceId, { label: string }>;

export function isElevenLabsVoiceId(value: unknown): value is ElevenLabsVoiceId {
  return (
    value === "lUTamkMw7gOzZbFIwmq4" ||
    value === "BIvP0GN1cAtSRTxNHnWS"
  );
}

// Voice resolution for ElevenLabs calls: request value must pass the catalog
// allow-list, otherwise fall back to ELEVENLABS_VOICE_ID env, else null.
export function resolveElevenLabsVoiceId(requestedVoiceId: unknown): string | null {
  if (isElevenLabsVoiceId(requestedVoiceId)) {
    return requestedVoiceId;
  }
  return process.env.ELEVENLABS_VOICE_ID?.trim() || null;
}
