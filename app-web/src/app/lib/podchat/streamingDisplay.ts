/**
 * Incremental JSON → clean text extractor for streaming Podchat host replies.
 *
 * The turn provider is forced (by system prompt) to emit a rigid JSON object:
 *   {"hostText":"...","followUpQuestion":"..."}
 * but SSE deltas arrive as RAW JSON fragments. This extractor converts those
 * fragments into clean display text as they arrive, so the live bubble never
 * shows JSON scaffolding and the TTS chunker is only ever fed real sentences.
 *
 * Tolerances:
 * - leading whitespace / markdown fences before the JSON are ignored,
 * - keys are located by substring search, so `{"hostText" : "..."` also works,
 * - `\n`, `\t`, `\"`, `\\`, `\uXXXX` escapes are decoded for display,
 * - if the raw text never looks like JSON (provider misbehaves), `text()`
 *   falls back to the raw buffer so the user still sees something.
 *
 * The final `done` event from the server carries the fully validated
 * hostText/followUpQuestion, which always replaces this live display, so a
 * mid-stream extraction imperfection can never corrupt the final transcript.
 *
 * State machine: `cursor` only ever moves forward; each phase has an explicit
 * flag, so repeated `text()` calls never re-append already-consumed chars.
 */
export class StreamingJsonDisplay {
  private raw = "";
  private cursor = 0;
  private keyFound = false;
  private hostStarted = false;
  private hostClosed = false;
  private qKeyFound = false;
  private qStarted = false;
  private hostValue = "";
  private question = "";

  /** Feed the next raw delta. */
  append(delta: string): void {
    this.raw += delta;
  }

  /** Re-scan the raw buffer and return the clean text so far. */
  text(): string {
    this.scan();
    if (!this.keyFound) {
      // Not (yet) JSON-shaped: show nothing while the JSON prefix is forming,
      // but surface raw text if the provider is clearly not emitting JSON.
      return this.raw.includes("{") ? "" : this.raw.trim();
    }
    const parts: string[] = [];
    if (this.hostValue) parts.push(this.hostValue);
    if (this.qKeyFound && this.question) parts.push(this.question);
    return parts.join(" ");
  }

  /** Reset for a new turn. */
  reset(): void {
    this.raw = "";
    this.cursor = 0;
    this.keyFound = false;
    this.hostStarted = false;
    this.hostClosed = false;
    this.qKeyFound = false;
    this.qStarted = false;
    this.hostValue = "";
    this.question = "";
  }

  private scan(): void {
    if (!this.keyFound) {
      const keyIdx = this.raw.indexOf('"hostText"', this.cursor);
      if (keyIdx === -1) return;
      this.cursor = keyIdx + '"hostText"'.length;
      this.keyFound = true;
    }

    if (!this.hostStarted) {
      const valueStart = this.findStringStart(this.cursor);
      if (valueStart === -1) return;
      this.cursor = valueStart; // just after the opening quote
      this.hostStarted = true;
    }

    if (!this.hostClosed) {
      if (!this.readString()) return; // hostText value incomplete
      this.hostClosed = true;
    }

    if (!this.qKeyFound) {
      const qIdx = this.raw.indexOf('"followUpQuestion"', this.cursor);
      if (qIdx === -1) return;
      this.cursor = qIdx + '"followUpQuestion"'.length;
      this.qKeyFound = true;
    }

    if (!this.qStarted) {
      const valueStart = this.findStringStart(this.cursor);
      if (valueStart === -1) return;
      this.cursor = valueStart;
      this.qStarted = true;
    }

    this.readString(); // question may be incomplete; that is fine
  }

  /** After a key, skip whitespace + `:` + whitespace and locate the opening quote. */
  private findStringStart(from: number): number {
    let i = from;
    while (i < this.raw.length && /\s/.test(this.raw[i])) i++;
    if (i >= this.raw.length) return -1;
    if (this.raw[i] !== ":") return -1;
    i++;
    while (i < this.raw.length && /\s/.test(this.raw[i])) i++;
    if (i >= this.raw.length) return -1;
    if (this.raw[i] !== '"') return -1;
    return i + 1;
  }

  /**
   * Consume the JSON string starting at `this.cursor` (just after the opening
   * quote) into the active accumulator, advancing `this.cursor` as it goes.
   * Returns true when the closing quote was found, false when more raw data
   * is still needed. Never re-reads already-consumed characters.
   */
  private readString(): boolean {
    for (let j = this.cursor; j < this.raw.length; j++) {
      const c = this.raw[j];
      if (c === '"') {
        this.cursor = j + 1;
        return true;
      }
      if (c === "\\") {
        if (j + 1 >= this.raw.length) {
          this.cursor = j; // incomplete escape — wait for more data
          return false;
        }
        const esc = this.raw[j + 1];
        if (esc === "u") {
          const hex = this.raw.slice(j + 2, j + 6);
          if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
            this.cursor = j; // incomplete unicode escape — wait
            return false;
          }
          this.appendDecoded(String.fromCharCode(parseInt(hex, 16)));
          j += 5; // loop increment brings the total advance to 6
          continue;
        }
        const decoded =
          esc === "n" ? "\n" :
          esc === "t" ? "\t" :
          esc === "r" ? "\r" :
          esc === '"' ? '"' :
          esc === "\\" ? "\\" :
          esc === "/" ? "/" :
          esc === "b" ? "\b" :
          esc === "f" ? "\f" :
          null;
        if (decoded !== null) {
          this.appendDecoded(decoded);
        }
        j += 1; // loop increment brings the total advance to 2
        continue;
      }
      this.appendDecoded(c);
    }
    this.cursor = this.raw.length; // consumed everything available
    return false;
  }

  private appendDecoded(char: string): void {
    if (this.hostClosed) {
      this.question += char;
    } else {
      this.hostValue += char;
    }
  }
}
