/**
 * Archived UI shell for future Learning Path rebuild. Not currently mounted.
 */
"use client";

import { useState } from "react";
import type { AppLanguage } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n";

export type LearningPathUiArchiveProps = {
  appLanguage?: AppLanguage | null;
};

const cardStyle =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm overflow-hidden flex flex-col transition-all duration-200";

type CardStatus = "completed" | "current" | "recommended" | "available" | "upcoming";

type DummyCard = {
  id: string;
  type: string;
  title: string;
  learnerInstruction: string;
  indonesianExplanation: string;
  targetPhrases: string[];
  scaffold: string;
  estimatedMinutes: number;
  completionRule: string;
};

const dummyPath = {
  title: "Speaking Confidence Ladder (Archived UI)",
  description: "Archived layout structure for future adaptive speaking path.",
  phases: [
    {
      id: "phase-1",
      title: "Phase 1: Confidence Foundation",
      description: "Basic greeting, daily routines, and self-introduction skills.",
      units: [
        {
          id: "unit-1",
          unitNumber: 1,
          title: "Introduce Yourself",
          description: "Learn to introduce yourself and state basic personal information.",
          days: [
            {
              dayNumber: 1,
              title: "Greeting & Base Info",
              cards: [
                {
                  id: "card-d1-c1",
                  type: "guided-phrase",
                  title: "Greeting Someone",
                  learnerInstruction: "Practice greeting someone and sharing your name in British English.",
                  indonesianExplanation: "Latih cara menyapa seseorang dan menyebutkan nama Anda.",
                  targetPhrases: ["Hello, my name is...", "Nice to meet you."],
                  scaffold: "Hello, my name is [Name].",
                  estimatedMinutes: 3,
                  completionRule: "Record at least 1 attempt",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export function LearningPathUiArchive({ appLanguage }: LearningPathUiArchiveProps) {
  useI18n(appLanguage);

  const [completedCount, setCompletedCount] = useState(0);
  const totalCards = 1;
  const progressPercent = Math.round((completedCount / totalCards) * 100);

  const handleStartLesson = (card: DummyCard) => {
    console.log("Archive preview card clicked:", card.id);
  };

  const handleCompleteCard = () => {
    if (completedCount < totalCards) {
      setCompletedCount((prev) => prev + 1);
    }
  };

  const handleResetProgress = () => {
    setCompletedCount(0);
  };

  const getStatusBadgeStyle = (status: CardStatus) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
      case "current":
        return "bg-sky-500/10 text-sky-600 border border-sky-500/20";
      case "recommended":
        return "bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse";
      case "available":
        return "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] border border-[var(--brand-teal)]/20";
      case "upcoming":
      default:
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20 opacity-60";
    }
  };

  const getCardHeaderStyle = (status: CardStatus) => {
    if (status === "upcoming") {
      return "opacity-60 bg-[var(--brand-surface-2)]";
    }
    if (status === "recommended") {
      return "bg-amber-500/5 border-b border-amber-500/10";
    }
    if (status === "current") {
      return "bg-sky-500/5 border-b border-sky-500/10";
    }
    return "bg-[var(--brand-surface-2)] border-b border-[var(--brand-border)]";
  };

  const recommendedCard = dummyPath.phases[0].units[0].days[0].cards[0];

  return (
    <div className="flex flex-col gap-6" data-testid="learning-path-archive-container">
      {/* Header Intro Card */}
      <div className={`${cardStyle} p-6`}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-ink)]">
              {dummyPath.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-ink-soft)] max-w-2xl">
              {dummyPath.description}
            </p>
          </div>
          <button
            onClick={handleResetProgress}
            className="self-start rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            Reset Progress
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 border-t border-[var(--brand-border)] pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--brand-ink)]">
              Full Learning Path Progress
            </span>
            <span className="font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
              {completedCount} / {totalCards} cards completed ({progressPercent}%)
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-[var(--brand-surface-2)] overflow-hidden border border-[var(--brand-border)]">
            <div
              className="h-full rounded-full bg-[var(--brand-teal)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Vertical Journey Timeline */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {dummyPath.phases.map((phase, phaseIndex) => (
            <div key={phase.id} className="flex flex-col gap-6">
              {/* Phase header */}
              <div className="flex items-center gap-3 pt-2">
                <span className="rounded-full bg-[var(--brand-teal)]/10 border border-[var(--brand-teal)]/30 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-teal-ink)]">
                  Phase {phaseIndex + 1}
                </span>
                <div>
                  <h2 className="text-base font-bold text-[var(--brand-ink)]">
                    {phase.title}
                  </h2>
                  <p className="text-xs text-[var(--brand-ink-soft)]">{phase.description}</p>
                </div>
              </div>

              {phase.units.map((unit) => (
                <div key={unit.id} className="flex flex-col gap-4">
                  <div className="border-b-2 border-[var(--brand-teal-soft)] pb-2">
                    <h2 className="text-lg font-bold text-[var(--brand-teal-ink)]">
                      Unit {unit.unitNumber}: {unit.title}
                    </h2>
                    <p className="text-xs text-[var(--brand-ink-soft)]">
                      {unit.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-6 pl-4 border-l-2 border-[var(--brand-border)] ml-2">
                    {unit.days.map((day) => (
                      <div key={day.dayNumber} className="relative flex flex-col gap-3">
                        <div className="absolute -left-[23px] top-3 h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-border)] bg-white"></div>

                        <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
                          Day {day.dayNumber}: {day.title}
                        </h3>

                        <div className="flex flex-col gap-3">
                          {day.cards.map((card) => {
                            const status: CardStatus = completedCount > 0 ? "completed" : "recommended";
                            const isUpcoming = false;
                            return (
                              <div
                                key={card.id}
                                className={`${cardStyle} ${isUpcoming ? "opacity-75 border-dashed" : ""}`}
                              >
                                <div className={`flex items-center justify-between px-4 py-3 ${getCardHeaderStyle(status)}`}>
                                  <span className="text-xs font-semibold text-[var(--brand-ink-soft)] uppercase tracking-wider">
                                    {card.type.replace("-", " ")}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeStyle(status)}`}>
                                    {status}
                                  </span>
                                </div>

                                <div className="p-4 flex flex-col gap-3">
                                  <div>
                                    <h4 className="font-semibold text-sm text-[var(--brand-ink)]">
                                      {card.title}
                                    </h4>
                                    <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                                      {card.learnerInstruction}
                                    </p>
                                    <p className="mt-1.5 text-xs italic text-[var(--brand-muted)]">
                                      {card.indonesianExplanation}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-[var(--brand-surface-2)] p-3 border border-[var(--brand-border)]">
                                    <span className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wide">
                                      Target Phrases / Pattern
                                    </span>
                                    <div className="mt-1 flex flex-col gap-1 text-xs font-mono text-[var(--brand-ink)]">
                                      {card.targetPhrases.map((phrase, pi) => (
                                        <div key={pi}>• {phrase}</div>
                                      ))}
                                    </div>
                                    <div className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                                      <span className="font-semibold">Format:</span> {card.scaffold}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-[var(--brand-border)] pt-3 text-xs">
                                    <span className="text-[var(--brand-muted)]">
                                      Est: {card.estimatedMinutes} mins · Rule: {card.completionRule}
                                    </span>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleStartLesson(card)}
                                        className="rounded bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] hover:bg-[var(--brand-surface-2)] px-3 py-1 font-medium transition-colors"
                                      >
                                        Preview Lesson
                                      </button>

                                      {status !== "completed" && (
                                        <button
                                          onClick={() => handleCompleteCard()}
                                          className="rounded bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 font-medium hover:bg-emerald-100 transition-colors"
                                        >
                                          Mark Completed
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right Sidebar Mission Panel */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-6 h-fit">
          <div className={`${cardStyle} border-[var(--brand-teal-ink)]`}>
            <div className="bg-[var(--brand-teal-ink)] text-white px-5 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                Today&apos;s Mission
              </h3>
              <p className="text-xs text-white/60">
                Recommended learning task
              </p>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {completedCount >= totalCards ? (
                <div className="text-center py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">
                    🏆
                  </div>
                  <h4 className="mt-4 font-bold text-sm text-[var(--brand-ink)]">
                    All Days Complete!
                  </h4>
                  <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                    You have completed all days.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Day 1 Recommended
                    </span>
                    <h4 className="mt-2 font-bold text-sm text-[var(--brand-ink)]">
                      {recommendedCard.title}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                      {recommendedCard.learnerInstruction}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[var(--brand-surface-2)] p-3 border border-[var(--brand-border)]">
                    <span className="text-[10px] font-semibold text-[var(--brand-muted)] uppercase tracking-wide">
                      Your goal
                    </span>
                    <p className="mt-1 text-xs text-[var(--brand-ink)]">
                      {recommendedCard.indonesianExplanation}
                    </p>
                    <div className="mt-3 text-xs font-semibold font-mono text-[var(--brand-teal-ink)] bg-[var(--brand-surface)] p-2 rounded border border-[var(--brand-border)] text-center">
                      &quot;{recommendedCard.scaffold}&quot;
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartLesson(recommendedCard)}
                    className="w-full rounded-xl bg-[var(--brand-teal)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--brand-teal-ink)] transition-colors shadow-sm"
                  >
                    Start Lesson
                  </button>

                  <button
                    onClick={() => handleCompleteCard()}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    Complete Lesson
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
