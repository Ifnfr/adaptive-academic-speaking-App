"use client";

import { useState, useEffect } from "react";

type PageState =
  | "PROMPT"
  | "EVALUATING"
  | "CORRECT"
  | "ERROR"
  | "HINT_REQUESTED"
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

const HARDCODED_PROMPT = {
  id: "test-prompt-id",
  text: "Describe how a technology you use every day has changed the way people work or communicate.",
  mode: "guided",
};

export default function WordBuilderPractice() {
  const [pageState, setPageState] = useState<PageState>("PROMPT");
  const [userSentence, setUserSentence] = useState("");
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [currentHintText, setCurrentHintText] = useState("");
  const [echoPromptText, setEchoPromptText] = useState("");
  const [isEchoAttempt, setIsEchoAttempt] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Auto-advance logic for CORRECT state
  useEffect(() => {
    if (pageState === "CORRECT") {
      const timer = setTimeout(() => {
        if (isEchoAttempt) {
          setPageState("SESSION_COMPLETE");
        } else {
          setIsEchoAttempt(true);
          setUserSentence("");
          setPageState("ECHO");
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pageState, isEchoAttempt]);

  // Handle evaluation submissions
  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSentence.trim()) return;

    setPageState("EVALUATING");

    try {
      const activePromptText = isEchoAttempt ? echoPromptText : HARDCODED_PROMPT.text;
      const activePromptId = isEchoAttempt
        ? "00000000-0000-0000-0000-000000000000"
        : HARDCODED_PROMPT.id;

      const res = await fetch("/api/word-builder/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: userSentence,
          promptId: activePromptId,
          promptText: activePromptText,
        }),
      });

      if (!res.ok) {
        throw new Error(`Evaluation failed with status ${res.status}`);
      }

      const data = await res.json();
      setEvaluationResult(data);

      if (data.isCorrect) {
        if (!isEchoAttempt) {
          setEchoPromptText(data.echoPrompt || "");
        }
        setPageState("CORRECT");
      } else {
        setPageState("ERROR");
        setCurrentHintLevel(0);
      }
    } catch (error) {
      console.error("Evaluation error:", error);
      setPageState("ERROR");
    }
  };

  // Handle fetching hints
  const fetchHint = async (level: number) => {
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

      if (!res.ok) {
        throw new Error(`Hint request failed with status ${res.status}`);
      }

      const data = await res.json();
      setCurrentHintText(data.hintText || "");
      setCurrentHintLevel(level);
      setPageState("HINT_REQUESTED");
    } catch (error) {
      console.error("Hint error:", error);
    } finally {
      setIsHintLoading(false);
    }
  };

  const activePromptText = isEchoAttempt ? echoPromptText : HARDCODED_PROMPT.text;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-6 md:p-8 space-y-6">
        
        {/* PROMPT State */}
        {pageState === "PROMPT" && (
          <form onSubmit={handleEvaluate} className="space-y-4">
            <p className="text-zinc-100 text-lg leading-relaxed">{activePromptText}</p>
            <textarea
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              className="w-full min-h-[120px] p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-750 resize-none text-base leading-relaxed"
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold rounded-lg transition-colors text-base"
            >
              Submit
            </button>
          </form>
        )}

        {/* EVALUATING State */}
        {pageState === "EVALUATING" && (
          <div className="space-y-4">
            <p className="text-zinc-100 text-lg leading-relaxed">{activePromptText}</p>
            <div className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800/50 text-zinc-400 text-base leading-relaxed whitespace-pre-wrap select-none">
              {userSentence}
            </div>
            <div className="text-center text-zinc-500 py-3 text-base">
              Evaluating...
            </div>
          </div>
        )}

        {/* CORRECT State */}
        {pageState === "CORRECT" && (
          <div className="space-y-4">
            <p className="text-zinc-100 text-lg leading-relaxed">Correct.</p>
            <div className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-base leading-relaxed">
              {evaluationResult?.correctedSentence}
            </div>
          </div>
        )}

        {/* ERROR State */}
        {pageState === "ERROR" && (
          <div className="space-y-4">
            <p className="text-zinc-100 text-lg leading-relaxed">{activePromptText}</p>
            <div className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800/50 text-zinc-400 text-base leading-relaxed whitespace-pre-wrap select-none">
              {userSentence}
            </div>
            <p className="text-zinc-200 font-medium text-base">Your sentence contains errors.</p>
            <button
              type="button"
              onClick={() => fetchHint(1)}
              disabled={isHintLoading}
              className="w-full py-2.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold rounded-lg transition-colors disabled:opacity-50 text-base"
            >
              {isHintLoading ? "Loading hint..." : "Get a hint"}
            </button>
          </div>
        )}

        {/* HINT_REQUESTED State */}
        {pageState === "HINT_REQUESTED" && (
          <form onSubmit={handleEvaluate} className="space-y-5">
            <p className="text-zinc-100 text-lg leading-relaxed">{activePromptText}</p>
            
            {/* Hint Box */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                <span>Hint</span>
                <span>Hint {currentHintLevel} of 3</span>
              </div>
              <p className="text-zinc-200 text-base leading-relaxed">{currentHintText}</p>
            </div>

            <textarea
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              className="w-full min-h-[120px] p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-750 resize-none text-base leading-relaxed"
              required
            />
            
            <div className="space-y-2.5">
              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold rounded-lg transition-colors text-base"
              >
                Submit revision
              </button>
              {currentHintLevel < 3 && (
                <button
                  type="button"
                  onClick={() => fetchHint(currentHintLevel + 1)}
                  disabled={isHintLoading}
                  className="w-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-semibold rounded-lg transition-colors disabled:opacity-50 text-base"
                >
                  {isHintLoading ? "Loading..." : "Need more help"}
                </button>
              )}
            </div>
          </form>
        )}

        {/* ECHO State */}
        {pageState === "ECHO" && (
          <form onSubmit={handleEvaluate} className="space-y-4">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Echo practice
            </p>
            <p className="text-zinc-100 text-lg leading-relaxed">{activePromptText}</p>
            <textarea
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              className="w-full min-h-[120px] p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-750 resize-none text-base leading-relaxed"
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold rounded-lg transition-colors text-base"
            >
              Submit
            </button>
          </form>
        )}

        {/* SESSION_COMPLETE State */}
        {pageState === "SESSION_COMPLETE" && (
          <div className="py-6 text-center">
            <p className="text-2xl font-bold text-zinc-100">Session complete.</p>
          </div>
        )}

      </div>
    </div>
  );
}
