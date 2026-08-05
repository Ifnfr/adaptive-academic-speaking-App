/**
 * Incremental text chunker for live TTS.
 *
 * Accumulates streamed host text and emits chunks ready for synthesis:
 * - emits at a sentence boundary (`.`, `!`, `?` followed by whitespace) once the
 *   buffer is long enough to be worth synthing on its own,
 * - hard-splits at ~140 chars well under the 700-char route limit, always on a
 *   whitespace boundary to avoid cutting words,
 * - keeps the remaining text buffered; `finish()` flushes the rest.
 */
export class TtsChunker {
  private buffer = "";
  private readonly onChunk: (chunk: string) => void;
  private readonly maxChars: number;
  private readonly minSentenceChars: number;

  constructor(
    onChunk: (chunk: string) => void,
    maxChars = 140,
    minSentenceChars = 40,
  ) {
    this.onChunk = onChunk;
    this.maxChars = maxChars;
    this.minSentenceChars = minSentenceChars;
  }

  append(text: string) {
    this.buffer += text;
    this.pump();
  }

  /** Flush the remaining buffered text as the final chunk. */
  finish() {
    this.pump();
    this.emit(this.buffer);
    this.buffer = "";
  }

  private pump() {
    for (;;) {
      if (this.buffer.length < this.minSentenceChars) return;

      // 1) Sentence boundary emission.
      let emitted = false;
      const re = /[.!?]\s+/g;
      for (let match = re.exec(this.buffer); match !== null; match = re.exec(this.buffer)) {
        const end = match.index + match[0].length;
        if (end > this.maxChars) break;
        if (end >= this.minSentenceChars) {
          this.emit(this.buffer.slice(0, end));
          this.buffer = this.buffer.slice(end);
          emitted = true;
          break;
        }
      }
      if (emitted) continue;

      // 2) Hard budget split at the last whitespace.
      if (this.buffer.length >= this.maxChars) {
        const slice = this.buffer.slice(0, this.maxChars);
        const lastSpace = slice.lastIndexOf(" ");
        const cutAt = lastSpace > 20 ? lastSpace : this.maxChars;
        this.emit(this.buffer.slice(0, cutAt));
        this.buffer = this.buffer.slice(cutAt);
        continue;
      }

      return;
    }
  }

  private emit(chunk: string) {
    const trimmed = chunk.trim();
    if (trimmed) {
      this.onChunk(trimmed);
    }
  }
}