/**
 * Sanitizes input text for evaluation by:
 * 1. Trimming leading and trailing whitespace.
 * 2. Converting text to lowercase.
 * 3. Removing absolute trailing punctuation blocks (. , ? !).
 * 4. Deduplicating inner whitespace (multiple spaces/tabs into a single space).
 *
 * @param text The input text to sanitize.
 * @returns The sanitized text.
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  
  // 1. Lowercase and initial trim
  let sanitized = text.toLowerCase().trim();
  
  // 2. Remove absolute trailing punctuation blocks (. , ? !)
  // This matches one or more of these punctuation characters at the absolute end of the string.
  sanitized = sanitized.replace(/[\.,\?!]+$/, "");
  
  // 3. Trim again in case removing punctuation exposed more whitespace,
  // and deduplicate all inner whitespace.
  sanitized = sanitized.trim().replace(/\s+/g, " ");
  
  return sanitized;
}
