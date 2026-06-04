import type { FonetikSupabaseClient } from "../supabase";

export type SavePodchatMemoryInput = {
  ownerId: string;
  clientId?: string;
  provider?: string;
  topic: "Economics" | "Technology";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  articleContext?: {
    articleTitle: string;
    articleBrief: string;
    mainIdea?: string;
    keyPoints?: string[];
    speakingTaskTitle: string;
    speakingTaskInstruction: string;
    targetStructure?: string[];
    sourceDomain?: string;
  };
  durationSeconds: number;
  elapsedSeconds?: number;
  turns: Array<{
    speaker: "host" | "learner";
    text: string;
  }>;
  evaluation: {
    summary: string;
    corrections: unknown[];
    betterSentences: unknown[];
    vocabularySuggestions: unknown[];
    recurringErrors: unknown[];
    nextPracticeFocus: string;
  };
};

export async function savePodchatMemory(
  input: SavePodchatMemoryInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  // 1. Validate input defensively
  if (!input.ownerId || typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (!input.topic || (input.topic !== "Economics" && input.topic !== "Technology")) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (!input.difficulty || !["Beginner", "Intermediate", "Advanced"].includes(input.difficulty)) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (typeof input.durationSeconds !== "number" || input.durationSeconds <= 0) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (input.elapsedSeconds !== undefined && input.elapsedSeconds !== null) {
    if (typeof input.elapsedSeconds !== "number" || input.elapsedSeconds < 0) {
      return { ok: false, error: "memory_save_failed" };
    }
  }

  // Turns validation
  if (!input.turns || !Array.isArray(input.turns) || input.turns.length === 0 || input.turns.length > 16) {
    return { ok: false, error: "memory_save_failed" };
  }
  let hasHost = false;
  let hasLearner = false;
  for (const turn of input.turns) {
    if (!turn || typeof turn !== "object") {
      return { ok: false, error: "memory_save_failed" };
    }
    if (turn.speaker !== "host" && turn.speaker !== "learner") {
      return { ok: false, error: "memory_save_failed" };
    }
    if (typeof turn.text !== "string" || turn.text.trim().length === 0 || turn.text.length > 1200) {
      return { ok: false, error: "memory_save_failed" };
    }
    if (turn.speaker === "host") hasHost = true;
    if (turn.speaker === "learner") hasLearner = true;
  }
  if (!hasHost || !hasLearner) {
    return { ok: false, error: "memory_save_failed" };
  }

  // Evaluation validation
  if (!input.evaluation || typeof input.evaluation !== "object" || Array.isArray(input.evaluation)) {
    return { ok: false, error: "memory_save_failed" };
  }
  const summary = input.evaluation.summary;
  if (typeof summary !== "string" || summary.trim().length === 0 || summary.length > 800) {
    return { ok: false, error: "memory_save_failed" };
  }
  const nextPracticeFocus = input.evaluation.nextPracticeFocus;
  if (typeof nextPracticeFocus !== "string" || nextPracticeFocus.trim().length === 0 || nextPracticeFocus.length > 300) {
    return { ok: false, error: "memory_save_failed" };
  }

  // Corrections validation & cleaning
  const rawCorrections = input.evaluation.corrections;
  if (!Array.isArray(rawCorrections) || rawCorrections.length > 5) {
    return { ok: false, error: "memory_save_failed" };
  }
  const cleanCorrections = [];
  for (const c of rawCorrections) {
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      return { ok: false, error: "memory_save_failed" };
    }
    const item = c as Record<string, unknown>;
    const original = item.original;
    const improved = item.improved;
    const explanation = item.explanation;
    if (
      typeof original !== "string" || original.trim().length === 0 || original.length > 400 ||
      typeof improved !== "string" || improved.trim().length === 0 || improved.length > 400 ||
      typeof explanation !== "string" || explanation.trim().length === 0 || explanation.length > 400
    ) {
      return { ok: false, error: "memory_save_failed" };
    }
    cleanCorrections.push({
      original: original.trim(),
      improved: improved.trim(),
      explanation: explanation.trim(),
    });
  }

  // Better sentences validation & cleaning
  const rawBetterSentences = input.evaluation.betterSentences;
  if (!Array.isArray(rawBetterSentences) || rawBetterSentences.length > 5) {
    return { ok: false, error: "memory_save_failed" };
  }
  const cleanBetterSentences = [];
  for (const s of rawBetterSentences) {
    if (typeof s !== "string" || s.trim().length === 0 || s.length > 400) {
      return { ok: false, error: "memory_save_failed" };
    }
    cleanBetterSentences.push(s.trim());
  }

  // Vocabulary suggestions validation & cleaning
  const rawVocab = input.evaluation.vocabularySuggestions;
  if (!Array.isArray(rawVocab) || rawVocab.length > 5) {
    return { ok: false, error: "memory_save_failed" };
  }
  const cleanVocab = [];
  for (const v of rawVocab) {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "memory_save_failed" };
    }
    const item = v as Record<string, unknown>;
    const originalOrBasic = item.originalOrBasic;
    const suggestion = item.suggestion;
    const example = item.example;
    if (
      typeof originalOrBasic !== "string" || originalOrBasic.trim().length === 0 || originalOrBasic.length > 300 ||
      typeof suggestion !== "string" || suggestion.trim().length === 0 || suggestion.length > 300 ||
      typeof example !== "string" || example.trim().length === 0 || example.length > 400
    ) {
      return { ok: false, error: "memory_save_failed" };
    }
    cleanVocab.push({
      originalOrBasic: originalOrBasic.trim(),
      suggestion: suggestion.trim(),
      example: example.trim(),
    });
  }

  // Recurring errors validation & cleaning
  const rawErrors = input.evaluation.recurringErrors;
  if (!Array.isArray(rawErrors) || rawErrors.length > 5) {
    return { ok: false, error: "memory_save_failed" };
  }
  const cleanRecurringErrors = [];
  for (const e of rawErrors) {
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      return { ok: false, error: "memory_save_failed" };
    }
    const item = e as Record<string, unknown>;
    const label = item.label;
    const evidence = item.evidence;
    const practiceFocus = item.practiceFocus;
    if (
      typeof label !== "string" || label.trim().length === 0 || label.length > 160 ||
      typeof evidence !== "string" || evidence.trim().length === 0 || evidence.length > 400 ||
      typeof practiceFocus !== "string" || practiceFocus.trim().length === 0 || practiceFocus.length > 300
    ) {
      return { ok: false, error: "memory_save_failed" };
    }
    cleanRecurringErrors.push({
      label: label.trim(),
      evidence: evidence.trim(),
      practiceFocus: practiceFocus.trim(),
    });
  }

  const cleanEvaluation = {
    summary: summary.trim(),
    corrections: cleanCorrections,
    betterSentences: cleanBetterSentences,
    vocabularySuggestions: cleanVocab,
    recurringErrors: cleanRecurringErrors,
    nextPracticeFocus: nextPracticeFocus.trim(),
  };

  // ArticleContext validation & cleaning
  let cleanArticleContext = null;
  if (input.articleContext !== undefined && input.articleContext !== null) {
    const ac = input.articleContext;
    if (typeof ac !== "object" || Array.isArray(ac)) {
      return { ok: false, error: "memory_save_failed" };
    }

    const articleTitle = ac.articleTitle;
    if (typeof articleTitle !== "string" || articleTitle.trim().length === 0 || articleTitle.length > 160) {
      return { ok: false, error: "memory_save_failed" };
    }
    const articleBrief = ac.articleBrief;
    if (typeof articleBrief !== "string" || articleBrief.trim().length === 0 || articleBrief.length > 1200) {
      return { ok: false, error: "memory_save_failed" };
    }

    let mainIdea: string | undefined;
    if (ac.mainIdea !== undefined && ac.mainIdea !== null) {
      if (typeof ac.mainIdea !== "string" || ac.mainIdea.length > 400) {
        return { ok: false, error: "memory_save_failed" };
      }
      mainIdea = ac.mainIdea.trim();
    }

    let keyPoints: string[] | undefined;
    if (ac.keyPoints !== undefined && ac.keyPoints !== null) {
      if (!Array.isArray(ac.keyPoints) || ac.keyPoints.length > 6) {
        return { ok: false, error: "memory_save_failed" };
      }
      keyPoints = [];
      for (const kp of ac.keyPoints) {
        if (typeof kp !== "string" || kp.length > 240) {
          return { ok: false, error: "memory_save_failed" };
        }
        keyPoints.push(kp.trim());
      }
    }

    const speakingTaskTitle = ac.speakingTaskTitle;
    if (typeof speakingTaskTitle !== "string" || speakingTaskTitle.trim().length === 0 || speakingTaskTitle.length > 160) {
      return { ok: false, error: "memory_save_failed" };
    }
    const speakingTaskInstruction = ac.speakingTaskInstruction;
    if (typeof speakingTaskInstruction !== "string" || speakingTaskInstruction.trim().length === 0 || speakingTaskInstruction.length > 800) {
      return { ok: false, error: "memory_save_failed" };
    }

    let targetStructure: string[] | undefined;
    if (ac.targetStructure !== undefined && ac.targetStructure !== null) {
      if (!Array.isArray(ac.targetStructure) || ac.targetStructure.length > 6) {
        return { ok: false, error: "memory_save_failed" };
      }
      targetStructure = [];
      for (const ts of ac.targetStructure) {
        if (typeof ts !== "string" || ts.length > 160) {
          return { ok: false, error: "memory_save_failed" };
        }
        targetStructure.push(ts.trim());
      }
    }

    let sourceDomain: string | undefined;
    if (ac.sourceDomain !== undefined && ac.sourceDomain !== null) {
      if (typeof ac.sourceDomain !== "string" || ac.sourceDomain.length > 160) {
        return { ok: false, error: "memory_save_failed" };
      }
      sourceDomain = ac.sourceDomain.trim();
    }

    cleanArticleContext = {
      articleTitle: articleTitle.trim(),
      articleBrief: articleBrief.trim(),
      mainIdea,
      keyPoints,
      speakingTaskTitle: speakingTaskTitle.trim(),
      speakingTaskInstruction: speakingTaskInstruction.trim(),
      targetStructure,
      sourceDomain,
    };
  }

  try {
    // 2. Insert one row into podchat_sessions
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("podchat_sessions")
      .insert({
        owner_id: input.ownerId,
        client_id: input.clientId || null,
        topic: input.topic,
        difficulty: input.difficulty,
        article_context: cleanArticleContext,
        duration_seconds: input.durationSeconds,
        elapsed_seconds: input.elapsedSeconds !== undefined ? input.elapsedSeconds : null,
        evaluation: cleanEvaluation,
        provider: input.provider || null,
      })
      .select("id")
      .single();

    if (sessionError || !sessionData) {
      return { ok: false, error: "memory_save_failed" };
    }

    const sessionId = sessionData.id;

    // 3. Insert all text turns into podchat_turns
    const turnRows = input.turns.map((turn, index) => ({
      session_id: sessionId,
      owner_id: input.ownerId,
      turn_index: index,
      speaker: turn.speaker,
      text: turn.text.trim(),
    }));

    const { error: turnsError } = await supabaseClient
      .from("podchat_turns")
      .insert(turnRows);

    if (turnsError) {
      // Rollback the created session row if child turns insert fails
      await supabaseClient.from("podchat_sessions").delete().eq("id", sessionId);
      return { ok: false, error: "memory_save_failed" };
    }

    // 4. Extract recurringErrors from evaluation and insert normalized rows into learner_error_patterns
    const recurringErrors = cleanEvaluation.recurringErrors || [];
    if (recurringErrors.length > 0) {
      const errorRows = recurringErrors.map((err) => ({
        owner_id: input.ownerId,
        source_kind: "podchat",
        source_id: sessionId,
        category: (err.label || "").trim() || "Speaking Error",
        label: (err.label || "").trim() || "Speaking Error",
        evidence: err.evidence || null,
        correction: null,
        practice_focus: err.practiceFocus || null,
      }));

      const { error: errorsError } = await supabaseClient
        .from("learner_error_patterns")
        .insert(errorRows);

      if (errorsError) {
        // Log error, but do not rollback session
        console.error("Error pattern insert failed", errorsError);
      }
    }

    return { ok: true, sessionId };
  } catch {
    return { ok: false, error: "memory_save_failed" };
  }
}
