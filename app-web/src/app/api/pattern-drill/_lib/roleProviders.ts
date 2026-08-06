import { cookies } from "next/headers";

export type AiProviderRole = "planning" | "execution";
export type AiProviderId = "claude" | "deepseek" | "minimax_m3" | "gemini" | "minimax";

export interface ProviderResponse {
  text: string;
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

// Shared hook for testing
export const roleTestHooks = {
  callMiniMaxM3: null as ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null,
};

/**
 * Resolves the configured provider ID and API Key for a specific role.
 */
export async function resolveProvider(role: AiProviderRole): Promise<{ providerId: AiProviderId; apiKey: string; modelName: string }> {
  let userPreference: string | undefined;
  try {
    const cookieStore = await cookies();
    userPreference = cookieStore.get("fluency_provider")?.value;
  } catch {
    // ignore outside request context (e.g. static build or tests)
  }

  let providerId = userPreference?.toLowerCase().trim() as AiProviderId | undefined;
  if (providerId && !["claude", "deepseek", "minimax_m3", "gemini"].includes(providerId)) {
    providerId = undefined;
  }

  if (!providerId) {
    if (role === "planning") {
      providerId = (process.env.DEFAULT_FLUENCY_AI || process.env.AI_PLANNING_PROVIDER || "claude").toLowerCase() as AiProviderId;
    } else {
      providerId = (process.env.DEFAULT_FLUENCY_AI || process.env.AI_EXECUTION_PROVIDER || "deepseek").toLowerCase() as AiProviderId;
    }
  }

  let apiKey = "";
  let modelName = "";

  if (providerId === "minimax_m3" || providerId === "minimax") {
    providerId = "minimax_m3";
    apiKey = process.env.MINIMAX_API_KEY || "";
    modelName = process.env.MINIMAX_MODEL || "MiniMax-M3";
  } else if (providerId === "deepseek") {
    apiKey = process.env.DEEPSEEK_API_KEY || "";
    modelName = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  } else if (providerId === "claude") {
    apiKey = process.env.CLAUDE_API_KEY || "";
    modelName = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  } else if (providerId === "gemini") {
    apiKey = process.env.DEEPSEEK_API_KEY || "";
    modelName = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  } else {
    // Default fallback to Claude config
    providerId = "claude";
    apiKey = process.env.CLAUDE_API_KEY || "";
    modelName = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  }

  if (!apiKey) {
    throw new ProviderConfigError(`API key for provider ${providerId} is not configured.`);
  }

  return { providerId, apiKey, modelName };
}

/**
 * Dispatches an AI request based on the resolved role configuration.
 */
export async function callRoleProvider(
  role: AiProviderRole,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { providerId, apiKey, modelName } = await resolveProvider(role);

  if (!apiKey) {
    throw new ProviderConfigError(`API key for provider ${providerId} is not configured.`);
  }

  if (providerId === "minimax_m3") {
    return callMiniMaxM3(apiKey, modelName, systemPrompt, userPrompt);
  } else if (providerId === "claude") {
    return callClaude(apiKey, modelName, systemPrompt, userPrompt);
  } else if (providerId === "gemini") {
    return callGemini(apiKey, modelName, systemPrompt, userPrompt);
  } else {
    return callDeepSeek(apiKey, modelName, systemPrompt, userPrompt);
  }
}

/**
 * MiniMax M3 call implementation
 */
async function callMiniMaxM3(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (roleTestHooks.callMiniMaxM3) {
    return roleTestHooks.callMiniMaxM3(apiKey, systemPrompt, userPrompt);
  }

  const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
  const endpoint = `${baseUrl}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });
  } catch (err) {
    console.error(`MiniMax request connection error:`, err);
    throw new ProviderUnavailableError(`MiniMax request connection failed.`);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`MiniMax API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new ProviderUnavailableError(`MiniMax request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string };
    }>;
  };

  return data.choices?.[0]?.message?.content || "";
}

/**
 * Claude/Anthropic call implementation
 */
async function callClaude(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (err) {
    console.error(`Claude request connection error:`, err);
    throw new ProviderUnavailableError(`Claude request connection failed.`);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Claude API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new ProviderUnavailableError(`Claude request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

/**
 * DeepSeek call implementation
 */
async function callDeepSeek(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    console.error(`DeepSeek request connection error:`, err);
    throw new ProviderUnavailableError(`DeepSeek request connection failed.`);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`DeepSeek API error ${res.status}: ${errText.slice(0, 500)}`);
    throw new ProviderUnavailableError(`DeepSeek request failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Gemini call implementation
 */
async function callGemini(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const actualApiKey = process.env.DEEPSEEK_API_KEY || "";
  const actualModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  return callDeepSeek(actualApiKey, actualModel, systemPrompt, userPrompt);
}
