"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import RuleCard from "@/components/word-builder/RuleCard";

// ─── Types ───────────────────────────────────────────────────────────────────

type PageState =
  | "PROMPT"
  | "EVALUATING"
  | "ANALYSIS"
  | "ANALYSIS_EVALUATING"
  | "HINT_REQUESTED"
  | "CORRECT"
  | "ECHO"
  | "SESSION_COMPLETE";

interface EvaluationError {
  errorId: string;
  category: string;
  severity: string;
  locationHint: string;
  ruleReference: string;
  guidedCompletion: string;
  resolved: boolean;
}

interface EvaluationResult {
  isCorrect: boolean;
  errors: EvaluationError[];
  correctedSentence: string;
  echoPrompt: string;
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
  implied_structures?: unknown;
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

interface SessionSummary {
  id: string;
  started_at: string;
  completed_at: string | null;
  prompts_attempted: number;
  prompts_correct_first_try: number;
}

// ─── Diff View Helper ────────────────────────────────────────────────────────

function DiffView({
  original,
  corrected,
}: {
  original: string;
  corrected: string;
}) {
  const origWords = original.trim().split(/\s+/);
  const corrWords = corrected.trim().split(/\s+/);

  const maxLen = Math.max(origWords.length, corrWords.length);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < maxLen; i++) {
    const ow = origWords[i] || "";
    const cw = corrWords[i] || "";

    if (ow.toLowerCase() === cw.toLowerCase()) {
      elements.push(
        <span key={i} className="text-zinc-100">
          {cw}{" "}
        </span>
      );
    } else {
      if (ow) {
        elements.push(
          <span key={`${i}-del`} className="line-through text-red-400 mr-1">
            {ow}
          </span>
        );
      }
      if (cw) {
        elements.push(
          <span key={`${i}-add`} className="text-green-400 font-medium">
            {cw}{" "}
          </span>
        );
      }
    }
  }

