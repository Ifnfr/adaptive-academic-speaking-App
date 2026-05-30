"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus, LearningPathCompletionRule } from "../../lib/learning-path/types";
import { useState, useEffect } from "react";

export type MicroSpeakingLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  onUpdateStatus: (status: LearningPathCompletionRule) => void;
  appLanguage?: AppLanguage | null;
};

export function MicroSpeakingLesson({
  card,
  onUpdateStatus,
}: MicroSpeakingLessonProps) {
  const [recordState, setRecordState] = useState<"idle" | "recording" | "recorded">("idle");

  // Trigger viewed status once on mount
  useEffect(() => {
    onUpdateStatus("viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartRecording = () => {
    setRecordState("recording");
    onUpdateStatus("attempted");
  };

  const handleStopRecording = () => {
    setRecordState("recorded");
  };

  const handleRetry = () => {
    setRecordState("idle");
  };

  return (
    <div className="flex flex-col gap-6" data-testid="micro-speaking-lesson">
      {/* Title & Indonesian Explanation */}
      <div>
        <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
          {card.title}
        </h2>
        <p className="mt-2 text-sm italic text-[var(--brand-ink-soft)]">
          {card.indonesianExplanation}
        </p>
      </div>

      {/* Target Phrases Box */}
      <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 border border-[var(--brand-border)]">
        <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
          Target Phrases
        </span>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm font-mono text-[var(--brand-ink)]" data-testid="target-phrases-hint-list">
          {card.targetPhrases.map((phrase, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="text-[var(--brand-teal-ink)]">•</span>
              {phrase}
            </li>
          ))}
        </ul>

        {card.scaffold && (
          <div className="mt-4 border-t border-[var(--brand-border)] pt-3">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
              Practice Format / Scaffold
            </span>
            <p className="mt-1 text-xs text-[var(--brand-ink-soft)]" data-testid="scaffold-text">
              {card.scaffold}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Mock Recording Area */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)] self-start w-full">
          Safe Speaking Practice
        </span>
        
        <div className="flex flex-col items-center gap-3 text-center my-4">
          <div className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
            recordState === "recording" 
              ? "bg-red-100 text-red-600 animate-pulse border-4 border-red-200" 
              : recordState === "recorded"
                ? "bg-emerald-100 text-emerald-600 border-4 border-emerald-200"
                : "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border-4 border-[var(--brand-teal)]/20"
          }`}>
            {recordState === "recording" ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="5" width="10" height="10" rx="1" />
              </svg>
            ) : recordState === "recorded" ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
          
          <p className="text-sm font-medium text-[var(--brand-ink)]">
            {recordState === "recording" 
              ? "Listening... Read the phrases clearly." 
              : recordState === "recorded"
                ? "Attempt recorded locally."
                : "Tap to simulate speaking attempt."}
          </p>
        </div>

        <div className="flex gap-3">
          {recordState === "idle" && (
            <button
              onClick={handleStartRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:border-[var(--brand-teal)] transition-colors shadow-sm focus:outline-none"
              data-testid="start-record-btn"
            >
              Start attempt
            </button>
          )}

          {recordState === "recording" && (
            <button
              onClick={handleStopRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors shadow-sm focus:outline-none"
              data-testid="stop-record-btn"
            >
              Stop recording
            </button>
          )}

          {recordState === "recorded" && (
            <button
              onClick={handleRetry}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:bg-gray-50 transition-colors shadow-sm focus:outline-none"
              data-testid="retry-record-btn"
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {/* Interactive Action CTA */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex items-center justify-between text-[11px] text-[var(--brand-ink-soft)]">
          <span>Complete the speaking attempt to proceed</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onUpdateStatus("continued")}
            className="flex-1 rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
            data-testid="continue-btn"
          >
            Continue anyway
          </button>

          <button
            onClick={() => onUpdateStatus("completed")}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-all shadow-sm focus:outline-none ${
              recordState === "recorded"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            data-testid="complete-btn"
            disabled={recordState !== "recorded"}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
