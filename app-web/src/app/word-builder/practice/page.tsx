"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import RuleCard from "@/components/word-builder/RuleCard";

// ─── Types ───────────────────────────────────────────────────────────────────

type PromptStep = "PROMPT" | "CORRECTION" | "REVEAL_ANALYSIS" | "DISCUSSION";

interface EvaluationError {
  errorId: string;
  category: string;
  severity: string;
  locationHint: string;
  ruleReference: string;
  guidedCompletion: string;
  resolved: boolean;
}

interface HighlightedWord {
  word: string;
  rule: string;
}

interface EvaluationResult {
  isCorrect: boolean;
  errors: EvaluationError[];
  correctedSentence: string;
  recommendedSentences?: string[];
  echoPrompt: string;
  highlightedWords: HighlightedWord[];
}

interface AnalysisResult {
  isCorrect: boolean;
  feedback: string;
  correctElements: string[];
  incorrectElements: string[];
  modelAnalysis: string;
}

interface PromptItem {
  id: string;
  prompt_text: string;
  mode: string;
}

interface SessionSummary {
  id: string;
  started_at: string;
  completed_at: string | null;
  prompts_attempted: number;
  prompts_correct_first_try: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface WordPopup {
  word: string;
  x: number;
  y: number;
  definitions: DictionaryEntry[] | null;
  translation: string | null;
  isLoading: boolean;
  mode: "menu" | "define" | "translate" | "note";
  noteText: string;
}

interface DictionaryEntry {
  partOfSpeech: string;
  definitions: string[];
  synonyms: string[];
}

interface PromptState {
  promptIndex: number;
  step: PromptStep;
  userSentence: string;
  revisionSentence: string;
  attemptCount: number;
  isCorrect: boolean;
  evaluationResult: EvaluationResult | null;
  userAnalysis: string;
  analysisResult: AnalysisResult | null;
  isCompleted: boolean;
}

// ─── Word Highlight Component ────────────────────────────────────────────────

function HighlightedSentence({
  sentence,
  highlightedWords,
}: {
  sentence: string;
  highlightedWords: HighlightedWord[];
}) {
  const words = sentence.split(/(\s+)/);
  return (
    <p className="text-base leading-relaxed">
      {words.map((token, i) => {
        const match = highlightedWords.find(
          (hw) =>
            hw.word.toLowerCase() ===
            token.toLowerCase().replace(/[.,!?;:]$/, "")
        );
        if (match) {
          return (
            <span key={i} className="relative group">
              <span className="bg-amber-500/30 text-amber-200 px-0.5 rounded cursor-help">
                {token}
              </span>
              <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 w-64 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 shadow-xl">
                {match.rule}
              </span>
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </p>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WordBuilderPractice() {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [promptStates, setPromptStates] = useState<PromptState[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAnalysisSubmitting, setIsAnalysisSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [promptQueue, setPromptQueue] = useState<PromptItem[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [ruleCardCategories, setRuleCardCategories] = useState<string[]>([]);
  const [showRuleCard, setShowRuleCard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showNoteToast, setShowNoteToast] = useState(false);
  const [wordPopup, setWordPopup] = useState<WordPopup | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Session complete states
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [promptsCorrectFirstTry, setPromptsCorrectFirstTry] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  // Echo prompts for post-session practice
  const [echoPrompts, setEchoPrompts] = useState<string[]>([]);

  // Resume dialog state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);

  // ─── Attempt logging retry queue ───────────────────────────────────────
  const pendingAttemptsRef = useRef<Array<{ body: any; retries: number }>>([]);
  const isFlushingRef = useRef(false);

  const flushPendingAttempts = useCallback(async () => {
    if (isFlushingRef.current || pendingAttemptsRef.current.length === 0) return;
    isFlushingRef.current = true;
    while (pendingAttemptsRef.current.length > 0) {
      const attempt = pendingAttemptsRef.current[0];
      try {
        const res = await fetch("/api/word-builder/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt.body),
        });
        if (res.ok) {
          pendingAttemptsRef.current.shift();
        } else {
          throw new Error(`Attempt logging returned ${res.status}`);
        }
      } catch {
        attempt.retries++;
        if (attempt.retries >= 3) {
          console.error("Attempt logging failed after 3 retries:", attempt.body);
          pendingAttemptsRef.current.shift();
        } else {
          break; // wait for next flush cycle
        }
      }
    }
    isFlushingRef.current = false;
  }, []);

  // Flush pending attempts every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => flushPendingAttempts(), 5000);
    return () => clearInterval(interval);
  }, [flushPendingAttempts]);

  // Also flush on page unload (best-effort)
  useEffect(() => {
    const handleBeforeUnload = () => { flushPendingAttempts(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushPendingAttempts]);

  // ─── Session Initialization ──────────────────────────────────────────────

  const initNewSession = async () => {
    try {
      const res = await fetch("/api/word-builder/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      const allPrompts = data.prompts || [];
      setPromptQueue(allPrompts);

      const initialStates = allPrompts.map((_: any, index: number) => ({
        promptIndex: index,
        step: "PROMPT" as PromptStep,
        userSentence: "",
        revisionSentence: "",
        attemptCount: 0,
        isCorrect: false,
        evaluationResult: null,
        userAnalysis: "",
        analysisResult: null,
        isCompleted: false,
      }));
      setPromptStates(initialStates);

      if (data.decisions?.ruleCardCategories?.length > 0) {
        setRuleCardCategories(data.decisions.ruleCardCategories);
        setShowRuleCard(true);
      }
    } catch (error) {
      console.error("Session init error:", error);
    } finally {
      setIsSessionLoading(false);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for active session first
        const activeRes = await fetch("/api/word-builder/session/active");
        const activeData = await activeRes.json();

        if (activeData.activeSession) {
          setResumeData(activeData.activeSession);
          setShowResumeDialog(true);
          setIsSessionLoading(false);
          return;
        }

        await initNewSession();
      } catch (error) {
        console.error("Session init error:", error);
        setIsSessionLoading(false);
      }
    };
    initSession();
  }, []);

  const handleResumeSession = () => {
    if (!resumeData) return;
    setShowResumeDialog(false);
    setSessionId(resumeData.sessionId);

    // Reconstruct prompt queue from resume data
    const prompts = resumeData.promptAttempts.map((pa: any) => ({
      id: pa.promptId,
      prompt_text: pa.promptText,
      mode: pa.promptMode,
    }));
    setPromptQueue(prompts);

    // Reconstruct prompt states
    const states = resumeData.promptAttempts.map((pa: any, index: number) => {
      const lastAttempt = pa.attempts[pa.attempts.length - 1];
      const isCorrect = lastAttempt?.isCorrect ?? false;
      const attemptsCount = pa.attempts.length;
      const hasAnalysis = !!lastAttempt?.userAnalysis;

      // Determine step
      let step: PromptStep = "PROMPT";
      if (lastAttempt) {
        if (hasAnalysis) {
          step = "DISCUSSION";
        } else if (isCorrect || attemptsCount >= 3) {
          step = "REVEAL_ANALYSIS";
        } else {
          step = "CORRECTION";
        }
      }

      return {
        promptIndex: index,
        step,
        userSentence: lastAttempt?.attemptText ?? "",
        revisionSentence: lastAttempt?.attemptText ?? "",
        attemptCount: attemptsCount,
        isCorrect,
        evaluationResult: lastAttempt ? {
          isCorrect: lastAttempt.isCorrect,
          errors: lastAttempt.errors?.map((e: any) => ({
            errorId: e.category || "err",
            category: e.category,
            severity: e.severity,
            locationHint: "",
            ruleReference: "",
            guidedCompletion: "",
            resolved: e.resolved ?? false,
          })) ?? [],
          correctedSentence: lastAttempt.correctedSentence ?? lastAttempt.attemptText,
          echoPrompt: "",
          highlightedWords: [],
        } : null,
        userAnalysis: lastAttempt?.userAnalysis ?? "",
        analysisResult: lastAttempt?.analysisFeedback ? {
          isCorrect: true,
          feedback: lastAttempt.analysisFeedback,
          correctElements: [],
          incorrectElements: [],
          modelAnalysis: lastAttempt.analysisFeedback,
        } : null,
        isCompleted: step === "DISCUSSION",
      };
    });
    setPromptStates(states);

    // Set current index to first incomplete prompt
    const firstIncomplete = states.findIndex((s) => !s.isCompleted);
    if (firstIncomplete !== -1) {
      setCurrentPromptIndex(firstIncomplete);
    }

    setIsSessionLoading(false);
  };

  const handleStartNewSession = async () => {
    setShowResumeDialog(false);
    // Mark old session as abandoned (complete it silently)
    if (resumeData?.sessionId) {
      try {
        await fetch("/api/word-builder/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            sessionId: resumeData.sessionId,
            promptsAttempted: resumeData.promptAttempts?.length ?? 0,
            promptsCorrectFirstTry: 0,
          }),
        });
      } catch {
        // Best-effort
      }
    }
    setResumeData(null);
    setIsSessionLoading(true);
    await initNewSession();
  };

  // ─── Derived state ───────────────────────────────────────────────────────

  const currentState = promptStates[currentPromptIndex];
  const currentPrompt = promptQueue[currentPromptIndex];
  const recommendedSentences = currentState?.evaluationResult?.recommendedSentences;

  const highestIncompleteIndex = promptStates.findIndex((s) => !s.isCompleted);
  const showBackToCurrent =
    highestIncompleteIndex !== -1 && currentPromptIndex < highestIncompleteIndex;

  function updateCurrentState(patch: Partial<PromptState>) {
    setPromptStates((prev) =>
      prev.map((s, i) => (i === currentPromptIndex ? { ...s, ...patch } : s))
    );
  }

  // ─── Step 1 Submit ────────────────────────────────────────────────────────

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentState) return;
    const sentence = currentState.revisionSentence.trim();
    if (!sentence) return;

    setIsEvaluating(true);
    try {
      const res = await fetch("/api/word-builder/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence,
          promptId: currentPrompt.id,
          promptText: currentPrompt.prompt_text,
        }),
      });

      if (!res.ok) throw new Error("Evaluation failed");

      const data: EvaluationResult = await res.json();

      updateCurrentState({
        userSentence: sentence,
        evaluationResult: data,
        attemptCount: 1,
        revisionSentence: sentence,
        step: data.isCorrect ? "REVEAL_ANALYSIS" : "CORRECTION",
        isCorrect: data.isCorrect,
      });

      // Queue attempt log (retried on failure)
      pendingAttemptsRef.current.push({
        body: {
          sessionId,
          promptId: currentPrompt?.id,
          promptMode: currentPrompt?.mode,
          attemptText: sentence,
          isCorrect: data.isCorrect,
          attemptNumber: 1,
          hintsUsed: 0,
          isEchoAttempt: false,
          errors:
            data.errors?.map((err) => ({
              category: err.category,
              severity: err.severity,
              resolved: false,
              hintsUsedForError: 0,
            })) ?? [],
          promptText: currentPrompt?.prompt_text,
          correctedSentence: data.correctedSentence ?? null,
        },
        retries: 0,
      });
      flushPendingAttempts();
    } catch (error) {
      console.error("Evaluation error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  // ─── Step 2 Submit (Revision) ─────────────────────────────────────────────

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentState) return;
    const sentence = currentState.revisionSentence.trim();
    if (!sentence) return;

    setIsEvaluating(true);
    try {
      const res = await fetch("/api/word-builder/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence,
          promptId: currentPrompt.id,
          promptText: currentPrompt.prompt_text,
        }),
      });

