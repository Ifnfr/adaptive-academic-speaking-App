"use client";

import { useEffect, useRef } from "react";
import type { AppLanguage } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n";
import { LearningPathCard, CardStatus, LearningPathCompletionRule } from "../../lib/learning-path/types";
import { useMicroPractice } from "../../lib/learning-path/useMicroPractice";
import { GuidedWordLesson } from "./GuidedWordLesson";
import { PhrasePatternLesson } from "./PhrasePatternLesson";
import { SentenceBuilderLesson } from "./SentenceBuilderLesson";
import { MicroSpeakingLesson } from "./MicroSpeakingLesson";

export type MicroLessonShellProps = {
  card: LearningPathCard;
  status: CardStatus;
  onClose: () => void;
  onUpdateStatus: (status: LearningPathCompletionRule) => void;
  appLanguage?: AppLanguage | null;
};

export function MicroLessonShell({
  card,
  status,
  onClose,
  onUpdateStatus,
  appLanguage
}: MicroLessonShellProps) {
  useI18n(appLanguage);

  const contract = useMicroPractice("idle");
  const onUpdateStatusRef = useRef(onUpdateStatus);

  useEffect(() => {
    onUpdateStatusRef.current = onUpdateStatus;
  }, [onUpdateStatus]);

  useEffect(() => {
    if (contract.lastProgressEvent) {
      onUpdateStatusRef.current(contract.lastProgressEvent);
    }
  }, [contract.lastProgressEvent]);

  const getStatusDisplay = (st: CardStatus) => {
    switch (st) {
      case "completed":
        return "Completed";
      case "current":
        return "In Progress";
      case "recommended":
        return "Recommended";
      case "available":
        return "Available";
      case "upcoming":
      default:
        return "Upcoming";
    }
  };

  const getStatusColor = (st: CardStatus) => {
    switch (st) {
      case "completed":
        return "text-emerald-600 bg-emerald-50 border border-emerald-200";
      case "current":
        return "text-sky-600 bg-sky-50 border border-sky-200";
      case "recommended":
        return "text-amber-600 bg-amber-50 border border-amber-200";
      case "available":
        return "text-[var(--brand-teal-ink)] bg-[var(--brand-teal-soft)] border border-[var(--brand-teal)]/20";
      case "upcoming":
      default:
        return "text-gray-500 bg-gray-50 border border-gray-200";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      data-testid="micro-lesson-shell"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-muted)]">
              Day {card.dayNumber} · Unit {card.unitId.replace("introduce-yourself", "1").replace("my-daily-life", "2")}
            </span>
            <span className="text-xs font-semibold text-[var(--brand-ink-soft)] uppercase tracking-wider mt-0.5">
              {card.type.replace("-", " ")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(status)}`}>
              {getStatusDisplay(status)}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none text-xl p-1"
              aria-label="Close lesson"
              data-testid="close-lesson-btn"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {card.type === "guided-word" ? (
            <GuidedWordLesson
              card={card}
              status={status}
              contract={contract}
              appLanguage={appLanguage}
            />
          ) : card.type === "phrase-pattern" ? (
            <PhrasePatternLesson
              card={card}
              status={status}
              contract={contract}
              appLanguage={appLanguage}
            />
          ) : card.type === "sentence-builder" ? (
            <SentenceBuilderLesson
              card={card}
              status={status}
              onUpdateStatus={onUpdateStatus}
              appLanguage={appLanguage}
            />
          ) : card.type === "micro-speaking" ? (
            <MicroSpeakingLesson
              card={card}
              status={status}
              onUpdateStatus={onUpdateStatus}
              appLanguage={appLanguage}
            />
          ) : (
            <>
              {/* Card Title & Main instructions */}
              <div>
                <h2 className="text-xl font-bold text-[var(--brand-ink)]" data-testid="lesson-card-title">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--brand-ink-soft)]" data-testid="lesson-learner-instruction">
                  {card.learnerInstruction}
                </p>
                <p className="mt-1 text-sm italic text-[var(--brand-muted)]">
                  {card.indonesianExplanation}
                </p>
              </div>

              {/* Target Phrases Box */}
              <div className="rounded-xl bg-[var(--brand-surface-2)] p-4 border border-[var(--brand-border)]">
                <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
                  Target Phrases
                </span>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm font-mono text-[var(--brand-ink)]">
                  {card.targetPhrases.map((phrase, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-[var(--brand-teal-ink)]">•</span>
                      {phrase}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t border-[var(--brand-border)] pt-3">
                  <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider block">
                    Practice Format / Scaffold
                  </span>
                  <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                    {card.scaffold}
                  </p>
                </div>
              </div>

              {/* Supportive Progress Status message */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--brand-ink)]">
                  Practice started
                </span>
                <p className="text-xs text-[var(--brand-ink-soft)]">
                  Latih pengucapan frasa di atas secara mandiri dengan membaca instruksi serta contoh format yang diberikan.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer with generic actions */}
        {card.type !== "guided-word" && card.type !== "phrase-pattern" && card.type !== "sentence-builder" && card.type !== "micro-speaking" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4">
            <span className="text-xs text-[var(--brand-muted)]">
              Est: {card.estimatedMinutes} mins · Rule: {card.completionRule}
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => contract.actions.startLesson()}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors"
                data-testid="mark-viewed-btn"
              >
                Mark as viewed
              </button>

              <button
                onClick={() => contract.actions.startAttempt()}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors"
                data-testid="mark-attempted-btn"
              >
                Mark as attempted
              </button>

              <button
                onClick={() => contract.actions.continueAnyway()}
                className="rounded-lg border border-[var(--brand-border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--brand-ink)] hover:bg-gray-50 transition-colors"
                data-testid="continue-anyway-btn"
              >
                Continue anyway
              </button>

              <button
                onClick={() => contract.actions.completeWithSupport()}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                data-testid="mark-completed-btn"
              >
                Completed with support
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
