import type { FonetikSupabaseClient } from "../supabase";

export type SaveArticleWritingMemoryInput = {
  ownerId: string;
  clientId?: string;
  provider?: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  feedbackLanguage: "English" | "Indonesian";
  articleContext: {
    sourceTitle: string;
    articleBrief: string;
    mainIdea: string;
    keyPoints: string[];
  };
  questions: Array<{
    id: string;
    question: string;
    expectedFocus: string;
    targetSkill: string;
    suggestedWordCount: {
      min: number;
      max: number;
    };
  }>;
  answers: Array<{
    questionId: string;
    answer: string;
  }>;
  evaluation: {
    overallFeedback: string;
    perQuestionFeedback: Array<{
      questionId: string;
      comprehension: string;
      topicRelevance: string;
      grammarNotes: string[];
      wordFormOrPartOfSpeechNotes: string[];
      sentenceStructureNotes: string[];
      coherenceNotes: string[];
      vocabularyNotes: string[];
      improvedAnswerExample: string;
    }>;
    recurringErrors: Array<{
      label: string;
      explanation: string;
      exampleFromUser: string;
      correction: string;
    }>;
    nextWritingFocus: string;
  };
};

export async function saveArticleWritingMemory(
  input: SaveArticleWritingMemoryInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  // 1. Validate input defensively
  if (!input.ownerId || typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (!input.level || !["Beginner", "Intermediate", "Advanced"].includes(input.level)) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (!input.feedbackLanguage || !["English", "Indonesian"].includes(input.feedbackLanguage)) {
    return { ok: false, error: "memory_save_failed" };
  }
  if (!input.answers || !Array.isArray(input.answers) || input.answers.length !== 5) {
    return { ok: false, error: "memory_save_failed" };
  }
  for (const ans of input.answers) {
    if (!ans.questionId || typeof ans.questionId !== "string" || ans.questionId.trim().length === 0) {
      return { ok: false, error: "memory_save_failed" };
    }
    if (typeof ans.answer !== "string" || ans.answer.length === 0 || ans.answer.length > 1200) {
      return { ok: false, error: "memory_save_failed" };
    }
  }

  try {
    // 2. Insert one row into article_writing_sessions
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("article_writing_sessions")
      .insert({
        owner_id: input.ownerId,
        client_id: input.clientId || null,
        level: input.level,
        feedback_language: input.feedbackLanguage,
        article_context: input.articleContext,
        questions: input.questions,
        evaluation: input.evaluation,
        provider: input.provider || null,
      })
      .select("id")
      .single();

    if (sessionError || !sessionData) {
      return { ok: false, error: "memory_save_failed" };
    }

    const sessionId = sessionData.id;

    // 3. Insert five rows into article_writing_answers
    const answerRows = input.answers.map((ans) => ({
      session_id: sessionId,
      owner_id: input.ownerId,
      question_id: ans.questionId,
      answer: ans.answer,
    }));

    const { error: answersError } = await supabaseClient
      .from("article_writing_answers")
      .insert(answerRows);

    if (answersError) {
      // Rollback the created session row if child answers insert fails
      await supabaseClient.from("article_writing_sessions").delete().eq("id", sessionId);
      return { ok: false, error: "memory_save_failed" };
    }

    // 4. Extract recurringErrors from evaluation and insert normalized rows into learner_error_patterns
    const recurringErrors = input.evaluation.recurringErrors || [];
    if (recurringErrors.length > 0) {
      const errorRows = recurringErrors.map((err) => ({
        owner_id: input.ownerId,
        source_kind: "article_writing",
        source_id: sessionId,
        category: (err.label || "").trim() || "Writing Error",
        label: (err.label || "").trim() || "Writing Error",
        evidence: err.exampleFromUser || null,
        correction: err.correction || null,
        practice_focus: err.explanation || null,
      }));

      const { error: errorsError } = await supabaseClient
        .from("learner_error_patterns")
        .insert(errorRows);

      if (errorsError) {
        // Decided safe behavior: we do NOT rollback session if error pattern sync fails.
        // The core writing session and all 5 answers were saved successfully.
        // We log and return ok: true.
        console.error("Error pattern insert failed", errorsError);
      }
    }

    return { ok: true, sessionId };
  } catch {
    return { ok: false, error: "memory_save_failed" };
  }
}
