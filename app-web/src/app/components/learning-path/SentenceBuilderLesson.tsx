"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";

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
  const isProgressive = card.builderMode === "progressive";
  const targetPhrase = card.targetPhrases[0] || "";

  // Progressive Builder local state
  const slots = card.progressiveSlots || [];
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<Array<{ id: string; text: string }>>([]);
  const [progFeedback, setProgFeedback] = useState<"none" | "success" | "retry">("none");
  const [isCompleted, setIsCompleted] = useState(false);
  const [listenActive, setListenActive] = useState(false);

  // Standard states
  const [targetWords] = useState<string[]>(() => {
    return targetPhrase.split(/\s+/).filter(Boolean);
  });

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

  // Model voice synthesis playback
  const handleListenModel = () => {
    setListenActive(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.targetPhrases.join(". "));
      utterance.lang = "en-US";
      utterance.onend = () => setListenActive(false);
      utterance.onerror = () => setListenActive(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setListenActive(false);
      }, 1500);
    }
  };

  // Standard token selection
  const handleTokenClick = (tokenId: number) => {
    if (selectedTokenIds.includes(tokenId)) return;

    const newSelection = [...selectedTokenIds, tokenId];
    setSelectedTokenIds(newSelection);
    setIsResetAllowed(true);
    setFeedback("none");

    contract.actions.startAttempt();

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

  // Progressive Builder handlers
  const handleChoiceClick = (choice: { id: string; text: string; isCorrect?: boolean }) => {
    contract.actions.startAttempt();
    setProgFeedback("none");

    if (choice.isCorrect) {
      const newChoices = [...selectedChoices, { id: choice.id, text: choice.text }];
      setSelectedChoices(newChoices);

      if (currentSlotIndex < slots.length - 1) {
        setCurrentSlotIndex(currentSlotIndex + 1);
      } else {
        setIsCompleted(true);
        setProgFeedback("success");
      }
    } else {
      setProgFeedback("retry");
      contract.actions.markAttempted();
    }
  };

  const handleResetProgressive = () => {
    setCurrentSlotIndex(0);
    setSelectedChoices([]);
    setProgFeedback("none");
    setIsCompleted(false);
    contract.actions.resetLocalAttempt();
  };

  // 1. Progressive mode rendering
  if (isProgressive) {
    return (
      <div className="flex flex-col gap-6" data-testid="progressive-builder-lesson">
        {/* Title & Explanation */}
        <div>
          <h2 className="text-xl font-bold text-[var(--brand-ink)] animate-fade-in" data-testid="lesson-card-title">
            {card.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]" data-testid="lesson-learner-instruction">
            {card.learnerInstruction}
          </p>
          <p className="mt-1 text-xs italic text-[var(--brand-muted)]">
            {card.indonesianExplanation}
          </p>
        </div>

        {/* Slot Progress Sequence */}
        <div className="flex flex-col gap-2 p-3 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-xl" data-testid="progressive-slots-container">
          <span className="text-[10px] uppercase font-bold text-[var(--brand-muted)]">Slot sequence:</span>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[var(--brand-ink)]">
            {slots.map((slot, idx) => (
              <span
                key={slot.id}
                className={`px-2.5 py-1 rounded border text-xs transition-all duration-200 ${
                  idx === currentSlotIndex && !isCompleted
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold scale-105"
                    : idx < selectedChoices.length
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 opacity-60"
                      : "bg-gray-50 text-gray-400 border-gray-100 opacity-50"
                }`}
                data-testid={`slot-step-${slot.id}`}
              >
                {slot.label}
              </span>
            ))}
          </div>
        </div>

        {/* Assembled Sentence Preview Box */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Assembled Sentence
          </span>

          <div
            className="min-h-16 flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-[var(--brand-border)] p-4 bg-[var(--brand-surface)]"
            data-testid="assembled-words-box"
          >
            {selectedChoices.length === 0 ? (
              <span className="text-xs text-[var(--brand-muted)] italic">
                Select choices below to construct the sentence...
              </span>
            ) : (
              selectedChoices.map((choice, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-[var(--brand-teal-soft)] border border-[var(--brand-teal)]/20 px-3 py-1.5 text-sm font-semibold text-[var(--brand-teal-ink)] font-mono animate-fade-in"
                  data-testid="selected-choice-token"
                >
                  {choice.text}
                </span>
              ))
            )}
          </div>

          {/* Current Slot Choices */}
          {!isCompleted && slots[currentSlotIndex] && (
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] uppercase font-bold text-[var(--brand-muted)]" data-testid="current-slot-focus">
                Current Slot: {slots[currentSlotIndex].label}
              </span>
              <div className="flex flex-wrap gap-2 justify-center" data-testid="choices-box">
                {slots[currentSlotIndex].choices.map(choice => (
                  <button
                    key={choice.id}
                    onClick={() => handleChoiceClick(choice)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold border bg-white text-[var(--brand-ink)] border-[var(--brand-border)] hover:border-[var(--brand-teal)] hover:bg-[var(--brand-surface-2)] active:scale-95 transition-all duration-150 font-mono shadow-sm focus:outline-none"
                    data-testid={`choice-btn-${choice.id}`}
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reset / Try Again */}
          {(selectedChoices.length > 0 || progFeedback === "retry") && (
            <button
              onClick={handleResetProgressive}
              className="self-center mt-2 rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] hover:bg-gray-50 hover:text-gray-700 transition-colors focus:outline-none"
              data-testid="reset-builder-btn"
            >
              Try again
            </button>
          )}
        </div>

        {/* Model Playback if Completed */}
        {isCompleted && (
          <div className="flex flex-col items-center gap-2 p-3 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-xl">
            <button
              onClick={handleListenModel}
              disabled={listenActive}
              className={`flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50 focus:outline-none ${
                listenActive ? "text-sky-600 border-sky-200 bg-sky-50" : "text-[var(--brand-ink)]"
              }`}
              data-testid="play-model-btn"
            >
              🔊 {listenActive ? "Playing..." : "Listen to Model"}
            </button>
          </div>
        )}

        {/* Reference */}
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Reference Phrase
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

        {/* Feedback messages */}
        {progFeedback === "success" && (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-xs font-medium animate-bounce-subtle"
            data-testid="builder-feedback-success"
          >
            🎉 Great. You built the sentence step by step.
          </div>
        )}
        {progFeedback === "retry" && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-xs font-medium"
            data-testid="builder-feedback-retry"
          >
            💡 Try another option. You are building the sentence step by step.
          </div>
        )}

        {/* Privacy Note */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
          <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
            This practice uses fixed choices only. No private sentence is stored.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
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
                isCompleted
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
              }`}
              data-testid="complete-btn"
              disabled={!isCompleted}
            >
              Completed with support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Standard mode rendering
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

      {/* Interactive Action CTA */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex items-center justify-between text-[11px] text-[var(--brand-ink-soft)]">
          <span>Arrange words to master correct sentence structures</span>
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
            data-testid="complete-btn"
            disabled={feedback !== "success"}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
