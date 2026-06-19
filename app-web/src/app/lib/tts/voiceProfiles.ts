export type TtsVoiceProfile =
  | "british_female"
  | "british_male"
  | "american_female"
  | "american_male";

export type TtsProvider = "amazon-polly" | "elevenlabs";

export const AMAZON_POLLY_VOICE_PROFILES = {
  british_female: {
    label: "British Female",
    languageCode: "en-GB",
    voiceId: "Amy",
    engine: "neural",
  },
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
  american_male: {
    label: "American Male",
    languageCode: "en-US",
    voiceId: "Stephen",
    engine: "neural",
  },
} as const satisfies Record<
  TtsVoiceProfile,
  {
    label: string;
    languageCode: "en-GB" | "en-US";
    voiceId: string;
    engine: "neural";
  }
>;

export const DEFAULT_TTS_VOICE_PROFILE: TtsVoiceProfile = "british_female";

export function isTtsVoiceProfile(value: unknown): value is TtsVoiceProfile {
  return (
    value === "british_female" ||
    value === "british_male" ||
    value === "american_female" ||
    value === "american_male"
  );
}

export function normalizeTtsVoiceProfile(value: unknown): TtsVoiceProfile {
  return isTtsVoiceProfile(value) ? value : DEFAULT_TTS_VOICE_PROFILE;
}

export function normalizeTtsProvider(value: unknown): TtsProvider {
  if (typeof value !== "string") return "amazon-polly";
  const normalized = value.trim().toLowerCase();
  if (normalized === "elevenlabs") return "elevenlabs";
  if (normalized === "amazon-polly" || normalized === "amazon_polly" || normalized === "polly") {
    return "amazon-polly";
  }
  return "amazon-polly";
}
