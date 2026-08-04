import React from "react";

export type ReviewQuestion = {
  questionId: string;
  questionType: "fill_blank" | "multiple_choice" | "true_false";
  questionText: string;
  options?: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
};

export type ReviewSection = {
  sectionIndex: number;
  topic: string;
  questions: ReviewQuestion[];
};

export type ReviewData = {
  sections: ReviewSection[];
};

export interface ListeningExerciseEvaluationViewProps {
  overallScore: number | null;
  estimatedBand: string | null;
  reviewData: ReviewData;
  onTakeAnother: () => void;
}

export function ListeningExerciseEvaluationView({
  overallScore,
  estimatedBand,
  reviewData,
  onTakeAnother,
}: ListeningExerciseEvaluationViewProps) {
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
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-6 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-3xl shadow-sm">
      {/* Header & Score Summary */}
      <div className="flex flex-col items-center text-center gap-4 border-b border-[var(--brand-border)] pb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--brand-success-soft)] flex items-center justify-center text-[var(--brand-success-ink)] border border-[var(--brand-success)]/10 shadow-inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.748-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[var(--brand-ink)]">
            Exercise Complete & Evaluated
          </h2>
          <span className="text-xs text-[var(--brand-muted)]">
            Review your detailed question-by-question performance below.
          </span>
        </div>

        {/* Score / Band Summary Cards */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md p-4 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-2xl">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
              Overall Score
            </span>
            <span className="text-2xl font-black text-[var(--brand-ink)]">
              {overallScore !== null ? `${overallScore}%` : "--"}
            </span>
          </div>
          <div className="flex flex-col border-l border-[var(--brand-border)]">
            <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
              Estimated Band
            </span>
            <span className="text-2xl font-black text-[var(--brand-teal)]">
              {estimatedBand ?? "--"}
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          data-testid="listening-disclaimer"
          className="w-full max-w-md p-3.5 bg-[var(--brand-surface-2)] border border-[var(--brand-border)] rounded-2xl text-[10px] text-[var(--brand-muted)] text-left leading-relaxed flex gap-2.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-[var(--brand-muted)] shrink-0 mt-0.5"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <span className="font-bold block text-[var(--brand-ink-soft)] mb-0.5">
              Disclaimer
            </span>
            Important: The &quot;Estimated Listening Level&quot; is an internal Fonetik estimate.
            It is NOT a certified or officially recognized IELTS or TOEFL score, and
            must not be used for visa, academic admission, or official certification purposes.
          </div>
        </div>
      </div>

      {/* Per-Section Question Review List */}
      <div className="flex flex-col gap-8">
        {reviewData.sections.map((section) => (
          <div key={section.sectionIndex} className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-2">
              <span className="text-xs font-bold text-[var(--brand-teal-ink)] uppercase tracking-wider">
                {getPhaseName(section.sectionIndex)}
              </span>
              <span className="text-xs font-semibold text-[var(--brand-ink-soft)]">
                {section.topic}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {section.questions.map((q, qIdx) => {
                const isCorrect = q.isCorrect === true;
                const isIncorrect = q.isCorrect === false;

                return (
                  <div
                    key={q.questionId || qIdx}
                    className={`p-4 border rounded-2xl flex flex-col gap-3 transition-all ${
                      isCorrect
                        ? "bg-[var(--brand-surface-2)] border-[var(--brand-success)]/30"
                        : isIncorrect
                        ? "bg-[var(--brand-coral-soft)]/20 border-[var(--brand-coral)]/30"
                        : "bg-[var(--brand-surface-2)] border-[var(--brand-border)]"
                    }`}
                  >
                    {/* Question Header & Status Indicator */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--brand-ink)] leading-snug">
                        {qIdx + 1}. {q.questionText}
                      </span>

                      {isCorrect && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-success-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-success-ink)] border border-[var(--brand-success)]/20 shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Correct
                        </span>
                      )}

                      {isIncorrect && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-coral-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-coral)] border border-[var(--brand-coral)]/30 shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Incorrect
                        </span>
                      )}
                    </div>

                    {/* Options List (for Multiple Choice) */}
                    {q.questionType === "multiple_choice" && q.options && q.options.length > 0 && (
                      <div className="flex flex-col gap-1 pl-2 border-l-2 border-[var(--brand-border)] my-1">
                        <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
                          Options
                        </span>
                        <ul className="text-xs text-[var(--brand-ink-soft)] space-y-0.5">
                          {q.options.map((opt, optIdx) => (
                            <li key={optIdx} className="flex items-center gap-1.5">
                              <span className="text-[var(--brand-muted)] font-mono text-[10px]">
                                •
                              </span>
                              {opt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Answer Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--brand-border)]/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
                          Your Answer
                        </span>
                        <span
                          className={`font-semibold ${
                            isCorrect
                              ? "text-[var(--brand-success-ink)]"
                              : isIncorrect
                              ? "text-[var(--brand-coral)]"
                              : "text-[var(--brand-ink-soft)]"
                          }`}
                        >
                          {q.userAnswer ?? "(No answer)"}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-[var(--brand-muted)] uppercase tracking-wider">
                          Correct Answer
                        </span>
                        <span className="font-semibold text-[var(--brand-ink)]">
                          {q.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* Explanation (Incorrect Answers Only, if present) */}
                    {isIncorrect && q.explanation && q.explanation.trim().length > 0 && (
                      <div className="mt-1 p-3 bg-[var(--brand-surface)] border border-[var(--brand-coral)]/20 rounded-xl text-xs flex flex-col gap-1">
                        <span className="font-bold text-[var(--brand-coral)] text-[10px] uppercase tracking-wider">
                          Explanation / Key Fact
                        </span>
                        <p className="text-[var(--brand-ink-soft)] leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <div className="border-t border-[var(--brand-border)] pt-4 mt-2">
        <button
          type="button"
          onClick={onTakeAnother}
          className="w-full py-3 bg-[var(--brand-teal)] hover:bg-[var(--brand-teal-ink)] text-white font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
        >
          Take Another Exercise
        </button>
      </div>
    </div>
  );
}

