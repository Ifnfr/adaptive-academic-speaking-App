import { cookies } from "next/headers";

export type FeatureKey = "podchat" | "listening" | "fluency";
export type AIProvider = "Claude" | "DeepSeek" | "Gemini";

function parseCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookiesList = cookieHeader.split(";").map(c => c.trim());
  const target = cookiesList.find(c => c.startsWith(`${name}=`));
  if (target) {
    const val = target.split("=")[1];
    return val ? decodeURIComponent(val) : undefined;
  }
  return undefined;
}

export async function resolveFeatureProvider(
  feature: FeatureKey,
  request?: Request
): Promise<{ providerId: string; apiKey: string; modelName: string }> {
  let userPreference: string | undefined;
  let sourceUsed: "body" | "cookie" | "env_fallback" = "env_fallback";

  // 1. Try reading from Request cookies if request is provided
  if (request) {
    const cookieHeader = request.headers.get("cookie");
    userPreference = parseCookie(cookieHeader, `${feature}_provider`);
    if (userPreference) {
      sourceUsed = "body";
    }
  }

  // 2. Try reading from next/headers cookies
  if (!userPreference) {
    try {
      const cookieStore = await cookies();
      userPreference = cookieStore.get(`${feature}_provider`)?.value;
      if (userPreference) {
        sourceUsed = "cookie";
      }
    } catch {
      // ignore outside request context (e.g., static build/tests)
    }
  }

  // Normalize user preference if found
  let providerId = userPreference?.trim();
  if (providerId) {
    // case insensitive match but normalized to lower case for internal logic
    const lower = providerId.toLowerCase();
    if (["claude", "gemini", "deepseek", "minimax_m3", "minimax"].includes(lower)) {
      providerId = lower;
    } else {
      providerId = undefined;
    }
  }

  let apiKey = "";
  let modelName = "";

  if (feature === "podchat") {
    if (!providerId) {
      providerId = (
        process.env.DEFAULT_PODCHAT_AI ||
        process.env.PODCHAT_AI_PROVIDER ||
        "deepseek"
      ).toLowerCase().trim();
    }
  } else if (feature === "listening") {
    if (!providerId) {
      providerId = (
        process.env.DEFAULT_LISTENING_AI ||
        process.env.LISTENING_EXERCISE_PROVIDER ||
        process.env.AI_PLANNING_PROVIDER ||
        "deepseek"
      ).toLowerCase().trim();
    }
  } else if (feature === "fluency") {
    if (!providerId) {
      providerId = (
        process.env.DEFAULT_FLUENCY_AI ||
        process.env.AI_EXECUTION_PROVIDER ||
        "deepseek"
      ).toLowerCase().trim();
    }
  }

  // Support fallback to other env vars if still undefined
  if (!providerId) {
    providerId = "claude";
  }

  // Map providerId to API key and model name
  if (providerId === "gemini") {
    apiKey = process.env.GEMINI_API_KEY || "";
    modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  } else if (providerId === "claude") {
    apiKey = process.env.CLAUDE_API_KEY || "";
    modelName = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  } else if (providerId === "deepseek") {
    apiKey = process.env.DEEPSEEK_API_KEY || "";
    modelName = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  } else if (providerId === "minimax_m3" || providerId === "minimax") {
    apiKey = process.env.MINIMAX_API_KEY || "";
    modelName = process.env.MINIMAX_MODEL || "MiniMax-M3";
  } else {
    // Default fallback to deepseek config
    apiKey = process.env.DEEPSEEK_API_KEY || "";
    modelName = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  }

  // Fallback chain: if resolved provider has no API key, try next in priority order
  if (!apiKey) {
    const fallbackOrder = ["deepseek", "gemini", "claude"];
    const fallbacks = fallbackOrder.filter(p => p !== providerId);
    for (const fallback of fallbacks) {
      let fallbackKey = "";
      let fallbackModel = "";
      if (fallback === "deepseek") {
        fallbackKey = process.env.DEEPSEEK_API_KEY || "";
        fallbackModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
      } else if (fallback === "gemini") {
        fallbackKey = process.env.GEMINI_API_KEY || "";
        fallbackModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      } else if (fallback === "claude") {
        fallbackKey = process.env.CLAUDE_API_KEY || "";
        fallbackModel = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
      }
      if (fallbackKey) {
        console.log("[PODCHAT_DEBUG] resolveFeatureProvider: primary provider has no key, falling back to:", fallback);
        providerId = fallback;
        apiKey = fallbackKey;
        modelName = fallbackModel;
        break;
      }
    }
  }

  console.log("[PODCHAT_DEBUG] resolveFeatureProvider input source:", sourceUsed);
  console.log("[PODCHAT_DEBUG] resolveFeatureProvider resolved to:", providerId, "| apiKey present:", !!apiKey);
  return { providerId, apiKey, modelName };
}
