import React from "react";

export interface Question {
  id: string;
  question_type: "true_false" | "multiple_choice" | "fill_blank";
  question_text: string;
  options?: string[];
}

export interface QuestionListProps {
  questions: Question[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, answer: string) => void;
}

export function QuestionList({
  questions,
  answers,
  onAnswerChange,
}: QuestionListProps) {
  
  const renderTrueFalse = (question: Question) => {
    const options = question.options || ["True", "False"];
    const currentAnswer = answers[question.id] || "";

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--brand-ink-soft)] leading-relaxed">
          {question.question_text}
        </p>
        <div className="flex gap-3 mt-1">
          {options.map((opt) => {
            const isSelected = currentAnswer === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onAnswerChange(question.id, opt)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium border transition-all text-center ${
                  isSelected
                    ? "bg-[var(--brand-teal-soft)] border-[var(--brand-teal)] text-[var(--brand-teal-ink)] font-semibold shadow-sm"
                    : "bg-[var(--brand-surface)] border-[var(--brand-border)] text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMultipleChoice = (question: Question) => {
    const options = question.options || [];
    const currentAnswer = answers[question.id] || "";

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[var(--brand-ink-soft)] leading-relaxed">
          {question.question_text}
        </p>
        <div className="flex flex-col gap-2 mt-1">
          {options.map((opt) => {
            const isSelected = currentAnswer === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onAnswerChange(question.id, opt)}
                className={`flex items-center gap-3 py-2.5 px-4 rounded-xl text-sm border text-left transition-all ${
                  isSelected
                    ? "bg-[var(--brand-teal-soft)] border-[var(--brand-teal)] text-[var(--brand-teal-ink)] font-semibold shadow-sm"
                    : "bg-[var(--brand-surface)] border-[var(--brand-border)] text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white"
                      : "border-[var(--brand-border-strong)] bg-white"
                  }`}
                >
                  {isSelected && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFillBlank = (question: Question) => {
    const currentAnswer = answers[question.id] || "";
    const parts = question.question_text.split("[blank]");

    // Inline input element is rendered if '[blank]' is present in the question text.
    if (parts.length > 1) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm font-semibold text-[var(--brand-ink-soft)] leading-relaxed">
            <span>{parts[0]}</span>
            <input
              type="text"
              value={currentAnswer}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Type answer..."
              className="border-b-2 border-[var(--brand-border-strong)] focus:border-[var(--brand-teal)] outline-none px-3 py-0.5 bg-[var(--brand-surface-2)] text-[var(--brand-ink)] font-semibold rounded-md min-w-[140px] max-w-[240px] text-center text-sm shadow-inner"
            />
            <span>{parts[1]}</span>
          </div>
        </div>
      );
    }

    // Fallback if '[blank]' is missing from the question text.
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-ink-soft)] leading-relaxed">
          {question.question_text}
        </p>
        <input
          type="text"
          value={currentAnswer}
          onChange={(e) => onAnswerChange(question.id, e.target.value)}
          placeholder="Type your answer here..."
          className="w-full border border-[var(--brand-border)] focus:border-[var(--brand-teal)] focus:ring-1 focus:ring-[var(--brand-teal)] outline-none px-4 py-2 bg-[var(--brand-surface-2)] text-[var(--brand-ink)] font-semibold rounded-xl text-sm shadow-inner"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, idx) => {
        let content: React.ReactNode;
        if (q.question_type === "true_false") {
          content = renderTrueFalse(q);
        } else if (q.question_type === "multiple_choice") {
          content = renderMultipleChoice(q);
        } else {
          content = renderFillBlank(q);
        }

        return (
          <div
            key={q.id}
            className="p-5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] flex flex-col gap-3 shadow-sm hover:border-[var(--brand-border-strong)] transition-all"
          >
            <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-2 mb-1">
              <span className="text-xs font-bold text-[var(--brand-teal)] uppercase tracking-wider">
                Question {idx + 1}
              </span>
              <span className="text-[10px] font-semibold bg-[var(--brand-surface-2)] border border-[var(--brand-border)] px-2 py-0.5 rounded-full text-[var(--brand-muted)]">
                {q.question_type.replace("_", " ")}
              </span>
            </div>
            {content}
          </div>
        );
      })}
    </div>
  );
}
