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
    label: "British Female (Generative)",
    languageCode: "en-GB",
    voiceId: "Amy",
    engine: "generative",
  },
  american_male_generative: {
    label: "American Male (Generative)",
    languageCode: "en-US",
    voiceId: "Matthew",
    engine: "generative",
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
  if (normalized === "elevenlabs") return "elevenlabs";
  if (normalized === "amazon-polly" || normalized === "amazon_polly" || normalized === "polly") {
    return "amazon-polly";
  }
  return "amazon-polly";
}
