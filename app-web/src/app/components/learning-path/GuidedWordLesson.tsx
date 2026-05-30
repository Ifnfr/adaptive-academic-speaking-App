"use client";

import type { AppLanguage } from "../../lib/i18n";
import { LearningPathCard, CardStatus, LearningPathCompletionRule } from "../../lib/learning-path/types";
import { useState } from "react";

export type GuidedWordLessonProps = {
  card: LearningPathCard;
  status: CardStatus;
  onUpdateStatus: (status: LearningPathCompletionRule) => void;
  appLanguage?: AppLanguage | null;
};

export function GuidedWordLesson({
  card,
  onUpdateStatus,
}: GuidedWordLessonProps) {
  const [listenActive, setListenActive] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);

  const handleListenModel = () => {
    setListenActive(true);
    setTimeout(() => {
      setListenActive(false);
      onUpdateStatus("viewed");
    }, 1200);
  };

  const handlePractice = () => {
    setPracticeCount(prev => prev + 1);
    onUpdateStatus("attempted");
  };

  return (
    <div className="flex flex-col gap-6" data-testid="guided-word-lesson">
      {/* Prominent Target Phrases */}
      <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 text-center flex flex-col items-center gap-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Target Word / Phrase
        </span>
        <div className="flex flex-col gap-2">
          {card.targetPhrases.map((phrase, idx) => (
            <span
              key={idx}
              className="text-3xl font-extrabold tracking-tight text-[var(--brand-teal-ink)] font-mono"
              data-testid="target-phrase"
            >
              {phrase}
            </span>
          ))}
        </div>
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
              {listenActive ? "Playing model audio..." : "Listen to the model"}
            </span>
            <p className="text-xs text-[var(--brand-ink-soft)] mt-0.5">
              Dengarkan cara pengucapan penutur asli untuk melatih intonasi.
            </p>
          </div>
        </div>
      </div>

      {/* Scaffold / Guidance */}
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-muted)]">
          Speaking Template / Scaffold
        </h4>
        <div className="rounded-xl border border-[var(--brand-border)] p-4 bg-[var(--brand-surface)] font-mono text-sm text-[var(--brand-ink)]">
          {card.scaffold}
        </div>
      </div>

      {/* Interactive Practice Controls */}
      <div className="flex flex-col gap-4 border-t border-[var(--brand-border)] pt-5">
        <div className="flex items-center justify-between text-xs text-[var(--brand-ink-soft)]">
          <span>You are building confidence step by step</span>
          {practiceCount > 0 && (
            <span className="font-semibold text-emerald-600">
              Practiced {practiceCount} {practiceCount === 1 ? "time" : "times"}!
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePractice}
            className="flex-1 rounded-xl bg-[var(--brand-teal)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[var(--brand-teal-ink)] transition-colors shadow-sm focus:outline-none"
            data-testid="practice-phrase-btn"
          >
            Practice this phrase
          </button>

          <button
            onClick={() => onUpdateStatus("continued")}
            className="rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors focus:outline-none"
            data-testid="continue-btn"
          >
            Continue anyway
          </button>

          <button
            onClick={() => onUpdateStatus("completed")}
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
