"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus } from "../../lib/learning-path/types";
import { MicroPracticeContract } from "../../lib/learning-path/useMicroPractice";
import { useState } from "react";

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

  const handlePractice = () => {
    setPracticeCount(prev => prev + 1);
    contract.actions.startAttempt();
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

      {/* Control Buttons */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex items-center justify-between text-xs text-[var(--brand-ink-soft)]">
          <span>Practice speaking formulaic chunks to sound natural</span>
          {practiceCount > 0 && (
            <span className="font-semibold text-emerald-600">
              Tried pattern {practiceCount} {practiceCount === 1 ? "time" : "times"}!
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePractice}
            className="flex-1 rounded-xl bg-[var(--brand-teal)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[var(--brand-teal-ink)] transition-colors shadow-sm focus:outline-none"
            data-testid="try-pattern-btn"
          >
            Try the pattern
          </button>

          <button
            onClick={() => contract.actions.continueAnyway()}
            className="rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
            data-testid="continue-btn"
          >
            Continue anyway
          </button>

          <button
            onClick={() => contract.actions.completeWithSupport()}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm focus:outline-none"
            data-testid="complete-btn"
          >
            Completed with support
          </button>
        </div>
      </div>
    </div>
  );
}