      if (!res.ok) throw new Error("Evaluation failed");

      const data: EvaluationResult = await res.json();
      const currentAttempt = currentState.attemptCount;

      // Queue attempt log (retried on failure)
      pendingAttemptsRef.current.push({
        body: {
          sessionId,
          promptId: currentPrompt?.id,
          promptMode: currentPrompt?.mode,
          attemptText: sentence,
          isCorrect: data.isCorrect,
          attemptNumber: currentAttempt + 1,
          hintsUsed: 0,
          isEchoAttempt: false,
          errors:
            data.errors?.map((err) => ({
              category: err.category,
              severity: err.severity,
              resolved: false,
              hintsUsedForError: 0,
            })) ?? [],
          promptText: currentPrompt?.prompt_text,
          correctedSentence: data.correctedSentence ?? null,
        },
        retries: 0,
      });
      flushPendingAttempts();

      if (data.isCorrect || currentAttempt >= 2) {
        updateCurrentState({
          evaluationResult: data,
          isCorrect: data.isCorrect,
          step: "REVEAL_ANALYSIS",
          revisionSentence: sentence,
        });
      } else {
        updateCurrentState({
          evaluationResult: data,
          attemptCount: currentAttempt + 1,
          revisionSentence: sentence,
        });
      }
    } catch (error) {
      console.error("Revision submit error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  // ─── Step 3 Submit (Analysis) ─────────────────────────────────────────────

  const handleAnalyzeSubmit = async () => {
    if (!currentState?.userAnalysis.trim() || !currentState.evaluationResult) return;
    setIsAnalysisSubmitting(true);

    try {
      const res = await fetch("/api/word-builder/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSentence: currentState.userSentence,
          correctedSentence: currentState.evaluationResult.correctedSentence,
          userAnalysis: currentState.userAnalysis,
          errors: currentState.evaluationResult.errors.map((e) => ({
            category: e.category,
            locationHint: e.locationHint,
            ruleReference: e.ruleReference,
          })),
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data: AnalysisResult = await res.json();
      updateCurrentState({
        analysisResult: data,
        step: "DISCUSSION",
        isCompleted: true,
      });
    } catch (error) {
      console.error("Analysis submit error:", error);
    } finally {
      setIsAnalysisSubmitting(false);
    }
  };

  // ─── Step 4 Submit (Next Prompt) ──────────────────────────────────────────

  const handleNextPrompt = async () => {
    const nextIndex = currentPromptIndex + 1;
    if (nextIndex >= promptQueue.length) {
      // Complete session
      if (sessionId) {
        const finalFirstTry = promptStates.filter(
          (s) => s.isCorrect && s.attemptCount === 1
        ).length;
        setPromptsCorrectFirstTry(finalFirstTry);

        // Calculate XP: base 10 + 5 per correct first try
        const xp = 10 + (finalFirstTry * 5);
        setXpEarned(xp);

        // Collect echo prompts from prompts that needed work
        const echoes = promptStates
          .filter((s) => s.evaluationResult?.echoPrompt && (s.attemptCount > 1 || !s.isCorrect))
          .map((s) => s.evaluationResult!.echoPrompt);
        setEchoPrompts(echoes);

        try {
          await fetch("/api/word-builder/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "complete",
              sessionId,
              promptsAttempted: promptQueue.length,
              promptsCorrectFirstTry: finalFirstTry,
            }),
          });
        } catch (err) {
          console.error("Failed to complete session:", err);
        }
      }
      setIsSessionComplete(true);
    } else {
      setCurrentPromptIndex(nextIndex);
    }
  };

  // ─── Close Word Popup on outside click / Escape ──────────────────────────

  useEffect(() => {
    if (!wordPopup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setWordPopup(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWordPopup(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [wordPopup]);

  // ─── Note Toast Auto-hide ───────────────────────────────────────────────

  useEffect(() => {
    if (!showNoteToast) return;
    const t = setTimeout(() => setShowNoteToast(false), 2000);
    return () => clearTimeout(t);
  }, [showNoteToast]);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowRight" && currentState?.step === "DISCUSSION") {
        e.preventDefault();
        handleNextPrompt();
      }
      if (e.key === "ArrowLeft" && currentPromptIndex > 0 && currentState?.step === "DISCUSSION") {
        e.preventDefault();
        setCurrentPromptIndex(currentPromptIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentState, currentPromptIndex, handleNextPrompt]);

  // ─── Word Popup Handlers ─────────────────────────────────────────────────

  const handleTextSelect = useCallback((e: React.MouseEvent) => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.includes(" ") || text.length > 40) return;

    const range = sel?.getRangeAt(0);
    if (!range) return;
    const rect = range.getBoundingClientRect();

    setWordPopup({
      word: text,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      definitions: null,
      translation: null,
      isLoading: false,
      mode: "menu",
      noteText: "",
    });
  }, []);

  const handleDefine = useCallback(async () => {
    if (!wordPopup) return;
    setWordPopup((p) => (p ? { ...p, mode: "define", isLoading: true } : null));

    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordPopup.word)}`
      );
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();

      const entries: DictionaryEntry[] = (data as any[]).flatMap(
        (entry: any) =>
          (entry.meanings || []).map((m: any) => ({
            partOfSpeech: m.partOfSpeech || "",
            definitions: (m.definitions || [])
              .slice(0, 2)
              .map((d: any) => d.definition || ""),
            synonyms: (m.synonyms || []).slice(0, 3),
          }))
      );

      setWordPopup((p) =>
        p ? { ...p, definitions: entries, isLoading: false } : null
      );
    } catch {
      setWordPopup((p) =>
        p
          ? {
              ...p,
              definitions: [
                {
                  partOfSpeech: "",
                  definitions: ["No definition found."],
                  synonyms: [],
                },
              ],
              isLoading: false,
            }
          : null
      );
    }
  }, [wordPopup]);

  const handleTranslate = useCallback(() => {
    setWordPopup((p) =>
      p ? { ...p, mode: "translate", translation: "Coming soon" } : null
    );
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!wordPopup || !wordPopup.noteText.trim() || !sessionId) return;

    try {
      await fetch("/api/word-builder/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          attemptId: null,
          word: wordPopup.word,
          noteText: wordPopup.noteText.trim(),
        }),
      });
      setWordPopup(null);
      setShowNoteToast(true);
    } catch (error) {
      console.error("Save note error:", error);
    }
  }, [wordPopup, sessionId]);

  // ─── History Panel Handlers ──────────────────────────────────────────────

  const openHistory = useCallback(async () => {
    setShowHistory(true);
    setIsHistoryLoading(true);
    try {
      const res = await fetch("/api/word-builder/history");
      if (res.ok) {
        const data = await res.json();
        setSessionHistory(data.sessions ?? []);
      }
    } catch (error) {
      console.error("History fetch error:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // ─── Ask AI Chat Handlers ────────────────────────────────────────────────

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isChatLoading) return;

    setChatMessages((prev) => [...prev, { role: "user", content: query }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const completedPrompts = promptStates
        .filter((s) => s.isCompleted)
        .map((s) => ({
          promptText: promptQueue[s.promptIndex]?.prompt_text || "",
          userSentence: s.userSentence,
          correctedSentence: s.evaluationResult?.correctedSentence ?? null,
          errors:
            s.evaluationResult?.errors?.map((e) => ({
              category: e.category,
              ruleReference: e.ruleReference,
            })) ?? [],
          userAnalysis: s.userAnalysis,
        }));

      const currentPromptText = currentPrompt?.prompt_text ?? "";

      const res = await fetch("/api/word-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: query,
          sessionContext: {
            completedPrompts,
            currentPromptText,
          },
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I am unable to connect right now. Please try again.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ─── Early returns ───────────────────────────────────────────────────────

  if (showResumeDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Unfinished Session</h2>
            <p className="text-sm text-zinc-400">
              You have an unfinished practice session from{" "}
              {resumeData?.startedAt
                ? new Date(resumeData.startedAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : "earlier"}.
            </p>
            <p className="text-xs text-zinc-500">
              {resumeData?.promptAttempts?.length ?? 0} prompts loaded
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleResumeSession}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl transition-colors"
            >
              Continue Session
            </button>
            <button
              onClick={handleStartNewSession}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Start New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSessionLoading || (!isSessionComplete && !currentState)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="animate-pulse text-lg">Loading session...</div>
      </div>
    );
  }

  if (showRuleCard) {
    return (
      <RuleCard
        categories={ruleCardCategories}
        onDismiss={() => setShowRuleCard(false)}
      />
    );
  }

  // ─── Render Session Complete ─────────────────────────────────────────────

  if (isSessionComplete) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 h-14">
            <Link
              href="/"
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
              Word Builder
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowHistory(false);
                  setShowChat((prev) => !prev);
                }}
                className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                  showChat
                    ? "bg-teal-500 text-zinc-950 border-teal-500 font-semibold"
                    : "text-zinc-400 hover:text-zinc-100 border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                Ask AI
              </button>
              <button
                onClick={() => {
                  setShowChat(false);
                  if (showHistory) {
                    setShowHistory(false);
                  } else {
                    openHistory();
                  }
                }}
                className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                  showHistory
                    ? "bg-teal-500 text-zinc-950 border-teal-500 font-semibold"
                    : "text-zinc-400 hover:text-zinc-100 border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                History
              </button>
            </div>
          </div>
        </header>

        {/* Main session complete view */}
        <main className="flex-1 max-w-[1200px] mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <div className="max-w-lg w-full text-center space-y-6">
            <p className="text-3xl font-bold text-zinc-100">Session complete.</p>
            <div className="flex justify-center gap-8 text-sm text-zinc-400">
              <div>
                <p className="text-2xl font-bold text-zinc-100">
                  {promptQueue.length}
                </p>
                <p>prompts attempted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">
                  {promptsCorrectFirstTry}
                </p>
                <p>correct first try</p>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-amber-400 font-bold text-lg">+{xpEarned} XP</p>
              <p className="text-xs text-zinc-500">earned this session</p>
            </div>
            {echoPrompts.length > 0 && (
              <div className="text-left bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 w-full">
                <p className="text-sm font-semibold text-zinc-300">
                  Practice these patterns with new topics
                </p>
                <div className="space-y-2">
                  {echoPrompts.slice(0, 3).map((ep, i) => (
                    <p key={i} className="text-xs text-zinc-400 italic border-l-2 border-teal-500 pl-3">
                      {ep}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col items-center gap-3 pt-2">
              <Link
                href="/drill"
                className="inline-block px-8 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-sm"
              >
                Go to Drill Mode →
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Start another session
              </button>
            </div>
          </div>
        </main>

        {/* Ask AI Sidebar & History sidebar rendered here */}
        {renderSidebars()}
      </div>
    );
  }

  // ─── Progress bar calculations ───────────────────────────────────────────

  let stepFraction = 0;
  if (currentState) {
    if (currentState.step === "CORRECTION") stepFraction = 0.25;
    else if (currentState.step === "REVEAL_ANALYSIS") stepFraction = 0.5;
    else if (currentState.step === "DISCUSSION") stepFraction = 0.75;
  }
  const progressPct =
    promptQueue.length > 0
      ? ((currentPromptIndex + stepFraction) / promptQueue.length) * 100
      : 0;

  // ─── Sidebar Render Helper ───────────────────────────────────────────────

  function renderSidebars() {
    return (
      <>
        {/* ── Ask AI Chat Panel ── */}
        {showChat && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowChat(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Ask AI Assistant
                </h2>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    Ask me any questions about English grammar, vocabulary, or the
                    sentences in this session.
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-teal-500 text-zinc-950 font-medium"
                            : "bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-zinc-400 text-xs px-4 py-2 rounded-xl animate-pulse">
                      AI is thinking...
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSendChatMessage}
                className="p-4 border-t border-zinc-800 space-y-2 shrink-0 bg-zinc-900"
              >
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message (max 1000 chars)..."
                  className="w-full min-h-[60px] p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none"
                  maxLength={1000}
                  required
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── History Panel ── */}
        {showHistory && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowHistory(false)}
            />
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 z-50 overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Session History
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-4">
                {isHistoryLoading ? (
                  <p className="text-sm text-zinc-500 animate-pulse">
                    Loading history...
                  </p>
                ) : sessionHistory.length === 0 ? (
                  <p className="text-sm text-zinc-500">No sessions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sessionHistory.map((s) => (
                      <Link
                        key={s.id}
                        href={`/word-builder/history/${s.id}`}
                        className="block p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {new Date(s.started_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {s.completed_at ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                              Complete
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                              In progress
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-zinc-500">
                          <span>{s.prompts_attempted} prompts</span>
                          <span>
                            {s.prompts_correct_first_try} first-try correct
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // ─── Render Main Layout ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 h-14">
          <Link
            href="/"
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
            Word Builder
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowHistory(false);
                setShowChat((prev) => !prev);
              }}
              className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                showChat
                  ? "bg-teal-500 text-zinc-950 border-teal-500 font-semibold"
                  : "text-zinc-400 hover:text-zinc-100 border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              Ask AI
            </button>
            <button
              onClick={() => {
                setShowChat(false);
                if (showHistory) {
                  setShowHistory(false);
                } else {
                  openHistory();
                }
              }}
              className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                showHistory
                  ? "bg-teal-500 text-zinc-950 border-teal-500 font-semibold"
                  : "text-zinc-400 hover:text-zinc-100 border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-[1200px] mx-auto w-full px-4 pt-4 pb-2">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
          <span>
            Prompt {currentPromptIndex + 1} of {promptQueue.length}
          </span>
          <span className="capitalize">
            {currentPrompt?.mode?.replace("_", " ") ?? "guided"}
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main content area */}
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6 flex-1">
        {/* Loading / Evaluating state */}
        {isEvaluating && (
          <div className="max-w-2xl mx-auto space-y-5">
            <p className="text-zinc-100 text-xl leading-relaxed font-medium">
              {currentPrompt?.prompt_text}
            </p>
            <div className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800/50 text-zinc-400 text-base leading-relaxed select-none">
              {currentState.revisionSentence || currentState.userSentence}
            </div>
            <div className="text-center py-4">
              <p className="text-zinc-500 text-base animate-pulse">
                Evaluating...
              </p>
            </div>
          </div>
        )}

        {/* ── Step 1: PROMPT ── */}
        {currentState.step === "PROMPT" && !isEvaluating && (
          <div className="max-w-2xl mx-auto space-y-5">
            <p className="text-zinc-100 text-xl leading-relaxed font-medium">
              {currentPrompt?.prompt_text}
            </p>
            <form onSubmit={handleEvaluate} className="space-y-4">
              <textarea
                value={currentState.revisionSentence}
                onChange={(e) => updateCurrentState({ revisionSentence: e.target.value })}
                placeholder="Write your sentence here..."
                className="w-full min-h-[100px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none text-base leading-relaxed transition-colors"
                required
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base"
              >
                Submit
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: CORRECTION ── */}
        {currentState.step === "CORRECTION" && !isEvaluating && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: user sentence */}
              <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                onMouseUp={handleTextSelect}
              >
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Your sentence
                </p>
                <div className="border-l-2 border-amber-500/60 pl-4">
                  <HighlightedSentence
                    sentence={currentState.userSentence}
                    highlightedWords={currentState.evaluationResult?.highlightedWords || []}
                  />
                </div>
              </div>

              {/* Right: corrected (blurred) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Corrected version
                </p>
                <p className="text-zinc-100 text-base leading-relaxed filter blur-[8px] select-none pointer-events-none">
                  {currentState.evaluationResult?.correctedSentence}
                </p>
              </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-zinc-400">
                  Attempt {currentState.attemptCount} of 3
                </p>
              </div>

              {currentState.attemptCount < 3 &&
                currentState.evaluationResult?.errors?.[0]?.locationHint && (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400">
                    <span className="font-semibold text-amber-400">Hint:</span>{" "}
                    {currentState.evaluationResult.errors[0].locationHint}
                  </div>
                )}

              <form onSubmit={handleRevisionSubmit} className="space-y-3">
                <textarea
                  value={currentState.revisionSentence}
                  onChange={(e) => updateCurrentState({ revisionSentence: e.target.value })}
                  placeholder="Revise your sentence..."
                  className="w-full min-h-[80px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none text-base leading-relaxed transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base"
                >
                  Submit revision
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Step 3: REVEAL_ANALYSIS ── */}
        {currentState.step === "REVEAL_ANALYSIS" && !isEvaluating && (
          <div className="space-y-6">
            {isAnalysisSubmitting ? (
              <div className="max-w-2xl mx-auto space-y-5">
                <div className="text-center py-12">
                  <p className="text-zinc-500 text-base animate-pulse">
                    Evaluating your analysis...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className={`grid gap-4 grid-cols-1 ${
                  recommendedSentences && recommendedSentences.length > 0
                    ? "lg:grid-cols-3"
                    : "lg:grid-cols-2"
                }`}>
                  {/* Left: user sentence */}
                  <div
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                    onMouseUp={handleTextSelect}
                  >
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                      Your sentence
                    </p>
                    <div className="border-l-2 border-amber-500/60 pl-4">
                      <p className="text-zinc-100 text-base leading-relaxed">
                        {currentState.userSentence}
                      </p>
                    </div>
                  </div>

                  {/* Right: corrected version */}
                  <div
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                    onMouseUp={handleTextSelect}
                  >
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                      Corrected version
                    </p>
                    <p className="text-zinc-100 text-base leading-relaxed">
                      {currentState.evaluationResult?.correctedSentence}
                    </p>
                  </div>

                  {/* More Natural / Recommended Sentences Panel */}
                  {recommendedSentences && recommendedSentences.length > 0 && (
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                        More Natural
                      </p>
                      <div className="flex flex-col gap-2">
                        {recommendedSentences.map((rec, i) => (
                          <div key={i} className="text-sm text-zinc-300 leading-relaxed">
                            {recommendedSentences.length > 1 && (
                              <span className="text-xs font-semibold text-zinc-500 block mb-0.5">
                                {i + 1}.
                              </span>
                            )}
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-w-2xl mx-auto space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100 mb-1">
                      Why is the correction correct?
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Explain why the corrected sentence is grammatically correct.
                      What rule makes this the right form?
                    </p>
                  </div>

                  {currentState.isCorrect ? (
                    <p className="text-sm text-emerald-400 font-medium">
                      You corrected this yourself. Now explain why the correction
                      works.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-400 font-medium">
                      The correction has been revealed. Analyze why this form is
                      grammatically correct.
                    </p>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAnalyzeSubmit();
                    }}
                    className="space-y-3"
                  >
                    <textarea
                      value={currentState.userAnalysis}
                      onChange={(e) => updateCurrentState({ userAnalysis: e.target.value })}
                      placeholder="Explain why the corrected sentence is right..."
                      className="w-full min-h-[120px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none text-base leading-relaxed transition-colors"
                      required
                    />
                    <button
                      type="submit"
                      disabled={
                        isAnalysisSubmitting ||
                        currentState.userAnalysis.trim().length < 10
                      }
                      className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Submit analysis
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: DISCUSSION ── */}
        {currentState.step === "DISCUSSION" && !isEvaluating && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* SECTION A — Correction blocks */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-200">
                Corrections / Grammar Notes
              </h3>
              {currentState.isCorrect ? (
                <div className="p-4 rounded-xl bg-zinc-900 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <span>✓</span>
                    <span>No corrections needed.</span>
                  </div>
                  <p className="text-zinc-100 text-base leading-relaxed">
                    {currentState.userSentence}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-zinc-400 text-sm">
                      <span>Original</span>
                      <span className="text-red-400">✕</span>
                    </div>
                    <p className="text-zinc-400 line-through text-base leading-relaxed">
                      {currentState.userSentence}
                    </p>
                    <div className="border-t border-zinc-800/80 my-2 pt-2">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                        Corrected
                      </p>
                      <p className="text-zinc-100 font-medium text-base leading-relaxed">
                        {currentState.evaluationResult?.correctedSentence}
                      </p>
                    </div>
                    {currentState.evaluationResult?.errors && currentState.evaluationResult.errors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/80">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                          Grammar Explanation
                        </p>
                        <div className="space-y-2">
                          {currentState.evaluationResult.errors.map((err, i) => (
                            <p key={i} className="text-zinc-400 text-sm leading-relaxed">
                              {err.ruleReference}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION B — Analysis feedback */}
            {currentState.analysisResult && (
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-1">
                    Your Analysis
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed italic bg-zinc-950/40 p-3 rounded-lg border border-zinc-800">
                    "{currentState.userAnalysis}"
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    AI Feedback
                  </p>
                  <p className="text-zinc-300 text-base leading-relaxed">
                    {currentState.analysisResult.feedback}
                  </p>
                </div>

                {currentState.analysisResult.correctElements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                      Correct elements identified
                    </p>
                    <ul className="space-y-1">
                      {currentState.analysisResult.correctElements.map((el, i) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-300 flex items-start gap-2"
                        >
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>{el}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentState.analysisResult.incorrectElements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                      Incorrect or missing elements
                    </p>
                    <ul className="space-y-1">
                      {currentState.analysisResult.incorrectElements.map((el, i) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-300 flex items-start gap-2"
                        >
                          <span className="text-red-400 mt-0.5">✕</span>
                          <span>{el}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* SECTION C — Navigation */}
            <div className="flex justify-between items-center gap-4 pt-4">
              {currentPromptIndex > 0 ? (
                <button
                  onClick={() => setCurrentPromptIndex((prev) => prev - 1)}
                  className="px-6 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-lg transition-colors text-base"
                >
                  Previous
                </button>
              ) : (
                <div />
              )}

              {showBackToCurrent && (
                <button
                  onClick={() => setCurrentPromptIndex(highestIncompleteIndex)}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-teal-400 font-semibold rounded-lg border border-zinc-700 transition-colors text-base"
                >
                  Back to Current
                </button>
              )}

              <button
                onClick={handleNextPrompt}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base"
              >
                {currentPromptIndex === promptQueue.length - 1
                  ? "Complete Session"
                  : "Next"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Word Popup ── */}
      {wordPopup && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl"
          style={{
            left: `${Math.min(wordPopup.x, window.innerWidth - 280)}px`,
            top: `${wordPopup.y}px`,
            minWidth: "240px",
            maxWidth: "340px",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
            <span className="text-sm font-semibold text-teal-400">
              {wordPopup.word}
            </span>
            <button
              onClick={() => setWordPopup(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Menu mode */}
          {wordPopup.mode === "menu" && (
            <div className="p-1.5 flex gap-1">
              <button
                onClick={handleDefine}
                className="flex-1 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Define
              </button>
              <button
                onClick={handleTranslate}
                className="flex-1 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Translate
              </button>
              <button
                onClick={() =>
                  setWordPopup((p) => (p ? { ...p, mode: "note" } : null))
                }
                className="flex-1 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Note
              </button>
            </div>
          )}

          {/* Define mode */}
          {wordPopup.mode === "define" && (
            <div className="p-3 max-h-60 overflow-y-auto space-y-2">
              {wordPopup.isLoading ? (
                <p className="text-xs text-zinc-500 animate-pulse">
                  Loading...
                </p>
              ) : (
                wordPopup.definitions?.map((entry, i) => (
                  <div key={i} className="space-y-1">
                    {entry.partOfSpeech && (
                      <p className="text-[10px] font-semibold text-teal-400 uppercase">
                        {entry.partOfSpeech}
                      </p>
                    )}
                    {entry.definitions.map((def, j) => (
                      <p key={j} className="text-xs text-zinc-300 leading-snug">
                        {def}
                      </p>
                    ))}
                    {entry.synonyms.length > 0 && (
                      <p className="text-[10px] text-zinc-500">
                        Synonyms: {entry.synonyms.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Translate mode */}
          {wordPopup.mode === "translate" && (
            <div className="p-3">
              <p className="text-xs text-zinc-400">
                {wordPopup.translation || "Coming soon"}
              </p>
            </div>
          )}

          {/* Note mode */}
          {wordPopup.mode === "note" && (
            <div className="p-3 space-y-2">
              <textarea
                value={wordPopup.noteText}
                onChange={(e) =>
                  setWordPopup((p) =>
                    p ? { ...p, noteText: e.target.value } : null
                  )
                }
                placeholder="Write a note..."
                className="w-full min-h-[60px] p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none"
              />
              <button
                onClick={handleSaveNote}
                disabled={!wordPopup.noteText.trim()}
                className="w-full py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
              >
                Save note
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Note saved toast ── */}
      {showNoteToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500/90 text-zinc-950 text-sm font-semibold rounded-lg shadow-lg">
          Note saved
        </div>
      )}

      {/* ── Sidebars ── */}
      {renderSidebars()}
    </div>
  );
}
