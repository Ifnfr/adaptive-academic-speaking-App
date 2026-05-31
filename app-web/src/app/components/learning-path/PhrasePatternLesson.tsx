"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";
import { canUseTutorVoice, speakTutorPhrase } from "../../lib/speech/tutor-voice";

export type PhrasePatternLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

export function PhrasePatternLesson({
  card,
  contract,
}: PhrasePatternLessonProps) {
  const [practiceCount, setPracticeCount] = useState(0);
  const [listenActive, setListenActive] = useState(false);
  const [recordState, setRecordState] = useState<"idle" | "recording" | "recorded">("idle");

  const handleListenModel = async () => {
    contract.actions.startAttempt();
    setListenActive(true);

    if (canUseTutorVoice()) {
      const textToSpeak = card.targetPhrases.join(", ");
      await speakTutorPhrase(textToSpeak);
    } else {
      // Mock playback delay
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    setListenActive(false);
  };

  const handleStartRecording = () => {
    setRecordState("recording");
    contract.actions.startAttempt();
  };

  const handleStopRecording = () => {
    setRecordState("recorded");
    setPracticeCount((prev) => prev + 1);
    contract.actions.markRecorded();
  };

  const handleRetry = () => {
    setRecordState("idle");
    contract.actions.resetLocalAttempt();
  };

  return (
    <div className="flex flex-col gap-6" data-testid="phrase-pattern-lesson">
      {/* Prominent Phrase Pattern */}
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 text-center flex flex-col items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Sentence Pattern
        </span>
        <span
          className="text-2xl font-extrabold tracking-tight text-[var(--brand-teal-ink)] font-mono"
          data-testid="formula-scaffold"
        >
          {card.scaffold}
        </span>
        <p className="text-sm italic text-[var(--brand-ink-soft)] mt-1">
          {card.indonesianExplanation}
        </p>
      </div>

      {/* Model Listening Placeholder */}
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Model Pronunciation
        </h4>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--brand-border)] p-4 bg-[var(--brand-surface)]">
          <button
            onClick={handleListenModel}
            disabled={listenActive}
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] text-lg hover:bg-[var(--brand-surface-2)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] ${
              listenActive ? "animate-pulse" : ""
            }`}
            data-testid="listen-model-btn"
          >
            {listenActive ? "🔊" : "▶"}
          </button>
          <div>
            <span className="text-sm font-semibold text-[var(--brand-ink)]">
              {listenActive ? "Playing..." : "Listen to the model"}
            </span>
            <p className="text-xs text-[var(--brand-ink-soft)] mt-0.5">
              Dengarkan cara pengucapan contoh kalimat berikut.
            </p>
            {!canUseTutorVoice() && (
              <p className="text-xs text-amber-600 font-medium mt-1" data-testid="tutor-voice-fallback">
                Tutor voice is not available in this browser yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Examples */}
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Examples
        </h4>
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 flex flex-col gap-3">
          {card.targetPhrases.map((phrase, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 text-sm font-semibold text-[var(--brand-ink)] font-mono bg-[var(--brand-surface-2)] px-4 py-2.5 rounded-lg border border-[var(--brand-border)]"
              data-testid="phrase-example"
            >
              <span className="text-emerald-500 font-bold">✓</span>
              {phrase}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Practice Guide
        </span>
        <p className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
          {card.learnerInstruction} Lengkapi pola dengan kata atau frasa Anda sendiri, lalu ucapkan dengan lantang untuk melatih kefasihan Anda.
        </p>
      </div>

      {/* Interactive Mock Recording Area */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)] self-start w-full">
          Safe Speaking Practice
        </span>

        <div className="flex flex-col items-center gap-3 text-center my-4">
          <div
            className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
              recordState === "recording"
                ? "bg-red-100 text-red-600 animate-pulse border-4 border-red-200"
                : recordState === "recorded"
                  ? "bg-emerald-100 text-emerald-600 border-4 border-emerald-200"
                  : "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border-4 border-[var(--brand-teal)]/20"
            }`}
          >
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

          <p className="text-sm font-medium text-[var(--brand-ink)] font-mono">
            {recordState === "recording"
              ? "Speaking..."
              : recordState === "recorded"
                ? "Attempt recorded locally."
                : "Ready"}
          </p>
        </div>

        <div className="flex gap-3">
          {recordState === "idle" && (
            <button
              onClick={handleStartRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] hover:border-[var(--brand-teal)] transition-colors shadow-sm focus:outline-none"
              data-testid="try-pattern-btn"
            >
              Start speaking
            </button>
          )}

          {recordState === "recording" && (
            <button
              onClick={handleStopRecording}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors shadow-sm focus:outline-none"
              data-testid="stop-record-btn"
            >
              Stop attempt
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

      {/* Control Buttons */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--brand-ink-soft)]">
            <span>Your voice is not stored or uploaded in this practice.</span>
            {practiceCount > 0 && (
              <span className="font-semibold text-emerald-600 font-mono">
                Tried pattern {practiceCount} {practiceCount === 1 ? "time" : "times"}!
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--brand-muted)]">
            This practice tracks completion only, not speech content.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => contract.actions.continueAnyway()}
            className="flex-1 rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
            data-testid="continue-btn"
          >
            Continue anyway
          </button>

          <button
            onClick={() => contract.actions.completeWithSupport()}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-all shadow-sm focus:outline-none ${
              recordState === "recorded"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            disabled={recordState !== "recorded"}
            data-testid="complete-btn"
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
