"use client";

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
      window.speechSynthesis.cancel();
    } catch {
      // Ignored: safe fallback for browser API irregularities
    }
  }
}

/**
 * Speaks a given text phrase using the browser-native SpeechSynthesis API.
 * Resolves the returned promise once playback completes or fails.
 * 
 * @param text The text string to speak.
 * @param lang The language code, defaults to "en-US".
 */
export function speakTutorPhrase(text: string, lang = "en-US"): Promise<void> {
  return new Promise((resolve) => {
    if (!canUseTutorVoice()) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      if (!text || !text.trim()) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;

      // Try selecting an English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("en-us") ||
          v.lang.toLowerCase().startsWith("en-gb") ||
          v.lang.toLowerCase().startsWith("en")
      );
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = () => {
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}
