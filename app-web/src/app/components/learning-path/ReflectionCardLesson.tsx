"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";

export type ReflectionCardLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  contract: MicroPracticeContract;
  appLanguage?: AppLanguage | null;
};

export function ReflectionCardLesson({
  card,
  contract,
}: ReflectionCardLessonProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const prompt = card.reflectionPrompt;
  const isMalformed = !prompt || !prompt.question || !Array.isArray(prompt.options) || prompt.options.length === 0;

  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
    contract.actions.startAttempt();
  };

  const getFeedbackText = (option: string) => {
    const opt = option.toLowerCase();
    if (opt.includes("very") || opt.includes("confident") || opt.includes("great")) {
      return "Great. Keep building this speaking habit.";
    }
    if (opt.includes("okay") || opt.includes("good") || opt.includes("progress")) {
      return "Good progress. A little more practice will make this easier.";
    }
    return "That is okay. You can review with support anytime.";
  };

  if (isMalformed) {
    return (
      <div className="flex flex-col gap-6" data-testid="reflection-card-lesson">
        <div>
          <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
            {card.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-ink-soft)]" data-testid="lesson-learner-instruction">
            {card.learnerInstruction}
          </p>
          <p className="mt-1 text-xs italic text-[var(--brand-muted)]">
            {card.indonesianExplanation}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 text-center flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Practice target phrases:
          </span>
          <div className="flex flex-col gap-1.5 font-mono text-[var(--brand-ink)]">
            {card.targetPhrases.map((phrase, idx) => (
              <span key={idx} className="text-sm font-semibold">{phrase}</span>
            ))}
          </div>
        </div>

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
              className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm focus:outline-none"
              data-testid="complete-btn"
            >
              Completed with support
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="reflection-card-lesson">
      {/* Title */}
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

      {/* Target phrases reference if present */}
      {card.targetPhrases && card.targetPhrases.length > 0 && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)] block mb-1">
            Reference Target Phrases
          </span>
          <ul className="flex flex-col gap-1 text-xs font-mono text-[var(--brand-ink-soft)]">
            {card.targetPhrases.map((phrase, idx) => (
              <li key={idx}>• {phrase}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reflection Question Box */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Confidence Habit Review
        </span>
        <p className="text-lg font-bold text-[var(--brand-ink)]" data-testid="reflection-question">
          {prompt.question}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Choose the option that best matches how this practice felt.
        </span>
        <div className="flex flex-col gap-2" data-testid="reflection-options-box">
          {prompt.options.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(opt)}
                className={`w-full text-left rounded-xl p-3.5 text-sm font-semibold border transition-all duration-150 shadow-sm focus:outline-none ${
                  isSelected
                    ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border-[var(--brand-teal)]/30 scale-[1.01]"
                    : "bg-white text-[var(--brand-ink)] border-[var(--brand-border)] hover:bg-gray-50 hover:border-gray-300"
                }`}
                data-testid="reflection-option"
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Option Feedback Visualizer */}
      {selectedOption && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 flex flex-col gap-2 items-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
            Your Assessment
          </span>
          <p className="text-base font-bold text-[var(--brand-teal-ink)] font-mono animate-fade-in" data-testid="selected-reflection-option">
            {selectedOption}
          </p>
          <div className="mt-3 border-t border-[var(--brand-border)] pt-3 w-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            {getFeedbackText(selectedOption)}
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
        <p className="text-xs text-[var(--brand-muted)]" data-testid="privacy-note">
          This reflection uses fixed options only. No private note is stored. You can continue with support.
        </p>
      </div>

      {/* Footer actions */}
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
              selectedOption !== null
                ? "bg-emerald-600 hover:bg-emerald-700 animate-fade-in"
                : "bg-gray-400 cursor-not-allowed hover:bg-gray-500"
            }`}
            data-testid="complete-reflection-card-btn"
            disabled={selectedOption === null}
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
