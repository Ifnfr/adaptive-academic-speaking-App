import {
  buildCompactAurInput,
  buildFallbackUnderstandingState,
  parseUnderstandingStateJson,
} from "../../../../lib/podchat-aur/analysis";
import type {
  CommonplaceMapAurInput,
  ContextUnderstandingState,
  PodchatAurInput,
} from "../../../../lib/podchat-aur/types";

type HandlerDeps = {
  callDeepSeekJson?: (systemPrompt: string, userPrompt: string) => Promise<string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 18_000;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function hasForbiddenRequestField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenRequestField(item));
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (/^(ownerId|owner_id|userId|user_id|provider|model|rawPrompt|rawInput|rawOutput|prompt)$/i.test(key)) {
      return true;
    }
  }
  return false;
}

function readAurInput(body: Record<string, unknown>): PodchatAurInput | null {
  const sourceType = body.sourceType;
  const context = body.context;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const c = context as Record<string, unknown>;

  if (sourceType === "article") {
    return {
      sourceType: "article",
      articleTitle: typeof c.articleTitle === "string" ? c.articleTitle : undefined,
      articleBrief: typeof c.articleBrief === "string" ? c.articleBrief : undefined,
      mainIdea: typeof c.mainIdea === "string" ? c.mainIdea : undefined,
      keyPoints: Array.isArray(c.keyPoints) ? c.keyPoints.filter((item): item is string => typeof item === "string") : undefined,
      speakingTaskTitle: typeof c.speakingTaskTitle === "string" ? c.speakingTaskTitle : undefined,
      speakingTaskInstruction: typeof c.speakingTaskInstruction === "string" ? c.speakingTaskInstruction : undefined,
      targetStructure: Array.isArray(c.targetStructure) ? c.targetStructure.filter((item): item is string => typeof item === "string") : undefined,
      sourceDomain: typeof c.sourceDomain === "string" ? c.sourceDomain : undefined,
    };
  }

  if (sourceType === "commonplace_note") {
    return {
      sourceType: "commonplace_note",
      noteId: typeof c.noteId === "string" ? c.noteId : undefined,
      shortcode: typeof c.shortcode === "string" ? c.shortcode : undefined,
      title: typeof c.title === "string" ? c.title : undefined,
      sourceBook: typeof c.sourceBook === "string" ? c.sourceBook : undefined,
      insight: typeof c.insight === "string" ? c.insight : undefined,
      tags: Array.isArray(c.tags) ? c.tags.filter((item): item is string => typeof item === "string") : undefined,
    };
  }

  if (sourceType === "commonplace_map") {
    const counts =
      c.counts && typeof c.counts === "object" && !Array.isArray(c.counts)
        ? (c.counts as CommonplaceMapAurInput["counts"])
        : undefined;
    return {
      sourceType: "commonplace_map",
      mapType: c.mapType === "main" ? "main" : "sub",
      mapId: typeof c.mapId === "string" ? c.mapId : undefined,
      mapTitle: typeof c.mapTitle === "string" ? c.mapTitle : undefined,
      counts,
      nodes: Array.isArray(c.nodes) ? (c.nodes as CommonplaceMapAurInput["nodes"]) : undefined,
      edges: Array.isArray(c.edges) ? (c.edges as CommonplaceMapAurInput["edges"]) : undefined,
    };
  }

  return null;
}

function buildSystemPrompt(): string {
  return [
    "You analyze bounded learning context for a Socratic academic speaking discussion.",
    "Return only one JSON object. No markdown, no commentary.",
    "Do not include provider, model, owner, prompt, transcript, raw source snapshot, or raw learner identifiers.",
    "Do not include raw long source text.",
    "For Article context, identify thesis/main claim, evidence, key concepts, assumptions, implications, counterarguments, likely learner problem, and discussion path.",
    "For Commonplace note context, identify central concept, linked concepts, gaps, assumptions, misconceptions/examples, and discussion path.",
    "For Commonplace map context, use the compact focus nodes and edges, choose 3 to 7 focus concepts, and include exclusions.",
    "JSON shape: { sourceType, discussionFocus, keyConcepts, evidenceOrExamples, assumptionsToTest, implications, counterarguments, learnerLikelyProblem, discussionPath, scope:{include,exclude}, closureCriteria, coverageState }.",
    "coverageState must contain booleans for mainIdeaExplored, evidenceExplored, implicationsExplored, learnerPositionFormed, counterargumentExplored, synthesisCompleted.",
  ].join("\n");
}

function buildUserPrompt(input: PodchatAurInput): string {
  return [
    "BOUNDED CONTEXT:",
    JSON.stringify(buildCompactAurInput(input)),
    "",
    "Analyze this context for a temporary session-only Understanding State.",
  ].join("\n");
}

async function callDefaultDeepSeekJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("podchat_context_analysis_unavailable");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error("podchat_context_analysis_failed");
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("podchat_context_analysis_invalid");
  }
  return text;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("podchat_context_analysis_timeout")), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function safeFallback(input: PodchatAurInput): { understandingState: ContextUnderstandingState } {
  return { understandingState: buildFallbackUnderstandingState(input) };
}

export function createPodchatContextAnalyzeHandlers(deps: HandlerDeps = {}) {
  const callDeepSeekJson = deps.callDeepSeekJson ?? callDefaultDeepSeekJson;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async POST(request: Request) {
      let parsedBody: unknown;
      try {
        parsedBody = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        return json({ error: "Invalid request body." }, 400);
      }
      if (hasForbiddenRequestField(parsedBody)) {
        return json({ error: "Invalid request body." }, 400);
      }

      const body = parsedBody as Record<string, unknown>;
      if (body.sessionMode !== "context_open_ended") {
        return json({ error: "Context analysis is only available for context discussions." }, 400);
      }

      const input = readAurInput(body);
      if (!input) return json({ error: "Invalid context." }, 400);

      try {
        const text = await withTimeout(
          callDeepSeekJson(buildSystemPrompt(), buildUserPrompt(input)),
          timeoutMs,
        );
        return json({
          understandingState: parseUnderstandingStateJson(text, input),
        });
      } catch {
        return json(safeFallback(input));
      }
    },
  };
}
