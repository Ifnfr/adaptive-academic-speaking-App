"use client";

export type TutorVoicePlaybackResult =
  | { ok: true; started: true }
  | {
      ok: false;
      started: false;
      reason: "speech-unavailable" | "empty-text" | "speak-error";
    };

const VOICE_LOAD_TIMEOUT_MS = 350;

let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Checks if browser-native SpeechSynthesis is available in the current client context.
 */
export function canUseTutorVoice(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Stops any ongoing speech utterance.
 */
export function stopTutorVoice(): void {
  if (canUseTutorVoice()) {
    try {
      activeUtterance = null;
      window.speechSynthesis.cancel();
    } catch {
      // Ignored: safe fallback for browser API irregularities
    }
  }
}

function normalizeTutorPhrase(text: string): string {
  return text
    .replace(/\?\.(?=\s|$)/g, "?")
    .replace(/!\.(?=\s|$)/g, "!")
    .replace(/\s+/g, " ")
    .trim();
}

function getUsableVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices().filter((voice) => voice.lang);
  } catch {
    return [];
  }
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = getUsableVoices();
  if (voices.length > 0) {
    return Promise.resolve(voices);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(getUsableVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", finish, {
      once: true,
    });
    window.setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);
  });
}

function selectEnglishVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>,
): SpeechSynthesisVoice | null {
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

/**
 * Speaks a given text phrase using the browser-native SpeechSynthesis API.
 * Resolves the returned promise once playback completes or fails.
 *
 * @param text The text string to speak.
 */
export async function speakTutorPhrase(
  text: string,
): Promise<TutorVoicePlaybackResult> {
  const phrase = normalizeTutorPhrase(text);

  if (!phrase) {
    return { ok: false, started: false, reason: "empty-text" };
  }

  if (!canUseTutorVoice()) {
    return { ok: false, started: false, reason: "speech-unavailable" };
  }

  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = await waitForVoices();
  } catch {
    voices = [];
  }

  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(phrase);
      activeUtterance = utterance;

      utterance.lang = "en-US";
      utterance.volume = 1;
      utterance.rate = 1;
      utterance.pitch = 1;

      const englishVoice = selectEnglishVoice(voices);
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        resolve({ ok: true, started: true });
      };

      utterance.onerror = () => {
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        resolve({ ok: false, started: false, reason: "speak-error" });
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      activeUtterance = null;
      resolve({ ok: false, started: false, reason: "speak-error" });
    }
  });
}
