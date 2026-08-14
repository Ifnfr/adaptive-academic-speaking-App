// supabase/functions/listening-generate/index.ts
//
// Edge Function: EXECUTOR for listening exercise generation.
// The Vercel app orchestrates (builds prompts, drives the plan->content
// cascade via client polling) and fires this function with one job per call.
// This function runs the LONG AI call (up to 150s edge timeout, vs 60s on
// Vercel) and writes the result directly to the database via PostgREST.
//
// Secrets (Dashboard -> Edge Functions -> Secrets, then REDEPLOY):
//   TOKENROUTER_API_KEY   (required)
//   TOKENROUTER_BASE_URL  (optional, default https://api.tokenrouter.com/v1)
//   TOKENROUTER_MODEL     (optional, default deepseek/deepseek-v4-flash-0731)
//
// Two job kinds:
//   kind="plan"    -> generate ONLY the session plan; write generation_plan
//                     to the session row; reset section 0 to 'pending'.
//   kind="content" -> generate ONE section's content; write it to the section.
//
// Claim protocol: section must be 'pending' -> atomically 'generating'.
// Only one process may claim; a duplicate call returns claimed:false.

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
// SRV_ROLE_KEY is set explicitly via `supabase secrets set` (the CLI refuses
// SUPABASE_-prefixed names and the auto-injected service key can be stale).
const SERVICE_ROLE = (Deno.env.get("SRV_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
const TR_KEY = Deno.env.get("TOKENROUTER_API_KEY") ?? "";
const TR_BASE = (Deno.env.get("TOKENROUTER_BASE_URL") ?? "https://api.tokenrouter.com/v1").replace(/\/+$/, "");
const TR_MODEL = Deno.env.get("TOKENROUTER_MODEL") ?? "deepseek/deepseek-v4-flash-0731";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function pg(method: string, path: string, body?: unknown): Promise<{ data: unknown; error: string | null }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `PostgREST ${res.status}: ${text.slice(0, 300)}` };
    }
    const text = await res.text();
    return { data: text ? JSON.parse(text) : null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

async function callTokenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!TR_KEY) {
    throw new Error("TOKENROUTER_API_KEY is not set in edge function secrets.");
  }
  const endpoint = TR_BASE.endsWith("/chat/completions") ? TR_BASE : `${TR_BASE}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 140000); // under the 150s edge cap

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TR_KEY}`,
      },
      body: JSON.stringify({
        model: TR_MODEL,
        temperature: 0.2,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TokenRouter request failed: ${res.status} ${text.slice(0, 400)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("TokenRouter returned empty content.");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function claimSection(sectionId: string): Promise<boolean> {
  const claim = await pg(
    "PATCH",
    `listening_exercise_sections?id=eq.${encodeURIComponent(sectionId)}&generation_status=eq.pending`,
    { generation_status: "generating" },
  );
  return !claim.error && Array.isArray(claim.data) && claim.data.length > 0;
}

async function markError(sectionId: string, message: string): Promise<void> {
  await pg(
    "PATCH",
    `listening_exercise_sections?id=eq.${encodeURIComponent(sectionId)}`,
    {
      generation_status: "error",
      generation_error: message,
      generation_error_raw_response: null,
    },
  );
}

// kind="plan": generate only the plan, store on session, release section 0
async function handlePlan(body: Record<string, unknown>): Promise<Response> {
  const {
    ownerId,
    sessionId,
    sectionId,
    systemPrompt,
    userPrompt,
    assignedTopics,
    difficulty,
  } = body as {
    ownerId: string;
    sessionId: string;
    sectionId: string;
    systemPrompt: string;
    userPrompt: string;
    assignedTopics: Array<{ domainId: string; topic: string }>;
    difficulty: "easy" | "medium" | "hard";
  };

  if (!sessionId || !sectionId || !systemPrompt || !userPrompt) {
    return json({ ok: false, error: "Missing required fields." }, 400);
  }

  if (!(await claimSection(sectionId))) {
    return json({ ok: true, claimed: false, status: "already_running" });
  }

  try {
    const aiText = await callTokenRouter(systemPrompt, userPrompt);
    const jsonText = extractJsonObject(aiText);
    if (!jsonText) {
      throw new Error("AI provider returned invalid JSON formatting.");
    }

    const parsed = JSON.parse(jsonText) as {
      plan?: {
        difficulty?: string;
        sections?: Array<{
          section_index?: number;
          cefr_level?: string;
          topic?: string;
          domain?: string;
          question_types?: string[];
        }>;
        [key: string]: unknown;
      };
    };

    if (!parsed.plan || !Array.isArray(parsed.plan.sections) || parsed.plan.sections.length === 0) {
      throw new Error("AI provider JSON missing valid 'plan' field.");
    }

    // Apply topic overrides from the app's domain selection
    const plan = parsed.plan;
    plan.sections = plan.sections.map((s, idx) => {
      const targetIndex = typeof s.section_index === "number" ? s.section_index : idx;
      const assigned = Array.isArray(assignedTopics)
        ? assignedTopics[targetIndex] || assignedTopics[idx]
        : undefined;
      return {
        ...s,
        topic: assigned ? assigned.topic : s.topic,
        domain: assigned ? assigned.domainId : s.domain,
      };
    });
    plan.difficulty = difficulty;

    const up = await pg(
      "PATCH",
      `listening_exercise_sessions?id=eq.${encodeURIComponent(sessionId)}`,
      { generation_plan: plan },
    );
    if (up.error) {
      throw new Error(up.error);
    }

    // Release section 0 so the content job can claim it next
    await pg(
      "PATCH",
      `listening_exercise_sections?id=eq.${encodeURIComponent(sectionId)}&generation_status=eq.generating`,
      { generation_status: "pending" },
    );

    return json({ ok: true, claimed: true, status: "plan_ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("listening-generate (plan) failed:", message);
    await markError(sectionId, message);
    return json({ ok: false, claimed: true, status: "error", error: message }, 200);
  }
}

// kind="content": generate one section's content and write it
async function handleContent(body: Record<string, unknown>): Promise<Response> {
  const {
    sessionId,
    sectionId,
    sectionIndex,
    systemPrompt,
    userPrompt,
    sectionTopicOverride,
  } = body as {
    sessionId: string;
    sectionId: string;
    sectionIndex: number;
    systemPrompt: string;
    userPrompt: string;
    sectionTopicOverride?: string;
  };

  if (!sessionId || !sectionId || !systemPrompt || !userPrompt) {
    return json({ ok: false, error: "Missing required fields." }, 400);
  }

  if (!(await claimSection(sectionId))) {
    return json({ ok: true, claimed: false, status: "already_running" });
  }

  try {
    const aiText = await callTokenRouter(systemPrompt, userPrompt);
    const jsonText = extractJsonObject(aiText);
    if (!jsonText) {
      throw new Error("AI provider returned invalid JSON formatting.");
    }

    const parsed = JSON.parse(jsonText) as {
      section?: {
        topic?: string;
        audio_script?: string;
        fact_units?: unknown[];
        questions?: unknown[];
        pre_listening_prompt?: string;
      };
    };

    const section = parsed.section;
    if (!section) {
      throw new Error("AI provider JSON missing 'section' field.");
    }
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      throw new Error("AI provider JSON missing or empty 'questions' array.");
    }
    if (!Array.isArray(section.fact_units) || section.fact_units.length === 0) {
      throw new Error("AI provider JSON missing or empty 'fact_units' array.");
    }

    const topic = sectionTopicOverride || section.topic || `Section ${sectionIndex + 1}`;

    const update = await pg(
      "PATCH",
      `listening_exercise_sections?id=eq.${encodeURIComponent(sectionId)}`,
      {
        topic,
        audio_script: section.audio_script,
        fact_units: section.fact_units,
        questions: section.questions,
        pre_listening_prompt: section.pre_listening_prompt ?? null,
        generation_status: "ready",
        generation_error: null,
        generation_error_raw_response: null,
      },
    );

    if (update.error) {
      throw new Error(update.error);
    }

    return json({ ok: true, claimed: true, status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("listening-generate (content) failed:", message);
    await markError(sectionId, message);
    return json({ ok: false, claimed: true, status: "error", error: message }, 200);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Caller must present the service role key
  const auth = req.headers.get("authorization") ?? "";
  if (SERVICE_ROLE && auth !== `Bearer ${SERVICE_ROLE}`) {
    // Debug: reveal only the last 4 chars of the expected key so we can
    // detect a stale/auto-injected mismatch without exposing the secret.
    const tail = SERVICE_ROLE.length >= 4 ? SERVICE_ROLE.slice(-4) : "";
    return json({ error: "Unauthorized", expected_tail: tail }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const kind = body.kind;
  if (kind === "plan") return handlePlan(body);
  if (kind === "content") return handleContent(body);
  return json({ error: "Unknown kind. Must be 'plan' or 'content'." }, 400);
});
