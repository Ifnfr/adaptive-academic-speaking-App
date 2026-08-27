import { createClient } from "@supabase/supabase-js";
import {
  callListeningAI,
  buildSection1SystemPrompt,
  buildSection1UserPrompt,
  buildNextSectionSystemPrompt,
  buildNextSectionUserPrompt,
  extractJsonObject,
} from "./providers";
import { selectSessionDomains } from "./topic-domains";
import { getWeakestEligibleSubSkill } from "../../../lib/listening-exercise/metrics";

/**
 * Generates Section 1 content for a listening session.
 *
 * Claim protocol: the section must be in 'pending' state. This function
 * atomically flips it to 'generating' — only ONE process may generate.
 * Used by both:
 *   1. session/start (inside waitUntil, best-effort background)
 *   2. session/[sessionId]/status (inline fallback when waitUntil was killed)
 */
export async function generateSection1Content(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: {
    ownerId: string;
    sessionId: string;
    sectionId: string;
    cefrLevel: string;
    sectionCount: number;
    isPlacement: boolean;
    resolvedDifficulty: "easy" | "medium" | "hard";
  },
): Promise<{ claimed: boolean; status?: "ready" | "error" }> {
  const {
    ownerId,
    sessionId,
    sectionId,
    cefrLevel,
    sectionCount,
    isPlacement,
    resolvedDifficulty,
  } = params;

  // Atomic claim: only the first caller proceeds
  const { data: claimRows, error: claimError } = await supabase
    .from("listening_exercise_sections")
    .update({ generation_status: "generating" })
    .eq("id", sectionId)
    .eq("generation_status", "pending")
    .select("id");

  if (claimError || !claimRows || claimRows.length === 0) {
    return { claimed: false };
  }

  let aiResponseText: string | undefined;

  try {
    let historySummary = "";
    const recentSessions: Array<{
      createdAt: string;
      sections: Array<{ domainId: string; topic: string }>;
    }> = [];

    if (!isPlacement) {
      const { data: history } = await supabase
        .from("listening_exercise_sessions")
        .select("cefr_level, overall_score, estimated_band, generation_plan, created_at")
        .eq("owner_id", ownerId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(30);

      if (history && history.length > 0) {
        historySummary = history
          .slice(0, 3)
          .map(
            (h: any, i: number) =>
              `Attempt ${i + 1}: CEFR Level = ${h.cefr_level}, Overall Score = ${h.overall_score}%, Estimated Band = ${h.estimated_band}`,
          )
          .join("\n");

        for (const row of history) {
          const plan = row.generation_plan as { sections?: Array<{ topic?: string; domain?: string }> } | null;
          const sections: Array<{ domainId: string; topic: string }> = [];
          if (plan?.sections && Array.isArray(plan.sections)) {
            for (const s of plan.sections) {
              if (
                s?.domain &&
                typeof s.domain === "string" &&
                s.domain.trim().length > 0 &&
                s?.topic &&
                typeof s.topic === "string" &&
                s.topic.trim().length > 0
              ) {
                sections.push({
                  domainId: s.domain.trim(),
                  topic: s.topic.trim(),
                });
              }
            }
          }
          if (row.created_at) {
            recentSessions.push({ createdAt: row.created_at, sections });
          }
        }
      }
    }

    const assignedTopics = selectSessionDomains(recentSessions, 3);

    let weakSubSkill: string | null = null;
    if (!isPlacement) {
      weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
    }

    const systemPrompt = buildSection1SystemPrompt(resolvedDifficulty);
    const userPrompt = buildSection1UserPrompt(
      cefrLevel,
      sectionCount,
      isPlacement,
      historySummary,
      weakSubSkill,
      assignedTopics,
    );

    aiResponseText = await callListeningAI(systemPrompt, userPrompt);
    const jsonText = extractJsonObject(aiResponseText);

    if (!jsonText) {
      throw new Error("AI provider returned invalid JSON formatting.");
    }

    const parsedPayload = JSON.parse(jsonText) as {
      plan?: {
        difficulty?: "easy" | "medium" | "hard";
        sections?: Array<{
          section_index?: number;
          cefr_level?: string;
          topic?: string;
          domain?: string;
          question_types?: string[];
        }>;
        [key: string]: unknown;
      };
      section?: {
        topic?: string;
        audio_script?: string;
        fact_units?: unknown[];
        questions?: unknown[];
        pre_listening_prompt?: string;
      };
    };

    if (!parsedPayload.plan || !parsedPayload.section) {
      throw new Error("AI provider JSON missing 'plan' or 'section' fields.");
    }

    const qs = parsedPayload.section.questions;
    const fu = parsedPayload.section.fact_units;
    if (!Array.isArray(qs) || qs.length === 0) {
      throw new Error("AI provider JSON missing or empty 'questions' array.");
    }
    if (!Array.isArray(fu) || fu.length === 0) {
      throw new Error("AI provider JSON missing or empty 'fact_units' array.");
    }

    // Override each entry in payload.plan.sections so topic and domain come from assignedTopics
    if (parsedPayload.plan.sections && Array.isArray(parsedPayload.plan.sections)) {
      parsedPayload.plan.sections = parsedPayload.plan.sections.map((s, idx) => {
        const targetIndex = typeof s.section_index === "number" ? s.section_index : idx;
        const assigned = assignedTopics[targetIndex] || assignedTopics[idx];
        return {
          ...s,
          topic: assigned ? assigned.topic : s.topic,
          domain: assigned ? assigned.domainId : s.domain,
        };
      });
    }

    parsedPayload.plan.difficulty = resolvedDifficulty;

    if (assignedTopics[0] && parsedPayload.section) {
      parsedPayload.section.topic = assignedTopics[0].topic;
    }

    const { error: sessionUpdateError } = await supabase
      .from("listening_exercise_sessions")
      .update({ generation_plan: parsedPayload.plan })
      .eq("id", sessionId);

    if (sessionUpdateError) {
      throw sessionUpdateError;
    }

    const { error: sectionUpdateError } = await supabase
      .from("listening_exercise_sections")
      .update({
        topic: parsedPayload.section.topic || "Section 1",
        audio_script: parsedPayload.section.audio_script,
        fact_units: parsedPayload.section.fact_units,
        questions: parsedPayload.section.questions,
        pre_listening_prompt: parsedPayload.section.pre_listening_prompt,
        generation_status: "ready",
      })
      .eq("id", sectionId);

    if (sectionUpdateError) {
      throw sectionUpdateError;
    }

    return { claimed: true, status: "ready" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Listening section generation failed:", message);
    await supabase
      .from("listening_exercise_sections")
      .update({
        generation_status: "error",
        generation_error: message,
        generation_error_raw_response: aiResponseText ?? null,
      })
      .eq("id", sectionId);
    return { claimed: true, status: "error" };
  }
}

/**
 * Generates content for sections 2..N (multiple_choice / true_false).
 * Same claim protocol as generateSection1Content: only one process may
 * generate. Plan info (topic, level, question types, difficulty) is
 * derived from the session's generation_plan.
 */
export async function generateNextSectionContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: {
    ownerId: string;
    sessionId: string;
    sectionId: string;
    sectionIndex: number;
    isPlacement: boolean;
  },
): Promise<{ claimed: boolean; status?: "ready" | "error" }> {
  const { ownerId, sessionId, sectionId, sectionIndex, isPlacement } = params;

  // Atomic claim
  const { data: claimRows, error: claimError } = await supabase
    .from("listening_exercise_sections")
    .update({ generation_status: "generating" })
    .eq("id", sectionId)
    .eq("generation_status", "pending")
    .select("id");

  if (claimError || !claimRows || claimRows.length === 0) {
    return { claimed: false };
  }

  let aiResponseText: string | undefined;

  try {
    // Derive plan info from the session generation_plan
    const { data: sessionRow } = await supabase
      .from("listening_exercise_sessions")
      .select("cefr_level, is_placement, generation_plan")
      .eq("id", sessionId)
      .eq("owner_id", ownerId)
      .single();

    const plan = (sessionRow?.generation_plan ?? {}) as {
      difficulty?: "easy" | "medium" | "hard";
      sections?: Array<{
        section_index?: number;
        cefr_level?: string;
        topic?: string;
        question_types?: string[];
      }>;
    };

    const planSection = plan?.sections?.find((s) => s.section_index === sectionIndex);
    const targetLevel = planSection?.cefr_level || sessionRow?.cefr_level || "B2";
    const targetTopic = planSection?.topic || `Section ${sectionIndex + 1}`;
    const targetQuestionTypes = planSection?.question_types || ["fill_blank"];
    const targetDifficulty = plan?.difficulty ?? "medium";

    let weakSubSkill: string | null = null;
    if (!(sessionRow?.is_placement === true) && !isPlacement) {
      weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
    }

    const questionType = targetQuestionTypes[0] || "fill_blank";
    const systemPrompt = buildNextSectionSystemPrompt(questionType, targetDifficulty, sectionIndex);
    const userPrompt = buildNextSectionUserPrompt(
      sectionIndex,
      targetLevel,
      targetTopic,
      targetQuestionTypes,
      weakSubSkill,
    );

    aiResponseText = await callListeningAI(systemPrompt, userPrompt);
    const jsonText = extractJsonObject(aiResponseText);

    if (!jsonText) {
      throw new Error("AI provider returned invalid JSON formatting.");
    }

    const parsedPayload = JSON.parse(jsonText) as {
      section?: {
        topic?: string;
        audio_script?: string;
        fact_units?: unknown[];
        questions?: unknown[];
        pre_listening_prompt?: string;
      };
    };

    if (!parsedPayload.section) {
      throw new Error("AI provider JSON missing 'section' field.");
    }

    const qs = parsedPayload.section.questions;
    const fu = parsedPayload.section.fact_units;
    if (!Array.isArray(qs) || qs.length === 0) {
      throw new Error("AI provider JSON missing or empty 'questions' array.");
    }
    if (!Array.isArray(fu) || fu.length === 0) {
      throw new Error("AI provider JSON missing or empty 'fact_units' array.");
    }

    const { error: sectionUpdateError } = await supabase
      .from("listening_exercise_sections")
      .update({
        topic: parsedPayload.section.topic || targetTopic,
        audio_script: parsedPayload.section.audio_script,
        fact_units: parsedPayload.section.fact_units,
        questions: parsedPayload.section.questions,
        pre_listening_prompt: parsedPayload.section.pre_listening_prompt,
        generation_status: "ready",
      })
      .eq("id", sectionId);

    if (sectionUpdateError) {
      throw sectionUpdateError;
    }

    return { claimed: true, status: "ready" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Listening next section generation failed:", message);
    await supabase
      .from("listening_exercise_sections")
      .update({
        generation_status: "error",
        generation_error: message,
        generation_error_raw_response: aiResponseText ?? null,
      })
      .eq("id", sectionId);
    return { claimed: true, status: "error" };
  }
}
