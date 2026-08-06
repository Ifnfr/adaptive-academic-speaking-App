import { expect, test } from "@playwright/test";
import { StreamingJsonDisplay } from "../src/app/lib/podchat/streamingDisplay";

/**
 * Unit tests for the incremental JSON → clean text extractor.
 * These prove the streaming bubble and the TTS chunker are only ever fed
 * clean text, never the raw JSON fragments the provider emits.
 */
test.describe("StreamingJsonDisplay", () => {
  test("extracts hostText progressively without JSON scaffolding", () => {
    const display = new StreamingJsonDisplay();
    display.append('{"ho');
    expect(display.text()).toBe("");
    display.append('stText":"Ah, fair enough');
    expect(display.text()).toBe("Ah, fair enough");
    display.append(" - we've covered a lot");
    expect(display.text()).toBe("Ah, fair enough - we've covered a lot");
  });

  test("extracts the follow-up question after the hostText closes", () => {
    const display = new StreamingJsonDisplay();
    display.append('{"hostText":"Hello there.","followUpQuestion":"What do you think?"}');
    expect(display.text()).toBe("Hello there. What do you think?");
  });

  test("streams hostText and question across arbitrary chunk boundaries", () => {
    const display = new StreamingJsonDisplay();
    const raw =
      '{"hostText":"It is a good point.","followUpQuestion":"Why does it matter to you?"}';
    // Feed one character at a time — the worst possible fragmentation.
    let previous = "";
    for (const char of raw) {
      display.append(char);
      const clean = display.text();
      // Clean text must never contain JSON scaffolding.
      expect(clean).not.toContain('"hostText"');
      expect(clean).not.toContain("{");
      expect(clean).not.toContain('"}');
      // Clean text only ever grows (monotonic).
      expect(clean.startsWith(previous)).toBe(true);
      previous = clean;
    }
    expect(previous).toBe("It is a good point. Why does it matter to you?");
  });

  test("decodes escaped newlines and quotes for display", () => {
    const display = new StreamingJsonDisplay();
    display.append('{"hostText":"Line one\\nLine two with \\"quotes\\"."}');
    expect(display.text()).toBe('Line one\nLine two with "quotes".');
  });

  test("decodes unicode escapes", () => {
    const display = new StreamingJsonDisplay();
    display.append('{"hostText":"It\\u2019s yours"}');
    expect(display.text()).toBe("It’s yours");
  });

  test("tolerates whitespace and colons around keys", () => {
    const display = new StreamingJsonDisplay();
    display.append('{ "hostText" : "Spaced out" , "followUpQuestion" : "Really?" }');
    expect(display.text()).toBe("Spaced out Really?");
  });

  test("tolerates a markdown fence before the JSON", () => {
    const display = new StreamingJsonDisplay();
    display.append('```json\n{"hostText":"Fenced answer","followUpQuestion":"Ok?"}');
    expect(display.text()).toBe("Fenced answer Ok?");
  });

  test("shows raw text when the provider emits no JSON at all", () => {
    const display = new StreamingJsonDisplay();
    display.append("The host just talks plainly.");
    expect(display.text()).toBe("The host just talks plainly.");
  });

  test("reset clears all state for the next turn", () => {
    const display = new StreamingJsonDisplay();
    display.append('{"hostText":"First turn"}');
    expect(display.text()).toBe("First turn");
    display.reset();
    display.append('{"hostText":"Second turn"}');
    expect(display.text()).toBe("Second turn");
  });

  test("extraction matches JSON.parse for the final text", () => {
    const display = new StreamingJsonDisplay();
    const raw =
      '{"hostText":"I use it for everything, honestly.","followUpQuestion":"Including your studies?"}';
    display.append(raw);
    const parsed = JSON.parse(raw) as {
      hostText: string;
      followUpQuestion: string;
    };
    expect(display.text()).toBe(`${parsed.hostText} ${parsed.followUpQuestion}`);
  });

  test("REGRESSION: repeated text() calls after completion never leak the closing brace", () => {
    // Real DeepSeek streaming calls text() once per delta, including AFTER
    // the question's closing quote arrives — the trailing `}` of the JSON
    // must never be decoded into the displayed/synthesized text.
    const display = new StreamingJsonDisplay();
    const raw =
      '{\n  "hostText": "Ah, so for you it is about practice, not just convenience.",\n  "followUpQuestion": "What do you think makes the price different?"\n}';
    // Feed the raw exactly as deltas would arrive, calling text() after each.
    let previous = "";
    const deltas = [
      '{\n  "ho',
      'stText": "Ah, so for you it is about practice, not just convenience.',
      '",\n  "followUpQuestion": "What do you think makes the price different?',
      '"\n}',
    ];
    for (const delta of deltas) {
      display.append(delta);
      const clean = display.text();
      expect(clean.startsWith(previous)).toBe(true);
      previous = clean;
    }
    // After the stream is complete, extra text() calls (e.g. post-done
    // renders) must return the SAME clean text — no `}` appended.
    expect(previous).toBe(
      "Ah, so for you it is about practice, not just convenience. What do you think makes the price different?",
    );
    expect(display.text()).toBe(previous);
    expect(display.text()).toBe(previous);
    expect(previous.endsWith("}")).toBe(false);
    expect(previous).not.toContain('"');
  });

  test("REGRESSION: truncated stream yields only the decoded clean prefix", () => {
    // A provider stream that dies mid-question must leave the extractor with
    // exactly the decodable text — nothing more, nothing duplicated.
    const display = new StreamingJsonDisplay();
    const raw =
      '{"hostText":"First sentence. Second sentence.","followUpQuestion":"What do you think ma';
    for (const char of raw) {
      display.append(char);
      display.text();
    }
    const clean = display.text();
    expect(clean).toBe("First sentence. Second sentence. What do you think ma");
    // Re-scanning must be idempotent.
    expect(display.text()).toBe(clean);
  });
});
