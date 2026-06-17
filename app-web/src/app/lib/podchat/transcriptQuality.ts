export interface TranscriptMetrics {
  wordCount: number;
  uniqueRatio: number;
  repeatedTokenRatio: number;
  isRejected: boolean;
  reasonCode: "none" | "empty" | "too_short" | "repeated_words" | "ngram_loop" | "low_unique_ratio" | "impossible_speed";
}

/**
 * Checks the quality of a transcript and returns evaluation metrics.
 */
export function checkTranscriptQuality(text: string, durationMs?: number): TranscriptMetrics {
  const trimmed = text.trim();
  if (!trimmed) {
    return { wordCount: 0, uniqueRatio: 0, repeatedTokenRatio: 0, isRejected: true, reasonCode: "empty" };
  }

  // Tokenize by word-like characters (ignoring punctuation)
  const tokens = trimmed.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = tokens.length;
  if (wordCount === 0) {
    return { wordCount: 0, uniqueRatio: 0, repeatedTokenRatio: 0, isRejected: true, reasonCode: "empty" };
  }

  // Detect too short (e.g. less than 1 word - already covered by empty, but let's be safe)
  if (wordCount < 1) {
    return { wordCount, uniqueRatio: 0, repeatedTokenRatio: 0, isRejected: true, reasonCode: "too_short" };
  }

  // Count unique words
  const uniqueWords = new Set(tokens);
  const uniqueRatio = uniqueWords.size / wordCount;

  // 1. Single word repetition checker (e.g. "immigrants immigrants immigrants...")
  // Count counts of each token
  const counts: Record<string, number> = {};
  let maxCount = 0;
  for (const token of tokens) {
    counts[token] = (counts[token] || 0) + 1;
    if (counts[token] > maxCount) {
      maxCount = counts[token];
    }
  }

  // If a single word makes up more than 40% of the transcript AND wordCount >= 3, reject.
  if (wordCount >= 3 && (maxCount / wordCount) > 0.4) {
    return { wordCount, uniqueRatio, repeatedTokenRatio: maxCount / wordCount, isRejected: true, reasonCode: "repeated_words" };
  }

  // 2. Loop / N-gram repetition check (detect repeating phrases, e.g. "I think that I think that I think that")
  // Let's test combinations of phrase sizes from 2 to 5 words
  for (let len = 2; len <= 5; len++) {
    if (wordCount < len * 2) continue;
    for (let i = 0; i <= wordCount - len * 2; i++) {
      const phrase1 = tokens.slice(i, i + len).join(" ");
      const phrase2 = tokens.slice(i + len, i + len * 2).join(" ");
      if (phrase1 === phrase2) {
        // We found a direct back-to-back repetition of an n-gram.
        // Let's count how many times it repeats in total or if it is a loop
        return { wordCount, uniqueRatio, repeatedTokenRatio: 1, isRejected: true, reasonCode: "ngram_loop" };
      }
    }
  }

  // 3. Low unique-word ratio check (general loop or highly repetitive speech)
  // For transcripts with >= 5 words, if uniqueRatio is extremely low (e.g. < 0.5), reject.
  if (wordCount >= 5 && uniqueRatio < 0.5) {
    return { wordCount, uniqueRatio, repeatedTokenRatio: 0, isRejected: true, reasonCode: "low_unique_ratio" };
  }

  // 4. Impossible speed / length for recording duration
  // Speech rate limit: normal speaking speed rarely exceeds 3-4 words per second (240 words per minute).
  // Extreme limit: 6 words per second (360 words per minute).
  // If durationMs is provided and the word count is impossible for that duration, reject.
  if (durationMs && durationMs > 0) {
    const durationSeconds = durationMs / 1000;
    const wordsPerSecond = wordCount / durationSeconds;
    if (durationSeconds >= 1 && wordsPerSecond > 6.5) {
      return { wordCount, uniqueRatio, repeatedTokenRatio: 0, isRejected: true, reasonCode: "impossible_speed" };
    }
  }

  return {
    wordCount,
    uniqueRatio,
    repeatedTokenRatio: 0,
    isRejected: false,
    reasonCode: "none",
  };
}
