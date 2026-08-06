import { useState } from "react";
import type {
  PodchatBubbleEvaluation,
  PodchatBubbleIssueType,
} from "../api/podchat/evaluate-bubbles/route";

export interface BubbleEvaluationCardProps {
  turnId: string;
  learnerText: string;
  evaluation: PodchatBubbleEvaluation | null;
  loading: boolean;
  error: string | null;
  onEvaluate: () => void;
}

const statusTone: Record<
  PodchatBubbleEvaluation["status"],
  { label: string; className: string }
> = {
  strong: { label: "Strong", className: "app-status app-status-success" },
  developing: { label: "Developing", className: "app-status app-status-info" },
  needs_work: { label: "Needs work", className: "app-status app-status-warning" },
};

const issueTypeLabel: Record<PodchatBubbleIssueType, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  idea_development: "Idea development",
  responsiveness: "Responsiveness",
  fluency: "Fluency",
};

export function BubbleEvaluationCard({
  turnId,
  learnerText,
  evaluation,
  loading,
  error,
  onEvaluate,
}: BubbleEvaluationCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
      data-testid={`bubble-evaluation-${turnId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-left"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse bubble feedback" : "Expand bubble feedback"}
          >
            <svg
              className={`h-3.5 w-3.5 transform text-[var(--brand-muted)] transition-transform duration-200 ${
                expanded ? "rotate-0" : "-rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
              Bubble feedback
            </p>
          </button>
          {evaluation && (
            <span
              className={statusTone[evaluation.status].className}
              data-testid={`bubble-evaluation-status-${turnId}`}
            >
              {statusTone[evaluation.status].label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEvaluate}
          disabled={loading}
          className="app-button app-button-secondary min-h-9 px-3 py-1.5 text-xs"
          data-testid={`bubble-evaluate-btn-${turnId}`}
        >
          {loading ? "Evaluating..." : evaluation ? "Re-evaluate" : "Evaluate"}
        </button>
      </div>

      <div className="mt-3 text-sm leading-6 text-[var(--brand-ink-soft)] italic">
        "{learnerText}"
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--brand-teal)]">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--brand-teal)] border-t-transparent"></div>
          <span>Analyzing this bubble...</span>
        </div>
      )}

      {error && (
        <div
          className="app-message app-message-error mt-3 text-xs"
          data-testid={`bubble-evaluation-error-${turnId}`}
        >
          {error}
        </div>
      )}

      {evaluation && !loading && expanded && (
        <div className="mt-3 flex flex-col gap-4">
          {evaluation.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
                What worked
              </p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
                {evaluation.strengths.map((strength, i) => (
                  <li key={`${turnId}-s-${i}`} data-testid={`bubble-strength-${turnId}-${i}`}>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-coral)]">
                What to improve
              </p>
              <ul className="mt-1 flex flex-col gap-2 pl-1 text-sm leading-6">
                {evaluation.issues.map((issue, i) => (
                  <li
                    key={`${turnId}-i-${i}`}
                    className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3"
                    data-testid={`bubble-issue-${turnId}-${i}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                        {issueTypeLabel[issue.type]}
                      </span>
                      <span className="text-xs text-[var(--brand-ink-soft)]">
                        {issue.problem}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                      <span className="font-semibold text-[var(--brand-coral)]">→</span>{" "}
                      <span className="text-[var(--brand-ink)]">{issue.correction}</span>
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
                      {issue.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
              A stronger version
            </p>
            <p
              className="mt-1 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 font-mono text-sm leading-6 text-[var(--brand-ink)]"
              data-testid={`bubble-stronger-${turnId}`}
            >
              {evaluation.strongerVersion}
            </p>
          </div>

          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
            <p
              className="text-sm leading-6 text-[var(--brand-ink)]"
              data-testid={`bubble-suggestion-${turnId}`}
            >
              <span className="font-semibold">One thing to practice: </span>
              {evaluation.microDrill.focus}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
              {evaluation.microDrill.instruction}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--brand-ink-soft)] italic">
              Example: {evaluation.microDrill.example}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
