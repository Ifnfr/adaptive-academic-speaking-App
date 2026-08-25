// Shared ElevenLabs TTS synthesis helper.
//
// Used by API routes that need direct text-to-speech (e.g. listening exercise
// audio generation). Podchat's /api/podchat/tts keeps its own inline copy of
// the same call shape — do not refactor it blindly: that route has a
// source-content test (tests/podchat-tts-route.spec.ts) asserting it contains
// no supabase client usage, and this module intentionally stays dependency-free.
//
// Env contract:
//   ELEVENLABS_API_KEY  — server-side secret (never NEXT_PUBLIC_)
//   ELEVENLABS_VOICE_ID — default voice used when the caller passes none

export type ElevenLabsSynthesisResult =
  | { ok: true; audio: ArrayBuffer }
  | { ok: false; reason: "missing_config" | "upstream_error" };

export function getElevenLabsCredentials(): {
  apiKey: string;
  /** May be empty when no env voice is configured — callers may supply one per request. */
  voiceId: string;
} | null {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() ?? "";
  if (!apiKey) return null;
  return { apiKey, voiceId };
}

export async function synthesizeWithElevenLabs(
  text: string,
  options: {
    modelId: string;
    voiceId?: string;
    outputFormat?: string;
    abortSignal?: AbortSignal;
  },
): Promise<ElevenLabsSynthesisResult> {
  const credentials = getElevenLabsCredentials();
  if (!credentials) {
    return { ok: false, reason: "missing_config" };
  }

  const voiceId = options.voiceId?.trim() || credentials.voiceId;
  if (!voiceId) {
    console.error("ElevenLabs synthesis skipped: no voice configured.");
    return { ok: false, reason: "missing_config" };
  }
  const outputFormat = options.outputFormat || "mp3_44100_128";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const body = JSON.stringify({
    text,
    model_id: options.modelId,
    output_format: outputFormat,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": credentials.apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body,
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `ElevenLabs request failed with status ${response.status}: ${errorText.slice(0, 500)}`,
      );
      return { ok: false, reason: "upstream_error" };
    }

    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0) {
      console.error("ElevenLabs returned empty audio.");
      return { ok: false, reason: "upstream_error" };
    }

    return { ok: true, audio };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ElevenLabs synthesis error: ${message}`);
    return { ok: false, reason: "upstream_error" };
  }
}
