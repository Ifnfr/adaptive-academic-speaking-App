"use client"
import { useState, useEffect, use } from "react"
import Link from "next/link"

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface SessionDetail {
  session: {
    id: string
    started_at: string
    completed_at: string | null
    prompts_attempted: number
    prompts_correct_first_try: number
  }
  attempts: AttemptDetail[]
  notes: NoteDetail[]
}

interface AttemptDetail {
  id: string
  prompt_id: string
  prompt_text: string | null
  prompt_mode: string
  attempt_text: string
  corrected_sentence: string | null
  user_analysis: string | null
  analysis_feedback: string | null
  is_correct: boolean
  attempt_number: number
  hints_used: number
  is_echo_attempt: boolean
  created_at: string
  errors: ErrorDetail[]
}

interface ErrorDetail {
  id: string
  category: string
  severity: string
  resolved: boolean
  hints_used_for_error: number
}

interface NoteDetail {
  id: string
  attempt_id: string | null
  word: string
  note_text: string
  created_at: string
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

// ─── Predefined Grammar Rules for Categories ───────────────────────────────

const CATEGORY_RULES: Record<string, string> = {
  auxiliary_verb: "Auxiliary verbs (be, do, have, will, can, should, must) support the main verb. Continuous tenses require 'be' before -ing, and modal verbs require the bare infinitive.",
  subject_verb_agreement: "The verb must agree with its subject in number. Singular subjects take a verb ending in -s in the present tense, while plural subjects take the base form.",
  tense: "Verb tenses must be consistent and appropriate for the context (e.g., simple present for general truths, simple past for completed actions).",
  article: "Use 'a'/'an' for non-specific singular count nouns, 'the' for specific nouns, and no article for general plurals or abstract concepts.",
  preposition: "Prepositions show relationships of location, time, direction, or manner. Use 'at', 'in', 'on', etc., correctly according to standard usage.",
  word_order: "English follows Subject-Verb-Object (SVO) order. Adjectives go before nouns, and frequency adverbs usually go before main verbs but after 'be'.",
  verb_form: "Verbs must use the correct form (infinitive, gerund, participle) based on their function or the preceding verb/preposition."
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionHistoryPage({ params }: PageProps) {
  const { sessionId } = use(params);

  const [sessionData, setSessionData] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/word-builder/history/${sessionId}`);
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("You do not have permission to view this session.");
          }
          if (res.status === 404) {
            throw new Error("The requested practice session was not found.");
          }
          throw new Error("Failed to fetch session history details.");
        }
        const data = await res.json();
        setSessionData(data);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred while loading history.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // ─── Loading State ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="animate-pulse text-lg">Loading session...</div>
      </div>
    );
  }

  // ─── Error State ───
  if (error || !sessionData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error || "Unable to display session details."}
          </div>
          <Link
            href="/word-builder/practice"
            className="inline-block px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-sm"
          >
            ← Back to Practice Mode
          </Link>
        </div>
      </div>
    );
  }

  // ─── Data Grouping ───
  const mainAttempts = sessionData.attempts;

  // Group main attempts by prompt_id while maintaining chronological order
  interface PromptGroup {
    promptId: string;
    promptText: string;
    promptMode: string;
    attempts: AttemptDetail[];
  }

  const groups: PromptGroup[] = [];
  mainAttempts.forEach((attempt) => {
    let group = groups.find((g) => g.promptId === attempt.prompt_id);
    if (!group) {
      group = {
        promptId: attempt.prompt_id,
        promptText: attempt.prompt_text || "Grammar Prompt",
        promptMode: attempt.prompt_mode,
        attempts: [],
      };
      groups.push(group);
    }
    group.attempts.push(attempt);
  });

  // Sort attempts within each group by attempt_number
  groups.forEach((g) => {
    g.attempts.sort((a, b) => a.attempt_number - b.attempt_number);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 h-14">
          <Link
            href="/word-builder/practice"
            className="text-zinc-400 hover:text-zinc-100 flex items-center gap-1 text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
          <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
            Session History
          </h1>
          <div className="text-sm text-zinc-400">
            {isMounted && sessionData.session.started_at ? formatDate(sessionData.session.started_at) : ""}
          </div>
        </div>
      </header>

      {/* Session stats bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 py-6">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Prompts Attempted</p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{sessionData.session.prompts_attempted}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Correct First Try</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{sessionData.session.prompts_correct_first_try}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Session Date</p>
            <p className="text-lg font-semibold text-zinc-200 mt-1">
              {isMounted ? formatDate(sessionData.session.started_at) : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</p>
            <div className="mt-1">
              {sessionData.session.completed_at ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Complete
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Incomplete
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {groups.map((group, groupIdx) => {
          const isGroupCorrect = group.attempts.some((a) => a.is_correct);
          const attemptWithCorrection = group.attempts.find((a) => a.corrected_sentence);
          const attemptWithAnalysis = group.attempts.find((a) => a.user_analysis);
          const attemptIdsInGroup = group.attempts.map((a) => a.id);
          const groupNotes = sessionData.notes.filter(
            (n) => n.attempt_id && attemptIdsInGroup.includes(n.attempt_id)
          );

          // Get unique error categories
          const groupErrors = group.attempts.flatMap((a) => a.errors || []);
          const uniqueCategories = Array.from(new Set(groupErrors.map((e) => e.category)));

          return (
            <div
              key={group.promptId}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-6"
            >
              {/* PROMPT HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    Prompt {groupIdx + 1} ({group.promptMode.replace("_", " ")})
                  </span>
                  <p className="text-lg font-medium text-zinc-100 leading-relaxed">
                    {group.promptText}
                  </p>
                </div>
                <div className="shrink-0">
                  {isGroupCorrect ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Correct ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Needs work
                    </span>
                  )}
                </div>
              </div>

              {/* ATTEMPTS LIST */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Attempts</h4>
                <div className="space-y-3">
                  {group.attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-start justify-between gap-4 bg-zinc-950/40 border border-zinc-800/50 rounded-lg p-3 text-sm"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-zinc-500">
                          Attempt {attempt.attempt_number}
                        </span>
                        <p className="text-zinc-200 leading-relaxed">{attempt.attempt_text}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {attempt.is_correct ? (
                          <span className="text-emerald-400 font-bold text-base">✓</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                            {attempt.errors?.map((err) => (
                              <span
                                key={err.id}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 capitalize"
                              >
                                {err.category.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CORRECTION BLOCK */}
              {attemptWithCorrection && (
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Correction & Grammar Notes
                  </h4>
                  <div className="space-y-3 bg-zinc-950/60 rounded-lg p-4 border border-zinc-800">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Original</p>
                      <p className="text-zinc-400 line-through leading-relaxed">{group.attempts[0].attempt_text}</p>
                    </div>
                    <div className="pt-2 border-t border-zinc-800/50">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Corrected</p>
                      <p className="text-zinc-100 font-medium leading-relaxed">{attemptWithCorrection.corrected_sentence}</p>
                    </div>
                    {uniqueCategories.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/50 space-y-1.5">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Grammar Explanation</p>
                        {uniqueCategories.map((cat) => (
                          <p key={cat} className="text-zinc-400 text-sm leading-relaxed">
                            • <span className="text-zinc-300 font-medium capitalize">{cat.replace("_", " ")}</span>: {CATEGORY_RULES[cat] || cat}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ANALYSIS BLOCK */}
              {attemptWithAnalysis && (
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Analysis
                  </h4>
                  <div className="space-y-3 bg-zinc-950/40 rounded-lg p-4 border border-zinc-800">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Your Analysis</p>
                      <p className="text-zinc-300 italic leading-relaxed pl-3 border-l-2 border-zinc-700">
                        "{attemptWithAnalysis.user_analysis}"
                      </p>
                    </div>
                    {attemptWithAnalysis.analysis_feedback && (
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">AI Feedback</p>
                        <p className="text-zinc-300 leading-relaxed">{attemptWithAnalysis.analysis_feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NOTES BLOCK */}
              {groupNotes.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-zinc-800/80">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Notes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {groupNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-start gap-1.5"
                      >
                        <span className="text-teal-400 font-semibold shrink-0">{note.word}:</span>
                        <span className="text-zinc-300">{note.note_text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}


      </main>
    </div>
  );
}
