/**
 * Shared DeepSeek endpoint configuration.
 * Set DEEPSEEK_BASE_URL to override the default API endpoint
 * (e.g. to route through OpenCode Go or Hermes proxy).
 */
export function getDeepSeekEndpoint(): string {
  return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions";
}
