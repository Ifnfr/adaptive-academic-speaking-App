import { useState } from "react";
import { AudioController } from "./AudioController";
import { QuestionList, type Question } from "./QuestionList";

export interface ListeningExerciseLayoutProps {
  cefrLevel: string;
  sectionIndex: number;
  sectionCount: number;
  topic: string;
  audioUrls?: (string | null)[];
  questions: Question[];
  onSubmit: (answers: Record<string, string>) => void;
}

export function ListeningExerciseLayout({
  cefrLevel,
  sectionIndex,
  sectionCount,
  topic,
  audioUrls,
  questions,
  onSubmit,
}: ListeningExerciseLayoutProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [replayCount, setReplayCount] = useState(0);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handlePlayStart = () => {
    setReplayCount((prev) => prev + 1);
  };

  const handlePlaybackComplete = () => {
    // Optional callback behavior if needed in future integration
  };

  // Determine if all questions have a non-empty answer
  const isFormComplete =
    questions.length > 0 &&
    questions.every((q) => {
      const val = answers[q.id];
      return val !== undefined && val.trim().length > 0;
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete) return;
    onSubmit(answers);
  };

  const getPhaseName = (idx: number) => {
    switch (idx) {
      case 0:
        return "Phase 1: Fill in the Blank";
      case 1:
        return "Phase 2: Multiple Choice";
      case 2:
        return "Phase 3: True/False";
      default:
        return `Phase ${idx + 1}`;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 max-w-2xl mx-auto p-6 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-3xl shadow-sm"
    >
      {/* Session Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--brand-border)] pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--brand-muted)] uppercase tracking-wider">
              Academic Listening
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--brand-teal-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-teal-ink)] border border-[var(--brand-teal)]/10">
              {cefrLevel}
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--brand-teal-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-teal-ink)] border border-[var(--brand-teal)]/10">
              {getPhaseName(sectionIndex)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--brand-ink)] leading-tight mt-1">
            {topic}
          </h1>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-[var(--brand-muted)]">
            Section {sectionIndex + 1} of {sectionCount}
          </span>
          <div className="w-24 h-1.5 bg-[var(--brand-border)] rounded-full overflow-hidden mt-1.5 border border-[var(--brand-border)]">
            <div
              className="h-full bg-[var(--brand-teal)] transition-all duration-300"
              style={{
                width: `${((sectionIndex + 1) / sectionCount) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Assessment Warning Notice */}
      <div className="p-4 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl flex gap-3 shadow-inner">
        <div className="text-[var(--brand-teal)] mt-0.5 shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-[var(--brand-ink)]">
            Assessment Conditions
          </span>
          <span className="text-xs text-[var(--brand-ink-soft)] leading-relaxed">
            You cannot pause, seek, or rewind the audio playback. A maximum of 3
            plays is strictly enforced.
          </span>
        </div>
      </div>

      {/* Audio Controller */}
      <AudioController
        key={audioUrls?.[0]}
        audioUrls={audioUrls}
        replayCount={replayCount}
        onPlayStart={handlePlayStart}
        onPlaybackComplete={handlePlaybackComplete}
      />

      {/* Question Blocks */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-[var(--brand-ink)] uppercase tracking-wider px-1">
          Questions
        </h2>
        <QuestionList
          questions={questions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
        />
      </div>

      {/* Action Footer */}
      <div className="border-t border-[var(--brand-border)] pt-5 flex items-center justify-between gap-4 mt-2">
        <span className="text-xs font-medium text-[var(--brand-muted)]">
          {!isFormComplete
            ? "Please complete all answers to submit."
            : "All questions answered. Ready to submit."}
        </span>
        <button
          type="submit"
          disabled={!isFormComplete}
          className={`px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${
            isFormComplete
              ? "bg-[var(--brand-teal)] text-white hover:bg-[var(--brand-teal-ink)]"
              : "bg-[var(--brand-surface)] text-[var(--brand-muted)] border border-[var(--brand-border)] cursor-not-allowed"
          }`}
        >
          Submit Answers
        </button>
      </div>
    </form>
  );
}