  return <p className="text-base leading-relaxed">{elements}</p>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WordBuilderPractice() {
  // Page & evaluation state
  const [pageState, setPageState] = useState<PageState>("PROMPT");
  const [userSentence, setUserSentence] = useState("");
  const [userAnalysis, setUserAnalysis] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluationResult | null>(null);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [currentHintText, setCurrentHintText] = useState("");
  const [echoPromptText, setEchoPromptText] = useState("");
  const [isEchoAttempt, setIsEchoAttempt] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [rightSideRevealed, setRightSideRevealed] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [promptQueue, setPromptQueue] = useState<PromptItem[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState(1);
  const [hintsUsedThisAttempt, setHintsUsedThisAttempt] = useState(0);
  const [promptsCorrectFirstTry, setPromptsCorrectFirstTry] = useState(0);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [sessionFirstTryCount, setSessionFirstTryCount] = useState(0);

  // Rule card
  const [ruleCardCategories, setRuleCardCategories] = useState<string[]>([]);
  const [showRuleCard, setShowRuleCard] = useState(false);

  // Word popup
  const [wordPopup, setWordPopup] = useState<WordPopup | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // History panel
  const [showHistory, setShowHistory] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Note toast
  const [showNoteToast, setShowNoteToast] = useState(false);

  // ─── Session init ────────────────────────────────────────────────────────

  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch("/api/word-builder/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create" }),
        });
        const data = await res.json();
        setSessionId(data.sessionId);
        setPromptQueue(data.prompts);
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
    initSession();
  }, []);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const currentPrompt = promptQueue[currentPromptIndex];
  const activePromptText = isEchoAttempt
    ? echoPromptText
    : currentPrompt?.prompt_text ?? "";

  // ─── Auto-advance on CORRECT ─────────────────────────────────────────────

  useEffect(() => {
    if (pageState === "CORRECT") {
      const timer = setTimeout(async () => {
        if (isEchoAttempt) {
          const nextIndex = currentPromptIndex + 1;
          if (nextIndex >= promptQueue.length) {
            if (sessionId) {
              await fetch("/api/word-builder/session", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "complete",
                  sessionId,
                  promptsAttempted: promptQueue.length,
                  promptsCorrectFirstTry,
                }),
              });
            }
            setPageState("SESSION_COMPLETE");
          } else {
            setCurrentPromptIndex(nextIndex);
            setIsEchoAttempt(false);
            setUserSentence("");
            setUserAnalysis("");
            setAnalysisResult(null);
            setCurrentAttemptNumber(1);
            setHintsUsedThisAttempt(0);
            setCurrentHintLevel(0);
            setCurrentHintText("");
            setEvaluationResult(null);
            setRightSideRevealed(false);
            setPageState("PROMPT");
          }
        } else {
          setIsEchoAttempt(true);
          setUserSentence("");
          setUserAnalysis("");
          setAnalysisResult(null);
          setCurrentAttemptNumber(1);
          setHintsUsedThisAttempt(0);
          setPageState("ECHO");
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    pageState,
    isEchoAttempt,
    currentPromptIndex,
    promptQueue.length,
    sessionId,
    promptsCorrectFirstTry,
  ]);

  // ─── Close popup on outside click / Escape ───────────────────────────────

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

  // ─── Note toast auto-hide ────────────────────────────────────────────────

  useEffect(() => {
    if (!showNoteToast) return;
    const t = setTimeout(() => setShowNoteToast(false), 2000);
    return () => clearTimeout(t);
  }, [showNoteToast]);

  // ─── Core handlers ──────────────────────────────────────────────────────

  const handleEvaluate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userSentence.trim()) return;

      setPageState("EVALUATING");

      try {
        const promptId = isEchoAttempt
          ? "00000000-0000-0000-0000-000000000000"
          : currentPrompt?.id;

        const res = await fetch("/api/word-builder/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentence: userSentence,
            promptId,
            promptText: activePromptText,
          }),
        });

        if (!res.ok) throw new Error(`Evaluation failed: ${res.status}`);

        const data: EvaluationResult = await res.json();
        setEvaluationResult(data);
        setRightSideRevealed(false);

        // Fire-and-forget attempt log
        fetch("/api/word-builder/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            promptId: currentPrompt?.id,
            promptMode: currentPrompt?.mode,
            attemptText: userSentence,
            isCorrect: data.isCorrect,
            attemptNumber: currentAttemptNumber,
            hintsUsed: hintsUsedThisAttempt,
            isEchoAttempt,
            errors:
              data.errors?.map((err) => ({
                category: err.category,
                severity: err.severity,
                resolved: false,
                hintsUsedForError: 0,
              })) ?? [],
            promptText: activePromptText,
            correctedSentence: data.correctedSentence ?? null,
          }),
        });

        if (data.isCorrect) {
          if (!isEchoAttempt) setEchoPromptText(data.echoPrompt || "");
          if (currentAttemptNumber === 1 && !isEchoAttempt) {
            setPromptsCorrectFirstTry((p) => p + 1);
            setSessionFirstTryCount((p) => p + 1);
          }
          setPageState("CORRECT");
        } else {
          setPageState("ANALYSIS");
          setCurrentAttemptNumber((p) => p + 1);
          setCurrentHintLevel(0);
        }
      } catch (error) {
        console.error("Evaluation error:", error);
        setPageState("PROMPT");
      }
    },
    [
      userSentence,
      isEchoAttempt,
      currentPrompt,
      activePromptText,
      sessionId,
      currentAttemptNumber,
      hintsUsedThisAttempt,
    ]
  );

  const handleSubmitAnalysis = useCallback(async () => {
    if (!userAnalysis.trim() || !evaluationResult) return;
    setIsAnalysisLoading(true);
    setPageState("ANALYSIS_EVALUATING");

    try {
      const res = await fetch("/api/word-builder/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSentence,
          correctedSentence: evaluationResult.correctedSentence,
          userAnalysis,
          errors: evaluationResult.errors.map((e) => ({
            category: e.category,
            locationHint: e.locationHint,
            ruleReference: e.ruleReference,
          })),
        }),
      });

      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);

      const data: AnalysisResult = await res.json();
      setAnalysisResult(data);
      setRightSideRevealed(true);
      setPageState("HINT_REQUESTED");

      // Fire-and-forget: update attempt with analysis data
      fetch("/api/word-builder/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          promptId: currentPrompt?.id,
          promptMode: currentPrompt?.mode,
          attemptText: userSentence,
          isCorrect: false,
          attemptNumber: currentAttemptNumber,
          hintsUsed: hintsUsedThisAttempt,
          isEchoAttempt,
          errors: [],
          userAnalysis,
          analysisFeedback: data.feedback,
        }),
      });
    } catch (error) {
      console.error("Analysis error:", error);
      setPageState("ANALYSIS");
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [
    userAnalysis,
    evaluationResult,
    userSentence,
    sessionId,
    currentPrompt,
    currentAttemptNumber,
    hintsUsedThisAttempt,
    isEchoAttempt,
  ]);

  const fetchHint = useCallback(
    async (level: number) => {
      if (!evaluationResult?.errors?.[0]) return;
      setIsHintLoading(true);

      try {
        const currentError = evaluationResult.errors[0];
        const res = await fetch("/api/word-builder/hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...currentError,
            hintLevel: level,
            sentence: userSentence,
          }),
        });

        if (!res.ok) throw new Error(`Hint failed: ${res.status}`);

        const data = await res.json();
        setCurrentHintText(data.hintText || "");
        setCurrentHintLevel(level);
        setHintsUsedThisAttempt((p) => p + 1);
        setPageState("HINT_REQUESTED");
      } catch (error) {
        console.error("Hint error:", error);
      } finally {
        setIsHintLoading(false);
      }
    },
    [evaluationResult, userSentence]
  );

  const handleRevisionSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userSentence.trim()) return;

      setPageState("EVALUATING");

      try {
        const promptId = isEchoAttempt
          ? "00000000-0000-0000-0000-000000000000"
          : currentPrompt?.id;

        const res = await fetch("/api/word-builder/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentence: userSentence,
            promptId,
            promptText: activePromptText,
          }),
        });

        if (!res.ok) throw new Error(`Evaluation failed: ${res.status}`);

        const data: EvaluationResult = await res.json();
        setEvaluationResult(data);

        // Fire-and-forget attempt log
        fetch("/api/word-builder/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            promptId: currentPrompt?.id,
            promptMode: currentPrompt?.mode,
            attemptText: userSentence,
            isCorrect: data.isCorrect,
            attemptNumber: currentAttemptNumber,
            hintsUsed: hintsUsedThisAttempt,
            isEchoAttempt,
            errors:
              data.errors?.map((err) => ({
                category: err.category,
                severity: err.severity,
                resolved: false,
                hintsUsedForError: 0,
              })) ?? [],
            promptText: activePromptText,
            correctedSentence: data.correctedSentence ?? null,
          }),
        });

        if (data.isCorrect) {
          if (!isEchoAttempt) setEchoPromptText(data.echoPrompt || "");
          if (currentAttemptNumber === 1 && !isEchoAttempt) {
            setPromptsCorrectFirstTry((p) => p + 1);
            setSessionFirstTryCount((p) => p + 1);
          }
          setRightSideRevealed(true);
          setPageState("CORRECT");
        } else {
          setCurrentAttemptNumber((p) => p + 1);
          setPageState("HINT_REQUESTED");
        }
      } catch (error) {
        console.error("Revision evaluation error:", error);
        setPageState("HINT_REQUESTED");
      }
    },
    [
      userSentence,
      isEchoAttempt,
      currentPrompt,
      activePromptText,
      sessionId,
      currentAttemptNumber,
      hintsUsedThisAttempt,
    ]
  );

  // ─── Word popup handlers ────────────────────────────────────────────────

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

  // ─── History panel ──────────────────────────────────────────────────────

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

  // ─── Early returns ──────────────────────────────────────────────────────

  if (isSessionLoading) {
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

  if (!currentPrompt && pageState !== "SESSION_COMPLETE") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="animate-pulse text-lg">Loading prompts...</div>
      </div>
    );
  }

  // ─── Progress bar width ─────────────────────────────────────────────────

  const progressPct =
    promptQueue.length > 0
      ? ((currentPromptIndex + (pageState === "SESSION_COMPLETE" ? 1 : 0)) /
          promptQueue.length) *
        100
      : 0;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* ── Header ── */}
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
          <button
            onClick={openHistory}
            className="text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:bg-zinc-800 rounded-lg px-3 py-1.5 transition-colors"
          >
            History
          </button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {pageState !== "SESSION_COMPLETE" && (
        <div className="max-w-[1200px] mx-auto px-4 pt-4 pb-2">
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
      )}

      {/* ── Main content ── */}
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* ── PROMPT state ── */}
        {pageState === "PROMPT" && (
          <div className="max-w-2xl mx-auto space-y-5">
            <p className="text-zinc-100 text-xl leading-relaxed font-medium">
              {activePromptText}
            </p>
            <form onSubmit={handleEvaluate} className="space-y-4">
              <textarea
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
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

        {/* ── EVALUATING state ── */}
        {pageState === "EVALUATING" && (
          <div className="max-w-2xl mx-auto space-y-5">
            <p className="text-zinc-100 text-xl leading-relaxed font-medium">
              {activePromptText}
            </p>
            <div className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800/50 text-zinc-400 text-base leading-relaxed whitespace-pre-wrap select-none">
              {userSentence}
            </div>
            <div className="text-center py-4">
              <p className="text-zinc-500 text-base animate-pulse">
                Evaluating your sentence...
              </p>
            </div>
          </div>
        )}

        {/* ── ANALYSIS state ── */}
        {pageState === "ANALYSIS" && evaluationResult && (
          <div className="space-y-6">
            {/* Split screen */}
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
                  <p className="text-zinc-100 text-base leading-relaxed">
                    {userSentence}
                  </p>
                </div>
              </div>

              {/* Right: corrected (blurred) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Corrected version
                </p>
                <p className="text-zinc-100 text-base leading-relaxed filter blur-[8px] select-none pointer-events-none">
                  {evaluationResult.correctedSentence}
                </p>
              </div>
            </div>

            {/* Analysis input */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-1">
                  What went wrong?
                </h3>
                <p className="text-sm text-zinc-500">
                  Analyze the error in your sentence before seeing the
                  correction. What grammatical rule was violated and why?
                </p>
              </div>
              <textarea
                value={userAnalysis}
                onChange={(e) => setUserAnalysis(e.target.value)}
                placeholder="Explain what you think the error is..."
                className="w-full min-h-[80px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none text-base leading-relaxed transition-colors"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitAnalysis}
                  disabled={
                    isAnalysisLoading || userAnalysis.trim().length < 10
                  }
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit analysis
                </button>
                <button
                  onClick={() => {
                    fetchHint(1);
                  }}
                  disabled={isHintLoading}
                  className="px-5 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-lg transition-colors text-base disabled:opacity-40"
                >
                  {isHintLoading ? "Loading..." : "I need a hint first"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYSIS_EVALUATING state ── */}
        {pageState === "ANALYSIS_EVALUATING" && evaluationResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Your sentence
                </p>
                <div className="border-l-2 border-amber-500/60 pl-4">
                  <p className="text-zinc-100 text-base leading-relaxed">
                    {userSentence}
                  </p>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Corrected version
                </p>
                <p className="text-zinc-100 text-base leading-relaxed filter blur-[8px] select-none pointer-events-none">
                  {evaluationResult.correctedSentence}
                </p>
              </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <div className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800/50 text-zinc-400 text-base leading-relaxed">
                {userAnalysis}
              </div>
              <div className="text-center py-2">
                <p className="text-zinc-500 text-base animate-pulse">
                  Evaluating your analysis...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── HINT_REQUESTED state ── */}
        {pageState === "HINT_REQUESTED" && evaluationResult && (
          <div className="space-y-6">
            {/* Split screen */}
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
                  <p className="text-zinc-100 text-base leading-relaxed">
                    {userSentence}
                  </p>
                </div>
              </div>

              {/* Right: corrected — revealed or blurred */}
              <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                onMouseUp={rightSideRevealed ? handleTextSelect : undefined}
              >
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Corrected version
                </p>
                {rightSideRevealed ? (
                  <DiffView
                    original={userSentence}
                    corrected={evaluationResult.correctedSentence}
                  />
                ) : (
                  <p className="text-zinc-100 text-base leading-relaxed filter blur-[8px] select-none pointer-events-none">
                    {evaluationResult.correctedSentence}
                  </p>
                )}
              </div>
            </div>

            {/* Below: feedback sections */}
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Section A: Analysis feedback */}
              {analysisResult && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                    Analysis feedback
                  </h3>
                  <p className="text-zinc-200 text-base leading-relaxed">
                    {analysisResult.feedback}
                  </p>

                  {analysisResult.correctElements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                        Correct elements
                      </p>
                      <ul className="space-y-0.5">
                        {analysisResult.correctElements.map((el, i) => (
                          <li
                            key={i}
                            className="text-sm text-zinc-300 flex items-start gap-2"
                          >
                            <span className="text-zinc-600 mt-0.5">•</span>
                            {el}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.incorrectElements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                        Incorrect elements
                      </p>
                      <ul className="space-y-0.5">
                        {analysisResult.incorrectElements.map((el, i) => (
                          <li
                            key={i}
                            className="text-sm text-zinc-300 flex items-start gap-2"
                          >
                            <span className="text-zinc-600 mt-0.5">•</span>
                            {el}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.modelAnalysis && (
                    <div className="p-4 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                        Model analysis
                      </p>
                      <p className="text-sm text-zinc-300 leading-relaxed font-mono">
                        {analysisResult.modelAnalysis}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Section B: Hint */}
              {currentHintText && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    <span>Hint</span>
                    <span>
                      Hint {currentHintLevel} of 3
                    </span>
                  </div>
                  <p className="text-zinc-200 text-base leading-relaxed">
                    {currentHintText}
                  </p>
                </div>
              )}

              {/* Section C: Revision */}
              <form onSubmit={handleRevisionSubmit} className="space-y-3">
                <textarea
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  placeholder="Revise your sentence..."
                  className="w-full min-h-[80px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 resize-none text-base leading-relaxed transition-colors"
                  required
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-base"
                  >
                    Submit revision
                  </button>
                  {currentHintLevel < 3 && (
                    <button
                      type="button"
                      onClick={() => fetchHint(currentHintLevel + 1)}
                      disabled={isHintLoading}
                      className="px-5 py-2.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-lg transition-colors text-base disabled:opacity-40"
                    >
                      {isHintLoading ? "Loading..." : "Need more help"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── CORRECT state ── */}
        {pageState === "CORRECT" && (
          <div className="max-w-2xl mx-auto text-center space-y-4 py-8">
            <div className="text-5xl mb-2">✓</div>
            <p className="text-2xl font-bold text-emerald-400">Correct.</p>
            {evaluationResult?.correctedSentence && (
              <div
                className="p-4 rounded-xl bg-zinc-900 border border-emerald-500/20 text-zinc-100 text-base leading-relaxed text-left"
                onMouseUp={handleTextSelect}
              >
                {evaluationResult.correctedSentence}
              </div>
            )}
          </div>
        )}

        {/* ── ECHO state ── */}
        {pageState === "ECHO" && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="border border-teal-500/20 rounded-xl p-5 bg-zinc-900/50">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">
                Echo practice
              </p>
              <p className="text-zinc-100 text-xl leading-relaxed font-medium">
                {activePromptText}
              </p>
            </div>
            <form onSubmit={handleEvaluate} className="space-y-4">
              <textarea
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
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

        {/* ── SESSION_COMPLETE state ── */}
        {pageState === "SESSION_COMPLETE" && (
          <div className="max-w-lg mx-auto py-12 text-center space-y-6">
            <p className="text-3xl font-bold text-zinc-100">
              Session complete.
            </p>
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
            <div className="flex flex-col items-center gap-3 pt-2">
              <Link
                href="/drill"
                className="inline-block px-8 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg transition-colors text-sm"
              >
                Go to Drill Mode →
              </Link>
              <Link
                href="/word-builder/practice"
                className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Start another session
              </Link>
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

      {/* ── History panel ── */}
      {showHistory && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowHistory(false)}
          />
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 z-50 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">
                Session History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
    </div>
  );
}
