"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";
import { canUseTutorVoice, speakTutorPhrase } from "../../lib/speech/tutor-voice";

export type SentenceBuilderLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

// Clean punctuation and lowercase for comparison
function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
}

export function SentenceBuilderLesson({
  card,
  contract,
}: SentenceBuilderLessonProps) {
  const targetPhrase = card.targetPhrases[0] || "";

  // Split words by whitespace lazily on mount
  const [targetWords] = useState<string[]>(() => {
    return targetPhrase.split(/\s+/).filter(Boolean);
  });

  // Shuffle tokens lazily on mount
  const [shuffledTokens] = useState<{ id: number; word: string }[]>(() => {
    const words = targetPhrase.split(/\s+/).filter(Boolean);
    const tokens = words.map((word, index) => ({ id: index, word }));
    const shuffled = [...tokens];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"none" | "success" | "retry">("none");
  const [isResetAllowed, setIsResetAllowed] = useState(false);
  const [listenActive, setListenActive] = useState(false);
  const [recordState, setRecordState] = useState<"idle" | "recording" | "recorded">("idle");
  const [practiceCount, setPracticeCount] = useState(0);

  const handleListenModel = async () => {
    contract.actions.startAttempt(); // Listening acts as starting an attempt
    setListenActive(true);

    if (canUseTutorVoice()) {
      await speakTutorPhrase(targetPhrase);
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

  const handleTokenClick = (tokenId: number) => {
    if (selectedTokenIds.includes(tokenId)) return;

    const newSelection = [...selectedTokenIds, tokenId];
    setSelectedTokenIds(newSelection);
    setIsResetAllowed(true);
    setFeedback("none");

    // Report attempted state to the progress callback
    contract.actions.startAttempt();

    // If all tokens are selected, check the answer
    if (newSelection.length === targetWords.length) {
      const assembledSentence = newSelection
        .map(id => {
          const token = shuffledTokens.find(t => t.id === id);
          return token ? token.word : "";
        })
        .join(" ");

      const isCorrect = cleanWord(assembledSentence) === cleanWord(targetPhrase);
      if (isCorrect) {
        setFeedback("success");
      } else {
        setFeedback("retry");
        contract.actions.markAttempted();
      }
    }
  };

  const handleReset = () => {
    setSelectedTokenIds([]);
    setFeedback("none");
    setIsResetAllowed(false);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="sentence-builder-lesson">
      {/* Title & Indonesian Explanation */}
      <div>
        <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
          {card.title}
        </h2>
        <p className="mt-2 text-sm italic text-[var(--brand-ink-soft)]">
          {card.indonesianExplanation}
        </p>
      </div>

      {/* Assembly Area */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Build the sentence
        </span>

        {/* Selected Words Visualizer */}
        <div 
          className="min-h-16 flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-[var(--brand-border)] p-4 bg-[var(--brand-surface)]"
          data-testid="assembled-words-box"
        >
          {selectedTokenIds.length === 0 ? (
            <span className="text-xs text-[var(--brand-muted)] italic">
              Tap the words in order to assemble the phrase...
            </span>
          ) : (
            selectedTokenIds.map(id => {
              const token = shuffledTokens.find(t => t.id === id);
              return (
                <span
                  key={id}
                  className="rounded-lg bg-[var(--brand-teal-soft)] border border-[var(--brand-teal)]/20 px-3 py-1.5 text-sm font-semibold text-[var(--brand-teal-ink)] font-mono animate-fade-in"
                  data-testid="selected-word-token"
                >
                  {token?.word}
                </span>
              );
            })
          )}
        </div>

        {/* Word Selection Tokens */}
        <div className="mt-2 flex flex-wrap gap-2 justify-center" data-testid="shuffled-tokens-box">
          {shuffledTokens.map(token => {
            const isSelected = selectedTokenIds.includes(token.id);
            return (
              <button
                key={token.id}
                onClick={() => handleTokenClick(token.id)}
                disabled={isSelected}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold border transition-all duration-150 font-mono shadow-sm focus:outline-none ${
                  isSelected
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed scale-95 opacity-55"
                    : "bg-white text-[var(--brand-ink)] border-[var(--brand-border)] hover:border-[var(--brand-teal)] hover:bg-[var(--brand-surface-2)] active:scale-95"
                }`}
                data-testid={`word-token-${token.word}`}
              >
                {token.word}
              </button>
            );
          })}
        </div>

        {/* Reset Control */}
        {isResetAllowed && (
          <button
            onClick={handleReset}
            className="self-center mt-2 rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] hover:bg-gray-50 hover:text-gray-700 transition-colors focus:outline-none"
            data-testid="reset-builder-btn"
          >
            Clear / Reset
          </button>
        )}
      </div>

      {/* Model Listening */}
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
              Dengarkan cara pengucapan penutur asli untuk melatih intonasi.
            </p>
            {!canUseTutorVoice() && (
              <p className="text-xs text-amber-600 font-medium mt-1" data-testid="tutor-voice-fallback">
                Tutor voice is not available in this browser yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Target Phrases Hint Reference */}
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Target Phrases Reference
        </span>
        <ul className="flex flex-col gap-1.5 text-xs font-mono text-[var(--brand-ink)]" data-testid="target-phrases-hint-list">
          {card.targetPhrases.map((phrase, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="text-[var(--brand-teal-ink)] font-bold">•</span>
              {phrase}
            </li>
          ))}
        </ul>
      </div>

      {/* Local Feedback State Message */}
      {feedback === "success" && (
        <div 
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-xs font-medium animate-bounce-subtle"
          data-testid="builder-feedback-success"
        >
          🎉 Good order! You assembled the sentence correctly.
        </div>
      )}
      {feedback === "retry" && (
        <div 
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-xs font-medium"
          data-testid="builder-feedback-retry"
        >
          💡 Try again. You are learning the sentence pattern step by step.
        </div>
      )}

      {/* Interactive Mock Recording Area - Optional speaking practice */}
      {feedback === "success" && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 animate-fade-in">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)] self-start w-full">
            Optional Speaking Practice
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
                data-testid="start-record-btn"
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
      )}

      {/* Interactive Action CTA */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--brand-ink-soft)]">
            <span>Your voice is not stored or uploaded in this practice.</span>
            {practiceCount > 0 && (
              <span className="font-semibold text-emerald-600 font-mono text-[11px]">
                Practiced speaking {practiceCount} {practiceCount === 1 ? "time" : "times"}!
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
              feedback === "success"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            disabled={feedback !== "success"}
            data-testid="complete-btn"
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
